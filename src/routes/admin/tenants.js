// Titus CRM — Superadmin Tenant Management Routes
// Platform-level admin operations on all tenants

var express = require('express');
var crypto = require('crypto');
var sb = require('../../services/supabaseClient');
var { authenticate, requireRole, hashPassword } = require('../../middleware/auth');
var { loadTenantById, clearCache } = require('../../middleware/tenant');
var { calculatePrice, ADDON_MODULES, BASE_FEES } = require('../../middleware/modules');

var router = express.Router();

// All routes require superadmin
router.use(authenticate);
router.use(requireRole('superadmin'));

// ─── Helpers ─────────────────────────────────────────────

function parseModules(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch(e) { return []; }
  }
  return [];
}

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

// ─── GET /api/admin/tenants — list all tenants ───────────

router.get('/', function(req, res) {
  var params = { order: 'created_at.desc' };
  if (req.query.status) params.eq = { status: req.query.status };
  if (req.query.limit) params.limit = parseInt(req.query.limit);
  if (req.query.offset) params.offset = parseInt(req.query.offset);

  sb.query('tenants', 'GET', params).then(function(tenants) {
    var result = (tenants || []).map(function(t) {
      t.enabled_modules = parseModules(t.enabled_modules);
      return t;
    });

    // Fetch user counts per tenant
    var tenantIds = result.map(function(t) { return t.id; });
    if (tenantIds.length === 0) return res.json({ tenants: [], total: 0 });

    // Get user counts in parallel via individual queries (PostgREST limitation)
    var countPromises = result.map(function(t) {
      return sb.query('tenant_users', 'GET', {
        eq: { tenant_id: t.id },
        select: 'id',
        limit: 1000
      }).then(function(users) {
        t.user_count = (users || []).length;
        return t;
      }).catch(function() {
        t.user_count = 0;
        return t;
      });
    });

    return Promise.all(countPromises).then(function(enriched) {
      res.json({
        tenants: enriched,
        total: enriched.length
      });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  });
});

// ─── GET /api/admin/tenants/:id — single tenant detail ──

router.get('/:id', function(req, res) {
  var id = req.params.id;

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Fetch user count and module details
    sb.query('tenant_users', 'GET', { eq: { tenant_id: id }, select: 'id,email,name,role,created_at' }).then(function(users) {
      tenant.users = users || [];
      tenant.user_count = tenant.users.length;

      return sb.query('tenant_modules', 'GET', { eq: { tenant_id: id } }).then(function(modules) {
        tenant.modules = modules || [];
        res.json(tenant);
      });
    }).catch(function(err) {
      // Return tenant even if enrichment fails
      console.error('[ADMIN TENANTS] Detail enrichment error:', err.message);
      res.json(tenant);
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  });
});

// ─── POST /api/admin/tenants — create tenant (admin flow) ─

router.post('/', function(req, res) {
  var org_name = (req.body.org_name || '').trim();
  var admin_email = (req.body.admin_email || '').trim().toLowerCase();
  var admin_name = (req.body.admin_name || '').trim();
  var phone = (req.body.phone || '').trim();
  var staff_count = parseInt(req.body.staff_count) || 1;
  var modules = req.body.modules || [];
  var status = req.body.status || 'active';
  var slug = req.body.slug ? slugify(req.body.slug) : slugify(org_name);

  if (!org_name) return res.status(400).json({ error: 'Organisation name is required' });
  if (!admin_email) return res.status(400).json({ error: 'Admin email is required' });
  if (!slug) return res.status(400).json({ error: 'Could not generate a valid URL slug' });

  // Check slug uniqueness
  sb.query('tenants', 'GET', { eq: { slug: slug }, limit: 1 }).then(function(existing) {
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Slug already taken' });
    }

    var base_tier = determineTier(staff_count);
    var validModules = (modules || []).filter(function(m) { return !!ADDON_MODULES[m]; });
    var pricing = calculatePrice(base_tier, validModules);

    var tenantData = {
      org_name: org_name,
      slug: slug,
      admin_email: admin_email,
      phone: phone || null,
      staff_count: staff_count,
      base_tier: base_tier,
      weekly_price: pricing.total,
      enabled_modules: JSON.stringify(validModules),
      status: status,
      primary_colour: '#1a73e8',
      secondary_colour: '#174ea6',
      created_at: new Date().toISOString()
    };

    // Admin-created tenants skip trial if status is 'active'
    if (status === 'trial') {
      var trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 14);
      tenantData.trial_ends_at = trialEnds.toISOString();
    }

    sb.insert('tenants', tenantData).then(function(rows) {
      var tenant = rows[0];
      if (!tenant) throw new Error('Failed to create tenant');

      // Insert modules
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
        // Create admin user
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
          console.log('[ADMIN] Tenant created by superadmin:', org_name, '(' + slug + ')');
          tenant.enabled_modules = validModules;

          res.status(201).json({
            tenant: tenant,
            admin: {
              id: userRows[0] ? userRows[0].id : null,
              email: admin_email,
              name: userData.name,
              temp_password: tempPassword
            }
          });
        });
      });
    }).catch(function(err) {
      console.error('[ADMIN TENANTS] Create error:', err.message);
      if (err.message && err.message.indexOf('duplicate') >= 0) {
        return res.status(409).json({ error: 'Tenant with this slug or admin email already exists' });
      }
      res.status(500).json({ error: 'Failed to create tenant' });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Slug check error:', err.message);
    res.status(500).json({ error: 'Failed to verify slug availability' });
  });
});

