// Titus CRM — AI Staff & Policy Chatbot Routes
// CORE feature (no module gate) — always available to all tenants
// Uses Claude API for AI responses, Supabase for knowledge base & sessions

var express = require('express');
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var sb = require('../services/supabaseClient');
var { authenticate } = require('../middleware/auth');
var { tenantFromSession, scopeQuery } = require('../middleware/tenant');
var env = require('../config/env');

var router = express.Router();
var upload = multer({ dest: 'uploads/' });

// All routes require authentication + tenant context
router.use(authenticate, tenantFromSession);

// ─── Helpers ─────────────────────────────────────────────

function extractKeywords(message) {
  // Remove common stop words and extract meaningful keywords
  var stopWords = [
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'about', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its',
    'my', 'me', 'i', 'we', 'us', 'our', 'you', 'your', 'he', 'she', 'they',
    'them', 'his', 'her', 'their'
  ];
  var words = (message || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(function(w) { return w.length > 2 && stopWords.indexOf(w) < 0; });
  // Deduplicate
  var seen = {};
  return words.filter(function(w) {
    if (seen[w]) return false;
    seen[w] = true;
    return true;
  });
}

function callClaudeAPI(systemPrompt, messages) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages
    })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Claude API ' + r.status + ': ' + t.substring(0, 500)); });
    return r.json();
  });
}

// ─── Chat Message ────────────────────────────────────────

// POST /api/chatbot/message — send message to chatbot
router.post('/message', function(req, res) {
  var tenantId = req.tenant.id;
  var userId = req.user.user_id || req.user.id;
  var userName = req.user.name || 'Staff';
  var userRole = req.user.role || 'staff';
  var orgName = req.tenant.org_name || 'Organisation';
  var message = (req.body.message || '').trim();
  var sessionId = req.body.session_id || null;

  if (!message) return res.status(400).json({ error: 'Message is required' });

  var sessionPromise;

  if (sessionId) {
    // Load existing session
    sessionPromise = sb.query('chatbot_sessions', 'GET', scopeQuery({
      eq: { id: sessionId, user_id: userId }
    }, tenantId)).then(function(rows) {
      if (!rows || !rows.length) return null;
      return rows[0];
    });
  } else {
    // Create new session
    sessionPromise = sb.insert('chatbot_sessions', {
      tenant_id: tenantId,
      user_id: userId,
      title: message.substring(0, 100),
      messages: JSON.stringify([]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).then(function(rows) {
      return rows[0] || null;
    });
  }

  sessionPromise.then(function(session) {
    if (!session) return res.status(404).json({ error: 'Chat session not found' });

    // Parse existing messages
    var existingMessages = [];
    if (session.messages) {
      if (typeof session.messages === 'string') {
        try { existingMessages = JSON.parse(session.messages); } catch(e) { existingMessages = []; }
      } else {
        existingMessages = session.messages;
      }
    }

    // Search knowledge base for relevant docs
    var keywords = extractKeywords(message);
    var knowledgePromise;

    if (keywords.length > 0) {
      // Build OR query for keyword matching via ilike on content_text
      var orClauses = keywords.slice(0, 5).map(function(kw) {
        return 'content_text.ilike.*' + kw + '*';
      });
      knowledgePromise = sb.query('knowledge_base', 'GET', {
        eq: { tenant_id: tenantId },
        or: orClauses.join(','),
        limit: 5,
        select: 'id,filename,category,content_text'
      });
    } else {
      knowledgePromise = Promise.resolve([]);
    }

    return knowledgePromise.then(function(knowledgeDocs) {
      // Build relevant chunks from knowledge docs
      var relevantChunks = '';
      var sourceFilenames = [];
      if (knowledgeDocs && knowledgeDocs.length > 0) {
        knowledgeDocs.forEach(function(doc) {
          var text = (doc.content_text || '').substring(0, 2000);
          if (text) {
            relevantChunks += '\n\n--- ' + (doc.filename || 'Document') + ' (' + (doc.category || 'General') + ') ---\n' + text;
            sourceFilenames.push(doc.filename || 'Unknown document');
          }
        });
      }

      // Build system prompt
      var systemPrompt = 'You are the AI assistant for ' + orgName + ', a registered NDIS provider in Australia. '
        + 'Help staff with SOPs, policies, SCHADS Award payroll, NDIS compliance and general questions.\n\n'
        + 'Staff: ' + userName + ' | Role: ' + userRole + '\n'
        + 'Knowledge: ' + (relevantChunks || 'No specific documents loaded yet.') + '\n\n'
        + 'Plain English answers. SCHADS 2024 rates for payroll. Org policies if uploaded, else NDIS Practice Standards. '
        + 'Step-by-step for procedures. Safety issues → supervisor immediately. '
        + 'Tone: knowledgeable, friendly senior colleague. Never give legal or medical advice.';

      // Build conversation history for Claude API
      var conversationHistory = [];
      existingMessages.forEach(function(msg) {
        conversationHistory.push({ role: msg.role, content: msg.content });
      });
      conversationHistory.push({ role: 'user', content: message });

      // Call Claude API
      return callClaudeAPI(systemPrompt, conversationHistory).then(function(apiResponse) {
        var assistantResponse = '';
        if (apiResponse.content && apiResponse.content.length > 0) {
          assistantResponse = apiResponse.content[0].text || '';
        }

        // Append messages to session history
        existingMessages.push({
          role: 'user',
          content: message,
          timestamp: new Date().toISOString()
        });
        existingMessages.push({
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date().toISOString(),
          sources: sourceFilenames
        });

        // Update session in database
        return sb.update('chatbot_sessions', { eq: { id: session.id, tenant_id: tenantId } }, {
          messages: JSON.stringify(existingMessages),
          updated_at: new Date().toISOString()
        }).then(function() {
          res.json({
            session_id: session.id,
            response: assistantResponse,
            sources: sourceFilenames
          });
        });
      });
    });
  }).catch(function(err) {
    console.error('[CHATBOT] Message error:', err.message);
    res.status(500).json({ error: 'Failed to process message: ' + err.message });
  });
});

// ─── Chat Sessions ───────────────────────────────────────

// GET /api/chatbot/sessions — list user's chatbot sessions
router.get('/sessions', function(req, res) {
  var tenantId = req.tenant.id;
  var userId = req.user.user_id || req.user.id;

  sb.query('chatbot_sessions', 'GET', scopeQuery({
    eq: { user_id: userId },
    select: 'id,title,created_at,updated_at',
    order: 'updated_at.desc',
    limit: 50
  }, tenantId)).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[CHATBOT] Sessions list error:', err.message);
    res.status(500).json({ error: 'Failed to load sessions' });
  });
});

