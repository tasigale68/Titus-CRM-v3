const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const env = require('./config/env');
const { migrate } = require('./db/sqlite');
const { seedUsers } = require('./middleware/auth');
const errorHandler = require('./middleware/error-handler');

// Route modules
const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const voiceRoutes = require('./routes/voice');
const schedulingRoutes = require('./routes/scheduling');
const clientsRoutes = require('./routes/clients');
const recruitmentRoutes = require('./routes/recruitment');
const reportsRoutes = require('./routes/reports');
const emailRoutes = require('./routes/email');
const lmsRoutes = require('./routes/lms');
const documentsRoutes = require('./routes/documents');
const tasksRoutes = require('./routes/tasks');
const complianceRoutes = require('./routes/compliance');
const receiptsRoutes = require('./routes/receipts');
const leadsRoutes = require('./routes/leads');
const accommodationRoutes = require('./routes/accommodation');
const budgetRoutes = require('./routes/budget');
const supportWorkerRoutes = require('./routes/support-worker');
const adminRoutes = require('./routes/admin');
const deniseRoutes = require('./routes/denise-agent');
const chatRoutes = require('./routes/chat');
const messengerRoutes = require('./routes/messenger');

// SaaS Route modules
const tenantRoutes = require('./routes/tenants');
const pricingRoutes = require('./routes/pricing');
const adminTenantsRoutes = require('./routes/admin/tenants');
const signingRoutes = require('./routes/signing');
const portalRoutes = require('./routes/portal');
const payrollRoutes = require('./routes/payroll');
const budgetsRoutes = require('./routes/budgets');
const weeklyReportRoutes = require('./routes/reports/weekly');
const chatbotRoutes = require('./routes/chatbot');
const voiceSmsRoutes = require('./routes/voice-sms');

