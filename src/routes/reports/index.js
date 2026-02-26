const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');

// Route handlers
const opsReportHandler = require('./ops-report');
const {
  getWeeklyReports,
  postWeeklyReport,
  createPortalAccess,
  listPortalAccess,
  revokePortalAccess,
  reactivatePortalAccess,
  portalAuth,
  portalData
} = require('./weekly-stakeholder');
const {
  customReportData,
  customReportSave,
  customReportAnalyse
} = require('./custom-report');

const router = express.Router();

// ═══════════════════════════════════════════════════════════
//  Authenticated routes (require login)
// ═══════════════════════════════════════════════════════════

// POST /api/reports/ops — Generate ops report (multi-section, data-driven)
router.post('/ops', authenticate, opsReportHandler);

// GET /api/reports/weekly — List weekly stakeholder reports
router.get('/weekly', authenticate, getWeeklyReports);

// POST /api/reports/weekly — Save weekly stakeholder report PDF
router.post('/weekly', authenticate, postWeeklyReport);

// POST /api/reports/custom — Fetch data for custom client report
router.post('/custom', authenticate, customReportData);

// POST /api/reports/custom-save — Save custom report to Airtable
router.post('/custom-save', authenticate, customReportSave);

// POST /api/reports/custom-analyse — AI 4-pass analysis for custom report
router.post('/custom-analyse', authenticate, customReportAnalyse);

// ═══════════════════════════════════════════════════════════
//  Stakeholder Portal — Admin routes (require superadmin)
// ═══════════════════════════════════════════════════════════

// POST /api/reports/stakeholder-portal/create-access — Create portal link
router.post('/stakeholder-portal/create-access', authenticate, requireRole('superadmin'), createPortalAccess);

// GET /api/reports/stakeholder-portal/access-list — List all portal links
router.get('/stakeholder-portal/access-list', authenticate, requireRole('superadmin'), listPortalAccess);

// DELETE /api/reports/stakeholder-portal/revoke/:id — Revoke portal access
router.delete('/stakeholder-portal/revoke/:id', authenticate, requireRole('superadmin'), revokePortalAccess);

// PATCH /api/reports/stakeholder-portal/reactivate/:id — Reactivate portal access
router.patch('/stakeholder-portal/reactivate/:id', authenticate, requireRole('superadmin'), reactivatePortalAccess);

// ═══════════════════════════════════════════════════════════
//  Stakeholder Portal — Public routes (NO auth — token-based)
// ═══════════════════════════════════════════════════════════

// POST /api/reports/stakeholder-portal/auth — Validate portal token
router.post('/stakeholder-portal/auth', portalAuth);

// POST /api/reports/stakeholder-portal/data — Get portal dashboard data
router.post('/stakeholder-portal/data', portalData);

module.exports = router;
