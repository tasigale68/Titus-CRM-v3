#!/usr/bin/env node
// ============================================================================
// Titus CRM — Seed Demo Tenant (Horizon Care Services)
// Run: node scripts/seed-demo-tenant.js
// Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in .env or environment
// ============================================================================

require('dotenv').config();

var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
var SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// ─── Supabase helpers ──────────────────────────────────────────────

function sbFetch(path, method, body, headers) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var opts = {
    method: method || 'GET',
    headers: Object.assign({
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'GET' ? 'count=exact' : 'return=representation'
    }, headers || {})
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error(method + ' ' + path + ' ' + r.status + ': ' + t.substring(0, 500)); });
    if (r.status === 204) return [];
    return r.json();
  });
}

function insert(table, data) {
  return sbFetch(table, 'POST', Array.isArray(data) ? data : [data]);
}

function upsert(table, data) {
  return sbFetch(table, 'POST', Array.isArray(data) ? data : [data], {
    'Prefer': 'return=representation,resolution=merge-duplicates'
  });
}

function query(table, params) {
  var parts = [];
  if (params) {
    if (params.select) parts.push('select=' + encodeURIComponent(params.select));
    if (params.eq) {
      Object.keys(params.eq).forEach(function(k) {
        parts.push(k + '=eq.' + encodeURIComponent(params.eq[k]));
      });
    }
    if (params.limit) parts.push('limit=' + params.limit);
  }
  var qs = parts.length ? '?' + parts.join('&') : '';
  return sbFetch(table + qs, 'GET');
}

// ─── UUID helper ───────────────────────────────────────────────────

var crypto = require('crypto');
function uuid() {
  return crypto.randomUUID();
}

// ─── Date helpers ──────────────────────────────────────────────────

function today() { return new Date(); }
function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isoDate(d) { return d.toISOString().split('T')[0]; }
function isoDateTime(d) { return d.toISOString(); }
function setTime(d, h, m) {
  var r = new Date(d);
  r.setHours(h, m || 0, 0, 0);
  return r;
}

// ============================================================================
// MAIN SEED
// ============================================================================

