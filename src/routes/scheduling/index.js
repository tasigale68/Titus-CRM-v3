const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { logAudit } = require('../../services/audit');
const airtable = require('../../services/database');
const env = require('../../config/env');
const rocRates = require('../../services/roc-rates');

const router = express.Router();

router.use(authenticate);

// ─── Shared constants ──────────────────────────────
// ShiftCare name → All Contacts name mapping (known mismatches)
var STAFF_NAME_ALIASES = {
  "bianca ivy connolly": "bianca connolly",
  "brendan james horvat": "brendan brendan horvat",
  "brian patrick moore": "brian moore",
  "charli brady": "charlotte charli brady",
  "deraz massey raiin": "deraz massey massey raiin",
  "dylan gillet": "dylan gillett",
  "emaline tafili": "emaline taafili",
  "hiko o te rangi curtis": "hiko curtis",
  "justine ria williams": "justine justine williams",
  "kerrianne louise p'ng": "kerri p'ng",
  "lataysia karelle tarawhiti": "lataysia (tarz) tarawhiti",
  "malia manuotalaha": "malia  manuotalaha",
  "melesimani lingisiva kaho": "mele simani melesimani kaho",
  "rj weston": "hillary (rj) weston",
  "nazier williams": "nazier nazier",
  "shallan davis": "shallan shallan"
};

// ─── RoC authorization middleware ──────────────────
var ROC_ROLES = ["superadmin", "director", "team_leader", "roster_officer"];
function rocAuth(req, res, next) {
  if (ROC_ROLES.indexOf(req.user.role) < 0) return res.status(403).json({ error: "Not authorized for Roster of Care" });
  next();
}

// ─── Helpers ───────────────────────────────────────

// Build contact lookups: emailToName and nameToEmail
function buildContactLookups(contacts) {
  var emailToName = {};
  var nameToEmail = {};
  (contacts || []).forEach(function(c) {
    var cf = c.fields || {};
    var email = (cf["Email"] || "").trim().toLowerCase();
    var name = cf["Full Name"] || cf["Name"] || "";
    if (!name && (cf["First Name"] || cf["Last Name"])) name = ((cf["First Name"] || "") + " " + (cf["Last Name"] || "")).trim();
    if (email && name) {
      emailToName[email] = name;
      nameToEmail[name.toLowerCase().trim()] = email;
    }
    // Also index by ShiftCare Name alias field
    var alias = (cf["ShiftCare Name"] || "").trim();
    if (alias && email) nameToEmail[alias.toLowerCase().trim()] = email;
  });
  // Apply known aliases
  Object.keys(STAFF_NAME_ALIASES).forEach(function(a) {
    var realName = STAFF_NAME_ALIASES[a].toLowerCase().trim();
    if (nameToEmail[realName]) nameToEmail[a] = nameToEmail[realName];
  });
  return { emailToName: emailToName, nameToEmail: nameToEmail };
}

// Check if value looks like Airtable record IDs
function looksLikeRecordIds(v) {
  if (!v) return false;
  if (typeof v === "string") return /^rec[A-Za-z0-9]{10,}/.test(v);
  if (Array.isArray(v)) return v.length > 0 && typeof v[0] === "string" && /^rec[A-Za-z0-9]{10,}/.test(v[0]);
  return false;
}

// Find best name value from fields, trying multiple field names
function findNameField(f, primaryField, altPatterns) {
  var val = f[primaryField];
  // If primary field has actual names (not record IDs), use it
  if (val && !looksLikeRecordIds(val)) {
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  }
  // Try alternative field name patterns
  for (var i = 0; i < altPatterns.length; i++) {
    var v = f[altPatterns[i]];
    if (v && !looksLikeRecordIds(v)) {
      if (Array.isArray(v)) return v.join(", ");
      return String(v);
    }
  }
  // Search all fields for lookup fields containing the keyword
  var keyword = primaryField.toLowerCase().replace(/\s*name\s*/g, "").trim() || "client";
  var keys = Object.keys(f);
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j];
    if (k === primaryField) continue;
    if (k.toLowerCase().indexOf(keyword) >= 0) {
      var fv = f[k];
      if (fv && !looksLikeRecordIds(fv) && typeof fv !== "object") {
        if (Array.isArray(fv)) return fv.join(", ");
        return String(fv);
      }
    }
  }
  // Last resort: return the original even if it's a record ID
  if (val) {
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  }
  return "";
}


// ═══════════════════════════════════════════════════════════
//  GET /api/scheduling/rosters — List all roster shifts
// ═══════════════════════════════════════════════════════════
router.get('/rosters', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);

  // Fetch all rosters and contacts in parallel
  var rostersPromise = airtable.fetchAllFromTable("Rosters 2025");
  var contactsPromise = airtable.fetchAllFromTable("All Contacts").catch(function() { return []; });

  Promise.all([rostersPromise, contactsPromise]).then(function(allResults) {
    var records = allResults[0] || [];
    var contacts = allResults[1] || [];

    var lookups = buildContactLookups(contacts);
    var emailToName = lookups.emailToName;
    var nameToEmail = lookups.nameToEmail;

    console.log("[SCHEDULER] Lookups built: " + Object.keys(emailToName).length + " email->name, " + Object.keys(nameToEmail).length + " name->email");

    var result = (records || []).map(function(r) {
      var f = r.fields || {};

      // Prefer plain text "Client Name (Text)" (written by ShiftCare importer)
      var clientNameText = f["Client Name (Text)"] || "";
      if (Array.isArray(clientNameText)) clientNameText = clientNameText[0] || "";
      var clientName = clientNameText || findNameField(f, "Client Full Name", [
        "Client Name", "Client", "Client (from Participants)", "Client Name (from Participants)",
        "Client Name (from Contacts)", "Participant Name", "Participant",
        "Name (from Client)", "Name (from Clients)",
        "Client Name Lookup", "Client_Name"
      ]);

      // Prefer plain text "Staff Name (Text)" (written by ShiftCare importer)
      var staffNameText = f["Staff Name (Text)"] || "";
      if (Array.isArray(staffNameText)) staffNameText = staffNameText[0] || "";
      var staffName = staffNameText || findNameField(f, "Staff Name", [
        "Staff", "Staff Member", "Worker", "Worker Name", "Employee",
        "Employee Name", "Staff Full Name", "Name (from Staff)",
        "Staff Name Lookup", "Staff_Name", "Support Worker"
      ]);

      // Extract staff email
      var rawStaffEmail = f["Staff Email (Text)"] || f["Staff Email"];
      var staffEmailVal = "";
      if (Array.isArray(rawStaffEmail)) { staffEmailVal = (rawStaffEmail[0] || "").trim(); }
      else if (typeof rawStaffEmail === "string") { staffEmailVal = rawStaffEmail.trim(); }

      // Fallback 1: resolve staff name from Staff Email via All Contacts lookup
      if (!staffName || looksLikeRecordIds(staffName) || staffName.indexOf("@") >= 0) {
        if (staffEmailVal) {
          var emailKey = staffEmailVal.toLowerCase();
          if (emailToName[emailKey]) staffName = emailToName[emailKey];
        }
      }
      // Fallback 2: resolve staff email from staff name via reverse lookup
      if (!staffEmailVal && staffName) {
        var snKey = staffName.toLowerCase().trim();
        if (nameToEmail[snKey]) staffEmailVal = nameToEmail[snKey];
      }

      var skills = f["Required Staff Skills"] || [];
      if (typeof skills === "string") skills = [skills];
      return {
        airtableId: r.id,
        uniqueRef: f["Unique Ref #"] || "",
        clientName: clientName,
        fundingLevel: f["Funding Level"] || "",
        skills: skills,
        silOrCas: String(f["SIL or CAS?"] || ""),
        staffEmail: staffEmailVal || "",
        staffName: staffName,
        contactType: f["Type of Contact (Single Select)"] || f["Type of Contact"] || "",
        startShift: f["Start Shift"] || "",
        endShift: f["End Shift"] || "",
        dayType: f["Day Type"] || "",
        chargePerHour: parseFloat(f["Charge per hour"]) || 0,
        totalHoursDecimal: parseFloat(f["Total Hours (Decimal)"]) || 0,
        supportItemName: f["Support Item Name"] || "",
        allFields: f
      };
    });

    var withEmail = result.filter(function(r) { return r.staffEmail; }).length;
    var withName = result.filter(function(r) { return r.staffName && r.staffName.trim(); }).length;
    var noEmail = result.filter(function(r) { return r.staffName && r.staffName.trim() && !r.staffEmail; }).length;
    console.log("[SCHEDULER] " + result.length + " shifts: " + withName + " with staff name, " + withEmail + " with email resolved, " + noEmail + " staff with no email match");
    if (noEmail > 0) {
      var unmatchedNames = {};
      result.forEach(function(r) { if (r.staffName && r.staffName.trim() && !r.staffEmail) unmatchedNames[r.staffName] = (unmatchedNames[r.staffName] || 0) + 1; });
      console.log("[SCHEDULER] Unmatched staff names (no email): " + JSON.stringify(unmatchedNames));
    }
    if (result.length > 0) {
      console.log("[SCHEDULER] Sample: " + result[0].staffName + " | email: " + result[0].staffEmail);
    }
    res.json(result);
  }).catch(function(e) {
    console.error("Scheduler error:", e.message);
    res.json([]);
  });
});


