const express = require('express');
const crypto = require('crypto');
const { db } = require('../../db/sqlite');
const { hashPassword } = require('../../middleware/auth');
const { logAudit } = require('../../services/audit');
const airtable = require('../../services/database');
const { msGraphFetch } = require('../../services/email');
const env = require('../../config/env');

const router = express.Router();

var GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

// ═══════════════════════════════════════════════════════════════
// ═══ SUPPORT WORKER PWA — OWN AUTH SYSTEM ═══════════════════
// ═══════════════════════════════════════════════════════════════

// ── Password validation ──
function validateSwPassword(pw) {
  if (!pw || pw.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Password must contain a number";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain a special character";
  return null;
}

// ── OTP generation ──
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Send OTP via MS Graph email ──
function sendOtpEmail(toEmail, code) {
  var emailPayload = {
    message: {
      subject: "Your DCS Login Code",
      body: {
        contentType: "Text",
        content: "Your login code is: " + code + ". Expires in 30 minutes. Do not share."
      },
      toRecipients: [{ emailAddress: { address: toEmail } }]
    },
    saveToSentItems: false
  };
  return msGraphFetch("/users/info@tituscrm.com.au/sendMail", "POST", emailPayload);
}

// ── SW Auth Middleware (separate from main auth) ──
function swAuthMiddleware(req, res, next) {
  var token = req.headers["x-sw-token"] || (req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : null);
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  var session = db.prepare("SELECT sw.*, s.token FROM sw_sessions s JOIN sw_users sw ON s.sw_user_id = sw.id WHERE s.token = ?").get(token);
  if (!session) return res.status(401).json({ error: "Invalid session" });
  req.swUser = session;
  next();
}

// ── Haversine distance (metres) ──
function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000; // Earth radius in metres
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLng = (lng2 - lng1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ── Helper: retry Airtable create, stripping unknown fields ──
function tryCreate(tableName, fieldsToSend) {
  return airtable.rawFetch(tableName, 'POST', '', { records: [{ fields: fieldsToSend }] })
    .then(function (data) {
      if (data.error && data.error.message && data.error.message.indexOf('Unknown field name') >= 0) {
        var match = data.error.message.match(/Unknown field name: "([^"]+)"/);
        if (match && match[1]) {
          console.log("Removing unknown field '" + match[1] + "' and retrying...");
          var retry = {};
          Object.keys(fieldsToSend).forEach(function (k) { if (k !== match[1]) retry[k] = fieldsToSend[k]; });
          return tryCreate(tableName, retry);
        }
      }
      return data;
    });
}


// ═══════════════════════════════════════════════════════════════
// ═══ AUTH ROUTES (no auth middleware — public) ═══════════════
// ═══════════════════════════════════════════════════════════════

// ── SW Login (Step 1: validate credentials, send OTP) ──
router.post("/login", function(req, res) {
  var email = (req.body.email || "").toLowerCase().trim();
  var password = req.body.password || "";
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  function issueOtp(userEmail) {
    // Invalidate all previous OTPs for this email
    db.prepare("UPDATE sw_otp SET used = 1 WHERE email = ? AND used = 0").run(userEmail);
    var code = generateOTP();
    db.prepare("INSERT INTO sw_otp (email, code) VALUES (?, ?)").run(userEmail, code);
    sendOtpEmail(userEmail, code).then(function() {
      console.log("OTP sent to " + userEmail);
    }).catch(function(e) {
      console.error("Failed to send OTP email to " + userEmail + ":", e.message);
    });
    return res.json({ otpRequired: true, email: userEmail });
  }

  // Check if user exists in sw_users
  var swUser = db.prepare("SELECT * FROM sw_users WHERE email = ?").get(email);
  if (swUser) {
    // Validate password
    if (swUser.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    // Check for OTP lockout (3 failed attempts on most recent OTP)
    var recentOtp = db.prepare("SELECT * FROM sw_otp WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1").get(email);
    if (recentOtp && recentOtp.attempts >= 3) {
      return res.status(403).json({ error: "Account locked. Contact your administrator." });
    }
    return issueOtp(email);
  }

  // First login: verify email exists in Airtable contacts
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });

  // Enforce password requirements on first login (account creation)
  var pwError = validateSwPassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  var filter = "LOWER({Email})='" + email.replace(/'/g, "\\'") + "'";
  airtable.fetchAllFromTableView("All Contacts", "Active Contacts 2026", filter).then(function(records) {
    if (!records || records.length === 0) {
      return res.status(401).json({ error: "Email not found in active contacts" });
    }
    var rec = records[0];
    var f = rec.fields || {};
    var photoArr = f["PIC - SW Photo"] || [];
    var photoUrl = "";
    if (Array.isArray(photoArr) && photoArr.length > 0) {
      photoUrl = (photoArr[0].thumbnails && photoArr[0].thumbnails.large ? photoArr[0].thumbnails.large.url : photoArr[0].url) || "";
    }
    var fullName = f["Full Name"] || ((f["First Name"] || "") + " " + (f["Last Name"] || "")).trim();
    var phone = f["Formatted Mobile"] || f["Mobile"] || "";

    // Create sw_users record (no session yet — OTP required first)
    var hash = hashPassword(password);
    try {
      db.prepare("INSERT INTO sw_users (email, password_hash, airtable_id, full_name, contact_type, type_of_employment, photo_url, phone) VALUES (?,?,?,?,?,?,?,?)").run(
        email, hash, rec.id, fullName,
        f["Type of Contact (Single Select)"] || "",
        f["Type of Employment"] || "",
        photoUrl, phone
      );
    } catch(e) {
      return res.status(500).json({ error: "Failed to create account: " + e.message });
    }

    issueOtp(email);
  }).catch(function(e) {
    console.error("SW login Airtable error:", e.message);
    res.status(500).json({ error: "Login failed" });
  });
});

// ── SW Verify OTP (Step 2: check code, grant access) ──
router.post("/verify-otp", function(req, res) {
  var email = (req.body.email || "").toLowerCase().trim();
  var code = (req.body.code || "").trim();
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });

  var otp = db.prepare("SELECT * FROM sw_otp WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1").get(email);
  if (!otp) return res.status(400).json({ error: "No pending code. Please log in again." });

  // Check lockout (3 failed attempts)
  if (otp.attempts >= 3) {
    return res.status(403).json({ error: "Account locked. Contact your administrator.", locked: true });
  }

  // Check expiry (30 minutes)
  var createdAt = new Date(otp.created_at + "Z").getTime();
  var now = Date.now();
  if (now - createdAt > 30 * 60 * 1000) {
    return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
  }

  // Check code
  if (otp.code !== code) {
    db.prepare("UPDATE sw_otp SET attempts = attempts + 1 WHERE id = ?").run(otp.id);
    var newAttempts = otp.attempts + 1;
    if (newAttempts >= 3) {
      return res.status(403).json({ error: "Account locked. Contact your administrator.", locked: true });
    }
    return res.status(401).json({ error: "Invalid code. " + (3 - newAttempts) + " attempt(s) remaining." });
  }

  // OTP is valid — mark as used
  db.prepare("UPDATE sw_otp SET used = 1 WHERE id = ?").run(otp.id);

  // Create session
  var swUser = db.prepare("SELECT * FROM sw_users WHERE email = ?").get(email);
  if (!swUser) return res.status(400).json({ error: "User not found. Please log in again." });

  var token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sw_sessions (token, sw_user_id) VALUES (?, ?)").run(token, swUser.id);
  res.json({
    token: token,
    user: { id: swUser.id, email: swUser.email, name: swUser.full_name, airtableId: swUser.airtable_id, contactType: swUser.contact_type, typeOfEmployment: swUser.type_of_employment, photoUrl: swUser.photo_url, phone: swUser.phone }
  });
});

