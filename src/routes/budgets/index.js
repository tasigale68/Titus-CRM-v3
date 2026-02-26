// Titus CRM -- Client Budget Tracking Routes (SaaS multi-tenant)
// NDIS budget management, transactions, dashboard, and alerts

var express = require('express');
var sb = require('../../services/supabaseClient');
var { authenticate } = require('../../middleware/auth');
var { tenantFromSession, scopeQuery } = require('../../middleware/tenant');

var router = express.Router();

// All routes require auth + tenant context
router.use(authenticate, tenantFromSession);

// ═══════════════════════════════════════════════════════════
//  Budget CRUD
// ═══════════════════════════════════════════════════════════

// GET /api/budgets -- list all client budgets with utilisation
router.get('/', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('client_budgets', 'GET', scopeQuery({
    order: 'utilisation_pct.desc'
  }, tenantId))
    .then(function(budgets) {
      res.json(budgets || []);
    })
    .catch(function(err) {
      console.error('[BUDGETS] list error:', err.message);
      res.status(500).json({ error: 'Failed to list budgets' });
    });
});

// GET /api/budgets/dashboard -- budget dashboard summary with status indicators
router.get('/dashboard', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('client_budgets', 'GET', scopeQuery({
    order: 'client_id.asc'
  }, tenantId))
    .then(function(budgets) {
      var now = new Date();
      var dashboard = (budgets || []).map(function(b) {
        var allocated = parseFloat(b.allocated_amount) || 0;
        var spent = parseFloat(b.spent_amount) || 0;
        var committed = parseFloat(b.committed_amount) || 0;
        var remaining = allocated - spent - committed;

        var utilisationPct = allocated > 0
          ? Math.round(((spent + committed) / allocated) * 10000) / 100
          : 0;

        // Plan days remaining
        var planEnd = b.plan_end_date ? new Date(b.plan_end_date) : null;
        var planStart = b.plan_start_date ? new Date(b.plan_start_date) : null;
        var daysRemaining = planEnd ? Math.max(0, Math.ceil((planEnd - now) / (1000 * 60 * 60 * 24))) : null;

        // Weekly burn rate
        var weeksElapsed = planStart ? Math.max(1, (now - planStart) / (1000 * 60 * 60 * 24 * 7)) : 1;
        var weeklyBurnRate = Math.round((spent / weeksElapsed) * 100) / 100;

        // Projected exhaustion
        var projectedWeeksRemaining = weeklyBurnRate > 0
          ? Math.round((remaining / weeklyBurnRate) * 10) / 10
          : null;

        // Status determination
        var status;
        if (utilisationPct > 100) {
          status = 'over';
        } else if (utilisationPct >= 96) {
          status = 'red';
        } else if (utilisationPct >= 86) {
          status = 'orange';
        } else if (utilisationPct >= 71) {
          status = 'amber';
        } else {
          status = 'green';
        }

        return {
          id: b.id,
          client_id: b.client_id,
          client_name: b.client_name || '',
          plan_start_date: b.plan_start_date,
          plan_end_date: b.plan_end_date,
          plan_type: b.plan_type || '',
          support_category: b.support_category || '',
          ndis_line_item: b.ndis_line_item || '',
          total_funding: parseFloat(b.total_funding) || 0,
          allocated_amount: allocated,
          spent_amount: spent,
          committed_amount: committed,
          remaining_amount: Math.round(remaining * 100) / 100,
          utilisation_pct: utilisationPct,
          days_remaining: daysRemaining,
          weekly_burn_rate: weeklyBurnRate,
          projected_weeks_remaining: projectedWeeksRemaining,
          status: status
        };
      });

      // Sort by status severity: over, red, orange, amber, green
      var statusOrder = { 'over': 0, 'red': 1, 'orange': 2, 'amber': 3, 'green': 4 };
      dashboard.sort(function(a, b) {
        return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
      });

      res.json(dashboard);
    })
    .catch(function(err) {
      console.error('[BUDGETS] dashboard error:', err.message);
      res.status(500).json({ error: 'Failed to load budget dashboard' });
    });
});

