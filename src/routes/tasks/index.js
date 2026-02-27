var express = require('express');
var { authenticate } = require('../../middleware/auth');
var airtable = require('../../services/database');
var { createClient } = require('@supabase/supabase-js');

var router = express.Router();
router.use(authenticate);

// Supabase client for tasks
var supabase = null;
try {
  var _sbUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  var _sbKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (_sbUrl && _sbKey) supabase = createClient(_sbUrl, _sbKey, { auth: { autoRefreshToken: false, persistSession: false } });
} catch (e) { /* optional */ }

// Helper to extract value (handles linked record arrays)
function av(v) { return Array.isArray(v) ? v[0] || "" : v || ""; }

// GET /api/tasks — fetch from Supabase (primary) with Airtable fallback
router.get('/', function(req, res) {
  // Try Supabase first
  if (supabase) {
    supabase.from('tasks').select('*').order('created_date', { ascending: false, nullsFirst: false }).limit(500)
      .then(function(sbRes) {
        if (sbRes.error) throw new Error(sbRes.error.message);
        var rows = sbRes.data || [];
        if (rows.length > 0) {
          var result = rows.map(function(r) {
            return {
              id: r.id,
              airtable_id: r.airtable_id || '',
              taskName: r.task_name || '',
              clientName: r.client_name || '',
              assignee: r.assignee || '',
              status: r.status || 'Not Started',
              priority: r.priority || 'Medium',
              dueDate: r.due_date || '',
              dateCompleted: r.date_completed || '',
              projectName: r.project_name || '',
              refNumber: r.ref_number || '',
              createdBy: r.created_by || '',
              createdDate: r.created_date || r.created_at || '',
              typeOfUpdate: r.type_of_update || '',
              notes: r.notes || r.description || '',
              description: r.description || '',
              followUpRequired: r.follow_up_required || '',
              followUpDetails: r.follow_up_details || '',
              actionsTaken: r.actions_taken || ''
            };
          });
          console.log("[TASKS] Supabase: " + result.length + " records");
          return res.json(result);
        }
        // Fall through to Airtable if Supabase is empty
        throw new Error('empty');
      }).catch(function(e) {
        if (e.message !== 'empty') console.warn("[TASKS] Supabase error, falling back:", e.message);
        fetchFromAirtable(res);
      });
  } else {
    fetchFromAirtable(res);
  }
});

