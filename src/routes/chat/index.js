var express = require('express');
var { authenticate } = require('../../middleware/auth');
var { db } = require('../../db/sqlite');
var { uploadGeneral } = require('../../config/upload');
var sb = require('../../services/supabaseClient');

var router = express.Router();
router.use(authenticate);

// ═══════════════════════════════════════════════════════════
//  Helper: get tenant_id from session (fallback to a default)
// ═══════════════════════════════════════════════════════════
function getTenantId(req) {
  return (req.tenant && req.tenant.id) || (req.session && req.session.tenant_id) || null;
}

// ═══════════════════════════════════════════════════════════
//  GET /api/chat/conversations — list user's conversations
// ═══════════════════════════════════════════════════════════
router.get('/conversations', function (req, res) {
  var email = (req.user.email || '').toLowerCase();
  var tenantId = getTenantId(req);

  // Query conversations where the user's email is in the members JSONB array
  var params = {
    contains: { members: [email] },
    order: 'created_at.desc'
  };
  if (tenantId) params.eq = { tenant_id: tenantId };

  sb.query('chat_conversations', 'GET', params).then(function (convos) {
    if (!convos || convos.length === 0) return res.json([]);

    // For each conversation, get last message and unread count
    var promises = convos.map(function (conv) {
      // Get last message
      var msgParams = {
        eq: { conversation_id: conv.id },
        order: 'created_at.desc',
        limit: 1
      };

      return sb.query('chat_messages', 'GET', msgParams).then(function (msgs) {
        var lastMsg = (msgs && msgs.length > 0) ? msgs[0] : null;

        // Compute unread count from read_by JSONB
        // We need to count messages not read by this user
        var unreadParams = {
          eq: { conversation_id: conv.id },
          order: 'created_at.desc'
        };

        return sb.query('chat_messages', 'GET', unreadParams).then(function (allMsgs) {
          var unreadCount = 0;
          (allMsgs || []).forEach(function (m) {
            var readBy = m.read_by || [];
            if (readBy.indexOf(email) < 0 && (m.sender_name || '').toLowerCase() !== email) {
              unreadCount++;
            }
          });

          // Build title
          var title = conv.name;
          if (!title && conv.type === 'direct') {
            var members = conv.members || [];
            title = members.filter(function (m) {
              return m && m.toLowerCase() !== email;
            }).join(', ') || 'Direct Message';
          }

          return {
            id: conv.id,
            title: title || 'Chat',
            type: conv.type || 'group',
            lastMessage: lastMsg ? lastMsg.content : '',
            lastMessageTime: lastMsg ? lastMsg.created_at : conv.created_at,
            unreadCount: unreadCount,
            updated_at: conv.created_at
          };
        });
      });
    });

    return Promise.all(promises).then(function (results) {
      res.json(results);
    });
  }).catch(function (e) {
    console.error('[CHAT] conversations error:', e.message);
    res.status(500).json({ error: 'Failed to load conversations' });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/chat/conversations/:id — get conversation thread
// ═══════════════════════════════════════════════════════════
router.get('/conversations/:id', function (req, res) {
  var convId = req.params.id;
  var email = (req.user.email || '').toLowerCase();

  // Get conversation
  sb.query('chat_conversations', 'GET', { eq: { id: convId } }).then(function (convos) {
    if (!convos || convos.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    var conv = convos[0];

    // Get messages
    return sb.query('chat_messages', 'GET', {
      eq: { conversation_id: convId },
      order: 'created_at.asc'
    }).then(function (messages) {
      // Map messages to match frontend expected format
      var mappedMessages = (messages || []).map(function (m) {
        return {
          id: m.id,
          sender_email: m.sender_id || '',
          sender_name: m.sender_name || '',
          content: m.content || '',
          attachments: m.attachment_url ? JSON.stringify([{ url: m.attachment_url, type: m.attachment_type }]) : null,
          created_at: m.created_at
        };
      });

      var title = conv.name;
      if (!title && conv.type === 'direct') {
        var members = conv.members || [];
        title = members.filter(function (m) {
          return m && m.toLowerCase() !== email;
        }).join(', ') || 'Direct Message';
      }

      res.json({ id: conv.id, title: title || 'Chat', type: conv.type, messages: mappedMessages });
    });
  }).catch(function (e) {
    console.error('[CHAT] conversation detail error:', e.message);
    res.status(500).json({ error: 'Failed to load conversation' });
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/chat/conversations/direct — create or get DM
// ═══════════════════════════════════════════════════════════
router.post('/conversations/direct', function (req, res) {
  var recipientEmail = (req.body.recipientEmail || '').toLowerCase();
  var senderEmail = (req.user.email || '').toLowerCase();
  var tenantId = getTenantId(req);
  if (!recipientEmail) return res.status(400).json({ error: 'recipientEmail required' });

  // Find existing direct conversations that contain both users
  var params = {
    eq: { type: 'direct' },
    contains: { members: [senderEmail] }
  };
  if (tenantId) params.eq.tenant_id = tenantId;

  sb.query('chat_conversations', 'GET', params).then(function (convos) {
    // Check if any conversation also contains the recipient
    var existing = (convos || []).find(function (c) {
      var members = c.members || [];
      return members.indexOf(recipientEmail) >= 0;
    });

    if (existing) return res.json({ id: existing.id });

    // Lookup recipient name from SQLite users table (still used for user management)
    var recipientUser = null;
    try { recipientUser = db.prepare("SELECT name FROM users WHERE LOWER(email) = ?").get(recipientEmail); } catch (e) { /* ignore */ }

    // Create new direct conversation with members JSONB array
    var newConv = {
      type: 'direct',
      members: [senderEmail, recipientEmail],
      name: null,
      pinned: false
    };
    if (tenantId) newConv.tenant_id = tenantId;

    return sb.insert('chat_conversations', newConv).then(function (rows) {
      if (rows && rows.length > 0) {
        res.json({ id: rows[0].id });
      } else {
        res.status(500).json({ error: 'Failed to create conversation' });
      }
    });
  }).catch(function (e) {
    console.error('[CHAT] direct conversation error:', e.message);
    res.status(500).json({ error: 'Failed to create direct conversation' });
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/chat/conversations — create group conversation
// ═══════════════════════════════════════════════════════════
router.post('/conversations', function (req, res) {
  var title = req.body.title || 'Group Chat';
  var members = req.body.members || [];
  var senderEmail = (req.user.email || '').toLowerCase();
  var tenantId = getTenantId(req);

  // Build members array with creator + all members (lowercase)
  var allMembers = [senderEmail];
  members.forEach(function (email) {
    var lower = (email || '').toLowerCase();
    if (lower && allMembers.indexOf(lower) < 0) allMembers.push(lower);
  });

  var newConv = {
    name: title,
    type: 'group',
    members: allMembers,
    pinned: false
  };
  if (tenantId) newConv.tenant_id = tenantId;

  sb.insert('chat_conversations', newConv).then(function (rows) {
    if (rows && rows.length > 0) {
      res.json({ id: rows[0].id });
    } else {
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }).catch(function (e) {
    console.error('[CHAT] create group error:', e.message);
    res.status(500).json({ error: 'Failed to create group conversation' });
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/chat/message — send message
// ═══════════════════════════════════════════════════════════
router.post('/message', function (req, res) {
  var convId = req.body.conversation_id;
  var content = req.body.content || '';
  var tenantId = getTenantId(req);
  if (!convId || !content) return res.status(400).json({ error: 'conversation_id and content required' });

  var newMsg = {
    conversation_id: convId,
    sender_id: req.user.email || '',
    sender_name: req.user.name || '',
    message_type: 'text',
    content: content,
    read_by: [req.user.email || '']
  };
  if (tenantId) newMsg.tenant_id = tenantId;

  sb.insert('chat_messages', newMsg).then(function () {
    // Emit socket event for real-time
    var io = req.app.get('io');
    if (io) {
      io.emit('chat:message', { conversation_id: convId, sender: req.user.name, content: content });
    }

    res.json({ success: true });
  }).catch(function (e) {
    console.error('[CHAT] send message error:', e.message);
    res.status(500).json({ error: 'Failed to send message' });
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/chat/conversations/:id/read — mark as read
// ═══════════════════════════════════════════════════════════
router.post('/conversations/:id/read', function (req, res) {
  var convId = req.params.id;
  var email = (req.user.email || '').toLowerCase();

  // Get all unread messages in this conversation and add user to read_by
  sb.query('chat_messages', 'GET', {
    eq: { conversation_id: convId }
  }).then(function (messages) {
    var updates = [];
    (messages || []).forEach(function (m) {
      var readBy = m.read_by || [];
      if (readBy.indexOf(email) < 0) {
        readBy.push(email);
        updates.push(
          sb.update('chat_messages', { eq: { id: m.id } }, { read_by: readBy })
        );
      }
    });
    return Promise.all(updates);
  }).then(function () {
    res.json({ success: true });
  }).catch(function (e) {
    console.error('[CHAT] mark read error:', e.message);
    res.status(500).json({ error: 'Failed to mark as read' });
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /api/chat/attachment — send message with file attachments
// ═══════════════════════════════════════════════════════════
router.post('/attachment', uploadGeneral.array('files', 5), function (req, res) {
  var convId = req.body.conversation_id;
  var content = req.body.content || '';
  var tenantId = getTenantId(req);
  var attachments = (req.files || []).map(function (f) {
    return { name: f.originalname, url: '/uploads/' + f.filename, size: f.size };
  });

  // Insert one message per attachment (or a single message with first attachment)
  var attachmentUrl = attachments.length > 0 ? JSON.stringify(attachments) : null;
  var attachmentType = attachments.length > 0 ? 'file' : null;

  var newMsg = {
    conversation_id: convId,
    sender_id: req.user.email || '',
    sender_name: req.user.name || '',
    message_type: attachments.length > 0 ? 'file' : 'text',
    content: content,
    attachment_url: attachmentUrl,
    attachment_type: attachmentType,
    read_by: [req.user.email || '']
  };
  if (tenantId) newMsg.tenant_id = tenantId;

  sb.insert('chat_messages', newMsg).then(function () {
    res.json({ success: true });
  }).catch(function (e) {
    console.error('[CHAT] attachment error:', e.message);
    res.status(500).json({ error: 'Failed to send attachment' });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/chat/unread-count — total unread messages for badge
// ═══════════════════════════════════════════════════════════
router.get('/unread-count', function (req, res) {
  var email = (req.user.email || '').toLowerCase();
  var tenantId = getTenantId(req);

  var params = { contains: { members: [email] }, order: 'created_at.desc' };
  if (tenantId) params.eq = { tenant_id: tenantId };

  sb.query('chat_conversations', 'GET', params).then(function (convos) {
    if (!convos || convos.length === 0) return res.json({ count: 0 });

    var promises = convos.map(function (conv) {
      return sb.query('chat_messages', 'GET', { eq: { conversation_id: conv.id } }).then(function (msgs) {
        var unread = 0;
        (msgs || []).forEach(function (m) {
          var readBy = m.read_by || [];
          if (readBy.indexOf(email) < 0 && (m.sender_id || '').toLowerCase() !== email) unread++;
        });
        return unread;
      });
    });

    return Promise.all(promises).then(function (counts) {
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      res.json({ count: total });
    });
  }).catch(function (e) {
    console.error('[CHAT] unread-count error:', e.message);
    res.json({ count: 0 });
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /api/chat/resolve-names — resolve emails to full names
// ═══════════════════════════════════════════════════════════
router.get('/resolve-names', function (req, res) {
  var emails = (req.query.emails || '').split(',').filter(function (e) { return e.trim(); });
  if (emails.length === 0) return res.json({});

  var nameMap = {};
  // Try SQLite users table first
  emails.forEach(function (email) {
    try {
      var user = db.prepare("SELECT name FROM users WHERE LOWER(email) = ?").get(email.toLowerCase().trim());
      if (user && user.name) nameMap[email.toLowerCase().trim()] = user.name;
    } catch (e) { /* ignore */ }
  });

  // For any unresolved, try Supabase contacts
  var unresolved = emails.filter(function (e) { return !nameMap[e.toLowerCase().trim()]; });
  if (unresolved.length === 0 || !sb) return res.json(nameMap);

  sb.query('contacts', 'GET', { limit: 500 }).then(function (contacts) {
    (contacts || []).forEach(function (c) {
      var cEmail = (c.email || '').toLowerCase();
      if (cEmail && !nameMap[cEmail]) {
        nameMap[cEmail] = c.full_name || c.first_name || '';
      }
    });
    res.json(nameMap);
  }).catch(function () {
    res.json(nameMap);
  });
});

module.exports = router;