// GET /api/budgets/alerts -- budgets needing attention
router.get('/alerts', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('client_budgets', 'GET', scopeQuery({}, tenantId))
    .then(function(budgets) {
      var now = new Date();
      var alerts = [];

      (budgets || []).forEach(function(b) {
        var allocated = parseFloat(b.allocated_amount) || 0;
        var spent = parseFloat(b.spent_amount) || 0;
        var committed = parseFloat(b.committed_amount) || 0;
        var utilisationPct = allocated > 0
          ? ((spent + committed) / allocated) * 100
          : 0;

        var planEnd = b.plan_end_date ? new Date(b.plan_end_date) : null;
        var planStart = b.plan_start_date ? new Date(b.plan_start_date) : null;
        var daysRemaining = planEnd ? Math.ceil((planEnd - now) / (1000 * 60 * 60 * 24)) : null;

        var budgetAlerts = [];

        // 85%+ utilisation
        if (utilisationPct >= 85) {
          budgetAlerts.push({
            type: 'high_utilisation',
            severity: utilisationPct >= 100 ? 'critical' : 'warning',
            message: 'Budget utilisation at ' + Math.round(utilisationPct) + '%'
          });
        }

        // Over budget
        if (utilisationPct > 100) {
          budgetAlerts.push({
            type: 'over_budget',
            severity: 'critical',
            message: 'Budget exceeded by $' + Math.round((spent + committed - allocated) * 100) / 100
          });
        }

        // Plan ending within 30 days
        if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30) {
          budgetAlerts.push({
            type: 'plan_expiring',
            severity: daysRemaining <= 7 ? 'critical' : 'warning',
            message: 'Plan ends in ' + daysRemaining + ' days'
          });
        }

        // Under-utilised with less than 90 days remaining
        if (utilisationPct < 30 && daysRemaining !== null && daysRemaining > 0 && daysRemaining < 90) {
          budgetAlerts.push({
            type: 'under_utilised',
            severity: 'warning',
            message: 'Only ' + Math.round(utilisationPct) + '% utilised with ' + daysRemaining + ' days remaining'
          });
        }

        if (budgetAlerts.length > 0) {
          alerts.push({
            budget_id: b.id,
            client_id: b.client_id,
            client_name: b.client_name || '',
            support_category: b.support_category || '',
            plan_end_date: b.plan_end_date,
            allocated_amount: allocated,
            spent_amount: spent,
            committed_amount: committed,
            utilisation_pct: Math.round(utilisationPct * 100) / 100,
            days_remaining: daysRemaining,
            alerts: budgetAlerts
          });
        }
      });

      // Sort by most critical first
      var severityOrder = { 'critical': 0, 'warning': 1, 'info': 2 };
      alerts.sort(function(a, b) {
        var aSev = a.alerts[0] ? (severityOrder[a.alerts[0].severity] || 3) : 3;
        var bSev = b.alerts[0] ? (severityOrder[b.alerts[0].severity] || 3) : 3;
        return aSev - bSev;
      });

      res.json({
        total_alerts: alerts.length,
        alerts: alerts
      });
    })
    .catch(function(err) {
      console.error('[BUDGETS] alerts error:', err.message);
      res.status(500).json({ error: 'Failed to load budget alerts' });
    });
});

// GET /api/budgets/export -- CSV export of all budgets
router.get('/export', function(req, res) {
  var tenantId = req.tenant.id;

  sb.query('client_budgets', 'GET', scopeQuery({
    order: 'client_name.asc'
  }, tenantId))
    .then(function(budgets) {
      var now = new Date();
      var csvHeader = 'Client,Plan End,Category,Total,Spent,Committed,Remaining,%,Status';
      var csvRows = [csvHeader];

      (budgets || []).forEach(function(b) {
        var allocated = parseFloat(b.allocated_amount) || 0;
        var spent = parseFloat(b.spent_amount) || 0;
        var committed = parseFloat(b.committed_amount) || 0;
        var remaining = allocated - spent - committed;
        var utilisationPct = allocated > 0
          ? Math.round(((spent + committed) / allocated) * 10000) / 100
          : 0;

        var status;
        if (utilisationPct > 100) status = 'over';
        else if (utilisationPct >= 96) status = 'red';
        else if (utilisationPct >= 86) status = 'orange';
        else if (utilisationPct >= 71) status = 'amber';
        else status = 'green';

        var row = [
          csvEscape(b.client_name || ''),
          csvEscape(b.plan_end_date || ''),
          csvEscape(b.support_category || ''),
          allocated.toFixed(2),
          spent.toFixed(2),
          committed.toFixed(2),
          remaining.toFixed(2),
          utilisationPct.toFixed(1),
          status
        ];
        csvRows.push(row.join(','));
      });

      var csv = csvRows.join('\n');
      var filename = 'budgets-export-' + new Date().toISOString().split('T')[0] + '.csv';

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.send(csv);
    })
    .catch(function(err) {
      console.error('[BUDGETS] export error:', err.message);
      res.status(500).json({ error: 'Failed to export budgets' });
    });
});

