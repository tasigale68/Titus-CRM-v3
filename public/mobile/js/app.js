/* ═══════════════════════════════════════════════════════════════
   Titus CRM — Support Worker Mobile PWA
   Main Application: All page renderers
   ═══════════════════════════════════════════════════════════════ */

// ── Shared State ──
var AppState = {
  user: JSON.parse(localStorage.getItem('sw_user') || 'null'),
  shifts: [],
  clients: [],
  notes: [],
  clockedIn: null,
  clockStartTime: null
};

// ── Helpers ──
function setTitle(t) { document.getElementById('headerTitle').textContent = t; }
function showBack(show) { document.getElementById('headerBack').style.display = show ? 'flex' : 'none'; }
function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function formatDate(d) {
  if (!d) return '';
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '';
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(d) {
  if (!d) return '';
  return formatDate(d) + ' ' + formatTime(d);
}

function initials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0][0].toUpperCase();
}

function showToast(msg, type) {
  var t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function getWeekRange(offset) {
  var now = new Date();
  now.setDate(now.getDate() + (offset * 7));
  var day = now.getDay();
  var mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  var sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: mon, end: sun };
}

function chevronSvg() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
}

var SVG = {
  clock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  note: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  alert: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  msg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
  photo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
  dollar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  logout: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  pin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
};


/* ═══════════════════════════════════════════════════════════════
   PAGE 1: LOGIN
   ═══════════════════════════════════════════════════════════════ */