function fetchFromAirtable(res) {
  airtable.fetchAllFromTable(airtable.TABLES.TASKS).then(function(records) {
    var result = (records || []).map(function(r) {
      var f = r.fields || {};
      return {
        id: r.id,
        taskName: av(f["Task Name"] || f["Name"] || f["Title"] || ""),
        clientName: av(f["Client Full Name (from Client Name)"] || f["Client Name"] || f["Client"] || ""),
        assignee: av(f["Full Name (from Assigned to Email)"] || f["Assignee"] || f["Assigned To"] || f["Staff Member"] || ""),
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
    result.sort(function(a, b) { return (b.createdDate || "").localeCompare(a.createdDate || ""); });
    console.log("[TASKS] Airtable: " + result.length + " records");
    res.json(result);
  }).catch(function(e) {
    console.error("[TASKS] Error:", e.message);
    res.json([]);
  });
}

// PATCH /api/tasks/:id — update task (dual write: Airtable + Supabase)
router.patch('/:id', function(req, res) {
  var id = req.params.id;
  var b = req.body;

  // Supabase update (UUID-based ID)
  if (supabase && id.length > 20) {
    var sbUpdate = {};
    if (b.status) sbUpdate.status = b.status;
    if (b.assigned_to || b.assignee) sbUpdate.assignee = b.assigned_to || b.assignee;
    if (b.priority) sbUpdate.priority = b.priority;
    if (b.dueDate || b.due_date) sbUpdate.due_date = b.dueDate || b.due_date;
    if (b.taskName) sbUpdate.task_name = b.taskName;
    if (b.notes) sbUpdate.notes = b.notes;
    if (b.status === 'Completed') sbUpdate.date_completed = new Date().toISOString().split('T')[0];

    supabase.from('tasks').update(sbUpdate).eq('id', id)
      .then(function(sbRes) {
        if (sbRes.error) return res.json({ error: sbRes.error.message });
        res.json({ ok: true });
      }).catch(function(e) { res.json({ error: e.message }); });
    return;
  }

  // Airtable update (rec_xxx ID) + Supabase dual write
  var fields = {};
  if (b.status) fields["Status"] = b.status;
  if (b.assigned_to) fields["Assignee"] = b.assigned_to;
  if (b.priority) fields["Priority"] = b.priority;
  if (b.dueDate) fields["Due Date"] = b.dueDate;
  if (b.taskName) fields["Task Name"] = b.taskName;
  if (b.notes) fields["Notes"] = b.notes;

  airtable.rawFetch(airtable.TABLES.TASKS, "PATCH", "/" + id, { fields: fields })
    .then(function(data) {
      if (data.error) return res.json({ error: data.error.message || "Update failed" });
      res.json({ ok: true });
    })
    .catch(function(e) { res.json({ error: e.message }); });

  // Dual write to Supabase by airtable_id
  if (supabase) {
    var sbUpdate = {};
    if (b.status) sbUpdate.status = b.status;
    if (b.assigned_to || b.assignee) sbUpdate.assignee = b.assigned_to || b.assignee;
    if (b.priority) sbUpdate.priority = b.priority;
    if (b.dueDate) sbUpdate.due_date = b.dueDate;
    if (b.taskName) sbUpdate.task_name = b.taskName;
    if (b.notes) sbUpdate.notes = b.notes;
    if (b.status === 'Completed') sbUpdate.date_completed = new Date().toISOString().split('T')[0];
    supabase.from('tasks').update(sbUpdate).eq('airtable_id', id)
      .then(function() {}).catch(function() {});
  }
});

// POST /api/tasks — create task (dual write)
router.post('/', function(req, res) {
  var b = req.body;

  // Create in Supabase
  if (supabase) {
    var sbRow = {
      task_name: b.title || b.taskName || '',
      notes: b.description || b.notes || '',
      assignee: b.assigned_to || b.assignee || '',
      priority: b.priority || 'Medium',
      due_date: b.due_date || b.dueDate || null,
      client_name: b.clientName || '',
      project_name: b.projectName || '',
      status: b.status || 'Not Started',
      created_by: (req.user && req.user.name) || '',
      created_date: new Date().toISOString()
    };
    supabase.from('tasks').insert(sbRow).select()
      .then(function(sbRes) {
        if (sbRes.error) throw new Error(sbRes.error.message);
        var row = (sbRes.data && sbRes.data[0]) || {};
        res.json({ task: { id: row.id }, ok: true });
      }).catch(function(e) {
        console.warn("[TASKS] Supabase create failed, trying Airtable:", e.message);
        createInAirtable(b, res);
      });
  } else {
    createInAirtable(b, res);
  }

  // Also create in Airtable for sync
  if (supabase) {
    var fields = {};
    if (b.title || b.taskName) fields["Task Name"] = b.title || b.taskName;
    if (b.description) fields["Notes"] = b.description;
    if (b.assigned_to) fields["Assignee"] = b.assigned_to;
    if (b.priority) fields["Priority"] = b.priority || "Medium";
    if (b.due_date || b.dueDate) fields["Due Date"] = b.due_date || b.dueDate;
    if (b.clientName) fields["Client Name"] = b.clientName;
    if (b.projectName) fields["Project"] = b.projectName;
    if (b.status) fields["Status"] = b.status || "Not Started";
    airtable.rawFetch(airtable.TABLES.TASKS, "POST", "", { records: [{ fields: fields }] })
      .then(function() {}).catch(function() {});
  }
});

function createInAirtable(b, res) {
  var fields = {};
  if (b.title || b.taskName) fields["Task Name"] = b.title || b.taskName;
  if (b.description) fields["Notes"] = b.description;
  if (b.assigned_to) fields["Assignee"] = b.assigned_to;
  if (b.priority) fields["Priority"] = b.priority || "Medium";
  if (b.due_date || b.dueDate) fields["Due Date"] = b.due_date || b.dueDate;
  if (b.clientName) fields["Client Name"] = b.clientName;
  if (b.projectName) fields["Project"] = b.projectName;
  if (b.status) fields["Status"] = b.status || "Not Started";

  airtable.rawFetch(airtable.TABLES.TASKS, "POST", "", { records: [{ fields: fields }] })
    .then(function(data) {
      if (data.records && data.records.length > 0) {
        res.json({ task: { id: data.records[0].id }, ok: true });
      } else {
        res.json({ error: "Failed to create task" });
      }
    })
    .catch(function(e) { res.json({ error: e.message }); });
}

// DELETE /api/tasks/:id
router.delete('/:id', function(req, res) {
  var id = req.params.id;

  // Supabase UUID delete
  if (supabase && id.length > 20) {
    supabase.from('tasks').delete().eq('id', id)
      .then(function(sbRes) {
        if (sbRes.error) return res.json({ error: sbRes.error.message });
        res.json({ ok: true });
      }).catch(function(e) { res.json({ error: e.message }); });
    return;
  }

  // Airtable delete + Supabase dual delete
  airtable.rawFetch(airtable.TABLES.TASKS, "DELETE", "/" + id)
    .then(function() { res.json({ ok: true }); })
    .catch(function(e) { res.json({ error: e.message }); });

  if (supabase) {
    supabase.from('tasks').delete().eq('airtable_id', id)
      .then(function() {}).catch(function() {});
  }
});

module.exports = router;
