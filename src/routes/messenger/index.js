const express = require('express');
const crypto = require('crypto');
const { db } = require('../../db/sqlite');
const { authenticate } = require('../../middleware/auth');
const { uploadGeneral } = require('../../config/upload');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// ═══ MESSENGER API — SUPPORT WORKER + ADMIN ══════════════════
// ═══════════════════════════════════════════════════════════════

// ── SW Auth Middleware (reused from support-worker routes) ──
function swAuth(req, res, next) {
  var token = req.headers['x-sw-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  var session = db.prepare('SELECT sw.*, s.token FROM sw_sessions s JOIN sw_users sw ON s.sw_user_id = sw.id WHERE s.token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Invalid session' });
  req.swUser = session;
  req.userEmail = (session.email || '').toLowerCase();
  req.userName = session.full_name || session.email;
  req.userType = 'support_worker';
  next();
}

// ── Admin auth wrapper ──
function adminAuth(req, res, next) {
  authenticate(req, res, function () {
    req.userEmail = (req.user.email || '').toLowerCase();
    req.userName = req.user.name || req.user.email;
    req.userType = 'admin';
    next();
  });
}

// ── Dual auth: tries SW token first, falls back to admin ──
function dualAuth(req, res, next) {
  var swToken = req.headers['x-sw-token'];
  if (swToken) return swAuth(req, res, next);
  return adminAuth(req, res, next);
}

// ═══════════════════════════════════════════════════════════════
// ═══ DB MIGRATIONS ═══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

function migrateMessenger() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messenger_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'group',
      description TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      read_only INTEGER DEFAULT 0,
      created_by_email TEXT,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messenger_channel_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT DEFAULT '',
      user_type TEXT DEFAULT 'support_worker',
      role TEXT DEFAULT 'member',
      photo_url TEXT DEFAULT '',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME,
      FOREIGN KEY(channel_id) REFERENCES messenger_channels(id),
      UNIQUE(channel_id, user_email)
    );

    CREATE INDEX IF NOT EXISTS idx_mcm_channel ON messenger_channel_members(channel_id);
    CREATE INDEX IF NOT EXISTS idx_mcm_email ON messenger_channel_members(user_email);

    CREATE TABLE IF NOT EXISTS messenger_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      sender_email TEXT NOT NULL,
      sender_name TEXT DEFAULT '',
      sender_type TEXT DEFAULT 'support_worker',
      content TEXT DEFAULT '',
      message_type TEXT DEFAULT 'text',
      attachments TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(channel_id) REFERENCES messenger_channels(id)
    );

    CREATE INDEX IF NOT EXISTS idx_mm_channel ON messenger_messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_mm_created ON messenger_messages(created_at);

    CREATE TABLE IF NOT EXISTS messenger_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default channels if empty
  var count = db.prepare('SELECT COUNT(*) as cnt FROM messenger_channels').get().cnt;
  if (count === 0) {
    db.prepare("INSERT INTO messenger_channels (name, type, description, pinned, read_only) VALUES (?, ?, ?, ?, ?)").run('Rosters Team', 'group', 'Contact the rosters team for shift swaps, availability, and scheduling queries', 1, 0);
    db.prepare("INSERT INTO messenger_channels (name, type, description, pinned, read_only) VALUES (?, ?, ?, ?, ?)").run('All Staff Announcements', 'broadcast', 'Important announcements from management', 0, 1);

    // Seed message templates
    db.prepare("INSERT INTO messenger_templates (name, content, category) VALUES (?, ?, ?)").run('Shift Reminder', 'Reminder: You have a shift tomorrow at {time} with {client}. Please confirm your availability.', 'shift');
    db.prepare("INSERT INTO messenger_templates (name, content, category) VALUES (?, ?, ?)").run('Shift Change', 'Your shift on {date} has been updated. New time: {time}. Client: {client}. Please acknowledge.', 'shift');
    db.prepare("INSERT INTO messenger_templates (name, content, category) VALUES (?, ?, ?)").run('Urgent Coverage', 'URGENT: We need coverage for a shift on {date} at {time} with {client}. Please reply ASAP if available.', 'urgent');
    db.prepare("INSERT INTO messenger_templates (name, content, category) VALUES (?, ?, ?)").run('General Announcement', '{message}', 'general');
  }
}

