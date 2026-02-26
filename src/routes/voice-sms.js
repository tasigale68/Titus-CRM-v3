// Titus CRM — Voice & SMS CRM-facing API Routes
// Add-on module: requires 'voice_sms' module enabled
// Separate from src/routes/voice/ which handles Twilio webhooks

var express = require('express');
var sb = require('../services/supabaseClient');
var { authenticate } = require('../middleware/auth');
var { tenantFromSession, scopeQuery } = require('../middleware/tenant');
var { requireModule } = require('../middleware/modules');
var env = require('../config/env');

var router = express.Router();

// All routes require authentication + tenant context + voice_sms module
router.use(authenticate, tenantFromSession, requireModule('voice_sms'));

// ═══════════════════════════════════════════════════════
//  Call Log
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/calls — list calls for tenant
router.get('/calls', function(req, res) {
  var tenantId = req.tenant.id;

  var params = scopeQuery({
    order: 'created_at.desc',
    limit: parseInt(req.query.limit) || 100,
    offset: parseInt(req.query.offset) || 0
  }, tenantId);

  // Apply filters
  if (req.query.direction) {
    params.eq.direction = req.query.direction;
  }
  if (req.query.contact_id) {
    params.eq.contact_id = req.query.contact_id;
  }
  if (req.query.from) {
    if (!params.gte) params.gte = {};
    params.gte.created_at = req.query.from;
  }
  if (req.query.to) {
    if (!params.lte) params.lte = {};
    params.lte.created_at = req.query.to;
  }

  sb.query('call_log', 'GET', params).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Calls list error:', err.message);
    res.status(500).json({ error: 'Failed to load calls' });
  });
});

// GET /api/voice-sms/calls/stats — call statistics
// NOTE: This route must be defined BEFORE /calls/:id to avoid matching "stats" as an :id
router.get('/calls/stats', function(req, res) {
  var tenantId = req.tenant.id;

  // Get all calls for this tenant
  sb.query('call_log', 'GET', scopeQuery({
    select: 'id,direction,duration,status,created_at',
    limit: 5000
  }, tenantId)).then(function(rows) {
    rows = rows || [];

    var now = new Date();
    var thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    var lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    var lastWeekEnd = new Date(thisWeekStart);

    var totalCalls = rows.length;
    var totalDuration = 0;
    var missedCount = 0;
    var byDirection = { inbound: 0, outbound: 0 };
    var thisWeekCount = 0;
    var lastWeekCount = 0;

    rows.forEach(function(call) {
      var dur = parseInt(call.duration) || 0;
      totalDuration += dur;

      var status = (call.status || '').toLowerCase();
      if (status === 'missed' || status === 'no-answer' || status === 'busy') {
        missedCount++;
      }

      var direction = (call.direction || '').toLowerCase();
      if (direction === 'inbound') byDirection.inbound++;
      else if (direction === 'outbound') byDirection.outbound++;

      var callDate = new Date(call.created_at);
      if (callDate >= thisWeekStart) thisWeekCount++;
      else if (callDate >= lastWeekStart && callDate < lastWeekEnd) lastWeekCount++;
    });

    var avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    var missedRate = totalCalls > 0 ? Math.round((missedCount / totalCalls) * 100) : 0;

    res.json({
      total_calls: totalCalls,
      avg_duration: avgDuration,
      missed_rate: missedRate,
      by_direction: byDirection,
      this_week: thisWeekCount,
      last_week: lastWeekCount
    });
  }).catch(function(err) {
    console.error('[VOICE-SMS] Call stats error:', err.message);
    res.status(500).json({ error: 'Failed to load call stats' });
  });
});

// GET /api/voice-sms/calls/:id — get single call with transcript
router.get('/calls/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var callId = req.params.id;

  sb.query('call_log', 'GET', scopeQuery({
    eq: { id: callId }
  }, tenantId)).then(function(rows) {
    if (!rows || !rows.length) return res.status(404).json({ error: 'Call not found' });
    res.json(rows[0]);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Call detail error:', err.message);
    res.status(500).json({ error: 'Failed to load call' });
  });
});

// ═══════════════════════════════════════════════════════
//  SMS Log
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/sms — list SMS for tenant
router.get('/sms', function(req, res) {
  var tenantId = req.tenant.id;

  var params = scopeQuery({
    order: 'created_at.desc',
    limit: parseInt(req.query.limit) || 100,
    offset: parseInt(req.query.offset) || 0
  }, tenantId);

  if (req.query.direction) {
    params.eq.direction = req.query.direction;
  }
  if (req.query.contact_id) {
    params.eq.contact_id = req.query.contact_id;
  }

  sb.query('sms_log', 'GET', params).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[VOICE-SMS] SMS list error:', err.message);
    res.status(500).json({ error: 'Failed to load SMS' });
  });
});

