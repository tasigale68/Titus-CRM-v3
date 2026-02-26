var express = require('express');
var crypto = require('crypto');
var twilio = require('twilio');
var { authenticate } = require('../../middleware/auth');
var { db } = require('../../db/sqlite');
var env = require('../../config/env');

var router = express.Router();

// ═══════════════════════════════════════════════════════
//  Config — derived from centralised env
// ═══════════════════════════════════════════════════════

var TWILIO_SID          = env.twilio.accountSid;
var TWILIO_TOKEN        = env.twilio.authToken;
var TWILIO_PHONE        = env.twilio.phoneNumber;
var TWILIO_API_KEY      = env.twilio.apiKey;
var TWILIO_API_SECRET   = env.twilio.apiSecret;
var TWILIO_TWIML_APP_SID = env.twilio.twimlAppSid;
var ELEVENLABS_API_KEY  = env.elevenLabs.apiKey;
var ELEVENLABS_AGENT_ID = env.elevenLabs.agentId;
var ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || "";
var ANTHROPIC_API_KEY   = env.anthropic.apiKey;
var BASE_URL            = process.env.BASE_URL || ("http://localhost:" + (env.port || 3000));

// Twilio client (may be null if not configured)
var twilioClient = null;
if (TWILIO_SID && TWILIO_TOKEN) {
  twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
  console.log("Voice: Twilio client connected");
} else {
  console.log("Voice: Twilio not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)");
}

// ═══════════════════════════════════════════════════════
//  Helper: role check
// ═══════════════════════════════════════════════════════

function isSeniorRole(user) {
  return user.role === "superadmin" || user.role === "director";
}

// ═══════════════════════════════════════════════════════
//  Helper: format Australian phone to E.164
// ═══════════════════════════════════════════════════════

function formatAUPhone(num) {
  if (!num) return num;
  num = num.replace(/[\s\-()]/g, "");
  if (num.match(/^04\d{8}$/)) num = "+61" + num.substring(1);
  if (num.match(/^0[2-9]\d{8}$/)) num = "+61" + num.substring(1);
  if (num.match(/^61\d{9}$/) && num[0] !== "+") num = "+" + num;
  return num;
}

// ═══════════════════════════════════════════════════════
//  Helper: get socket.io from Express app
// ═══════════════════════════════════════════════════════

function getIO(req) {
  return req.app.get('io');
}

// ═══════════════════════════════════════════════════════
//  Helper: get active hunt group (first active one)
// ═══════════════════════════════════════════════════════

function getActiveHuntGroup() {
  try {
    var group = db.prepare("SELECT * FROM call_hunt_groups WHERE active=1 ORDER BY created_at ASC LIMIT 1").get();
    if (!group) return null;
    group.members = JSON.parse(group.members || "[]");
    return group;
  } catch(e) { return null; }
}

// ═══════════════════════════════════════════════════════
//  Helper: check if agent should be skipped (busy/offline/on-call)
// ═══════════════════════════════════════════════════════

function isAgentBusy(userId) {
  try {
    var avRow = db.prepare("SELECT status FROM agent_availability WHERE user_id=? ORDER BY id DESC LIMIT 1").get(userId);
    var manualStatus = avRow ? avRow.status : "offline";
    if (manualStatus === "offline") return true;
    if (manualStatus === "busy") return true;

    var clientId = "client:user_" + userId;
    var activeBrowserCall = db.prepare(
      "SELECT id FROM calls WHERE (to_number=? OR from_number=?) AND status IN ('ringing','in-progress','initiated') AND created_at > datetime('now','-2 hours') LIMIT 1"
    ).get(clientId, clientId);
    if (activeBrowserCall) {
      console.log("Hunt: agent", userId, "has active browser call — skipping");
      return true;
    }

    var userRow = db.prepare("SELECT phone_number FROM users WHERE id=?").get(userId);
    if (userRow && userRow.phone_number) {
      var phone = userRow.phone_number.trim();
      var activePhoneCall = db.prepare(
        "SELECT id FROM calls WHERE (to_number=? OR from_number=?) AND status IN ('ringing','in-progress','initiated') AND created_at > datetime('now','-2 hours') LIMIT 1"
      ).get(phone, phone);
      if (activePhoneCall) {
        console.log("Hunt: agent", userId, "is on a phone call — skipping");
        return true;
      }
    }
    return false;
  } catch(e) { return false; }
}

// ═══════════════════════════════════════════════════════
//  Helper: build TwiML to redirect to Denise AI fallback
// ═══════════════════════════════════════════════════════

function twimlFallbackToAI(twiml, From) {
  var callerParam = From ? ("&caller_id=" + encodeURIComponent(From)) : "";
  twiml.redirect({ method: "POST" }, "https://api.elevenlabs.io/twilio/inbound_call?agent_id=" + ELEVENLABS_AGENT_ID + callerParam);
}

// ═══════════════════════════════════════════════════════
//  Helper: generate AI summary using Claude
// ═══════════════════════════════════════════════════════

function generateCallSummary(callSid, io) {
  if (!ANTHROPIC_API_KEY) return;
  var call = db.prepare("SELECT * FROM calls WHERE sid = ?").get(callSid);
  if (!call || !call.transcript) return;
  fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5", max_tokens: 200,
      messages: [{ role: "user", content: "Summarise this NDIS support call in 1-2 sentences:\n" + call.transcript }]
    })
  }).then(function(r) { return r.json(); }).then(function(data) {
    var summary = data.content && data.content[0] ? data.content[0].text : null;
    if (summary) {
      db.prepare("UPDATE calls SET summary = ? WHERE sid = ?").run(summary, callSid);
      if (io) io.emit("call:summarised", { sid: callSid, summary: summary });
    }
  }).catch(function(err) { console.error("Summary error:", err); });
}

function generateCallSummaryFromRecording(callSid, io) {
  if (!ANTHROPIC_API_KEY) return;
  var call = db.prepare("SELECT * FROM calls WHERE sid = ?").get(callSid);
  if (!call) return;
  if (!call.transcript) {
    var note = "Call " + (call.type || "unknown") + " - " + (call.duration || 0) + " seconds with " + (call.from_number || "unknown") + ". Recording available but transcript pending.";
    db.prepare("UPDATE calls SET summary = ? WHERE sid = ?").run(note, callSid);
    if (io) io.emit("call:summarised", { sid: callSid, summary: note });
  }
}

function saveBasicNote(callSid, call, io) {
  var existingCall = db.prepare("SELECT transcript, summary FROM calls WHERE sid = ?").get(callSid);
  if (existingCall && !existingCall.summary) {
    var note = "Call " + (call.type || "unknown") + " - " + (call.duration || 0) + "s with " + (call.from_number || "unknown") + ". No transcript available yet.";
    db.prepare("UPDATE calls SET summary = ? WHERE sid = ?").run(note, callSid);
    if (io) io.emit("call:summarised", { sid: callSid, summary: note });
  }
}

// ═══════════════════════════════════════════════════════
//  Transcript Fetching Helpers
// ═══════════════════════════════════════════════════════

function transcribeRecordingWithWhisper(callSid, recordingSid, mp3Url, io) {
  if (!twilioClient) return;
  twilioClient.recordings(recordingSid).transcriptions.list({ limit: 1 }).then(function(transcriptions) {
    if (transcriptions.length > 0 && transcriptions[0].transcriptionText) {
      var text = transcriptions[0].transcriptionText;
      db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(text, callSid);
      if (io) io.emit("call:transcribed", { sid: callSid, transcript: text });
      console.log("Twilio transcript saved for call:", callSid);
      generateCallSummary(callSid, io);
    } else {
      console.log("No Twilio transcription available for:", callSid, "- generating summary from recording");
      generateCallSummaryFromRecording(callSid, io);
    }
  }).catch(function(err) {
    console.log("Twilio transcription failed for:", callSid, "-", err.message);
    generateCallSummaryFromRecording(callSid, io);
  });
}

function fetchCallRecording(callSid, io) {
  if (!twilioClient) return;
  console.log("Fetching recordings for call:", callSid);
  twilioClient.recordings.list({ callSid: callSid, limit: 5 }).then(function(recordings) {
    if (recordings.length > 0) {
      var rec = recordings[0];
      var recUrl = "https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_SID + "/Recordings/" + rec.sid + ".mp3";
      db.prepare("UPDATE calls SET recording_url = ? WHERE sid = ?").run(recUrl, callSid);
      console.log("Recording saved for call:", callSid, "RecSid:", rec.sid);
      transcribeRecording(callSid, rec.sid, io);
    } else {
      console.log("No recordings found for call:", callSid);
      fetchElevenLabsTranscript(callSid, io);
    }
  }).catch(function(err) {
    console.error("Error fetching recordings:", err.message);
    fetchElevenLabsTranscript(callSid, io);
  });
}

