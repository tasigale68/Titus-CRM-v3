const express = require('express');
const { authenticate, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/compliance/audit-log
router.get('/audit-log', requireRole('superadmin', 'director', 'admin'), async (req, res, next) => {
  // TODO: migrate audit log viewer with export
  res.json({ logs: [] });
});

// GET /api/compliance/incidents
router.get('/incidents', async (req, res, next) => {
  // TODO: migrate incident reporting module
  res.json({ incidents: [] });
});

// POST /api/compliance/incidents
router.post('/incidents', async (req, res, next) => {
  // TODO: migrate incident creation
  res.json({ ok: true });
});

// GET /api/compliance/improvements
router.get('/improvements', async (req, res, next) => {
  // TODO: migrate continuous improvement register
  res.json({ improvements: [] });
});

// GET /api/compliance/tickets
router.get('/tickets', async (req, res, next) => {
  // TODO: migrate support ticketing system
  res.json({ tickets: [] });
});

module.exports = router;