// Run migrations on load
migrateMessenger();

// ═══════════════════════════════════════════════════════════════
// ═══ CHANNEL ROUTES ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

// ── Auto-enroll user into default channels ──
function autoEnrollWorker(email, name, userType) {
  // Get all pinned channels + broadcast channels (Rosters Team, All Staff, etc.)
  var defaults = db.prepare(
    "SELECT id FROM messenger_channels WHERE pinned = 1 OR type = 'broadcast'"
  ).all();
  var role = userType === 'admin' ? 'admin' : 'member';
  defaults.forEach(function (ch) {
    db.prepare(
      "INSERT OR IGNORE INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role) VALUES (?, ?, ?, ?, ?)"
    ).run(ch.id, email, name, userType, role);
  });
}

// GET /api/messenger/channels — list channels for current user
router.get('/channels', dualAuth, function (req, res) {
  var email = req.userEmail;

  // Auto-enroll support workers into default channels on first access
  autoEnrollWorker(email, req.userName, req.userType);

  var rows = db.prepare(
    "SELECT c.id, c.name, c.type, c.description, c.pinned, c.read_only, c.updated_at " +
    "FROM messenger_channels c " +
    "JOIN messenger_channel_members m ON m.channel_id = c.id " +
    "WHERE LOWER(m.user_email) = ? " +
    "ORDER BY c.pinned DESC, c.updated_at DESC"
  ).all(email);

  var result = rows.map(function (r) {
    var lastMsg = db.prepare(
      "SELECT content, sender_name, message_type, created_at FROM messenger_messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(r.id);

    var member = db.prepare(
      "SELECT last_read_at FROM messenger_channel_members WHERE channel_id = ? AND LOWER(user_email) = ?"
    ).get(r.id, email);

    var unreadCount = 0;
    if (member && member.last_read_at) {
      unreadCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM messenger_messages WHERE channel_id = ? AND created_at > ? AND LOWER(sender_email) != ?"
      ).get(r.id, member.last_read_at, email).cnt;
    } else if (member) {
      unreadCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM messenger_messages WHERE channel_id = ? AND LOWER(sender_email) != ?"
      ).get(r.id, email).cnt;
    }

    var memberCount = db.prepare("SELECT COUNT(*) as cnt FROM messenger_channel_members WHERE channel_id = ?").get(r.id).cnt;

    return {
      id: r.id,
      name: r.name,
      type: r.type,
      description: r.description,
      pinned: r.pinned,
      read_only: r.read_only,
      lastMessage: lastMsg || null,
      unreadCount: unreadCount,
      memberCount: memberCount,
      updated_at: r.updated_at
    };
  });

  res.json(result);
});

