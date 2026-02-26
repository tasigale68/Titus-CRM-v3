// Titus CRM -- Weekly AI NDIS Progress Report Routes (SaaS multi-tenant)
// AI-generated weekly client progress reports for NDIS stakeholders

var express = require('express');
var sb = require('../../services/supabaseClient');
var { authenticate } = require('../../middleware/auth');
var { tenantFromSession, scopeQuery } = require('../../middleware/tenant');
var { generateReport } = require('../../services/reportWriter');

var router = express.Router();

// All routes require auth + tenant context
router.use(authenticate, tenantFromSession);

// ═══════════════════════════════════════════════════════════
//  Weekly Report CRUD
// ═══════════════════════════════════════════════════════════

// GET /api/reports/weekly -- list weekly reports for tenant
router.get('/', function(req, res) {
  var tenantId = req.tenant.id;
  var params = scopeQuery({ order: 'created_at.desc' }, tenantId);

  // Optional filters
  if (req.query.client_id) {
    params.eq.client_id = req.query.client_id;
  }
  if (req.query.period) {
    params.eq.period_start = req.query.period;
  }
  if (req.query.limit) {
    params.limit = parseInt(req.query.limit);
  }

  sb.query('weekly_reports', 'GET', params)
    .then(function(reports) {
      res.json(reports || []);
    })
    .catch(function(err) {
      console.error('[WEEKLY REPORTS] list error:', err.message);
      res.status(500).json({ error: 'Failed to list weekly reports' });
    });
});

// GET /api/reports/weekly/clients -- clients with last report date and count
router.get('/clients', function(req, res) {
  var tenantId = req.tenant.id;

  // Fetch all clients for this tenant
  sb.query('clients', 'GET', scopeQuery({
    select: 'id,name,ndis_number,plan_type,status',
    order: 'name.asc'
  }, tenantId))
    .then(function(clients) {
      // Fetch all weekly reports to aggregate per client
      return sb.query('weekly_reports', 'GET', scopeQuery({
        select: 'client_id,created_at',
        order: 'created_at.desc'
      }, tenantId)).then(function(reports) {
        // Build per-client aggregation
        var clientReportMap = {};
        (reports || []).forEach(function(r) {
          if (!clientReportMap[r.client_id]) {
            clientReportMap[r.client_id] = {
              last_report_date: r.created_at,
              report_count: 0
            };
          }
          clientReportMap[r.client_id].report_count++;
        });

        var result = (clients || []).map(function(c) {
          var reportInfo = clientReportMap[c.id] || {};
          return {
            client_id: c.id,
            client_name: c.name || '',
            ndis_number: c.ndis_number || '',
            plan_type: c.plan_type || '',
            status: c.status || 'active',
            last_report_date: reportInfo.last_report_date || null,
            report_count: reportInfo.report_count || 0
          };
        });

        res.json(result);
      });
    })
    .catch(function(err) {
      console.error('[WEEKLY REPORTS] clients error:', err.message);
      res.status(500).json({ error: 'Failed to list clients' });
    });
});

// GET /api/reports/weekly/:id -- get single report with AI content
router.get('/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var reportId = req.params.id;

  sb.query('weekly_reports', 'GET', scopeQuery({ eq: { id: reportId } }, tenantId))
    .then(function(reports) {
      if (!reports || reports.length === 0) {
        return res.status(404).json({ error: 'Weekly report not found' });
      }
      res.json(reports[0]);
    })
    .catch(function(err) {
      console.error('[WEEKLY REPORTS] get error:', err.message);
      res.status(500).json({ error: 'Failed to load weekly report' });
    });
});

// ═══════════════════════════════════════════════════════════
//  Report Generation (AI)
// ═══════════════════════════════════════════════════════════

