// Titus CRM — Tenant Management & Public Tenant Config Routes
// Uses direct Supabase client for all multi-tenant operations

var express = require('express');
var crypto = require('crypto');
var sb = require('../services/supabaseClient');
var aygSb = require('../services/aygSupabaseClient');
var { authenticate, requireRole, hashPassword } = require('../middleware/auth');
var { tenantFromSession, loadTenant, clearCache } = require('../middleware/tenant');
var { calculatePrice, ADDON_MODULES, BASE_FEES } = require('../middleware/modules');

var router = express.Router();

// ─── V5 Supabase Client Configuration ─────────────────────
var V5_SUPABASE_URL = (process.env.V5_SUPABASE_URL || 'https://mptaztzpzvpaebdaqodt.supabase.co').trim().replace(/\/+$/, '');
var V5_SUPABASE_SERVICE_KEY = (process.env.V5_SUPABASE_SERVICE_KEY || '').trim();

// Resend & Twilio Configuration
var RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
var RESEND_FROM = (process.env.RESEND_FROM || 'a4@askyrgrandpa.com').trim();
var TWILIO_ACCOUNT_SID = (process.env.TWILIO_ACCOUNT_SID || '').trim();
var TWILIO_AUTH_TOKEN = (process.env.TWILIO_AUTH_TOKEN || '').trim();
var TWILIO_FROM_NUMBER = (process.env.TWILIO_FROM_NUMBER || '+61468071489').trim();
var GUS_PHONE = (process.env.GUS_PHONE || '+61413538474').trim();

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

// ─── Self-Service Signup Routes (NEW) ─────────────────────

// Helper: Send email via Resend
function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log('[EMAIL] Resend not configured. Would send:', { to, subject });
    return Promise.resolve({ success: false, reason: 'RESEND_API_KEY not configured' });
  }

  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: RESEND_FROM, to: to, subject: subject, html: html })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Resend error: ' + t.substring(0, 200)); });
    return r.json();
  }).catch(function(e) {
    console.error('[EMAIL ERROR]', e.message);
    return { success: false, error: e.message };
  });
}

// Helper: Send SMS via Twilio
function sendSMS(to, body) {
  if (!TWILIO_AUTH_TOKEN) {
    console.log('[SMS] Twilio not configured. Would send to', to + ':', body);
    return Promise.resolve({ success: false, reason: 'TWILIO_AUTH_TOKEN not configured' });
  }

  var auth = Buffer.from(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN).toString('base64');
  var data = new URLSearchParams({
    From: TWILIO_FROM_NUMBER,
    To: to,
    Body: body
  });

  return fetch('https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_ACCOUNT_SID + '/Messages.json', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: data.toString()
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Twilio error: ' + t.substring(0, 200)); });
    return r.json();
  }).catch(function(e) {
    console.error('[SMS ERROR]', e.message);
    return { success: false, error: e.message };
  });
}

// Helper: Generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Generate slug
function generateSlug(text) {
  var base = slugify(text);
  var suffix = Math.random().toString(36).slice(2, 6).toLowerCase();
  return base + '-' + suffix;
}

// Helper: Create V5 account (org + user)
function createV5Account(accountData) {
  if (!V5_SUPABASE_SERVICE_KEY) {
    return Promise.reject(new Error('V5_SUPABASE_SERVICE_KEY not configured'));
  }

  var firstName = (accountData.first_name || '').trim();
  var lastName = (accountData.last_name || '').trim();
  var email = (accountData.email || '').trim().toLowerCase();
  var phone = (accountData.phone || '').trim();
  var accountType = accountData.account_type; // 'contractor' | 'company'
  var companyName = (accountData.company_name || firstName + ' ' + lastName).trim();

  var orgType = accountType === 'contractor' ? 'contractor' : 'company';
  var userRole = accountType === 'contractor' ? 'Independent Contractor' : 'Director';
  var slug = generateSlug(companyName);
  var tempPassword = 'Titus' + Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 8) + '!';
  var activationExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Create organisation
  return fetch(V5_SUPABASE_URL + '/rest/v1/organisations', {
    method: 'POST',
    headers: {
      'apikey': V5_SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + V5_SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      name: companyName,
      slug: slug,
      type: orgType,
      activation_expires_at: activationExpiry,
      admin_temp_password: tempPassword
    })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('V5 org creation failed: ' + t.substring(0, 300)); });
    return r.json();
  }).then(function(orgs) {
    if (!orgs || orgs.length === 0) throw new Error('No org returned from insert');
    var org = orgs[0];

    // 2. Create auth user via GoTrue
    return fetch(V5_SUPABASE_URL + '/auth/v1/admin/users', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + V5_SUPABASE_SERVICE_KEY,
        'apikey': V5_SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: tempPassword,
        email_confirm: false,  // Require email verification
        user_metadata: { full_name: firstName + ' ' + lastName }
      })
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t) { throw new Error('GoTrue user creation failed: ' + t.substring(0, 300)); });
      return r.json().then(function(authUser) { return { org: org, authUser: authUser }; });
    });
  }).then(function(result) {
    var org = result.org;
    var authUser = result.authUser;

    // 3. Create users table record
    return fetch(V5_SUPABASE_URL + '/rest/v1/users', {
      method: 'POST',
      headers: {
        'apikey': V5_SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + V5_SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: authUser.id,
        org_id: org.id,
        name: firstName + ' ' + lastName,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone || null,
        role: userRole,
        employment_type: accountType === 'contractor' ? 'Independent Contractor' : 'Full-Time',
        status: 'Inactive',  // Inactive until email verified
        verification_code: generateCode(),
        verification_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),  // 30 min
        email_verified: false
      })
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t) { throw new Error('V5 user record creation failed: ' + t.substring(0, 300)); });
      return r.json();
    }).then(function(users) {
      if (!users || users.length === 0) throw new Error('No user returned from insert');
      var user = users[0];
      return { org: org, authUser: authUser, user: user, tempPassword: tempPassword };
    });
  });
}

