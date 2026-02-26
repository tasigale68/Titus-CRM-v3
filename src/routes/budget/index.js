const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { logAudit } = require('../../services/audit');
const airtable = require('../../services/airtable');
const env = require('../../config/env');

const router = express.Router();

router.use(authenticate);

// NDIS Price Guide rates (2025-26 approximate)
var NDIS_RATES = {
  weekday: 67.56,
  saturday: 94.69,
  sunday: 121.59,
  evening: 74.42,
  publicHoliday: 168.90
};

var BUDGET_TABLE = airtable.TABLES.CLIENT_BUDGETS; // "Client Core Budgets"
var ROSTER_TABLE = airtable.TABLES.ROSTERS;         // "Rosters 2025"

// ═══════════════════════════════════════════════
//  GET /api/budget/ndis-items — NDIS Price Guide
// ═══════════════════════════════════════════════
router.get('/ndis-items', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ items: [], total: 0 });
  var state = req.query.state || 'Standard'; // Standard=national rate, Remote, VeryRemote

  airtable.fetchAllFromTable('NDIS Price Guide 2025 - 2026').then(function (records) {
    // Log ALL field names from first record to debug rate mapping
    if (records.length > 0) {
      console.log('NDIS Price Guide fields:', Object.keys(records[0].fields).join(', '));
    }
    function parseRate(val) {
      if (!val) return 0;
      return parseFloat(String(val).replace(/[$,\s]/g, '')) || 0;
    }
    var isRemote = (state === 'Remote');
    var isVeryRemote = (state === 'VeryRemote');
    var items = records
      .filter(function (r) { return r.fields['Support Item Number'] && r.fields['Support Item Name']; })
      .map(function (r) {
        var f = r.fields;
        var baseRate = parseRate(f['Charge per hour']);
        var remoteRate = parseRate(f[' Remote ']) || parseRate(f['Remote']);
        var veryRemoteRate = parseRate(f[' Very Remote ']) || parseRate(f['Very Remote']);
        var rate = isVeryRemote ? (veryRemoteRate || baseRate) : isRemote ? (remoteRate || baseRate) : baseRate;
        return {
          id: r.id,
          code: (f['Support Item Number'] || '').trim(),
          name: (f['Support Item Name'] || '').trim(),
          category: (f['Support Category Name'] || f['Support Category Name (PACE)'] || '').trim(),
          group: f['Registration Group Number'] || '',
          unit: f['Unit'] || 'H',
          rate: rate,
          rates: {
            Standard: baseRate,
            Remote: remoteRate || baseRate,
            VeryRemote: veryRemoteRate || baseRate
          }
        };
      })
      .filter(function (i) { return i.rate > 0 || i.code; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });

    console.log('NDIS items fetched:', items.length, '| sample:', items[0] ? items[0].code + ' $' + items[0].rate : 'none');
    res.json({ items: items, total: items.length, state: state });
  }).catch(function (e) {
    console.error('NDIS items error:', e.message);
    res.status(500).json({ error: e.message, items: [] });
  });
});

