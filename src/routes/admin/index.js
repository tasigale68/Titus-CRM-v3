const express = require('express');
const crypto = require('crypto');
const { db } = require('../../db/sqlite');
const { authenticate, hashPassword } = require('../../middleware/auth');
const { getUserPermissions, getDefaultPermissions, PERMISSION_KEYS, isSeniorRole } = require('../../services/permissions');
const { logAudit } = require('../../services/audit');
const { sendWelcomeEmail, WELCOME_EMAIL_TEMPLATE } = require('../../services/email');

const router = express.Router();

// ─── MIGRATION ENDPOINTS (no auth — token-secured only) ──────
// Remove these after migration is complete
var _migrationRunning = false;
var _migrationResult = null;
var MIGRATION_TOKEN = 'dcs-migrate-2026-supabase';

router.post('/migrate-to-supabase', function (req, res) {
  var token = req.body.token || req.query.token || '';
  if (token !== MIGRATION_TOKEN) return res.status(403).json({ error: 'Invalid migration token' });
  if (_migrationRunning) return res.json({ error: 'Migration already in progress' });

  var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  var SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  var AIRTABLE_API_KEY = (process.env.AIRTABLE_API_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not set in environment' });
  if (!AIRTABLE_API_KEY) return res.json({ error: 'AIRTABLE_API_KEY not set in environment' });

  _migrationRunning = true;
  console.log('[MIGRATION] Started at ' + new Date().toISOString());

  res.json({ status: 'started', message: 'Migration started. Check /api/admin/migration-status for progress.' });

  var migrationLog = [];
  var stats = { total: 0, success: 0, failed: 0, tables: [] };

  var AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/' + (process.env.AIRTABLE_BASE_ID || 'appg3Cz7mEsGA6IOI');
  var RATE_LIMIT_MS = 260;
  var lastReqTime = 0;

  function rateLimit() {
    var now = Date.now();
    var wait = RATE_LIMIT_MS - (now - lastReqTime);
    if (wait > 0) return new Promise(function (r) { setTimeout(r, wait); });
    return Promise.resolve();
  }

  function airtableFetch(table, params) {
    return rateLimit().then(function () {
      lastReqTime = Date.now();
      var url = AIRTABLE_BASE_URL + '/' + encodeURIComponent(table) + (params || '');
      return fetch(url, { headers: { 'Authorization': 'Bearer ' + AIRTABLE_API_KEY } }).then(function (r) { return r.json(); });
    });
  }

  function fetchAllRecords(table, view) {
    var all = [];
    function page(offset) {
      var params = '?pageSize=100';
      if (view) params += '&view=' + encodeURIComponent(view);
      if (offset) params += '&offset=' + encodeURIComponent(offset);
      return airtableFetch(table, params).then(function (data) {
        if (data.error) { migrationLog.push('Airtable error for ' + table + ': ' + JSON.stringify(data.error)); return all; }
        all = all.concat(data.records || []);
        if (data.offset) return page(data.offset);
        return all;
      });
    }
    return page(null);
  }

  function supabaseReq(tableName, method, body) {
    var url = SUPABASE_URL + '/rest/v1/' + tableName;
    var headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    };
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t.substring(0, 200)); });
      return r.status === 204 ? [] : r.json().catch(function () { return []; });
    });
  }

  function upsertBatch(tableName, rows) {
    if (!rows.length) return Promise.resolve();
    var batches = [];
    for (var i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
    return batches.reduce(function (chain, batch) {
      return chain.then(function () { return supabaseReq(tableName, 'POST', batch); });
    }, Promise.resolve());
  }

  function genericMap(r) { return { airtable_id: r.id, data: r.fields || {} }; }

  var MIGRATION_TABLES = [
    { airtable: 'All Contacts', supabase: 'contacts', view: 'Active Contacts 2026' },
    { airtable: 'Clients', supabase: 'clients', view: 'Client Active View' },
    { airtable: 'Leads', supabase: 'leads' },
    { airtable: 'Rosters 2025', supabase: 'rosters' },
    { airtable: 'Progress Notes', supabase: 'progress_notes' },
    { airtable: 'IR Reports 2025', supabase: 'ir_reports' },
    { airtable: 'Client Core Budgets', supabase: 'client_core_budgets' },
    { airtable: 'SIL Properties', supabase: 'sil_properties' },
    { airtable: 'Client Calendar', supabase: 'client_calendar' },
    { airtable: 'Support Plan - 2025', supabase: 'support_plans' },
    { airtable: 'Tasks', supabase: 'tasks' },
    { airtable: 'Course List', supabase: 'courses' },
    { airtable: 'Course Enrollments', supabase: 'course_enrollments' },
    { airtable: 'Course Modules', supabase: 'course_modules' },
    { airtable: 'Course Lessons', supabase: 'course_lessons' },
    { airtable: 'Course Quizzes', supabase: 'course_quizzes' },
    { airtable: 'Course QuizQuestions', supabase: 'course_quiz_questions' },
    { airtable: 'Receipts', supabase: 'receipts' },
    { airtable: 'Employee Contact History', supabase: 'employee_contact_history' },
    { airtable: 'Client Contact History', supabase: 'client_contact_history' },
    { airtable: 'Messenger Knowledge Base', supabase: 'knowledge_base' },
    { airtable: 'SW Independant Contractor Rates', supabase: 'sw_contractor_rates' },
    { airtable: 'TFN Pay Rates', supabase: 'tfn_pay_rates' },
    { airtable: 'Staff Availability', supabase: 'staff_availability' },
    { airtable: 'RoC Participants', supabase: 'roc_participants' },
    { airtable: 'RoC Shifts', supabase: 'roc_shifts' },
    { airtable: 'Client Sleep Chart', supabase: 'client_sleep_chart' },
    { airtable: 'Bowel Chart', supabase: 'bowel_chart' },
    { airtable: 'Fluid Intake Diary', supabase: 'fluid_intake_diary' },
    { airtable: 'Client Consumables', supabase: 'client_consumables' },
    { airtable: 'QR Code Data - Behaviours', supabase: 'client_behaviours' },
    { airtable: 'Document Signing Requests', supabase: 'document_signing_requests' },
    { airtable: 'Employment Documents', supabase: 'employment_documents' },
    { airtable: 'Client Docs', supabase: 'client_docs' },
    { airtable: 'NDIS Price Guide 2025 - 2026', supabase: 'ndis_price_guide' },
    { airtable: 'Chat Conversations', supabase: 'chat_conversations' },
    { airtable: 'Chat Members', supabase: 'chat_members' },
    { airtable: 'Chat Messages', supabase: 'chat_messages' },
    { airtable: 'Push Subscriptions', supabase: 'push_subscriptions' },
    { airtable: 'Client Media', supabase: 'client_media' },
    { airtable: 'Weekly Stakeholder Reports', supabase: 'weekly_stakeholder_reports' },
    { airtable: 'Candidate Interactions', supabase: 'candidate_interactions' },
    { airtable: 'Company Files', supabase: 'company_files' }
  ];

  (async function runMigration() {
    for (var i = 0; i < MIGRATION_TABLES.length; i++) {
      var t = MIGRATION_TABLES[i];
      try {
        var records = await fetchAllRecords(t.airtable, t.view || null);
        if (records.length === 0) {
          stats.tables.push({ table: t.supabase, records: 0, status: 'empty' });
          migrationLog.push('[' + (i + 1) + '/' + MIGRATION_TABLES.length + '] ' + t.airtable + ' -> ' + t.supabase + ': 0 records (empty)');
          continue;
        }
        var rows = records.map(genericMap);
        await upsertBatch(t.supabase, rows);
        stats.total += rows.length;
        stats.success++;
        stats.tables.push({ table: t.supabase, records: rows.length, status: 'ok' });
        migrationLog.push('[' + (i + 1) + '/' + MIGRATION_TABLES.length + '] ' + t.airtable + ' -> ' + t.supabase + ': ' + rows.length + ' records OK');
        console.log('[MIGRATION] ' + t.airtable + ' -> ' + t.supabase + ': ' + rows.length + ' records');
      } catch (e) {
        stats.failed++;
        stats.tables.push({ table: t.supabase, records: 0, status: 'error', error: e.message });
        migrationLog.push('[' + (i + 1) + '/' + MIGRATION_TABLES.length + '] ' + t.airtable + ' -> ' + t.supabase + ': ERROR ' + e.message.substring(0, 80));
        console.error('[MIGRATION] ERROR ' + t.airtable + ':', e.message.substring(0, 80));
      }
    }
    stats.completedAt = new Date().toISOString();
    _migrationRunning = false;
    console.log('[MIGRATION] Complete: ' + stats.total + ' records, ' + stats.success + ' tables OK, ' + stats.failed + ' failed');
    _migrationResult = { stats: stats, log: migrationLog };
  })();
});