// POST /api/voice-sms/sms/send — send SMS via Twilio
router.post('/sms/send', function(req, res) {
  var tenantId = req.tenant.id;
  var userId = req.user.user_id || req.user.id;
  var toNumber = (req.body.to_number || '').trim();
  var body = (req.body.body || '').trim();
  var contactId = req.body.contact_id || null;

  if (!toNumber) return res.status(400).json({ error: 'to_number is required' });
  if (!body) return res.status(400).json({ error: 'Message body is required' });

  // Determine from number: use tenant phone or Twilio default
  var fromNumber = env.twilio.phoneNumber;

  // Send via Twilio
  var twilio = require('twilio');
  var client = twilio(env.twilio.accountSid, env.twilio.authToken);

  client.messages.create({
    body: body,
    from: fromNumber,
    to: toNumber
  }).then(function(twilioMsg) {
    // Log to sms_log table
    return sb.insert('sms_log', {
      tenant_id: tenantId,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: toNumber,
      body: body,
      twilio_sid: twilioMsg.sid,
      status: twilioMsg.status || 'sent',
      contact_id: contactId,
      sent_by: userId,
      created_at: new Date().toISOString()
    }).then(function(rows) {
      var sms = rows[0] || {};
      res.status(201).json({
        success: true,
        sms: {
          id: sms.id,
          twilio_sid: twilioMsg.sid,
          status: twilioMsg.status || 'sent',
          to_number: toNumber,
          body: body,
          created_at: sms.created_at
        }
      });
    });
  }).catch(function(err) {
    console.error('[VOICE-SMS] SMS send error:', err.message);
    res.status(500).json({ error: 'Failed to send SMS: ' + err.message });
  });
});

// GET /api/voice-sms/sms/:id — get single SMS
router.get('/sms/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var smsId = req.params.id;

  sb.query('sms_log', 'GET', scopeQuery({
    eq: { id: smsId }
  }, tenantId)).then(function(rows) {
    if (!rows || !rows.length) return res.status(404).json({ error: 'SMS not found' });
    res.json(rows[0]);
  }).catch(function(err) {
    console.error('[VOICE-SMS] SMS detail error:', err.message);
    res.status(500).json({ error: 'Failed to load SMS' });
  });
});

// ═══════════════════════════════════════════════════════
//  SMS Templates
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/templates — list SMS templates for tenant
router.get('/templates', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('sms_templates', 'GET', scopeQuery({
    order: 'name.asc'
  }, tenantId)).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Templates list error:', err.message);
    res.status(500).json({ error: 'Failed to load templates' });
  });
});

// POST /api/voice-sms/templates — create SMS template
router.post('/templates', function(req, res) {
  var tenantId = req.tenant.id;
  var name = (req.body.name || '').trim();
  var category = (req.body.category || '').trim();
  var body = (req.body.body || '').trim();
  var variables = req.body.variables || [];

  if (!name) return res.status(400).json({ error: 'Template name is required' });
  if (!body) return res.status(400).json({ error: 'Template body is required' });

  sb.insert('sms_templates', {
    tenant_id: tenantId,
    name: name,
    category: category || null,
    body: body,
    variables: JSON.stringify(variables),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).then(function(rows) {
    var tpl = rows[0] || {};
    res.status(201).json(tpl);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Template create error:', err.message);
    res.status(500).json({ error: 'Failed to create template' });
  });
});

// PUT /api/voice-sms/templates/:id — update SMS template
router.put('/templates/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var templateId = req.params.id;

  var updates = { updated_at: new Date().toISOString() };
  if (req.body.name !== undefined) updates.name = (req.body.name || '').trim();
  if (req.body.category !== undefined) updates.category = (req.body.category || '').trim() || null;
  if (req.body.body !== undefined) updates.body = (req.body.body || '').trim();
  if (req.body.variables !== undefined) updates.variables = JSON.stringify(req.body.variables || []);

  sb.update('sms_templates', { eq: { id: templateId, tenant_id: tenantId } }, updates)
    .then(function(rows) {
      if (!rows || !rows.length) return res.status(404).json({ error: 'Template not found' });
      res.json(rows[0]);
    }).catch(function(err) {
      console.error('[VOICE-SMS] Template update error:', err.message);
      res.status(500).json({ error: 'Failed to update template' });
    });
});

// DELETE /api/voice-sms/templates/:id — delete SMS template
router.delete('/templates/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var templateId = req.params.id;

  sb.remove('sms_templates', { eq: { id: templateId, tenant_id: tenantId } })
    .then(function() {
      res.json({ success: true });
    }).catch(function(err) {
      console.error('[VOICE-SMS] Template delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete template' });
    });
});

// ═══════════════════════════════════════════════════════
//  Voicemails
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/voicemails — list voicemails for tenant
router.get('/voicemails', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('voicemails', 'GET', scopeQuery({
    order: 'created_at.desc',
    limit: parseInt(req.query.limit) || 50
  }, tenantId)).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Voicemails list error:', err.message);
    res.status(500).json({ error: 'Failed to load voicemails' });
  });
});

