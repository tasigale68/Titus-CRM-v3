// Titus CRM -- Payroll Routes (SaaS multi-tenant)
// SCHADS Award-based payroll generation, runs, and CSV export

var express = require('express');
var sb = require('../../services/supabaseClient');
var { authenticate } = require('../../middleware/auth');
var { tenantFromSession, scopeQuery } = require('../../middleware/tenant');
var schads = require('../../services/schadsRates');

var router = express.Router();

// All routes require auth + tenant context
router.use(authenticate, tenantFromSession);

// ═══════════════════════════════════════════════════════════
//  SCHADS Rates
// ═══════════════════════════════════════════════════════════

// GET /api/payroll/rates -- return SCHADS rates (default + tenant overrides)
router.get('/rates', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('schads_rates', 'GET', scopeQuery({}, tenantId))
    .then(function(overrides) {
      // Build merged rates: defaults + tenant overrides
      var rates = {};
      var levels = Object.keys(schads.RATES);
      for (var i = 0; i < levels.length; i++) {
        var lvl = levels[i];
        rates[lvl] = {
          level: lvl,
          description: schads.RATES[lvl].description,
          default_hourly: schads.RATES[lvl].hourly,
          tenant_hourly: null,
          effective_hourly: schads.RATES[lvl].hourly
        };
      }

      // Apply tenant overrides
      (overrides || []).forEach(function(o) {
        var key = o.level;
        if (rates[key]) {
          rates[key].tenant_hourly = o.hourly_rate;
          rates[key].effective_hourly = o.hourly_rate;
        }
      });

      res.json({
        rates: rates,
        penalties: schads.PENALTIES,
        allowances: schads.ALLOWANCES,
        super_rate: schads.SUPER_RATE
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] rates error:', err.message);
      res.status(500).json({ error: 'Failed to load rates' });
    });
});

