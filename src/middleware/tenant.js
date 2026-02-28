var sb = require('../services/supabaseClient');

// Cache tenants for 5 minutes
var _cache = {};
var CACHE_TTL = 5 * 60 * 1000;

function loadTenant(slug) {
  var now = Date.now();
  if (_cache[slug] && (now - _cache[slug].ts) < CACHE_TTL) {
    return Promise.resolve(_cache[slug].data);
  }
  return sb.query('tenants', 'GET', { eq: { slug: slug }, limit: 1 }).then(function(rows) {
    if (!rows || !rows.length) return null;
    var tenant = rows[0];
    // Parse enabled_modules if string
    if (typeof tenant.enabled_modules === 'string') {
      try { tenant.enabled_modules = JSON.parse(tenant.enabled_modules); } catch(e) { tenant.enabled_modules = []; }
    }
    _cache[slug] = { data: tenant, ts: now };
    return tenant;
  });
}

function loadTenantById(id) {
  return sb.query('tenants', 'GET', { eq: { id: id }, limit: 1 }).then(function(rows) {
    if (!rows || !rows.length) return null;
    var tenant = rows[0];
    if (typeof tenant.enabled_modules === 'string') {
      try { tenant.enabled_modules = JSON.parse(tenant.enabled_modules); } catch(e) { tenant.enabled_modules = []; }
    }
    return tenant;
  });
}

// Middleware: extract tenant from route param :slug
function tenantFromSlug(req, res, next) {
  var slug = req.params.slug;
  if (!slug) return res.status(400).json({ error: 'Tenant slug required' });
  loadTenant(slug).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Organisation not found. Visit tituscrm.com.au' });
    if (tenant.status === 'suspended') return res.status(403).json({ error: 'This organisation account has been suspended.' });
    req.tenant = tenant;
    next();
  }).catch(function(err) {
    console.error('[TENANT]', err.message);
    next(err);
  });
}

// Helper: fallback tenant resolution for superadmin/director users
function tryAdminFallback(req, res, next) {
  if (req.user && (req.user.role === 'superadmin' || req.user.role === 'director')) {
    return sb.query('tenants', 'GET', { eq: { status: 'active' }, limit: 1 })
      .then(function(tenants) {
        if (!tenants || !tenants.length) return res.status(400).json({ error: 'Tenant context required' });
        var tenant = tenants[0];
        if (typeof tenant.enabled_modules === 'string') {
          try { tenant.enabled_modules = JSON.parse(tenant.enabled_modules); } catch(e) { tenant.enabled_modules = []; }
        }
        req.tenant = tenant;
        next();
      })
      .catch(function(err) {
        console.error('[TENANT] admin fallback error:', err.message);
        return res.status(400).json({ error: 'Tenant context required' });
      });
  }
  return res.status(400).json({ error: 'Tenant context required' });
}

// Middleware: extract tenant from authenticated user session
// Requires auth middleware to have set req.user with tenant_id
function tenantFromSession(req, res, next) {
  if (!req.user || !req.user.tenant_id) {
    // Fallback 1: try header x-tenant-id for API clients
    var tid = req.headers['x-tenant-id'];
    if (tid) {
      loadTenantById(tid).then(function(tenant) {
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        req.tenant = tenant;
        next();
      }).catch(next);
      return;
    }
    // Fallback 2: resolve tenant from user email via tenant_users table
    if (req.user && req.user.email) {
      sb.query('tenant_users', 'GET', { eq: { email: req.user.email }, limit: 1 })
        .then(function(rows) {
          if (rows && rows.length && rows[0].tenant_id) {
            return loadTenantById(rows[0].tenant_id).then(function(tenant) {
              if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
              req.tenant = tenant;
              next();
            });
          }
          return tryAdminFallback(req, res, next);
        })
        .catch(function(err) {
          // tenant_users table may not exist — try admin fallback
          return tryAdminFallback(req, res, next);
        });
      return;
    }
    return res.status(400).json({ error: 'Tenant context required' });
  }
  loadTenantById(req.user.tenant_id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    req.tenant = tenant;
    next();
  }).catch(next);
}

// Helper: scope a Supabase query params object with tenant_id
function scopeQuery(params, tenantId) {
  if (!params) params = {};
  if (!params.eq) params.eq = {};
  params.eq.tenant_id = tenantId;
  return params;
}

// Clear cache for a tenant (call after updates)
function clearCache(slug) {
  delete _cache[slug];
}

module.exports = { tenantFromSlug, tenantFromSession, loadTenant, loadTenantById, scopeQuery, clearCache };
