const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { db } = require('../../db/sqlite');
const { uploadGeneral } = require('../../config/upload');

const router = express.Router();
router.use(authenticate);

// GET /api/chat/conversations — list user's conversations
router.get('/conversations', function (req, res) {
  var email = (req.user.email || '').toLowerCase();
  var rows = db.prepare(
    "SELECT c.id, c.title, c.type, c.created_by_name, c.updated_at " +
    "FROM chat_conversations c " +
    "JOIN chat_members m ON m.conversation_id = c.id " +
    "WHERE LOWER(m.user_email) = ? " +
    "ORDER BY c.updated_at DESC"
  ).all(email);

  var result = rows.map(function (r) {
    // Get last message
    var lastMsg = db.prepare(
      "SELECT content, sender_name, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(r.id);
    // Get unread count
    var member = db.prepare(
      "SELECT last_read_at FROM chat_members WHERE conversation_id = ? AND LOWER(user_email) = ?"
    ).get(r.id, email);
    var unreadCount = 0;
    if (member && member.last_read_at) {
      unreadCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM chat_messages WHERE conversation_id = ? AND created_at > ? AND LOWER(sender_email) != ?"
      ).get(r.id, member.last_read_at, email).cnt;
    }
    // Get member names for title
    var members = db.prepare("SELECT user_name FROM chat_members WHERE conversation_id = ?").all(r.id);
    var title = r.title;
    if (!title && r.type === 'direct') {
      title = members.filter(function (m) { return m.user_name && m.user_name !== req.user.name; }).map(function (m) { return m.user_name; }).join(', ') || 'Direct Message';
    }
    return {
      id: r.id,
      title: title || 'Chat',
      type: r.type,
      lastMessage: lastMsg ? lastMsg.content : '',
      lastMessageTime: lastMsg ? lastMsg.created_at : r.updated_at,
      unreadCount: unreadCount,
      updated_at: r.updated_at
    };
  });
  res.json(result);
});

// GET /api/chat/conversations/:id — get conversation thread
router.get('/conversations/:id', function (req, res) {
  var convId = req.params.id;
  var conv = db.prepare("SELECT * FROM chat_conversations WHERE id = ?").get(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  var messages = db.prepare(
    "SELECT id, sender_email, sender_name, content, attachments, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC"
  ).all(convId);
  var members = db.prepare("SELECT user_name FROM chat_members WHERE conversation_id = ?").all(convId);
  var title = conv.title;
  if (!title && conv.type === 'direct') {
    title = members.filter(function (m) { return m.user_name !== req.user.name; }).map(function (m) { return m.user_name; }).join(', ') || 'Direct Message';
  }
  res.json({ id: conv.id, title: title || 'Chat', type: conv.type, messages: messages });
});

// POST /api/chat/conversations/direct — create or get direct message
router.post('/conversations/direct', function (req, res) {
  var recipientEmail = (req.body.recipientEmail || '').toLowerCase();
  var senderEmail = (req.user.email || '').toLowerCase();
  if (!recipientEmail) return res.status(400).json({ error: 'recipientEmail required' });

  // Check if DM already exists between these two users
  var existing = db.prepare(
    "SELECT c.id FROM chat_conversations c " +
    "JOIN chat_members m1 ON m1.conversation_id = c.id AND LOWER(m1.user_email) = ? " +
    "JOIN chat_members m2 ON m2.conversation_id = c.id AND LOWER(m2.user_email) = ? " +
    "WHERE c.type = 'direct'"
  ).get(senderEmail, recipientEmail);

  if (existing) return res.json({ id: existing.id });

  // Create new direct conversation
  var result = db.prepare(
    "INSERT INTO chat_conversations (type, created_by, created_by_name, created_by_email, updated_at) VALUES ('direct', ?, ?, ?, datetime('now'))"
  ).run(req.user.id, req.user.name || '', senderEmail);

  var convId = result.lastInsertRowid;

  // Add both members
  db.prepare("INSERT INTO chat_members (conversation_id, user_email, user_name) VALUES (?, ?, ?)").run(convId, senderEmail, req.user.name || '');
  // Lookup recipient name from users table
  var recipientUser = db.prepare("SELECT name FROM users WHERE LOWER(email) = ?").get(recipientEmail);
  db.prepare("INSERT INTO chat_members (conversation_id, user_email, user_name) VALUES (?, ?, ?)").run(convId, recipientEmail, (recipientUser && recipientUser.name) || '');

  res.json({ id: convId });
});

// POST /api/chat/conversations — create group conversation
router.post('/conversations', function (req, res) {
  var title = req.body.title || 'Group Chat';
  var members = req.body.members || [];
  var senderEmail = (req.user.email || '').toLowerCase();

  var result = db.prepare(
    "INSERT INTO chat_conversations (title, type, created_by, created_by_name, created_by_email, updated_at) VALUES (?, 'group', ?, ?, ?, datetime('now'))"
  ).run(title, req.user.id, req.user.name || '', senderEmail);

  var convId = result.lastInsertRowid;

  // Add creator
  db.prepare("INSERT INTO chat_members (conversation_id, user_email, user_name) VALUES (?, ?, ?)").run(convId, senderEmail, req.user.name || '');

  // Add members
  members.forEach(function (email) {
    var memberUser = db.prepare("SELECT name FROM users WHERE LOWER(email) = ?").get(email.toLowerCase());
    db.prepare("INSERT INTO chat_members (conversation_id, user_email, user_name) VALUES (?, ?, ?)").run(convId, email.toLowerCase(), (memberUser && memberUser.name) || '');
  });

  res.json({ id: convId });
});

// POST /api/chat/message — send message
router.post('/message', function (req, res) {
  var convId = req.body.conversation_id;
  var content = req.body.content || '';
  if (!convId || !content) return res.status(400).json({ error: 'conversation_id and content required' });

  db.prepare(
    "INSERT INTO chat_messages (conversation_id, sender_email, sender_name, content) VALUES (?, ?, ?, ?)"
  ).run(convId, req.user.email || '', req.user.name || '', content);

  // Update conversation timestamp
  db.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);

  // Emit socket event
  var io = req.app.get('io');
  if (io) {
    io.emit('chat:message', { conversation_id: convId, sender: req.user.name, content: content });
  }

  res.json({ success: true });
});

// POST /api/chat/conversations/:id/read — mark as read
router.post('/conversations/:id/read', function (req, res) {
  var convId = req.params.id;
  var email = (req.user.email || '').toLowerCase();
  db.prepare("UPDATE chat_members SET last_read_at = datetime('now') WHERE conversation_id = ? AND LOWER(user_email) = ?").run(convId, email);
  res.json({ success: true });
});

// POST /api/chat/attachment — send message with file attachments
router.post('/attachment', uploadGeneral.array('files', 5), function (req, res) {
  var convId = req.body.conversation_id;
  var content = req.body.content || '';
  var attachments = (req.files || []).map(function (f) {
    return { name: f.originalname, url: '/uploads/' + f.filename, size: f.size };
  });

  db.prepare(
    "INSERT INTO chat_messages (conversation_id, sender_email, sender_name, content, attachments) VALUES (?, ?, ?, ?, ?)"
  ).run(convId, req.user.email || '', req.user.name || '', content, JSON.stringify(attachments));

  db.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(convId);

  res.json({ success: true });
});

module.exports = router;