function transcribeRecording(callSid, recordingSid, io) {
  if (!twilioClient) return;
  console.log("Requesting transcription for recording:", recordingSid);
  twilioClient.recordings(recordingSid).transcriptions.list({ limit: 1 }).then(function(transcriptions) {
    if (transcriptions.length > 0 && transcriptions[0].transcriptionText) {
      var text = transcriptions[0].transcriptionText;
      db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(text, callSid);
      if (io) io.emit("call:transcribed", { sid: callSid, transcript: text });
      console.log("Twilio transcript saved for call:", callSid);
      generateCallSummary(callSid, io);
    } else {
      console.log("No Twilio transcription available, trying ElevenLabs for:", callSid);
      generateCallSummaryFromRecording(callSid, io);
    }
  }).catch(function(err) {
    console.log("Transcription fetch failed:", err.message, "- trying ElevenLabs");
    fetchElevenLabsTranscript(callSid, io);
  });
}

function fetchElevenLabsTranscript(callSid, io) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) return;
  console.log("Fetching ElevenLabs conversations for call:", callSid);
  fetch("https://api.us.elevenlabs.io/v1/convai/conversations?agent_id=" + ELEVENLABS_AGENT_ID + "&page_size=50", {
    headers: { "xi-api-key": ELEVENLABS_API_KEY }
  }).then(function(r) { return r.json(); }).then(function(data) {
    var conversations = data.conversations || [];
    if (conversations.length === 0) {
      console.log("No ElevenLabs conversations found");
      return;
    }
    var found = false;
    conversations.forEach(function(conv) {
      if (found) return;
      fetch("https://api.us.elevenlabs.io/v1/convai/conversations/" + conv.conversation_id, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY }
      }).then(function(r2) { return r2.json(); }).then(function(detail) {
        if (found) return;
        var transcript = "";
        if (detail.transcript && detail.transcript.length > 0) {
          transcript = detail.transcript.map(function(t) {
            return (t.role === "agent" ? "Agent" : "Caller") + ": " + t.message;
          }).join("\n");
        }
        if (transcript) {
          var call = db.prepare("SELECT transcript FROM calls WHERE sid = ?").get(callSid);
          if (call && !call.transcript) {
            db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(transcript, callSid);
            if (io) io.emit("call:transcribed", { sid: callSid, transcript: transcript });
            console.log("ElevenLabs transcript saved for call:", callSid);
            generateCallSummary(callSid, io);
            found = true;
          }
        }
      }).catch(function(err) { console.error("ElevenLabs detail error:", err.message); });
    });
  }).catch(function(err) { console.error("ElevenLabs conversations error:", err.message); });
}

// Smart ElevenLabs transcript fetch — matches by phone number and time window
function fetchElevenLabsTranscriptForCall(callSid, call, io) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    console.log("ElevenLabs not configured, cannot fetch transcript for:", callSid);
    return;
  }
  var callTime = new Date(call.created_at).getTime();
  var callPhone = (call.from_number || "").replace(/[^0-9]/g, "");
  console.log("ElevenLabs smart match for:", callSid, "phone:", callPhone, "time:", call.created_at);

  fetch("https://api.us.elevenlabs.io/v1/convai/conversations?agent_id=" + ELEVENLABS_AGENT_ID + "&page_size=100", {
    headers: { "xi-api-key": ELEVENLABS_API_KEY }
  }).then(function(r) { return r.json(); }).then(function(data) {
    var conversations = data.conversations || [];
    if (conversations.length === 0) {
      console.log("No ElevenLabs conversations found");
      saveBasicNote(callSid, call, io);
      return;
    }
    console.log("Found", conversations.length, "ElevenLabs conversations, checking each...");

    var bestMatch = null;
    var bestTimeDiff = Infinity;
    var pending = conversations.length;

    conversations.forEach(function(conv) {
      fetch("https://api.us.elevenlabs.io/v1/convai/conversations/" + conv.conversation_id, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY }
      }).then(function(r2) { return r2.json(); }).then(function(detail) {
        var convTime = detail.start_time_unix_secs ? detail.start_time_unix_secs * 1000 : (new Date(detail.metadata && detail.metadata.start_time || 0).getTime());
        var timeDiff = Math.abs(convTime - callTime);

        var convPhone = "";
        var meta = detail.metadata || {};
        var rawPhone = meta.phone_number || meta.caller_id || meta.from || meta.from_number || meta.twilio_from || "";
        if (rawPhone) convPhone = String(rawPhone).replace(/[^0-9]/g, "");
        var phoneMatch = callPhone && convPhone && (callPhone.indexOf(convPhone) >= 0 || convPhone.indexOf(callPhone) >= 0);

        var transcript = "";
        if (detail.transcript && detail.transcript.length > 0) {
          transcript = detail.transcript.map(function(t) {
            return (t.role === "agent" ? "Denise (AI)" : "Caller") + ": " + t.message;
          }).join("\n");
        }

        if (transcript) {
          if (phoneMatch && timeDiff < 900000) {
            if (timeDiff < bestTimeDiff || !bestMatch) {
              bestMatch = { transcript: transcript, convId: conv.conversation_id, timeDiff: timeDiff };
              bestTimeDiff = timeDiff;
            }
          } else if (!bestMatch && timeDiff < 900000) {
            bestMatch = { transcript: transcript, convId: conv.conversation_id, timeDiff: timeDiff };
            bestTimeDiff = timeDiff;
          }
        }

        pending--;
        if (pending === 0 && bestMatch) {
          var existingCall = db.prepare("SELECT transcript FROM calls WHERE sid = ?").get(callSid);
          if (existingCall && !existingCall.transcript) {
            db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(bestMatch.transcript, callSid);
            if (io) io.emit("call:transcribed", { sid: callSid, transcript: bestMatch.transcript });
            console.log("ElevenLabs transcript matched for:", callSid, "conv:", bestMatch.convId, "timeDiff:", Math.round(bestMatch.timeDiff/1000)+"s");
            generateCallSummary(callSid, io);
          }
        } else if (pending === 0 && !bestMatch) {
          console.log("No matching ElevenLabs transcript found for:", callSid);
          saveBasicNote(callSid, call, io);
        }
      }).catch(function(err) {
        pending--;
        console.error("ElevenLabs detail error:", err.message);
        if (pending === 0 && !bestMatch) {
          saveBasicNote(callSid, call, io);
        }
      });
    });
  }).catch(function(err) {
    console.error("ElevenLabs conversations error:", err.message);
    saveBasicNote(callSid, call, io);
  });
}

function matchTranscriptsToCalls(calls, elDetails, io) {
  console.log("Matching", elDetails.length, "ElevenLabs convos to", calls.length, "calls");
  var matched = 0;
  var usedConvIds = {};

  calls.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });

  calls.forEach(function(call) {
    if (call.type !== "inbound") return;
    var callTime = new Date(call.created_at).getTime();
    var callPhone = (call.from_number || "").replace(/[^0-9]/g, "");

    var bestMatch = null;
    var bestScore = -1;

    elDetails.forEach(function(detail) {
      if (usedConvIds[detail._convId]) return;

      var convTime = detail.start_time_unix_secs ? detail.start_time_unix_secs * 1000 : 0;
      var timeDiff = Math.abs(convTime - callTime);
      if (timeDiff > 1200000) return;

      var transcript = "";
      if (detail.transcript && detail.transcript.length > 0) {
        transcript = detail.transcript.map(function(t) {
          return (t.role === "agent" ? "Denise (AI)" : "Caller") + ": " + t.message;
        }).join("\n");
      }
      if (!transcript) return;

      var score = 0;
      var convPhone = "";
      var _bm = detail.metadata || {};
      var _bp = _bm.phone_number || _bm.caller_id || _bm.from || _bm.from_number || _bm.twilio_from || "";
      if (_bp) convPhone = String(_bp).replace(/[^0-9]/g, "");
      if (callPhone && convPhone && (callPhone.indexOf(convPhone) >= 0 || convPhone.indexOf(callPhone) >= 0)) {
        score += 100;
      }
      score += Math.max(0, 100 - Math.round(timeDiff / 1000));

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { transcript: transcript, convId: detail._convId };
      }
    });

    if (bestMatch && bestScore > 10) {
      usedConvIds[bestMatch.convId] = true;
      var existing = db.prepare("SELECT transcript FROM calls WHERE sid = ?").get(call.sid);
      if (existing && !existing.transcript) {
        db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(bestMatch.transcript, call.sid);
        if (io) io.emit("call:transcribed", { sid: call.sid, transcript: bestMatch.transcript });
        console.log("BULK MATCH: call", call.sid, "-> EL conv", bestMatch.convId, "score:", bestScore);
        matched++;
        generateCallSummary(call.sid, io);
      }
    }
  });
  console.log("=== BULK MATCH COMPLETE: " + matched + " transcripts matched ===");
}

// Audio token store (in-memory, short-lived)
var audioTokens = {};
function makeAudioToken(sid) {
  var token = crypto.randomBytes(16).toString("hex");
  audioTokens[token] = { sid: sid, exp: Date.now() + 3600000 };
  return token;
}


