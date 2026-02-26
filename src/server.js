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
//  Health check
// ═══════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
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

app.use(errorHandler);

// ═══════════════════════════════════════════════════════
//  Start server
// ═══════════════════════════════════════════════════════

server.listen(env.port, () => {
  console.log(`Titus CRM v2.0.0 running on port ${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

module.exports = { app, server, io };