// GET /api/messenger/channels/:id — get channel messages
router.get('/channels/:id', dualAuth, function (req, res) {
  var channelId = req.params.id;
  var channel = db.prepare("SELECT * FROM messenger_channels WHERE id = ?").get(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  var limit = parseInt(req.query.limit) || 50;
  var before = req.query.before;
  var messages;
  if (before) {
    messages = db.prepare(
      "SELECT * FROM messenger_messages WHERE channel_id = ? AND id < ? ORDER BY created_at DESC LIMIT ?"
    ).all(channelId, before, limit).reverse();
  } else {
    messages = db.prepare(
      "SELECT * FROM messenger_messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(channelId, limit).reverse();
  }

  var members = db.prepare(
    "SELECT user_email, user_name, user_type, role, photo_url FROM messenger_channel_members WHERE channel_id = ?"
  ).all(channelId);

  // Mark as read
  db.prepare(
    "UPDATE messenger_channel_members SET last_read_at = datetime('now') WHERE channel_id = ? AND LOWER(user_email) = ?"
  ).run(channelId, req.userEmail);

  res.json({
    id: channel.id,
    name: channel.name,
    type: channel.type,
    description: channel.description,
    pinned: channel.pinned,
    read_only: channel.read_only,
    members: members,
    messages: messages.map(function (m) {
      var att = [];
      try { att = JSON.parse(m.attachments || '[]'); } catch (e) { }
      var meta = {};
      try { meta = JSON.parse(m.metadata || '{}'); } catch (e) { }
      return {
        id: m.id,
        sender_email: m.sender_email,
        sender_name: m.sender_name,
        sender_type: m.sender_type,
        content: m.content,
        message_type: m.message_type,
        attachments: att,
        metadata: meta,
        created_at: m.created_at
      };
    })
  });
});

// POST /api/messenger/channels/:id/message — send message
router.post('/channels/:id/message', dualAuth, function (req, res) {
  var channelId = req.params.id;
  var content = (req.body.content || '').trim();
  var messageType = req.body.message_type || 'text';
  var metadata = req.body.metadata || {};

  if (!content && messageType === 'text') return res.status(400).json({ error: 'Content required' });

  var channel = db.prepare("SELECT * FROM messenger_channels WHERE id = ?").get(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  // Check read-only for non-admin
  if (channel.read_only && req.userType === 'support_worker') {
    return res.status(403).json({ error: 'This channel is read-only' });
  }

  var result = db.prepare(
    "INSERT INTO messenger_messages (channel_id, sender_email, sender_name, sender_type, content, message_type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(channelId, req.userEmail, req.userName, req.userType, content, messageType, JSON.stringify(metadata));

  db.prepare("UPDATE messenger_channels SET updated_at = datetime('now') WHERE id = ?").run(channelId);

  // Mark sender as read
  db.prepare(
    "UPDATE messenger_channel_members SET last_read_at = datetime('now') WHERE channel_id = ? AND LOWER(user_email) = ?"
  ).run(channelId, req.userEmail);

  var msg = {
    id: result.lastInsertRowid,
    channel_id: parseInt(channelId),
    sender_email: req.userEmail,
    sender_name: req.userName,
    sender_type: req.userType,
    content: content,
    message_type: messageType,
    metadata: metadata,
    created_at: new Date().toISOString()
  };

  // Emit via socket.io
  var io = req.app.get('io');
  if (io) {
    io.to('messenger:' + channelId).emit('messenger:message', msg);
    io.emit('messenger:update', { channel_id: parseInt(channelId) });
  }

  res.json(msg);
});

// POST /api/messenger/channels/:id/attachment — send with file
router.post('/channels/:id/attachment', dualAuth, uploadGeneral.array('files', 5), function (req, res) {
  var channelId = req.params.id;
  var content = req.body.content || '';
  var messageType = req.body.message_type || 'file';

  var attachments = (req.files || []).map(function (f) {
    return { name: f.originalname, url: '/uploads/' + f.filename, size: f.size, type: f.mimetype };
  });

  var result = db.prepare(
    "INSERT INTO messenger_messages (channel_id, sender_email, sender_name, sender_type, content, message_type, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(channelId, req.userEmail, req.userName, req.userType, content, messageType, JSON.stringify(attachments));

  db.prepare("UPDATE messenger_channels SET updated_at = datetime('now') WHERE id = ?").run(channelId);

  var msg = {
    id: result.lastInsertRowid,
    channel_id: parseInt(channelId),
    sender_email: req.userEmail,
    sender_name: req.userName,
    content: content,
    message_type: messageType,
    attachments: attachments,
    created_at: new Date().toISOString()
  };

  var io = req.app.get('io');
  if (io) {
    io.to('messenger:' + channelId).emit('messenger:message', msg);
  }

  res.json(msg);
});

// POST /api/messenger/channels/:id/read — mark as read
router.post('/channels/:id/read', dualAuth, function (req, res) {
  db.prepare(
    "UPDATE messenger_channel_members SET last_read_at = datetime('now') WHERE channel_id = ? AND LOWER(user_email) = ?"
  ).run(req.params.id, req.userEmail);
  res.json({ success: true });
});

// GET /api/messenger/unread — total unread count for badge
router.get('/unread', dualAuth, function (req, res) {
  var email = req.userEmail;

  // Auto-enroll support workers so they see default channel messages
  autoEnrollWorker(email, req.userName, req.userType);

  var channels = db.prepare(
    "SELECT c.id, m.last_read_at FROM messenger_channels c " +
    "JOIN messenger_channel_members m ON m.channel_id = c.id " +
    "WHERE LOWER(m.user_email) = ?"
  ).all(email);

  var total = 0;
  channels.forEach(function (ch) {
    if (ch.last_read_at) {
      total += db.prepare(
        "SELECT COUNT(*) as cnt FROM messenger_messages WHERE channel_id = ? AND created_at > ? AND LOWER(sender_email) != ?"
      ).get(ch.id, ch.last_read_at, email).cnt;
    } else {
      total += db.prepare(
        "SELECT COUNT(*) as cnt FROM messenger_messages WHERE channel_id = ? AND LOWER(sender_email) != ?"
      ).get(ch.id, email).cnt;
    }
  });

  res.json({ unread: total });
});

// ═══════════════════════════════════════════════════════════════
// ═══ ADMIN ROUTES ════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════

// POST /api/messenger/channels — create channel (admin only)
router.post('/channels', adminAuth, function (req, res) {
  var name = req.body.name || '';
  var type = req.body.type || 'group';
  var description = req.body.description || '';
  var pinned = req.body.pinned ? 1 : 0;
  var readOnly = req.body.read_only ? 1 : 0;
  var members = req.body.members || [];

  if (!name) return res.status(400).json({ error: 'Channel name required' });

  var result = db.prepare(
    "INSERT INTO messenger_channels (name, type, description, pinned, read_only, created_by_email, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(name, type, description, pinned, readOnly, req.userEmail, req.userName);

  var channelId = result.lastInsertRowid;

  // Add creator
  db.prepare(
    "INSERT OR IGNORE INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role) VALUES (?, ?, ?, ?, ?)"
  ).run(channelId, req.userEmail, req.userName, 'admin', 'admin');

  // Add members
  members.forEach(function (m) {
    db.prepare(
      "INSERT OR IGNORE INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role, photo_url) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(channelId, (m.email || '').toLowerCase(), m.name || '', m.type || 'support_worker', m.role || 'member', m.photo_url || '');
  });

  res.json({ id: channelId, name: name });
});

// POST /api/messenger/channels/:id/members — add member (admin)
router.post('/channels/:id/members', adminAuth, function (req, res) {
  var channelId = req.params.id;
  var email = (req.body.email || '').toLowerCase();
  var name = req.body.name || '';
  var type = req.body.user_type || 'support_worker';

  if (!email) return res.status(400).json({ error: 'Email required' });

  db.prepare(
    "INSERT OR IGNORE INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role) VALUES (?, ?, ?, ?, ?)"
  ).run(channelId, email, name, type, 'member');

  res.json({ success: true });
});

// GET /api/messenger/admin/all-channels — all channels for admin view
router.get('/admin/all-channels', adminAuth, function (req, res) {
  var channels = db.prepare(
    "SELECT c.*, " +
    "(SELECT COUNT(*) FROM messenger_channel_members WHERE channel_id = c.id) as member_count, " +
    "(SELECT COUNT(*) FROM messenger_messages WHERE channel_id = c.id) as message_count " +
    "FROM messenger_channels c ORDER BY c.pinned DESC, c.updated_at DESC"
  ).all();

  res.json(channels);
});

// GET /api/messenger/admin/workers — list all support workers for messaging
router.get('/admin/workers', adminAuth, function (req, res) {
  var workers = db.prepare(
    "SELECT id, email, full_name, contact_type, type_of_employment, photo_url, phone FROM sw_users ORDER BY full_name ASC"
  ).all();
  res.json(workers);
});

// POST /api/messenger/admin/add-worker-to-channel — bulk add workers
router.post('/admin/add-worker-to-channel', adminAuth, function (req, res) {
  var channelId = req.body.channel_id;
  var workers = req.body.workers || [];

  workers.forEach(function (w) {
    db.prepare(
      "INSERT OR IGNORE INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role, photo_url) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(channelId, (w.email || '').toLowerCase(), w.name || w.full_name || '', 'support_worker', 'member', w.photo_url || '');
  });

  res.json({ success: true, added: workers.length });
});

// POST /api/messenger/admin/broadcast — send to all members of a channel
router.post('/admin/broadcast', adminAuth, function (req, res) {
  var channelId = req.body.channel_id;
  var content = (req.body.content || '').trim();
  if (!channelId || !content) return res.status(400).json({ error: 'channel_id and content required' });

  var result = db.prepare(
    "INSERT INTO messenger_messages (channel_id, sender_email, sender_name, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(channelId, req.userEmail, req.userName, 'admin', content, 'announcement');

  db.prepare("UPDATE messenger_channels SET updated_at = datetime('now') WHERE id = ?").run(channelId);

  var io = req.app.get('io');
  if (io) {
    io.to('messenger:' + channelId).emit('messenger:message', {
      id: result.lastInsertRowid,
      channel_id: parseInt(channelId),
      sender_email: req.userEmail,
      sender_name: req.userName,
      sender_type: 'admin',
      content: content,
      message_type: 'announcement',
      created_at: new Date().toISOString()
    });
  }

  res.json({ success: true });
});

// GET /api/messenger/templates — get message templates
router.get('/templates', adminAuth, function (req, res) {
  var templates = db.prepare("SELECT * FROM messenger_templates ORDER BY category, name").all();
  res.json(templates);
});

// POST /api/messenger/admin/direct — create DM with a support worker
router.post('/admin/direct', adminAuth, function (req, res) {
  var workerEmail = (req.body.worker_email || '').toLowerCase();
  var workerName = req.body.worker_name || '';
  if (!workerEmail) return res.status(400).json({ error: 'worker_email required' });

  // Check existing DM
  var existing = db.prepare(
    "SELECT c.id FROM messenger_channels c " +
    "JOIN messenger_channel_members m1 ON m1.channel_id = c.id AND LOWER(m1.user_email) = ? " +
    "JOIN messenger_channel_members m2 ON m2.channel_id = c.id AND LOWER(m2.user_email) = ? " +
    "WHERE c.type = 'direct'"
  ).get(req.userEmail, workerEmail);

  if (existing) return res.json({ id: existing.id, existing: true });

  var result = db.prepare(
    "INSERT INTO messenger_channels (name, type, created_by_email, created_by_name) VALUES (?, 'direct', ?, ?)"
  ).run(workerName || workerEmail, req.userEmail, req.userName);

  var channelId = result.lastInsertRowid;

  db.prepare(
    "INSERT INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role) VALUES (?, ?, ?, ?, ?)"
  ).run(channelId, req.userEmail, req.userName, 'admin', 'admin');
  db.prepare(
    "INSERT INTO messenger_channel_members (channel_id, user_email, user_name, user_type, role) VALUES (?, ?, ?, ?, ?)"
  ).run(channelId, workerEmail, workerName, 'support_worker', 'member');

  res.json({ id: channelId, existing: false });
});

// GET /api/messenger/admin/search — search messages
router.get('/admin/search', adminAuth, function (req, res) {
  var q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  var messages = db.prepare(
    "SELECT mm.*, mc.name as channel_name FROM messenger_messages mm " +
    "JOIN messenger_channels mc ON mc.id = mm.channel_id " +
    "WHERE mm.content LIKE ? ORDER BY mm.created_at DESC LIMIT 50"
  ).all('%' + q + '%');

  res.json(messages);
});

module.exports = router;