// ═══════════════════════════════════════════════════════════
//  GET /api/scheduling/people — Clients + Staff for scheduler
// ═══════════════════════════════════════════════════════════
router.get('/people', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ clients: [], staff: [] });

  // Fetch SIL Properties for property name/address lookup
  var silPropsPromise = airtable.fetchAllFromTableView("SIL Properties", "Grid view").then(function(records) {
    return (records || []).map(function(r) {
      var f = r.fields || {};
      return {
        id: r.id,
        name: f["Name"] || "",
        address: f["Address"] || "",
        suburb: f["Suburb"] || "",
        status: f["Active or Inactive?"] || ""
      };
    });
  }).catch(function(e) { console.error("Scheduler SIL properties error:", e.message); return []; });

  var clientsPromise = silPropsPromise.then(function(silProps) {
    // Build record ID -> property lookup
    var silLookup = {};
    silProps.forEach(function(p) { silLookup[p.id] = p; });

    return airtable.fetchAllFromTableView("Clients", "Client Active View").then(function(records) {
      var seenIds = {};
      var seenNames = {};
      var clients = (records || []).map(function(r) {
        var f = r.fields || {};
        var acctType = f["Account Type:  Active or Inactive or Propsect"] || "";
        if (acctType !== "Active" && acctType !== "Prospect") return null;
        var name = (f["Client Name"] || f["Full Name"] || f["Name"] || "").trim();
        if (!name || name === "Delta (Head Office)") return null;
        // Dedup by Airtable record ID
        if (seenIds[r.id]) return null;
        seenIds[r.id] = true;
        // Dedup by name (case-insensitive, trimmed)
        var nameKey = name.toLowerCase();
        if (seenNames[nameKey]) return null;
        seenNames[nameKey] = true;
        // Resolve linked SIL Home Address
        var silHomeRaw = f["SIL Home Address"];
        var silProperty = "";
        var silPropertyAddress = "";
        if (silHomeRaw) {
          var silId = Array.isArray(silHomeRaw) ? silHomeRaw[0] : silHomeRaw;
          if (silId && silLookup[silId]) {
            silProperty = silLookup[silId].name || "";
            silPropertyAddress = silLookup[silId].address || "";
          }
        }
        return {
          id: r.id,
          name: name,
          ndisNumber: f["NDIS Number"] || f["NDIS #"] || "",
          silOrCas: String(f["SIL or CAS?"] || f["Service Type"] || ""),
          silProperty: silProperty,
          silPropertyAddress: silPropertyAddress,
          accountType: acctType
        };
      }).filter(function(c) { return c; });
      // Hard dedup by record ID
      var dedupMap = {};
      clients.forEach(function(c) { if (!dedupMap[c.id]) dedupMap[c.id] = c; });
      clients = Object.keys(dedupMap).map(function(k) { return dedupMap[k]; });
      clients.sort(function(a, b) { return a.name.localeCompare(b.name); });
      return { clients: clients, silProperties: silProps };
    });
  }).catch(function(e) { console.error("Scheduler clients error:", e.message); return { clients: [], silProperties: [] }; });

  // Map an All Contacts record to a staff object (only Employee or Independent Contractor)
  function mapContactToStaff(r) {
    var f = r.fields || {};
    var ct = f["Type of Contact (Single Select)"] || f["Type of Contact"] || "";
    var ctL = ct.toLowerCase();
    if (ctL !== "employee" && ctL.indexOf("ndepend") < 0 && ctL.indexOf("contractor") < 0) return null;
    var firstName = f["First Name"] || "";
    var lastName = f["Last Name"] || "";
    var fullName = f["Full Name"] || f["Name"] || "";
    if (!fullName && (firstName || lastName)) fullName = (firstName + " " + lastName).trim();
    if (!fullName) return null;
    return {
      id: r.id,
      name: fullName,
      contactType: ct,
      email: f["Email"] || "",
      phone: f["Formatted Mobile"] || f["Mobile"] || ""
    };
  }

  // Fetch active employees + active contractors in parallel, then merge
  var employeesPromise = airtable.fetchAllFromTableView("All Contacts", "Active Contacts 2026").then(function(records) {
    return (records || []).map(mapContactToStaff).filter(function(s) { return s; });
  }).catch(function(e) { console.error("Scheduler employees error:", e.message); return []; });

  var contractorsPromise = airtable.fetchAllFromTableView("All Contacts", "Active Contractors").then(function(records) {
    return (records || []).map(mapContactToStaff).filter(function(s) { return s; });
  }).catch(function(e) { console.log("Active Contractors view not found -- skipping"); return []; });

  Promise.all([clientsPromise, employeesPromise, contractorsPromise]).then(function(results) {
    var clientData = results[0] || {};
    var clients = clientData.clients || [];
    var silProperties = (clientData.silProperties || []).filter(function(p) { return (p.status || "").indexOf("Active") >= 0; });
    // Merge employees + contractors, dedup by record ID
    var seen = {};
    var staff = [];
    results[1].concat(results[2]).forEach(function(s) {
      if (!seen[s.id]) { seen[s.id] = true; staff.push(s); }
    });
    staff.sort(function(a, b) { return a.name.localeCompare(b.name); });
    console.log("Scheduler people: " + clients.length + " clients, " + staff.length + " staff (" + results[1].length + " employees + " + results[2].length + " contractors), " + silProperties.length + " active SIL properties");
    res.json({ clients: clients, staff: staff, silProperties: silProperties });
  }).catch(function(e) {
    console.error("Scheduler people error:", e.message);
    res.json({ clients: [], staff: [], silProperties: [] });
  });
});