// Initialize
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Run SQLite migrations and seed admin users
migrate();
seedUsers();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Prevent browser caching of HTML files
app.use(function (req, res, next) {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Make io available to routes
app.set('io', io);

// ═══════════════════════════════════════════════════════
//  API Routes
// ═══════════════════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api', voiceRoutes); // Legacy: frontend calls /api/calls, /api/sms, /api/availability etc.
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/accommodation', accommodationRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/support-worker', supportWorkerRoutes);
app.use('/api/sw', supportWorkerRoutes); // Shorthand alias used by PWA frontend
app.use('/api/admin', adminRoutes);
app.use('/api/denise-agent', deniseRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/messenger', messengerRoutes);

// ═══════════════════════════════════════════════════════
//  Contractor Invoices (inline — no dedicated route file)
// ═══════════════════════════════════════════════════════
const { authenticate: invoiceAuth } = require('./middleware/auth');
const invoiceDb = require('./services/database');
const sbInvoice = require('./services/supabaseClient');

// GET /api/invoices/by-contact/:id — invoices for a specific contractor
app.get('/api/invoices/by-contact/:id', invoiceAuth, function (req, res) {
  var contactId = req.params.id;
  if (!contactId) return res.json({ success: false, error: 'Missing contact ID' });

  // Try Supabase first
  var sbQuery = contactId.length > 30
    ? sbInvoice.query('independent_contractor_invoices', 'GET', { eq: { contractor_id: contactId }, order: 'submitted_date.desc' })
    : sbInvoice.query('independent_contractor_invoices', 'GET', { eq: { airtable_id: contactId }, order: 'submitted_date.desc' });

  sbQuery.then(function (rows) {
    if (!rows || rows.length === 0) throw new Error('empty');
    var invoices = rows.map(function (r) {
      var shifts = [];
      try { if (r.shifts) shifts = typeof r.shifts === 'string' ? JSON.parse(r.shifts) : r.shifts; } catch (e) {}
      return {
        id: r.id,
        invoiceNumber: r.invoice_number || '',
        status: r.status || 'Draft',
        dateSubmitted: r.submitted_date || '',
        periodStart: r.period_start || '',
        periodEnd: r.period_end || '',
        totalHours: parseFloat(r.hours_worked || 0),
        totalKilometres: parseFloat(r.total_kilometres || 0),
        amountExGst: parseFloat(r.amount_ex_gst || r.amount || 0),
        gstAmount: parseFloat(r.gst || 0),
        totalIncGst: parseFloat(r.total || 0),
        shifts: shifts,
        staffName: r.contractor_name || ''
      };
    });
    console.log('[INVOICES] Supabase: ' + invoices.length + ' invoices for ' + contactId);
    res.json({ success: true, invoices: invoices });
  }).catch(function (sbErr) {
    if (sbErr.message !== 'empty') console.warn('[INVOICES] Supabase error, falling back:', sbErr.message);
    // Airtable fallback
    invoiceDb.fetchAllFromTable('Contractor Invoices').then(function (records) {
      var invoices = (records || []).filter(function (r) {
        var f = r.fields || {};
        var linked = f['Contractor'] || f['Contact'] || f['Staff Name'] || [];
        if (Array.isArray(linked) && linked.indexOf(contactId) >= 0) return true;
        if (linked === contactId) return true;
        var linkedRecord = f['Contact Record'] || [];
        if (Array.isArray(linkedRecord) && linkedRecord.indexOf(contactId) >= 0) return true;
        return false;
      }).map(function (r) {
        var f = r.fields || {};
        var shifts = [];
        try { if (f['Shifts']) shifts = typeof f['Shifts'] === 'string' ? JSON.parse(f['Shifts']) : f['Shifts']; } catch (e) {}
        return {
          id: r.id,
          invoiceNumber: f['Invoice Number'] || f['Invoice #'] || f['Name'] || '',
          status: f['Status'] || 'Draft',
          dateSubmitted: f['Date Submitted'] || f['Submitted Date'] || '',
          periodStart: f['Period Start'] || f['From'] || '',
          periodEnd: f['Period End'] || f['To'] || '',
          totalHours: parseFloat(f['Total Hours'] || 0),
          totalKilometres: parseFloat(f['Total KMs'] || f['Total Kilometres'] || 0),
          amountExGst: parseFloat(f['Amount Ex GST'] || f['Amount'] || 0),
          gstAmount: parseFloat(f['GST Amount'] || f['GST'] || 0),
          totalIncGst: parseFloat(f['Total Inc GST'] || f['Total'] || 0),
          shifts: shifts,
          staffName: f['Contractor Name'] || ''
        };
      });
      invoices.sort(function (a, b) { return (b.dateSubmitted || '').localeCompare(a.dateSubmitted || ''); });
      res.json({ success: true, invoices: invoices });
    }).catch(function (e) {
      console.error('Invoice fetch error:', e.message);
      res.json({ success: true, invoices: [] });
    });
  });
});

// GET /api/invoices — all invoices (for ShiftCare reconciliation)
app.get('/api/invoices', invoiceAuth, function (req, res) {
  var dateFrom = req.query.dateFrom || '';
  var dateTo = req.query.dateTo || '';
  var contractor = req.query.contractor || '';

  invoiceDb.fetchAllFromTable('Contractor Invoices').then(function (records) {
    var invoices = (records || []).map(function (r) {
      var f = r.fields || {};
      var shifts = [];
      try { if (f['Shifts']) shifts = typeof f['Shifts'] === 'string' ? JSON.parse(f['Shifts']) : f['Shifts']; } catch (e) {}
      var staffNameVal = f['Contractor Name'] || f['Full Name (from Contractor)'] || '';
      if (Array.isArray(staffNameVal)) staffNameVal = staffNameVal[0] || '';
      return {
        id: r.id,
        invoiceNumber: f['Invoice Number'] || f['Invoice #'] || f['Name'] || '',
        status: f['Status'] || 'Draft',
        dateSubmitted: f['Date Submitted'] || f['Submitted Date'] || '',
        periodStart: f['Period Start'] || f['From'] || '',
        periodEnd: f['Period End'] || f['To'] || '',
        totalHours: parseFloat(f['Total Hours'] || 0),
        totalKilometres: parseFloat(f['Total KMs'] || f['Total Kilometres'] || 0),
        amountExGst: parseFloat(f['Amount Ex GST'] || f['Amount'] || 0),
        gstAmount: parseFloat(f['GST Amount'] || f['GST'] || 0),
        totalIncGst: parseFloat(f['Total Inc GST'] || f['Total'] || 0),
        shifts: shifts,
        staffName: staffNameVal
      };
    });

    // Apply filters
    if (dateFrom) invoices = invoices.filter(function (inv) { return (inv.dateSubmitted || '') >= dateFrom; });
    if (dateTo) invoices = invoices.filter(function (inv) { return (inv.dateSubmitted || '') <= dateTo; });
    if (contractor) invoices = invoices.filter(function (inv) { return (inv.staffName || '').toLowerCase().indexOf(contractor.toLowerCase()) >= 0; });

    invoices.sort(function (a, b) { return (b.dateSubmitted || '').localeCompare(a.dateSubmitted || ''); });

    res.json({ success: true, invoices: invoices });
  }).catch(function (e) {
    console.error('Invoice fetch error:', e.message);
    res.json({ success: true, invoices: [] });
  });
});

// ═══════════════════════════════════════════════════════
//  SaaS Multi-Tenant Routes
// ═══════════════════════════════════════════════════════

app.use('/api/tenant', tenantRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/admin/tenants', adminTenantsRoutes);
app.use('/api/signing', signingRoutes);
app.use('/api/sign', signingRoutes);         // Public signing routes
app.use('/api/portal', portalRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/reports/weekly', weeklyReportRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/voice-sms', voiceSmsRoutes);

// ═══════════════════════════════════════════════════════
//  Tenant Branded Login Routing
// ═══════════════════════════════════════════════════════

// Serve tenant-login.html for /{slug} routes (must be after static + API)
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
});
app.get('/pricing', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'pricing.html'));
});
app.get('/admin/tenants', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'tenants.html'));
});

