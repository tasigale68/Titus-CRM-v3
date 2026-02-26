// Titus CRM — Pricing Calculator API
// Public routes for module pricing and cost estimation

var express = require('express');
var { ADDON_MODULES, BASE_FEES, CORE_MODULES, calculatePrice } = require('../../middleware/modules');

var router = express.Router();

// ─── GET /api/pricing/modules — list all available modules ───

router.get('/modules', function(req, res) {
  // Build addon modules list with prices
  var addons = Object.keys(ADDON_MODULES).map(function(key) {
    return {
      key: key,
      name: ADDON_MODULES[key].name,
      price: ADDON_MODULES[key].price,
      type: 'addon'
    };
  });

  // Build core modules list (always included)
  var core = CORE_MODULES.map(function(key) {
    return {
      key: key,
      name: key.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
      price: 0,
      type: 'core'
    };
  });

  res.json({
    core_modules: core,
    addon_modules: addons,
    base_fees: BASE_FEES,
    all_modules_flat_rate: 599,
    trial_days: 14
  });
});

// ─── POST /api/pricing/calculate — calculate total cost ──────

router.post('/calculate', function(req, res) {
  var staff_count = parseInt(req.body.staff_count) || 1;
  var selectedModules = req.body.modules || [];

  // Validate modules — only accept known addon keys
  var validModules = selectedModules.filter(function(m) {
    return !!ADDON_MODULES[m];
  });

  // Determine base tier from staff count
  var base_tier;
  if (staff_count <= 10) base_tier = '1-10';
  else if (staff_count <= 30) base_tier = '11-30';
  else if (staff_count <= 50) base_tier = '31-50';
  else base_tier = '50+';

  var base_fee = BASE_FEES[base_tier] || 29;

  // Calculate using the shared pricing engine
  var pricing = calculatePrice(base_tier, validModules);

  // Build module detail breakdown
  var moduleDetails = validModules.map(function(key) {
    var addon = ADDON_MODULES[key];
    return {
      key: key,
      name: addon ? addon.name : key,
      price: addon ? addon.price : 0
    };
  });

  var addonsSubtotal = moduleDetails.reduce(function(sum, m) { return sum + m.price; }, 0);

  res.json({
    base_tier: base_tier,
    base_fee: base_fee,
    staff_count: staff_count,
    modules: moduleDetails,
    subtotal: base_fee + addonsSubtotal,
    discount_pct: pricing.discount_pct,
    discount: pricing.discount,
    total: pricing.total,
    is_flat_rate: pricing.flat_rate || false,
    currency: 'AUD',
    billing_cycle: 'weekly'
  });
});

module.exports = router;