// ═══════════════════════════════════════════════════════════
//  GET /api/scheduling/budget-summary — Client budget + roster costs
// ═══════════════════════════════════════════════════════════
router.get('/budget-summary', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({});

  // Build client lookup (record ID -> name) from Clients + All Contacts
  airtable.fetchAllFromTable("Clients").then(function(clients) {
    var clientLookup = {};
    function av(v) { return Array.isArray(v) ? v[0] || "" : v || ""; }
    (clients || []).forEach(function(c) {
      var f = c.fields || {};
      var name = av(f["Client Name"]) || av(f["Full Name"]) || av(f["Name"]) || "";
      if (!name && f["First Name"]) name = ((f["First Name"] || "") + " " + (f["Last Name"] || "")).trim();
      if (name) clientLookup[c.id] = name;
    });
    return airtable.fetchAllFromTable("All Contacts").then(function(contacts) {
      (contacts || []).forEach(function(c) {
        if (clientLookup[c.id]) return;
        var f = c.fields || {};
        var name = av(f["Full Name"]) || av(f["Client Name"]) || av(f["Name"]) || "";
        if (!name && f["First Name"]) name = ((f["First Name"] || "") + " " + (f["Last Name"] || "")).trim();
        if (name) clientLookup[c.id] = name;
      });
      return clientLookup;
    }).catch(function() { return clientLookup; });
  }).then(function(clientLookup) {
    // Fetch Client Core Budgets AND Rosters in parallel
    var budgetPromise = airtable.fetchAllFromTable("Client Core Budgets");
    var rosterPromise = airtable.fetchAllFromTableView("Rosters 2025", "Grid View").catch(function() { return airtable.fetchAllFromTable("Rosters 2025"); });

    return Promise.all([budgetPromise, rosterPromise]).then(function(results) {
      var records = results[0];
      var rosters = results[1];
      var summary = {};
      function numVal(v) { return Array.isArray(v) ? parseFloat(v[0]) || 0 : parseFloat(v) || 0; }

      // Helper to resolve client name from raw field
      function resolveCN(cnRaw) {
        if (Array.isArray(cnRaw) && cnRaw.length > 0) {
          return cnRaw.map(function(id) { return clientLookup[id] || id; }).join(", ");
        } else if (typeof cnRaw === "string" && cnRaw.startsWith("rec")) {
          return clientLookup[cnRaw] || cnRaw;
        }
        return cnRaw || "";
      }

      (records || []).forEach(function(r) {
        var f = r.fields || {};
        var cn = resolveCN(f["Client Name"] || f["Client"] || "");
        if (!cn) return;

        if (!summary[cn]) {
          summary[cn] = { coreBudgetSIL: 0, coreBudgetCA: 0, coreBudgetTransport: 0, totalBudget: 0, invoiceAmount: 0, remaining: 0, pctUsed: 0, scheduledCost: 0, rosteredHours: 0, shiftCount: 0, pctScheduled: 0 };
        }
        summary[cn].coreBudgetSIL += numVal(f["Core Budget (SIL) (from Client Name)"] || f["Core Budget (SIL)"] || 0);
        summary[cn].coreBudgetCA += numVal(f["Core Budget (Community Access) (from Client Name)"] || f["Core Budget (Community Access)"] || 0);
        summary[cn].coreBudgetTransport += numVal(f["Core Budget (Transport) (from Client Name)"] || f["Core Budget (Transport)"] || 0);
        summary[cn].totalBudget += numVal(f["Total Budget"] || 0);
        summary[cn].invoiceAmount += numVal(f["Invoice Amount"] || 0);
      });

      // Aggregate roster shift costs per client
      (rosters || []).forEach(function(r) {
        var f = r.fields || {};
        var cn = resolveCN(f["Client Name"] || f["Client Full Name"] || f["Client"] || "");
        if (!cn) return;
        var hours = parseFloat(f["Total Hours (Decimal)"]) || 0;
        var charge = parseFloat(f["Charge per hour"]) || 0;
        if (!summary[cn]) {
          summary[cn] = { coreBudgetSIL: 0, coreBudgetCA: 0, coreBudgetTransport: 0, totalBudget: 0, invoiceAmount: 0, remaining: 0, pctUsed: 0, scheduledCost: 0, rosteredHours: 0, shiftCount: 0, pctScheduled: 0 };
        }
        summary[cn].rosteredHours += hours;
        summary[cn].scheduledCost += hours * charge;
        summary[cn].shiftCount += 1;
      });

      // Calculate remaining, pctUsed, pctScheduled
      Object.keys(summary).forEach(function(cn) {
        var s = summary[cn];
        s.scheduledCost = Math.round(s.scheduledCost * 100) / 100;
        s.rosteredHours = Math.round(s.rosteredHours * 100) / 100;
        s.remaining = s.totalBudget - s.invoiceAmount;
        s.pctUsed = s.totalBudget > 0 ? Math.round((s.invoiceAmount / s.totalBudget) * 100) : 0;
        s.pctScheduled = s.totalBudget > 0 ? Math.round((s.scheduledCost / s.totalBudget) * 100) : 0;
      });
      console.log("Scheduler budget summary: " + Object.keys(summary).length + " clients (with roster costs)");
      res.json(summary);
    });
  }).catch(function(e) {
    console.error("Scheduler budget summary error:", e.message);
    res.json({});
  });
});


// ═══════════════════════════════════════════════════════════
//  POST /api/scheduling/shift — Create a single shift
// ═══════════════════════════════════════════════════════════
router.post('/shift', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var b = req.body || {};
  if (!b.clientName && !b.staffName && !b.startShift) {
    return res.status(400).json({ error: "At least clientName, staffName, or startShift is required" });
  }
  var fields = {};
  if (b.clientName) fields["Client Name (Text)"] = b.clientName;
  if (b.staffName)  fields["Staff Name (Text)"]  = b.staffName;
  if (b.staffEmail) fields["Staff Email (Text)"] = b.staffEmail;
  if (b.startShift) fields["Start Shift"]  = b.startShift;
  if (b.endShift)   fields["End Shift"]    = b.endShift;
  if (b.sleepover)  fields["Sleepover"]    = true;

  console.log("[SCHEDULER] Creating shift:", JSON.stringify(fields));
  airtable.rawFetch("Rosters 2025", "POST", "", { records: [{ fields: fields }] })
    .then(function(data) {
      if (data && data.error) {
        console.error("[SCHEDULER] Create error:", JSON.stringify(data.error));
        return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
      }
      var rec = (data.records && data.records[0]) ? data.records[0] : null;
      if (!rec) return res.status(400).json({ error: "No record returned" });
      console.log("[SCHEDULER] Created shift:", rec.id);
      logAudit(req.user, "create_shift", "Roster", rec.id, (b.clientName || "") + " -> " + (b.staffName || "Vacant"), "Created", "", b.startShift);
      res.json({ success: true, id: rec.id, airtableId: rec.id, fields: rec.fields });
    })
    .catch(function(e) {
      console.error("[SCHEDULER] Create exception:", e.message);
      res.status(500).json({ error: e.message });
    });
});


// ═══════════════════════════════════════════════════════════
//  PATCH /api/scheduling/shift/:id — Update a single shift
// ═══════════════════════════════════════════════════════════
router.patch('/shift/:id', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var id = req.params.id;
  var b = req.body || {};
  var fields = {};
  if (b.clientName !== undefined) fields["Client Name (Text)"] = b.clientName;
  if (b.staffName !== undefined)  fields["Staff Name (Text)"]  = b.staffName;
  if (b.staffEmail !== undefined) fields["Staff Email (Text)"] = b.staffEmail;
  if (b.startShift !== undefined) fields["Start Shift"]  = b.startShift;
  if (b.endShift !== undefined)   fields["End Shift"]    = b.endShift;
  if (b.sleepover !== undefined)  fields["Sleepover"]    = b.sleepover ? true : false;

  if (Object.keys(fields).length === 0) return res.json({ success: true });

  console.log("[SCHEDULER] Updating shift " + id + ":", JSON.stringify(Object.keys(fields)));
  airtable.rawFetch("Rosters 2025", "PATCH", "/" + id, { fields: fields })
    .then(function(data) {
      if (data && data.error) {
        console.error("[SCHEDULER] Update error:", JSON.stringify(data.error));
        return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
      }
      console.log("[SCHEDULER] Updated shift:", id);
      logAudit(req.user, "update_shift", "Roster", id, (b.clientName || "") + " -> " + (b.staffName || ""), Object.keys(fields).join(", "), "", "");
      res.json({ success: true, fields: data.fields || {} });
    })
    .catch(function(e) {
      console.error("[SCHEDULER] Update exception:", e.message);
      res.status(500).json({ error: e.message });
    });
});