// ─── PUT /api/admin/tenants/:id — update tenant ─────────

router.put('/:id', function(req, res) {
  var id = req.params.id;

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    var updates = {};
    if (req.body.org_name !== undefined) updates.org_name = (req.body.org_name || '').trim();
    if (req.body.slug !== undefined) updates.slug = slugify(req.body.slug);
    if (req.body.logo_url !== undefined) updates.logo_url = req.body.logo_url;
    if (req.body.primary_colour !== undefined) updates.primary_colour = req.body.primary_colour;
    if (req.body.secondary_colour !== undefined) updates.secondary_colour = req.body.secondary_colour;
    if (req.body.admin_email !== undefined) updates.admin_email = (req.body.admin_email || '').trim().toLowerCase();
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.staff_count !== undefined) {
      updates.staff_count = parseInt(req.body.staff_count) || tenant.staff_count;
      updates.base_tier = determineTier(updates.staff_count);
    }
    if (req.body.trial_ends_at !== undefined) updates.trial_ends_at = req.body.trial_ends_at;

    // Recalculate pricing if staff_count or modules changed
    if (updates.base_tier || req.body.enabled_modules !== undefined) {
      var tier = updates.base_tier || tenant.base_tier;
      var mods = req.body.enabled_modules !== undefined
        ? parseModules(req.body.enabled_modules)
        : parseModules(tenant.enabled_modules);
      var pricing = calculatePrice(tier, mods);
      updates.weekly_price = pricing.total;

      if (req.body.enabled_modules !== undefined) {
        updates.enabled_modules = JSON.stringify(mods);
      }
    }

    updates.updated_at = new Date().toISOString();

    sb.update('tenants', { eq: { id: id } }, updates).then(function(rows) {
      clearCache(tenant.slug);
      if (updates.slug && updates.slug !== tenant.slug) clearCache(updates.slug);

      var updated = rows[0] || tenant;
      updated.enabled_modules = parseModules(updated.enabled_modules);

      console.log('[ADMIN] Tenant updated:', updated.org_name, '(' + updated.slug + ')');
      res.json({ success: true, tenant: updated });
    }).catch(function(err) {
      console.error('[ADMIN TENANTS] Update error:', err.message);
      res.status(500).json({ error: 'Failed to update tenant' });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Get error:', err.message);
    res.status(500).json({ error: 'Failed to load tenant' });
  });
});