router.get('/migration-status', function (req, res) {
  var token = req.query.token || req.headers['x-migration-token'] || '';
  if (token !== MIGRATION_TOKEN) return res.status(403).json({ error: 'Invalid migration token' });
  res.json({
    running: _migrationRunning,
    result: _migrationResult || null,
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  });
});

// ─── AUTHENTICATED ADMIN ROUTES ──────────────────────────────
router.use(authenticate);

function isAdminRole(user) {
  return user.role === 'superadmin';
}

// ─── USER MANAGEMENT ──────────────────────────────────────

// GET /api/admin/users
router.get('/users', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var users = db
    .prepare('SELECT id, email, name, role, job_title, permissions, phone_number, created_at FROM users ORDER BY created_at')
    .all();
  users = users.map(function (u) {
    u.permissions = getUserPermissions(u);
    return u;
  });
  res.json(users);
});

// POST /api/admin/users
router.post('/users', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var email = req.body.email;
  var password = req.body.password;
  var name = req.body.name;
  var role = req.body.role;
  var job_title = req.body.job_title || '';
  var sendWelcome = req.body.sendWelcomeEmail !== false;
  var permissions = req.body.permissions || getDefaultPermissions(role || 'operator');

  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    db.prepare(
      'INSERT INTO users (email, password_hash, name, role, job_title, permissions) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      email.toLowerCase().trim(),
      hashPassword(password),
      name || '',
      role || 'operator',
      job_title,
      JSON.stringify(permissions)
    );

    logAudit(
      req.user,
      'create_user',
      'User',
      '',
      name || email,
      'Created',
      '',
      'Role: ' + (role || 'operator') + ', Job: ' + job_title
    );

    if (sendWelcome) {
      sendWelcomeEmail(email.toLowerCase().trim(), name, password, role || 'operator', job_title).then(function (result) {
        logAudit(
          req.user,
          'welcome_email',
          'User',
          '',
          name || email,
          'Welcome Email',
          '',
          result.success ? 'Sent' : 'Failed: ' + (result.error || '')
        );
      });
    }

    res.json({ success: true, welcomeEmailQueued: sendWelcome });
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var id = req.params.id;
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Don't allow changing superadmin role
  if (user.role === 'superadmin' && req.body.role && req.body.role !== 'superadmin') {
    return res.status(400).json({ error: 'Cannot change superadmin role' });
  }

  var updates = [];
  var params = [];
  if (req.body.name !== undefined) { updates.push('name = ?'); params.push(req.body.name); }
  if (req.body.role !== undefined) { updates.push('role = ?'); params.push(req.body.role); }
  if (req.body.job_title !== undefined) { updates.push('job_title = ?'); params.push(req.body.job_title); }
  if (req.body.permissions !== undefined) { updates.push('permissions = ?'); params.push(JSON.stringify(req.body.permissions)); }
  if (req.body.phone_number !== undefined) { updates.push('phone_number = ?'); params.push(req.body.phone_number); }
  if (req.body.password) { updates.push('password_hash = ?'); params.push(hashPassword(req.body.password)); }

  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  var stmt = db.prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?');
  stmt.run.apply(stmt, params);

  // Audit log
  var _changedFields = [];
  if (req.body.name !== undefined) _changedFields.push('Name: ' + req.body.name);
  if (req.body.role !== undefined) _changedFields.push('Role: ' + req.body.role);
  if (req.body.job_title !== undefined) _changedFields.push('Job Title: ' + req.body.job_title);
  if (req.body.phone_number !== undefined) _changedFields.push('Phone: ' + req.body.phone_number);
  if (req.body.permissions !== undefined) _changedFields.push('Permissions updated');
  if (req.body.password) _changedFields.push('Password reset');

  logAudit(
    req.user,
    'update_user',
    'User',
    id,
    user.name || user.email,
    _changedFields.join(', ') || 'Updated',
    '',
    _changedFields.join(', ')
  );

  res.json({ success: true });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var _delUser = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.params.id);
  db.prepare("DELETE FROM users WHERE id = ? AND role != 'superadmin'").run(req.params.id);

  logAudit(
    req.user,
    'delete_user',
    'User',
    req.params.id,
    _delUser ? _delUser.name || _delUser.email : req.params.id,
    'Deleted',
    _delUser ? _delUser.email : '',
    ''
  );
  res.json({ success: true });
});