// ═══════════════════════════════════════════════════════════
//  DELETE /api/scheduling/shift/:id — Delete a single shift
// ═══════════════════════════════════════════════════════════
router.delete('/shift/:id', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var id = req.params.id;
  console.log("[SCHEDULER] Deleting shift:", id);
  airtable.rawFetch("Rosters 2025", "DELETE", "/" + id)
    .then(function(data) {
      if (data && data.error) {
        console.error("[SCHEDULER] Delete error:", JSON.stringify(data.error));
        return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
      }
      console.log("[SCHEDULER] Deleted shift:", id);
      logAudit(req.user, "delete_shift", "Roster", id, "", "Deleted", id, "");
      res.json({ success: true });
    })
    .catch(function(e) {
      console.error("[SCHEDULER] Delete exception:", e.message);
      res.status(500).json({ error: e.message });
    });
});


// ═══════════════════════════════════════════════════════════
//  GET /api/scheduling/unmatched — Unmatched ShiftCare staff names
// ═══════════════════════════════════════════════════════════
router.get('/unmatched', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: "Airtable not configured" });
  Promise.all([
    airtable.fetchAllFromTable("Rosters 2025").catch(function() { return []; }),
    airtable.fetchAllFromTable("All Contacts").catch(function() { return []; })
  ]).then(function(results) {
    var records = results[0] || [];
    var contacts = results[1] || [];
    var lookups = buildContactLookups(contacts);
    var nameToEmail = lookups.nameToEmail;

    var unmatched = {};
    records.forEach(function(r) {
      var sn = (r.fields || {})["Staff Name (Text)"] || "";
      if (!sn) return;
      var key = sn.toLowerCase().trim();
      if (!nameToEmail[key]) unmatched[sn] = (unmatched[sn] || 0) + 1;
    });
    var contactNames = contacts.map(function(c) {
      var cf = c.fields || {};
      return cf["Full Name"] || cf["Name"] || ((cf["First Name"] || "") + " " + (cf["Last Name"] || "")).trim();
    }).filter(function(n) { return n; }).sort();
    res.json({ unmatched: unmatched, totalRosters: records.length, contactNames: contactNames });
  }).catch(function(e) { res.status(500).json({ error: e.message }); });
});


// ═══════════════════════════════════════════════════════════
//  POST /api/scheduling/import — ShiftCare CSV bulk import
// ═══════════════════════════════════════════════════════════
router.post('/import', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ created: 0, error: "Airtable not configured" });
  var shifts = req.body.shifts;
  if (!shifts || !Array.isArray(shifts) || shifts.length === 0) return res.json({ created: 0 });
  console.log("[IMPORT] Received " + shifts.length + " shifts -- checking for duplicates...");

  // Step 1: Fetch existing Unique Ref #s for deduplication
  var existingPromise = airtable.fetchAllFromTable("Rosters 2025", "NOT({Unique Ref #} = '')").catch(function() { return []; });

  existingPromise.then(function(existingRecs) {

    // Step 2: Deduplication
    var existingIds = {};
    existingRecs.forEach(function(r) {
      var uid = (r.fields || {})["Unique Ref #"];
      if (uid) existingIds[String(uid).trim()] = true;
    });
    var beforeDedup = shifts.length;
    var toImport = shifts.filter(function(s) {
      if (!s.shiftId) return true;
      return !existingIds[String(s.shiftId).trim()];
    });
    var skippedDups = beforeDedup - toImport.length;
    if (skippedDups > 0) console.log("[IMPORT] Skipping " + skippedDups + " duplicates");
    if (toImport.length === 0) return res.json({ created: 0, total: beforeDedup, skipped: skippedDups, message: "All shifts already imported -- no duplicates created." });

    // Step 3: Build name->email lookup from All Contacts
    airtable.fetchAllFromTable("All Contacts").catch(function() { return []; }).then(function(contacts) {
      var lookups = buildContactLookups(contacts);
      var nameToEmail = lookups.nameToEmail;

      console.log("[IMPORT] Name->Email lookup: " + Object.keys(nameToEmail).length + " entries (contacts + aliases)");

      // Resolve staff email for each shift and log unmatched names
      var unmatched = {};
      toImport.forEach(function(s) {
        if (s.staffName && !s.staffEmail) {
          var key = s.staffName.toLowerCase().trim();
          if (nameToEmail[key]) {
            s.staffEmail = nameToEmail[key];
          } else {
            unmatched[s.staffName] = (unmatched[s.staffName] || 0) + 1;
          }
        }
      });
      var matchedCount = toImport.filter(function(s) { return s.staffEmail; }).length;
      console.log("[IMPORT] Staff email resolved: " + matchedCount + "/" + toImport.length + " shifts");
      if (Object.keys(unmatched).length > 0) console.log("[IMPORT] Unmatched staff names: " + JSON.stringify(unmatched));

      // Step 4: Build Airtable records with plain text fields
      var batches = [];
      for (var i = 0; i < toImport.length; i += 10) batches.push(toImport.slice(i, i + 10));

      var created = 0;
      var errors = [];

      function processBatch(idx) {
        if (idx >= batches.length) {
          console.log("[IMPORT] Complete: " + created + " created, " + errors.length + " batch errors, " + skippedDups + " duplicates skipped");
          var firstErrDetail = errors.length > 0 ? (typeof errors[0].error === "string" ? errors[0].error : JSON.stringify(errors[0].error)) : null;
          return res.json({ created: created, total: beforeDedup, skipped: skippedDups, errors: errors.length > 0 ? errors : undefined, firstError: firstErrDetail });
        }

        var batch = batches[idx];
        var records = batch.map(function(s) {
          var fields = {};
          if (s.clientName) fields["Client Name (Text)"] = s.clientName;
          if (s.staffName)  fields["Staff Name (Text)"]  = s.staffName;
          if (s.staffEmail) fields["Staff Email (Text)"] = s.staffEmail;
          if (s.startShift) fields["Start Shift"]  = s.startShift;
          if (s.endShift)   fields["End Shift"]    = s.endShift;
          return { fields: fields };
        });

        airtable.rawFetch("Rosters 2025", "POST", "", { records: records })
          .then(function(data) {
            if (data && data.error) {
              console.error("[IMPORT] Batch " + idx + " error:", JSON.stringify(data.error));
              errors.push({ batch: idx, error: data.error.message || JSON.stringify(data.error) });
            } else {
              var count = (data.records || []).length;
              created += count;
              console.log("[IMPORT] Batch " + idx + ": " + count + " created (running total: " + created + ")");
            }
            processBatch(idx + 1);
          })
          .catch(function(e) {
            console.error("[IMPORT] Batch " + idx + " fetch error:", e.message);
            errors.push({ batch: idx, error: e.message });
            processBatch(idx + 1);
          });
      }

      processBatch(0);

    }); // end fetchAllFromTable("All Contacts").then

  }).catch(function(e) {
    console.error("[IMPORT] Lookup phase failed:", e.message);
    res.json({ created: 0, total: shifts.length, error: "Lookup failed: " + e.message });
  });
});