// ─── POST /api/admin/tenants/:id/suspend — suspend tenant ─

router.post('/:id/suspend', function(req, res) {
  var id = req.params.id;
  var reason = (req.body.reason || '').trim();

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.status === 'suspended') return res.json({ success: true, message: 'Tenant already suspended' });

    var updates = {
      status: 'suspended',
      suspended_at: new Date().toISOString(),
      suspended_reason: reason || null,
      updated_at: new Date().toISOString()
    };

    sb.update('tenants', { eq: { id: id } }, updates).then(function(rows) {
      clearCache(tenant.slug);
      console.log('[ADMIN] Tenant suspended:', tenant.org_name, reason ? '— Reason: ' + reason : '');
      res.json({
        success: true,
        tenant: {
          id: id,
          org_name: tenant.org_name,
          status: 'suspended',
          suspended_at: updates.suspended_at,
          suspended_reason: reason || null
        }
      });
    }).catch(function(err) {
      console.error('[ADMIN TENANTS] Suspend error:', err.message);
      res.status(500).json({ error: 'Failed to suspend tenant' });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Get error:', err.message);
    res.status(500).json({ error: 'Failed to load tenant' });
  });
});

// ─── POST /api/admin/tenants/:id/activate — activate tenant ─

router.post('/:id/activate', function(req, res) {
  var id = req.params.id;

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.status === 'active') return res.json({ success: true, message: 'Tenant already active' });

    var updates = {
      status: 'active',
      suspended_at: null,
      suspended_reason: null,
      updated_at: new Date().toISOString()
    };

    sb.update('tenants', { eq: { id: id } }, updates).then(function(rows) {
      clearCache(tenant.slug);
      console.log('[ADMIN] Tenant activated:', tenant.org_name);
      res.json({
        success: true,
        tenant: {
          id: id,
          org_name: tenant.org_name,
          status: 'active'
        }
      });
    }).catch(function(err) {
      console.error('[ADMIN TENANTS] Activate error:', err.message);
      res.status(500).json({ error: 'Failed to activate tenant' });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Get error:', err.message);
    res.status(500).json({ error: 'Failed to load tenant' });
  });
});

// ─── GET /api/admin/tenants/:id/modules — list tenant modules ─

router.get('/:id/modules', function(req, res) {
  var id = req.params.id;

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    sb.query('tenant_modules', 'GET', { eq: { tenant_id: id }, order: 'module_key.asc' }).then(function(modules) {
      var enabledModules = parseModules(tenant.enabled_modules);

      // Build complete module view — show all available addons with enabled status
      var allModules = Object.keys(ADDON_MODULES).map(function(key) {
        var record = (modules || []).find(function(m) { return m.module_key === key; });
        return {
          key: key,
          name: ADDON_MODULES[key].name,
          price: ADDON_MODULES[key].price,
          enabled: enabledModules.indexOf(key) >= 0,
          enabled_at: record ? record.enabled_at : null
        };
      });

      res.json({
        tenant_id: id,
        base_tier: tenant.base_tier,
        weekly_price: tenant.weekly_price,
        modules: allModules
      });
    }).catch(function(err) {
      console.error('[ADMIN TENANTS] Modules list error:', err.message);
      res.status(500).json({ error: 'Failed to fetch modules' });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Get error:', err.message);
    res.status(500).json({ error: 'Failed to load tenant' });
  });
});

// ─── PUT /api/admin/tenants/:id/modules — update tenant modules ─