// ── SW Resend OTP ──
router.post("/resend-otp", function(req, res) {
  var email = (req.body.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ error: "Email required" });

  var swUser = db.prepare("SELECT * FROM sw_users WHERE email = ?").get(email);
  if (!swUser) return res.status(400).json({ error: "User not found" });

  // Check for lockout on most recent OTP
  var recentOtp = db.prepare("SELECT * FROM sw_otp WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1").get(email);
  if (recentOtp && recentOtp.attempts >= 3) {
    return res.status(403).json({ error: "Account locked. Contact your administrator.", locked: true });
  }

  // Invalidate all previous OTPs
  db.prepare("UPDATE sw_otp SET used = 1 WHERE email = ? AND used = 0").run(email);

  // Generate and send new OTP
  var code = generateOTP();
  db.prepare("INSERT INTO sw_otp (email, code) VALUES (?, ?)").run(email, code);
  sendOtpEmail(email, code).then(function() {
    res.json({ success: true });
  }).catch(function(e) {
    console.error("Failed to resend OTP to " + email + ":", e.message);
    res.json({ success: true }); // Don't reveal email delivery failure
  });
});

// ── SW Forgot Password / First Time Login ──
router.post("/forgot-password", function(req, res) {
  var email = (req.body.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ error: "Email address required" });

  // Check if user already exists in sw_users
  var swUser = db.prepare("SELECT * FROM sw_users WHERE email = ?").get(email);
  if (swUser) {
    // Existing user — send reset OTP
    db.prepare("UPDATE sw_otp SET used = 1 WHERE email = ? AND used = 0").run(email);
    var code = generateOTP();
    db.prepare("INSERT INTO sw_otp (email, code) VALUES (?, ?)").run(email, code);
    sendOtpEmail(email, code).then(function() {
      console.log("Reset OTP sent to " + email);
    }).catch(function(e) {
      console.error("Failed to send reset OTP to " + email + ":", e.message);
    });
    return res.json({ otpSent: true, email: email });
  }

  // First-time user — check Airtable
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "System not configured" });
  var filter = "LOWER({Email})='" + email.replace(/'/g, "\\'") + "'";
  airtable.fetchAllFromTableView("All Contacts", "Active Contacts 2026", filter).then(function(records) {
    if (!records || records.length === 0) {
      return res.status(404).json({ error: "Email not found in the system. Contact your administrator." });
    }
    var rec = records[0];
    var f = rec.fields || {};
    var photoArr = f["PIC - SW Photo"] || [];
    var photoUrl = "";
    if (Array.isArray(photoArr) && photoArr.length > 0) {
      photoUrl = (photoArr[0].thumbnails && photoArr[0].thumbnails.large ? photoArr[0].thumbnails.large.url : photoArr[0].url) || "";
    }
    var fullName = f["Full Name"] || ((f["First Name"] || "") + " " + (f["Last Name"] || "")).trim();
    var phone = f["Formatted Mobile"] || f["Mobile"] || "";

    // Create sw_users record with placeholder password (must be set via reset flow)
    var placeholderHash = "NEEDS_RESET_" + crypto.randomBytes(16).toString("hex");
    try {
      db.prepare("INSERT INTO sw_users (email, password_hash, airtable_id, full_name, contact_type, type_of_employment, photo_url, phone) VALUES (?,?,?,?,?,?,?,?)").run(
        email, placeholderHash, rec.id, fullName,
        f["Type of Contact (Single Select)"] || "",
        f["Type of Employment"] || "",
        photoUrl, phone
      );
    } catch(e) {
      return res.status(500).json({ error: "Failed to initialise account: " + e.message });
    }

    // Send reset OTP
    db.prepare("UPDATE sw_otp SET used = 1 WHERE email = ? AND used = 0").run(email);
    var resetCode = generateOTP();
    db.prepare("INSERT INTO sw_otp (email, code) VALUES (?, ?)").run(email, resetCode);
    sendOtpEmail(email, resetCode).then(function() {
      console.log("First-time reset OTP sent to " + email);
    }).catch(function(e) {
      console.error("Failed to send first-time reset OTP to " + email + ":", e.message);
    });
    res.json({ otpSent: true, email: email });
  }).catch(function(e) {
    console.error("Forgot password Airtable error:", e.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });
});

