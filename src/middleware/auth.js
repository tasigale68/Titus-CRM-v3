const crypto = require('crypto');
const { db } = require('../db/sqlite');

const SALT = 'titus-salt-2026';

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + SALT).digest('hex');
}

function authenticate(req, res, next) {
  var token = req.headers.authorization
    ? req.headers.authorization.replace('Bearer ', '')
    : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  var session = db
    .prepare(
      'SELECT s.*, u.id as user_id, u.email, u.name, u.role, u.job_title, u.permissions FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
    )
    .get(token);

  if (!session) return res.status(401).json({ error: 'Invalid session' });

  req.user = session;
  next();
}

function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    var role = (req.user.role || '').toLowerCase().replace(/\s+/g, '_');
    if (roles.indexOf(role) < 0) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requirePhase2(req, res, next) {
  var PHASE2_ROLES = ['superadmin', 'director', 'admin', 'team_leader', 'roster_officer', 'manager', 'ceo'];
  var role = (req.user.role || '').toLowerCase().replace(/\s+/g, '_');
  if (PHASE2_ROLES.indexOf(role) < 0) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This feature is available to Team Leaders, Roster Officers, Managers, Directors and CEO only.',
    });
  }
  next();
}

function seedUsers() {
  var saStmt = db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'superadmin') " +
    "ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, role = 'superadmin'"
  );
  saStmt.run('gus@deltacommunity.com.au', hashPassword('1234'), 'Gus');
  console.log('Seeded/synced user: gus@deltacommunity.com.au (superadmin)');

  var dirStmt = db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'director') " +
    "ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, role = 'director'"
  );
  dirStmt.run('rina@deltacommunity.com.au', hashPassword('1234'), 'Rina');
  console.log('Seeded/synced user: rina@deltacommunity.com.au (director)');

  console.log('Admin users ready');
}

module.exports = { authenticate, requireRole, requirePhase2, hashPassword, seedUsers };