// ═══════════════════════════════════════════════
//  GET /api/budget/alerts — Low budgets and expiring plans
// ═══════════════════════════════════════════════
// NOTE: This must be before /:clientId to avoid matching "alerts" as a clientId
router.get('/alerts', function (req, res) {
  airtable.rawFetch(BUDGET_TABLE, 'GET', '?pageSize=100').then(function (data) {
    var alerts = [];
    var now = new Date();
    (data.records || []).forEach(function (r) {
      var f = r.fields || {};
      var clientName = f['Client Name'] || 'Unknown';
      var totalBudget = parseFloat(f['Total Budget'] || 0);
      var planEnd = f['Plan End Date'] || f['Plan End'] || '';
      // Check plan expiry
      if (planEnd) {
        var endDate = new Date(planEnd);
        var daysUntilExpiry = Math.round((endDate - now) / 86400000);
        if (daysUntilExpiry <= 60 && daysUntilExpiry > 0) {
          alerts.push({ type: 'expiring', client: clientName, daysRemaining: daysUntilExpiry, planEnd: planEnd });
        } else if (daysUntilExpiry <= 0) {
          alerts.push({ type: 'expired', client: clientName, planEnd: planEnd });
        }
      }
    });
    res.json(alerts);
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══════════════════════════════════════════════
//  GET /api/budget/check/:clientName/:category — Budget check for scheduler integration
// ═══════════════════════════════════════════════
router.get('/check/:clientName/:category', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ configured: false, budget: 0, used: 0, remaining: 0, pct: 0 });
  var clientName = decodeURIComponent(req.params.clientName);
  var category = req.params.category || 'sil'; // sil, community_access, transport
  var shiftHours = parseFloat(req.query.hours || 0);
  var shiftDay = req.query.day || 'weekday'; // weekday, saturday, sunday, publicHoliday
  var shiftRate = NDIS_RATES[shiftDay] || NDIS_RATES.weekday;
  var shiftCost = shiftHours * shiftRate;

  var filter = encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'");
  airtable.rawFetch(BUDGET_TABLE, 'GET', '?filterByFormula=' + filter + '&pageSize=5').then(function (data) {
    var rec = (data.records || [])[0];
    if (!rec) return res.json({ found: false, clientName: clientName, budget: 0, used: 0, remaining: 0, pct: 0, shiftCost: shiftCost });
    var f = rec.fields || {};
    var budgetField, usedField;
    if (category === 'sil') { budgetField = 'SIL Budget'; usedField = 'SIL Used'; }
    else if (category === 'community_access') { budgetField = 'Community Access Budget'; usedField = 'Community Access Used'; }
    else if (category === 'transport') { budgetField = 'Transport Budget'; usedField = 'Transport Used'; }
    else { budgetField = 'SIL Budget'; usedField = 'SIL Used'; }
    var budget = parseFloat(f[budgetField] || f['Core Budget (SIL)'] || 0);
    var used = parseFloat(f[usedField] || 0);
    // Also aggregate from rosters for scheduled cost
    var rFilter = encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'");
    airtable.rawFetch(ROSTER_TABLE, 'GET', '?filterByFormula=' + rFilter + '&pageSize=100').then(function (rData) {
      var scheduledCost = 0;
      (rData.records || []).forEach(function (s) {
        var sf = s.fields || {};
        var hours = parseFloat(sf['Total Hours (Decimal)'] || sf['Hours'] || 0);
        var charge = parseFloat(sf['Charge per hour'] || 0);
        scheduledCost += hours * (charge || shiftRate);
      });
      var totalUsed = Math.max(used, scheduledCost);
      var remaining = budget - totalUsed;
      var pct = budget > 0 ? Math.round((totalUsed / budget) * 100) : 0;
      var afterShift = remaining - shiftCost;
      var severity = 'green';
      if (pct >= 80 || afterShift < 0) severity = 'red';
      else if (pct >= 40) severity = 'amber';
      res.json({
        found: true, clientName: clientName, budgetId: rec.id,
        category: category, budget: Math.round(budget * 100) / 100,
        used: Math.round(totalUsed * 100) / 100, remaining: Math.round(remaining * 100) / 100,
        pct: pct, shiftCost: Math.round(shiftCost * 100) / 100,
        afterShift: Math.round(afterShift * 100) / 100, severity: severity,
        blocked: afterShift < 0
      });
    }).catch(function () {
      var remaining = budget - used;
      res.json({ found: true, clientName: clientName, budgetId: rec.id, category: category, budget: budget, used: used, remaining: remaining, pct: budget > 0 ? Math.round((used / budget) * 100) : 0, shiftCost: shiftCost, afterShift: remaining - shiftCost, severity: remaining - shiftCost < 0 ? 'red' : 'green', blocked: remaining - shiftCost < 0 });
    });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══════════════════════════════════════════════
//  GET /api/budget/projection/:clientName — Budget projection
// ═══════════════════════════════════════════════
router.get('/projection/:clientName', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ error: 'Airtable not configured' });
  var clientName = decodeURIComponent(req.params.clientName);
  var filter = encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'");

  Promise.all([
    airtable.rawFetch(BUDGET_TABLE, 'GET', '?filterByFormula=' + filter + '&pageSize=5'),
    airtable.rawFetch(ROSTER_TABLE, 'GET', '?filterByFormula=' + encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'") + '&pageSize=100')
  ]).then(function (results) {
    var budgetRec = (results[0].records || [])[0];
    if (!budgetRec) return res.json({ found: false });
    var bf = budgetRec.fields || {};
    var shifts = results[1].records || [];
    var totalBudget = parseFloat(bf['Total Budget'] || 0) || (parseFloat(bf['SIL Budget'] || 0) + parseFloat(bf['Community Access Budget'] || 0) + parseFloat(bf['Transport Budget'] || 0));
    var weeklySpend = {};
    shifts.forEach(function (s) {
      var sf = s.fields || {};
      var hours = parseFloat(sf['Total Hours (Decimal)'] || sf['Hours'] || 0);
      var charge = parseFloat(sf['Charge per hour'] || 0);
      var date = sf['Date'] || sf['Shift Date'] || '';
      var d = new Date(date);
      var rate = charge || NDIS_RATES.weekday;
      if (!charge) { var dow = d.getDay(); if (dow === 6) rate = NDIS_RATES.saturday; if (dow === 0) rate = NDIS_RATES.sunday; }
      var cost = hours * rate;
      var weekStart = new Date(d); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      var wk = weekStart.toISOString().split('T')[0];
      if (!weeklySpend[wk]) weeklySpend[wk] = 0;
      weeklySpend[wk] += cost;
    });
    var weeks = Object.keys(weeklySpend).sort();
    var totalSpend = 0; weeks.forEach(function (w) { totalSpend += weeklySpend[w]; });
    var avgWeekly = weeks.length > 0 ? totalSpend / weeks.length : 0;
    var remaining = totalBudget - totalSpend;
    var weeksLeft = avgWeekly > 0 ? remaining / avgWeekly : null;
    var exhaustionDate = null;
    if (weeksLeft !== null && weeksLeft > 0) {
      var d = new Date(); d.setDate(d.getDate() + Math.round(weeksLeft * 7));
      exhaustionDate = d.toISOString().split('T')[0];
    }
    res.json({
      found: true, clientName: clientName, totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpend: Math.round(totalSpend * 100) / 100, remaining: Math.round(remaining * 100) / 100,
      avgWeeklyBurn: Math.round(avgWeekly * 100) / 100, weeksRemaining: weeksLeft ? Math.round(weeksLeft * 10) / 10 : null,
      projectedExhaustionDate: exhaustionDate, shiftCount: shifts.length,
      weeklyBreakdown: weeks.map(function (w) { return { week: w, spend: Math.round(weeklySpend[w] * 100) / 100 }; })
    });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══════════════════════════════════════════════
//  GET /api/budget/ — All client budgets
// ═══════════════════════════════════════════════
router.get('/', function (req, res) {
  airtable.rawFetch(BUDGET_TABLE, 'GET', '?pageSize=100').then(function (data) {
    var records = (data.records || []).map(function (r) {
      var f = r.fields || {};
      return {
        id: r.id,
        clientName: f['Client Name'],
        ndisNumber: f['NDIS Number'] || f['NDIS #'] || '',
        planStartDate: f['Plan Start Date'] || f['Plan Start'] || '',
        planEndDate: f['Plan End Date'] || f['Plan End'] || '',
        planManager: f['Plan Manager'] || '',
        silBudget: parseFloat(f['SIL Budget'] || f['Core Budget (SIL)'] || 0),
        communityAccessBudget: parseFloat(f['Community Access Budget'] || f['Core Budget (Community Access)'] || 0),
        transportBudget: parseFloat(f['Transport Budget'] || f['Core Budget (Transport)'] || 0),
        coreOtherBudget: parseFloat(f['Core Other Budget'] || 0),
        capacityBuildingBudget: parseFloat(f['Capacity Building Budget'] || 0),
        totalBudget: parseFloat(f['Total Budget'] || 0),
        notes: f['Notes'] || ''
      };
    });
    res.json(records);
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══════════════════════════════════════════════
//  POST /api/budget/ — Create or update a budget
// ═══════════════════════════════════════════════
router.post('/', function (req, res) {
  var fields = {};
  if (req.body.clientName) fields['Client Name'] = req.body.clientName;
  if (req.body.ndisNumber) fields['NDIS Number'] = req.body.ndisNumber;
  if (req.body.planStartDate) fields['Plan Start Date'] = req.body.planStartDate;
  if (req.body.planEndDate) fields['Plan End Date'] = req.body.planEndDate;
  if (req.body.planManager) fields['Plan Manager'] = req.body.planManager;
  if (req.body.silBudget !== undefined) fields['SIL Budget'] = parseFloat(req.body.silBudget);
  if (req.body.communityAccessBudget !== undefined) fields['Community Access Budget'] = parseFloat(req.body.communityAccessBudget);
  if (req.body.transportBudget !== undefined) fields['Transport Budget'] = parseFloat(req.body.transportBudget);
  if (req.body.coreOtherBudget !== undefined) fields['Core Other Budget'] = parseFloat(req.body.coreOtherBudget);
  if (req.body.capacityBuildingBudget !== undefined) fields['Capacity Building Budget'] = parseFloat(req.body.capacityBuildingBudget);
  var total = (parseFloat(req.body.silBudget || 0)) + (parseFloat(req.body.communityAccessBudget || 0)) +
    (parseFloat(req.body.transportBudget || 0)) + (parseFloat(req.body.coreOtherBudget || 0)) + (parseFloat(req.body.capacityBuildingBudget || 0));
  fields['Total Budget'] = total;
  if (req.body.id) {
    // Update existing budget record
    airtable.rawFetch(BUDGET_TABLE, 'PATCH', '', { records: [{ id: req.body.id, fields: fields }] }).then(function (data) {
      res.json({ success: true, id: req.body.id });
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  } else {
    // Create new budget record
    airtable.rawFetch(BUDGET_TABLE, 'POST', '', { records: [{ fields: fields }] }).then(function (data) {
      res.json({ success: true, id: (data.records && data.records[0]) ? data.records[0].id : null });
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  }
});

// ═══════════════════════════════════════════════
//  POST /api/budget/deduct — Budget deduction on shift completion
// ═══════════════════════════════════════════════
router.post('/deduct', function (req, res) {
  if (!env.airtable.apiKey || !env.airtable.baseId) return res.json({ success: false, error: 'Airtable not configured' });
  var clientName = req.body.clientName;
  var category = req.body.category || 'sil';
  var amount = parseFloat(req.body.amount || 0);
  if (!clientName || amount <= 0) return res.status(400).json({ error: 'clientName and positive amount required' });

  var filter = encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'");
  airtable.rawFetch(BUDGET_TABLE, 'GET', '?filterByFormula=' + filter + '&pageSize=5').then(function (data) {
    var rec = (data.records || [])[0];
    if (!rec) return res.status(404).json({ error: 'No budget record found for ' + clientName });
    var f = rec.fields || {};
    var usedField;
    if (category === 'sil') usedField = 'SIL Used';
    else if (category === 'community_access') usedField = 'Community Access Used';
    else if (category === 'transport') usedField = 'Transport Used';
    else usedField = 'SIL Used';
    var currentUsed = parseFloat(f[usedField] || 0);
    var newUsed = currentUsed + amount;
    var patchFields = {};
    patchFields[usedField] = Math.round(newUsed * 100) / 100;
    airtable.rawFetch(BUDGET_TABLE, 'PATCH', '/' + rec.id, { fields: patchFields }).then(function () {
      logAudit(req.user, 'budget_deduct', 'Budget', rec.id, clientName, 'Deducted $' + amount.toFixed(2) + ' from ' + category, '', '');
      res.json({ success: true, clientName: clientName, category: category, deducted: amount, newUsed: newUsed });
    }).catch(function (err) { res.status(500).json({ error: err.message }); });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══════════════════════════════════════════════
//  GET /api/budget/:clientId — Single client budget detail
// ═══════════════════════════════════════════════
router.get('/:clientId', function (req, res) {
  airtable.rawFetch(BUDGET_TABLE, 'GET', '/' + req.params.clientId).then(function (rec) {
    if (rec.error) return res.status(404).json({ error: rec.error.message || 'Not found' });
    var f = rec.fields || {};
    res.json({
      id: rec.id,
      clientName: f['Client Name'],
      ndisNumber: f['NDIS Number'] || f['NDIS #'] || '',
      planStartDate: f['Plan Start Date'] || f['Plan Start'] || '',
      planEndDate: f['Plan End Date'] || f['Plan End'] || '',
      planManager: f['Plan Manager'] || '',
      silBudget: parseFloat(f['SIL Budget'] || f['Core Budget (SIL)'] || 0),
      communityAccessBudget: parseFloat(f['Community Access Budget'] || f['Core Budget (Community Access)'] || 0),
      transportBudget: parseFloat(f['Transport Budget'] || f['Core Budget (Transport)'] || 0),
      coreOtherBudget: parseFloat(f['Core Other Budget'] || 0),
      capacityBuildingBudget: parseFloat(f['Capacity Building Budget'] || 0),
      totalBudget: parseFloat(f['Total Budget'] || 0),
      notes: f['Notes'] || ''
    });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

// ═══════════════════════════════════════════════
//  GET /api/budget/:clientId/utilisation — Utilisation data from Rosters
// ═══════════════════════════════════════════════
router.get('/:clientId/utilisation', function (req, res) {
  airtable.rawFetch(BUDGET_TABLE, 'GET', '/' + req.params.clientId).then(function (budgetRec) {
    if (budgetRec.error) return res.status(404).json({ error: budgetRec.error.message || 'Not found' });
    var bf = budgetRec.fields || {};
    var clientName = bf['Client Name'] || '';
    var planStart = bf['Plan Start Date'] || bf['Plan Start'] || '';
    var planEnd = bf['Plan End Date'] || bf['Plan End'] || '';
    // Fetch rosters for this client
    var filter = encodeURIComponent("{Client Name}='" + clientName.replace(/'/g, "\\'") + "'");
    return airtable.rawFetch(ROSTER_TABLE, 'GET', '?filterByFormula=' + filter + '&pageSize=100').then(function (rosterData) {
      var shifts = rosterData.records || [];
      var totalSpend = 0;
      var weeklySpend = {};
      shifts.forEach(function (s) {
        var sf = s.fields || {};
        var hours = parseFloat(sf['Hours'] || sf['Total Hours'] || 0);
        var date = sf['Date'] || sf['Shift Date'] || '';
        // Determine day type and apply NDIS rate
        var d = new Date(date);
        var dayOfWeek = d.getDay();
        var rate = NDIS_RATES.weekday;
        if (dayOfWeek === 6) rate = NDIS_RATES.saturday;
        if (dayOfWeek === 0) rate = NDIS_RATES.sunday;
        var cost = hours * rate;
        totalSpend += cost;
        // Weekly grouping
        var weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        var weekKey = weekStart.toISOString().split('T')[0];
        if (!weeklySpend[weekKey]) weeklySpend[weekKey] = 0;
        weeklySpend[weekKey] += cost;
      });
      var totalBudget = parseFloat(bf['Total Budget'] || 0) ||
        (parseFloat(bf['SIL Budget'] || bf['Core Budget (SIL)'] || 0)) +
        (parseFloat(bf['Community Access Budget'] || bf['Core Budget (Community Access)'] || 0)) +
        (parseFloat(bf['Transport Budget'] || bf['Core Budget (Transport)'] || 0));
      var remaining = totalBudget - totalSpend;
      var weekKeys = Object.keys(weeklySpend).sort();
      var avgWeekly = weekKeys.length > 0 ? totalSpend / weekKeys.length : 0;
      var projectedWeeks = avgWeekly > 0 ? remaining / avgWeekly : null;
      res.json({
        clientName: clientName,
        totalBudget: Math.round(totalBudget * 100) / 100,
        totalSpend: Math.round(totalSpend * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        avgWeeklyBurn: Math.round(avgWeekly * 100) / 100,
        projectedWeeksRemaining: projectedWeeks ? Math.round(projectedWeeks * 10) / 10 : null,
        weeklyBreakdown: weekKeys.map(function (wk) { return { week: wk, spend: Math.round(weeklySpend[wk] * 100) / 100 }; }),
        shiftCount: shifts.length,
        planStart: planStart,
        planEnd: planEnd
      });
    });
  }).catch(function (err) { res.status(500).json({ error: err.message }); });
});

module.exports = router;