// ═══════════════════════════════════════════════════════════
//  DELETE /api/scheduling/clear-imported — Delete roster records with blank Shift Status
// ═══════════════════════════════════════════════════════════
router.delete('/clear-imported', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ deleted: 0, error: "Airtable not configured" });
  console.log("[CLEAR] Fetching roster records with blank Shift Status...");

  airtable.fetchAllFromTable("Rosters 2025").then(function(records) {
    var toClear = (records || []).filter(function(r) {
      var status = (r.fields || {})["Shift Status"];
      return !status || (typeof status === "string" && status.trim() === "");
    });
    console.log("[CLEAR] Found " + toClear.length + " records with blank Shift Status out of " + (records || []).length + " total");
    if (toClear.length === 0) return res.json({ deleted: 0, message: "No records with blank Shift Status found." });

    var ids = toClear.map(function(r) { return r.id; });
    var batches = [];
    for (var i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10));

    var deleted = 0;
    var errors = [];

    function deleteBatch(idx) {
      if (idx >= batches.length) {
        console.log("[CLEAR] Complete: " + deleted + " deleted, " + errors.length + " errors");
        return res.json({ deleted: deleted, total: toClear.length, errors: errors.length > 0 ? errors : undefined });
      }
      var batch = batches[idx];
      var qs = batch.map(function(id) { return "records[]=" + encodeURIComponent(id); }).join("&");
      airtable.rawFetch("Rosters 2025", "DELETE", "?" + qs).then(function(data) {
        if (data && data.error) {
          console.error("[CLEAR] Batch " + idx + " error:", JSON.stringify(data.error));
          errors.push({ batch: idx, error: data.error.message || JSON.stringify(data.error) });
        } else {
          var count = (data.records || []).length;
          deleted += count;
          console.log("[CLEAR] Batch " + idx + ": " + count + " deleted (running total: " + deleted + ")");
        }
        deleteBatch(idx + 1);
      }).catch(function(e) {
        console.error("[CLEAR] Batch " + idx + " fetch error:", e.message);
        errors.push({ batch: idx, error: e.message });
        deleteBatch(idx + 1);
      });
    }

    deleteBatch(0);
  }).catch(function(e) {
    console.error("[CLEAR] Fetch failed:", e.message);
    res.json({ deleted: 0, error: "Failed to fetch records: " + e.message });
  });
});


// ═══════════════════════════════════════════════════════════
//  GET /api/scheduling/diagnose — Inspect Rosters 2025 field names
// ═══════════════════════════════════════════════════════════
router.get('/diagnose', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: "Airtable not configured" });
  airtable.rawFetch("Rosters 2025", "GET", "?pageSize=1").then(function(data) {
    if (data.error) return res.json({ error: data.error });
    var fields = data.records && data.records[0] ? Object.keys(data.records[0].fields) : [];
    var sampleValues = data.records && data.records[0] ? data.records[0].fields : {};
    var fieldInfo = fields.map(function(k) {
      var v = sampleValues[k];
      var type = Array.isArray(v) ? "array[" + typeof v[0] + "]" : typeof v;
      var linkedLook = Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && /^rec[A-Za-z0-9]{10,}/.test(v[0]);
      return { field: k, type: type, isLinked: linkedLook, sample: Array.isArray(v) ? v.slice(0,2) : String(v).substring(0,50) };
    });
    res.json({ tableExists: true, recordCount: (data.records||[]).length, fields: fieldInfo });
  }).catch(function(e) { res.json({ error: e.message }); });
});


// ═══════════════════════════════════════════════════════════
//  POST /api/scheduling/draft-bulk — Bulk create draft shifts
// ═══════════════════════════════════════════════════════════
router.post('/draft-bulk', function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ created: 0 });
  var shifts = req.body.shifts;
  if (!shifts || !Array.isArray(shifts) || shifts.length === 0) return res.json({ created: 0 });

  var batches = [];
  for (var i = 0; i < shifts.length; i += 10) batches.push(shifts.slice(i, i + 10));

  var created = 0;
  var errors = [];

  function processBatch(idx) {
    if (idx >= batches.length) {
      console.log("Draft shifts created:", created, "errors:", errors.length);
      return res.json({ created: created, errors: errors.length > 0 ? errors : undefined });
    }
    var batch = batches[idx];
    var records = batch.map(function(s) {
      return {
        fields: {
          "Client Name":  s["Client Name"]  || "",
          "Staff Name":   s["Staff Name"]   || "",
          "Start Shift":  s["Start Shift"]  || "",
          "End Shift":    s["End Shift"]    || "",
          "Status":       s["Status"]       || "Draft",
          "Shift Type":   s["Shift Type"]   || "",
          "Notes":        s["Notes"]        || "",
          "Agreement ID": s["Agreement ID"] || ""
        }
      };
    });

    airtable.rawFetch("Rosters 2025", "POST", "", { records: records })
      .then(function(data) {
        if (data.error) { errors.push(data.error); }
        else { created += (data.records || []).length; }
        processBatch(idx + 1);
      })
      .catch(function(e) {
        errors.push(e.message);
        processBatch(idx + 1);
      });
  }

  processBatch(0);
});


// ═══════════════════════════════════════════════════════════════
// ═══ ROSTER OF CARE (RoC) MODULE ═════════════════════════════
// ═══════════════════════════════════════════════════════════════

// 1. GET /api/scheduling/roc/rates — Return all rate data
router.get('/roc/rates', function(req, res) {
  res.json({
    lineItems: rocRates.ROC_LINE_ITEMS,
    loadings: rocRates.SCHADS_LOADINGS,
    holidays: rocRates.QLD_PUBLIC_HOLIDAYS_2025_26
  });
});

// 2. GET /api/scheduling/roc/participants — Fetch all RoC Participants
router.get('/roc/participants', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var allRecords = [];
  var fetchPage = function(offset) {
    var params = "?pageSize=100";
    if (offset) params += "&offset=" + offset;
    airtable.rawFetch("RoC Participants", "GET", params).then(function(data) {
      if (data.error) { console.error("RoC Participants error:", data.error); return res.json([]); }
      var records = (data.records || []).map(function(rec) {
        var f = rec.fields || {};
        return {
          id: rec.id,
          clientName: f["Client Name"] || "",
          ndisNumber: f["NDIS Number"] || "",
          planStartDate: f["Plan Start Date"] || "",
          planEndDate: f["Plan End Date"] || "",
          silBudget: f["SIL Budget"] || 0,
          communityAccessBudget: f["Community Access Budget"] || 0,
          transportBudget: f["Transport Budget"] || 0,
          silProperty: f["SIL Property"] || "",
          supportRatio: f["Support Ratio"] || "1:1",
          notes: f["Notes"] || ""
        };
      });
      allRecords = allRecords.concat(records);
      if (data.offset) {
        fetchPage(data.offset);
      } else {
        allRecords.sort(function(a, b) { return (a.clientName || "").localeCompare(b.clientName || ""); });
        res.json(allRecords);
      }
    }).catch(function(err) { console.error("RoC Participants error:", err); res.json(allRecords); });
  };
  fetchPage(null);
});

// 3. POST /api/scheduling/roc/participants — Create participant
router.post('/roc/participants', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var b = req.body;
  if (!b.clientName) return res.status(400).json({ error: "Client Name is required" });
  var fields = {
    "Client Name": b.clientName,
    "NDIS Number": b.ndisNumber || "",
    "Plan Start Date": b.planStartDate || null,
    "Plan End Date": b.planEndDate || null,
    "SIL Budget": b.silBudget || 0,
    "Community Access Budget": b.communityAccessBudget || 0,
    "Transport Budget": b.transportBudget || 0,
    "SIL Property": b.silProperty || "",
    "Support Ratio": b.supportRatio || "1:1",
    "Notes": b.notes || ""
  };
  airtable.rawFetch("RoC Participants", "POST", "", { records: [{ fields: fields }] }).then(function(data) {
    if (data.error) { console.error("Create RoC Participant error:", data.error); return res.status(500).json({ error: data.error.message || "Failed to create" }); }
    var rec = (data.records && data.records[0]) || {};
    var f = rec.fields || {};
    res.json({ success: true, id: rec.id, participant: { id: rec.id, clientName: f["Client Name"] || b.clientName, ndisNumber: f["NDIS Number"] || "", planStartDate: f["Plan Start Date"] || "", planEndDate: f["Plan End Date"] || "", silBudget: f["SIL Budget"] || 0, communityAccessBudget: f["Community Access Budget"] || 0, transportBudget: f["Transport Budget"] || 0, silProperty: f["SIL Property"] || "", supportRatio: f["Support Ratio"] || "1:1", notes: f["Notes"] || "" } });
  }).catch(function(err) { console.error("Create RoC Participant error:", err); res.status(500).json({ error: "Failed to create participant" }); });
});

