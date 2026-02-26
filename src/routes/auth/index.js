const express = require('express');
const crypto = require('crypto');
const { db } = require('../../db/sqlite');
const { authenticate, requirePhase2, hashPassword } = require('../../middleware/auth');
const { getUserPermissions, isSeniorRole } = require('../../services/permissions');
const { logAudit } = require('../../services/audit');
const env = require('../../config/env');

const router = express.Router();

// ─── LOGIN ────────────────────────────────────────────────
router.post('/login', function (req, res) {
  var email = req.body.email;
  var password = req.body.password;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  var user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || user.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  var token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  var perms = getUserPermissions(user);

  res.json({
    token: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      job_title: user.job_title || '',
      permissions: perms,
    },
  });
});

// ─── LOGOUT ───────────────────────────────────────────────
router.post('/logout', function (req, res) {
  var token = req.headers.authorization
    ? req.headers.authorization.replace('Bearer ', '')
    : null;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

// ─── FORGOT PASSWORD (SMS via Twilio) ─────────────────────
router.post('/forgot-password', function (req, res) {
  var email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email required' });

  // Always return success to prevent email enumeration
  var user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.phone_number) {
    return res.json({ success: true });
  }

  // Generate 6-digit code
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  db.prepare('UPDATE users SET reset_code = ?, reset_code_expiry = ? WHERE id = ?').run(code, expiry, user.id);

  // Send SMS via Twilio
  if (env.twilio.accountSid && env.twilio.authToken) {
    var twilio = require('twilio')(env.twilio.accountSid, env.twilio.authToken);
    var toPhone = user.phone_number.replace(/\s/g, '');
    if (!toPhone.startsWith('+')) toPhone = '+61' + toPhone.replace(/^0/, '');

    twilio.messages
      .create({
        to: toPhone,
        from: env.twilio.phoneNumber,
        body: 'Your Titus password reset code is: ' + code + '\n\nThis code expires in 1 hour. If you didn\'t request this, ignore this message.',
      })
      .then(function () {
        console.log('Password reset code sent to', toPhone, 'for', email);
      })
      .catch(function (err) {
        console.error('Failed to send reset SMS:', err.message);
      });
  } else {
    console.log('Twilio not configured — reset code for', email, 'is:', code);
  }

  res.json({ success: true });
});

// ─── RESET PASSWORD ───────────────────────────────────────
router.post('/reset-password', function (req, res) {
  var email = (req.body.email || '').toLowerCase().trim();
  var code = (req.body.code || '').trim();
  var newPassword = req.body.newPassword || '';

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Code must be 6 digits' });
  }

  var user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.reset_code) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  if (user.reset_code !== code) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }

  if (user.reset_code_expiry && new Date(user.reset_code_expiry) < new Date()) {
    db.prepare('UPDATE users SET reset_code = NULL, reset_code_expiry = NULL WHERE id = ?').run(user.id);
    return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
  }

  // Update password and clear code
  db.prepare('UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expiry = NULL WHERE id = ?').run(
    hashPassword(newPassword),
    user.id
  );
  // Invalidate all existing sessions
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  console.log('Password reset successful for', email);
  res.json({ success: true });
});

// ─── ME (session check) ──────────────────────────────────
router.get('/me', authenticate, function (req, res) {
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  var perms = getUserPermissions(user);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      job_title: user.job_title || '',
      permissions: perms,
    },
  });
});

// ─── PERMISSION KEYS (for admin UI) ──────────────────────
router.get('/permission-keys', authenticate, function (req, res) {
  var { PERMISSION_KEYS } = require('../../services/permissions');
  res.json(PERMISSION_KEYS);
});