// ═══════════════════════════════════════════════════════
//  AI Ask Endpoint (used by Employment tab pay rate analysis)
// ═══════════════════════════════════════════════════════

app.post('/api/ai/ask', (req, res) => {
  var question = (req.body && req.body.question) || '';
  var maxTokens = (req.body && req.body.maxTokens) || 2000;
  if (!question) return res.json({ answer: 'No question provided' });
  if (!process.env.ANTHROPIC_API_KEY) return res.json({ answer: 'AI not configured — ANTHROPIC_API_KEY missing' });

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: question }]
    })
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Claude API ' + r.status + ': ' + t.substring(0, 200)); });
    return r.json();
  }).then(function(data) {
    var text = '';
    if (data.content && data.content.length > 0) text = data.content[0].text || '';
    res.json({ answer: text });
  }).catch(function(e) {
    console.error('[AI ASK] Error:', e.message);
    res.json({ answer: 'AI analysis failed: ' + e.message });
  });
});

// ═══════════════════════════════════════════════════════
//  Health check
// ═══════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════
//  Socket.io
// ═══════════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', (room) => {
    socket.join(room);
  });

  // Messenger: join channel rooms
  socket.on('messenger:join', (channelId) => {
    socket.join('messenger:' + channelId);
  });

  socket.on('messenger:leave', (channelId) => {
    socket.leave('messenger:' + channelId);
  });

  // Messenger: typing indicator
  socket.on('messenger:typing', (data) => {
    socket.to('messenger:' + data.channel_id).emit('messenger:typing', {
      channel_id: data.channel_id,
      user: data.user,
      typing: data.typing
    });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════
//  Error handling
// ═══════════════════════════════════════════════════════

// Catch-all for unmatched /api/* routes — return JSON 404, not HTML
app.use('/api', function(req, res) {
  res.status(404).json({ error: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl });
});

// Global error handler — always return JSON, never HTML
app.use(errorHandler);

// ═══════════════════════════════════════════════════════
//  Start server
// ═══════════════════════════════════════════════════════

server.listen(env.port, () => {
  console.log(`Titus CRM v3.0.0 SaaS running on port ${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

module.exports = { app, server, io };