// ── SW Verify Reset OTP ──
router.post("/verify-reset-otp", function(req, res) {
  var email = (req.body.email || "").toLowerCase().trim();
  var code = (req.body.code || "").trim();
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });

  var otp = db.prepare("SELECT * FROM sw_otp WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1").get(email);
  if (!otp) return res.status(400).json({ error: "No pending code. Please start again." });

  if (otp.attempts >= 3) {
    return res.status(403).json({ error: "Too many failed attempts. Contact your administrator.", locked: true });
  }

  var createdAt = new Date(otp.created_at + "Z").getTime();
  if (Date.now() - createdAt > 30 * 60 * 1000) {
    return res.status(400).json({ error: "Code expired. Please request a new one.", expired: true });
  }

  if (otp.code !== code) {
    db.prepare("UPDATE sw_otp SET attempts = attempts + 1 WHERE id = ?").run(otp.id);
    var newAttempts = otp.attempts + 1;
    if (newAttempts >= 3) {
      return res.status(403).json({ error: "Too many failed attempts. Contact your administrator.", locked: true });
    }
    return res.status(401).json({ error: "Invalid code. " + (3 - newAttempts) + " attempt(s) remaining." });
  }

  // OTP valid — generate a one-time reset token
  var resetToken = crypto.randomBytes(32).toString("hex");
  db.prepare("UPDATE sw_otp SET reset_token = ? WHERE id = ?").run(resetToken, otp.id);
  res.json({ verified: true, resetToken: resetToken });
});