// ═══════════════════════════════════════════════════════
//  Twilio Webhooks (no auth — called by Twilio)
// ═══════════════════════════════════════════════════════

// ─── INBOUND CALL — Hunt Group Sequential Routing ───
// POST /api/voice/webhook/inbound
router.post('/webhook/inbound', function(req, res) {
  var io = getIO(req);
  var CallSid = req.body.CallSid;
  var From = req.body.From;
  var To = req.body.To;
  var CallStatus = req.body.CallStatus;
  db.prepare("INSERT OR IGNORE INTO calls (sid, type, from_number, to_number, status) VALUES (?, 'inbound', ?, ?, ?)").run(CallSid, From, To, CallStatus || "ringing");
  io.emit("call:incoming", { sid: CallSid, from: From, to: To, status: "ringing" });

  var twiml = new twilio.twiml.VoiceResponse();

  // Check AI enabled flag
  var aiRow = null;
  try { aiRow = db.prepare("SELECT value FROM app_settings WHERE key='ai_enabled'").get(); } catch(e) {}
  var aiEnabled = !aiRow || aiRow.value !== "false";

  // Get active hunt group
  var group = getActiveHuntGroup();
  var members = group ? group.members : [];

  // Filter: skip offline agents and AI fallback member
  var humanMembers = members.filter(function(m) {
    if (String(m.userId) === "ai_denise") return false;
    if (isAgentBusy(m.userId)) return false;
    return true;
  });

  // Check if Denise AI is in the group as a member — she's the fallback
  var deniseInGroup = members.some(function(m) { return String(m.userId) === "ai_denise"; });
  var useDeniseFallback = aiEnabled && ELEVENLABS_AGENT_ID && (deniseInGroup || members.length === 0);

  if (humanMembers.length === 0) {
    if (useDeniseFallback) {
      twiml.say("Thank you for calling Delta Community Support. Connecting you now.");
      twimlFallbackToAI(twiml, From);
    } else {
      twiml.say("Thank you for calling Delta Community Support. Our team is currently unavailable. Please leave a message after the tone.");
      twiml.record({ maxLength: 120, transcribe: false });
    }
    return res.type("text/xml").send(twiml.toString());
  }

  // Store call routing state for hunt-step webhook
  try {
    db.prepare("CREATE TABLE IF NOT EXISTS call_routing (call_sid TEXT PRIMARY KEY, group_id INTEGER, member_index INTEGER, from_number TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
    db.prepare("INSERT OR REPLACE INTO call_routing (call_sid, group_id, member_index, from_number) VALUES (?,?,?,?)").run(CallSid, group ? group.id : 0, 0, From);
  } catch(e) { console.error("call_routing insert error:", e.message); }

  var firstMember = humanMembers[0];
  var ringSeconds = firstMember.ringSeconds || (group ? group.ring_seconds : 20) || 20;

  var agentUser = db.prepare("SELECT phone_number, name FROM users WHERE id=?").get(firstMember.userId);
  var agentPhone = agentUser && agentUser.phone_number ? agentUser.phone_number.trim() : null;

  if (!agentPhone) {
    console.log("Hunt: agent", firstMember.userId, "has no phone number — falling back");
    if (useDeniseFallback) {
      twiml.say("Thank you for calling Delta Community Support. Connecting you now.");
      twimlFallbackToAI(twiml, From);
    } else {
      twiml.say("Thank you for calling Delta Community Support. Please leave a message.");
      twiml.record({ maxLength: 120, transcribe: false });
    }
    return res.type("text/xml").send(twiml.toString());
  }

  var useBrowser = !!TWILIO_API_KEY;
  var clientIdentity = "user_" + firstMember.userId;
  var dialTarget = useBrowser ? ("client:" + clientIdentity) : agentPhone;
  console.log("Hunt: ringing agent", agentUser.name, useBrowser ? ("browser:"+clientIdentity) : agentPhone, "for", ringSeconds, "seconds");
  twiml.say("Thank you for calling Delta Community Support. Please hold while we connect you.");
  var dial = twiml.dial({
    timeout: ringSeconds,
    record: "record-from-answer",
    recordingStatusCallback: BASE_URL + "/api/voice/webhook/recording",
    recordingStatusCallbackMethod: "POST",
    action: BASE_URL + "/api/voice/webhook/hunt-step?callSid=" + CallSid + "&step=1&from=" + encodeURIComponent(From || ""),
    method: "POST"
  });
  if (useBrowser) {
    dial.client(clientIdentity);
  } else {
    dial.number(agentPhone, {
      statusCallbackEvent: ["initiated","ringing","answered","completed"],
      statusCallback: BASE_URL + "/api/voice/webhook/status",
      statusCallbackMethod: "POST"
    });
  }

  res.type("text/xml").send(twiml.toString());
});

// ─── HUNT STEP — called by Twilio after each ring attempt ───
// POST /api/voice/webhook/hunt-step
router.post('/webhook/hunt-step', function(req, res) {
  var io = getIO(req);
  var DialCallStatus = req.body.DialCallStatus;
  var CallSid = req.query.callSid || req.body.CallSid;
  var step = parseInt(req.query.step) || 1;
  var From = req.query.from ? decodeURIComponent(req.query.from) : req.body.From;

  console.log("Hunt step", step, "DialCallStatus:", DialCallStatus, "CallSid:", CallSid);

  var twiml = new twilio.twiml.VoiceResponse();

  if (DialCallStatus === "answered" || DialCallStatus === "completed") {
    twiml.hangup();
    return res.type("text/xml").send(twiml.toString());
  }

  var routing = null;
  try { routing = db.prepare("SELECT * FROM call_routing WHERE call_sid=?").get(CallSid); } catch(e) {}

  var aiRow = null;
  try { aiRow = db.prepare("SELECT value FROM app_settings WHERE key='ai_enabled'").get(); } catch(e) {}
  var aiEnabled = !aiRow || aiRow.value !== "false";
  var group = routing ? getActiveHuntGroup() : null;
  var members = group ? group.members.filter(function(m){ return String(m.userId) !== "ai_denise"; }) : [];
  var deniseInGroup = group ? group.members.some(function(m){ return String(m.userId) === "ai_denise"; }) : false;
  var useDeniseFallback = aiEnabled && ELEVENLABS_AGENT_ID && (deniseInGroup || !group);

  if (group && step < members.length) {
    var nextMember = members[step];
    if (isAgentBusy(nextMember.userId)) {
      console.log("Hunt: step", step, "agent", nextMember.userId, "busy/on-call — skipping to next");
      var skipTwiml = new twilio.twiml.VoiceResponse();
      skipTwiml.redirect({method:"POST"}, BASE_URL + "/api/voice/webhook/hunt-step?callSid=" + CallSid + "&step=" + (step+1) + "&from=" + encodeURIComponent(From||""));
      return res.type("text/xml").send(skipTwiml.toString());
    }
    var agentUser = db.prepare("SELECT phone_number, name FROM users WHERE id=?").get(nextMember.userId);
    var agentPhone = agentUser && agentUser.phone_number ? agentUser.phone_number.trim() : null;
    if (agentPhone) {
      var ringSeconds = nextMember.ringSeconds || group.ring_seconds || 20;
      var useBrowserStep = !!TWILIO_API_KEY;
      var stepIdentity = "user_" + nextMember.userId;
      console.log("Hunt: step", step, "ringing", agentUser.name, useBrowserStep ? ("browser:"+stepIdentity) : agentPhone);
      var dial = twiml.dial({
        timeout: ringSeconds,
        record: "record-from-answer",
        recordingStatusCallback: BASE_URL + "/api/voice/webhook/recording",
        recordingStatusCallbackMethod: "POST",
        action: BASE_URL + "/api/voice/webhook/hunt-step?callSid=" + CallSid + "&step=" + (step+1) + "&from=" + encodeURIComponent(From||""),
        method: "POST"
      });
      if (useBrowserStep) {
        dial.client(stepIdentity);
      } else {
        dial.number(agentPhone, {
          statusCallbackEvent: ["initiated","ringing","answered","completed"],
          statusCallback: BASE_URL + "/api/voice/webhook/status",
          statusCallbackMethod: "POST"
        });
      }
      return res.type("text/xml").send(twiml.toString());
    }
    // No phone — skip to next
    twiml.redirect({method:"POST"}, BASE_URL + "/api/voice/webhook/hunt-step?callSid=" + CallSid + "&step=" + (step+1) + "&from=" + encodeURIComponent(From||""));
    return res.type("text/xml").send(twiml.toString());
  }

  // All humans exhausted — fall back to Denise AI or voicemail
  console.log("Hunt: all agents exhausted for", CallSid, "— falling back to", useDeniseFallback ? "Denise AI" : "voicemail");
  if (useDeniseFallback) {
    twiml.say("Please hold, connecting you now.");
    twimlFallbackToAI(twiml, From);
  } else {
    twiml.say("Our team is currently unavailable. Please leave a message after the tone.");
    twiml.record({ maxLength: 120, transcribe: false });
  }
  res.type("text/xml").send(twiml.toString());
});

// ─── OUTBOUND CALL TwiML (serves instructions when operator answers) ───
// POST /api/voice/webhook/outbound
router.post('/webhook/outbound', function(req, res) {
  try {
    var destination = (req.query.to || "").trim();
    if (destination && !destination.startsWith("+")) {
      destination = "+" + destination;
    }
    console.log("Outbound TwiML POST: bridging to", destination);
    var twiml = new twilio.twiml.VoiceResponse();
    if (!destination) {
      twiml.say("Sorry, no destination number was provided.");
      twiml.hangup();
    } else {
      twiml.say("Connecting your call now");
      var dial = twiml.dial({
        timeout: 30,
        callerId: TWILIO_PHONE,
        record: "record-from-answer",
        recordingStatusCallback: BASE_URL + "/api/voice/webhook/recording",
        recordingStatusCallbackMethod: "POST"
      });
      dial.number(destination);
    }
    var xml = twiml.toString();
    console.log("TwiML response:", xml);
    res.type("text/xml").send(xml);
  } catch (err) {
    console.error("OUTBOUND WEBHOOK ERROR:", err);
    var fallback = new twilio.twiml.VoiceResponse();
    fallback.say("Sorry, a system error occurred.");
    fallback.hangup();
    res.type("text/xml").send(fallback.toString());
  }
});

// GET /api/voice/webhook/outbound
router.get('/webhook/outbound', function(req, res) {
  try {
    var destination = (req.query.to || "").trim();
    if (destination && !destination.startsWith("+")) {
      destination = "+" + destination;
    }
    console.log("Outbound TwiML GET: bridging to", destination);
    var twiml = new twilio.twiml.VoiceResponse();
    if (!destination) {
      twiml.say("Sorry, no destination number was provided.");
      twiml.hangup();
    } else {
      twiml.say("Connecting your call now");
      var dial = twiml.dial({
        timeout: 30,
        callerId: TWILIO_PHONE,
        record: "record-from-answer",
        recordingStatusCallback: BASE_URL + "/api/voice/webhook/recording",
        recordingStatusCallbackMethod: "POST"
      });
      dial.number(destination);
    }
    var xml = twiml.toString();
    console.log("TwiML response:", xml);
    res.type("text/xml").send(xml);
  } catch (err) {
    console.error("OUTBOUND WEBHOOK ERROR:", err);
    var fallback = new twilio.twiml.VoiceResponse();
    fallback.say("Sorry, a system error occurred.");
    fallback.hangup();
    res.type("text/xml").send(fallback.toString());
  }
});

// ─── CALL STATUS CALLBACK ───
// POST /api/voice/webhook/status
router.post('/webhook/status', function(req, res) {
  var io = getIO(req);
  var CallSid = req.body.CallSid;
  var CallStatus = req.body.CallStatus;
  var CallDuration = req.body.CallDuration;
  var From = req.body.From || req.body.Caller || "";
  var To = req.body.To || req.body.Called || "";
  var Direction = req.body.Direction || "inbound";
  var type = Direction.indexOf("inbound") >= 0 ? "inbound" : "outbound";
  var existing = db.prepare("SELECT id FROM calls WHERE sid = ?").get(CallSid);
  if (!existing) {
    db.prepare("INSERT OR IGNORE INTO calls (sid, type, from_number, to_number, status, duration) VALUES (?, ?, ?, ?, ?, ?)").run(CallSid, type, From, To, CallStatus, CallDuration || 0);
    io.emit("call:incoming", { sid: CallSid, from: From, to: To, status: CallStatus });
  } else {
    db.prepare("UPDATE calls SET status = ?, duration = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?").run(CallStatus, CallDuration || 0, CallSid);
  }
  io.emit("call:status", { sid: CallSid, status: CallStatus, duration: CallDuration });
  // When call completes, fetch recording and transcript
  if (CallStatus === "completed") {
    var completedCall = db.prepare("SELECT * FROM calls WHERE sid = ?").get(CallSid);
    if (completedCall && completedCall.type === "inbound") {
      setTimeout(function() {
        var check = db.prepare("SELECT transcript FROM calls WHERE sid = ?").get(CallSid);
        if (!check || check.transcript) return;
        console.log("EL webhook didn't arrive for", CallSid, "— falling back to smart fetch");
        fetchElevenLabsTranscriptForCall(CallSid, completedCall, io);
      }, 20000);
    } else {
      setTimeout(function() { fetchCallRecording(CallSid, io); }, 5000);
    }
  }
  res.sendStatus(200);
});

// ─── TRANSCRIPTION CALLBACK ───
// POST /api/voice/webhook/transcription
router.post('/webhook/transcription', function(req, res) {
  var io = getIO(req);
  var CallSid = req.body.CallSid;
  var TranscriptionText = req.body.TranscriptionText;
  var TranscriptionStatus = req.body.TranscriptionStatus;
  if (TranscriptionStatus === "completed" && TranscriptionText) {
    db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(TranscriptionText, CallSid);
    io.emit("call:transcribed", { sid: CallSid, transcript: TranscriptionText });
    generateCallSummary(CallSid, io);
  }
  res.sendStatus(200);
});

// ─── RECORDING STATUS CALLBACK ───
// POST /api/voice/webhook/recording
router.post('/webhook/recording', function(req, res) {
  var io = getIO(req);
  var RecordingUrl = req.body.RecordingUrl;
  var RecordingSid = req.body.RecordingSid;
  var CallSid = req.body.CallSid;
  var RecordingStatus = req.body.RecordingStatus;
  var RecordingDuration = req.body.RecordingDuration;
  console.log("Recording webhook:", RecordingStatus, RecordingSid, "for call:", CallSid, "duration:", RecordingDuration + "s");
  if (RecordingStatus !== "completed") { return res.sendStatus(200); }
  if (RecordingUrl && CallSid) {
    var mp3Url = "https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_SID + "/Recordings/" + RecordingSid + ".mp3";
    db.prepare("UPDATE calls SET recording_url = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?").run(mp3Url, CallSid);
    io.emit("call:recording", { sid: CallSid, recording_url: mp3Url, recording_sid: RecordingSid, duration: RecordingDuration });
    console.log("Recording saved:", CallSid, "->", mp3Url);
    setTimeout(function() { transcribeRecordingWithWhisper(CallSid, RecordingSid, mp3Url, io); }, 3000);
  }
  res.sendStatus(200);
});

// ─── BROWSER OUTBOUND TwiML (from browser SDK) ───
// POST /api/voice/webhook/browser-outbound
router.post('/webhook/browser-outbound', function(req, res) {
  var To = req.body.To;
  var From = TWILIO_PHONE;
  if (To && !To.startsWith("+") && !To.startsWith("client:")) {
    var digits = To.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      To = "+61" + digits.slice(1);
    } else if (!digits.startsWith("61")) {
      To = "+61" + digits;
    } else {
      To = "+" + digits;
    }
  }
  console.log("[browser-outbound] To:", To, "From:", From);
  var twiml = new twilio.twiml.VoiceResponse();
  if (!To) {
    twiml.say("No destination number provided.");
    twiml.hangup();
  } else {
    var dial = twiml.dial({
      callerId: From,
      record: "record-from-answer",
      recordingStatusCallback: BASE_URL + "/api/voice/webhook/recording",
      recordingStatusCallbackMethod: "POST"
    });
    if (To.startsWith("client:")) {
      dial.client(To.replace("client:", ""));
    } else {
      dial.number(To);
    }
  }
  res.type("text/xml").send(twiml.toString());
});