Router.register('login', function(el) {
  setTitle('Titus CRM');
  showBack(false);
  document.getElementById('appContent').classList.add('no-nav');

  el.innerHTML = '<div class="login-page">' +
    '<div class="login-logo">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
    '</div>' +
    '<h1 class="login-title">Welcome Back</h1>' +
    '<p class="login-subtitle">Sign in to your support worker account</p>' +
    '<div class="login-form" id="loginForm">' +
      '<div class="form-group">' +
        '<label class="form-label" for="loginEmail">Email Address</label>' +
        '<input class="form-input" type="email" id="loginEmail" placeholder="your.name@dcs.org.au" autocomplete="email" inputmode="email">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label" for="loginPassword">Password</label>' +
        '<input class="form-input" type="password" id="loginPassword" placeholder="Enter your password" autocomplete="current-password">' +
      '</div>' +
      '<div id="loginError" class="form-error" style="display:none;margin-bottom:12px"></div>' +
      '<button class="btn btn-accent btn-block btn-lg" id="loginBtn" onclick="App.doLogin()">Sign In</button>' +
      '<button class="btn btn-ghost btn-block mt-16" onclick="App.showForgotPassword()">Forgot Password?</button>' +
    '</div>' +
    '<div id="otpSection" style="display:none">' +
      '<div class="form-group">' +
        '<label class="form-label" for="otpCode">Verification Code</label>' +
        '<input class="form-input" type="text" id="otpCode" placeholder="Enter 6-digit code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="text-align:center;font-size:24px;letter-spacing:8px">' +
      '</div>' +
      '<div id="otpError" class="form-error" style="display:none;margin-bottom:12px"></div>' +
      '<button class="btn btn-accent btn-block btn-lg" id="otpBtn" onclick="App.verifyOtp()">Verify Code</button>' +
      '<button class="btn btn-ghost btn-block mt-16" onclick="App.resendOtp()">Resend Code</button>' +
    '</div>' +
    '<div id="forgotSection" style="display:none">' +
      '<div class="form-group">' +
        '<label class="form-label" for="forgotEmail">Email Address</label>' +
        '<input class="form-input" type="email" id="forgotEmail" placeholder="your.name@dcs.org.au" inputmode="email">' +
      '</div>' +
      '<div id="forgotError" class="form-error" style="display:none;margin-bottom:12px"></div>' +
      '<button class="btn btn-accent btn-block btn-lg" onclick="App.doForgotPassword()">Send Reset Code</button>' +
      '<button class="btn btn-ghost btn-block mt-16" onclick="App.backToLogin()">Back to Sign In</button>' +
    '</div>' +
  '</div>';
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 2: HOME
   ═══════════════════════════════════════════════════════════════ */
Router.register('home', function(el) {
  setTitle('Home');
  showBack(false);
  document.getElementById('appContent').classList.remove('no-nav');

  var user = AppState.user || {};
  var name = escHtml(user.name || 'Support Worker');
  var today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  el.innerHTML = '<div>' +
    '<div style="margin-bottom:24px">' +
      '<h2 style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-text)">Welcome, ' + name.split(' ')[0] + '</h2>' +
      '<p style="font-size:var(--font-size-sm);color:var(--color-text-muted);margin-top:4px">' + today + '</p>' +
    '</div>' +

    '<div class="card mb-16" id="homeTodayCard">' +
      '<div class="card-header">' +
        '<span class="card-title">Today\'s Shifts</span>' +
        '<span class="badge badge-info" id="homeTodayCount">-</span>' +
      '</div>' +
      '<p class="card-body" id="homeTodayMsg">Loading your shifts...</p>' +
    '</div>' +

    '<div class="section-header">' +
      '<span class="section-title">Quick Actions</span>' +
    '</div>' +
    '<div class="card-grid">' +
      '<div class="action-card" onclick="Router.go(\'clockin\')">' +
        '<div class="icon-wrap" style="background:rgba(16,185,129,0.1);color:#10b981">' + SVG.clock + '</div>' +
        '<span>Clock In</span>' +
      '</div>' +
      '<div class="action-card" onclick="Router.go(\'notes\')">' +
        '<div class="icon-wrap" style="background:rgba(59,130,246,0.1);color:#3b82f6">' + SVG.note + '</div>' +
        '<span>Progress Note</span>' +
      '</div>' +
      '<div class="action-card" onclick="Router.go(\'incidents\')">' +
        '<div class="icon-wrap" style="background:rgba(239,68,68,0.1);color:#ef4444">' + SVG.alert + '</div>' +
        '<span>Incident Report</span>' +
      '</div>' +
      '<div class="action-card" onclick="Router.go(\'chat\')">' +
        '<div class="icon-wrap" style="background:rgba(245,158,11,0.1);color:#f59e0b">' + SVG.chat + '</div>' +
        '<span>AI Chat</span>' +
      '</div>' +
      '<div class="action-card" onclick="Router.go(\'messenger\')">' +
        '<div class="icon-wrap" style="background:rgba(139,92,246,0.1);color:#8b5cf6">' + SVG.msg + '</div>' +
        '<span>Messages</span>' +
      '</div>' +
      '<div class="action-card" onclick="Router.go(\'documents\')">' +
        '<div class="icon-wrap" style="background:rgba(20,184,166,0.1);color:#14b8a6">' + SVG.doc + '</div>' +
        '<span>My Docs</span>' +
      '</div>' +
    '</div>' +
  '</div>';

  // Load today's shift count
  API.get('/api/sw/shifts').then(function(shifts) {
    AppState.shifts = shifts || [];
    var today = new Date().toISOString().slice(0, 10);
    var todayShifts = shifts.filter(function(s) {
      return s.startShift && s.startShift.slice(0, 10) === today;
    });
    var countEl = document.getElementById('homeTodayCount');
    var msgEl = document.getElementById('homeTodayMsg');
    if (countEl) countEl.textContent = todayShifts.length;
    if (msgEl) {
      if (todayShifts.length === 0) {
        msgEl.textContent = 'No shifts scheduled for today.';
      } else {
        msgEl.textContent = todayShifts.length + ' shift' + (todayShifts.length > 1 ? 's' : '') + ' today. Tap to view details.';
        msgEl.style.cursor = 'pointer';
        msgEl.onclick = function() { Router.go('shifts'); };
      }
    }
  }).catch(function() {
    var msgEl = document.getElementById('homeTodayMsg');
    if (msgEl) msgEl.textContent = 'Could not load shifts.';
  });
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 3: SHIFTS
   ═══════════════════════════════════════════════════════════════ */
var shiftsWeekOffset = 0;

Router.register('shifts', function(el) {
  setTitle('My Shifts');
  showBack(true);
  renderShifts(el);
});

function renderShifts(el) {
  var range = getWeekRange(shiftsWeekOffset);
  var weekLabel = formatDate(range.start) + ' - ' + formatDate(range.end);

  el.innerHTML = '<div>' +
    '<div class="week-picker">' +
      '<button onclick="App.shiftsPrev()" aria-label="Previous week">' + SVG.left + '</button>' +
      '<span>Week of ' + weekLabel + '</span>' +
      '<button onclick="App.shiftsNext()" aria-label="Next week">' + SVG.right + '</button>' +
    '</div>' +
    '<div id="shiftsList" class="list-group"><div class="loading-center"><div class="spinner"></div></div></div>' +
  '</div>';

  API.get('/api/sw/shifts').then(function(shifts) {
    AppState.shifts = shifts || [];
    var startStr = range.start.toISOString().slice(0, 10);
    var endStr = range.end.toISOString().slice(0, 10);
    var filtered = shifts.filter(function(s) {
      if (!s.startShift) return false;
      var d = s.startShift.slice(0, 10);
      return d >= startStr && d <= endStr;
    }).sort(function(a, b) {
      return (a.startShift || '').localeCompare(b.startShift || '');
    });

    var container = document.getElementById('shiftsList');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">' + SVG.calendar +
        '<p class="empty-state-title">No Shifts This Week</p>' +
        '<p class="empty-state-text">You have no shifts scheduled for this period.</p></div>';
      return;
    }

    var html = '';
    filtered.forEach(function(s) {
      var statusClass = (s.shiftStatus || '').toLowerCase() === 'confirmed' ? 'badge-success' : 'badge-warning';
      var statusText = s.shiftStatus || 'Unconfirmed';
      html += '<div class="shift-card" onclick="App.shiftDetail(\'' + escHtml(s.id) + '\')">' +
        '<div class="shift-card-header">' +
          '<div><div class="shift-card-client">' + escHtml(s.clientName) + '</div>' +
          '<div class="shift-card-time">' + formatTime(s.startShift) + ' - ' + formatTime(s.endShift) + '</div></div>' +
          '<span class="badge ' + statusClass + '">' + escHtml(statusText) + '</span>' +
        '</div>' +
        '<div class="shift-card-meta">' +
          '<span class="shift-card-tag">' + escHtml(s.silOrCas || 'Shift') + '</span>' +
          '<span class="shift-card-tag">' + escHtml(s.totalHoursHMM || '') + '</span>' +
          (s.hasSleepover ? '<span class="shift-card-tag">Sleepover</span>' : '') +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }).catch(function() {
    var container = document.getElementById('shiftsList');
    if (container) container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Could not load shifts.</p></div>';
  });
}


/* ═══════════════════════════════════════════════════════════════
   PAGE 4: CLOCK IN / OUT
   ═══════════════════════════════════════════════════════════════ */
Router.register('clockin', function(el, params) {
  setTitle('Clock In / Out');
  showBack(true);

  var shift = null;
  if (params && params.shiftId) {
    shift = (AppState.shifts || []).find(function(s) { return s.id === params.shiftId; });
  }

  var now = new Date();
  var timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  var dateStr = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  var isClockedIn = AppState.clockedIn !== null;

  el.innerHTML = '<div>' +
    '<div class="clock-display">' +
      '<div class="clock-time" id="clockTimeDisplay">' + timeStr + '</div>' +
      '<div class="clock-date">' + dateStr + '</div>' +
    '</div>' +

    (shift ? '<div class="card mb-16"><div class="card-title">' + escHtml(shift.clientName) + '</div>' +
      '<div class="card-subtitle">' + formatTime(shift.startShift) + ' - ' + formatTime(shift.endShift) + '</div>' +
      '<div class="shift-card-meta mt-8"><span class="shift-card-tag">' + escHtml(shift.silOrCas || 'Shift') + '</span></div></div>' : '') +

    '<div style="text-align:center">' +
      '<div class="clock-status ' + (isClockedIn ? 'active' : 'idle') + '" id="clockStatus">' +
        (isClockedIn ? '<span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block"></span> Clocked In' : 'Not Clocked In') +
      '</div>' +
    '</div>' +

    '<div style="text-align:center">' +
      '<button class="clock-btn ' + (isClockedIn ? 'clock-out' : 'clock-in') + '" id="clockActionBtn" onclick="App.doClockAction(\'' + (shift ? escHtml(shift.id) : '') + '\', \'' + (shift ? escHtml(shift.clientName) : '') + '\')">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
        '<span>' + (isClockedIn ? 'Clock Out' : 'Clock In') + '</span>' +
      '</button>' +
    '</div>' +

    '<div id="clockOverride" style="display:none;margin-top:16px">' +
      '<div class="form-group">' +
        '<label class="form-label" for="overrideReason">Override Reason (min 10 chars)</label>' +
        '<textarea class="form-input" id="overrideReason" rows="2" placeholder="Explain why you are not at the client\'s location..."></textarea>' +
      '</div>' +
      '<button class="btn btn-accent btn-block" onclick="App.doClockOverride()">Submit Override</button>' +
    '</div>' +

    '<div id="clockOvertimeAlert" style="display:none" class="overtime-alert">Warning: This shift has exceeded 10 hours.</div>' +
  '</div>';

  // Live clock update
  var clockInterval = setInterval(function() {
    var el = document.getElementById('clockTimeDisplay');
    if (!el) { clearInterval(clockInterval); return; }
    var n = new Date();
    el.textContent = n.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    // Check overtime
    if (AppState.clockStartTime) {
      var elapsed = (Date.now() - AppState.clockStartTime) / (1000 * 60 * 60);
      if (elapsed > 10) {
        var alert = document.getElementById('clockOvertimeAlert');
        if (alert) alert.style.display = 'block';
      }
    }
  }, 1000);
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 5: PROGRESS NOTES
   ═══════════════════════════════════════════════════════════════ */
Router.register('notes', function(el) {
  setTitle('Progress Notes');
  showBack(true);

  el.innerHTML = '<div>' +
    '<button class="btn btn-accent btn-block mb-16" onclick="App.showNewNote()">New Progress Note</button>' +
    '<div id="noteFormSection" style="display:none"></div>' +
    '<div class="section-header"><span class="section-title">Recent Notes</span></div>' +
    '<div id="notesList" class="list-group"><div class="loading-center"><div class="spinner"></div></div></div>' +
  '</div>';

  // We don't have a GET notes endpoint, so show placeholder
  var container = document.getElementById('notesList');
  if (container) {
    container.innerHTML = '<div class="empty-state">' + SVG.note +
      '<p class="empty-state-title">No Recent Notes</p>' +
      '<p class="empty-state-text">Tap "New Progress Note" to create one.</p></div>';
  }
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 6: INCIDENTS
   ═══════════════════════════════════════════════════════════════ */
var incidentStep = 1;
var incidentData = {};

Router.register('incidents', function(el) {
  setTitle('Incident Report');
  showBack(true);
  incidentStep = 1;
  incidentData = {};
  renderIncidentWizard(el);
});

function renderIncidentWizard(el) {
  var steps = [1, 2, 3, 4];
  var progressHtml = '<div class="wizard-progress">';
  steps.forEach(function(s, i) {
    var cls = s < incidentStep ? 'completed' : (s === incidentStep ? 'active' : 'upcoming');
    progressHtml += '<div class="wizard-step ' + cls + '">' + (s < incidentStep ? SVG.check : s) + '</div>';
    if (i < steps.length - 1) {
      progressHtml += '<div class="wizard-line ' + (s < incidentStep ? 'completed' : '') + '"></div>';
    }
  });
  progressHtml += '</div>';

  var formHtml = '';

  if (incidentStep === 1) {
    formHtml = '<div class="card">' +
      '<h3 class="card-title mb-16">Client & Location</h3>' +
      '<div class="form-group"><label class="form-label" for="irClient">Client Name</label>' +
        '<input class="form-input" id="irClient" value="' + escHtml(incidentData.clientName || '') + '" placeholder="Enter client name"></div>' +
      '<div class="form-group"><label class="form-label" for="irDate">Date</label>' +
        '<input class="form-input" type="date" id="irDate" value="' + (incidentData.date || new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-group"><label class="form-label" for="irTime">Time</label>' +
        '<input class="form-input" type="time" id="irTime" value="' + (incidentData.time || new Date().toTimeString().slice(0, 5)) + '"></div>' +
      '<div class="form-group"><label class="form-label" for="irLocation">Location</label>' +
        '<input class="form-input" id="irLocation" value="' + escHtml(incidentData.location || '') + '" placeholder="Where did it occur?"></div>' +
      '<button class="btn btn-accent btn-block mt-16" onclick="App.incidentNext(1)">Next</button>' +
    '</div>';
  } else if (incidentStep === 2) {
    formHtml = '<div class="card">' +
      '<h3 class="card-title mb-16">Incident Details</h3>' +
      '<div class="form-group"><label class="form-label" for="irType">Type of Incident</label>' +
        '<select class="form-input" id="irType"><option value="">Select type...</option>' +
        '<option' + (incidentData.type === 'Injury' ? ' selected' : '') + '>Injury</option>' +
        '<option' + (incidentData.type === 'Behaviour of Concern' ? ' selected' : '') + '>Behaviour of Concern</option>' +
        '<option' + (incidentData.type === 'Medication Error' ? ' selected' : '') + '>Medication Error</option>' +
        '<option' + (incidentData.type === 'Property Damage' ? ' selected' : '') + '>Property Damage</option>' +
        '<option' + (incidentData.type === 'Near Miss' ? ' selected' : '') + '>Near Miss</option>' +
        '<option' + (incidentData.type === 'Other' ? ' selected' : '') + '>Other</option></select></div>' +
      '<div class="form-group"><label class="form-label" for="irSeverity">Severity</label>' +
        '<select class="form-input" id="irSeverity"><option value="">Select severity...</option>' +
        '<option' + (incidentData.severity === 'Low' ? ' selected' : '') + '>Low</option>' +
        '<option' + (incidentData.severity === 'Medium' ? ' selected' : '') + '>Medium</option>' +
        '<option' + (incidentData.severity === 'High' ? ' selected' : '') + '>High</option>' +
        '<option' + (incidentData.severity === 'Critical' ? ' selected' : '') + '>Critical</option></select></div>' +
      '<div class="form-group"><label class="form-label" for="irDesc">Description (min 50 chars)</label>' +
        '<textarea class="form-input" id="irDesc" rows="4" placeholder="Describe what happened in detail...">' + escHtml(incidentData.description || '') + '</textarea></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-outline" style="flex:1" onclick="App.incidentPrev(2)">Back</button>' +
        '<button class="btn btn-accent" style="flex:1" onclick="App.incidentNext(2)">Next</button>' +
      '</div>' +
    '</div>';
  } else if (incidentStep === 3) {
    formHtml = '<div class="card">' +
      '<h3 class="card-title mb-16">Actions & Witnesses</h3>' +
      '<div class="form-group"><label class="form-label" for="irActions">Actions Taken</label>' +
        '<textarea class="form-input" id="irActions" rows="3" placeholder="What actions were taken?">' + escHtml(incidentData.actions || '') + '</textarea></div>' +
      '<div class="form-group"><label class="form-label" for="irWitnesses">Witnesses</label>' +
        '<input class="form-input" id="irWitnesses" value="' + escHtml(incidentData.witnesses || '') + '" placeholder="Names of any witnesses"></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-outline" style="flex:1" onclick="App.incidentPrev(3)">Back</button>' +
        '<button class="btn btn-accent" style="flex:1" onclick="App.incidentNext(3)">Next</button>' +
      '</div>' +
    '</div>';
  } else if (incidentStep === 4) {
    formHtml = '<div class="card">' +
      '<h3 class="card-title mb-16">Review & Submit</h3>' +
      '<div style="font-size:var(--font-size-sm);color:var(--color-text-secondary)">' +
        '<div class="flex-between mb-8"><span style="color:var(--color-text-muted)">Client</span><span style="font-weight:500">' + escHtml(incidentData.clientName) + '</span></div>' +
        '<div class="flex-between mb-8"><span style="color:var(--color-text-muted)">Date/Time</span><span style="font-weight:500">' + escHtml(incidentData.date) + ' ' + escHtml(incidentData.time) + '</span></div>' +
        '<div class="flex-between mb-8"><span style="color:var(--color-text-muted)">Location</span><span style="font-weight:500">' + escHtml(incidentData.location) + '</span></div>' +
        '<div class="flex-between mb-8"><span style="color:var(--color-text-muted)">Type</span><span style="font-weight:500">' + escHtml(incidentData.type) + '</span></div>' +
        '<div class="flex-between mb-8"><span style="color:var(--color-text-muted)">Severity</span><span class="badge badge-' + (incidentData.severity === 'Critical' || incidentData.severity === 'High' ? 'danger' : incidentData.severity === 'Medium' ? 'warning' : 'info') + '">' + escHtml(incidentData.severity) + '</span></div>' +
        '<div class="divider"></div>' +
        '<p style="margin-bottom:4px;color:var(--color-text-muted)">Description</p>' +
        '<p style="margin-bottom:12px">' + escHtml(incidentData.description) + '</p>' +
        (incidentData.actions ? '<p style="margin-bottom:4px;color:var(--color-text-muted)">Actions Taken</p><p style="margin-bottom:12px">' + escHtml(incidentData.actions) + '</p>' : '') +
        (incidentData.witnesses ? '<p style="margin-bottom:4px;color:var(--color-text-muted)">Witnesses</p><p>' + escHtml(incidentData.witnesses) + '</p>' : '') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:16px">' +
        '<button class="btn btn-outline" style="flex:1" onclick="App.incidentPrev(4)">Back</button>' +
        '<button class="btn btn-danger" style="flex:1" id="irSubmitBtn" onclick="App.submitIncident()">Submit Report</button>' +
      '</div>' +
    '</div>';
  }

  el.innerHTML = '<div>' + progressHtml + formHtml + '</div>';
}


/* ═══════════════════════════════════════════════════════════════
   PAGE 7: CLIENTS
   ═══════════════════════════════════════════════════════════════ */
Router.register('clients', function(el) {
  setTitle('My Clients');
  showBack(true);

  el.innerHTML = '<div id="clientsList" class="list-group"><div class="loading-center"><div class="spinner"></div></div></div>';

  API.get('/api/sw/shifts').then(function(shifts) {
    AppState.shifts = shifts || [];
    var clientMap = {};
    shifts.forEach(function(s) {
      if (s.clientName && !clientMap[s.clientName]) {
        clientMap[s.clientName] = { name: s.clientName, type: s.silOrCas || 'Support', lastShift: s.startShift };
      }
    });
    var clients = Object.values(clientMap);
    AppState.clients = clients;

    var container = document.getElementById('clientsList');
    if (!container) return;

    if (clients.length === 0) {
      container.innerHTML = '<div class="empty-state">' + SVG.user +
        '<p class="empty-state-title">No Clients</p>' +
        '<p class="empty-state-text">You have no assigned clients yet.</p></div>';
      return;
    }

    var html = '';
    clients.forEach(function(c) {
      html += '<div class="client-card" onclick="App.clientDetail(\'' + escHtml(c.name) + '\')">' +
        '<div class="client-avatar">' + initials(c.name) + '</div>' +
        '<div class="client-info">' +
          '<div class="client-name">' + escHtml(c.name) + '</div>' +
          '<div class="client-type">' + escHtml(c.type) + '</div>' +
        '</div>' +
        '<span class="list-item-chevron">' + chevronSvg() + '</span>' +
      '</div>';
    });
    container.innerHTML = html;
  }).catch(function() {
    var container = document.getElementById('clientsList');
    if (container) container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Could not load clients.</p></div>';
  });
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 8: TRAINING
   ═══════════════════════════════════════════════════════════════ */
Router.register('training', function(el) {
  setTitle('Training');
  showBack(true);

  el.innerHTML = '<div id="coursesList"><div class="loading-center"><div class="spinner"></div></div></div>';

  API.get('/api/sw/enrollments').then(function(enrollments) {
    var container = document.getElementById('coursesList');
    if (!container) return;

    if (!enrollments || enrollments.length === 0) {
      container.innerHTML = '<div class="empty-state">' + SVG.book +
        '<p class="empty-state-title">No Courses</p>' +
        '<p class="empty-state-text">You are not enrolled in any courses.</p></div>';
      return;
    }

    var html = '';
    enrollments.forEach(function(e) {
      var pct = Math.round((e.progress || 0) * 100);
      html += '<div class="course-card" onclick="App.courseDetail(\'' + escHtml(e.courseId) + '\', \'' + escHtml(e.enrollmentId) + '\')">' +
        '<div class="course-title">' + escHtml(e.courseName) + '</div>' +
        '<div class="flex-between">' +
          '<span class="progress-text">' + pct + '% complete</span>' +
          (e.courseExpiry ? '<span class="progress-text">Expires: ' + formatDate(e.courseExpiry) + '</span>' : '') +
        '</div>' +
        '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    });
    container.innerHTML = html;
  }).catch(function() {
    var container = document.getElementById('coursesList');
    if (container) container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Could not load courses.</p></div>';
  });
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 9: LEAVE & AVAILABILITY
   ═══════════════════════════════════════════════════════════════ */
var availData = {};

Router.register('leave', function(el) {
  setTitle('Leave & Availability');
  showBack(true);

  // Initialize availability from localStorage
  availData = JSON.parse(localStorage.getItem('sw_avail') || '{}');

  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var availHtml = '<div class="avail-grid">' +
    '<div class="avail-header"></div><div class="avail-header">AM</div><div class="avail-header">PM</div>';
  days.forEach(function(d) {
    var amKey = d + '_AM';
    var pmKey = d + '_PM';
    availHtml += '<div class="avail-day">' + d + '</div>' +
      '<div class="avail-toggle"><button onclick="App.toggleAvail(\'' + amKey + '\', this)" class="' + (availData[amKey] ? 'available' : '') + '">' + (availData[amKey] ? 'Yes' : '-') + '</button></div>' +
      '<div class="avail-toggle"><button onclick="App.toggleAvail(\'' + pmKey + '\', this)" class="' + (availData[pmKey] ? 'available' : '') + '">' + (availData[pmKey] ? 'Yes' : '-') + '</button></div>';
  });
  availHtml += '</div>';

  el.innerHTML = '<div>' +
    '<div class="section-header"><span class="section-title">Submit Leave</span></div>' +
    '<div class="card mb-24">' +
      '<div class="form-group"><label class="form-label" for="leaveType">Leave Type</label>' +
        '<select class="form-input" id="leaveType"><option value="Annual">Annual Leave</option><option value="Personal">Personal Leave</option><option value="Unpaid">Unpaid Leave</option></select></div>' +
      '<div class="form-group"><label class="form-label" for="leaveStart">Start Date</label>' +
        '<input class="form-input" type="date" id="leaveStart"></div>' +
      '<div class="form-group"><label class="form-label" for="leaveEnd">End Date</label>' +
        '<input class="form-input" type="date" id="leaveEnd"></div>' +
      '<div class="form-group"><label class="form-label" for="leaveReason">Reason</label>' +
        '<textarea class="form-input" id="leaveReason" rows="2" placeholder="Optional reason..."></textarea></div>' +
      '<button class="btn btn-accent btn-block" onclick="App.submitLeave()">Submit Leave Request</button>' +
    '</div>' +

    '<div class="section-header"><span class="section-title">Weekly Availability</span></div>' +
    availHtml +
  '</div>';
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 10: DOCUMENTS
   ═══════════════════════════════════════════════════════════════ */
Router.register('documents', function(el) {
  setTitle('My Documents');
  showBack(true);

  el.innerHTML = '<div>' +
    '<div class="section-header"><span class="section-title">Pending Signatures</span></div>' +
    '<div id="docsListPending" class="list-group mb-24">' +
      '<div class="empty-state">' + SVG.doc +
        '<p class="empty-state-title">No Pending Documents</p>' +
        '<p class="empty-state-text">All documents are up to date.</p></div>' +
    '</div>' +
    '<div class="section-header"><span class="section-title">Signed Documents</span></div>' +
    '<div id="docsListSigned" class="list-group">' +
      '<div class="empty-state"><p class="empty-state-text">No signed documents yet.</p></div>' +
    '</div>' +
  '</div>';
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 11: BUDGET
   ═══════════════════════════════════════════════════════════════ */
Router.register('budget', function(el) {
  setTitle('Client Budgets');
  showBack(true);

  el.innerHTML = '<div id="budgetList"><div class="loading-center"><div class="spinner"></div></div></div>';

  API.get('/api/sw/shifts').then(function(shifts) {
    var clientHours = {};
    (shifts || []).forEach(function(s) {
      if (!s.clientName) return;
      if (!clientHours[s.clientName]) {
        clientHours[s.clientName] = { name: s.clientName, hours: 0, type: s.silOrCas || 'Support', rate: s.chargePerHour || 0 };
      }
      clientHours[s.clientName].hours += (s.totalHoursDecimal || 0);
    });
    var clients = Object.values(clientHours);

    var container = document.getElementById('budgetList');
    if (!container) return;

    if (clients.length === 0) {
      container.innerHTML = '<div class="empty-state">' + SVG.dollar +
        '<p class="empty-state-title">No Budget Data</p>' +
        '<p class="empty-state-text">Budget information will appear for assigned clients.</p></div>';
      return;
    }

    var html = '';
    clients.forEach(function(c) {
      var delivered = c.hours;
      var estimated = 168; // estimate monthly hours
      var pct = Math.min(Math.round((delivered / estimated) * 100), 100);
      var barClass = pct < 60 ? 'low' : (pct < 85 ? 'mid' : 'high');
      var dollarDelivered = (delivered * (c.rate || 65)).toFixed(2);

      html += '<div class="budget-card">' +
        '<div class="budget-header">' +
          '<span class="budget-client">' + escHtml(c.name) + '</span>' +
          '<span class="badge badge-neutral">' + escHtml(c.type) + '</span>' +
        '</div>' +
        '<div class="budget-bar-wrap"><div class="budget-bar-fill ' + barClass + '" style="width:' + pct + '%"></div></div>' +
        '<div class="budget-stats">' +
          '<span>' + delivered.toFixed(1) + ' hrs delivered</span>' +
          '<span>$' + dollarDelivered + '</span>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }).catch(function() {
    var container = document.getElementById('budgetList');
    if (container) container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Could not load budget data.</p></div>';
  });
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 12: AI CHAT
   ═══════════════════════════════════════════════════════════════ */
var chatMessages = [];

Router.register('chat', function(el) {
  setTitle('AI Assistant');
  showBack(true);

  el.innerHTML = '<div class="chat-container fullscreen">' +
    '<div class="chat-quick-btns">' +
      '<button class="chat-quick-btn" onclick="App.chatQuick(\'SOP Help\')">SOP Help</button>' +
      '<button class="chat-quick-btn" onclick="App.chatQuick(\'Payroll Q\')">Payroll Q</button>' +
      '<button class="chat-quick-btn" onclick="App.chatQuick(\'Policy\')">Policy</button>' +
      '<button class="chat-quick-btn" onclick="App.chatQuick(\'Client Info\')">Client Info</button>' +
    '</div>' +
    '<div class="chat-messages" id="chatMessages">' +
      (chatMessages.length === 0 ? '<div class="chat-bubble received">Hi! I\'m your AI assistant. How can I help you today?</div>' : '') +
    '</div>' +
    '<div class="chat-input-wrap">' +
      '<textarea class="form-input" id="chatInput" rows="1" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();App.sendChat()}" oninput="autoGrow(this)"></textarea>' +
      '<button class="chat-send-btn" onclick="App.sendChat()" aria-label="Send message">' + SVG.send + '</button>' +
    '</div>' +
  '</div>';

  // Re-render existing messages
  if (chatMessages.length > 0) {
    var container = document.getElementById('chatMessages');
    if (container) {
      var html = '';
      chatMessages.forEach(function(m) {
        html += '<div class="chat-bubble ' + (m.role === 'user' ? 'sent' : 'received') + '">' + escHtml(m.text) + '</div>';
      });
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    }
  }
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 13: MESSENGER
   ═══════════════════════════════════════════════════════════════ */
Router.register('messenger', function(el) {
  setTitle('Messages');
  showBack(false);

  el.innerHTML = '<div id="messengerView">' +
    '<div id="channelList" class="list-group"><div class="loading-center"><div class="spinner"></div></div></div>' +
  '</div>';

  API.get('/api/messenger/channels').then(function(data) {
    var channels = data.channels || data || [];
    var container = document.getElementById('channelList');
    if (!container) return;

    if (!channels.length) {
      container.innerHTML = '<div class="empty-state">' + SVG.chat +
        '<p class="empty-state-title">No Channels</p>' +
        '<p class="empty-state-text">You haven\'t joined any channels yet.</p></div>';
      return;
    }

    var colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    var html = '';
    channels.forEach(function(ch, i) {
      var color = colors[i % colors.length];
      html += '<div class="channel-item" onclick="App.openChannel(\'' + escHtml(ch.id || ch.name) + '\', \'' + escHtml(ch.name) + '\')">' +
        '<div class="channel-icon" style="background:' + color + '20;color:' + color + '">' + SVG.chat + '</div>' +
        '<div class="channel-info">' +
          '<div class="channel-name">' + escHtml(ch.name) + '</div>' +
          '<div class="channel-last-msg">' + escHtml(ch.lastMessage || 'No messages yet') + '</div>' +
        '</div>' +
        (ch.unread ? '<span class="badge-count">' + ch.unread + '</span>' : '') +
        '<span class="list-item-chevron">' + chevronSvg() + '</span>' +
      '</div>';
    });
    container.innerHTML = html;
  }).catch(function() {
    var container = document.getElementById('channelList');
    if (container) {
      container.innerHTML = '<div class="empty-state">' + SVG.chat +
        '<p class="empty-state-title">Messages Unavailable</p>' +
        '<p class="empty-state-text">Could not load channels. Try again later.</p></div>';
    }
  });
});


/* ═══════════════════════════════════════════════════════════════
   PAGE 14: PROFILE
   ═══════════════════════════════════════════════════════════════ */
Router.register('profile', function(el) {
  setTitle('Profile');
  showBack(false);

  var user = AppState.user || {};
  var darkMode = localStorage.getItem('sw_dark_mode') === 'true';

  el.innerHTML = '<div>' +
    '<div class="profile-header">' +
      '<div class="profile-photo">' +
        (user.photoUrl ? '<img src="' + escHtml(user.photoUrl) + '" alt="Profile photo">' : '<span class="profile-photo-placeholder">' + initials(user.name) + '</span>') +
      '</div>' +
      '<div class="profile-name">' + escHtml(user.name || 'Support Worker') + '</div>' +
      '<div class="profile-role">' + escHtml(user.contactType || user.typeOfEmployment || 'Support Worker') + '</div>' +
    '</div>' +

    '<div class="profile-section">' +
      '<div class="profile-row"><span class="profile-row-label">Email</span><span class="profile-row-value">' + escHtml(user.email || '') + '</span></div>' +
      '<div class="profile-row"><span class="profile-row-label">Phone</span><span class="profile-row-value">' + escHtml(user.phone || 'Not set') + '</span></div>' +
      '<div class="profile-row"><span class="profile-row-label">Classification</span><span class="profile-row-value">' + escHtml(user.typeOfEmployment || 'Not set') + '</span></div>' +
    '</div>' +

    '<div class="profile-section">' +
      '<div class="profile-row">' +
        '<span class="profile-row-label">Dark Mode</span>' +
        '<label class="toggle"><input type="checkbox" onchange="App.toggleDarkMode(this.checked)"' + (darkMode ? ' checked' : '') + '><span class="toggle-track"></span><span class="toggle-thumb"></span></label>' +
      '</div>' +
      '<div class="profile-row">' +
        '<span class="profile-row-label">Push Notifications</span>' +
        '<label class="toggle"><input type="checkbox" onchange="App.toggleNotifications(this.checked)"><span class="toggle-track"></span><span class="toggle-thumb"></span></label>' +
      '</div>' +
    '</div>' +

    '<div class="list-group mt-16">' +
      '<div class="list-item" onclick="Router.go(\'training\')">' +
        '<div class="list-item-content"><span class="list-item-title">My Training</span></div>' +
        '<span class="list-item-chevron">' + chevronSvg() + '</span>' +
      '</div>' +
      '<div class="list-item" onclick="Router.go(\'leave\')">' +
        '<div class="list-item-content"><span class="list-item-title">Leave & Availability</span></div>' +
        '<span class="list-item-chevron">' + chevronSvg() + '</span>' +
      '</div>' +
      '<div class="list-item" onclick="Router.go(\'documents\')">' +
        '<div class="list-item-content"><span class="list-item-title">My Documents</span></div>' +
        '<span class="list-item-chevron">' + chevronSvg() + '</span>' +
      '</div>' +
      '<div class="list-item" onclick="Router.go(\'budget\')">' +
        '<div class="list-item-content"><span class="list-item-title">Client Budgets</span></div>' +
        '<span class="list-item-chevron">' + chevronSvg() + '</span>' +
      '</div>' +
    '</div>' +

    '<button class="btn btn-danger btn-block mt-24" onclick="App.signOut()">' +
      SVG.logout + ' Sign Out' +
    '</button>' +
  '</div>';
});


/* ═══════════════════════════════════════════════════════════════
   APP ACTIONS (global namespace for onclick handlers)
   ═══════════════════════════════════════════════════════════════ */
var App = {};

// ── Auth Actions ──
App.doLogin = function() {
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  if (!email || !password) { errEl.textContent = 'Email and password are required.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  var btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  API.post('/api/sw/login', { email: email, password: password }).then(function(data) {
    if (data.otpRequired) {
      AppState._loginEmail = email;
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('otpSection').style.display = 'block';
      document.getElementById('otpCode').focus();
    }
  }).catch(function(err) {
    errEl.textContent = err.message || 'Login failed. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Sign In';
  });
};

App.verifyOtp = function() {
  var code = document.getElementById('otpCode').value.trim();
  var errEl = document.getElementById('otpError');
  if (!code || code.length !== 6) { errEl.textContent = 'Please enter the 6-digit code.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  var btn = document.getElementById('otpBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  API.post('/api/sw/verify-otp', { email: AppState._loginEmail, code: code }).then(function(data) {
    if (data.token) {
      API.setToken(data.token);
      AppState.user = data.user;
      localStorage.setItem('sw_user', JSON.stringify(data.user));
      document.getElementById('appContent').classList.remove('no-nav');
      Router.go('home');
    }
  }).catch(function(err) {
    errEl.textContent = err.message || 'Invalid code. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify Code';
  });
};

App.resendOtp = function() {
  API.post('/api/sw/resend-otp', { email: AppState._loginEmail }).then(function() {
    showToast('New code sent to your email', 'success');
  }).catch(function() {
    showToast('Could not resend code', 'error');
  });
};

App.showForgotPassword = function() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('forgotSection').style.display = 'block';
};

App.backToLogin = function() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('forgotSection').style.display = 'none';
  document.getElementById('otpSection').style.display = 'none';
};

App.doForgotPassword = function() {
  var email = document.getElementById('forgotEmail').value.trim();
  var errEl = document.getElementById('forgotError');
  if (!email) { errEl.textContent = 'Please enter your email.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  API.post('/api/sw/forgot-password', { email: email }).then(function(data) {
    if (data.otpSent) {
      AppState._loginEmail = email;
      document.getElementById('forgotSection').style.display = 'none';
      document.getElementById('otpSection').style.display = 'block';
      showToast('Reset code sent to your email', 'success');
    }
  }).catch(function(err) {
    errEl.textContent = err.message || 'Could not send reset code.';
    errEl.style.display = 'block';
  });
};

App.signOut = function() {
  API.post('/api/sw/logout', {}).catch(function() {});
  API.clearToken();
  AppState.user = null;
  AppState.shifts = [];
  AppState.clients = [];
  AppState.clockedIn = null;
  AppState.clockStartTime = null;
  localStorage.removeItem('sw_user');
  Router.go('login');
};

// ── Shift Actions ──
App.shiftsPrev = function() {
  shiftsWeekOffset--;
  var el = document.getElementById('appContent');
  renderShifts(el);
};

App.shiftsNext = function() {
  shiftsWeekOffset++;
  var el = document.getElementById('appContent');
  renderShifts(el);
};

App.shiftDetail = function(id) {
  var shift = (AppState.shifts || []).find(function(s) { return s.id === id; });
  if (!shift) return;
  Router.go('clockin', { shiftId: id });
};

// ── Clock Actions ──
var _clockPendingData = null;

App.doClockAction = function(rosterId, clientName) {
  if (!rosterId) {
    showToast('Please select a shift first', 'error');
    return;
  }

  var action = AppState.clockedIn === rosterId ? 'clock-out' : 'clock-in';

  if (!navigator.geolocation) {
    showToast('GPS not available on this device', 'error');
    return;
  }

  showToast('Getting your location...', 'info');

  navigator.geolocation.getCurrentPosition(function(pos) {
    _clockPendingData = { action: action, rosterId: rosterId, lat: pos.coords.latitude, lng: pos.coords.longitude, clientName: clientName };

    API.post('/api/sw/clock', _clockPendingData).then(function(data) {
      if (data.allowed === false) {
        // Need override
        document.getElementById('clockOverride').style.display = 'block';
        showToast('You are ' + data.distance + 'm from the client. Please provide a reason.', 'error');
        return;
      }
      // Success
      if (action === 'clock-in') {
        AppState.clockedIn = rosterId;
        AppState.clockStartTime = Date.now();
        showToast('Clocked in successfully', 'success');
      } else {
        AppState.clockedIn = null;
        AppState.clockStartTime = null;
        showToast('Clocked out successfully', 'success');
      }
      Router.go('clockin', { shiftId: rosterId });
    }).catch(function(err) {
      showToast(err.message || 'Clock action failed', 'error');
    });
  }, function(err) {
    showToast('Could not get your location: ' + err.message, 'error');
  }, { enableHighAccuracy: true, timeout: 10000 });
};

App.doClockOverride = function() {
  if (!_clockPendingData) return;
  var reason = document.getElementById('overrideReason').value.trim();
  if (reason.length < 10) {
    showToast('Override reason must be at least 10 characters', 'error');
    return;
  }
  _clockPendingData.overrideReason = reason;

  API.post('/api/sw/clock', _clockPendingData).then(function(data) {
    if (data.allowed) {
      if (_clockPendingData.action === 'clock-in') {
        AppState.clockedIn = _clockPendingData.rosterId;
        AppState.clockStartTime = Date.now();
        showToast('Clocked in with override', 'success');
      } else {
        AppState.clockedIn = null;
        AppState.clockStartTime = null;
        showToast('Clocked out with override', 'success');
      }
      Router.go('clockin', { shiftId: _clockPendingData.rosterId });
    } else {
      showToast('Override rejected', 'error');
    }
    _clockPendingData = null;
  }).catch(function(err) {
    showToast(err.message || 'Override failed', 'error');
  });
};

// ── Notes Actions ──
App.showNewNote = function() {
  var section = document.getElementById('noteFormSection');
  if (!section) return;

  var clientOptions = '<option value="">Select client...</option>';
  (AppState.clients || []).forEach(function(c) {
    clientOptions += '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + '</option>';
  });
  // Also build from shifts
  var clientNames = {};
  (AppState.shifts || []).forEach(function(s) { if (s.clientName) clientNames[s.clientName] = true; });
  Object.keys(clientNames).forEach(function(n) {
    if (!clientOptions.includes('"' + n + '"')) {
      clientOptions += '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>';
    }
  });

  section.style.display = 'block';
  section.innerHTML = '<div class="card mb-16">' +
    '<h3 class="card-title mb-16">New Progress Note</h3>' +
    '<div class="form-group"><label class="form-label" for="noteClient">Client</label>' +
      '<select class="form-input" id="noteClient">' + clientOptions + '</select></div>' +
    '<div class="form-group"><label class="form-label" for="noteCategory">Category</label>' +
      '<select class="form-input" id="noteCategory">' +
        '<option>Daily Support</option><option>Community Access</option><option>Health</option>' +
        '<option>Behaviour</option><option>Communication</option><option>General</option>' +
      '</select></div>' +
    '<div class="form-group"><label class="form-label" for="noteText">Notes (min 50 characters)</label>' +
      '<textarea class="form-input auto-grow" id="noteText" rows="4" placeholder="Describe the support provided, activities completed, and any observations..." oninput="autoGrow(this)"></textarea>' +
      '<span class="form-hint" id="noteCharCount">0 / 50 minimum</span></div>' +
    '<div class="form-group">' +
      '<button class="btn btn-outline btn-sm" onclick="App.notePhoto()">' + SVG.photo + ' Add Photo</button>' +
      '<input type="file" id="notePhotoInput" accept="image/*" capture="environment" style="display:none">' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-outline" style="flex:1" onclick="document.getElementById(\'noteFormSection\').style.display=\'none\'">Cancel</button>' +
      '<button class="btn btn-accent" style="flex:1" id="noteSubmitBtn" onclick="App.submitNote()">Submit Note</button>' +
    '</div>' +
  '</div>';

  // Character counter
  var textEl = document.getElementById('noteText');
  if (textEl) {
    textEl.addEventListener('input', function() {
      var count = this.value.length;
      var hint = document.getElementById('noteCharCount');
      if (hint) hint.textContent = count + ' / 50 minimum';
    });
  }

  // Load clients from shifts
  API.get('/api/sw/shifts').then(function(shifts) {
    AppState.shifts = shifts || [];
  }).catch(function() {});
};

App.notePhoto = function() {
  var input = document.getElementById('notePhotoInput');
  if (input) input.click();
};

App.submitNote = function() {
  var client = document.getElementById('noteClient').value;
  var category = document.getElementById('noteCategory').value;
  var notes = document.getElementById('noteText').value.trim();

  if (!client) { showToast('Please select a client', 'error'); return; }
  if (notes.length < 50) { showToast('Notes must be at least 50 characters', 'error'); return; }

  var btn = document.getElementById('noteSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  API.post('/api/sw/progress-note', {
    clientName: client,
    notes: '[' + category + '] ' + notes,
    startDateTime: new Date().toISOString(),
    endDateTime: new Date().toISOString()
  }).then(function(data) {
    if (data.success) {
      showToast('Progress note submitted', 'success');
      document.getElementById('noteFormSection').style.display = 'none';
    }
  }).catch(function(err) {
    showToast(err.message || 'Failed to submit note', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Note';
  });
};

// ── Incident Actions ──
App.incidentNext = function(step) {
  if (step === 1) {
    incidentData.clientName = document.getElementById('irClient').value.trim();
    incidentData.date = document.getElementById('irDate').value;
    incidentData.time = document.getElementById('irTime').value;
    incidentData.location = document.getElementById('irLocation').value.trim();
    if (!incidentData.clientName) { showToast('Client name is required', 'error'); return; }
  } else if (step === 2) {
    incidentData.type = document.getElementById('irType').value;
    incidentData.severity = document.getElementById('irSeverity').value;
    incidentData.description = document.getElementById('irDesc').value.trim();
    if (!incidentData.type) { showToast('Please select incident type', 'error'); return; }
    if (!incidentData.severity) { showToast('Please select severity', 'error'); return; }
    if (incidentData.description.length < 50) { showToast('Description must be at least 50 characters', 'error'); return; }
  } else if (step === 3) {
    incidentData.actions = document.getElementById('irActions').value.trim();
    incidentData.witnesses = document.getElementById('irWitnesses').value.trim();
  }
  incidentStep = step + 1;
  renderIncidentWizard(document.getElementById('appContent'));
};

App.incidentPrev = function(step) {
  // Save current step data before going back
  if (step === 2) {
    incidentData.type = document.getElementById('irType').value;
    incidentData.severity = document.getElementById('irSeverity').value;
    incidentData.description = document.getElementById('irDesc').value.trim();
  } else if (step === 3) {
    incidentData.actions = document.getElementById('irActions').value.trim();
    incidentData.witnesses = document.getElementById('irWitnesses').value.trim();
  }
  incidentStep = step - 1;
  renderIncidentWizard(document.getElementById('appContent'));
};

App.submitIncident = function() {
  var btn = document.getElementById('irSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  var dateTime = incidentData.date + 'T' + incidentData.time + ':00.000Z';

  API.post('/api/sw/incident', {
    clientName: incidentData.clientName,
    dateTime: dateTime,
    description: 'Type: ' + incidentData.type + '\nLocation: ' + incidentData.location + '\n\n' + incidentData.description +
      (incidentData.actions ? '\n\nActions Taken: ' + incidentData.actions : '') +
      (incidentData.witnesses ? '\n\nWitnesses: ' + incidentData.witnesses : ''),
    severity: incidentData.severity
  }).then(function(data) {
    if (data.success) {
      showToast('Incident report submitted', 'success');
      incidentStep = 1;
      incidentData = {};
      Router.go('home');
    }
  }).catch(function(err) {
    showToast(err.message || 'Failed to submit report', 'error');
    btn.disabled = false;
    btn.textContent = 'Submit Report';
  });
};

// ── Client Actions ──
App.clientDetail = function(name) {
  var el = document.getElementById('appContent');
  setTitle(name);
  showBack(true);

  var clientShifts = (AppState.shifts || []).filter(function(s) { return s.clientName === name; });
  var lastShift = clientShifts.length > 0 ? clientShifts[clientShifts.length - 1] : null;

  el.innerHTML = '<div>' +
    '<div class="card mb-16">' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">' +
        '<div class="client-avatar" style="width:56px;height:56px;font-size:var(--font-size-lg)">' + initials(name) + '</div>' +
        '<div><div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-bold)">' + escHtml(name) + '</div>' +
        '<div style="font-size:var(--font-size-sm);color:var(--color-text-muted)">' + (lastShift ? escHtml(lastShift.silOrCas || 'Support') : 'Client') + '</div></div>' +
      '</div>' +
    '</div>' +

    '<div class="section-header"><span class="section-title">Recent Shifts</span></div>' +
    '<div class="list-group mb-16">' +
      (clientShifts.length > 0 ? clientShifts.slice(-5).reverse().map(function(s) {
        return '<div class="list-item">' +
          '<div class="list-item-content">' +
            '<span class="list-item-title">' + formatDate(s.startShift) + '</span>' +
            '<span class="list-item-subtitle">' + formatTime(s.startShift) + ' - ' + formatTime(s.endShift) + ' (' + escHtml(s.totalHoursHMM || '') + ')</span>' +
          '</div>' +
          '<span class="badge ' + (s.progressNoteCompleted ? 'badge-success' : 'badge-warning') + '">' + (s.progressNoteCompleted ? 'Noted' : 'Pending') + '</span>' +
        '</div>';
      }).join('') : '<div class="empty-state"><p class="empty-state-text">No shift history.</p></div>') +
    '</div>' +

    '<div class="section-header"><span class="section-title">Quick Actions</span></div>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-accent btn-sm" style="flex:1" onclick="Router.go(\'notes\')">Write Note</button>' +
      '<button class="btn btn-outline btn-sm" style="flex:1" onclick="Router.go(\'incidents\')">Report Incident</button>' +
    '</div>' +
  '</div>';
};

// ── Training Actions ──
App.courseDetail = function(courseId, enrollmentId) {
  var el = document.getElementById('appContent');
  setTitle('Course');
  showBack(true);

  el.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  API.get('/api/sw/course-detail?id=' + courseId).then(function(data) {
    var modules = data.modules || [];

    var html = '<div>';
    if (modules.length === 0) {
      html += '<div class="empty-state"><p class="empty-state-text">No content available for this course.</p></div>';
    } else {
      modules.forEach(function(m) {
        html += '<div class="card mb-12">' +
          '<div class="card-title">' + escHtml(m.name) + '</div>' +
          (m.description ? '<p class="card-body mt-8">' + escHtml(m.description) + '</p>' : '');

        if (m.lessons && m.lessons.length > 0) {
          html += '<div class="list-group mt-12">';
          m.lessons.forEach(function(l) {
            html += '<div class="list-item">' +
              '<div class="list-item-content">' +
                '<span class="list-item-title">' + escHtml(l.name) + '</span>' +
                '<span class="list-item-subtitle">' + escHtml(l.type) + '</span>' +
              '</div>' +
              '<span class="badge badge-neutral">' + escHtml(l.status || 'Not started') + '</span>' +
            '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });
    }

    if (data.quiz) {
      html += '<div class="card mb-12">' +
        '<div class="card-title">Quiz: ' + escHtml(data.quiz.name) + '</div>' +
        '<p class="card-body mt-8">Pass mark: ' + data.quiz.passPercentage + '% (' + (data.quiz.questions || []).length + ' questions)</p>' +
        '<button class="btn btn-accent btn-block mt-16" onclick="App.startQuiz(\'' + escHtml(courseId) + '\', \'' + escHtml(enrollmentId) + '\')">Start Quiz</button>' +
      '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
  }).catch(function() {
    el.innerHTML = '<div class="empty-state"><p class="empty-state-text">Could not load course details.</p></div>';
  });
};

App.startQuiz = function(courseId, enrollmentId) {
  showToast('Quiz feature coming soon', 'info');
};

// ── Leave Actions ──
App.toggleAvail = function(key, btn) {
  availData[key] = !availData[key];
  btn.className = availData[key] ? 'available' : '';
  btn.textContent = availData[key] ? 'Yes' : '-';
  localStorage.setItem('sw_avail', JSON.stringify(availData));
};

App.submitLeave = function() {
  var type = document.getElementById('leaveType').value;
  var start = document.getElementById('leaveStart').value;
  var end = document.getElementById('leaveEnd').value;
  var reason = document.getElementById('leaveReason').value.trim();

  if (!start || !end) { showToast('Please select start and end dates', 'error'); return; }
  if (new Date(end) < new Date(start)) { showToast('End date must be after start date', 'error'); return; }

  // Store locally as there's no leave endpoint yet
  var leaves = JSON.parse(localStorage.getItem('sw_leaves') || '[]');
  leaves.push({ type: type, start: start, end: end, reason: reason, submitted: new Date().toISOString() });
  localStorage.setItem('sw_leaves', JSON.stringify(leaves));
  showToast('Leave request submitted', 'success');
};

// ── Chat Actions ──
App.chatQuick = function(text) {
  var input = document.getElementById('chatInput');
  if (input) { input.value = text; App.sendChat(); }
};

App.sendChat = function() {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  autoGrow(input);

  chatMessages.push({ role: 'user', text: text });
  var container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML += '<div class="chat-bubble sent">' + escHtml(text) + '</div>';
    container.innerHTML += '<div class="chat-bubble received" id="chatTyping" style="opacity:0.6">Thinking...</div>';
    container.scrollTop = container.scrollHeight;
  }

  API.post('/api/chatbot/message', { message: text }).then(function(data) {
    var reply = (data.reply || data.response || data.message || 'Sorry, I couldn\'t process that request.');
    chatMessages.push({ role: 'assistant', text: reply });
    var typing = document.getElementById('chatTyping');
    if (typing) {
      typing.id = '';
      typing.style.opacity = '1';
      typing.textContent = reply;
    }
    if (container) container.scrollTop = container.scrollHeight;
  }).catch(function() {
    var typing = document.getElementById('chatTyping');
    if (typing) {
      typing.id = '';
      typing.style.opacity = '1';
      typing.textContent = 'Sorry, I\'m having trouble connecting right now. Please try again.';
    }
  });
};

// ── Messenger Actions ──
App.openChannel = function(channelId, channelName) {
  var el = document.getElementById('appContent');
  setTitle(channelName || 'Chat');
  showBack(true);

  el.innerHTML = '<div class="chat-container fullscreen">' +
    '<div class="chat-messages" id="channelMessages">' +
      '<div class="loading-center"><div class="spinner"></div></div>' +
    '</div>' +
    '<div class="chat-input-wrap">' +
      '<textarea class="form-input" id="channelInput" rows="1" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();App.sendChannelMsg(\'' + escHtml(channelId) + '\')}" oninput="autoGrow(this)"></textarea>' +
      '<button class="chat-send-btn" onclick="App.sendChannelMsg(\'' + escHtml(channelId) + '\')" aria-label="Send message">' + SVG.send + '</button>' +
    '</div>' +
  '</div>';

  API.get('/api/messenger/channels/' + channelId + '/messages').then(function(data) {
    var messages = data.messages || data || [];
    var container = document.getElementById('channelMessages');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding-top:60px"><p class="empty-state-text">No messages yet. Start the conversation!</p></div>';
      return;
    }

    var user = AppState.user || {};
    var html = '';
    messages.forEach(function(m) {
      var isMine = (m.sender === user.name || m.senderId === user.id);
      html += '<div class="chat-bubble ' + (isMine ? 'sent' : 'received') + '">' +
        (!isMine ? '<div style="font-size:11px;font-weight:600;margin-bottom:2px;opacity:0.7">' + escHtml(m.sender || 'Unknown') + '</div>' : '') +
        escHtml(m.text || m.content || '') +
        '<div class="chat-time">' + formatTime(m.createdAt || m.timestamp) + '</div>' +
      '</div>';
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }).catch(function() {
    var container = document.getElementById('channelMessages');
    if (container) container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Could not load messages.</p></div>';
  });
};

App.sendChannelMsg = function(channelId) {
  var input = document.getElementById('channelInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  autoGrow(input);

  var container = document.getElementById('channelMessages');
  if (container) {
    container.innerHTML += '<div class="chat-bubble sent">' + escHtml(text) + '</div>';
    container.scrollTop = container.scrollHeight;
  }

  API.post('/api/messenger/channels/' + channelId + '/messages', { text: text }).catch(function() {
    showToast('Message failed to send', 'error');
  });
};

// ── Profile Actions ──
App.toggleDarkMode = function(enabled) {
  localStorage.setItem('sw_dark_mode', enabled ? 'true' : 'false');
  if (enabled) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
};

App.toggleNotifications = function(enabled) {
  if (enabled && 'Notification' in window) {
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        showToast('Notifications enabled', 'success');
      } else {
        showToast('Notification permission denied', 'error');
      }
    });
  }
};

// ── Init: Apply dark mode if saved ──
(function() {
  if (localStorage.getItem('sw_dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  // Load user from localStorage
  if (AppState.user && API.getToken()) {
    API.get('/api/sw/me').then(function(data) {
      if (data.user) {
        AppState.user = data.user;
        localStorage.setItem('sw_user', JSON.stringify(data.user));
      }
    }).catch(function() {});
  }
})();