// POST /api/tenant/self-signup — create new V5 account + store assessment
router.post('/self-signup', function(req, res) {
  var body = req.body || {};
  var firstName = (body.first_name || '').trim();
  var lastName = (body.last_name || '').trim();
  var email = (body.email || '').trim().toLowerCase();
  var phone = (body.phone || '').trim();
  var accountType = body.account_type;  // 'contractor' | 'company'
  var companyName = (body.company_name || '').trim();
  var staffSize = body.staff_size;
  var sector = body.sector;  // 'ndis' | 'domestic_violence' | 'real_estate'
  var heardFrom = body.heard_from;
  var tools = body.tools || {};
  var pain = body.pain || {};
  var additionalNotes = body.additional_notes;

  // Validation
  if (!firstName || !lastName || !email || !phone || !accountType || !sector) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['contractor', 'company'].includes(accountType)) {
    return res.status(400).json({ error: 'Invalid account_type' });
  }

  if (!['ndis', 'domestic_violence', 'real_estate'].includes(sector)) {
    return res.status(400).json({ error: 'Invalid sector' });
  }

  // Create V5 account
  createV5Account({
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone,
    account_type: accountType,
    company_name: companyName || (firstName + ' ' + lastName)
  }).then(function(result) {
    var org = result.org;
    var user = result.user;
    var verificationCode = user.verification_code;

    // Store assessment in AYG
    var assessmentPromise = aygSb.insert('signup_assessments', {
      account_type: accountType,
      sector: sector,
      company_name: companyName || null,
      staff_size: staffSize || null,
      heard_from: heardFrom || null,
      tool_rostering: tools.rostering || null,
      tool_recruitment: tools.recruitment || null,
      tool_hr: tools.hr || null,
      tool_quality: tools.quality || null,
      tool_phone: tools.phone || null,
      pain_reporting: pain.reporting || false,
      pain_data_entry: pain.data_entry || false,
      pain_integrations: pain.integrations || false,
      additional_notes: additionalNotes || null,
      titus_tenant_id: org.id,
      titus_user_id: user.id
    }).catch(function(e) {
      console.error('[ASSESSMENT STORE ERROR]', e.message);
      // Don't fail signup if assessment store fails
      return null;
    });

    // Create/update contact in AYG
    var contactPromise = aygSb.upsert('contacts', {
      email: email,
      name: firstName + ' ' + lastName,
      phone: phone || null,
      stage: 'assessment',
      tags: ['TITUS_SIGNUP'],
      platforms: ['titus']
    }, 'email').catch(function(e) {
      console.error('[CONTACT UPSERT ERROR]', e.message);
      return null;
    });

    return Promise.all([assessmentPromise, contactPromise]).then(function(results) {
      // Send verification email
      var emailHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2>Verify Your Titus CRM Account</h2>
  <p>Hi ${firstName},</p>
  <p>Please enter this code to verify your email and activate your account:</p>
  <div style="background:#f5f5f5;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
    <div style="font-size:32px;font-weight:bold;letter-spacing:4px;font-family:monospace;">${verificationCode}</div>
  </div>
  <p>This code expires in 30 minutes.</p>
  <p>If you didn't sign up for Titus CRM, you can safely ignore this email.</p>
</div>`;

      var emailPromise = sendEmail(email, 'Your Titus CRM verification code', emailHtml);

      // Send SMS alert to Gus
      var smsBody = `Hi Gus - new signup ${firstName} ${lastName}, ${email} & ${phone} (${accountType}${companyName ? ', ' + companyName : ''}${staffSize ? ', ' + staffSize + ' staff' : ''}, ${sector}). Tools: Rostering=${tools.rostering || 'none'}, Recruitment=${tools.recruitment || 'none'}, HR=${tools.hr || 'none'}, QM=${tools.quality || 'none'}, Phone=${tools.phone || 'none'}. Pain: Reporting=${pain.reporting ? 'Y' : 'N'}, Data=${pain.data_entry ? 'Y' : 'N'}, Integration=${pain.integrations ? 'Y' : 'N'}.`;
      var smsPromise = sendSMS(GUS_PHONE, smsBody);

      return Promise.all([emailPromise, smsPromise]).then(function(notifResults) {
        return {
          org: org,
          user: user,
          emailResult: notifResults[0],
          smsResult: notifResults[1]
        };
      });
    });
  }).then(function(result) {
    console.log('[SELF-SIGNUP SUCCESS]', result.org.slug, '(' + result.user.email + ')');
    res.status(201).json({
      success: true,
      tenant_id: result.org.id,
      user_id: result.user.id,
      email: result.user.email,
      sector: sector,
      email_sent: result.emailResult && result.emailResult.id ? true : false,
      sms_sent: result.smsResult && result.smsResult.sid ? true : false
    });
  }).catch(function(err) {
    console.error('[SELF-SIGNUP ERROR]', err.message);
    res.status(400).json({ error: err.message });
  });
});

// POST /api/tenant/verify-email — verify code and activate account
router.post('/verify-email', function(req, res) {
  var body = req.body || {};
  var email = (body.email || '').trim().toLowerCase();
  var code = (body.code || '').trim();

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }

  if (!V5_SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'V5_SUPABASE_SERVICE_KEY not configured' });
  }

  // Find user by email and verify code
  fetch(V5_SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&select=id,org_id,verification_code,verification_expires_at,email_verified', {
    headers: {
      'apikey': V5_SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + V5_SUPABASE_SERVICE_KEY
    }
  }).then(function(r) {
    if (!r.ok) throw new Error('Query failed: ' + r.status);
    return r.json();
  }).then(function(users) {
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    var user = users[0];

    // Check expiry
    if (!user.verification_expires_at || new Date(user.verification_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Request a new code.' });
    }

    // Check code
    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark as verified and activate
    return fetch(V5_SUPABASE_URL + '/rest/v1/users?id=eq.' + user.id, {
      method: 'PATCH',
      headers: {
        'apikey': V5_SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + V5_SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        email_verified: true,
        verification_code: null,
        verification_expires_at: null,
        status: 'Active'
      })
    }).then(function(r) {
      if (!r.ok) throw new Error('Update failed: ' + r.status);
      return r.json();
    }).then(function(updatedUsers) {
      if (!updatedUsers || updatedUsers.length === 0) throw new Error('User not returned after update');
      var updatedUser = updatedUsers[0];

      // Get org to send welcome email
      return fetch(V5_SUPABASE_URL + '/rest/v1/organisations?id=eq.' + updatedUser.org_id, {
        headers: {
          'apikey': V5_SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + V5_SUPABASE_SERVICE_KEY
        }
      }).then(function(r) {
        return r.json();
      }).then(function(orgs) {
        var org = orgs && orgs.length > 0 ? orgs[0] : null;
        return { user: updatedUser, org: org };
      });
    }).then(function(result) {
      var org = result.org;
      var loginUrl = 'https://app.titus-crm.com/login?org=' + (org ? org.slug : '');

      // Send welcome email with login details
      var welcomeHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2>Welcome to Titus CRM!</h2>
  <p>Hi ${result.user.name},</p>
  <p>Your account is now active. Here are your login details:</p>
  <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0;">
    <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Email:</strong> ${result.user.email}</p>
    <p><strong>Password:</strong> ${org ? org.admin_temp_password : '[See email sent at signup]'}</p>
  </div>
  <p>Your 14-day free trial has started. You'll be asked to add payment details by day 7 to continue access.</p>
</div>`;

      sendEmail(result.user.email, 'Welcome to Titus CRM', welcomeHtml).catch(function(e) {
        console.error('[WELCOME EMAIL ERROR]', e.message);
      });

      console.log('[EMAIL VERIFIED]', result.user.email, 'for org', org.slug);
      res.json({
        success: true,
        email: result.user.email,
        slug: org ? org.slug : null,
        login_url: loginUrl
      });
    });
  }).catch(function(err) {
    console.error('[VERIFY EMAIL ERROR]', err.message);
    res.status(400).json({ error: err.message });
  });
});

module.exports = router;
