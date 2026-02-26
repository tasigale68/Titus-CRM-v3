const express = require('express');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/email/inbox
router.get('/inbox', async (req, res, next) => {
  // TODO: migrate Microsoft Graph inbox sync
  res.json({ emails: [] });
});

// GET /api/email/sent
router.get('/sent', async (req, res, next) => {
  // TODO: migrate Microsoft Graph sent mail
  res.json({ emails: [] });
});

// POST /api/email/send
router.post('/send', async (req, res, next) => {
  // TODO: migrate Microsoft Graph send email
  res.json({ ok: true });
});

// GET /api/email/:id/attachments
router.get('/:id/attachments', async (req, res, next) => {
  // TODO: migrate attachment fetching
  res.json({ attachments: [] });
});

module.exports = router;
