var express = require('express');
var { authenticate } = require('../../middleware/auth');
var airtable = require('../../services/airtable');

var router = express.Router();

router.use(authenticate);

// Helper to extract value (handles linked record arrays)
function av(v) { return Array.isArray(v) ? v[0] || "" : v || ""; }

// GET /api/tasks — fetch from Airtable Tasks table, sorted by latest
router.get('/', function(req, res) {
  airtable.fetchAllFromTable(airtable.TABLES.TASKS).then(function(records) {
    if (records && records.length > 0) {
      console.log("[TASKS] Fields:", Object.keys(records[0].fields || {}).sort().join(", "));
    }
    var result = (records || []).map(function(r) {
      var f = r.fields || {};
      return {
        id: r.id,
        taskName: av(f["Task Name"] || f["Name"] || f["Title"] || ""),
        clientName: av(f["Client Name"] || f["Client"] || ""),
        assignee: av(f["Assignee"] || f["Assigned To"] || f["Staff Member"] || ""),
        status: av(f["Status"] || f["Task Status"] || "Not Started"),
        priority: av(f["Priority"] || f["Task Priority"] || "Medium"),
        dueDate: f["Due Date"] || f["Due"] || "",
        projectName: av(f["Project"] || f["Project Name"] || ""),
        refNumber: av(f["Ref Number"] || f["Ref #"] || f["Name"] || ""),
        createdBy: av(f["Created By"] || f["Creator"] || ""),
        createdDate: f["Created Date"] || f["Created"] || r.createdTime || "",
        typeOfUpdate: av(f["Type of Update"] || f["Type"] || f["Category"] || ""),
        notes: f["Notes"] || f["Description"] || ""
      };
    });
    // Sort by created date descending (latest first)
    result.sort(function(a, b) {
      return (b.createdDate || "").localeCompare(a.createdDate || "");
    });
    console.log("[TASKS] Found " + result.length + " records");
    res.json(result);
  }).catch(function(e) {
    console.error("[TASKS] Error:", e.message);
    res.json([]);
  });
});

// PATCH /api/tasks/:id — update task fields in Airtable
router.patch('/:id', function(req, res) {
  var id = req.params.id;
  var fields = {};
  if (req.body.status) fields["Status"] = req.body.status;
  if (req.body.assigned_to) fields["Assignee"] = req.body.assigned_to;
  if (req.body.priority) fields["Priority"] = req.body.priority;
  if (req.body.dueDate) fields["Due Date"] = req.body.dueDate;
  if (req.body.taskName) fields["Task Name"] = req.body.taskName;
  if (req.body.notes) fields["Notes"] = req.body.notes;

  airtable.rawFetch(airtable.TABLES.TASKS, "PATCH", "/" + id, { fields: fields })
    .then(function(data) {
      if (data.error) return res.json({ error: data.error.message || "Update failed" });
      res.json({ ok: true });
    })
    .catch(function(e) { res.json({ error: e.message }); });
});

// POST /api/tasks — create task in Airtable
router.post('/', function(req, res) {
  var fields = {};
  if (req.body.title || req.body.taskName) fields["Task Name"] = req.body.title || req.body.taskName;
  if (req.body.description) fields["Notes"] = req.body.description;
  if (req.body.assigned_to) fields["Assignee"] = req.body.assigned_to;
  if (req.body.priority) fields["Priority"] = req.body.priority || "Medium";
  if (req.body.due_date || req.body.dueDate) fields["Due Date"] = req.body.due_date || req.body.dueDate;
  if (req.body.clientName) fields["Client Name"] = req.body.clientName;
  if (req.body.projectName) fields["Project"] = req.body.projectName;
  if (req.body.status) fields["Status"] = req.body.status || "Not Started";

  airtable.rawFetch(airtable.TABLES.TASKS, "POST", "", { records: [{ fields: fields }] })
    .then(function(data) {
      if (data.records && data.records.length > 0) {
        res.json({ task: { id: data.records[0].id }, ok: true });
      } else {
        res.json({ error: "Failed to create task" });
      }
    })
    .catch(function(e) { res.json({ error: e.message }); });
});

// DELETE /api/tasks/:id
router.delete('/:id', function(req, res) {
  airtable.rawFetch(airtable.TABLES.TASKS, "DELETE", "/" + req.params.id)
    .then(function() { res.json({ ok: true }); })
    .catch(function(e) { res.json({ error: e.message }); });
});

module.exports = router;
