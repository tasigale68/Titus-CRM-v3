// Titus CRM — Tenant Management & Public Tenant Config Routes
// Uses direct Supabase client for all multi-tenant operations

var express = require('express');
var crypto = require('crypto');
var sb = require('../services/supabaseClient');
var { authenticate, requireRole, hashPassword } = require('../middleware/auth');
var { tenantFromSession, loadTenant, clearCache } = require('../middleware/tenant');
var { calculatePrice, ADDON_MODULES, BASE_FEES } = require('../middleware/modules');

var router = express.Router();

// ─── Helpers ─────────────────────────────────────────────

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function determineTier(staffCount) {
  var n = parseInt(staffCount) || 1;
  if (n <= 10) return '1-10';
  if (n <= 30) return '11-30';
  if (n <= 50) return '31-50';
  return '50+';
}

// ─── Public Routes (NO auth) ────────────────────────────

// GET /api/tenant/:slug/config — public tenant branding
router.get('/:slug/config', function(req, res) {
  var slug = req.params.slug;
  if (!slug) return res.status(400).json({ error: 'Slug required' });

  loadTenant(slug).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Organisation not found' });

    res.json({
      org_name: tenant.org_name || '',
      logo_url: tenant.logo_url || '',
      primary_colour: tenant.primary_colour || '#1a73e8',
      secondary_colour: tenant.secondary_colour || '#174ea6',
      slug: tenant.slug
    });
  }).catch(function(err) {
    console.error('[TENANT CONFIG]', err.message);
    res.status(500).json({ error: 'Failed to load tenant config' });
  });
});

// POST /api/tenant/signup — create new tenant + admin user
router.post('/signup', function(req, res) {
  var org_name = (req.body.org_name || '').trim();
  var admin_email = (req.body.admin_email || '').trim().toLowerCase();
  var admin_name = (req.body.admin_name || '').trim();
  var phone = (req.body.phone || '').trim();
  var staff_count = parseInt(req.body.staff_count) || 1;
  var modules = req.body.modules || [];
  var slug = req.body.slug ? slugify(req.body.slug) : slugify(org_name);

  // Validation
  if (!org_name) return res.status(400).json({ error: 'Organisation name is required' });
  if (!admin_email) return res.status(400).json({ error: 'Admin email is required' });
  if (!slug) return res.status(400).json({ error: 'Could not generate a valid URL slug from organisation name' });

  // Validate email format
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(admin_email)) return res.status(400).json({ error: 'Invalid email format' });

  // Check slug uniqueness
  sb.query('tenants', 'GET', { eq: { slug: slug }, limit: 1 }).then(function(existing) {
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Organisation URL slug already taken. Please choose a different name or provide a custom slug.' });
    }

    // Determine pricing
    var base_tier = determineTier(staff_count);
    var validModules = (modules || []).filter(function(m) { return !!ADDON_MODULES[m]; });
    var pricing = calculatePrice(base_tier, validModules);

    // Set trial period: 14 days from now
    var trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);

    // Build tenant record
    var tenantData = {
      org_name: org_name,
      slug: slug,
      admin_email: admin_email,
      phone: phone || null,
      staff_count: staff_count,
      base_tier: base_tier,
      weekly_price: pricing.total,
      enabled_modules: JSON.stringify(validModules),
      status: 'trial',
      trial_ends_at: trialEnds.toISOString(),
      primary_colour: '#1a73e8',
      secondary_colour: '#174ea6',
      created_at: new Date().toISOString()
    };

    // Insert tenant
    sb.insert('tenants', tenantData).then(function(rows) {
      var tenant = rows[0];
      if (!tenant) throw new Error('Failed to create tenant record');

      // Insert enabled modules into tenant_modules table
      var moduleInserts = validModules.map(function(moduleKey) {
        return {
          tenant_id: tenant.id,
          module_key: moduleKey,
          enabled: true,
          enabled_at: new Date().toISOString()
        };
      });

      var modulePromise = moduleInserts.length > 0
        ? sb.insert('tenant_modules', moduleInserts)
        : Promise.resolve([]);

      return modulePromise.then(function() {
        // Create admin user for this tenant
        var tempPassword = crypto.randomBytes(8).toString('hex');
        var userData = {
          tenant_id: tenant.id,
          email: admin_email,
          name: admin_name || org_name + ' Admin',
          role: 'superadmin',
          password_hash: hashPassword(tempPassword),
          created_at: new Date().toISOString()
        };

        return sb.insert('tenant_users', userData).then(function(userRows) {
          var user = userRows[0];

          // Generate auth token
          var token = crypto.randomBytes(32).toString('hex');

          // TODO: Send welcome email with tempPassword
          console.log('[TENANT SIGNUP] New tenant created:', org_name, '(' + slug + ') — admin:', admin_email);
          console.log('[TENANT SIGNUP] Temp password for', admin_email + ':', tempPassword);

          // Parse enabled_modules back to array for response
          tenant.enabled_modules = validModules;

          res.status(201).json({
            tenant: {
              id: tenant.id,
              org_name: tenant.org_name,
              slug: tenant.slug,
              status: tenant.status,
              base_tier: base_tier,
              weekly_price: pricing.total,
              trial_ends_at: tenant.trial_ends_at,
              enabled_modules: validModules
            },
            token: token,
            admin: {
              id: user ? user.id : null,
              email: admin_email,
              name: userData.name,
              temp_password: tempPassword
            }
          });
        });
      });
    }).catch(function(err) {
      console.error('[TENANT SIGNUP] Error:', err.message);
      // Check for unique constraint violations
      if (err.message && err.message.indexOf('duplicate') >= 0) {
        return res.status(409).json({ error: 'An organisation with this slug or admin email already exists' });
      }
      res.status(500).json({ error: 'Failed to create tenant: ' + err.message });
    });
  }).catch(function(err) {
    console.error('[TENANT SIGNUP] Slug check error:', err.message);
    res.status(500).json({ error: 'Failed to verify slug availability' });
  });
});

