// Module gating middleware for Titus CRM SaaS
// CORE modules: always enabled, never gated
// Add-on modules: check tenant.enabled_modules array

var CORE_MODULES = [
  'qms', 'contacts_tasks', 'service_agreement_signing', 'sos_signing',
  'roster_of_care', 'rosters', 'client_budget', 'compliance',
  'payroll_export', 'ai_weekly_reports', 'ai_chatbot', 'sw_app'
];

var ADDON_MODULES = {
  'recruiter': { name: 'Recruiter ATS', price: 59 },
  'leads': { name: 'Leads & CRM', price: 49 },
  'voice_sms': { name: 'Voice Phone & SMS System', price: 99 },
  'ai_voice': { name: '24/7 AI Voice Agent', price: 99 },
  'client_management': { name: 'Client Management (Advanced)', price: 69 },
  'billing': { name: 'Billing & Invoicing', price: 79 },
  'lms': { name: 'Learning Management (LMS)', price: 49 },
  'ai_reports': { name: 'AI Report Writing (Advanced)', price: 59 },
  'employment_signing': { name: 'Employment Contract Signing', price: 39 },
  'stakeholder_portal': { name: 'Stakeholder Portal', price: 49 }
};

var BASE_FEES = {
  '1-10': 29,
  '11-30': 49,
  '31-50': 69,
  '50+': 99
};

function isCore(moduleKey) {
  return CORE_MODULES.indexOf(moduleKey) >= 0;
}

function isAddon(moduleKey) {
  return !!ADDON_MODULES[moduleKey];
}

// Check if tenant has a specific add-on module enabled
function hasModule(tenant, moduleKey) {
  if (isCore(moduleKey)) return true;
  if (!tenant || !tenant.enabled_modules) return false;
  var modules = tenant.enabled_modules;
  if (typeof modules === 'string') {
    try { modules = JSON.parse(modules); } catch(e) { return false; }
  }
  return Array.isArray(modules) && modules.indexOf(moduleKey) >= 0;
}

// Middleware factory: require a specific module
function requireModule(moduleKey) {
  return function(req, res, next) {
    if (isCore(moduleKey)) return next();
    if (!req.tenant) return res.status(400).json({ error: 'Tenant context required' });
    if (hasModule(req.tenant, moduleKey)) return next();

    var addon = ADDON_MODULES[moduleKey] || {};
    return res.status(403).json({
      error: 'module_not_enabled',
      module: moduleKey,
      module_name: addon.name || moduleKey,
      weekly_price: addon.price || 0,
      message: 'This feature requires the ' + (addon.name || moduleKey) + ' module ($' + (addon.price || 0) + '/week). Please upgrade your plan.',
      upgrade_url: '/pricing'
    });
  };
}

// Calculate total weekly price for a tenant
function calculatePrice(baseTier, enabledModules) {
  var base = BASE_FEES[baseTier] || 29;
  var addons = (enabledModules || []).filter(function(m) { return ADDON_MODULES[m]; });

  // All modules flat rate
  if (addons.length >= Object.keys(ADDON_MODULES).length) return { base: base, addons_total: 599, discount: 0, discount_pct: 0, total: base + 599, flat_rate: true };

  var addonsTotal = addons.reduce(function(sum, m) { return sum + (ADDON_MODULES[m] ? ADDON_MODULES[m].price : 0); }, 0);

  var discountPct = 0;
  if (addons.length >= 7) discountPct = 25;
  else if (addons.length >= 5) discountPct = 15;
  else if (addons.length >= 3) discountPct = 10;

  var discount = Math.round(addonsTotal * discountPct / 100);
  var total = base + addonsTotal - discount;

  return { base: base, addons_total: addonsTotal, discount: discount, discount_pct: discountPct, total: total, flat_rate: false };
}

module.exports = {
  CORE_MODULES: CORE_MODULES,
  ADDON_MODULES: ADDON_MODULES,
  BASE_FEES: BASE_FEES,
  isCore: isCore,
  isAddon: isAddon,
  hasModule: hasModule,
  requireModule: requireModule,
  calculatePrice: calculatePrice
};
