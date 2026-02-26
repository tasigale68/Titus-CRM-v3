var express = require('express');
var { authenticate } = require('../../middleware/auth');
var { logAudit } = require('../../services/audit');
var airtable = require('../../services/airtable');
var { msGraphFetch } = require('../../services/email');
var env = require('../../config/env');

var router = express.Router();

// ─── Public routes (NO auth) ─────────────────────────────

// Website enquiry form — NO AUTH required
router.post('/website-enquiry', function(req, res) {
  var name = (req.body.name || "").trim();
  var email = (req.body.email || "").trim();
  var phone = (req.body.phone || "").trim();
  var service = (req.body.service || "").trim();
  var message = (req.body.message || "").trim();

  if (!name || !email || !message) return res.status(400).json({ error: "Name, email, and message are required" });

  // Create a lead in Airtable
  var fields = {
    "Full Name": name,
    "Email": email,
    "Phone": phone || "",
    "Enquiry Type": service || "General",
    "Message": message,
    "Source": "Website",
    "Date": new Date().toISOString().split("T")[0],
    "Status": "New"
  };

  // Try to save to Leads table
  airtable.rawFetch(airtable.TABLES.LEADS, "POST", "", { records: [{ fields: fields }] })
    .then(function(data) {
      if (data.records && data.records.length > 0) {
        console.log("Website enquiry saved as lead:", data.records[0].id, name);
      }
    })
    .catch(function(e) {
      console.error("Website enquiry lead save error:", e.message);
    });

  // Also send notification email to DCS
  var emailBody = "<h2>New Website Enquiry</h2>"
    + "<p><strong>Name:</strong> " + name + "</p>"
    + "<p><strong>Email:</strong> " + email + "</p>"
    + (phone ? "<p><strong>Phone:</strong> " + phone + "</p>" : "")
    + (service ? "<p><strong>Service:</strong> " + service + "</p>" : "")
    + "<p><strong>Message:</strong></p><p>" + message.replace(/\n/g, "<br>") + "</p>"
    + "<hr><p style='color:#666;font-size:12px'>Submitted from the DCS marketing website</p>";

  msGraphFetch("/users/" + env.microsoft.emailAddress + "/sendMail", "POST", {
    message: {
      subject: "New Website Enquiry from " + name,
      body: { contentType: "HTML", content: emailBody },
      toRecipients: [{ emailAddress: { address: env.microsoft.emailAddress } }],
      replyTo: [{ emailAddress: { address: email, name: name } }]
    }
  }).then(function() {
    console.log("Website enquiry email sent for:", name);
  }).catch(function(e) {
    console.warn("Website enquiry email failed:", e.message);
  });

  res.json({ success: true, message: "Enquiry received" });
});

// Lead capture for roster calculator — NO AUTH required
router.post('/roster-calculator', function(req, res) {
  var fields = {
    "Organisation Name": req.body.orgName || "",
    "Contact Name": req.body.contactName || "",
    "Email": req.body.email || "",
    "Phone": req.body.mobile || "",
    "State": req.body.state || "",
    "Number of Participants": parseInt(req.body.participants || 0),
    "Number of Staff": parseInt(req.body.staff || 0),
    "Source": "Roster Calculator",
    "Status": "New"
  };
  airtable.rawFetch(airtable.TABLES.LEADS, "POST", "", { records: [{ fields: fields }] }).then(function(data) {
    res.json({ success: true });
  }).catch(function(err) {
    console.error("Lead capture error:", err.message);
    res.json({ success: true }); // Don't block calculator on lead save failure
  });
});

// ─── Authenticated routes ─────────────────────────────────

router.use(authenticate);