// PUT /api/payroll/rates/:level -- upsert rate override for tenant
router.put('/rates/:level', function(req, res) {
  var tenantId = req.tenant.id;
  var level = req.params.level;
  var hourlyRate = parseFloat(req.body.hourly_rate);

  if (!schads.RATES[level]) {
    return res.status(400).json({ error: 'Invalid SCHADS level: ' + level });
  }
  if (isNaN(hourlyRate) || hourlyRate <= 0) {
    return res.status(400).json({ error: 'hourly_rate must be a positive number' });
  }

  // Check if override exists
  sb.query('schads_rates', 'GET', scopeQuery({ eq: { level: level } }, tenantId))
    .then(function(existing) {
      if (existing && existing.length > 0) {
        // Update
        return sb.update('schads_rates', { eq: { id: existing[0].id } }, {
          hourly_rate: hourlyRate,
          updated_at: new Date().toISOString()
        });
      } else {
        // Insert
        return sb.insert('schads_rates', {
          tenant_id: tenantId,
          level: level,
          hourly_rate: hourlyRate,
          description: schads.RATES[level].description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    })
    .then(function(result) {
      res.json({
        message: 'Rate updated for level ' + level,
        level: level,
        hourly_rate: hourlyRate,
        record: result && result[0] ? result[0] : null
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] rate upsert error:', err.message);
      res.status(500).json({ error: 'Failed to update rate' });
    });
});

// ═══════════════════════════════════════════════════════════
//  Payroll Generation
// ═══════════════════════════════════════════════════════════

// POST /api/payroll/generate -- generate payroll run from delivered rosters
router.post('/generate', function(req, res) {
  var tenantId = req.tenant.id;
  var periodStart = req.body.pay_period_start;
  var periodEnd = req.body.pay_period_end;
  var periodType = req.body.period_type || 'fortnightly';

  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: 'pay_period_start and pay_period_end are required' });
  }

  var tenantRates = {};

  // Step 1: Load tenant rate overrides
  sb.query('schads_rates', 'GET', scopeQuery({}, tenantId))
    .then(function(overrides) {
      (overrides || []).forEach(function(o) {
        tenantRates[o.level] = o.hourly_rate;
      });

      // Step 2: Query delivered rosters in date range
      return sb.query('rosters', 'GET', scopeQuery({
        gte: { end_shift: periodStart },
        lte: { end_shift: periodEnd },
        or: 'status.eq.delivered,clock_out_time.not.is.null',
        order: 'start_shift.asc'
      }, tenantId));
    })
    .then(function(rosters) {
      if (!rosters || rosters.length === 0) {
        return res.status(404).json({ error: 'No delivered shifts found for this pay period' });
      }

      // Step 3: Group by worker_email
      var workerShifts = {};
      rosters.forEach(function(r) {
        var key = r.worker_email || r.staff_email || 'unknown';
        if (!workerShifts[key]) {
          workerShifts[key] = {
            worker_email: key,
            worker_name: r.worker_name || r.staff_name || key,
            employee_id: r.employee_id || '',
            classification: r.classification || r.schads_level || '2.1',
            bsb: r.bsb || '',
            account_number: r.account_number || '',
            shifts: []
          };
        }
        workerShifts[key].shifts.push(r);
      });

      // Step 4: Calculate pay for each worker
      var payrollLines = [];
      var totalGross = 0;
      var totalSuper = 0;
      var totalCost = 0;

      var workerKeys = Object.keys(workerShifts);
      workerKeys.forEach(function(email) {
        var worker = workerShifts[email];
        var level = worker.classification;

        // Override hourly rate if tenant has custom
        var effectiveRate = tenantRates[level] || (schads.RATES[level] ? schads.RATES[level].hourly : schads.RATES['2.1'].hourly);

        var ordinaryHours = 0;
        var saturdayHours = 0;
        var sundayHours = 0;
        var phHours = 0;
        var sleepovers = 0;
        var splitShifts = 0;
        var flags = [];

        // Track weekly hours for overtime calculation
        var weeklyBuckets = {};

        worker.shifts.forEach(function(shift) {
          var start = new Date(shift.start_shift);
          var end = new Date(shift.end_shift || shift.clock_out_time);
          var hours = (end - start) / (1000 * 60 * 60);
          if (hours <= 0) hours = 0;

          // Round to 2 decimals
          hours = Math.round(hours * 100) / 100;

          var dayType = schads.getDayType(shift.start_shift);

          // Categorise by day type
          if (dayType === 'public_holiday') {
            phHours += hours;
          } else if (dayType === 'sunday') {
            sundayHours += hours;
          } else if (dayType === 'saturday') {
            saturdayHours += hours;
          } else {
            ordinaryHours += hours;
          }

          // Weekly bucket for overtime
          var weekStart = getWeekStart(start);
          var weekKey = weekStart.toISOString().split('T')[0];
          if (!weeklyBuckets[weekKey]) weeklyBuckets[weekKey] = 0;
          weeklyBuckets[weekKey] += hours;

          // Allowances
          if (shift.is_sleepover || shift.shift_type === 'sleepover') sleepovers++;
          if (shift.is_split_shift || shift.shift_type === 'split') splitShifts++;

          // Flags
          if (!shift.clock_in_time && shift.status === 'delivered') {
            flags.push('Missing clock-in: ' + (shift.start_shift || '').substring(0, 10));
          }
          if (shift.geo_violation) {
            flags.push('Geo-fence violation: ' + (shift.start_shift || '').substring(0, 10));
          }
          if (shift.time_discrepancy) {
            flags.push('Time discrepancy: ' + (shift.start_shift || '').substring(0, 10));
          }
        });

        // Step 4b: Calculate overtime (hours over 38 per week)
        var overtimeT15 = 0;
        var overtimeT20 = 0;
        var weekKeys = Object.keys(weeklyBuckets);
        weekKeys.forEach(function(wk) {
          var wkHours = weeklyBuckets[wk];
          if (wkHours > 38) {
            var otHours = wkHours - 38;
            var ot15 = Math.min(otHours, 2);
            var ot20 = Math.max(0, otHours - 2);
            overtimeT15 += ot15;
            overtimeT20 += ot20;
            // Subtract overtime from ordinary
            ordinaryHours = Math.max(0, ordinaryHours - otHours);
          }
        });

        // Step 4c: Calculate costs using schads service
        var ordinaryCost = schads.calculateShiftCost({
          level: level,
          hours: ordinaryHours,
          dayType: 'weekday',
          isOvertime: false
        });

        var satCost = schads.calculateShiftCost({
          level: level,
          hours: saturdayHours,
          dayType: 'saturday',
          isOvertime: false
        });

        var sunCost = schads.calculateShiftCost({
          level: level,
          hours: sundayHours,
          dayType: 'sunday',
          isOvertime: false
        });

        var phCost = schads.calculateShiftCost({
          level: level,
          hours: phHours,
          dayType: 'public_holiday',
          isOvertime: false
        });

        var otCost = schads.calculateShiftCost({
          level: level,
          hours: overtimeT15 + overtimeT20,
          dayType: 'weekday',
          isOvertime: true,
          overtimeHours: overtimeT15 + overtimeT20
        });

        var sleepoverPay = sleepovers * schads.ALLOWANCES.sleepover;
        var splitShiftPay = splitShifts * schads.ALLOWANCES.split_shift;

        var grossPay = ordinaryCost.gross_pay + satCost.gross_pay + sunCost.gross_pay +
                       phCost.gross_pay + otCost.gross_pay + sleepoverPay + splitShiftPay;
        grossPay = Math.round(grossPay * 100) / 100;

        var superAmount = Math.round(grossPay * schads.SUPER_RATE * 100) / 100;
        var lineTotalCost = Math.round((grossPay + superAmount) * 100) / 100;

        totalGross += grossPay;
        totalSuper += superAmount;
        totalCost += lineTotalCost;

        payrollLines.push({
          tenant_id: tenantId,
          worker_email: email,
          worker_name: worker.worker_name,
          employee_id: worker.employee_id,
          classification: level,
          ordinary_hours: Math.round(ordinaryHours * 100) / 100,
          overtime_t15_hours: Math.round(overtimeT15 * 100) / 100,
          overtime_t20_hours: Math.round(overtimeT20 * 100) / 100,
          saturday_hours: Math.round(saturdayHours * 100) / 100,
          sunday_hours: Math.round(sundayHours * 100) / 100,
          public_holiday_hours: Math.round(phHours * 100) / 100,
          sleepovers: sleepovers,
          split_shifts: splitShifts,
          gross_pay: grossPay,
          super_amount: superAmount,
          total_cost: lineTotalCost,
          bsb: worker.bsb,
          account_number: worker.account_number,
          flags: flags.length > 0 ? flags.join('; ') : null,
          created_at: new Date().toISOString()
        });
      });

      totalGross = Math.round(totalGross * 100) / 100;
      totalSuper = Math.round(totalSuper * 100) / 100;
      totalCost = Math.round(totalCost * 100) / 100;

      // Step 5: Create payroll run record
      var payrollRun = {
        tenant_id: tenantId,
        pay_period_start: periodStart,
        pay_period_end: periodEnd,
        period_type: periodType,
        status: 'draft',
        total_workers: payrollLines.length,
        total_shifts: rosters.length,
        total_ordinary_hours: payrollLines.reduce(function(s, l) { return s + l.ordinary_hours; }, 0),
        total_overtime_hours: payrollLines.reduce(function(s, l) { return s + l.overtime_t15_hours + l.overtime_t20_hours; }, 0),
        total_gross_pay: totalGross,
        total_super: totalSuper,
        total_cost: totalCost,
        generated_by: req.user.email || req.user.name || 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return sb.insert('payroll_runs', payrollRun).then(function(runResult) {
        var run = runResult[0];
        var runId = run.id;

        // Step 6: Insert payroll lines with run_id
        var linesToInsert = payrollLines.map(function(line) {
          line.payroll_run_id = runId;
          return line;
        });

        return sb.insert('payroll_lines', linesToInsert).then(function(insertedLines) {
          run.lines = insertedLines;
          res.json(run);
        });
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] generate error:', err.message);
      res.status(500).json({ error: 'Failed to generate payroll run: ' + err.message });
    });
});

// ═══════════════════════════════════════════════════════════
//  Payroll Runs CRUD
// ═══════════════════════════════════════════════════════════

// GET /api/payroll/runs -- list payroll runs for tenant
router.get('/runs', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('payroll_runs', 'GET', scopeQuery({
    order: 'created_at.desc',
    limit: req.query.limit ? parseInt(req.query.limit) : 50
  }, tenantId))
    .then(function(runs) {
      res.json(runs || []);
    })
    .catch(function(err) {
      console.error('[PAYROLL] list runs error:', err.message);
      res.status(500).json({ error: 'Failed to list payroll runs' });
    });
});

// GET /api/payroll/runs/:id -- get payroll run with all lines
router.get('/runs/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var runId = req.params.id;

  sb.query('payroll_runs', 'GET', scopeQuery({ eq: { id: runId } }, tenantId))
    .then(function(runs) {
      if (!runs || runs.length === 0) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      var run = runs[0];

      return sb.query('payroll_lines', 'GET', {
        eq: { payroll_run_id: runId, tenant_id: tenantId },
        order: 'worker_name.asc'
      }).then(function(lines) {
        run.lines = lines || [];
        res.json(run);
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] get run error:', err.message);
      res.status(500).json({ error: 'Failed to load payroll run' });
    });
});

// PUT /api/payroll/runs/:id -- update status (draft -> review -> approved -> exported)
router.put('/runs/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var runId = req.params.id;
  var newStatus = req.body.status;

  var validTransitions = {
    'draft': ['review'],
    'review': ['approved', 'draft'],
    'approved': ['exported', 'review'],
    'exported': []
  };

  // Fetch current run
  sb.query('payroll_runs', 'GET', scopeQuery({ eq: { id: runId } }, tenantId))
    .then(function(runs) {
      if (!runs || runs.length === 0) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      var run = runs[0];
      var currentStatus = run.status;

      if (!newStatus) {
        return res.status(400).json({ error: 'status is required' });
      }

      var allowed = validTransitions[currentStatus] || [];
      if (allowed.indexOf(newStatus) < 0) {
        return res.status(400).json({
          error: 'Invalid status transition: ' + currentStatus + ' -> ' + newStatus,
          allowed: allowed
        });
      }

      var updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'approved') {
        updateData.approved_by = req.user.email || req.user.name;
        updateData.approved_at = new Date().toISOString();
      }
      if (newStatus === 'exported') {
        updateData.exported_at = new Date().toISOString();
      }

      return sb.update('payroll_runs', { eq: { id: runId } }, updateData).then(function(result) {
        res.json(result && result[0] ? result[0] : { id: runId, status: newStatus });
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] update run error:', err.message);
      res.status(500).json({ error: 'Failed to update payroll run' });
    });
});

// ═══════════════════════════════════════════════════════════
//  CSV Export
// ═══════════════════════════════════════════════════════════

// GET /api/payroll/runs/:id/export -- generate CSV export
router.get('/runs/:id/export', function(req, res) {
  var tenantId = req.tenant.id;
  var runId = req.params.id;

  sb.query('payroll_runs', 'GET', scopeQuery({ eq: { id: runId } }, tenantId))
    .then(function(runs) {
      if (!runs || runs.length === 0) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      var run = runs[0];

      return sb.query('payroll_lines', 'GET', {
        eq: { payroll_run_id: runId, tenant_id: tenantId },
        order: 'worker_name.asc'
      }).then(function(lines) {
        // Build CSV
        var csvHeader = 'Worker Name,Employee ID,Classification,Ordinary Hrs,OT T1.5 Hrs,OT T2.0 Hrs,Sat Hrs,Sun Hrs,PH Hrs,Sleepovers,Split Shifts,Gross Pay,Super,Total Cost,BSB,Account,Flags';
        var csvRows = [csvHeader];

        (lines || []).forEach(function(l) {
          var row = [
            csvEscape(l.worker_name || ''),
            csvEscape(l.employee_id || ''),
            csvEscape(l.classification || ''),
            (l.ordinary_hours || 0).toFixed(2),
            (l.overtime_t15_hours || 0).toFixed(2),
            (l.overtime_t20_hours || 0).toFixed(2),
            (l.saturday_hours || 0).toFixed(2),
            (l.sunday_hours || 0).toFixed(2),
            (l.public_holiday_hours || 0).toFixed(2),
            l.sleepovers || 0,
            l.split_shifts || 0,
            (l.gross_pay || 0).toFixed(2),
            (l.super_amount || 0).toFixed(2),
            (l.total_cost || 0).toFixed(2),
            csvEscape(l.bsb || ''),
            csvEscape(l.account_number || ''),
            csvEscape(l.flags || '')
          ];
          csvRows.push(row.join(','));
        });

        var csv = csvRows.join('\n');
        var filename = 'payroll-' + run.pay_period_start + '-to-' + run.pay_period_end + '.csv';

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
        res.send(csv);
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] export error:', err.message);
      res.status(500).json({ error: 'Failed to export payroll run' });
    });
});

// ═══════════════════════════════════════════════════════════
//  Flagged Shifts
// ═══════════════════════════════════════════════════════════

// GET /api/payroll/flags -- flagged shifts for current pay period
router.get('/flags', function(req, res) {
  var tenantId = req.tenant.id;

  // Default to current fortnight if not specified
  var now = new Date();
  var periodEnd = req.query.period_end || now.toISOString().split('T')[0];
  var periodStart = req.query.period_start;
  if (!periodStart) {
    var start = new Date(now);
    start.setDate(start.getDate() - 14);
    periodStart = start.toISOString().split('T')[0];
  }

  sb.query('rosters', 'GET', scopeQuery({
    gte: { end_shift: periodStart },
    lte: { end_shift: periodEnd },
    order: 'start_shift.desc'
  }, tenantId))
    .then(function(rosters) {
      var flagged = [];

      (rosters || []).forEach(function(r) {
        var issues = [];

        // Missing clock-in
        if (!r.clock_in_time && (r.status === 'delivered' || r.clock_out_time)) {
          issues.push({ type: 'missing_clock_in', severity: 'amber', message: 'Missing clock-in time' });
        }

        // Missing clock-out
        if (r.clock_in_time && !r.clock_out_time && r.status !== 'cancelled') {
          issues.push({ type: 'missing_clock_out', severity: 'amber', message: 'Missing clock-out time' });
        }

        // Geo-fence violation
        if (r.geo_violation) {
          issues.push({ type: 'geo_fence', severity: 'red', message: 'Geo-fence violation detected' });
        }

        // Time discrepancy (rostered vs actual > 30 min)
        if (r.clock_in_time && r.start_shift) {
          var rostered = new Date(r.start_shift);
          var actual = new Date(r.clock_in_time);
          var diffMin = Math.abs(actual - rostered) / (1000 * 60);
          if (diffMin > 30) {
            issues.push({
              type: 'time_discrepancy',
              severity: 'amber',
              message: 'Start time differs by ' + Math.round(diffMin) + ' minutes from rostered'
            });
          }
        }

        if (r.clock_out_time && r.end_shift) {
          var rosteredEnd = new Date(r.end_shift);
          var actualEnd = new Date(r.clock_out_time);
          var diffMinEnd = Math.abs(actualEnd - rosteredEnd) / (1000 * 60);
          if (diffMinEnd > 30) {
            issues.push({
              type: 'time_discrepancy',
              severity: 'amber',
              message: 'End time differs by ' + Math.round(diffMinEnd) + ' minutes from rostered'
            });
          }
        }

        if (issues.length > 0) {
          flagged.push({
            roster_id: r.id,
            worker_name: r.worker_name || r.staff_name || r.worker_email || 'Unknown',
            worker_email: r.worker_email || r.staff_email || '',
            client_name: r.client_name || '',
            start_shift: r.start_shift,
            end_shift: r.end_shift,
            clock_in_time: r.clock_in_time || null,
            clock_out_time: r.clock_out_time || null,
            status: r.status,
            issues: issues
          });
        }
      });

      res.json({
        period_start: periodStart,
        period_end: periodEnd,
        total_flagged: flagged.length,
        flagged_shifts: flagged
      });
    })
    .catch(function(err) {
      console.error('[PAYROLL] flags error:', err.message);
      res.status(500).json({ error: 'Failed to load flagged shifts' });
    });
});

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════

function csvEscape(val) {
  var str = String(val || '');
  if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function getWeekStart(date) {
  var d = new Date(date);
  var day = d.getDay(); // 0=Sunday
  var diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  var weekStart = new Date(d);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

module.exports = router;