// POST /api/reports/weekly/generate -- generate AI report for a client
router.post('/generate', function(req, res) {
  var tenantId = req.tenant.id;
  var clientId = req.body.client_id;
  var periodStart = req.body.period_start;
  var periodEnd = req.body.period_end;

  if (!clientId) return res.status(400).json({ error: 'client_id is required' });
  if (!periodStart) return res.status(400).json({ error: 'period_start is required' });
  if (!periodEnd) return res.status(400).json({ error: 'period_end is required' });

  var clientData = null;
  var progressNotes = [];
  var incidents = [];
  var rosterData = [];
  var supportPlans = [];

  // Step 1: Fetch client details
  sb.query('clients', 'GET', scopeQuery({ eq: { id: clientId } }, tenantId))
    .then(function(clients) {
      if (!clients || clients.length === 0) {
        throw new Error('Client not found');
      }
      clientData = clients[0];

      // Steps 2-5: Fetch related data in parallel
      return Promise.all([
        // Progress notes in date range
        sb.query('progress_notes', 'GET', scopeQuery({
          eq: { client_id: clientId },
          gte: { note_date: periodStart },
          lte: { note_date: periodEnd },
          order: 'note_date.desc'
        }, tenantId)),

        // Incident reports in date range
        sb.query('ir_reports', 'GET', scopeQuery({
          eq: { client_id: clientId },
          gte: { incident_date: periodStart },
          lte: { incident_date: periodEnd },
          order: 'incident_date.desc'
        }, tenantId)),

        // Rosters in date range for hours
        sb.query('rosters', 'GET', scopeQuery({
          eq: { client_id: clientId },
          gte: { start_shift: periodStart },
          lte: { start_shift: periodEnd },
          order: 'start_shift.asc'
        }, tenantId)),

        // Active support plans/goals
        sb.query('support_plans', 'GET', scopeQuery({
          eq: { client_id: clientId, status: 'active' },
          order: 'created_at.desc'
        }, tenantId))
      ]);
    })
    .then(function(results) {
      progressNotes = results[0] || [];
      incidents = results[1] || [];
      rosterData = results[2] || [];
      supportPlans = results[3] || [];

      // Calculate total hours
      var totalHours = 0;
      var staffInvolved = {};
      rosterData.forEach(function(r) {
        var start = new Date(r.start_shift);
        var end = new Date(r.end_shift || r.clock_out_time || r.start_shift);
        var hours = (end - start) / (1000 * 60 * 60);
        if (hours > 0) totalHours += hours;
        var staffName = r.worker_name || r.staff_name || r.worker_email || 'Unknown';
        staffInvolved[staffName] = (staffInvolved[staffName] || 0) + hours;
      });
      totalHours = Math.round(totalHours * 100) / 100;

      // Step 6: Build report params for AI generation
      var reportParams = {
        type: 'weekly_ndis_progress',
        client: {
          name: clientData.name || '',
          ndis_number: clientData.ndis_number || '',
          plan_type: clientData.plan_type || '',
          support_category: clientData.support_category || '',
          date_of_birth: clientData.date_of_birth || '',
          primary_disability: clientData.primary_disability || '',
          goals: supportPlans.map(function(sp) {
            return {
              goal: sp.goal || sp.description || '',
              status: sp.status || 'active',
              target_date: sp.target_date || '',
              progress_rating: sp.progress_rating || ''
            };
          })
        },
        period: {
          start: periodStart,
          end: periodEnd
        },
        progress_notes: progressNotes.map(function(pn) {
          return {
            date: pn.note_date || pn.created_at || '',
            author: pn.author || pn.created_by || '',
            category: pn.category || '',
            content: pn.content || pn.note || '',
            mood: pn.mood || '',
            engagement: pn.engagement || ''
          };
        }),
        incidents: incidents.map(function(ir) {
          return {
            date: ir.incident_date || '',
            type: ir.incident_type || ir.category || '',
            severity: ir.severity || '',
            description: ir.description || '',
            outcome: ir.outcome || ir.resolution || ''
          };
        }),
        service_hours: {
          total: totalHours,
          shifts: rosterData.length,
          staff_involved: Object.keys(staffInvolved).map(function(name) {
            return { name: name, hours: Math.round(staffInvolved[name] * 100) / 100 };
          })
        },
        org_name: req.tenant.org_name || ''
      };

      // Step 7: Call AI to generate report
      return generateReport(reportParams);
    })
    .then(function(aiContent) {
      // Step 8: Insert into weekly_reports table
      var reportRecord = {
        tenant_id: tenantId,
        client_id: clientId,
        client_name: clientData.name || '',
        ndis_number: clientData.ndis_number || '',
        period_start: periodStart,
        period_end: periodEnd,
        report_content: typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent),
        total_hours: rosterData.reduce(function(sum, r) {
          var s = new Date(r.start_shift);
          var e = new Date(r.end_shift || r.clock_out_time || r.start_shift);
          var h = (e - s) / (1000 * 60 * 60);
          return sum + (h > 0 ? h : 0);
        }, 0),
        total_progress_notes: progressNotes.length,
        total_incidents: incidents.length,
        total_shifts: rosterData.length,
        active_goals: supportPlans.length,
        generated_by: req.user.email || req.user.name || 'system',
        status: 'draft',
        sent_to_stakeholders: false,
        sent_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return sb.insert('weekly_reports', reportRecord);
    })
    .then(function(result) {
      // Step 9: Return the report
      var report = result && result[0] ? result[0] : {};
      res.status(201).json(report);
    })
    .catch(function(err) {
      console.error('[WEEKLY REPORTS] generate error:', err.message);
      res.status(500).json({ error: 'Failed to generate weekly report: ' + err.message });
    });
});

// ═══════════════════════════════════════════════════════════
//  Report Actions
// ═══════════════════════════════════════════════════════════

// POST /api/reports/weekly/:id/send -- mark as sent to stakeholders
router.post('/:id/send', function(req, res) {
  var tenantId = req.tenant.id;
  var reportId = req.params.id;

  sb.query('weekly_reports', 'GET', scopeQuery({ eq: { id: reportId } }, tenantId))
    .then(function(reports) {
      if (!reports || reports.length === 0) {
        return res.status(404).json({ error: 'Weekly report not found' });
      }

      return sb.update('weekly_reports', { eq: { id: reportId } }, {
        sent_to_stakeholders: true,
        sent_at: new Date().toISOString(),
        status: 'sent',
        updated_at: new Date().toISOString()
      });
    })
    .then(function(result) {
      res.json({
        message: 'Report marked as sent',
        report: result && result[0] ? result[0] : { id: reportId, sent_to_stakeholders: true }
      });
    })
    .catch(function(err) {
      console.error('[WEEKLY REPORTS] send error:', err.message);
      res.status(500).json({ error: 'Failed to mark report as sent' });
    });
});

// DELETE /api/reports/weekly/:id -- delete report
router.delete('/:id', function(req, res) {
  var tenantId = req.tenant.id;
  var reportId = req.params.id;

  sb.remove('weekly_reports', { eq: { id: reportId, tenant_id: tenantId } })
    .then(function() {
      res.json({ message: 'Report deleted', id: reportId });
    })
    .catch(function(err) {
      console.error('[WEEKLY REPORTS] delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete report' });
    });
});

module.exports = router;