router.put('/:id/modules', function(req, res) {
  var id = req.params.id;
  var newModules = req.body.modules || [];

  // Validate: only accept known addon module keys
  var validModules = newModules.filter(function(m) { return !!ADDON_MODULES[m]; });

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    var base_tier = tenant.base_tier || '1-10';
    var pricing = calculatePrice(base_tier, validModules);

    // Update tenant with new modules and price
    var tenantUpdates = {
      enabled_modules: JSON.stringify(validModules),
      weekly_price: pricing.total,
      updated_at: new Date().toISOString()
    };

    sb.update('tenants', { eq: { id: id } }, tenantUpdates).then(function() {
      // Remove existing tenant_modules and re-insert
      return sb.remove('tenant_modules', { eq: { tenant_id: id } }).then(function() {
        if (validModules.length === 0) return Promise.resolve([]);

        var moduleInserts = validModules.map(function(moduleKey) {
          return {
            tenant_id: id,
            module_key: moduleKey,
            enabled: true,
            enabled_at: new Date().toISOString()
          };
        });

        return sb.insert('tenant_modules', moduleInserts);
      });
    }).then(function() {
      clearCache(tenant.slug);
      console.log('[ADMIN] Tenant modules updated:', tenant.org_name, '— modules:', validModules.join(', '), '— price: $' + pricing.total + '/wk');

      res.json({
        success: true,
        tenant_id: id,
        enabled_modules: validModules,
        pricing: {
          base_tier: base_tier,
          base_fee: pricing.base,
          addons_total: pricing.addons_total,
          discount_pct: pricing.discount_pct,
          discount: pricing.discount,
          total: pricing.total,
          is_flat_rate: pricing.flat_rate || false
        }
      });
    }).catch(function(err) {
      console.error('[ADMIN TENANTS] Module update error:', err.message);
      res.status(500).json({ error: 'Failed to update modules' });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Get error:', err.message);
    res.status(500).json({ error: 'Failed to load tenant' });
  });
});

// ─── GET /api/admin/tenants/:id/usage — usage stats ─────

router.get('/:id/usage', function(req, res) {
  var id = req.params.id;

  loadTenantById(id).then(function(tenant) {
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Gather usage statistics from multiple tables in parallel
    var usersPromise = sb.query('tenant_users', 'GET', { eq: { tenant_id: id }, select: 'id' }).then(function(r) { return (r || []).length; }).catch(function() { return 0; });
    var contactsPromise = sb.query('contacts', 'GET', { eq: { tenant_id: id }, select: 'id', limit: 10000 }).then(function(r) { return (r || []).length; }).catch(function() { return 0; });
    var clientsPromise = sb.query('clients', 'GET', { eq: { tenant_id: id }, select: 'id', limit: 10000 }).then(function(r) { return (r || []).length; }).catch(function() { return 0; });
    var rostersPromise = sb.query('rosters', 'GET', { eq: { tenant_id: id }, select: 'id', limit: 10000 }).then(function(r) { return (r || []).length; }).catch(function() { return 0; });
    var leadsPromise = sb.query('leads', 'GET', { eq: { tenant_id: id }, select: 'id', limit: 10000 }).then(function(r) { return (r || []).length; }).catch(function() { return 0; });
    var tasksPromise = sb.query('tasks', 'GET', { eq: { tenant_id: id }, select: 'id', limit: 10000 }).then(function(r) { return (r || []).length; }).catch(function() { return 0; });

    return Promise.all([usersPromise, contactsPromise, clientsPromise, rostersPromise, leadsPromise, tasksPromise]).then(function(counts) {
      res.json({
        tenant_id: id,
        org_name: tenant.org_name,
        status: tenant.status,
        created_at: tenant.created_at,
        usage: {
          users: counts[0],
          contacts: counts[1],
          clients: counts[2],
          rosters: counts[3],
          leads: counts[4],
          tasks: counts[5]
        },
        billing: {
          base_tier: tenant.base_tier,
          staff_count: tenant.staff_count,
          weekly_price: tenant.weekly_price,
          enabled_modules: parseModules(tenant.enabled_modules)
        }
      });
    });
  }).catch(function(err) {
    console.error('[ADMIN TENANTS] Usage error:', err.message);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  });
});

module.exports = router;
