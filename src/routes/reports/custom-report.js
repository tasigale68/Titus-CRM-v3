// ─── Custom Client Reports & AI Analysis ─────────────────
var fs = require('fs');
var path = require('path');
var airtable = require('../../services/database');
var env = require('../../config/env');
var { db } = require('../../db/sqlite');
var { uploadsDir } = require('../../config/upload');
var { TitusDate } = require('./helpers');

// ═══ POST /api/reports/custom — fetch data for custom report ═══
function customReportData(req, res) {
  req.setTimeout(120000);
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var from = req.body.from;
  var to = req.body.to;
  var selectedClients = req.body.clients || [];
  var selectedTables = req.body.tables || [];

  if (!from || !to) return res.status(400).json({ error: "from and to required" });
  if (!selectedClients.length) return res.status(400).json({ error: "No clients selected" });
  if (!selectedTables.length) return res.status(400).json({ error: "No tables selected" });

  var fromDate = new Date(from);
  var toDate = new Date(to + "T23:59:59");
  var clientNames = selectedClients.map(function(c) { return typeof c === "string" ? c : c.name; }).filter(Boolean);

  function buildClientFilter(fieldName) {
    if (clientNames.length === 0) return "";
    if (clientNames.length === 1) return "FIND('" + clientNames[0].replace(/'/g, "\'") + "',{" + fieldName + "})>0";
    return "OR(" + clientNames.map(function(n) {
      return "FIND('" + n.replace(/'/g, "\'") + "',{" + fieldName + "})>0";
    }).join(",") + ")";
  }

  function buildDateClientFilter(dateField, clientField) {
    var fromStr = fromDate.toISOString().split("T")[0];
    var toStr = new Date(toDate.getTime() + 86400000).toISOString().split("T")[0];
    var df = "AND(IS_AFTER({" + dateField + "},'" + new Date(fromDate.getTime() - 86400000).toISOString().split("T")[0] + "'),IS_BEFORE({" + dateField + "},'" + toStr + "'))";
    var cf = buildClientFilter(clientField);
    return cf ? "AND(" + df + "," + cf + ")" : df;
  }

  var TABLE_DEFS = {
    "Clients":                   { table: "Clients",                       clientField: "Client Name",                  dateField: null },
    "Client Docs":               { table: "Client Docs",                   clientField: "Client Name",                  dateField: null },
    "Client Core Budgets":       { table: "Client Core Budgets",           clientField: "Client Name",                  dateField: null },
    "Complaints Register":       { table: "Complaints Register",           clientField: "Client Name",                  dateField: "Date" },
    "Client Calendar":           { table: "Client Calendar",               clientField: "Client Name",                  dateField: "Date" },
    "Progress Notes":            { table: "Progress Notes",                clientField: "Client Name (from Client)",    dateField: "Start Time" },
    "SIL Site Visits":           { table: "SIL Site Visits",               clientField: "Client Name",                  dateField: "Date" },
    "Approved / Excluded Workers 2025": { table: "Approved / Excluded Workers 2025", clientField: "Client Name",        dateField: null },
    "Risk Register":             { table: "Risk Register",                 clientField: "Client Name",                  dateField: null },
    "Internal Audit":            { table: "Internal Audit",                clientField: "Client Name",                  dateField: "Audit Date" },
    "Tasks":                     { table: "Tasks",                         clientField: "Client Name",                  dateField: "Due Date" },
    "SIL Induction Register":    { table: "SIL Induction Register",        clientField: "Client Name",                  dateField: "Date" },
    "Client Contact Preferences":{ table: "Client Contact Preferences",    clientField: "Client Name",                  dateField: null },
    "Client Sleep Chart":        { table: "Client Sleep Chart",            clientField: "Client Name",                  dateField: "Date" },
    "IR Reports 2025":           { table: "IR Reports 2025",               clientField: "Client Name",                  dateField: "Date & Time of Incident",         view: "Grouped by Client Name" },
    "Bowel Chart":               { table: "Bowel Chart",                   clientField: "Client Name",                  dateField: "Date" },
    "Support Plan 2025":         { table: "Support Plan 2025",             clientField: "Client Name",                  dateField: null },
    "Fluid Intake Diary":        { table: "Fluid Intake Diary",            clientField: "Client Name",                  dateField: "Date" },
    "QR Code Data - Behaviours": { table: "QR Code Data - Behaviours",     clientField: "Client Name",                  dateField: "Date" },
    "Client SA & SOS":           { table: "Client SA & SOS",               clientField: "Client Name",                  dateField: null },
    "PBSP":                      { table: "PBSP",                          clientField: "Client Name",                  dateField: null }
  };

  var results = {};
  var promises = [];

  selectedTables.forEach(function(tableKey) {
    if (tableKey === "Conversations SMS & Calls") {
      var p = Promise.resolve().then(function() {
        try {
          var andClauses = [];
          var params = [];
          if (from) { andClauses.push("created_at >= ?"); params.push(from); }
          if (to) { andClauses.push("created_at <= ?"); params.push(to + " 23:59:59"); }
          var callResults = [];
          var smsResults = [];
          try {
            var callRows = db.prepare("SELECT * FROM calls WHERE " + (andClauses.length ? andClauses.join(" AND ") : "1=1") + " ORDER BY created_at DESC LIMIT 500").all(...params);
            callResults = callRows;
          } catch(e) { console.log("calls query:", e.message); }
          try {
            var smsRows = db.prepare("SELECT * FROM sms_messages WHERE " + (andClauses.length ? andClauses.join(" AND ") : "1=1") + " ORDER BY created_at DESC LIMIT 500").all(...params);
            smsResults = smsRows;
          } catch(e) { console.log("sms query:", e.message); }
          results["Conversations SMS & Calls"] = { calls: callResults, sms: smsResults };
        } catch(e) {
          results["Conversations SMS & Calls"] = { error: e.message };
        }
      });
      promises.push(p);
      return;
    }

    var def = TABLE_DEFS[tableKey];
    if (!def) return;

    var filter;
    if (def.dateField) {
      filter = buildDateClientFilter(def.dateField, def.clientField);
    } else {
      filter = buildClientFilter(def.clientField);
    }

    var p2 = (def.view ? airtable.fetchAllFromTableView(def.table, def.view, filter || undefined) : airtable.fetchAllFromTable(def.table, filter || undefined)).then(function(records) {
      var filtered = (records || []).map(function(r) {
        return { id: r.id, fields: r.fields };
      });
      results[tableKey] = filtered;
    }).catch(function(e) {
      console.error("Custom report fetch error for " + tableKey + ":", e.message);
      results[tableKey] = { error: e.message };
    });
    promises.push(p2);
  });

  Promise.all(promises).then(function() {
    // Strict client-side verification pass
    clientNames.forEach(function(cn) {
      var cnLower = cn.trim().toLowerCase();
      selectedTables.forEach(function(tableKey) {
        if (tableKey === "Conversations SMS & Calls") return;
        var rows = results[tableKey];
        if (!rows || rows.error || !Array.isArray(rows)) return;
        results[tableKey] = rows.filter(function(rec) {
          var f = rec.fields || {};
          return Object.keys(f).some(function(k) {
            var v = f[k];
            if (Array.isArray(v)) v = v.join(" ");
            return String(v || "").toLowerCase().indexOf(cnLower) >= 0;
          });
        });
      });
    });

    // Extract stakeholder data from Clients table results
    var stakeholdersByClient = {};
    clientNames.forEach(function(cn) {
      var cnLower = cn.toLowerCase();
      var clientRecs = (results["Clients"] && Array.isArray(results["Clients"])) ? results["Clients"] : [];
      var clientRec = null;
      clientRecs.forEach(function(rec) {
        var f = rec.fields || {};
        var recName = String(f["Client Name"] || f["Full Name"] || "").toLowerCase();
        if (recName === cnLower || recName.indexOf(cnLower) >= 0) clientRec = f;
      });
      if (clientRec) {
        function av(v) { return Array.isArray(v) ? v.join(", ") : String(v || ""); }
        stakeholdersByClient[cn] = {
          supportCoordinator: {
            name: av(clientRec["Support Coordinator (from Support Coordinator Link)"] || clientRec["Support Coordinator"] || clientRec["Support Coordinator Name"] || ""),
            email: av(clientRec["Support Coordinator Email (from Support Coordinator Link)"] || clientRec["Support Coordinator Email"] || ""),
            phone: av(clientRec["Phone (from Support Coordinator )"] || clientRec["Support Coordinator Phone"] || ""),
            company: av(clientRec["Company Name (from Support Coordinator Link)"] || clientRec["Support Coordinator Company"] || "")
          },
          planManager: {
            name: av(clientRec["Plan Manager (from Plan Manager Link)"] || clientRec["Plan Manager"] || ""),
            email: av(clientRec["Plan Manager Email (from Plan Manager Link)"] || clientRec["Plan Manager Email"] || ""),
            phone: av(clientRec["Plan Manager Phone (from Plan Manager Link)"] || clientRec["Plan Manager Phone"] || ""),
            company: av(clientRec["Company Name (from Plan Manager Link)"] || clientRec["Plan Manager Company"] || "")
          },
          nominee: {
            name: av(clientRec["Nominee or Guardian"] || clientRec["Nominee or Legal Guardian"] || ""),
            phone: av(clientRec["Nominee Phone"] || ""),
            email: av(clientRec["Nominee Email"] || ""),
            relationship: av(clientRec["Nominee Relationship"] || "")
          },
          opg: {
            name: av(clientRec["OPG Officer"] || clientRec["Public Guardian"] || clientRec["OPG Name"] || ""),
            phone: av(clientRec["OPG Phone"] || clientRec["Public Guardian Phone"] || ""),
            email: av(clientRec["OPG Email"] || clientRec["Public Guardian Email"] || "")
          },
          behaviourPractitioner: {
            name: av(clientRec["PBSP Prac Name"] || clientRec["Behaviour Practitioner"] || clientRec["Behaviour Practitioner Name"] || ""),
            email: av(clientRec["PBSP Prac Email"] || clientRec["Behaviour Practitioner Email"] || ""),
            phone: av(clientRec["PBSP Phone"] || clientRec["Behaviour Practitioner Phone"] || "")
          }
        };
      }
    });

    res.json({
      from: from,
      to: to,
      clients: clientNames,
      tables: selectedTables,
      results: results,
      stakeholders: stakeholdersByClient,
      generatedAt: TitusDate.formatDateTime(new Date())
    });
  }).catch(function(e) {
    res.status(500).json({ error: e.message });
  });
}