// ─── WELCOME EMAIL ────────────────────────────────────────

// POST /api/admin/users/:id/welcome-email (resend)
router.post('/users/:id/welcome-email', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var user = db.prepare('SELECT id, email, name, role, job_title FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  var tempPassword = req.body.password;
  if (!tempPassword) return res.status(400).json({ error: 'Password required for welcome email' });

  // Update user password
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(tempPassword), user.id);

  sendWelcomeEmail(user.email, user.name, tempPassword, user.role, user.job_title).then(function (result) {
    logAudit(
      req.user,
      'resend_welcome_email',
      'User',
      String(user.id),
      user.name || user.email,
      'Welcome Email',
      '',
      result.success ? 'Sent' : 'Failed: ' + (result.error || '')
    );
    res.json(result);
  });
});

// GET /api/admin/welcome-email/preview
router.get('/welcome-email/preview', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var html = WELCOME_EMAIL_TEMPLATE.body(
    'Jane Smith',
    'jane@deltacommunity.com.au',
    'TempPass123!',
    'support_worker',
    'Support Worker'
  );
  res.json({ subject: WELCOME_EMAIL_TEMPLATE.subject, html: html });
});

// ─── IMPERSONATE USER (superadmin only) ───────────────────

router.post('/impersonate/:id', function (req, res) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Not authorized' });

  var targetId = parseInt(req.params.id);
  var target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  var impToken = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(impToken, target.id);

  var perms = getUserPermissions(target);
  console.log('IMPERSONATE: superadmin ' + req.user.email + ' → ' + target.email + ' (id:' + target.id + ')');

  res.json({
    token: impToken,
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      job_title: target.job_title || '',
      permissions: perms,
    },
  });
});