// GET /api/chatbot/sessions/:id — get session with full message history
router.get('/sessions/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var userId = req.user.user_id || req.user.id;
  var sessionId = req.params.id;

  sb.query('chatbot_sessions', 'GET', scopeQuery({
    eq: { id: sessionId, user_id: userId }
  }, tenantId)).then(function(rows) {
    if (!rows || !rows.length) return res.status(404).json({ error: 'Session not found' });

    var session = rows[0];
    // Parse messages JSONB
    if (typeof session.messages === 'string') {
      try { session.messages = JSON.parse(session.messages); } catch(e) { session.messages = []; }
    }
    res.json(session);
  }).catch(function(err) {
    console.error('[CHATBOT] Session detail error:', err.message);
    res.status(500).json({ error: 'Failed to load session' });
  });
});

// DELETE /api/chatbot/sessions/:id — delete session
router.delete('/sessions/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var userId = req.user.user_id || req.user.id;
  var sessionId = req.params.id;

  sb.remove('chatbot_sessions', { eq: { id: sessionId, user_id: userId, tenant_id: tenantId } })
    .then(function() {
      res.json({ success: true });
    }).catch(function(err) {
      console.error('[CHATBOT] Session delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete session' });
    });
});

// ─── Knowledge Base Admin ────────────────────────────────

// GET /api/chatbot/knowledge — list knowledge base docs for tenant
router.get('/knowledge', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('knowledge_base', 'GET', scopeQuery({
    select: 'id,filename,category,created_at,file_url',
    order: 'created_at.desc'
  }, tenantId)).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[CHATBOT] Knowledge list error:', err.message);
    res.status(500).json({ error: 'Failed to load knowledge base' });
  });
});

