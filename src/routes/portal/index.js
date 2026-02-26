// Titus CRM — Stakeholder Portal Routes (SaaS multi-tenant)
// Admin routes: require authenticate + tenantFromSession + requireModule('stakeholder_portal')
// Portal user routes: use portalAuth middleware (x-portal-token header)

var express = require('express');
var crypto = require('crypto');
var router = express.Router();

var sb = require('../../services/supabaseClient');
var { authenticate } = require('../../middleware/auth');
var { tenantFromSession, scopeQuery, loadTenant } = require('../../middleware/tenant');
var { requireModule } = require('../../middleware/modules');
var { portalAuth } = require('../../middleware/portalAuth');

// Portal password hashing (separate salt from main auth)
function hashPortalPassword(password) {
  return crypto.createHash('sha256').update(password + 'titus-portal-salt').digest('hex');
}

// Generate random temporary password
function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

// ─── Admin routes (internal staff managing portal users) ─────────────────────

var adminMiddleware = [authenticate, tenantFromSession, requireModule('stakeholder_portal')];

// GET /api/portal/users — list portal users for tenant
router.get('/users',
  adminMiddleware,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('portal_users', 'GET', scopeQuery({ order: 'created_at.desc' }, tid)).then(function(users) {
      res.json({ users: users });
    }).catch(function(err) {
      console.error('[PORTAL] list users error:', err.message);
      res.status(500).json({ error: 'Failed to load portal users' });
    });
  }
);