// 4. PATCH /api/scheduling/roc/participants/:id — Update participant
router.patch('/roc/participants/:id', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var recordId = req.params.id;
  var b = req.body;
  var fields = {};
  if (b.clientName !== undefined) fields["Client Name"] = b.clientName;
  if (b.ndisNumber !== undefined) fields["NDIS Number"] = b.ndisNumber;
  if (b.planStartDate !== undefined) fields["Plan Start Date"] = b.planStartDate || null;
  if (b.planEndDate !== undefined) fields["Plan End Date"] = b.planEndDate || null;
  if (b.silBudget !== undefined) fields["SIL Budget"] = b.silBudget;
  if (b.communityAccessBudget !== undefined) fields["Community Access Budget"] = b.communityAccessBudget;
  if (b.transportBudget !== undefined) fields["Transport Budget"] = b.transportBudget;
  if (b.silProperty !== undefined) fields["SIL Property"] = b.silProperty;
  if (b.supportRatio !== undefined) fields["Support Ratio"] = b.supportRatio;
  if (b.notes !== undefined) fields["Notes"] = b.notes;
  airtable.rawFetch("RoC Participants", "PATCH", "/" + recordId, { fields: fields }).then(function(data) {
    if (data.error) { console.error("Update RoC Participant error:", data.error); return res.status(500).json({ error: data.error.message || "Failed to update" }); }
    res.json({ success: true });
  }).catch(function(err) { console.error("Update RoC Participant error:", err); res.status(500).json({ error: "Failed to update participant" }); });
});

// 5. DELETE /api/scheduling/roc/participants/:id — Delete participant
router.delete('/roc/participants/:id', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var recordId = req.params.id;
  airtable.rawFetch("RoC Participants", "DELETE", "/" + recordId).then(function(data) {
    if (data.error) { console.error("Delete RoC Participant error:", data.error); return res.status(500).json({ error: data.error.message || "Failed to delete" }); }
    res.json({ success: true });
  }).catch(function(err) { console.error("Delete RoC Participant error:", err); res.status(500).json({ error: "Failed to delete participant" }); });
});

// 6. GET /api/scheduling/roc/shifts — Fetch shifts (with optional filters)
router.get('/roc/shifts', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json([]);
  var formulaParts = [];
  if (req.query.participantName) {
    formulaParts.push("{Participant Name}='" + req.query.participantName.replace(/'/g, "\\'") + "'");
  }
  if (req.query.weekStart) {
    formulaParts.push("{Week Start}='" + req.query.weekStart.replace(/'/g, "\\'") + "'");
  }
  var allRecords = [];
  var fetchPage = function(offset) {
    var params = "?pageSize=100";
    if (formulaParts.length > 0) {
      var formula = formulaParts.length === 1 ? formulaParts[0] : "AND(" + formulaParts.join(",") + ")";
      params += "&filterByFormula=" + encodeURIComponent(formula);
    }
    params += "&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=asc";
    if (offset) params += "&offset=" + offset;
    airtable.rawFetch("RoC Shifts", "GET", params).then(function(data) {
      if (data.error) { console.error("RoC Shifts error:", data.error); return res.json([]); }
      var records = (data.records || []).map(function(rec) {
        var f = rec.fields || {};
        return {
          id: rec.id,
          participantId: "",
          participantName: f["Participant Name"] || "",
          dayOfWeek: f["Day of Week"] || "",
          date: f["Date"] || "",
          startTime: f["Start Time"] || "",
          endTime: f["End Time"] || "",
          hours: f["Hours"] || 0,
          lineItemCode: f["Line Item Code"] || "",
          dayType: f["Day Type"] || "",
          timeOfDay: f["Time of Day"] || "",
          supportRatio: f["Support Ratio"] || "1:1",
          calculatedCost: f["Calculated Cost"] || 0,
          staffName: f["Staff Name"] || "",
          notes: f["Notes"] || "",
          weekStart: f["Week Start"] || "",
          schadsFlags: f["SCHADS Flags"] || ""
        };
      });
      allRecords = allRecords.concat(records);
      if (data.offset) {
        fetchPage(data.offset);
      } else {
        res.json(allRecords);
      }
    }).catch(function(err) { console.error("RoC Shifts error:", err); res.json(allRecords); });
  };
  fetchPage(null);
});

// 7. POST /api/scheduling/roc/shifts — Create shift
router.post('/roc/shifts', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var b = req.body;
  if (!b.participantName || !b.date || !b.startTime || !b.endTime) return res.status(400).json({ error: "Participant, date, start time, and end time are required" });

  // Calculate hours
  var startParts = b.startTime.split(":").map(Number);
  var endParts = b.endTime.split(":").map(Number);
  var startMin = startParts[0] * 60 + (startParts[1] || 0);
  var endMin = endParts[0] * 60 + (endParts[1] || 0);
  if (endMin <= startMin) endMin += 1440; // next day
  var hours = Math.round(((endMin - startMin) / 60) * 100) / 100;

  // Determine day/time types
  var dayType = rocRates.getDayType(b.date, rocRates.QLD_PUBLIC_HOLIDAYS_2025_26);
  var timeOfDay = rocRates.getTimeOfDay(startParts[0], endParts[0]);
  var dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(b.date + "T00:00:00").getDay()];

  // Calculate cost
  var ratio = 1;
  if (b.supportRatio) {
    var ratioParts = b.supportRatio.split(":");
    ratio = parseInt(ratioParts[1]) || 1;
  }
  var lineItem = rocRates.ROC_LINE_ITEMS.find(function(li) { return li.code === b.lineItemCode; });
  var cost = rocRates.calculateShiftCost(lineItem, dayType, timeOfDay, hours, ratio);

  // SCHADS flags
  var flags = [];
  if (hours < 2) flags.push("SHORT_SHIFT");
  if (hours > 10) flags.push("MAX_HOURS_DAY");

  // Calculate weekStart (Monday of that week)
  var dateObj = new Date(b.date + "T00:00:00");
  var dayIdx = dateObj.getDay();
  var mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
  var monday = new Date(dateObj);
  monday.setDate(monday.getDate() + mondayOffset);
  var weekStart = monday.toISOString().split("T")[0];

  var fields = {
    "Participant Name": b.participantName,
    "Day of Week": dayOfWeek,
    "Date": b.date,
    "Start Time": b.startTime,
    "End Time": b.endTime,
    "Hours": hours,
    "Line Item Code": b.lineItemCode || "",
    "Day Type": dayType,
    "Time of Day": timeOfDay,
    "Support Ratio": b.supportRatio || "1:1",
    "Calculated Cost": cost,
    "Staff Name": b.staffName || "",
    "Notes": b.notes || "",
    "Week Start": weekStart,
    "SCHADS Flags": flags.join(", ")
  };

  airtable.rawFetch("RoC Shifts", "POST", "", { records: [{ fields: fields }] }).then(function(data) {
    if (data.error) { console.error("Create RoC Shift error:", data.error); return res.status(500).json({ error: data.error.message || "Failed to create shift" }); }
    var rec = (data.records && data.records[0]) || {};
    res.json({ success: true, id: rec.id, shift: { id: rec.id, participantId: b.participantId || "", participantName: b.participantName, dayOfWeek: dayOfWeek, date: b.date, startTime: b.startTime, endTime: b.endTime, hours: hours, lineItemCode: b.lineItemCode || "", dayType: dayType, timeOfDay: timeOfDay, supportRatio: b.supportRatio || "1:1", calculatedCost: cost, staffName: b.staffName || "", notes: b.notes || "", weekStart: weekStart, schadsFlags: flags.join(", ") } });
  }).catch(function(err) { console.error("Create RoC Shift error:", err); res.status(500).json({ error: "Failed to create shift" }); });
});

// 8. PATCH /api/scheduling/roc/shifts/:id — Update shift
router.patch('/roc/shifts/:id', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var recordId = req.params.id;
  var b = req.body;
  var fields = {};
  if (b.participantName !== undefined) fields["Participant Name"] = b.participantName;
  if (b.date !== undefined) fields["Date"] = b.date;
  if (b.startTime !== undefined) fields["Start Time"] = b.startTime;
  if (b.endTime !== undefined) fields["End Time"] = b.endTime;
  if (b.lineItemCode !== undefined) fields["Line Item Code"] = b.lineItemCode;
  if (b.staffName !== undefined) fields["Staff Name"] = b.staffName;
  if (b.notes !== undefined) fields["Notes"] = b.notes;
  if (b.supportRatio !== undefined) fields["Support Ratio"] = b.supportRatio;

  // Recalculate if time/date changed
  if (b.date && b.startTime && b.endTime) {
    var startParts = b.startTime.split(":").map(Number);
    var endParts = b.endTime.split(":").map(Number);
    var startMin = startParts[0] * 60 + (startParts[1] || 0);
    var endMin = endParts[0] * 60 + (endParts[1] || 0);
    if (endMin <= startMin) endMin += 1440;
    var hours = Math.round(((endMin - startMin) / 60) * 100) / 100;
    var dayType = rocRates.getDayType(b.date, rocRates.QLD_PUBLIC_HOLIDAYS_2025_26);
    var timeOfDay = rocRates.getTimeOfDay(startParts[0], endParts[0]);
    var dayOfWeek = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(b.date + "T00:00:00").getDay()];
    var ratio = 1;
    if (b.supportRatio) { var rp = b.supportRatio.split(":"); ratio = parseInt(rp[1]) || 1; }
    var lineItem = b.lineItemCode ? rocRates.ROC_LINE_ITEMS.find(function(li) { return li.code === b.lineItemCode; }) : null;
    var cost = lineItem ? rocRates.calculateShiftCost(lineItem, dayType, timeOfDay, hours, ratio) : 0;
    var flags = [];
    if (hours < 2) flags.push("SHORT_SHIFT");
    if (hours > 10) flags.push("MAX_HOURS_DAY");
    fields["Hours"] = hours;
    fields["Day Type"] = dayType;
    fields["Time of Day"] = timeOfDay;
    fields["Day of Week"] = dayOfWeek;
    fields["Calculated Cost"] = cost;
    fields["SCHADS Flags"] = flags.join(", ");
    var dateObj = new Date(b.date + "T00:00:00");
    var dayIdx = dateObj.getDay();
    var mondayOffset = dayIdx === 0 ? -6 : 1 - dayIdx;
    var monday = new Date(dateObj);
    monday.setDate(monday.getDate() + mondayOffset);
    fields["Week Start"] = monday.toISOString().split("T")[0];
  }

  airtable.rawFetch("RoC Shifts", "PATCH", "/" + recordId, { fields: fields }).then(function(data) {
    if (data.error) { console.error("Update RoC Shift error:", data.error); return res.status(500).json({ error: data.error.message || "Failed to update" }); }
    res.json({ success: true });
  }).catch(function(err) { console.error("Update RoC Shift error:", err); res.status(500).json({ error: "Failed to update shift" }); });
});