// POST /api/chatbot/knowledge — upload document to knowledge base
router.post('/knowledge', upload.single('file'), function(req, res) {
  var tenantId = req.tenant.id;
  var userId = req.user.user_id || req.user.id;
  var category = (req.body.category || 'General').trim();

  if (!req.file) return res.status(400).json({ error: 'File is required' });

  var filename = req.file.originalname || 'unnamed';
  var filePath = req.file.path;

  // Read file content as text
  var contentText = '';
  try {
    contentText = fs.readFileSync(filePath, 'utf8');
  } catch(e) {
    // If binary file, store empty content_text (can be enhanced later with OCR)
    contentText = '[Binary file - text extraction not available]';
  }

  // Upload to Supabase Storage
  var storagePath = tenantId + '/' + Date.now() + '-' + filename;
  var fileBuffer = fs.readFileSync(filePath);
  var contentType = req.file.mimetype || 'application/octet-stream';

  sb.storageUpload('titus-knowledge', storagePath, fileBuffer, contentType).then(function() {
    var fileUrl = sb.storageUrl('titus-knowledge', storagePath);

    // Insert into knowledge_base table
    return sb.insert('knowledge_base', {
      tenant_id: tenantId,
      filename: filename,
      category: category,
      content_text: contentText,
      file_url: fileUrl,
      uploaded_by: userId,
      created_at: new Date().toISOString()
    });
  }).then(function(rows) {
    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch(e) { /* ignore */ }

    var doc = rows[0] || {};
    res.status(201).json({
      id: doc.id,
      filename: doc.filename,
      category: doc.category,
      file_url: doc.file_url,
      created_at: doc.created_at
    });
  }).catch(function(err) {
    // Clean up temp file on error
    try { fs.unlinkSync(filePath); } catch(e) { /* ignore */ }
    console.error('[CHATBOT] Knowledge upload error:', err.message);
    res.status(500).json({ error: 'Failed to upload document: ' + err.message });
  });
});

// DELETE /api/chatbot/knowledge/:id — delete knowledge doc
router.delete('/knowledge/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var docId = req.params.id;

  sb.remove('knowledge_base', { eq: { id: docId, tenant_id: tenantId } })
    .then(function() {
      res.json({ success: true });
    }).catch(function(err) {
      console.error('[CHATBOT] Knowledge delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete document' });
    });
});

// ─── Analytics ───────────────────────────────────────────

// GET /api/chatbot/analytics — chatbot usage analytics
router.get('/analytics', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('chatbot_sessions', 'GET', scopeQuery({
    select: 'id,messages,created_at',
    order: 'created_at.desc',
    limit: 200
  }, tenantId)).then(function(sessions) {
    sessions = sessions || [];

    var questionCounts = {};
    var unansweredCount = 0;
    var totalMessages = 0;

    sessions.forEach(function(session) {
      var messages = session.messages;
      if (typeof messages === 'string') {
        try { messages = JSON.parse(messages); } catch(e) { messages = []; }
      }
      if (!Array.isArray(messages)) messages = [];

      messages.forEach(function(msg) {
        if (msg.role === 'user') {
          totalMessages++;
          // Normalize question for counting
          var normalized = (msg.content || '').toLowerCase().trim().substring(0, 100);
          if (normalized) {
            // Group by first few significant words
            var key = normalized.split(/\s+/).slice(0, 6).join(' ');
            questionCounts[key] = (questionCounts[key] || 0) + 1;
          }
        }
        if (msg.role === 'assistant') {
          var content = (msg.content || '').toLowerCase();
          if (content.indexOf("i don't have") >= 0 || content.indexOf("i'm not sure") >= 0) {
            unansweredCount++;
          }
        }
      });
    });

    // Get top 10 most common questions
    var topQuestions = Object.keys(questionCounts)
      .map(function(q) { return { question: q, count: questionCounts[q] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 10);

    res.json({
      total_sessions: sessions.length,
      total_messages: totalMessages,
      top_questions: topQuestions,
      unanswered_count: unansweredCount
    });
  }).catch(function(err) {
    console.error('[CHATBOT] Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  });
});

module.exports = router;