// GET /api/budgets/client/:clientId -- budgets for a specific client with transactions
router.get('/client/:clientId', function(req, res) {
  var tenantId = req.tenant.id;
  var clientId = req.params.clientId;

  sb.query('client_budgets', 'GET', scopeQuery({
    eq: { client_id: clientId },
    order: 'plan_end_date.desc'
  }, tenantId))
    .then(function(budgets) {
      if (!budgets || budgets.length === 0) {
        return res.json({ client_id: clientId, budgets: [] });
      }

      // Fetch transactions for all budgets
      var budgetIds = budgets.map(function(b) { return b.id; });

      return sb.query('budget_transactions', 'GET', scopeQuery({
        in_: { budget_id: budgetIds },
        order: 'transaction_date.desc'
      }, tenantId)).then(function(transactions) {
        // Attach transactions to each budget
        var txByBudget = {};
        (transactions || []).forEach(function(tx) {
          if (!txByBudget[tx.budget_id]) txByBudget[tx.budget_id] = [];
          txByBudget[tx.budget_id].push(tx);
        });

        var result = budgets.map(function(b) {
          b.transactions = txByBudget[b.id] || [];
          return b;
        });

        res.json({ client_id: clientId, budgets: result });
      });
    })
    .catch(function(err) {
      console.error('[BUDGETS] client budgets error:', err.message);
      res.status(500).json({ error: 'Failed to load client budgets' });
    });
});

// GET /api/budgets/transactions/:budgetId -- list transactions for a budget
router.get('/transactions/:budgetId', function(req, res) {
  var tenantId = req.tenant.id;
  var budgetId = req.params.budgetId;

  sb.query('budget_transactions', 'GET', scopeQuery({
    eq: { budget_id: budgetId },
    order: 'transaction_date.desc'
  }, tenantId))
    .then(function(transactions) {
      res.json(transactions || []);
    })
    .catch(function(err) {
      console.error('[BUDGETS] transactions error:', err.message);
      res.status(500).json({ error: 'Failed to list transactions' });
    });
});

// POST /api/budgets -- create client budget
router.post('/', function(req, res) {
  var tenantId = req.tenant.id;
  var b = req.body;

  if (!b.client_id) return res.status(400).json({ error: 'client_id is required' });
  if (!b.plan_start_date) return res.status(400).json({ error: 'plan_start_date is required' });
  if (!b.plan_end_date) return res.status(400).json({ error: 'plan_end_date is required' });

  var allocatedAmount = parseFloat(b.allocated_amount) || 0;

  var record = {
    tenant_id: tenantId,
    client_id: b.client_id,
    client_name: b.client_name || '',
    plan_start_date: b.plan_start_date,
    plan_end_date: b.plan_end_date,
    plan_type: b.plan_type || '',
    total_funding: parseFloat(b.total_funding) || allocatedAmount,
    support_category: b.support_category || '',
    ndis_line_item: b.ndis_line_item || '',
    allocated_amount: allocatedAmount,
    spent_amount: 0,
    committed_amount: 0,
    remaining_amount: allocatedAmount,
    utilisation_pct: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  sb.insert('client_budgets', record)
    .then(function(result) {
      res.status(201).json(result && result[0] ? result[0] : record);
    })
    .catch(function(err) {
      console.error('[BUDGETS] create error:', err.message);
      res.status(500).json({ error: 'Failed to create budget' });
    });
});

// PUT /api/budgets/:id -- update budget
router.put('/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var budgetId = req.params.id;
  var b = req.body;

  // Only allow updating safe fields
  var updateData = {};
  if (b.plan_start_date !== undefined) updateData.plan_start_date = b.plan_start_date;
  if (b.plan_end_date !== undefined) updateData.plan_end_date = b.plan_end_date;
  if (b.plan_type !== undefined) updateData.plan_type = b.plan_type;
  if (b.total_funding !== undefined) updateData.total_funding = parseFloat(b.total_funding);
  if (b.support_category !== undefined) updateData.support_category = b.support_category;
  if (b.ndis_line_item !== undefined) updateData.ndis_line_item = b.ndis_line_item;
  if (b.allocated_amount !== undefined) {
    updateData.allocated_amount = parseFloat(b.allocated_amount);
    // Recalculate remaining
    updateData.remaining_amount = updateData.allocated_amount - (parseFloat(b.spent_amount) || 0) - (parseFloat(b.committed_amount) || 0);
  }
  if (b.client_name !== undefined) updateData.client_name = b.client_name;
  updateData.updated_at = new Date().toISOString();

  sb.update('client_budgets', { eq: { id: budgetId, tenant_id: tenantId } }, updateData)
    .then(function(result) {
      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      res.json(result[0]);
    })
    .catch(function(err) {
      console.error('[BUDGETS] update error:', err.message);
      res.status(500).json({ error: 'Failed to update budget' });
    });
});