// POST /api/portal/users — create portal user
router.post('/users',
  adminMiddleware,
  function(req, res) {
    var tid = req.tenant.id;
    var body = req.body;

    if (!body.name || !body.email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    var tempPassword = generateTempPassword();
    var user = {
      tenant_id: tid,
      client_id: body.client_id || null,
      name: body.name,
      email: body.email.toLowerCase().trim(),
      role: body.role || 'family',
      access_level: body.access_level || 'standard',
      password_hash: hashPortalPassword(tempPassword),
      must_change_password: true,
      status: 'active',
      created_by: req.user.user_id || req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    sb.insert('portal_users', user).then(function(rows) {
      var created = rows[0];
      // Return temp password so admin can share it (only time it's visible)
      created.temp_password = tempPassword;
      res.status(201).json({ user: created });
    }).catch(function(err) {
      console.error('[PORTAL] create user error:', err.message);
      res.status(500).json({ error: 'Failed to create portal user' });
    });
  }
);

// PUT /api/portal/users/:id — update portal user
router.put('/users/:id',
  adminMiddleware,
  function(req, res) {
    var tid = req.tenant.id;
    var body = req.body;

    var updates = { updated_at: new Date().toISOString() };
    if (body.name) updates.name = body.name;
    if (body.email) updates.email = body.email.toLowerCase().trim();
    if (body.role) updates.role = body.role;
    if (body.access_level) updates.access_level = body.access_level;
    if (body.client_id !== undefined) updates.client_id = body.client_id;
    if (body.status) updates.status = body.status;

    sb.update('portal_users', { eq: { id: req.params.id, tenant_id: tid } }, updates).then(function(rows) {
      if (!rows || !rows.length) return res.status(404).json({ error: 'Portal user not found' });
      res.json({ user: rows[0] });
    }).catch(function(err) {
      console.error('[PORTAL] update user error:', err.message);
      res.status(500).json({ error: 'Failed to update portal user' });
    });
  }
);

// DELETE /api/portal/users/:id — deactivate portal user (soft delete)
router.delete('/users/:id',
  adminMiddleware,
  function(req, res) {
    var tid = req.tenant.id;

    sb.update('portal_users', { eq: { id: req.params.id, tenant_id: tid } }, {
      status: 'inactive',
      deactivated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).then(function(rows) {
      if (!rows || !rows.length) return res.status(404).json({ error: 'Portal user not found' });
      res.json({ user: rows[0], message: 'Portal user deactivated' });
    }).catch(function(err) {
      console.error('[PORTAL] deactivate user error:', err.message);
      res.status(500).json({ error: 'Failed to deactivate portal user' });
    });
  }
);

// GET /api/portal/users/:id/activity — login history
router.get('/users/:id/activity',
  adminMiddleware,
  function(req, res) {
    var tid = req.tenant.id;

    sb.query('portal_sessions', 'GET', scopeQuery({
      eq: { portal_user_id: req.params.id },
      order: 'created_at.desc',
      limit: 50
    }, tid)).then(function(sessions) {
      res.json({ activity: sessions });
    }).catch(function(err) {
      console.error('[PORTAL] activity error:', err.message);
      res.status(500).json({ error: 'Failed to load activity' });
    });
  }
);

// ─── Portal user routes (stakeholder-facing) ────────────────────────────────

// POST /api/portal/login — portal user login
router.post('/login', function(req, res) {
  var body = req.body;

  if (!body.email || !body.password || !body.tenant_slug) {
    return res.status(400).json({ error: 'email, password, and tenant_slug are required' });
  }

  // Load tenant by slug
  loadTenant(body.tenant_slug).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Organisation not found' });
    if (tenant.status === 'suspended') return res.status(403).json({ error: 'This organisation account has been suspended' });

    var tid = tenant.id;
    var passwordHash = hashPortalPassword(body.password);

    return sb.query('portal_users', 'GET', {
      eq: { tenant_id: tid, email: body.email.toLowerCase().trim() },
      limit: 1
    }).then(function(users) {
      if (!users || !users.length) return res.status(401).json({ error: 'Invalid email or password' });
      var user = users[0];

      if (user.status !== 'active') return res.status(403).json({ error: 'Account is inactive. Contact your service provider.' });
      if (user.password_hash !== passwordHash) return res.status(401).json({ error: 'Invalid email or password' });

      // Create session with 24hr expiry
      var token = crypto.randomBytes(32).toString('hex');
      var expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      var session = {
        tenant_id: tid,
        portal_user_id: user.id,
        token: token,
        expires_at: expiresAt,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || 'unknown',
        created_at: new Date().toISOString()
      };

      return sb.insert('portal_sessions', session).then(function() {
        // Update last login
        sb.update('portal_users', { eq: { id: user.id, tenant_id: tid } }, {
          last_login_at: new Date().toISOString()
        }).catch(function() { /* non-critical */ });

        res.json({
          token: token,
          expires_at: expiresAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            client_id: user.client_id,
            must_change_password: user.must_change_password || false
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug
          }
        });
      });
    });
  }).catch(function(err) {
    console.error('[PORTAL] login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  });
});

// POST /api/portal/change-password — change portal user password
router.post('/change-password',
  portalAuth,
  function(req, res) {
    var body = req.body;
    var user = req.portalUser;

    if (!body.current_password || !body.new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }

    if (body.new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    var currentHash = hashPortalPassword(body.current_password);
    if (user.password_hash !== currentHash) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    var newHash = hashPortalPassword(body.new_password);
    sb.update('portal_users', { eq: { id: user.id, tenant_id: user.tenant_id } }, {
      password_hash: newHash,
      must_change_password: false,
      updated_at: new Date().toISOString()
    }).then(function() {
      res.json({ message: 'Password changed successfully' });
    }).catch(function(err) {
      console.error('[PORTAL] change password error:', err.message);
      res.status(500).json({ error: 'Failed to change password' });
    });
  }
);

// GET /api/portal/dashboard — stats for assigned client(s)
router.get('/dashboard',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var clientId = user.client_id;

    if (!clientId) return res.json({ stats: { notes: 0, reports: 0, upcoming_shifts: 0 } });

    var now = new Date().toISOString();
    var thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      // Recent progress notes (last 30 days)
      sb.query('progress_notes', 'GET', {
        eq: { tenant_id: tid, client_id: clientId },
        gte: { created_at: thirtyDaysAgo },
        limit: 1000
      }),
      // Recent reports
      sb.query('weekly_reports', 'GET', {
        eq: { tenant_id: tid, client_id: clientId },
        gte: { created_at: thirtyDaysAgo },
        limit: 100
      }),
      // Upcoming shifts
      sb.query('roster_shifts', 'GET', {
        eq: { tenant_id: tid, client_id: clientId },
        gte: { start_time: now },
        order: 'start_time.asc',
        limit: 100
      })
    ]).then(function(results) {
      res.json({
        stats: {
          notes: results[0].length,
          reports: results[1].length,
          upcoming_shifts: results[2].length
        }
      });
    }).catch(function(err) {
      console.error('[PORTAL] dashboard error:', err.message);
      res.status(500).json({ error: 'Failed to load dashboard' });
    });
  }
);

// GET /api/portal/notes — progress notes for assigned client
router.get('/notes',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var clientId = user.client_id;

    if (!clientId) return res.json({ notes: [] });

    var params = {
      eq: { tenant_id: tid, client_id: clientId },
      order: 'created_at.desc',
      limit: parseInt(req.query.limit) || 50
    };

    // Portal users only see shared notes
    params.eq.shared = true;

    if (req.query.offset) params.offset = parseInt(req.query.offset);

    sb.query('progress_notes', 'GET', params).then(function(notes) {
      res.json({ notes: notes });
    }).catch(function(err) {
      console.error('[PORTAL] notes error:', err.message);
      res.status(500).json({ error: 'Failed to load notes' });
    });
  }
);