// GET /api/leads
router.get('/', function(req, res) {
  airtable.fetchAllFromTable(airtable.TABLES.LEADS).then(function(records) {
    if (records && records.length > 0) {
      console.log("Leads fields:", Object.keys(records[0].fields || {}).sort().join(", "));
      // Log first record values for debugging
      var f0 = records[0].fields || {};
      Object.keys(f0).forEach(function(k) {
        var v = f0[k];
        if (v !== null && v !== undefined && v !== "") {
          var preview = Array.isArray(v) ? "[" + v.slice(0, 2).join(", ") + "]" : String(v).substring(0, 80);
          console.log("  Lead field: " + k + " = " + preview);
        }
      });
    }
    function av(v) { return Array.isArray(v) ? v[0] || "" : v || ""; }
    var result = (records || []).map(function(r) {
      var f = r.fields || {};
      // "Name" is just a number ID — real name is in "Lead Name or Initials"
      var leadName = f["Lead Name or Initials"] || f["Lead Name"] || f["Client Name"] || f["Full Name"] || "";
      if (!leadName) {
        var fn = f["First Name"] || "";
        var ln = f["Last Name"] || "";
        if (fn || ln) leadName = (fn + " " + ln).trim();
      }
      // Fall back to Name only if it looks like a real name (not a number)
      if (!leadName && f["Name"] && isNaN(f["Name"])) leadName = f["Name"];
      var refNum = f["Name"] || "";
      if (!isNaN(refNum)) refNum = "#" + refNum; else refNum = "";

      return {
        airtableId: r.id,
        name: leadName,
        refNum: refNum,
        email: f["Email"] || f["Email Address"] || "",
        phone: f["Phone"] || f["Mobile"] || f["Formatted Mobile"] || f["Phone Number"] || "",
        source: av(f["Source"] || f["Lead Source"] || f["Referral Source"] || ""),
        stage: av(f["Stage"] || f["Lead Stage"] || f["Status"] || "Enquiry"),
        date: f["Date"] || f["Created"] || f["Date Created"] || f["Enquiry Date"] || "",
        notes: f["Notes"] || f["Comments"] || "",
        createdAt: r.createdTime || "",
        lastModified: f["Last Modified"] || f["Last Modified Time"] || f["Modified"] || "",
        // New fields
        suburb: av(f["Suburb"] || f["City"] || f["Location"] || f["Area"] || ""),
        disabilityType: av(f["Type of Disability"] || f["Disability Type"] || f["Disability"] || f["Primary Disability"] || ""),
        // Support Coordinator
        scName: av(f["Support Coordinators Name"] || f["Support Coordinator Name"] || f["SC Name"] || f["Support Coordinator"] || ""),
        scEmail: av(f["Support Coordinators Email"] || f["Support Coordinator Email"] || f["SC Email"] || ""),
        scMobile: av(f["Support Coordinators Mobile"] || f["Support Coordinator Mobile"] || f["SC Mobile"] || f["SC Phone"] || ""),
        // Additional useful fields
        ndisNumber: av(f["NDIS Number"] || f["NDIS #"] || f["NDIS Ref"] || ""),
        serviceType: av(f["Service Type"] || f["Type of Service"] || f["SIL or CAS"] || f["SIL or CAS?"] || ""),
        assignee: av(f["Assignee"] || f["Assigned To"] || f["Owner"] || "")
      };
    });
    // Auto-close leads older than 60 days (move to LOST if not Won/Lost)
    var now = new Date();
    var autoClosedCount = 0;
    result.forEach(function(r) {
      if (r.stage === "WON" || r.stage === "LOST") return;
      var ld = r.date ? new Date(r.date) : null;
      if (!ld || isNaN(ld)) return;
      var daysDiff = Math.floor((now - ld) / (1000 * 60 * 60 * 24));
      if (daysDiff > 60) {
        r.stage = "LOST";
        r._autoLost = true;
        autoClosedCount++;
        // Update in Airtable
        if (r.airtableId) {
          var stageField = "Stage";
          var body = { fields: {} };
          body.fields[stageField] = "LOST";
          airtable.rawFetch(airtable.TABLES.LEADS, "PATCH", "/" + r.airtableId, body).catch(function(e) { console.log("[LEADS] Auto-close update failed for " + r.airtableId + ":", e.message); });
          // Log to audit
          logAudit({ name: "System", email: "system@titus.ai" }, "auto_close_lead", "Lead", r.airtableId, r.name || "Unknown", "Stage", r.stage, "LOST — Auto-closed: No activity for 60+ days");
        }
      }
    });
    if (autoClosedCount > 0) console.log("[LEADS] Auto-closed " + autoClosedCount + " leads older than 60 days");
    console.log("Leads: Found " + result.length + " records");
    res.json(result);
  }).catch(function(e) {
    console.error("Leads error:", e.message);
    res.json([]);
  });
});

// PATCH /api/leads/:id
router.patch('/:id', function(req, res) {
  var id = req.params.id;
  var stage = req.body.stage || "";
  var fields = {};
  if (stage) fields["Stage"] = stage;
  airtable.rawFetch(airtable.TABLES.LEADS, "PATCH", "/" + id, { fields: fields })
    .then(function(data) {
      if (data.error) return res.json({ error: data.error.message || "Update failed" });
      res.json({ success: true });
    })
    .catch(function(e) { res.json({ error: e.message }); });
});

module.exports = router;