// ─── SMS INBOUND WEBHOOK ───
// POST /api/voice/webhook/sms-inbound
router.post('/webhook/sms-inbound', function(req, res) {
  var io = getIO(req);
  var MessageSid = req.body.MessageSid;
  var From       = req.body.From;
  var To         = req.body.To;
  var Body       = req.body.Body || "";
  var numMedia   = parseInt(req.body.NumMedia || "0");

  var mediaItems = [];
  for (var i = 0; i < numMedia; i++) {
    var url      = req.body["MediaUrl" + i] || "";
    var mimeType = req.body["MediaContentType" + i] || "application/octet-stream";
    if (url) {
      var ext  = mimeType.split("/")[1] || "bin";
      var name = "attachment_" + (i + 1) + "." + ext.split(";")[0];
      mediaItems.push({ url: url, type: mimeType, name: name });
    }
  }
  var mediaJson = JSON.stringify(mediaItems);

  db.prepare("INSERT OR IGNORE INTO sms_messages (sid, direction, from_number, to_number, body, media_urls) VALUES (?, 'inbound', ?, ?, ?, ?)").run(MessageSid, From, To, Body, mediaJson);
  io.emit("sms:incoming", { sid: MessageSid, from: From, body: Body, media_urls: mediaJson });
  console.log("Inbound SMS from " + From + " media:" + numMedia + " attachments");

  var twiml = new twilio.twiml.MessagingResponse();
  res.type("text/xml").send(twiml.toString());
});