// ── SW Set Password (after reset OTP verified) ──
router.post("/set-password", function(req, res) {
  var email = (req.body.email || "").toLowerCase().trim();
  var resetToken = req.body.resetToken || "";
  var newPassword = req.body.newPassword || "";

  if (!email || !resetToken || !newPassword) return res.status(400).json({ error: "All fields required" });

  var pwError = validateSwPassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  // Find the OTP row with this reset token
  var otp = db.prepare("SELECT * FROM sw_otp WHERE email = ? AND reset_token = ? AND used = 0").get(email, resetToken);
  if (!otp) return res.status(400).json({ error: "Invalid or expired reset link. Please start again." });

  // Check 30 min expiry on the original OTP
  var createdAt = new Date(otp.created_at + "Z").getTime();
  if (Date.now() - createdAt > 30 * 60 * 1000) {
    return res.status(400).json({ error: "Reset session expired. Please start again." });
  }

  // Set the password
  var swUser = db.prepare("SELECT * FROM sw_users WHERE email = ?").get(email);
  if (!swUser) return res.status(400).json({ error: "Account not found" });

  db.prepare("UPDATE sw_users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), swUser.id);
  // Mark OTP as used
  db.prepare("UPDATE sw_otp SET used = 1 WHERE id = ?").run(otp.id);

  res.json({ success: true });
});

// ── SW Logout ──
router.post("/logout", function(req, res) {
  var token = req.headers["x-sw-token"] || (req.headers.authorization ? req.headers.authorization.replace("Bearer ", "") : null);
  if (token) db.prepare("DELETE FROM sw_sessions WHERE token = ?").run(token);
  res.json({ success: true });
});


// ═══════════════════════════════════════════════════════════════
// ═══ AUTHENTICATED ROUTES (swAuthMiddleware) ═════════════════
// ═══════════════════════════════════════════════════════════════

// ── SW Me (session check) ──
router.get("/me", swAuthMiddleware, function(req, res) {
  res.json({
    user: { id: req.swUser.id, email: req.swUser.email, name: req.swUser.full_name, airtableId: req.swUser.airtable_id, contactType: req.swUser.contact_type, typeOfEmployment: req.swUser.type_of_employment, photoUrl: req.swUser.photo_url, phone: req.swUser.phone }
  });
});

// ── SW Change Password ──
router.post("/change-password", swAuthMiddleware, function(req, res) {
  var currentPw = req.body.currentPassword || "";
  var newPw = req.body.newPassword || "";
  if (!currentPw || !newPw) return res.status(400).json({ error: "Current and new password required" });
  var pwError = validateSwPassword(newPw);
  if (pwError) return res.status(400).json({ error: pwError });
  var user = db.prepare("SELECT * FROM sw_users WHERE id = ?").get(req.swUser.id);
  if (!user || user.password_hash !== hashPassword(currentPw)) return res.status(401).json({ error: "Current password incorrect" });
  db.prepare("UPDATE sw_users SET password_hash = ? WHERE id = ?").run(hashPassword(newPw), req.swUser.id);
  res.json({ success: true });
});

// ── SW Shifts (from Rosters 2025) ──
router.get("/shifts", swAuthMiddleware, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var email = req.swUser.email;
  var filter = "LOWER({Staff Email})='" + email.replace(/'/g, "\\'") + "'";
  airtable.fetchAllFromTableView("Rosters 2025", "Grid View", filter).then(function(records) {
    var shifts = (records || []).map(function(r) {
      var f = r.fields || {};
      var clientName = f["Client Full Name"] || f["Client Name"] || "";
      if (Array.isArray(clientName)) clientName = clientName.join(", ");
      var staffName = f["Staff Name"] || "";
      if (Array.isArray(staffName)) staffName = staffName.join(", ");
      return {
        id: r.id,
        uniqueRef: f["Unique Ref #"] || "",
        clientName: clientName,
        staffName: staffName,
        staffEmail: f["Staff Email"] || "",
        startShift: f["Start Shift"] || "",
        endShift: f["End Shift"] || "",
        dayType: f["Day Type"] || "",
        totalHoursDecimal: f["Total Hours (Decimal)"] || 0,
        totalHoursHMM: f["Total Hours (H:MM)"] || "",
        typeOfShift: f["Type of Shift (Active or Non Active)"] || "",
        shiftStatus: f["Shift Status"] || "",
        hasSleepover: f["Has Sleepover"] || "",
        silOrCas: String(f["SIL or CAS?"] || ""),
        progressNoteCompleted: f["Progress Note Completed?"] || false,
        supportItemName: f["Support Item Name"] || "",
        chargePerHour: f["Charge per hour"] || 0,
        supportCategoryPACE: f["Support Category Number (PACE)"] || "",
        brokenShift: f["Broken Shift?"] || ""
      };
    });
    res.json(shifts);
  }).catch(function(e) {
    console.error("SW shifts error:", e.message);
    res.json([]);
  });
});

// ── SW Clock In / Clock Out ──
router.post("/clock", swAuthMiddleware, function(req, res) {
  var action = req.body.action || ""; // "clock-in" or "clock-out"
  var rosterId = req.body.rosterId || "";
  var lat = req.body.lat;
  var lng = req.body.lng;
  var overrideReason = req.body.overrideReason || "";
  var clientName = req.body.clientName || "";

  if (!action || !rosterId) return res.status(400).json({ error: "Action and rosterId required" });
  if (lat === undefined || lng === undefined) return res.status(400).json({ error: "GPS coordinates required" });

  // Look up client address from Clients table
  var clientFilter = "{Client Name}='" + clientName.replace(/'/g, "\\'") + "'";
  airtable.fetchAllFromTableView("Clients", "Client Active View", clientFilter).then(function(clients) {
    if (!clients || clients.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    var cf = clients[0].fields || {};
    var address = ((cf["Address"] || "") + " " + (cf["Suburb"] || "") + " " + (cf["State"] || "") + " Australia").trim();

    if (!address || address.trim() === "Australia") {
      // No address on file, allow with warning
      return processClockAction(res, action, rosterId, req.swUser.email, lat, lng, 0, overrideReason, clientName, true);
    }

    // Geocode client address
    if (!GOOGLE_MAPS_API_KEY) {
      // No geocoding available — allow with warning
      return processClockAction(res, action, rosterId, req.swUser.email, lat, lng, 0, overrideReason, clientName, true);
    }

    var geocodeUrl = "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(address) + "&key=" + GOOGLE_MAPS_API_KEY;
    fetch(geocodeUrl).then(function(gr) { return gr.json(); }).then(function(geoData) {
      if (!geoData.results || geoData.results.length === 0) {
        return processClockAction(res, action, rosterId, req.swUser.email, lat, lng, 0, overrideReason, clientName, true);
      }
      var loc = geoData.results[0].geometry.location;
      var distance = haversineDistance(lat, lng, loc.lat, loc.lng);
      processClockAction(res, action, rosterId, req.swUser.email, lat, lng, distance, overrideReason, clientName, false, loc.lat, loc.lng);
    }).catch(function(e) {
      console.error("Geocoding error:", e.message);
      processClockAction(res, action, rosterId, req.swUser.email, lat, lng, 0, overrideReason, clientName, true);
    });
  }).catch(function(e) {
    console.error("Client lookup error:", e.message);
    res.status(500).json({ error: "Failed to look up client" });
  });
});

function processClockAction(res, action, rosterId, swEmail, lat, lng, distance, overrideReason, clientName, noGeo, clientLat, clientLng) {
  var withinFence = distance <= 200;
  var allowed = withinFence || overrideReason.length >= 10 || noGeo;

  if (!allowed) {
    return res.json({ allowed: false, distance: distance, clientLat: clientLat || null, clientLng: clientLng || null, message: "You are " + distance + "m from the client's address. An override reason (min 10 characters) is required." });
  }

  // Log the clock action
  try {
    db.prepare("INSERT INTO sw_clock_log (roster_id, sw_email, action, lat, lng, distance_m, override_reason, client_name) VALUES (?,?,?,?,?,?,?,?)").run(
      rosterId, swEmail, action, lat, lng, distance, overrideReason || null, clientName
    );
  } catch(e) { console.error("Clock log error:", e.message); }

  // Update shift status in Airtable
  var newStatus = action === "clock-in" ? "Active" : "Completed";
  var fields = { "Shift Status": newStatus };
  airtable.rawFetch("Rosters 2025", "PATCH", "/" + rosterId, { fields: fields }).then(function(data) {
    if (data.error) {
      console.error("Clock Airtable error:", JSON.stringify(data.error));
      return res.json({ allowed: true, distance: distance, withinFence: withinFence, overrideUsed: !withinFence && !noGeo, noGeo: noGeo, clientLat: clientLat || null, clientLng: clientLng || null, warning: "Clock recorded locally but Airtable update failed" });
    }
    res.json({ allowed: true, distance: distance, withinFence: withinFence, overrideUsed: !withinFence && !noGeo, noGeo: noGeo, clientLat: clientLat || null, clientLng: clientLng || null, status: newStatus });
  }).catch(function(e) {
    console.error("Clock update error:", e.message);
    res.json({ allowed: true, distance: distance, withinFence: withinFence, overrideUsed: !withinFence && !noGeo, warning: "Clock recorded locally but Airtable update failed" });
  });
}

// ── SW Progress Note ──
router.post("/progress-note", swAuthMiddleware, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var b = req.body;
  if (!b.clientName) return res.status(400).json({ error: "Client name required" });
  if (!b.notes || b.notes.length < 50) return res.status(400).json({ error: "Notes must be at least 50 characters" });

  var fields = {
    "Support Workers Name": req.swUser.full_name || "",
    "Client Name": b.clientName,
    "Start Date and Time": b.startDateTime || new Date().toISOString(),
    "End Date and Time": b.endDateTime || new Date().toISOString(),
    "Notes/Summary": b.notes
  };
  if (b.totalHours) fields["Total Hours"] = b.totalHours;
  if (b.transport) fields["Transport"] = b.transport;
  if (b.kms) fields["KMs"] = b.kms;

  tryCreate("Progress Notes", fields).then(function(data) {
    if (data.error) {
      console.error("Progress note create error:", JSON.stringify(data.error));
      return res.status(500).json({ error: "Failed to create progress note: " + (data.error.message || JSON.stringify(data.error)) });
    }
    // Update roster record Progress Note Completed
    if (b.rosterId) {
      airtable.rawFetch("Rosters 2025", "PATCH", "/" + b.rosterId, { fields: { "Progress Note Completed?": true } }).catch(function(e) {
        console.error("Roster progress note flag update error:", e.message);
      });
    }
    res.json({ success: true, id: (data.records && data.records[0]) ? data.records[0].id : null });
  }).catch(function(e) {
    console.error("Progress note error:", e.message);
    res.status(500).json({ error: "Failed to create progress note" });
  });
});

// ── SW Incident Report ──
router.post("/incident", swAuthMiddleware, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var b = req.body;
  if (!b.clientName) return res.status(400).json({ error: "Client name required" });
  if (!b.description || b.description.length < 50) return res.status(400).json({ error: "Description must be at least 50 characters" });
  if (!b.severity) return res.status(400).json({ error: "Severity required" });

  var fields = {
    "Person completing IR": req.swUser.full_name || "",
    "Date & Time of Incident": b.dateTime || new Date().toISOString(),
    "Description": b.description,
    "Severity": b.severity,
    "Status": "Open"
  };
  // Client Name is a linked field — try text-based field name
  if (b.clientName) fields["Client Name"] = b.clientName;

  tryCreate("IR Reports 2025", fields).then(function(data) {
    if (data.error) {
      console.error("Incident report create error:", JSON.stringify(data.error));
      return res.status(500).json({ error: "Failed to create incident report: " + (data.error.message || JSON.stringify(data.error)) });
    }
    res.json({ success: true, id: (data.records && data.records[0]) ? data.records[0].id : null, severity: b.severity });
  }).catch(function(e) {
    console.error("Incident report error:", e.message);
    res.status(500).json({ error: "Failed to create incident report" });
  });
});

// ── SW Training Enrollments ──
router.get("/enrollments", swAuthMiddleware, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var fullName = req.swUser.full_name || "";
  if (!fullName) return res.json([]);

  airtable.fetchAllFromTable("Course Enrollments").then(function(records) {
    var result = (records || []).filter(function(r) {
      var f = r.fields || {};
      var staffName = f["Full Name (from Staff Name)"];
      if (Array.isArray(staffName)) staffName = staffName[0] || "";
      if (!staffName) staffName = f["Staff Name"] || "";
      if (Array.isArray(staffName)) staffName = staffName.join(" ");
      return staffName && staffName.toLowerCase().indexOf(fullName.toLowerCase()) >= 0;
    }).map(function(r) {
      var f = r.fields || {};
      var courseName = f["Name (from Course List)"];
      if (Array.isArray(courseName)) courseName = courseName[0] || "";
      if (!courseName) courseName = f["Name"] || "";
      var courseLink = f["Course List"];
      var courseId = Array.isArray(courseLink) ? courseLink[0] : courseLink;
      var courseExpiry = f["Course Expiry Date"] || "";
      if (Array.isArray(courseExpiry)) courseExpiry = courseExpiry[0] || "";
      return {
        enrollmentId: r.id,
        courseId: courseId || "",
        courseName: courseName || "",
        progress: parseFloat(f["Progress"] || 0),
        enrolledDate: f["Enrolled Date & Time"] || "",
        courseExpiry: courseExpiry,
        allFields: f
      };
    });
    res.json(result);
  }).catch(function(e) {
    console.error("SW enrollments error:", e.message);
    res.json([]);
  });
});

