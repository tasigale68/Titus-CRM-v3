// Titus CRM — Portal Authentication Middleware (SaaS multi-tenant)
// Authenticates stakeholder portal users via x-portal-token header

var sb = require('../services/supabaseClient');

function portalAuth(req, res, next) {
  var token = req.headers['x-portal-token'];
  if (!token) return res.status(401).json({ error: 'Portal authentication required' });

  sb.query('portal_sessions', 'GET', {
    eq: { token: token },
    limit: 1
  }).then(function(sessions) {
    if (!sessions || !sessions.length) return res.status(401).json({ error: 'Invalid portal session' });
    var session = sessions[0];
    if (new Date(session.expires_at) < new Date()) return res.status(401).json({ error: 'Portal session expired' });

    return sb.query('portal_users', 'GET', {
      eq: { id: session.portal_user_id },
      limit: 1
    }).then(function(users) {
      if (!users || !users.length) return res.status(401).json({ error: 'Portal user not found' });
      req.portalUser = users[0];
      req.portalUser.tenant_id = session.tenant_id;
      next();
    });
  }).catch(function(err) {
    console.error('[PORTAL AUTH]', err.message);
    res.status(500).json({ error: 'Authentication error' });
  });
}

module.exports = { portalAuth };