async function main() {
  console.log('=== Seeding Demo Tenant: Horizon Care Services ===\n');

  // ─── 3a: Demo Tenant ──────────────────────────────────────────

  var tenantId = uuid();

  // Check if demo tenant already exists
  var existing = await query('tenants', { eq: { slug: 'demo' }, limit: 1 });
  if (existing && existing.length) {
    tenantId = existing[0].id;
    console.log('Demo tenant already exists: ' + tenantId);
  } else {
    var tenantRows = await insert('tenants', {
      id: tenantId,
      org_name: 'Horizon Care Services',
      slug: 'demo',
      domain: 'demo.tituscrm.com',
      admin_email: 'director@demo.tituscrm.com',
      status: 'active',
      enabled_modules: JSON.stringify([
        'recruiter', 'leads', 'voice_sms', 'ai_voice', 'client_management',
        'billing', 'lms', 'ai_reports', 'employment_signing', 'stakeholder_portal'
      ]),
      base_tier: '11-30',
      weekly_price_total: 599.00,
      max_users: 50,
      max_clients: 200,
      primary_colour: '#0d9488',
      secondary_colour: '#0f172a'
    });
    tenantId = tenantRows[0].id;
    console.log('Created demo tenant: ' + tenantId);
  }

  // ─── 3b: Tenant Users ─────────────────────────────────────────

  var SALT = 'titus-salt-2026';
  function hashPassword(pw) {
    return crypto.createHash('sha256').update(pw + SALT).digest('hex');
  }

  var demoPassword = hashPassword('TitusDemo2026!');
  var tenantUsers = [
    { id: uuid(), tenant_id: tenantId, email: 'director@demo.tituscrm.com', name: 'Sarah Mitchell', role: 'director', password_hash: demoPassword, created_at: new Date().toISOString() },
    { id: uuid(), tenant_id: tenantId, email: 'teamlead@demo.tituscrm.com', name: 'James Cooper', role: 'team_leader', password_hash: demoPassword, created_at: new Date().toISOString() },
    { id: uuid(), tenant_id: tenantId, email: 'roster@demo.tituscrm.com', name: 'Emily Nguyen', role: 'roster_officer', password_hash: demoPassword, created_at: new Date().toISOString() },
    { id: uuid(), tenant_id: tenantId, email: 'worker@demo.tituscrm.com', name: 'Ben Taylor', role: 'support_worker', password_hash: demoPassword, created_at: new Date().toISOString() }
  ];

  // Delete existing tenant_users for this tenant to avoid duplicates
  await sbFetch('tenant_users?tenant_id=eq.' + tenantId, 'DELETE');
  await insert('tenant_users', tenantUsers);
  console.log('Seeded 4 tenant_users');

  // ─── 3c: Contacts (15 staff) ──────────────────────────────────

  // Delete existing contacts for this tenant
  await sbFetch('contacts?tenant_id=eq.' + tenantId, 'DELETE');

  var officeStaff = [
    { full_name: 'Sarah Mitchell', first_name: 'Sarah', last_name: 'Mitchell', email: 'director@demo.tituscrm.com', phone: '0412 345 678', suburb: 'Southport', type_of_contact: 'Office Staff', type_of_employment: 'Full Time', job_title: 'Director', department: 'Management', status: 'Active' },
    { full_name: 'James Cooper', first_name: 'James', last_name: 'Cooper', email: 'teamlead@demo.tituscrm.com', phone: '0413 456 789', suburb: 'Broadbeach', type_of_contact: 'Office Staff', type_of_employment: 'Full Time', job_title: 'Team Leader', department: 'Operations', status: 'Active' },
    { full_name: 'Emily Nguyen', first_name: 'Emily', last_name: 'Nguyen', email: 'roster@demo.tituscrm.com', phone: '0414 567 890', suburb: 'Robina', type_of_contact: 'Office Staff', type_of_employment: 'Full Time', job_title: 'Roster Officer', department: 'Operations', status: 'Active' }
  ];

  var supportWorkers = [
    { full_name: 'Liam O\'Brien', first_name: 'Liam', last_name: 'O\'Brien', email: 'liam.obrien@example.com', phone: '0421 111 222', suburb: 'Nerang', type_of_employment: 'Full Time' },
    { full_name: 'Mia Thompson', first_name: 'Mia', last_name: 'Thompson', email: 'mia.thompson@example.com', phone: '0422 222 333', suburb: 'Coomera', type_of_employment: 'Full Time' },
    { full_name: 'Jack Wilson', first_name: 'Jack', last_name: 'Wilson', email: 'jack.wilson@example.com', phone: '0423 333 444', suburb: 'Helensvale', type_of_employment: 'Full Time' },
    { full_name: 'Sophie Chen', first_name: 'Sophie', last_name: 'Chen', email: 'sophie.chen@example.com', phone: '0424 444 555', suburb: 'Southport', type_of_employment: 'Part Time' },
    { full_name: 'Noah Patel', first_name: 'Noah', last_name: 'Patel', email: 'noah.patel@example.com', phone: '0425 555 666', suburb: 'Bundall', type_of_employment: 'Part Time' },
    { full_name: 'Olivia Jones', first_name: 'Olivia', last_name: 'Jones', email: 'olivia.jones@example.com', phone: '0426 666 777', suburb: 'Mermaid Beach', type_of_employment: 'Casual' },
    { full_name: 'Ethan Brown', first_name: 'Ethan', last_name: 'Brown', email: 'ethan.brown@example.com', phone: '0427 777 888', suburb: 'Burleigh Heads', type_of_employment: 'Casual' },
    { full_name: 'Ava Williams', first_name: 'Ava', last_name: 'Williams', email: 'ava.williams@example.com', phone: '0428 888 999', suburb: 'Mudgeeraba', type_of_employment: 'Full Time' },
    { full_name: 'Lucas Martinez', first_name: 'Lucas', last_name: 'Martinez', email: 'lucas.martinez@example.com', phone: '0429 999 000', suburb: 'Oxenford', type_of_employment: 'Part Time' },
    { full_name: 'Chloe Davis', first_name: 'Chloe', last_name: 'Davis', email: 'chloe.davis@example.com', phone: '0430 111 222', suburb: 'Pacific Pines', type_of_employment: 'Full Time' },
    { full_name: 'Ben Taylor', first_name: 'Ben', last_name: 'Taylor', email: 'worker@demo.tituscrm.com', phone: '0431 222 333', suburb: 'Labrador', type_of_employment: 'Full Time' },
    { full_name: 'Isabella Nguyen', first_name: 'Isabella', last_name: 'Nguyen', email: 'isabella.nguyen@example.com', phone: '0432 333 444', suburb: 'Ashmore', type_of_employment: 'Casual' }
  ];

  var contactIds = {};
  var allContacts = [];

  officeStaff.forEach(function(c) {
    var id = uuid();
    contactIds[c.email] = id;
    allContacts.push(Object.assign({ id: id, tenant_id: tenantId, state: 'QLD', postcode: '4215' }, c));
  });

  supportWorkers.forEach(function(c) {
    var id = uuid();
    contactIds[c.email] = id;
    allContacts.push(Object.assign({
      id: id, tenant_id: tenantId, type_of_contact: 'Support Worker',
      job_title: 'Support Worker', department: 'Support', status: 'Active',
      state: 'QLD', postcode: '4215'
    }, c));
  });

  await insert('contacts', allContacts);
  console.log('Seeded ' + allContacts.length + ' contacts');

  // ─── 3d: Clients (8 NDIS participants) ────────────────────────

  await sbFetch('clients?tenant_id=eq.' + tenantId, 'DELETE');

  var clientDefs = [
    { client_name: 'Ryan Peters', first_name: 'Ryan', last_name: 'Peters', ndis_number: '431 234 5678', suburb: 'Southport', sil_or_cas: 'SIL', type_of_disability: 'Intellectual Disability', gender: 'Male', dob: '1992-03-15' },
    { client_name: 'Aisha Khan', first_name: 'Aisha', last_name: 'Khan', ndis_number: '431 345 6789', suburb: 'Southport', sil_or_cas: 'SIL', type_of_disability: 'Autism Spectrum Disorder', gender: 'Female', dob: '1998-07-22' },
    { client_name: 'Daniel Russo', first_name: 'Daniel', last_name: 'Russo', ndis_number: '431 456 7890', suburb: 'Southport', sil_or_cas: 'SIL', type_of_disability: 'Acquired Brain Injury', gender: 'Male', dob: '1985-11-08' },
    { client_name: 'Lily Chen', first_name: 'Lily', last_name: 'Chen', ndis_number: '431 567 8901', suburb: 'Helensvale', sil_or_cas: 'SIL', type_of_disability: 'Cerebral Palsy', gender: 'Female', dob: '2000-01-30' },
    { client_name: 'Tom McKenzie', first_name: 'Tom', last_name: 'McKenzie', ndis_number: '431 678 9012', suburb: 'Helensvale', sil_or_cas: 'SIL', type_of_disability: 'Down Syndrome', gender: 'Male', dob: '1995-05-12' },
    { client_name: 'Maya Singh', first_name: 'Maya', last_name: 'Singh', ndis_number: '431 789 0123', suburb: 'Robina', sil_or_cas: 'CAS', type_of_disability: 'Physical Disability', gender: 'Female', dob: '1990-09-25' },
    { client_name: 'Jake Anderson', first_name: 'Jake', last_name: 'Anderson', ndis_number: '431 890 1234', suburb: 'Burleigh Heads', sil_or_cas: 'CAS', type_of_disability: 'Autism Spectrum Disorder', gender: 'Male', dob: '2001-04-18' },
    { client_name: 'Priya Sharma', first_name: 'Priya', last_name: 'Sharma', ndis_number: '431 901 2345', suburb: 'Mermaid Beach', sil_or_cas: 'CAS', type_of_disability: 'Psychosocial Disability', gender: 'Female', dob: '1988-12-03' }
  ];

  var clientIds = {};
  var allClients = clientDefs.map(function(c) {
    var id = uuid();
    clientIds[c.client_name] = id;
    return {
      id: id,
      tenant_id: tenantId,
      client_name: c.client_name,
      full_name: c.client_name,
      first_name: c.first_name,
      last_name: c.last_name,
      ndis_number: c.ndis_number,
      suburb: c.suburb,
      state: 'QLD',
      postcode: '4215',
      sil_or_cas: c.sil_or_cas,
      account_type: 'Active',
      type_of_disability: c.type_of_disability,
      gender: c.gender,
      date_of_birth: c.dob,
      address: Math.floor(Math.random() * 80 + 10) + ' ' + ['Gold Coast Hwy', 'Ferry Rd', 'Olsen Ave', 'Nerang St', 'Wardoo St', 'Christine Ave', 'Bermuda St', 'Ashmore Rd'][Math.floor(Math.random() * 8)] + ', ' + c.suburb + ' QLD 4215',
      emergency_contact: ['Maria Peters', 'Fatima Khan', 'Angela Russo', 'Wei Chen', 'Karen McKenzie', 'Raj Singh', 'Sue Anderson', 'Deepak Sharma'][clientDefs.indexOf(c)],
      emergency_phone: '04' + String(30 + clientDefs.indexOf(c)) + ' ' + String(100 + clientDefs.indexOf(c) * 111) + ' ' + String(200 + clientDefs.indexOf(c) * 111),
      plan_manager: ['Plan Partners QLD', 'My Plan Manager', 'Maple Plan Management', 'Plan Partners QLD', 'My Plan Manager', 'National Plan Managers', 'Plan Partners QLD', 'Maple Plan Management'][clientDefs.indexOf(c)],
      plan_manager_email: 'admin@planpartners.example.com',
      support_coordinator: ['SC Connect GC', 'Allied Support Coordination', 'SC Connect GC', 'Coast SC Services', 'Allied Support Coordination', 'SC Connect GC', 'Coast SC Services', 'Allied Support Coordination'][clientDefs.indexOf(c)],
      support_coordinator_email: 'info@scconnect.example.com',
      ndis_goals: ['Increase independence in daily living tasks', 'Develop social skills and community connections', 'Improve mobility and physical health', 'Build communication and life skills', 'Achieve greater community participation', 'Maintain fitness and social engagement', 'Develop employment readiness skills', 'Manage mental health and build resilience'][clientDefs.indexOf(c)],
      ndis_plan_type: 'Agency Managed',
      ndis_plan_start_date: isoDate(addDays(today(), -180)),
      ndis_plan_expiry_date: isoDate(addDays(today(), 185))
    };
  });

  await insert('clients', allClients);
  console.log('Seeded ' + allClients.length + ' clients');

  // ─── 3e: SIL Properties (2 houses) ────────────────────────────

  await sbFetch('sil_properties?tenant_id=eq.' + tenantId, 'DELETE');

  var prop1Id = uuid();
  var prop2Id = uuid();
  var silProperties = [
    {
      id: prop1Id, tenant_id: tenantId,
      name: 'Horizon House Southport',
      suburb: 'Southport',
      address: '42 Marine Parade, Southport QLD 4215',
      status: 'Active',
      description: '4-bedroom SIL home with full accessibility modifications',
      property_type: 'House',
      total_rooms: 4,
      vacancies: 0,
      has_vacancy: 'No',
      type_of_accom: 'SIL',
      bathrooms: 2,
      weekly_rent: 280.00,
      notes: 'Fully wheelchair accessible. Hoists in 2 bedrooms. Close to Southport CBD and light rail.'
    },
    {
      id: prop2Id, tenant_id: tenantId,
      name: 'Horizon House Helensvale',
      suburb: 'Helensvale',
      address: '18 Discovery Drive, Helensvale QLD 4212',
      status: 'Active',
      description: '3-bedroom SIL home in quiet residential area',
      property_type: 'House',
      total_rooms: 3,
      vacancies: 1,
      has_vacancy: 'Yes',
      type_of_accom: 'SIL',
      bathrooms: 2,
      weekly_rent: 250.00,
      notes: 'Near Helensvale train station. Level access throughout. Sensory room available.'
    }
  ];

  await insert('sil_properties', silProperties);
  console.log('Seeded 2 SIL properties');

  // ─── 3f: Rosters (shifts over 2 weeks) ────────────────────────

  await sbFetch('rosters?tenant_id=eq.' + tenantId, 'DELETE');

  var now = today();
  var twoWeeksAgo = addDays(now, -14);
  var workers = [
    { name: 'Liam O\'Brien', email: 'liam.obrien@example.com' },
    { name: 'Mia Thompson', email: 'mia.thompson@example.com' },
    { name: 'Jack Wilson', email: 'jack.wilson@example.com' },
    { name: 'Sophie Chen', email: 'sophie.chen@example.com' },
    { name: 'Noah Patel', email: 'noah.patel@example.com' },
    { name: 'Olivia Jones', email: 'olivia.jones@example.com' },
    { name: 'Ethan Brown', email: 'ethan.brown@example.com' },
    { name: 'Ava Williams', email: 'ava.williams@example.com' },
    { name: 'Ben Taylor', email: 'worker@demo.tituscrm.com' },
    { name: 'Chloe Davis', email: 'chloe.davis@example.com' }
  ];

  // SIL clients: Ryan, Aisha, Daniel at Southport; Lily, Tom at Helensvale
  var silSouthport = ['Ryan Peters', 'Aisha Khan', 'Daniel Russo'];
  var silHelensvale = ['Lily Chen', 'Tom McKenzie'];
  var casClients = ['Maya Singh', 'Jake Anderson', 'Priya Sharma'];

  var shifts = [];
  var shiftIdMap = {}; // For linking progress notes

  // SIL shifts: AM (6:00-14:00), PM (14:00-22:00), Night (22:00-6:00)
  var silShiftTypes = [
    { label: 'AM', startH: 6, endH: 14 },
    { label: 'PM', startH: 14, endH: 22 },
    { label: 'Night', startH: 22, endH: 6 }
  ];

  var ndisLineItems = {
    SIL: { item: '01_011_0107_1_1', desc: 'Assistance with Daily Life - SIL', rate: 65.47 },
    SIL_NIGHT: { item: '01_011_0107_1_1', desc: 'Assistance with Daily Life - SIL (Night)', rate: 72.89 },
    CAS: { item: '04_104_0125_6_1', desc: 'Community Access - Group', rate: 62.17 },
    TRANSPORT: { item: '02_051_0108_1_1', desc: 'Transport', rate: 0.97 }
  };

  // Generate SIL shifts for 14 days
  for (var day = 0; day < 14; day++) {
    var shiftDate = addDays(twoWeeksAgo, day);
    var isPast = shiftDate < now;
    var dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][shiftDate.getDay()];
    var dayType = (shiftDate.getDay() === 0) ? 'Sunday' : (shiftDate.getDay() === 6) ? 'Saturday' : 'Weekday';

    // Southport house — 1 worker per shift
    silShiftTypes.forEach(function(st, stIdx) {
      var w = workers[(day * 3 + stIdx) % workers.length];
      var startDt = setTime(shiftDate, st.startH);
      var endDt = st.label === 'Night' ? setTime(addDays(shiftDate, 1), st.endH) : setTime(shiftDate, st.endH);
      var hours = 8;
      var lineItem = st.label === 'Night' ? ndisLineItems.SIL_NIGHT : ndisLineItems.SIL;
      var shiftId = uuid();

      // One roster entry per SIL client at this house
      silSouthport.forEach(function(clientName) {
        var sid = uuid();
        if (isPast) shiftIdMap[sid] = { client: clientName, worker: w.name, date: shiftDate };
        shifts.push({
          id: sid,
          tenant_id: tenantId,
          client_id: clientIds[clientName],
          client_name: clientName,
          worker_id: contactIds[w.email],
          worker_name: w.name,
          worker_email: w.email,
          staff_name: w.name,
          staff_email: w.email,
          start_shift: isoDateTime(startDt),
          end_shift: isoDateTime(endDt),
          shift_type: 'Active',
          type_of_shift: 'Active',
          day_type: dayType,
          total_hours: hours,
          total_hours_decimal: hours,
          base_rate: lineItem.rate,
          penalty_multiplier: dayType === 'Sunday' ? 2.0 : dayType === 'Saturday' ? 1.5 : 1.0,
          shift_cost: (lineItem.rate * hours * (dayType === 'Sunday' ? 2.0 : dayType === 'Saturday' ? 1.5 : 1.0)).toFixed(2),
          ndis_line_item: lineItem.item,
          ndis_unit_price: lineItem.rate,
          ndis_total: (lineItem.rate * hours).toFixed(2),
          status: isPast ? 'Completed' : 'Scheduled',
          shift_status: isPast ? 'Completed' : 'Scheduled',
          sil_or_cas: 'SIL',
          support_item_name: lineItem.desc,
          charge_per_hour: lineItem.rate
        });
      });
    });

    // Helensvale house — 1 worker per shift (AM + PM only, night is sleepover)
    [silShiftTypes[0], silShiftTypes[1]].forEach(function(st, stIdx) {
      var w = workers[(day * 2 + stIdx + 5) % workers.length];
      var startDt = setTime(shiftDate, st.startH);
      var endDt = setTime(shiftDate, st.endH);
      var hours = 8;
      var lineItem = ndisLineItems.SIL;

      silHelensvale.forEach(function(clientName) {
        var sid = uuid();
        if (isPast) shiftIdMap[sid] = { client: clientName, worker: w.name, date: shiftDate };
        shifts.push({
          id: sid,
          tenant_id: tenantId,
          client_id: clientIds[clientName],
          client_name: clientName,
          worker_id: contactIds[w.email],
          worker_name: w.name,
          worker_email: w.email,
          staff_name: w.name,
          staff_email: w.email,
          start_shift: isoDateTime(startDt),
          end_shift: isoDateTime(endDt),
          shift_type: 'Active',
          type_of_shift: 'Active',
          day_type: dayType,
          total_hours: hours,
          total_hours_decimal: hours,
          base_rate: lineItem.rate,
          penalty_multiplier: dayType === 'Sunday' ? 2.0 : dayType === 'Saturday' ? 1.5 : 1.0,
          shift_cost: (lineItem.rate * hours * (dayType === 'Sunday' ? 2.0 : dayType === 'Saturday' ? 1.5 : 1.0)).toFixed(2),
          ndis_line_item: lineItem.item,
          ndis_unit_price: lineItem.rate,
          ndis_total: (lineItem.rate * hours).toFixed(2),
          status: isPast ? 'Completed' : 'Scheduled',
          shift_status: isPast ? 'Completed' : 'Scheduled',
          sil_or_cas: 'SIL',
          support_item_name: lineItem.desc,
          charge_per_hour: lineItem.rate
        });
      });
    });

    // CAS shifts: 3-4 hours, weekdays only
    if (shiftDate.getDay() >= 1 && shiftDate.getDay() <= 5) {
      casClients.forEach(function(clientName, ci) {
        var w = workers[(day + ci + 3) % workers.length];
        var startH = 9 + ci * 2;
        var hours = 3 + (ci % 2);
        var startDt = setTime(shiftDate, startH);
        var endDt = setTime(shiftDate, startH + hours);
        var lineItem = ndisLineItems.CAS;
        var sid = uuid();
        if (isPast) shiftIdMap[sid] = { client: clientName, worker: w.name, date: shiftDate };

        shifts.push({
          id: sid,
          tenant_id: tenantId,
          client_id: clientIds[clientName],
          client_name: clientName,
          worker_id: contactIds[w.email],
          worker_name: w.name,
          worker_email: w.email,
          staff_name: w.name,
          staff_email: w.email,
          start_shift: isoDateTime(startDt),
          end_shift: isoDateTime(endDt),
          shift_type: 'Active',
          type_of_shift: 'Active',
          day_type: 'Weekday',
          total_hours: hours,
          total_hours_decimal: hours,
          base_rate: lineItem.rate,
          penalty_multiplier: 1.0,
          shift_cost: (lineItem.rate * hours).toFixed(2),
          ndis_line_item: lineItem.item,
          ndis_unit_price: lineItem.rate,
          ndis_total: (lineItem.rate * hours).toFixed(2),
          status: isPast ? 'Completed' : 'Scheduled',
          shift_status: isPast ? 'Completed' : 'Scheduled',
          sil_or_cas: 'CAS',
          support_item_name: lineItem.desc,
          charge_per_hour: lineItem.rate
        });
      });
    }
  }

  // Insert shifts in batches of 50 (PostgREST limit)
  for (var i = 0; i < shifts.length; i += 50) {
    await insert('rosters', shifts.slice(i, i + 50));
  }
  console.log('Seeded ' + shifts.length + ' roster entries');

  // ─── 3g: Client Budgets ───────────────────────────────────────

  await sbFetch('client_budgets?tenant_id=eq.' + tenantId, 'DELETE');

  var planStart = isoDate(addDays(today(), -180));
  var planEnd = isoDate(addDays(today(), 185));
  var budgets = [];

  // SIL clients: $180K-280K core
  var silBudgetAmounts = [245000, 198000, 280000, 210000, 225000];
  var silUsedPct = [0.52, 0.45, 0.58, 0.40, 0.48];
  var silClientNames = silSouthport.concat(silHelensvale);

  silClientNames.forEach(function(name, idx) {
    var amt = silBudgetAmounts[idx];
    var used = Math.round(amt * silUsedPct[idx]);
    budgets.push({
      id: uuid(),
      tenant_id: tenantId,
      client_id: clientIds[name],
      plan_start_date: planStart,
      plan_end_date: planEnd,
      plan_type: 'Agency Managed',
      total_funding: amt,
      support_category: 'Core - Daily Activities',
      ndis_line_item: '01_011_0107_1_1',
      allocated_amount: amt,
      spent_amount: used,
      committed_amount: Math.round(amt * 0.1),
      remaining_amount: amt - used - Math.round(amt * 0.1),
      utilisation_pct: (silUsedPct[idx] * 100).toFixed(1)
    });
    // Transport budget for SIL clients
    var transport = 2000 + idx * 700;
    budgets.push({
      id: uuid(),
      tenant_id: tenantId,
      client_id: clientIds[name],
      plan_start_date: planStart,
      plan_end_date: planEnd,
      plan_type: 'Agency Managed',
      total_funding: transport,
      support_category: 'Core - Transport',
      ndis_line_item: '02_051_0108_1_1',
      allocated_amount: transport,
      spent_amount: Math.round(transport * 0.35),
      committed_amount: 0,
      remaining_amount: transport - Math.round(transport * 0.35),
      utilisation_pct: '35.0'
    });
  });

  // CAS clients: $15K-45K community access
  var casBudgetAmounts = [38000, 22000, 45000];
  var casUsedPct = [0.42, 0.30, 0.50];

  casClients.forEach(function(name, idx) {
    var amt = casBudgetAmounts[idx];
    var used = Math.round(amt * casUsedPct[idx]);
    budgets.push({
      id: uuid(),
      tenant_id: tenantId,
      client_id: clientIds[name],
      plan_start_date: planStart,
      plan_end_date: planEnd,
      plan_type: 'Agency Managed',
      total_funding: amt,
      support_category: 'Core - Community Access',
      ndis_line_item: '04_104_0125_6_1',
      allocated_amount: amt,
      spent_amount: used,
      committed_amount: Math.round(amt * 0.08),
      remaining_amount: amt - used - Math.round(amt * 0.08),
      utilisation_pct: (casUsedPct[idx] * 100).toFixed(1)
    });
    // Transport budget for CAS clients
    var transport = 3000 + idx * 1000;
    budgets.push({
      id: uuid(),
      tenant_id: tenantId,
      client_id: clientIds[name],
      plan_start_date: planStart,
      plan_end_date: planEnd,
      plan_type: 'Agency Managed',
      total_funding: transport,
      support_category: 'Core - Transport',
      ndis_line_item: '02_051_0108_1_1',
      allocated_amount: transport,
      spent_amount: Math.round(transport * 0.40),
      committed_amount: 0,
      remaining_amount: transport - Math.round(transport * 0.40),
      utilisation_pct: '40.0'
    });
  });

  await insert('client_budgets', budgets);
  console.log('Seeded ' + budgets.length + ' client budgets');

  // ─── 3h: Progress Notes (20 for completed shifts) ─────────────

  await sbFetch('progress_notes?tenant_id=eq.' + tenantId, 'DELETE');

  var completedShiftIds = Object.keys(shiftIdMap);
  var noteTemplates = [
    '{client} had a positive day. Engaged well in morning routine including showering, dressing, and breakfast preparation with minimal prompting. Participated in house activities during the afternoon.',
    'Supported {client} with community access outing to local shopping centre. Practised money handling skills and social interaction. Client appeared relaxed and happy throughout.',
    '{client} required some additional support today due to low mood. Encouraged participation in preferred activities (music, gardening). Mood improved by end of shift.',
    'Assisted {client} with meal preparation — client chose to make pasta for dinner. Practised kitchen safety and following recipe steps. Good progress with knife skills.',
    'Morning routine completed independently by {client} with standby supervision only. Afternoon spent at the park for exercise and fresh air. No incidents to report.',
    '{client} attended medical appointment at Gold Coast University Hospital. Transport provided. Doctor pleased with progress. Medication review completed.',
    'Supported {client} with personal care and daily living tasks. Client expressed interest in learning to do laundry independently — set up a goal around this.',
    'Group outing to Broadbeach markets with {client} and housemates. Client managed well in busy environment. Practised communication skills when purchasing items.',
    '{client} had a great session at the gym. Completed 30 minutes on treadmill and light weights with support. Building confidence with exercise routine.',
    'Quiet day for {client}. Spent time on preferred activities including watching movies and puzzles. Assisted with lunch preparation and medication administration.',
    '{client} practised public transport skills — caught the light rail to Southport with support. Increasing confidence with tapping on/off and reading timetables.',
    'Supported {client} with cleaning bedroom and shared living spaces. Client took initiative to vacuum without prompting. Positive behaviour reinforcement provided.',
    '{client} participated in cooking group at the house. Made banana bread with minimal assistance. Shared with housemates — great social interaction observed.',
    'Community access to Robina Town Centre with {client}. Practised navigating the centre independently. Client successfully ordered coffee at cafe without assistance.',
    'Assisted {client} with grocery shopping. Used a picture list to identify items. Client managed trolley and placed items on conveyor at checkout independently.',
    '{client} attended swimming session at Southport Aquatic Centre. Good engagement with hydrotherapy exercises. Client reported feeling relaxed afterwards.',
    'Morning shift — supported {client} with breakfast and medication. Client had a phone call with family and was in good spirits. No concerns to report.',
    'Supported {client} with art therapy session at community centre. Client produced a painting and appeared very proud of the result. Excellent engagement.',
    '{client} had a busy day — medical appointment in the morning, community access in the afternoon. Managed transitions well with visual schedule support.',
    'Overnight was settled. {client} slept well with no disturbances. Morning routine completed smoothly. Good appetite at breakfast.'
  ];

  var notes = [];
  var selectedShifts = completedShiftIds.slice(0, 20);
  selectedShifts.forEach(function(shiftId, idx) {
    var shift = shiftIdMap[shiftId];
    var template = noteTemplates[idx % noteTemplates.length];
    notes.push({
      id: uuid(),
      tenant_id: tenantId,
      support_worker_name: shift.worker,
      client_name: shift.client,
      client_id: clientIds[shift.client],
      roster_id: shiftId,
      start_datetime: isoDateTime(setTime(shift.date, 6)),
      end_datetime: isoDateTime(setTime(shift.date, 14)),
      notes_summary: template.replace(/\{client\}/g, shift.client.split(' ')[0]),
      total_hours: '8'
    });
  });

  if (notes.length > 0) {
    await insert('progress_notes', notes);
  }
  console.log('Seeded ' + notes.length + ' progress notes');

  // ─── 3i: Leads (4 sample leads) ───────────────────────────────

  await sbFetch('leads?tenant_id=eq.' + tenantId, 'DELETE');

  var leads = [
    {
      id: uuid(), tenant_id: tenantId,
      lead_name: 'Sarah Watson', full_name: 'Sarah Watson', first_name: 'Sarah', last_name: 'Watson',
      email: 'sarah.watson@example.com', phone: '0435 111 222',
      source: 'Website Enquiry', stage: 'Enquiry', status: 'New',
      date: isoDate(addDays(today(), -3)),
      suburb: 'Southport', disability_type: 'Intellectual Disability',
      ndis_number: '431 222 3333', service_type: 'SIL', sil_or_cas: 'SIL',
      notes: 'Mother enquiring on behalf of son (25yo). Currently living at home but family seeking SIL placement. Has existing NDIS plan.',
      sc_name: 'Karen Phillips', sc_email: 'karen@scconnect.example.com', sc_mobile: '0444 555 666'
    },
    {
      id: uuid(), tenant_id: tenantId,
      lead_name: 'Mohammed Ali', full_name: 'Mohammed Ali', first_name: 'Mohammed', last_name: 'Ali',
      email: 'mali@example.com', phone: '0436 222 333',
      source: 'Support Coordinator Referral', stage: 'Assessment', status: 'Active',
      date: isoDate(addDays(today(), -10)),
      suburb: 'Nerang', disability_type: 'Autism Spectrum Disorder',
      ndis_number: '431 333 4444', service_type: 'CAS', sil_or_cas: 'CAS',
      notes: 'SC referred for community access supports 3x per week. Interested in social groups and gym programs. Initial assessment completed.',
      sc_name: 'David Lee', sc_email: 'david@alliedsc.example.com', sc_mobile: '0444 666 777'
    },
    {
      id: uuid(), tenant_id: tenantId,
      lead_name: 'Emma Richardson', full_name: 'Emma Richardson', first_name: 'Emma', last_name: 'Richardson',
      email: 'emma.r@example.com', phone: '0437 333 444',
      source: 'NDIS Provider Search', stage: 'Intake', status: 'Active',
      date: isoDate(addDays(today(), -21)),
      suburb: 'Helensvale', disability_type: 'Physical Disability',
      ndis_number: '431 444 5555', service_type: 'SIL', sil_or_cas: 'SIL',
      notes: 'Transitioning from another provider. Currently in SIL. Service agreement being drafted. Start date TBC pending vacancy at Helensvale house.',
      sc_name: 'Karen Phillips', sc_email: 'karen@scconnect.example.com', sc_mobile: '0444 555 666'
    },
    {
      id: uuid(), tenant_id: tenantId,
      lead_name: 'Chris Oakley', full_name: 'Chris Oakley', first_name: 'Chris', last_name: 'Oakley',
      email: 'coakley@example.com', phone: '0438 444 555',
      source: 'Phone Enquiry', stage: 'Closed', status: 'Closed - No Capacity',
      date: isoDate(addDays(today(), -45)),
      suburb: 'Palm Beach', disability_type: 'Acquired Brain Injury',
      ndis_number: '431 555 6666', service_type: 'SIL', sil_or_cas: 'SIL',
      notes: 'Enquired about SIL vacancy. No current capacity in preferred area (southern Gold Coast). Referred to alternative provider. May revisit when Helensvale vacancy opens.'
    }
  ];

  await insert('leads', leads);
  console.log('Seeded ' + leads.length + ' leads');

  // ─── Done ──────────────────────────────────────────────────────

  console.log('\n=== Demo seed complete! ===');
  console.log('Tenant ID: ' + tenantId);
  console.log('Login at: https://demo.tituscrm.com');
  console.log('  director@demo.tituscrm.com / TitusDemo2026!');
  console.log('  teamlead@demo.tituscrm.com / TitusDemo2026!');
  console.log('  roster@demo.tituscrm.com   / TitusDemo2026!');
  console.log('  worker@demo.tituscrm.com   / TitusDemo2026!');
}

main().catch(function(err) {
  console.error('Seed failed:', err);
  process.exit(1);
});