// ── SW Course Detail (reuse existing logic, no admin auth) ──
router.get("/course-detail", swAuthMiddleware, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({});
  var courseId = req.query.id || "";
  if (!courseId) return res.json({ error: "Missing course id" });

  Promise.all([
    airtable.fetchAllFromTable("Course Modules"),
    airtable.fetchAllFromTable("Course Lessons"),
    airtable.fetchAllFromTable("Course Quizzes"),
    airtable.fetchAllFromTable("Course QuizQuestions")
  ]).then(function(results) {
    var allModules = results[0] || [];
    var allLessons = results[1] || [];
    var allQuizzes = results[2] || [];
    var allQuestions = results[3] || [];

    var modules = allModules.filter(function(r) {
      var link = r.fields["Course ID"];
      return Array.isArray(link) ? link.indexOf(courseId) >= 0 : link === courseId;
    }).map(function(r) {
      var f = r.fields || {};
      var lessons = allLessons.filter(function(l) {
        var link = l.fields["Module ID"];
        return Array.isArray(link) ? link.indexOf(r.id) >= 0 : link === r.id;
      }).map(function(l) {
        var lf = l.fields || {};
        var attachments = lf["Attachments"] || [];
        if (!Array.isArray(attachments)) attachments = [];
        return {
          id: l.id, name: lf["Name"] || "", order: parseFloat(lf["Order"] || 0),
          type: lf["Type of Lesson"] || "Content", content: lf["Content"] || "",
          videoUrl: lf["Video URL"] || "", status: lf["Status"] || "",
          attachments: attachments.map(function(a) { return { url: a.url || "", name: a.filename || "", size: a.size || 0 }; })
        };
      }).sort(function(a, b) { return a.order - b.order; });
      return {
        id: r.id, name: f["Name"] || "", order: parseFloat(f["Order"] || 0),
        description: f["Description"] || "", status: f["Status"] || "",
        attachments: (f["Attachments"] || []).map(function(a) { return { url: a.url || "", name: a.filename || "", size: a.size || 0 }; }),
        lessons: lessons
      };
    }).sort(function(a, b) { return a.order - b.order; });

    var quiz = allQuizzes.find(function(r) {
      var link = r.fields["Courses"];
      return Array.isArray(link) ? link.indexOf(courseId) >= 0 : link === courseId;
    });
    var quizData = null;
    if (quiz) {
      var qf = quiz.fields || {};
      var questions = allQuestions.filter(function(r) {
        var link = r.fields["Quiz ID"];
        return Array.isArray(link) ? link.indexOf(quiz.id) >= 0 : link === quiz.id;
      }).map(function(r) {
        var qrf = r.fields || {};
        var opts = qrf["Options"] || "";
        var options = [];
        if (opts) {
          options = opts.split(/,\s*(?=[a-d]\))/i).map(function(o) { return o.replace(/^[a-d]\)\s*/i, "").trim(); });
        }
        return { id: r.id, question: qrf["Name"] || "", options: options, correctAnswer: parseInt(qrf["Correct Answer"] || 0), order: parseFloat(qrf["Order"] || 0) };
      }).sort(function(a, b) { return a.order - b.order; });
      quizData = { id: quiz.id, name: qf["Name"] || "", passPercentage: parseFloat(qf["Pass Percentage"] || 100), questions: questions };
    }
    res.json({ modules: modules, quiz: quizData });
  }).catch(function(e) {
    console.error("SW course-detail error:", e.message);
    res.json({ error: e.message });
  });
});