// 9. DELETE /api/scheduling/roc/shifts/:id — Delete shift
router.delete('/roc/shifts/:id', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var recordId = req.params.id;
  airtable.rawFetch("RoC Shifts", "DELETE", "/" + recordId).then(function(data) {
    if (data.error) { console.error("Delete RoC Shift error:", data.error); return res.status(500).json({ error: data.error.message || "Failed to delete" }); }
    res.json({ success: true });
  }).catch(function(err) { console.error("Delete RoC Shift error:", err); res.status(500).json({ error: "Failed to delete shift" }); });
});

// 10. POST /api/scheduling/roc/calculate — Calculate costs and SCHADS compliance
router.post('/roc/calculate', rocAuth, function(req, res) {
  var shifts = req.body.shifts || [];
  if (!Array.isArray(shifts) || shifts.length === 0) return res.json({ shifts: [], totals: { sil: 0, communityAccess: 0, transport: 0, grand: 0 }, flags: [] });

  var totals = { sil: 0, communityAccess: 0, transport: 0, grand: 0 };
  var allFlags = [];
  var staffDayHours = {};
  var staffWeekHours = {};
  var staffShiftsByDay = {};

  var calculated = shifts.map(function(s) {
    var dayType = rocRates.getDayType(s.date, rocRates.QLD_PUBLIC_HOLIDAYS_2025_26);
    var startH = s.startTime ? parseInt(s.startTime.split(":")[0]) : 8;
    var endH = s.endTime ? parseInt(s.endTime.split(":")[0]) : 16;
    var timeOfDay = rocRates.getTimeOfDay(startH, endH);
    var lineItem = rocRates.ROC_LINE_ITEMS.find(function(li) { return li.code === s.lineItemCode; });

    var ratio = 1;
    if (s.supportRatio) { var rp = s.supportRatio.split(":"); ratio = parseInt(rp[1]) || 1; }

    var hours = s.hours || 0;
    if (!hours && s.startTime && s.endTime) {
      var sp = s.startTime.split(":").map(Number);
      var ep = s.endTime.split(":").map(Number);
      var sm = sp[0] * 60 + (sp[1] || 0);
      var em = ep[0] * 60 + (ep[1] || 0);
      if (em <= sm) em += 1440;
      hours = Math.round(((em - sm) / 60) * 100) / 100;
    }

    var cost = lineItem ? rocRates.calculateShiftCost(lineItem, dayType, timeOfDay, hours, ratio) : 0;
    var shiftFlags = [];

    // SCHADS checks
    if (hours < 2 && hours > 0) shiftFlags.push("SHORT_SHIFT");

    // Track staff hours
    if (s.staffName) {
      var dayKey = s.staffName + "|" + s.date;
      staffDayHours[dayKey] = (staffDayHours[dayKey] || 0) + hours;
      if (staffDayHours[dayKey] > 10) shiftFlags.push("MAX_HOURS_DAY");

      var weekKey = s.staffName + "|" + (s.weekStart || "");
      staffWeekHours[weekKey] = (staffWeekHours[weekKey] || 0) + hours;

      if (!staffShiftsByDay[dayKey]) staffShiftsByDay[dayKey] = [];
      staffShiftsByDay[dayKey].push({ startTime: s.startTime, endTime: s.endTime, date: s.date });
    }

    // Overtime check
    if (hours > 7.6) shiftFlags.push("OVERTIME");

    // Categorize costs
    if (s.lineItemCode && s.lineItemCode.indexOf("01_") === 0) { totals.sil += cost; }
    else if (s.lineItemCode && s.lineItemCode.indexOf("04_") === 0) { totals.communityAccess += cost; }
    else if (s.lineItemCode && s.lineItemCode.indexOf("15_") === 0) { totals.transport += cost; }
    totals.grand += cost;

    if (shiftFlags.length > 0) allFlags.push({ shiftId: s.id || null, date: s.date, staffName: s.staffName || "", flags: shiftFlags });

    return {
      id: s.id || null,
      participantName: s.participantName || "",
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      hours: hours,
      lineItemCode: s.lineItemCode,
      dayType: dayType,
      timeOfDay: timeOfDay,
      calculatedCost: cost,
      staffName: s.staffName || "",
      schadsFlags: shiftFlags.join(", ")
    };
  });

  // Check weekly hours across all staff
  Object.keys(staffWeekHours).forEach(function(key) {
    if (staffWeekHours[key] > 38) {
      var parts = key.split("|");
      allFlags.push({ shiftId: null, date: null, staffName: parts[0], flags: ["MAX_HOURS_WEEK"] });
    }
  });

  // Check break between shifts
  Object.keys(staffShiftsByDay).forEach(function(dayKey) {
    var dayShifts = staffShiftsByDay[dayKey];
    if (dayShifts.length < 2) return;
    dayShifts.sort(function(a, b) { return (a.startTime || "").localeCompare(b.startTime || ""); });
    for (var i = 0; i < dayShifts.length - 1; i++) {
      var endParts = dayShifts[i].endTime.split(":").map(Number);
      var nextStartParts = dayShifts[i+1].startTime.split(":").map(Number);
      var endMin = endParts[0] * 60 + (endParts[1] || 0);
      var nextStartMin = nextStartParts[0] * 60 + (nextStartParts[1] || 0);
      var breakHours = (nextStartMin - endMin) / 60;
      if (breakHours < 10 && breakHours >= 0) {
        var staffName = dayKey.split("|")[0];
        allFlags.push({ shiftId: null, date: dayShifts[i].date, staffName: staffName, flags: ["INSUFFICIENT_BREAK"] });
      }
    }
  });

  totals.sil = Math.round(totals.sil * 100) / 100;
  totals.communityAccess = Math.round(totals.communityAccess * 100) / 100;
  totals.transport = Math.round(totals.transport * 100) / 100;
  totals.grand = Math.round(totals.grand * 100) / 100;

  res.json({ shifts: calculated, totals: totals, flags: allFlags });
});