// ═══ POST /api/reports/custom-save — save custom report to Airtable ═══
function customReportSave(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: "Airtable not configured" });
  var b = req.body || {};
  var clientName   = b.clientName || "";
  var from         = b.from || "";
  var to           = b.to || "";
  var generatedBy  = b.generatedBy || (req.user && (req.user.name || req.user.email)) || "Titus CRM";
  var htmlContent  = b.htmlContent || "";
  var reportTitle  = b.reportTitle || ("Customised Client Report " + from + " to " + to);

  if (!clientName) return res.json({ error: "clientName required" });

  var fields = {};
  fields["Date created in Titus"] = new Date().toISOString().split("T")[0];
  if (generatedBy) { fields["Generated By"] = generatedBy; }

  var saveAndLink = Promise.resolve();
  if (htmlContent) {
    saveAndLink = Promise.resolve().then(function() {
      try {
        var safeName = "custom_report_" + Date.now() + "_" + Math.random().toString(36).slice(2,6) + ".html";
        var filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, htmlContent, "utf8");
        var protocol = "https";
        var host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
        var fileUrl = protocol + "://" + host + "/uploads/" + safeName;
        fields["Report Upload"] = [{ url: fileUrl, filename: reportTitle.replace(/[^a-zA-Z0-9 _-]/g,"_") + ".html" }];
      } catch(e) {
        console.warn("Custom report HTML save error:", e.message);
      }
    });
  }

  function lookupClient() {
    return airtable.fetchAllFromTable("Clients").then(function(clients) {
      var match = (clients || []).find(function(c) {
        var fn = c.fields && (c.fields["Client Name"] || c.fields["Full Name"] || c.fields["Name"] || "");
        if (Array.isArray(fn)) fn = fn[0] || "";
        return fn.toLowerCase() === clientName.toLowerCase();
      });
      if (match) {
        fields["Client Name"] = [match.id];
        return;
      }
      return airtable.fetchAllFromTable("Contacts").then(function(contacts) {
        var cm = (contacts || []).find(function(c) {
          var fn = c.fields && (c.fields["Full Name"] || c.fields["Name"] || "");
          if (Array.isArray(fn)) fn = fn[0] || "";
          return fn.toLowerCase() === clientName.toLowerCase();
        });
        if (cm) fields["Client Name"] = [cm.id];
        else { fields["Client Name Text"] = clientName; }
      });
    }).catch(function() { fields["Client Name Text"] = clientName; });
  }

  function trySave(fieldsToTry) {
    var sendFields = Object.assign({}, fieldsToTry);
    delete sendFields._retried;
    return airtable.rawFetch("Weekly Stakeholder Reports 2026", "POST", "", { records: [{ fields: sendFields }] })
      .then(function(data) {
        if (data.records && data.records.length > 0) {
          console.log("Custom report saved:", data.records[0].id, clientName);
          return data;
        }
        if (data.error && data.error.type === "UNKNOWN_FIELD_NAME" && !fieldsToTry._retried) {
          var badField = data.error.message && data.error.message.match(/"([^"]+)"/);
          if (badField && badField[1] && fieldsToTry[badField[1]] !== undefined) {
            console.warn("Removing unknown field:", badField[1]);
            var reduced = Object.assign({}, fieldsToTry);
            delete reduced[badField[1]];
            reduced._retried = true;
            return trySave(reduced);
          }
          var minimal = { "Date created in Titus": new Date().toISOString().split("T")[0] };
          if (fieldsToTry["Client Name"]) minimal["Client Name"] = fieldsToTry["Client Name"];
          if (fieldsToTry["Client Name Text"]) minimal["Client Name Text"] = fieldsToTry["Client Name Text"];
          if (fieldsToTry["Report Upload"]) minimal["Report Upload"] = fieldsToTry["Report Upload"];
          minimal._retried = true;
          return trySave(minimal);
        }
        throw new Error((data.error && data.error.message) || "Failed to save");
      });
  }

  Promise.all([saveAndLink, lookupClient()]).then(function() {
    var cleanFields = Object.assign({}, fields);
    delete cleanFields._retried;
    return trySave(cleanFields);
  }).then(function(data) {
    res.json({ id: data.records[0].id, success: true, clientName: clientName });
  }).catch(function(e) {
    console.error("Custom report save error:", e.message);
    res.json({ error: e.message });
  });
}