// ═══════════════════════════════════════════════════════
//  ElevenLabs Webhooks (no auth — called by ElevenLabs)
// ═══════════════════════════════════════════════════════

// POST /api/voice/elevenlabs/post-call
router.post('/elevenlabs/post-call', function(req, res) {
  var io = getIO(req);

  // Verify HMAC signature from ElevenLabs
  if (ELEVENLABS_WEBHOOK_SECRET) {
    var signature = req.headers["elevenlabs-signature"] || "";
    if (signature) {
      try {
        var parts = {};
        signature.split(",").forEach(function(p) { var kv = p.split("="); parts[kv[0]] = kv.slice(1).join("="); });
        var timestamp = parts["t"] || "";
        var receivedSig = parts["v0"] || "";
        var rawBody = JSON.stringify(req.body);
        var toSign = timestamp + "." + rawBody;
        var expected = crypto.createHmac("sha256", ELEVENLABS_WEBHOOK_SECRET).update(toSign).digest("hex");
        if (receivedSig !== expected) {
          console.warn("EL webhook: invalid signature — rejected");
          return res.sendStatus(401);
        }
        console.log("EL webhook: signature verified");
      } catch(sigErr) {
        console.warn("EL webhook: signature check error:", sigErr.message);
      }
    }
  }

  res.sendStatus(200); // Must respond 200 immediately or EL will retry

  var body = req.body || {};
  var eventType = body.type || "post_call_transcription";
  console.log("ElevenLabs webhook received, type:", eventType, JSON.stringify(body).substring(0, 200));

  if (eventType !== "post_call_transcription") {
    console.log("EL webhook: ignoring type:", eventType);
    return;
  }

  var data        = body.data || body;
  var convId      = data.conversation_id || "";
  var meta        = data.metadata || {};
  var transcriptArr = data.transcript || [];
  var analysis    = data.analysis || {};
  var initData    = data.conversation_initiation_client_data || {};
  var dynVars     = initData.dynamic_variables || {};

  if (!convId) {
    console.log("EL webhook: no conversation_id in payload");
    return;
  }

  var twilioMeta  = meta.twilio || meta.twilio_metadata || {};
  var callerPhone = meta.phone_number || meta.caller_id || meta.from_number
    || twilioMeta.From || twilioMeta.Caller
    || dynVars.caller_id || dynVars.from || dynVars.phone_number || "";
  var callDuration = meta.call_duration_secs || 0;
  var startTime    = meta.start_time_unix_secs ? new Date(meta.start_time_unix_secs * 1000).toISOString() : new Date().toISOString();
  console.log("EL webhook: convId:", convId, "phone:", callerPhone, "duration:", callDuration + "s");

  // Build transcript text
  var transcriptText = "";
  if (Array.isArray(transcriptArr) && transcriptArr.length > 0) {
    transcriptText = transcriptArr.map(function(t) {
      var role = (t.role === "agent") ? "Denise (AI)" : "Caller";
      return role + ": " + (t.message || t.content || "");
    }).filter(function(l) { return l.length > 8; }).join("\n");
  }

  var aiSummary = "";
  if (analysis && analysis.transcript_summary) aiSummary = analysis.transcript_summary;
  else if (analysis && analysis.summary) aiSummary = analysis.summary;

  // Find the matching call in our DB by phone number
  var matched = false;
  if (callerPhone) {
    var plainPhone = callerPhone.replace(/[^0-9]/g, "");
    var formats = [callerPhone, plainPhone];
    if (plainPhone.match(/^614\d{8}$/)) formats.push("0" + plainPhone.substring(2), "+" + plainPhone);
    if (plainPhone.match(/^04\d{8}$/)) formats.push("+61" + plainPhone.substring(1), "61" + plainPhone.substring(1));
    if (plainPhone.match(/^61\d{9}$/)) formats.push("+" + plainPhone, "0" + plainPhone.substring(2));

    var call = null;
    for (var fi = 0; fi < formats.length && !call; fi++) {
      call = db.prepare("SELECT * FROM calls WHERE (from_number = ? OR to_number = ?) AND type = 'inbound' AND transcript IS NULL ORDER BY created_at DESC LIMIT 1").get(formats[fi], formats[fi]);
    }
    if (!call) {
      var cutoff = new Date(Date.now() - 1800000).toISOString();
      call = db.prepare("SELECT * FROM calls WHERE type = 'inbound' AND transcript IS NULL AND created_at > ? ORDER BY created_at DESC LIMIT 1").get(cutoff);
    }

    if (!call) {
      call = db.prepare("SELECT * FROM calls WHERE sid = ?").get("el_" + convId);
      if (call) console.log("EL webhook: matched by convId el_" + convId);
    }

    if (call) {
      console.log("EL webhook: matched call", call.sid, "from phone", callerPhone);
      if (transcriptText) {
        db.prepare("UPDATE calls SET transcript = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?").run(transcriptText, call.sid);
        io.emit("call:transcribed", { sid: call.sid, transcript: transcriptText });
        console.log("EL webhook: transcript saved for call", call.sid);
      }
      if (aiSummary) {
        db.prepare("UPDATE calls SET summary = ? WHERE sid = ?").run(aiSummary, call.sid);
        io.emit("call:summarised", { sid: call.sid, summary: aiSummary });
      } else if (transcriptText && !aiSummary) {
        setTimeout(function() { generateCallSummary(call.sid, io); }, 2000);
      }
      io.emit("call:updated", { sid: call.sid });
      matched = true;
    }
  }

  if (!matched) {
    console.log("EL webhook: no matching call — creating new record for convId:", convId, "phone:", callerPhone);
    var sid = "el_" + convId;
    var existingRec = db.prepare("SELECT id FROM calls WHERE sid = ?").get(sid);
    if (!existingRec) {
      db.prepare("INSERT OR IGNORE INTO calls (sid, type, from_number, to_number, status, duration, transcript, summary, created_at) VALUES (?, 'inbound', ?, '', 'completed', ?, ?, ?, ?)")
        .run(sid, callerPhone || "Unknown", Math.round(callDuration), transcriptText || null, aiSummary || null, startTime);
      var newCall = db.prepare("SELECT * FROM calls WHERE sid = ?").get(sid);
      if (newCall) {
        io.emit("call:incoming", { sid: sid, from: callerPhone || "Unknown", status: "completed" });
        if (transcriptText) io.emit("call:transcribed", { sid: sid, transcript: transcriptText });
        console.log("EL webhook: new call record created:", sid);
        if (transcriptText && !aiSummary) setTimeout(function() { generateCallSummary(sid, io); }, 2000);
      }
    }
  }
});


// ═══════════════════════════════════════════════════════
//  Authenticated Endpoints
// ═══════════════════════════════════════════════════════

// ─── TWILIO BROWSER TOKEN ───
// GET /api/voice/dialer/token
router.get('/dialer/token', authenticate, function(req, res) {
  if (!TWILIO_API_KEY || !TWILIO_API_SECRET || !TWILIO_SID || !TWILIO_TWIML_APP_SID) {
    var missing = [];
    if (!TWILIO_API_KEY) missing.push("TWILIO_API_KEY");
    if (!TWILIO_API_SECRET) missing.push("TWILIO_API_SECRET");
    if (!TWILIO_TWIML_APP_SID) missing.push("TWILIO_TWIML_APP_SID");
    if (!TWILIO_SID) missing.push("TWILIO_ACCOUNT_SID");
    return res.status(500).json({ error: "Twilio browser calling not configured. Missing: " + missing.join(", ") });
  }
  try {
    console.log("[TOKEN] API_KEY present:", !!TWILIO_API_KEY, "SECRET present:", !!TWILIO_API_SECRET, "SID present:", !!TWILIO_SID, "TWIML_APP_SID present:", !!TWILIO_TWIML_APP_SID);
    var twilioLib = require("twilio");
    var AccessToken = (twilioLib.jwt && twilioLib.jwt.AccessToken)
      ? twilioLib.jwt.AccessToken
      : require("twilio/lib/jwt/AccessToken");
    var VoiceGrant = AccessToken.VoiceGrant;
    var identity = "user_" + (req.user.user_id || req.user.id);
    var token = new AccessToken(TWILIO_SID, TWILIO_API_KEY, TWILIO_API_SECRET, {
      identity: identity,
      ttl: 3600
    });
    var voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true
    });
    token.addGrant(voiceGrant);
    console.log("Twilio token issued for:", identity);
    res.json({ token: token.toJwt(), identity: identity });
  } catch(e) {
    console.error("Token generation error:", e.message, e.stack);
    res.status(500).json({ error: "Token generation failed: " + e.message });
  }
});

// ─── CALLS LIST ───
// GET /api/voice/calls
router.get('/calls', authenticate, function(req, res) {
  res.json(db.prepare("SELECT * FROM calls ORDER BY created_at DESC LIMIT 500").all());
});