// DELETE /api/budgets/:id -- delete budget
router.delete('/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var budgetId = req.params.id;

  sb.remove('client_budgets', { eq: { id: budgetId, tenant_id: tenantId } })
    .then(function(result) {
      res.json({ message: 'Budget deleted', id: budgetId });
    })
    .catch(function(err) {
      console.error('[BUDGETS] delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete budget' });
    });
});

// ═══════════════════════════════════════════════════════════
//  Budget Transactions
// ═══════════════════════════════════════════════════════════

// POST /api/budgets/transaction -- create budget transaction and recalculate
router.post('/transaction', function(req, res) {
  var tenantId = req.tenant.id;
  var t = req.body;

  if (!t.budget_id) return res.status(400).json({ error: 'budget_id is required' });
  if (!t.transaction_type) return res.status(400).json({ error: 'transaction_type is required' });
  if (t.amount === undefined || t.amount === null) return res.status(400).json({ error: 'amount is required' });

  var validTypes = ['committed', 'actual', 'adjustment'];
  if (validTypes.indexOf(t.transaction_type) < 0) {
    return res.status(400).json({ error: 'transaction_type must be one of: ' + validTypes.join(', ') });
  }

  var amount = parseFloat(t.amount);
  if (isNaN(amount)) return res.status(400).json({ error: 'amount must be a number' });

  var txRecord = {
    tenant_id: tenantId,
    budget_id: t.budget_id,
    client_id: t.client_id || null,
    roster_id: t.roster_id || null,
    transaction_type: t.transaction_type,
    amount: amount,
    ndis_line_item: t.ndis_line_item || '',
    support_category: t.support_category || '',
    description: t.description || '',
    transaction_date: t.transaction_date || new Date().toISOString().split('T')[0],
    created_by: req.user.email || req.user.name || 'system',
    created_at: new Date().toISOString()
  };

  // First, fetch the current budget
  sb.query('client_budgets', 'GET', scopeQuery({ eq: { id: t.budget_id } }, tenantId))
    .then(function(budgets) {
      if (!budgets || budgets.length === 0) {
        return res.status(404).json({ error: 'Budget not found' });
      }
      var budget = budgets[0];

      // Insert the transaction
      return sb.insert('budget_transactions', txRecord).then(function(txResult) {
        var tx = txResult && txResult[0] ? txResult[0] : txRecord;

        // Recalculate budget amounts
        var spent = parseFloat(budget.spent_amount) || 0;
        var committed = parseFloat(budget.committed_amount) || 0;
        var allocated = parseFloat(budget.allocated_amount) || 0;

        if (t.transaction_type === 'committed') {
          committed += amount;
        } else if (t.transaction_type === 'actual') {
          spent += amount;
          committed = Math.max(0, committed - amount); // Move from committed to actual
        } else if (t.transaction_type === 'adjustment') {
          allocated += amount; // Can be positive or negative
        }

        var remaining = allocated - spent - committed;
        var utilisationPct = allocated > 0
          ? Math.round(((spent + committed) / allocated) * 10000) / 100
          : 0;

        var budgetUpdate = {
          spent_amount: Math.round(spent * 100) / 100,
          committed_amount: Math.round(committed * 100) / 100,
          allocated_amount: Math.round(allocated * 100) / 100,
          remaining_amount: Math.round(remaining * 100) / 100,
          utilisation_pct: utilisationPct,
          updated_at: new Date().toISOString()
        };

        return sb.update('client_budgets', { eq: { id: t.budget_id } }, budgetUpdate)
          .then(function(updatedBudget) {
            res.status(201).json({
              transaction: tx,
              budget: updatedBudget && updatedBudget[0] ? updatedBudget[0] : budgetUpdate
            });
          });
      });
    })
    .catch(function(err) {
      console.error('[BUDGETS] transaction error:', err.message);
      res.status(500).json({ error: 'Failed to create transaction: ' + err.message });
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

module.exports = router;