// ─── PERMISSION TEMPLATES ─────────────────────────────────

// GET /api/admin/templates
router.get('/templates', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var templates = db.prepare('SELECT * FROM permission_templates ORDER BY name').all();
  templates = templates.map(function (t) {
    try { t.permissions = JSON.parse(t.permissions); } catch (e) { t.permissions = {}; }
    return t;
  });
  res.json(templates);
});

// POST /api/admin/templates
router.post('/templates', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var name = req.body.name;
  var permissions = req.body.permissions || {};
  if (!name) return res.status(400).json({ error: 'Template name required' });

  try {
    db.prepare('INSERT INTO permission_templates (name, permissions) VALUES (?, ?)').run(
      name,
      JSON.stringify(permissions)
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Template name already exists' });
  }
});

// PATCH /api/admin/templates/:id
router.patch('/templates/:id', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });

  var id = req.params.id;
  var updates = [];
  var params = [];
  if (req.body.name !== undefined) { updates.push('name = ?'); params.push(req.body.name); }
  if (req.body.permissions !== undefined) { updates.push('permissions = ?'); params.push(JSON.stringify(req.body.permissions)); }

  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  var stmt = db.prepare('UPDATE permission_templates SET ' + updates.join(', ') + ' WHERE id = ?');
  stmt.run.apply(stmt, params);
  res.json({ success: true });
});

// DELETE /api/admin/templates/:id
router.delete('/templates/:id', function (req, res) {
  if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM permission_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/admin/permission-keys
router.get('/permission-keys', function (req, res) {
  res.json(PERMISSION_KEYS);
});

// ─── AUDIT LOG ────────────────────────────────────────────

// GET /api/admin/audit-log
router.get('/audit-log', function (req, res) {
  if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Super Admin only' });

  var limit = parseInt(req.query.limit) || 100;
  var offset = parseInt(req.query.offset) || 0;
  var from = req.query.from || '';
  var to = req.query.to || '';
  var userEmail = req.query.userEmail || '';
  var entityType = req.query.entityType || '';
  var search = req.query.search || '';

  var whereClauses = [];
  var params = [];

  if (from) {
    whereClauses.push('created_at >= ?');
    params.push(from + 'T00:00:00');
  }
  if (to) {
    whereClauses.push('created_at <= ?');
    params.push(to + 'T23:59:59');
  }
  if (userEmail) {
    whereClauses.push('user_email = ?');
    params.push(userEmail);
  }
  if (entityType) {
    whereClauses.push('entity_type LIKE ?');
    params.push('%' + entityType + '%');
  }
  if (search) {
    whereClauses.push('(entity_label LIKE ? OR field_name LIKE ? OR new_value LIKE ? OR user_name LIKE ?)');
    params.push('%' + search + '%', '%' + search + '%', '%' + search + '%', '%' + search + '%');
  }

  var whereSQL = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';

  try {
    var countStmt = db.prepare('SELECT COUNT(*) as cnt FROM audit_log' + whereSQL);
    var countRow = countStmt.get.apply(countStmt, params);
    var total = countRow ? countRow.cnt : 0;

    var entryParams = params.concat([limit, offset]);
    var entryStmt = db.prepare(
      'SELECT * FROM audit_log' + whereSQL + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    );
    var entries = entryStmt.all.apply(entryStmt, entryParams);

    var users = db
      .prepare("SELECT DISTINCT user_name, user_email FROM audit_log WHERE user_email != '' ORDER BY user_name")
      .all();

    res.json({ entries: entries, total: total, users: users });
  } catch (e) {
    console.error('[AUDIT LOG] Query error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── TEMPORARY: Supabase Migration Trigger ──────────────────
module.exports = router;