// ─── OUTBOUND CALL ───
// POST /api/voice/calls/outbound
router.post('/calls/outbound', authenticate, function(req, res) {
  var io = getIO(req);
  if (!twilioClient) return res.status(500).json({ error: "Twilio not configured" });
  var toNumber = req.body.to;
  var callbackNumber = req.body.callbackNumber;
  if (!toNumber) return res.status(400).json({ error: "No destination number provided" });
  if (!callbackNumber) return res.status(400).json({ error: "No callback number provided. Enter your mobile number." });

  toNumber = formatAUPhone(toNumber);
  callbackNumber = formatAUPhone(callbackNumber);

  console.log("Initiating outbound call: calling operator at", callbackNumber, "then bridging to", toNumber);
  console.log("Webhook URL:", BASE_URL + "/api/voice/webhook/outbound?to=" + encodeURIComponent(toNumber));

  twilioClient.calls.create({
    to: callbackNumber,
    from: TWILIO_PHONE,
    url: BASE_URL + "/api/voice/webhook/outbound?to=" + encodeURIComponent(toNumber),
    statusCallback: BASE_URL + "/api/voice/webhook/status",
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  }).then(function(call) {
    console.log("Outbound call created:", call.sid, "operator:", callbackNumber, "destination:", toNumber);
    db.prepare("INSERT INTO calls (sid, type, from_number, to_number, participant, status) VALUES (?, 'outbound', ?, ?, ?, 'initiated')").run(call.sid, TWILIO_PHONE, toNumber, req.body.participant || "");
    io.emit("call:status", { sid: call.sid, status: "initiated" });
    res.json({ success: true, sid: call.sid });
  }).catch(function(err) {
    console.error("Outbound call error:", err.message);
    res.status(500).json({ error: err.message });
  });
});

// ─── CONTACT CONVERSATIONS (calls + SMS by phone number) ───
// GET /api/voice/contacts/conversations
router.get('/contacts/conversations', authenticate, function(req, res) {
  var phone = req.query.phone;
  if (!phone) return res.json({ calls: [], sms: [] });
  var phonePlain = phone.replace(/[\s\-()]/g, "");
  var phoneFormats = [phonePlain];
  if (phonePlain.match(/^04\d{8}$/)) phoneFormats.push("+61" + phonePlain.substring(1));
  if (phonePlain.match(/^0[2-9]\d{8}$/)) phoneFormats.push("+61" + phonePlain.substring(1));
  if (phonePlain.match(/^\+61\d{9}$/)) phoneFormats.push("0" + phonePlain.substring(3));
  if (phonePlain.match(/^61\d{9}$/)) { phoneFormats.push("+" + phonePlain); phoneFormats.push("0" + phonePlain.substring(2)); }

  var placeholders = phoneFormats.map(function() { return "?"; }).join(",");
  var calls = db.prepare("SELECT * FROM calls WHERE from_number IN (" + placeholders + ") OR to_number IN (" + placeholders + ") ORDER BY created_at DESC LIMIT 100").all([].concat(phoneFormats, phoneFormats));
  var sms = db.prepare("SELECT * FROM sms_messages WHERE from_number IN (" + placeholders + ") OR to_number IN (" + placeholders + ") ORDER BY created_at DESC LIMIT 200").all([].concat(phoneFormats, phoneFormats));
  console.log("Contact Conversations for " + phone + ": " + calls.length + " calls, " + sms.length + " SMS (formats: " + phoneFormats.join(", ") + ")");
  res.json({ calls: calls, sms: sms });
});

// ─── SMS LIST ───
// GET /api/voice/sms
router.get('/sms', authenticate, function(req, res) {
  res.json(db.prepare("SELECT * FROM sms_messages ORDER BY created_at DESC LIMIT 500").all());
});

// ─── SMS SEND ───
// POST /api/voice/sms/send
router.post('/sms/send', authenticate, function(req, res) {
  if (!twilioClient) return res.status(500).json({ error: "Twilio not configured" });
  var toNumber = req.body.to;
  var body = req.body.body;
  var mediaUrls = req.body.mediaUrls || [];
  if (!toNumber || !body) return res.status(400).json({ error: "Number and message required" });
  toNumber = formatAUPhone(toNumber);
  console.log("Sending " + (mediaUrls.length > 0 ? "MMS" : "SMS") + " to:", toNumber, "body:", body.substring(0, 50));
  var msgOpts = { to: toNumber, from: TWILIO_PHONE, body: body };
  if (mediaUrls.length > 0) {
    var validUrls = mediaUrls.filter(function(u) { return u.startsWith("http"); });
    if (validUrls.length > 0) {
      msgOpts.mediaUrl = validUrls.slice(0, 10);
    }
  }
  twilioClient.messages.create(msgOpts).then(function(msg) {
    console.log((mediaUrls.length > 0 ? "MMS" : "SMS") + " sent:", msg.sid);
    var outMediaJson = JSON.stringify((req.body.mediaUrls || []).map(function(u, i) { return { url: u, type: "image/jpeg", name: "attachment_" + (i+1) + ".jpg" }; }));
    db.prepare("INSERT INTO sms_messages (sid, direction, from_number, to_number, body, participant, media_urls) VALUES (?, 'outbound', ?, ?, ?, ?, ?)").run(msg.sid, TWILIO_PHONE, toNumber, body, req.body.participant || "", outMediaJson);
    res.json({ success: true, sid: msg.sid });
  }).catch(function(err) {
    console.error("SMS/MMS error:", err.message);
    res.status(500).json({ error: err.message });
  });
});

// ─── AUDIO TOKEN (generates short-lived token for playback) ───
// GET /api/voice/calls/audio-token/:sid
router.get('/calls/audio-token/:sid', authenticate, function(req, res) {
  var token = makeAudioToken(req.params.sid);
  res.json({ token: token });
});

// ─── AUDIO STREAM (token-based, no auth — handles Twilio + ElevenLabs recordings) ───
// GET /api/voice/calls/audio/:token
router.get('/calls/audio/:token', function(req, res) {
  var entry = audioTokens[req.params.token];
  if (!entry || entry.exp < Date.now()) return res.status(401).json({ error: "Invalid or expired token" });
  var sid = entry.sid;

  var callRow = null;
  try { callRow = db.prepare("SELECT recording_url FROM calls WHERE sid = ?").get(sid); } catch(e) {}
  var twilioUrl = callRow && callRow.recording_url && callRow.recording_url.indexOf("api.twilio.com") >= 0
    ? callRow.recording_url : null;

  if (twilioUrl) {
    console.log("Streaming Twilio recording:", twilioUrl);
    var authHeader = "Basic " + Buffer.from(TWILIO_SID + ":" + TWILIO_TOKEN).toString("base64");
    fetch(twilioUrl, { headers: { "Authorization": authHeader } }).then(function(r) {
      if (!r.ok) {
        console.log("Twilio audio error:", r.status, twilioUrl);
        return res.status(r.status).json({ error: "Twilio recording not available: " + r.status });
      }
      var ct = r.headers.get("content-type") || "audio/mpeg";
      var cl = r.headers.get("content-length");
      console.log("Twilio audio ok:", sid, "type:", ct, "size:", cl);
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("Accept-Ranges", "bytes");
      if (cl) res.setHeader("Content-Length", cl);
      r.arrayBuffer().then(function(buf) { res.end(Buffer.from(buf)); })
        .catch(function(e) { res.status(500).json({ error: "Buffer error: " + e.message }); });
    }).catch(function(e) {
      console.log("Twilio audio fetch error:", e.message);
      res.status(500).json({ error: e.message });
    });
    return;
  }

  // ElevenLabs recording
  var convId = sid.startsWith("el_") ? sid.substring(3) : sid;
  if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: "ElevenLabs not configured" });
  fetch("https://api.us.elevenlabs.io/v1/convai/conversations/" + convId + "/audio", {
    headers: { "xi-api-key": ELEVENLABS_API_KEY }
  }).then(function(r) {
    if (!r.ok) {
      console.log("EL audio error:", r.status, convId);
      return res.status(r.status).json({ error: "Audio not available: " + r.status });
    }
    var ct = r.headers.get("content-type") || "audio/mpeg";
    var cl = r.headers.get("content-length");
    console.log("EL audio ok:", convId, "type:", ct, "size:", cl);
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Accept-Ranges", "bytes");
    if (cl) res.setHeader("Content-Length", cl);
    r.arrayBuffer().then(function(buf) { res.end(Buffer.from(buf)); })
      .catch(function(e) { res.status(500).json({ error: "Buffer error: " + e.message }); });
  }).catch(function(e) {
    console.log("EL audio fetch error:", e.message);
    res.status(500).json({ error: e.message });
  });
});


// ═══════════════════════════════════════════════════════
//  Transcript Sync Endpoints
// ═══════════════════════════════════════════════════════

