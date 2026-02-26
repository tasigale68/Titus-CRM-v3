var express = require('express');
var { authenticate } = require('../../middleware/auth');
var airtable = require('../../services/airtable');
var env = require('../../config/env');
var { uploadGeneral } = require('../../config/upload');
var fs = require('fs');
var path = require('path');

var router = express.Router();

router.use(authenticate);

// Cache knowledge base docs (refresh every 30 minutes)
var _kbCache = { docs: null, ts: 0 };
var KB_CACHE_MS = 30 * 60 * 1000;

function getKnowledgeBase() {
  if (_kbCache.docs && Date.now() - _kbCache.ts < KB_CACHE_MS) {
    return Promise.resolve(_kbCache.docs);
  }
  return airtable.fetchAllFromTable(airtable.TABLES.KNOWLEDGE_BASE).then(function (records) {
    var docs = (records || []).map(function (r) {
      var f = r.fields || {};
      return {
        name: f['Name'] || f['Title'] || f['Document Name'] || '',
        category: f['Category'] || f['Type'] || '',
        content: f['Content'] || f['Body'] || f['Text'] || f['Summary'] || '',
        keywords: f['Keywords'] || f['Tags'] || '',
      };
    }).filter(function (d) { return d.name && d.content; });
    _kbCache = { docs: docs, ts: Date.now() };
    console.log('[DENISE] Knowledge base loaded: ' + docs.length + ' documents');
    return docs;
  }).catch(function (e) {
    console.error('[DENISE] KB load error:', e.message);
    return _kbCache.docs || [];
  });
}

// POST /api/denise-agent/chat
router.post('/chat', uploadGeneral.array('files', 5), function (req, res) {
  var ANTHROPIC_KEY = env.anthropic.apiKey;
  if (!ANTHROPIC_KEY) return res.json({ response: 'AI is not configured. Please set the ANTHROPIC_API_KEY.', sources: [] });

  var message = req.body.message || '';
  var conversationHistory = [];
  try {
    conversationHistory = typeof req.body.conversationHistory === 'string'
      ? JSON.parse(req.body.conversationHistory)
      : (req.body.conversationHistory || []);
  } catch (e) { conversationHistory = []; }

  var files = req.files || [];

  // Build the request to Claude
  getKnowledgeBase().then(function (kbDocs) {
    // Build system prompt with knowledge base context
    var systemPrompt = 'You are Denise, the AI assistant for Delta Community Support (DCS), an NDIS disability services provider in Brisbane, Australia.\n\n';
    systemPrompt += 'ROLE:\n- Answer questions about DCS policies, procedures, SCHADS Award compliance, NDIS rules, rostering, and operational matters.\n';
    systemPrompt += '- Be friendly, professional, and use Australian English.\n';
    systemPrompt += '- When referencing knowledge base documents, mention the document name so staff can find it.\n';
    systemPrompt += '- If you don\'t know something, say so rather than guessing.\n';
    systemPrompt += '- Keep responses concise and practical.\n\n';

    if (kbDocs.length > 0) {
      systemPrompt += 'KNOWLEDGE BASE DOCUMENTS (' + kbDocs.length + ' documents):\n';
      systemPrompt += '===\n';
      kbDocs.forEach(function (doc, i) {
        systemPrompt += '\n--- Document ' + (i + 1) + ': ' + doc.name;
        if (doc.category) systemPrompt += ' [' + doc.category + ']';
        systemPrompt += ' ---\n';
        // Limit each doc to ~2000 chars to stay within context
        var content = doc.content.length > 2000 ? doc.content.substring(0, 2000) + '...' : doc.content;
        systemPrompt += content + '\n';
      });
      systemPrompt += '\n===\n';
    }

    // Build messages array
    var messages = [];

    // Add conversation history
    conversationHistory.forEach(function (m) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    });

    // Build current user message content
    var userContent = [];

    // Add file contents as images or text
    if (files.length > 0) {
      files.forEach(function (f) {
        if (f.mimetype && f.mimetype.startsWith('image/')) {
          // Image: send as base64 to Claude vision
          var base64 = f.buffer.toString('base64');
          userContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: f.mimetype,
              data: base64,
            },
          });
        } else {
          // Text file: include content as text
          var textContent = f.buffer.toString('utf8');
          if (textContent.length > 5000) textContent = textContent.substring(0, 5000) + '\n[... truncated]';
          userContent.push({
            type: 'text',
            text: '[Attached file: ' + f.originalname + ']\n' + textContent,
          });
        }
      });
    }

    // Add the user's text message
    if (message) {
      userContent.push({ type: 'text', text: message });
    }

    messages.push({
      role: 'user',
      content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text : userContent,
    });

    // Call Claude API
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          console.error('[DENISE] Claude error:', data.error);
          return res.json({ response: 'Sorry, I encountered an error. Please try again.', sources: [] });
        }

        var responseText = '';
        if (data.content && data.content.length > 0) {
          responseText = data.content.map(function (c) { return c.text || ''; }).join('\n');
        }

        // Extract which KB docs were referenced
        var sources = [];
        kbDocs.forEach(function (doc) {
          if (doc.name && responseText.toLowerCase().indexOf(doc.name.toLowerCase()) >= 0) {
            sources.push({ name: doc.name, category: doc.category });
          }
        });

        res.json({
          response: responseText || 'No response generated.',
          sources: sources,
          documentsLoaded: kbDocs.length,
        });
      })
      .catch(function (err) {
        console.error('[DENISE] API error:', err.message);
        res.json({ response: 'Sorry, I couldn\'t reach the AI service. Please try again.', sources: [] });
      });
  });
});

module.exports = router;