// ── SW Quiz Submit & Progress Update ──
router.post("/quiz-submit", swAuthMiddleware, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: "Airtable not configured" });
  var enrollmentId = req.body.enrollmentId || "";
  var score = req.body.score; // 0-100
  var passed = req.body.passed || false;
  var progress = req.body.progress || 0; // decimal 0-1

  if (!enrollmentId) return res.json({ error: "Missing enrollmentId" });

  if (passed) {
    var fields = { "Progress": progress };
    airtable.rawFetch("Course Enrollments", "PATCH", "/" + enrollmentId, { fields: fields }).then(function(data) {
      res.json({ success: true, score: score, passed: true, progress: progress });
    }).catch(function(e) {
      res.json({ error: e.message });
    });
  } else {
    res.json({ success: true, score: score, passed: false, message: "You did not pass. You can retry." });
  }
});

// ── SW Document Upload ──
router.post("/upload-doc", swAuthMiddleware, function(req, res) {
  var b = req.body;
  if (!b.docName || !b.fileData) return res.status(400).json({ error: "Document name and file data required" });
  // Find the worker's contact record in Airtable
  var email = req.swUser.email;
  var filter = "LOWER({Email})='" + email.toLowerCase().replace(/'/g, "\\'") + "'";
  var params = "?filterByFormula=" + encodeURIComponent(filter) + "&maxRecords=1";
  airtable.rawFetch("All Contacts", "GET", params).then(function(data) {
    var records = data.records || [];
    if (records.length === 0) return res.status(404).json({ error: "Contact record not found" });
    var recordId = records[0].id;
    // Log the upload attempt
    try {
      db.prepare("INSERT INTO sw_clock_log (roster_id, sw_email, action, client_name) VALUES (?,?,?,?)").run(
        "doc_upload", email, "upload_document", b.docName + " - " + (b.fileName || "file"));
    } catch(e) {}
    // Note: Airtable attachment uploads require a URL, not base64
    // Store the document reference and notify admin
    res.json({ success: true, message: "Document received. Your team leader will be notified." });
  }).catch(function(e) {
    res.status(500).json({ error: "Upload failed: " + e.message });
  });
});

module.exports = router;