// POST /api/voice/transcripts/sync
router.post('/transcripts/sync', authenticate, function(req, res) {
  var io = getIO(req);
  if (!twilioClient) return res.status(500).json({ error: "Twilio not configured" });
  console.log("Manual transcript sync triggered");
  var callsNoTranscript = db.prepare("SELECT sid FROM calls WHERE transcript IS NULL AND status = 'completed' AND duration > 0 ORDER BY created_at DESC LIMIT 20").all();
  var count = 0;
  callsNoTranscript.forEach(function(c) {
    count++;
    setTimeout(function() { fetchCallRecording(c.sid, io); }, count * 2000);
  });
  twilioClient.calls.list({ limit: 20, status: "completed" }).then(function(twilCalls) {
    twilCalls.forEach(function(tc) {
      var existing = db.prepare("SELECT id FROM calls WHERE sid = ?").get(tc.sid);
      if (!existing && tc.duration > 0) {
        var type = tc.direction === "inbound" ? "inbound" : "outbound";
        db.prepare("INSERT OR IGNORE INTO calls (sid, type, from_number, to_number, status, duration, created_at) VALUES (?, ?, ?, ?, 'completed', ?, ?)").run(tc.sid, type, tc.from, tc.to, tc.duration, tc.dateCreated.toISOString());
        setTimeout(function() { fetchCallRecording(tc.sid, io); }, (count++) * 2000);
      }
    });
    res.json({ success: true, syncing: count + " calls" });
  }).catch(function(err) {
    res.json({ success: true, syncing: count + " calls (Twilio sync failed: " + err.message + ")" });
  });
});

// POST /api/voice/transcripts/fetch/:sid
router.post('/transcripts/fetch/:sid', authenticate, function(req, res) {
  var io = getIO(req);
  var callSid = req.params.sid;
  console.log("Single call transcript fetch for:", callSid);
  var call = db.prepare("SELECT * FROM calls WHERE sid = ?").get(callSid);
  if (!call) return res.status(404).json({ error: "Call not found" });
  if (call.transcript) return res.json({ success: true, transcript: call.transcript, already: true });

  var result = { success: true, status: "searching", sid: callSid };

  if (twilioClient) {
    twilioClient.recordings.list({ callSid: callSid, limit: 5 }).then(function(recordings) {
      if (recordings.length > 0) {
        var rec = recordings[0];
        var recUrl = "https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_SID + "/Recordings/" + rec.sid + ".mp3";
        db.prepare("UPDATE calls SET recording_url = ? WHERE sid = ?").run(recUrl, callSid);
        console.log("Recording found for:", callSid);
        twilioClient.recordings(rec.sid).transcriptions.list({ limit: 1 }).then(function(transcriptions) {
          if (transcriptions.length > 0 && transcriptions[0].transcriptionText) {
            var text = transcriptions[0].transcriptionText;
            db.prepare("UPDATE calls SET transcript = ? WHERE sid = ?").run(text, callSid);
            if (io) io.emit("call:transcribed", { sid: callSid, transcript: text });
            console.log("Twilio transcript saved for single fetch:", callSid);
            generateCallSummary(callSid, io);
          } else {
            console.log("No Twilio transcription, trying ElevenLabs for:", callSid);
            fetchElevenLabsTranscriptForCall(callSid, call, io);
          }
        }).catch(function() {
          fetchElevenLabsTranscriptForCall(callSid, call, io);
        });
      } else {
        console.log("No recordings, trying ElevenLabs for:", callSid);
        fetchElevenLabsTranscriptForCall(callSid, call, io);
      }
    }).catch(function() {
      fetchElevenLabsTranscriptForCall(callSid, call, io);
    });
  } else {
    fetchElevenLabsTranscriptForCall(callSid, call, io);
  }
  res.json(result);
});

// POST /api/voice/transcripts/bulk-fetch
router.post('/transcripts/bulk-fetch', authenticate, function(req, res) {
  var io = getIO(req);
  console.log("=== BULK TRANSCRIPT FETCH STARTED ===");
  var missing = db.prepare("SELECT * FROM calls WHERE transcript IS NULL AND status = 'completed' AND duration > 0 ORDER BY created_at DESC LIMIT 50").all();
  console.log("Calls missing transcripts:", missing.length);
  if (missing.length === 0) return res.json({ success: true, message: "All calls have transcripts", matched: 0, total: 0 });

  var total = missing.length;

  if (ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID) {
    fetch("https://api.us.elevenlabs.io/v1/convai/conversations?agent_id=" + ELEVENLABS_AGENT_ID + "&page_size=100", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY }
    }).then(function(r) { return r.json(); }).then(function(data) {
      var elConvs = data.conversations || [];
      console.log("ElevenLabs conversations found:", elConvs.length);
      if (elConvs.length === 0) return;

      var detailsLoaded = 0;
      var allDetails = [];

      elConvs.forEach(function(conv) {
        fetch("https://api.us.elevenlabs.io/v1/convai/conversations/" + conv.conversation_id, {
          headers: { "xi-api-key": ELEVENLABS_API_KEY }
        }).then(function(r2) { return r2.json(); }).then(function(detail) {
          detail._convId = conv.conversation_id;
          allDetails.push(detail);
          detailsLoaded++;
          if (detailsLoaded === elConvs.length) {
            matchTranscriptsToCalls(missing, allDetails, io);
          }
        }).catch(function(err) {
          console.error("EL detail err:", err.message);
          detailsLoaded++;
          if (detailsLoaded === elConvs.length) {
            matchTranscriptsToCalls(missing, allDetails, io);
          }
        });
      });
    }).catch(function(err) {
      console.error("ElevenLabs bulk fetch error:", err.message);
    });
  }

  var outbound = missing.filter(function(c) { return c.type === "outbound"; });
  if (twilioClient && outbound.length > 0) {
    outbound.forEach(function(call, idx) {
      setTimeout(function() { fetchCallRecording(call.sid, io); }, idx * 1500);
    });
  }

  res.json({ success: true, message: "Fetching transcripts for " + total + " calls", total: total });
});


// ═══════════════════════════════════════════════════════
//  Hunt Group CRUD
// ═══════════════════════════════════════════════════════

// GET /api/voice/call-workflow/groups
router.get('/call-workflow/groups', authenticate, function(req, res) {
  try {
    var rows = db.prepare("SELECT * FROM call_hunt_groups ORDER BY created_at DESC").all();
    res.json(rows.map(function(r){ r.members=JSON.parse(r.members||'[]'); return r; }));
  } catch(e) { res.status(500).json({error:e.message}); }
});