// ═══ FEATURE 12: AUTO-LOGOUT CONFIG ═══
router.get('/inactivity-config', authenticate, function (req, res) {
  var setting = db.prepare("SELECT * FROM automation_settings WHERE id = 'AUTO_INACTIVITY_LOGOUT'").get();
  var config = JSON.parse((setting && setting.config) || '{}');
  var role = (req.user.role || '').toLowerCase().replace(/\s+/g, '_');
  var timeout = 7200000; // 2hrs default
  if (config.workerTimeout && (role === 'support_worker' || role === 'operator')) timeout = config.workerTimeout;
  else if (config.stakeholderTimeout && role === 'stakeholder') timeout = config.stakeholderTimeout;
  else if (config.adminTimeout) timeout = config.adminTimeout;

  res.json({ enabled: setting ? !!setting.enabled : true, timeout: timeout, warningBefore: 600000 });
});

router.post('/log-auto-logout', authenticate, function (req, res) {
  var now = new Date().toISOString();
  db.prepare(
    "INSERT INTO login_history (user_id, user_email, user_name, event_type, portal, ip, device, created_at) VALUES (?, ?, ?, 'Auto-Logout', ?, ?, ?, ?)"
  ).run(req.user.user_id, req.user.email, req.user.name, req.body.portal || 'Main', req.body.ip || '', req.body.device || '', now);

  db.prepare('DELETE FROM sessions WHERE token = ?').run(
    req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : ''
  );
  res.json({ success: true });
});

// ═══ FEATURE 20: LOGIN/LOGOUT TRACKING ═══
router.post('/log-login', function (req, res) {
  var token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  var session = db
    .prepare('SELECT s.*, u.email, u.name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?')
    .get(token);
  if (!session) return res.status(401).json({ error: 'Invalid session' });

  var now = new Date().toISOString();
  db.prepare(
    "INSERT INTO login_history (user_id, user_email, user_name, event_type, portal, ip, device, created_at) VALUES (?, ?, ?, 'Login', ?, ?, ?, ?)"
  ).run(
    session.user_id,
    session.email,
    session.name,
    req.body.portal || 'Main',
    req.body.ip || req.ip || '',
    req.body.device || req.headers['user-agent'] || '',
    now
  );
  res.json({ success: true });
});

router.post('/log-logout', authenticate, function (req, res) {
  var now = new Date().toISOString();
  var lastLogin = db
    .prepare("SELECT created_at FROM login_history WHERE user_id = ? AND event_type = 'Login' ORDER BY created_at DESC LIMIT 1")
    .get(req.user.user_id);
  var duration = 0;
  if (lastLogin) duration = Math.round((new Date(now) - new Date(lastLogin.created_at)) / 1000);

  db.prepare(
    "INSERT INTO login_history (user_id, user_email, user_name, event_type, portal, ip, device, session_duration, created_at) VALUES (?, ?, ?, 'Logout', ?, ?, ?, ?, ?)"
  ).run(
    req.user.user_id,
    req.user.email,
    req.user.name,
    req.body.portal || 'Main',
    req.body.ip || req.ip || '',
    req.body.device || req.headers['user-agent'] || '',
    duration,
    now
  );
  res.json({ success: true });
});