// GET /api/portal/reports — weekly reports for assigned client
router.get('/reports',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var clientId = user.client_id;

    if (!clientId) return res.json({ reports: [] });

    sb.query('weekly_reports', 'GET', {
      eq: { tenant_id: tid, client_id: clientId },
      order: 'created_at.desc',
      limit: parseInt(req.query.limit) || 20
    }).then(function(reports) {
      res.json({ reports: reports });
    }).catch(function(err) {
      console.error('[PORTAL] reports error:', err.message);
      res.status(500).json({ error: 'Failed to load reports' });
    });
  }
);

// GET /api/portal/incidents — incidents for assigned client (high level only)
router.get('/incidents',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var clientId = user.client_id;

    if (!clientId) return res.json({ incidents: [] });

    sb.query('ir_reports', 'GET', {
      eq: { tenant_id: tid, client_id: clientId },
      select: 'id,tenant_id,client_id,incident_type,incident_date,severity,status,summary,created_at',
      order: 'incident_date.desc',
      limit: parseInt(req.query.limit) || 20
    }).then(function(incidents) {
      res.json({ incidents: incidents });
    }).catch(function(err) {
      console.error('[PORTAL] incidents error:', err.message);
      res.status(500).json({ error: 'Failed to load incidents' });
    });
  }
);

// GET /api/portal/schedule — upcoming rosters for assigned client
router.get('/schedule',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var clientId = user.client_id;

    if (!clientId) return res.json({ shifts: [] });

    var now = new Date().toISOString();

    sb.query('roster_shifts', 'GET', {
      eq: { tenant_id: tid, client_id: clientId },
      gte: { start_time: now },
      order: 'start_time.asc',
      limit: parseInt(req.query.limit) || 50
    }).then(function(shifts) {
      res.json({ shifts: shifts });
    }).catch(function(err) {
      console.error('[PORTAL] schedule error:', err.message);
      res.status(500).json({ error: 'Failed to load schedule' });
    });
  }
);

// GET /api/portal/documents — signed documents for assigned client
router.get('/documents',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var clientId = user.client_id;

    if (!clientId) return res.json({ documents: [] });

    sb.query('signing_documents', 'GET', {
      eq: { tenant_id: tid, related_id: clientId },
      order: 'created_at.desc',
      limit: parseInt(req.query.limit) || 20
    }).then(function(docs) {
      res.json({ documents: docs });
    }).catch(function(err) {
      console.error('[PORTAL] documents error:', err.message);
      res.status(500).json({ error: 'Failed to load documents' });
    });
  }
);

// POST /api/portal/messages — send message to team
router.post('/messages',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;
    var body = req.body;

    if (!body.message || !body.message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    var msg = {
      tenant_id: tid,
      sender_type: 'portal',
      sender_id: user.id,
      sender_name: user.name,
      client_id: user.client_id || null,
      message: body.message.trim(),
      subject: body.subject || null,
      created_at: new Date().toISOString()
    };

    sb.insert('chat_messages', msg).then(function(rows) {
      res.status(201).json({ message: rows[0] });
    }).catch(function(err) {
      console.error('[PORTAL] send message error:', err.message);
      res.status(500).json({ error: 'Failed to send message' });
    });
  }
);

// GET /api/portal/messages — message history
router.get('/messages',
  portalAuth,
  function(req, res) {
    var user = req.portalUser;
    var tid = user.tenant_id;

    sb.query('chat_messages', 'GET', {
      eq: { tenant_id: tid, client_id: user.client_id },
      order: 'created_at.desc',
      limit: parseInt(req.query.limit) || 50
    }).then(function(messages) {
      res.json({ messages: messages });
    }).catch(function(err) {
      console.error('[PORTAL] messages error:', err.message);
      res.status(500).json({ error: 'Failed to load messages' });
    });
  }
);

module.exports = router;