// POST /api/voice/call-workflow/groups
router.post('/call-workflow/groups', authenticate, function(req, res) {
  if(!isSeniorRole(req.user)) return res.status(403).json({error:"Super Admin only"});
  var b = req.body;
  try {
    if(b.id) {
      db.prepare("UPDATE call_hunt_groups SET name=?,strategy=?,ring_seconds=?,members=?,skip_if_busy=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .run(b.name, b.strategy, b.ring_seconds||20, JSON.stringify(b.members||[]), b.skip_if_busy?1:0, b.active!==false?1:0, b.id);
      res.json({success:true, id:b.id});
    } else {
      var r = db.prepare("INSERT INTO call_hunt_groups (name,strategy,ring_seconds,members,skip_if_busy,active) VALUES (?,?,?,?,?,?)")
        .run(b.name, b.strategy||"sequential", b.ring_seconds||20, JSON.stringify(b.members||[]), b.skip_if_busy?1:0, 1);
      res.json({success:true, id:r.lastInsertRowid});
    }
  } catch(e) { res.status(500).json({error:e.message}); }
});

// DELETE /api/voice/call-workflow/groups/:id
router.delete('/call-workflow/groups/:id', authenticate, function(req, res) {
  if(!isSeniorRole(req.user)) return res.status(403).json({error:"Super Admin only"});
  try {
    db.prepare("DELETE FROM call_hunt_groups WHERE id=?").run(req.params.id);
    res.json({success:true});
  } catch(e) { res.status(500).json({error:e.message}); }
});


// ═══════════════════════════════════════════════════════
//  Agent Availability
// ═══════════════════════════════════════════════════════

// GET /api/voice/availability
router.get('/availability', authenticate, function(req, res) {
  try {
    var rows = db.prepare("SELECT a.user_id, a.status, a.changed_at, u.name, u.email FROM agent_availability a LEFT JOIN users u ON u.id=a.user_id WHERE a.id IN (SELECT MAX(id) FROM agent_availability GROUP BY user_id) ORDER BY u.name").all();
    res.json(rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// POST /api/voice/availability
router.post('/availability', authenticate, function(req, res) {
  var status = req.body.status;
  var userId = req.user.id;
  try {
    // Close previous session
    var prev = db.prepare("SELECT * FROM agent_availability_log WHERE user_id=? AND ended_at IS NULL ORDER BY id DESC LIMIT 1").get(userId);
    if(prev) {
      var durSecs = Math.round((Date.now() - new Date(prev.started_at).getTime()) / 1000);
      db.prepare("UPDATE agent_availability_log SET ended_at=CURRENT_TIMESTAMP, duration_secs=? WHERE id=?").run(durSecs, prev.id);
    }
    // Insert new current status
    db.prepare("INSERT INTO agent_availability (user_id,status) VALUES (?,?)").run(userId, status);
    // Start new log session
    db.prepare("INSERT INTO agent_availability_log (user_id,status,started_at) VALUES (?,?,CURRENT_TIMESTAMP)").run(userId, status);
    res.json({success:true, status:status});
  } catch(e) { res.status(500).json({error:e.message}); }
});

// GET /api/voice/availability/log
router.get('/availability/log', authenticate, function(req, res) {
  try {
    var since = req.query.since || new Date(Date.now()-7*86400000).toISOString();
    var rows = db.prepare("SELECT l.*, u.name, u.email FROM agent_availability_log l LEFT JOIN users u ON u.id=l.user_id WHERE l.started_at >= ? ORDER BY l.started_at DESC LIMIT 500").all(since);
    res.json(rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});


// ═══════════════════════════════════════════════════════
//  Settings (AI enabled, timezone)
// ═══════════════════════════════════════════════════════

// GET /api/voice/settings/ai-enabled
router.get('/settings/ai-enabled', authenticate, function(req, res) {
  try {
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('ai_enabled', 'true')").run();
    var row = db.prepare("SELECT value FROM app_settings WHERE key='ai_enabled'").get();
    res.json({ ai_enabled: !row || row.value !== "false" });
  } catch(e) { res.json({ ai_enabled: true }); }
});

// POST /api/voice/settings/ai-enabled
router.post('/settings/ai-enabled', authenticate, function(req, res) {
  if(!isSeniorRole(req.user)) return res.status(403).json({ error: "Super Admin only" });
  var enabled = req.body.enabled !== false && req.body.enabled !== "false";
  try {
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('ai_enabled', ?)").run(enabled ? "true" : "false");
    res.json({ success: true, ai_enabled: enabled });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/voice/settings/timezone
router.get('/settings/timezone', authenticate, function(req, res) {
  try {
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('timezone', 'QLD')").run();
    var row = db.prepare("SELECT value FROM app_settings WHERE key = 'timezone'").get();
    res.json({ timezone: row ? row.value : "QLD" });
  } catch(e) {
    res.json({ timezone: "QLD" });
  }
});

// POST /api/voice/settings/timezone
router.post('/settings/timezone', authenticate, function(req, res) {
  var tz = req.body.timezone;
  if (!tz) return res.status(400).json({ error: "timezone required" });
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('timezone', ?)").run(tz);
  res.json({ success: true, timezone: tz });
});


// ═══════════════════════════════════════════════════════
//  ElevenLabs Debug / Resync
// ═══════════════════════════════════════════════════════

// GET /api/voice/elevenlabs/conversations (debug — no auth)
router.get('/elevenlabs/conversations', function(req, res) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) return res.json({ error: "ElevenLabs not configured" });
  fetch("https://api.elevenlabs.io/v1/convai/conversations?agent_id=" + ELEVENLABS_AGENT_ID + "&page_size=5", {
    headers: { "xi-api-key": ELEVENLABS_API_KEY }
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    var convs = data.conversations || [];
    if (convs.length === 0) return res.json({ total: 0, agent_id: ELEVENLABS_AGENT_ID, raw_list_response: data });
    return fetch("https://api.elevenlabs.io/v1/convai/conversations/" + convs[0].conversation_id, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY }
    }).then(function(r2) { return r2.json(); })
    .then(function(detail) {
      res.json({
        total: convs.length,
        agent_id: ELEVENLABS_AGENT_ID,
        first_conv_list: convs[0],
        first_conv_detail_keys: Object.keys(detail),
        first_conv_detail: detail,
        metadata_keys: detail.metadata ? Object.keys(detail.metadata) : [],
        user_id: detail.user_id,
        metadata: detail.metadata,
        conversation_initiation_client_data: detail.conversation_initiation_client_data
      });
    });
  }).catch(function(e) { res.status(500).json({ error: e.message }); });
});

// GET /api/voice/elevenlabs/resync-phones
router.get('/elevenlabs/resync-phones', function(req, res) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) return res.json({ error: "ElevenLabs not configured" });
  res.json({ status: "started", message: "Re-syncing all conversations in background — refresh Titus in 90 seconds" });

  var allConvs = [];
  function fetchPage(cursor) {
    var url = "https://api.us.elevenlabs.io/v1/convai/conversations?agent_id=" + ELEVENLABS_AGENT_ID + "&page_size=100";
    if (cursor) url += "&cursor=" + encodeURIComponent(cursor);
    fetch(url, { headers: { "xi-api-key": ELEVENLABS_API_KEY } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var page = data.conversations || [];
        allConvs = allConvs.concat(page);
        console.log("Resync: fetched page, total so far:", allConvs.length, "has_more:", data.has_more);
        if (data.has_more && data.next_cursor) {
          fetchPage(data.next_cursor);
        } else {
          console.log("Resync: all pages fetched,", allConvs.length, "total conversations");
          processConvs();
        }
      }).catch(function(e) { console.error("Resync page error:", e.message); });
  }

  function processConvs() {
    var idx = 0; var updated = 0;
    function next() {
      if (idx >= allConvs.length) { console.log("Resync complete:", updated, "updated of", allConvs.length); return; }
      var conv = allConvs[idx++];
      fetch("https://api.us.elevenlabs.io/v1/convai/conversations/" + conv.conversation_id, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY }
      }).then(function(r2) { return r2.json(); })
      .then(function(detail) {
        var phoneCall = (detail.metadata || {}).phone_call || {};
        var dynVars   = ((detail.conversation_initiation_client_data || {}).dynamic_variables) || {};
        var phone     = phoneCall.external_number || detail.user_id || dynVars["system__caller_id"] || "";
        if (phone && phone.indexOf("@") >= 0) phone = "";
        var sid = "el_" + conv.conversation_id;
        var rStartSecs = (detail.metadata && detail.metadata.start_time_unix_secs)
          || conv.start_time_unix_secs || 0;
        var rStartTs = rStartSecs ? new Date(rStartSecs * 1000).toISOString() : null;
        console.log("Resync:", sid, "phone:", phone, "startSecs:", rStartSecs, "ts:", rStartTs);
        if (phone && rStartTs) {
          db.prepare("UPDATE calls SET from_number = ?, created_at = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?").run(phone, rStartTs, sid);
        } else if (phone) {
          db.prepare("UPDATE calls SET from_number = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?").run(phone, sid);
        } else if (rStartTs) {
          db.prepare("UPDATE calls SET created_at = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?").run(rStartTs, sid);
        }
        updated++;
        setTimeout(next, 300);
      }).catch(function(e) { console.log("Resync detail error:", e.message); setTimeout(next, 300); });
    }
    next();
  }

  fetchPage(null);
});

// GET /api/voice/agent/status (ElevenLabs agent status)
router.get('/agent/status', authenticate, function(req, res) {
  if (!ELEVENLABS_API_KEY) return res.json({ connected: false });
  fetch("https://api.us.elevenlabs.io/v1/convai/agents/" + ELEVENLABS_AGENT_ID, { headers: { "xi-api-key": ELEVENLABS_API_KEY } })
    .then(function(r) { return r.json(); })
    .then(function(agent) { res.json({ connected: true, agent: agent }); })
    .catch(function(err) { res.json({ connected: false, error: err.message }); });
});


// ═══════════════════════════════════════════════════════
//  Debug Endpoints
// ═══════════════════════════════════════════════════════

// GET /api/voice/debug/calls-phones
router.get('/debug/calls-phones', function(req, res) {
  var rows = db.prepare("SELECT sid, from_number, to_number, type, created_at FROM calls ORDER BY created_at DESC LIMIT 20").all();
  res.json(rows);
});

// GET /api/voice/debug/el-convlist
router.get('/debug/el-convlist', function(req, res) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) return res.json({ error: "not configured" });
  fetch("https://api.us.elevenlabs.io/v1/convai/conversations?agent_id=" + ELEVENLABS_AGENT_ID + "&page_size=100", {
    headers: { "xi-api-key": ELEVENLABS_API_KEY }
  }).then(function(r) { return r.json(); })
  .then(function(data) {
    var summary = (data.conversations || []).map(function(c) {
      return {
        id: c.conversation_id,
        start_time_unix_secs: c.start_time_unix_secs,
        start_time_human: c.start_time_unix_secs ? new Date(c.start_time_unix_secs * 1000).toISOString() : null,
        duration: c.call_duration_secs,
        has_more: data.has_more,
        next_cursor: data.next_cursor
      };
    });
    res.json({ total: data.total, has_more: data.has_more, next_cursor: data.next_cursor, count: summary.length, conversations: summary });
  }).catch(function(e) { res.json({ error: e.message }); });
});

// GET /api/voice/webhook/test
router.get('/webhook/test', function(req, res) {
  res.json({ ok: true, base_url: BASE_URL, twilio_phone: TWILIO_PHONE, time: new Date().toISOString() });
});


module.exports = router;