// PUT /api/voice-sms/voicemails/:id/listened — mark voicemail as listened
router.put('/voicemails/:id/listened', function(req, res) {
  var tenantId = req.tenant.id;
  var voicemailId = req.params.id;

  sb.update('voicemails', { eq: { id: voicemailId, tenant_id: tenantId } }, {
    listened: true,
    listened_at: new Date().toISOString(),
    listened_by: req.user.user_id || req.user.id
  }).then(function(rows) {
    if (!rows || !rows.length) return res.status(404).json({ error: 'Voicemail not found' });
    res.json(rows[0]);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Voicemail listen error:', err.message);
    res.status(500).json({ error: 'Failed to update voicemail' });
  });
});

// ═══════════════════════════════════════════════════════
//  Hunt Groups
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/hunt-groups — list hunt groups for tenant
router.get('/hunt-groups', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('hunt_groups', 'GET', scopeQuery({
    order: 'name.asc'
  }, tenantId)).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Hunt groups list error:', err.message);
    res.status(500).json({ error: 'Failed to load hunt groups' });
  });
});

// POST /api/voice-sms/hunt-groups — create hunt group
router.post('/hunt-groups', function(req, res) {
  var tenantId = req.tenant.id;
  var name = (req.body.name || '').trim();
  var members = req.body.members || [];
  var ringTimeout = parseInt(req.body.ring_timeout) || 20;
  var strategy = req.body.strategy || 'sequential';

  if (!name) return res.status(400).json({ error: 'Hunt group name is required' });

  sb.insert('hunt_groups', {
    tenant_id: tenantId,
    name: name,
    members: JSON.stringify(members),
    ring_timeout: ringTimeout,
    strategy: strategy,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).then(function(rows) {
    var group = rows[0] || {};
    res.status(201).json(group);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Hunt group create error:', err.message);
    res.status(500).json({ error: 'Failed to create hunt group' });
  });
});

// PUT /api/voice-sms/hunt-groups/:id — update hunt group
router.put('/hunt-groups/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var groupId = req.params.id;

  var updates = { updated_at: new Date().toISOString() };
  if (req.body.name !== undefined) updates.name = (req.body.name || '').trim();
  if (req.body.members !== undefined) updates.members = JSON.stringify(req.body.members || []);
  if (req.body.ring_timeout !== undefined) updates.ring_timeout = parseInt(req.body.ring_timeout) || 20;
  if (req.body.strategy !== undefined) updates.strategy = req.body.strategy;
  if (req.body.active !== undefined) updates.active = !!req.body.active;

  sb.update('hunt_groups', { eq: { id: groupId, tenant_id: tenantId } }, updates)
    .then(function(rows) {
      if (!rows || !rows.length) return res.status(404).json({ error: 'Hunt group not found' });
      res.json(rows[0]);
    }).catch(function(err) {
      console.error('[VOICE-SMS] Hunt group update error:', err.message);
      res.status(500).json({ error: 'Failed to update hunt group' });
    });
});

// DELETE /api/voice-sms/hunt-groups/:id — delete hunt group
router.delete('/hunt-groups/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var groupId = req.params.id;

  sb.remove('hunt_groups', { eq: { id: groupId, tenant_id: tenantId } })
    .then(function() {
      res.json({ success: true });
    }).catch(function(err) {
      console.error('[VOICE-SMS] Hunt group delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete hunt group' });
    });
});

// ═══════════════════════════════════════════════════════
//  Phone Numbers
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/numbers — list phone numbers for tenant
router.get('/numbers', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('phone_numbers', 'GET', scopeQuery({
    order: 'created_at.desc'
  }, tenantId)).then(function(rows) {
    res.json(rows || []);
  }).catch(function(err) {
    console.error('[VOICE-SMS] Phone numbers list error:', err.message);
    res.status(500).json({ error: 'Failed to load phone numbers' });
  });
});

// ═══════════════════════════════════════════════════════
//  Contact Conversations
// ═══════════════════════════════════════════════════════

// GET /api/voice-sms/contact/:contactId/history — get all calls + SMS for a contact
router.get('/contact/:contactId/history', function(req, res) {
  var tenantId = req.tenant.id;
  var contactId = req.params.contactId;

  // Fetch calls and SMS in parallel
  var callsPromise = sb.query('call_log', 'GET', scopeQuery({
    eq: { contact_id: contactId },
    order: 'created_at.desc',
    limit: 100
  }, tenantId));

  var smsPromise = sb.query('sms_log', 'GET', scopeQuery({
    eq: { contact_id: contactId },
    order: 'created_at.desc',
    limit: 100
  }, tenantId));

  Promise.all([callsPromise, smsPromise]).then(function(results) {
    var calls = (results[0] || []).map(function(c) {
      c.type = 'call';
      return c;
    });
    var sms = (results[1] || []).map(function(s) {
      s.type = 'sms';
      return s;
    });

    // Merge and sort by date descending
    var history = calls.concat(sms).sort(function(a, b) {
      var dateA = new Date(a.created_at || 0);
      var dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

    res.json({
      contact_id: contactId,
      total: history.length,
      calls_count: calls.length,
      sms_count: sms.length,
      history: history
    });
  }).catch(function(err) {
    console.error('[VOICE-SMS] Contact history error:', err.message);
    res.status(500).json({ error: 'Failed to load contact history' });
  });
});

module.exports = router;