// 11. POST /api/scheduling/roc/report — Generate full RoC report
router.post('/roc/report', rocAuth, function(req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.status(500).json({ error: "Airtable not configured" });
  var b = req.body;
  var dateFrom = b.dateFrom || "";
  var dateTo = b.dateTo || "";
  var participantIds = b.participantIds || [];

  // Fetch participants
  airtable.rawFetch("RoC Participants", "GET", "?pageSize=100").then(function(pData) {
    var participants = (pData.records || []).map(function(rec) {
      var f = rec.fields || {};
      return { id: rec.id, clientName: f["Client Name"] || "", ndisNumber: f["NDIS Number"] || "", planStartDate: f["Plan Start Date"] || "", planEndDate: f["Plan End Date"] || "", silBudget: f["SIL Budget"] || 0, communityAccessBudget: f["Community Access Budget"] || 0, transportBudget: f["Transport Budget"] || 0, supportRatio: f["Support Ratio"] || "1:1" };
    });

    if (participantIds.length > 0) {
      participants = participants.filter(function(p) { return participantIds.indexOf(p.id) >= 0; });
    }

    // Fetch shifts with date range
    var formulaParts = [];
    if (dateFrom) formulaParts.push("IS_AFTER({Date}, '" + dateFrom + "')");
    if (dateTo) formulaParts.push("IS_BEFORE({Date}, '" + dateTo + "')");
    var params = "?pageSize=100";
    if (formulaParts.length > 0) {
      params += "&filterByFormula=" + encodeURIComponent(formulaParts.length === 1 ? formulaParts[0] : "AND(" + formulaParts.join(",") + ")");
    }

    airtable.rawFetch("RoC Shifts", "GET", params).then(function(sData) {
      var shifts = (sData.records || []).map(function(rec) {
        var f = rec.fields || {};
        return { id: rec.id, participantId: "", participantName: f["Participant Name"] || "", date: f["Date"] || "", startTime: f["Start Time"] || "", endTime: f["End Time"] || "", hours: f["Hours"] || 0, lineItemCode: f["Line Item Code"] || "", dayType: f["Day Type"] || "", timeOfDay: f["Time of Day"] || "", calculatedCost: f["Calculated Cost"] || 0, staffName: f["Staff Name"] || "", weekStart: f["Week Start"] || "", schadsFlags: f["SCHADS Flags"] || "", supportRatio: f["Support Ratio"] || "1:1" };
      });

      if (participantIds.length > 0) {
        var filterNames = participants.map(function(p) { return p.clientName; });
        shifts = shifts.filter(function(s) { return filterNames.indexOf(s.participantName) >= 0; });
      }

      // Build per-participant summary
      var participantSummary = participants.map(function(p) {
        var pShifts = shifts.filter(function(s) { return s.participantId === p.id || s.participantName === p.clientName; });
        var silCost = 0, caCost = 0, transportCost = 0;
        pShifts.forEach(function(s) {
          if (s.lineItemCode && s.lineItemCode.indexOf("01_") === 0) silCost += s.calculatedCost;
          else if (s.lineItemCode && s.lineItemCode.indexOf("04_") === 0) caCost += s.calculatedCost;
          else if (s.lineItemCode && s.lineItemCode.indexOf("15_") === 0) transportCost += s.calculatedCost;
        });
        return {
          clientName: p.clientName,
          ndisNumber: p.ndisNumber,
          silBudget: p.silBudget,
          silCost: Math.round(silCost * 100) / 100,
          silUtilization: p.silBudget > 0 ? Math.round((silCost / p.silBudget) * 10000) / 100 : 0,
          communityAccessBudget: p.communityAccessBudget,
          communityAccessCost: Math.round(caCost * 100) / 100,
          communityAccessUtilization: p.communityAccessBudget > 0 ? Math.round((caCost / p.communityAccessBudget) * 10000) / 100 : 0,
          transportBudget: p.transportBudget,
          transportCost: Math.round(transportCost * 100) / 100,
          transportUtilization: p.transportBudget > 0 ? Math.round((transportCost / p.transportBudget) * 10000) / 100 : 0,
          totalCost: Math.round((silCost + caCost + transportCost) * 100) / 100,
          totalBudget: (p.silBudget || 0) + (p.communityAccessBudget || 0) + (p.transportBudget || 0),
          shiftCount: pShifts.length
        };
      });

      // Weekly breakdown
      var weeklyData = {};
      shifts.forEach(function(s) {
        var wk = s.weekStart || "Unknown";
        if (!weeklyData[wk]) weeklyData[wk] = { sil: 0, communityAccess: 0, transport: 0 };
        if (s.lineItemCode && s.lineItemCode.indexOf("01_") === 0) weeklyData[wk].sil += s.calculatedCost;
        else if (s.lineItemCode && s.lineItemCode.indexOf("04_") === 0) weeklyData[wk].communityAccess += s.calculatedCost;
        else if (s.lineItemCode && s.lineItemCode.indexOf("15_") === 0) weeklyData[wk].transport += s.calculatedCost;
      });

      // SCHADS compliance summary
      var flagCounts = {};
      shifts.forEach(function(s) {
        if (s.schadsFlags) {
          s.schadsFlags.split(", ").forEach(function(flag) {
            if (flag) flagCounts[flag] = (flagCounts[flag] || 0) + 1;
          });
        }
      });

      // Grand totals
      var grandSil = 0, grandCA = 0, grandTransport = 0;
      shifts.forEach(function(s) {
        if (s.lineItemCode && s.lineItemCode.indexOf("01_") === 0) grandSil += s.calculatedCost;
        else if (s.lineItemCode && s.lineItemCode.indexOf("04_") === 0) grandCA += s.calculatedCost;
        else if (s.lineItemCode && s.lineItemCode.indexOf("15_") === 0) grandTransport += s.calculatedCost;
      });

      res.json({
        summary: {
          totalCost: Math.round((grandSil + grandCA + grandTransport) * 100) / 100,
          silTotal: Math.round(grandSil * 100) / 100,
          communityAccessTotal: Math.round(grandCA * 100) / 100,
          transportTotal: Math.round(grandTransport * 100) / 100,
          shiftCount: shifts.length,
          participantCount: participants.length
        },
        participantBreakdown: participantSummary,
        weeklyData: weeklyData,
        schadsCompliance: flagCounts,
        shifts: shifts
      });
    }).catch(function(err) {
      console.error("RoC Report shifts error:", err);
      res.status(500).json({ error: "Failed to generate report" });
    });
  }).catch(function(err) {
    console.error("RoC Report participants error:", err);
    res.status(500).json({ error: "Failed to generate report" });
  });
});


module.exports = router;