// ═══ POST /api/reports/custom-analyse — AI 4-pass analysis ═══
function customReportAnalyse(req, res) {
  req.setTimeout(180000);
  if (!env.anthropic.apiKey) return res.json({ error: "AI not configured — ANTHROPIC_API_KEY missing" });

  var clientName  = req.body.clientName  || "";
  var audience    = req.body.audience    || "stakeholder";
  var from        = req.body.from        || "";
  var to          = req.body.to          || "";
  var recipient   = req.body.recipient   || "";
  var rawData     = req.body.rawData     || {};
  var tables      = req.body.tables      || [];
  var company     = req.body.company     || {};

  if (!clientName) return res.json({ error: "clientName required" });

  var companyName  = company.tradingName  || "Delta Community Support";
  var ndisProvider = company.ndisProvider || "4050123456";
  var companyABN   = company.abn          || "";

  var AUDIENCE_SYSTEM = {
    stakeholder: "You are an expert NDIS report writer for " + companyName + " (NDIS Provider No: " + ndisProvider + "). Generate a professional, evidence-based Stakeholder Progress Report for the NDIA, Plan Manager, and/or Support Coordinator. Use professional plain-English language. Reference NDIS goal domains. Every claim must be evidence-based and traceable to the source data provided.",
    guardian: "You are a senior NDIS compliance officer for " + companyName + " (NDIS Provider No: " + ndisProvider + "). Generate a formal report to the Office of the Public Guardian (OPG) Queensland under the Guardianship and Administration Act 2000 (Qld). This is a legally significant document. Every statement must be factual, evidence-based, and defensible. Opinions must be clearly labelled.",
    behaviour: "You are a senior Operations Manager at " + companyName + " (NDIS Provider No: " + ndisProvider + "), a registered NDIS implementing provider. You are writing a Behaviour Support Report TO the participant's Positive Behaviour Support (PBS) Practitioner. Your role is to provide the practitioner with a detailed, factual account of the participant's behaviour, staffing responses, incidents, and patterns observed during the reporting period — so they can review, update and refine the Behaviour Support Plan. Report from the provider's perspective: what support workers observed, what strategies were used, what incidents occurred, what worked, what didn't. Ground the report in the NDIS (Restrictive Practices and Behaviour Support) Rules 2018 and PBS framework. Quantify all data. Be specific, clinical, and operational. Avoid generic statements — every paragraph should be traceable to evidence in the data.",
    mentalhealth: "You are a Registered Mental Health Nurse (RN, MHN) for " + companyName + " (NDIS Provider No: " + ndisProvider + "). Generate a Mental Health Nursing Report bridging NDIS and Queensland mental health systems. Use dual-language: clinical terminology for clinical sections, plain English for NDIS sections.",
    internal: "You are an NDIS operations manager at " + companyName + " (NDIS Provider No: " + ndisProvider + "). Generate an internal operations report for management review. Focus on service delivery quality, compliance, and operational insights.",
    family: "You are a compassionate support coordinator at " + companyName + " writing a warm, accessible update for the family and carers of an NDIS participant. Use plain, friendly language. Focus on what the participant has been doing and how they are going."
  };

  var AUDIENCE_LABELS = {
    stakeholder: "Stakeholder Progress Report — NDIA / Plan Manager / Support Coordinator",
    guardian:    "Report to the Office of the Public Guardian (QLD)",
    behaviour:   "Behaviour Support Report — NDIS Quality & Safeguards Commission",
    mentalhealth:"Mental Health Nursing Report — Treating Team / NDIA",
    internal:    "Internal Operations Report — DCS Management",
    family:      "Family & Carer Update"
  };

  var systemPrompt = AUDIENCE_SYSTEM[audience] || AUDIENCE_SYSTEM.stakeholder;
  var reportLabel  = AUDIENCE_LABELS[audience]  || AUDIENCE_LABELS.stakeholder;

  function buildClientDataSummary() {
    var cnLower = clientName.toLowerCase();
    var lines = [];
    lines.push("CLIENT: " + clientName);
    lines.push("REPORT PERIOD: " + from + " to " + to);
    lines.push("REPORT TYPE: " + reportLabel);
    lines.push("PROVIDER: " + companyName + " | NDIS Provider No: " + ndisProvider + (companyABN ? " | ABN: " + companyABN : ""));
    if (recipient) lines.push("PREPARED FOR: " + recipient);
    lines.push("");

    tables.forEach(function(tableKey) {
      if (tableKey === "Conversations SMS & Calls") {
        var conv = rawData[tableKey] || {};
        var calls = (conv.calls || []).length;
        var sms   = (conv.sms   || []).length;
        if (calls + sms === 0) return;
        lines.push("── " + tableKey.toUpperCase() + " ──");
        lines.push(calls + " calls, " + sms + " SMS messages in period.");
        if (conv.sms) {
          conv.sms.slice(0,5).forEach(function(s) {
            lines.push("  SMS [" + (s.created_at||"").substring(0,10) + "] " + (s.direction||"") + ": " + (s.body||"").substring(0,100));
          });
        }
        lines.push("");
        return;
      }

      var rows = rawData[tableKey];
      if (!rows || rows.error || !Array.isArray(rows) || rows.length === 0) return;

      var clientRows = rows.filter(function(rec) {
        var f = rec.fields || {};
        return Object.keys(f).some(function(k) {
          var v = f[k]; if (Array.isArray(v)) v = v.join(" ");
          return String(v || "").toLowerCase().indexOf(cnLower) >= 0;
        });
      });
      if (clientRows.length === 0) return;

      lines.push("── " + tableKey.toUpperCase() + " (" + clientRows.length + " records) ──");
      clientRows.slice(0, 30).forEach(function(rec, idx) {
        var f = rec.fields || {};
        var rowParts = [];
        Object.keys(f).slice(0, 10).forEach(function(k) {
          var v = f[k];
          if (v === null || v === undefined || v === "") return;
          if (Array.isArray(v)) {
            if (v.length > 0 && typeof v[0] === "object") v = v.map(function(x) { return x.filename || x.name || ""; }).join(", ");
            else v = v.slice(0,2).join(", ");
          }
          if (typeof v === "object") return;
          v = String(v);
          if (v.length > 150) v = v.substring(0, 150) + "...";
          rowParts.push(k + ": " + v);
        });
        lines.push("  [" + (idx+1) + "] " + rowParts.join(" | "));
      });
      if (clientRows.length > 30) lines.push("  ... and " + (clientRows.length - 30) + " more records");
      lines.push("");
    });
    return lines.join("\n");
  }

  var dataSummary = buildClientDataSummary();

  var pass1Prompt = "PASS 1 — CLIENT DATA VERIFICATION\n\nReview the data below and confirm every record belongs to client: " + clientName + "\nAll dates must fall within: " + from + " to " + to + "\n\nFor each table: list record count confirmed for " + clientName + ", flag any that belong to other clients, flag any outside the date range.\n\nDATA:\n" + dataSummary;

  var pass2Prompt = "PASS 2 — EVIDENCE EXTRACTION\n\nUsing only verified data for " + clientName + " (" + from + " to " + to + "), extract and organise:\n1. SUPPORT DELIVERY: Shifts, hours, workers\n2. GOAL PROGRESS: Observable progress evidence\n3. HEALTH: Sleep, bowel, fluid, incidents\n4. RISKS: Active risks, severity, mitigation\n5. INCIDENTS: What happened, actions, reportability\n6. ACTIVITIES: Calendar, community access\n7. BUDGET: Core supports utilisation\n\nDATA:\n" + dataSummary;

  var pass3Prompt = "PASS 3 — ACCURACY CHECK\n\nCross-check evidence for " + clientName + " against these criteria:\n1. CLIENT IDENTITY: Every piece of evidence is explicitly linked to " + clientName + "\n2. DATE RANGE: All evidence falls between " + from + " and " + to + "\n3. COMPLETENESS: Note any obvious gaps\n4. CONSISTENCY: Flag contradictions in the data\n5. REPORTABILITY: For a " + reportLabel + ", identify critical vs supplementary evidence\n\nDATA:\n" + dataSummary;

  var pass4Prompt = "PASS 4 — FINAL REPORT\n\nGenerate the professional report for " + clientName + ".\n\nREQUIREMENTS:\n- Report Type: " + reportLabel + "\n- Client: " + clientName + "\n- Provider (Implementing): " + companyName + " (NDIS Provider No: " + ndisProvider + (companyABN ? ", ABN: " + companyABN : "") + ")\n- Prepared For: " + (recipient || "Positive Behaviour Support (PBS) Practitioner") + "\n- Period: " + from + " to " + to + "\n- Only include verified evidence for " + clientName + "\n\nPOINT OF VIEW: You are writing AS the implementing NDIS provider (operations manager level) TO the behaviour support practitioner. This is the provider's account of what was observed, what strategies were trialled, and what patterns emerged — so the practitioner can update the PBSP.\n\nSTRUCTURE:\n1. EXECUTIVE SUMMARY — 3-4 sentences overview of the period from provider perspective\n2. SUPPORT DELIVERY — Total shifts, total support hours, staff roster, any coverage issues\n3. OBSERVED BEHAVIOURS OF CONCERN — Chronological account with dates, triggers, staff responses and outcomes\n4. INCIDENT SUMMARY — All incidents logged, categories, NDIS reportable status, actions taken\n5. CURRENT STRATEGY EFFECTIVENESS — What PBS strategies were observed to be used by staff, what worked, what didn't\n6. HEALTH & PERSONAL CARE — Medication adherence, personal care acceptance/refusals, nutrition, hydration\n7. ENVIRONMENTAL & CONTEXTUAL FACTORS — Co-resident dynamics, hospital presentations, routine disruptions\n8. PROVIDER RECOMMENDATIONS TO PRACTITIONER — Specific requests for PBSP review, strategy updates, or new strategies needed\n\nFORMAT: Professional Australian English. Be specific with dates, times, and staff observations. Use UPPERCASE HEADINGS for each section. No markdown. No bullet points. Write in paragraphs. 800-1400 words.\n\nDATA:\n" + dataSummary;

  function callClaude(userPrompt, maxTokens) {
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.anthropic.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens || 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t) { throw new Error("Claude API " + r.status + ": " + t.substring(0, 200)); });
      return r.json();
    }).then(function(d) {
      return d.content && d.content[0] ? d.content[0].text : "";
    });
  }

  console.log("[custom-report-analyse] Starting 4-pass analysis for:", clientName);

  callClaude(pass1Prompt, 800)
    .then(function(pass1Result) {
      console.log("[custom-report-analyse] Pass 1 complete:", clientName);
      return callClaude(pass2Prompt, 1000).then(function(pass2Result) {
        console.log("[custom-report-analyse] Pass 2 complete:", clientName);
        return callClaude(pass3Prompt, 800).then(function(pass3Result) {
          console.log("[custom-report-analyse] Pass 3 complete:", clientName);
          return callClaude(pass4Prompt, 2000).then(function(pass4Result) {
            console.log("[custom-report-analyse] Pass 4 complete:", clientName);
            res.json({
              clientName: clientName,
              reportType: reportLabel,
              aiNarrative: pass4Result,
              verificationSummary: pass3Result,
              evidenceSummary: pass2Result,
              dataVerification: pass1Result,
              generatedAt: TitusDate.formatDateTime(new Date())
            });
          });
        });
      });
    })
    .catch(function(e) {
      console.error("[custom-report-analyse] Error:", e.message);
      res.status(500).json({ error: e.message });
    });
}

module.exports = {
  customReportData,
  customReportSave,
  customReportAnalyse
};