// ─── Authenticated Routes ────────────────────────────────

// GET /api/tenant/mine — get current user's tenant config
router.get('/mine', authenticate, tenantFromSession, function(req, res) {
  var tenant = req.tenant;
  if (!tenant) return res.status(404).json({ error: 'No tenant found for your account' });

  var modules = tenant.enabled_modules;
  if (typeof modules === 'string') {
    try { modules = JSON.parse(modules); } catch(e) { modules = []; }
  }

  res.json({
    id: tenant.id,
    org_name: tenant.org_name,
    slug: tenant.slug,
    logo_url: tenant.logo_url || '',
    primary_colour: tenant.primary_colour || '#1a73e8',
    secondary_colour: tenant.secondary_colour || '#174ea6',
    status: tenant.status,
    base_tier: tenant.base_tier,
    staff_count: tenant.staff_count,
    weekly_price: tenant.weekly_price,
    trial_ends_at: tenant.trial_ends_at || null,
    enabled_modules: modules,
    admin_email: tenant.admin_email || '',
    phone: tenant.phone || '',
    created_at: tenant.created_at
  });
});

// PUT /api/tenant/mine — update own tenant config (superadmin only)
router.put('/mine', authenticate, requireRole('superadmin'), tenantFromSession, function(req, res) {
  var tenant = req.tenant;
  if (!tenant) return res.status(404).json({ error: 'No tenant found for your account' });

  var updates = {};
  if (req.body.org_name !== undefined) updates.org_name = (req.body.org_name || '').trim();
  if (req.body.logo_url !== undefined) updates.logo_url = req.body.logo_url;
  if (req.body.primary_colour !== undefined) updates.primary_colour = req.body.primary_colour;
  if (req.body.secondary_colour !== undefined) updates.secondary_colour = req.body.secondary_colour;
  if (req.body.phone !== undefined) updates.phone = req.body.phone;
  if (req.body.staff_count !== undefined) {
    updates.staff_count = parseInt(req.body.staff_count) || tenant.staff_count;
    updates.base_tier = determineTier(updates.staff_count);

    // Recalculate pricing when staff_count changes
    var currentModules = tenant.enabled_modules;
    if (typeof currentModules === 'string') {
      try { currentModules = JSON.parse(currentModules); } catch(e) { currentModules = []; }
    }
    var pricing = calculatePrice(updates.base_tier, currentModules || []);
    updates.weekly_price = pricing.total;
  }

  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length <= 1) return res.json({ success: true, message: 'No changes' });

  sb.update('tenants', { eq: { id: tenant.id } }, updates).then(function(rows) {
    // Clear cache so next request gets fresh data
    clearCache(tenant.slug);

    var updated = rows[0] || tenant;
    var modules = updated.enabled_modules;
    if (typeof modules === 'string') {
      try { modules = JSON.parse(modules); } catch(e) { modules = []; }
    }

    res.json({
      success: true,
      tenant: {
        id: updated.id,
        org_name: updated.org_name,
        slug: updated.slug,
        logo_url: updated.logo_url || '',
        primary_colour: updated.primary_colour || '#1a73e8',
        secondary_colour: updated.secondary_colour || '#174ea6',
        status: updated.status,
        base_tier: updated.base_tier,
        staff_count: updated.staff_count,
        weekly_price: updated.weekly_price,
        enabled_modules: modules
      }
    });
  }).catch(function(err) {
    console.error('[TENANT UPDATE]', err.message);
    res.status(500).json({ error: 'Failed to update tenant' });
  });
});

module.exports = router;