// ─── LOGIN HISTORY ────────────────────────────────────────
router.get('/login-history/:userId', authenticate, requirePhase2, function (req, res) {
  var rows = db
    .prepare('SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(req.params.userId);
  res.json(rows);
});

// ─── ACTIVITY DASHBOARD ──────────────────────────────────
router.get('/activity-dashboard', authenticate, requirePhase2, function (req, res) {
  var allUsers = db.prepare('SELECT id, email, name, role, job_title FROM users').all();
  var today = new Date().toISOString().split('T')[0];
  var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  var loggedInToday = db
    .prepare("SELECT DISTINCT user_id FROM login_history WHERE event_type = 'Login' AND created_at >= ?")
    .all(today);
  var loggedInWeek = db
    .prepare("SELECT DISTINCT user_id FROM login_history WHERE event_type = 'Login' AND created_at >= ?")
    .all(weekAgo);
  var lastLogins = db
    .prepare("SELECT user_id, MAX(created_at) as last_login FROM login_history WHERE event_type = 'Login' GROUP BY user_id")
    .all();

  var lastLoginMap = {};
  lastLogins.forEach(function (r) { lastLoginMap[r.user_id] = r.last_login; });

  var users = allUsers.map(function (u) {
    var ll = lastLoginMap[u.id] || null;
    var daysSince = ll ? Math.floor((Date.now() - new Date(ll).getTime()) / 86400000) : null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      jobTitle: u.job_title,
      lastLogin: ll,
      daysSinceLogin: daysSince,
      status: daysSince === null ? 'never' : daysSince > 30 ? 'dormant' : daysSince > 21 ? 'at_risk' : 'active',
    };
  });

  res.json({
    total: allUsers.length,
    loggedInToday: loggedInToday.length,
    loggedInThisWeek: loggedInWeek.length,
    dormant: users.filter(function (u) { return u.status === 'dormant'; }).length,
    atRisk: users.filter(function (u) { return u.status === 'at_risk'; }).length,
    neverLoggedIn: users.filter(function (u) { return u.status === 'never'; }).length,
    users: users,
  });
});

// ─── AT-RISK USERS ────────────────────────────────────────
router.get('/at-risk', authenticate, requirePhase2, function (req, res) {
  var allUsers = db.prepare('SELECT id, email, name, role, job_title FROM users').all();
  var lastLogins = db
    .prepare("SELECT user_id, MAX(created_at) as last_login FROM login_history WHERE event_type = 'Login' GROUP BY user_id")
    .all();
  var lastLoginMap = {};
  lastLogins.forEach(function (r) { lastLoginMap[r.user_id] = r.last_login; });

  var atRisk = allUsers
    .filter(function (u) {
      var ll = lastLoginMap[u.id];
      if (!ll) return true;
      return Math.floor((Date.now() - new Date(ll).getTime()) / 86400000) >= 21;
    })
    .map(function (u) {
      var ll = lastLoginMap[u.id] || null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        lastLogin: ll,
        daysSinceLogin: ll ? Math.floor((Date.now() - new Date(ll).getTime()) / 86400000) : null,
      };
    });

  res.json(atRisk);
});

// ─── CHECK DORMANT USERS ─────────────────────────────────
router.post('/check-dormant', authenticate, function (req, res) {
  if (!isSeniorRole(req.user)) return res.status(403).json({ error: 'Super Admin only' });

  var allUsers = db
    .prepare("SELECT id, email, name, role, job_title FROM users WHERE role NOT IN ('superadmin', 'director')")
    .all();
  var lastLogins = db
    .prepare("SELECT user_id, MAX(created_at) as last_login FROM login_history WHERE event_type = 'Login' GROUP BY user_id")
    .all();
  var lastLoginMap = {};
  lastLogins.forEach(function (r) { lastLoginMap[r.user_id] = r.last_login; });

  var dormant = allUsers.filter(function (u) {
    var ll = lastLoginMap[u.id];
    if (!ll) return false;
    return Math.floor((Date.now() - new Date(ll).getTime()) / 86400000) > 30;
  });

  res.json({ dormantCount: dormant.length, users: dormant });
});

// ─── INACTIVATE / REACTIVATE USER ────────────────────────
router.post('/inactivate/:id', authenticate, function (req, res) {
  if (req.user.role !== 'superadmin' && req.user.role !== 'director') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  var target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
  logAudit(req.user, 'inactivate_user', 'User', String(target.id), target.name || target.email, 'Status', 'Active', 'Inactive — Dormant');
  res.json({ success: true });
});

router.post('/reactivate/:id', authenticate, function (req, res) {
  if (req.user.role !== 'superadmin' && req.user.role !== 'director') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  var target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  logAudit(req.user, 'reactivate_user', 'User', String(target.id), target.name || target.email, 'Status', 'Inactive', 'Active — Reactivated');
  res.json({ success: true });
});

module.exports = router;
