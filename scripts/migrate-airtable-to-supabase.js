#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Titus CRM — Airtable → Supabase Initial Data Migration
// Run: node scripts/migrate-airtable-to-supabase.js
//
// Requirements:
//   - Node 18+ (uses built-in fetch)
//   - .env with AIRTABLE_API_KEY, AIRTABLE_BASE_ID,
//     SUPABASE_URL, SUPABASE_SERVICE_KEY
//
// Features:
//   - Reads ALL records from every Airtable table
//   - Maps Airtable field names → Supabase snake_case columns
//   - Inserts via PostgREST API in batches of 100
//   - Stores Airtable record ID in airtable_id column
//   - Stores unmapped fields in data JSONB column
//   - Logs progress per record
//   - Logs errors without stopping
//   - Outputs summary at the end
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();

var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
var SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
var AIRTABLE_API_KEY = (process.env.AIRTABLE_API_KEY || '').trim();
var AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg3Cz7mEsGA6IOI';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!AIRTABLE_API_KEY) {
  console.error('Missing AIRTABLE_API_KEY');
  process.exit(1);
}

var AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID;
var SUPABASE_REST_URL = SUPABASE_URL + '/rest/v1';
var RATE_LIMIT_MS = 260; // Airtable: 5 req/sec
var BATCH_SIZE = 100;
var lastReqTime = 0;

// ─── Airtable helpers ────────────────────────────────────────
function rateLimit() {
  var now = Date.now();
  var wait = RATE_LIMIT_MS - (now - lastReqTime);
  if (wait > 0) return new Promise(function(r) { setTimeout(r, wait); });
  return Promise.resolve();
}

function airtableFetch(table, params) {
  return rateLimit().then(function() {
    lastReqTime = Date.now();
    var url = AIRTABLE_BASE_URL + '/' + encodeURIComponent(table) + (params || '');
    return fetch(url, {
      headers: { 'Authorization': 'Bearer ' + AIRTABLE_API_KEY }
    }).then(function(r) { return r.json(); });
  });
}

function fetchAllRecords(table, view) {
  var all = [];
  function page(offset) {
    var params = '?pageSize=100';
    if (view) params += '&view=' + encodeURIComponent(view);
    if (offset) params += '&offset=' + encodeURIComponent(offset);
    return airtableFetch(table, params).then(function(data) {
      if (data.error) {
        console.error('  Airtable error for ' + table + ':', JSON.stringify(data.error));
        return all;
      }
      all = all.concat(data.records || []);
      if (data.offset) return page(data.offset);
      return all;
    });
  }
  return page(null);
}

// ─── Supabase PostgREST helpers ──────────────────────────────
function supabasePost(tableName, rows) {
  // Use on_conflict=airtable_id for tables that have airtable_id column (upsert)
  // sync_metadata uses table_name as unique key instead
  var conflictCol = tableName === 'sync_metadata' ? 'table_name' : 'airtable_id';
  var url = SUPABASE_REST_URL + '/' + tableName + '?on_conflict=' + conflictCol;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'apikey': SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  }).then(function(r) {
    if (!r.ok) {
      return r.text().then(function(txt) {
        throw new Error('PostgREST ' + r.status + ': ' + txt.substring(0, 200));
      });
    }
    return r;
  });
}

function upsertBatch(tableName, rows) {
  if (!rows.length) return Promise.resolve();
  var chain = Promise.resolve();
  for (var i = 0; i < rows.length; i += BATCH_SIZE) {
    (function(batch) {
      chain = chain.then(function() {
        return supabasePost(tableName, batch);
      });
    })(rows.slice(i, i + BATCH_SIZE));
  }
  return chain;
}

// ─── Field value helpers ─────────────────────────────────────
function av(v) { return Array.isArray(v) ? v[0] || '' : v || ''; }
function numVal(v) { return parseFloat(Array.isArray(v) ? v[0] : v) || 0; }
function arrVal(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function intVal(v) { return parseInt(Array.isArray(v) ? v[0] : v) || null; }

// Sanitize dates — returns null for invalid/empty values
function safeDate(v) {
  if (!v) return null;
  var s = Array.isArray(v) ? v[0] : v;
  if (!s || typeof s !== 'string') return null;
  s = s.trim();
  if (!s || s.length < 6) return null;
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (s.includes('T') || s.includes(' ')) return d.toISOString();
  return d.toISOString().split('T')[0];
}

function jsonAttachments(v) {
  if (!Array.isArray(v)) return [];
  return v.map(function(a) {
    return { url: a.url || '', name: a.filename || '', size: a.size || 0, type: a.type || '' };
  });
}

// ─── Build mapped row + collect unmapped fields into data ────
// Given a record and a field mapping object, return the Supabase row.
// Any Airtable fields NOT in the mapping go into the `data` JSONB column.
function buildRow(record, fieldMap) {
  var f = record.fields || {};
  var row = { airtable_id: record.id };
  var mappedKeys = {};

  // Apply each mapped field
  var mapKeys = Object.keys(fieldMap);
  for (var i = 0; i < mapKeys.length; i++) {
    var supaCol = mapKeys[i];
    var spec = fieldMap[supaCol];

    if (typeof spec === 'function') {
      // Custom transform function — it gets the full fields object
      row[supaCol] = spec(f);
    } else if (typeof spec === 'string') {
      // Direct single-field mapping
      row[supaCol] = f[spec];
      if (row[supaCol] === undefined) row[supaCol] = null;
      mappedKeys[spec] = true;
    } else if (Array.isArray(spec)) {
      // Fallback chain — try each Airtable field name in order
      var found = false;
      for (var j = 0; j < spec.length; j++) {
        mappedKeys[spec[j]] = true;
        if (!found && f[spec[j]] !== undefined && f[spec[j]] !== null && f[spec[j]] !== '') {
          row[supaCol] = f[spec[j]];
          found = true;
        }
      }
      if (!found) row[supaCol] = null;
    }
  }

  // Mark all referenced Airtable field names as mapped (for function-type specs
  // we cannot easily track which fields were consumed, so those go into data too)
  // Collect unmapped fields into data JSONB
  var data = {};
  var allFieldNames = Object.keys(f);
  for (var k = 0; k < allFieldNames.length; k++) {
    var fname = allFieldNames[k];
    if (!mappedKeys[fname]) {
      data[fname] = f[fname];
    }
  }
  // Only include non-empty data object
  if (Object.keys(data).length > 0) {
    row.data = data;
  }

  return row;
}

// ─── FIELD MAPPINGS ──────────────────────────────────────────
// Each mapping is { supabase_column: 'Airtable Field' | ['Fallback1','Fallback2'] | function(f){...} }
// The buildRow function applies these and collects unmapped fields into data.

var FIELD_MAPS = {};

FIELD_MAPS.contacts = {
  full_name: 'Full Name',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  mobile: 'Mobile',
  formatted_mobile: 'Formatted Mobile',
  address: 'Address',
  suburb: 'Suburb',
  state: 'State',
  postcode: 'Postcode',
  dob: function(f) { return safeDate(f['DOB'] || f['Date of Birth']); },
  type_of_contact: 'Type of Contact (Single Select)',
  type_of_employment: 'Type of Employment',
  job_title: 'Job Title',
  department: 'Department',
  team: 'Team',
  status: function(f) { return f['Status'] || 'Active'; },
  training_status: 'Training Status',
  photo_url: function(f) {
    var pics = f['PIC - SW Photo'];
    return (Array.isArray(pics) && pics.length > 0) ? pics[0].url : '';
  },
  emergency_contact: 'Emergency Contact',
  emergency_phone: 'Emergency Phone',
  ndis_number: 'NDIS Number'
};

FIELD_MAPS.clients = {
  client_name: function(f) { return av(f['Client Name'] || f['Full Name'] || ''); },
  full_name: function(f) { return av(f['Full Name'] || ''); },
  first_name: 'First Name',
  last_name: 'Last Name',
  account_type: function(f) { return av(f['Account Type: Active or Inactive or Propsect'] || f['Account Type: Active or Inactive or Prospect'] || f['Account Type'] || ''); },
  phone: function(f) { return av(f['Phone'] || f['Mobile'] || ''); },
  mobile: 'Mobile',
  email: function(f) { return av(f['Email'] || f['Email Address'] || ''); },
  ndis_number: function(f) { return av(f['NDIS Number'] || f['NDIS Ref'] || ''); },
  ndis_ref: function(f) { return av(f['NDIS Ref'] || ''); },
  suburb: function(f) { return av(f['Suburb'] || f['Location'] || ''); },
  location: 'Location',
  sil_or_cas: function(f) { return av(f['SIL or CAS?'] || f['SIL or CAS - Client'] || ''); },
  date_of_birth: function(f) { return safeDate(f['Date of Birth'] || f['DOB']); },
  gender: 'Gender',
  address: function(f) { return av(f['Address'] || f['Home Address'] || f['Street Address'] || ''); },
  home_address: 'Home Address',
  street_address: 'Street Address',
  state: 'State',
  postcode: 'Postcode',
  emergency_contact: function(f) { return av(f['Emergency Contact'] || f['Emergency Contact Name'] || ''); },
  emergency_phone: function(f) { return av(f['Emergency Phone'] || f['Emergency Contact Phone'] || ''); },
  emergency_email: function(f) { return av(f['Emergency Email'] || f['Emergency Contact Email'] || ''); },
  emergency_relationship: function(f) { return av(f['Emergency Relationship'] || f['Emergency Relationship to Client'] || ''); },
  nominee: function(f) { return av(f['Nominee or Guardian'] || f['Nominee or Legal Guardian'] || ''); },
  nominee_phone: 'Nominee Phone',
  nominee_email: 'Nominee Email',
  plan_manager: function(f) { return av(f['Plan Manager (from Plan Manager Link)'] || f['Plan Manager'] || ''); },
  plan_manager_email: function(f) { return av(f['Plan Manager Email (from Plan Manager Link)'] || ''); },
  plan_manager_phone: function(f) { return av(f['Plan Manager Phone (from Plan Manager Link)'] || ''); },
  plan_manager_company: function(f) { return av(f['Company Name (from Plan Manager Link)'] || ''); },
  support_coordinator: function(f) { return av(f['Support Coordinator (from Support Coordinator Link)'] || f['Support Coordinator'] || ''); },
  support_coordinator_email: function(f) { return av(f['Support Coordinator Email (from Support Coordinator Link)'] || ''); },
  support_coordinator_phone: function(f) { return av(f['Phone (from Support Coordinator )'] || ''); },
  support_coordinator_company: function(f) { return av(f['Company Name (from Support Coordinator Link)'] || f['Organisation (from Support Coordinator Link)'] || ''); },
  ndis_plan_type: function(f) { return av(f['Type of NDIS Plan Grouped'] || f['Type of NDIS Plan'] || ''); },
  ndis_plan_start_date: function(f) { return safeDate(f['NDIS Plan Start Date']); },
  ndis_plan_expiry_date: function(f) { return safeDate(f['NDIS Plan Expiry Date']); },
  core_budget_sil: function(f) { return numVal(f['Core Budget (SIL)']); },
  core_budget_community_access: function(f) { return numVal(f['Core Budget (Community Access)']); },
  core_budget_transport: function(f) { return numVal(f['Core Budget (Transport)']); },
  km_allowance: function(f) { return av(f['KM Allowance'] || f["KM's Allowance per week"] || ''); },
  type_of_disability: function(f) { return av(f['Type of Disability'] || ''); },
  general_background: function(f) { return av(f['General Background Info'] || ''); },
  ndis_goals: function(f) { return av(f['NDIS Client Goals as outlined in their plan'] || f['NDIS Goals'] || ''); },
  allergies: function(f) { return av(f['List the Allergies or Alerts & provide as much details here'] || f['Allergies'] || ''); },
  has_allergies: function(f) { return av(f['Does the Client have any Allergies or Alerts?'] || ''); },
  communication_aids: function(f) { return av(f['Do they use communication aids?'] || ''); },
  communication_details: function(f) { return av(f['Tell us more about your communication aids.'] || ''); },
  personal_care: function(f) { return av(f['Is there Personal Care involved in their Support?'] || ''); },
  pbsp_yes_no: function(f) { return av(f['PBSP? Yes or No'] || ''); },
  pbsp_prac_name: function(f) { return av(f['PBSP Prac Name'] || f['Behaviour Practitioner'] || ''); },
  pbsp_prac_email: 'PBSP Prac Email',
  pbsp_phone: 'PBSP Phone',
  pbsp_strategies: function(f) { return av(f['PBSP Strategies Summary 2025'] || ''); },
  known_triggers: function(f) { return av(f['Any known triggers'] || ''); },
  support_ratio: function(f) { return av(f['Support Ratio'] || ''); },
  gender_of_workers: function(f) { return av(f['Gender of Support Workers'] || ''); },
  required_staff_skills: function(f) { return arrVal(f['Required Staff Skills']); },
  opg_officer: function(f) { return av(f['OPG Officer'] || f['Public Guardian'] || ''); },
  opg_phone: function(f) { return av(f['OPG Phone'] || ''); },
  opg_email: function(f) { return av(f['OPG Email'] || ''); },
  own_decision_maker: function(f) { return av(f['Is the Client their own decision maker?'] || ''); },
  medical_decisions: function(f) { return av(f['Medical Decisions'] || ''); },
  financial_decisions: function(f) { return av(f['Financial Decisions'] || ''); },
  ndis_accommodation_decisions: function(f) { return av(f['NDIS Supports\nPlan & Accommodation decisions'] || f['NDIS Supports Plan & Accommodation decisions'] || f['NDIS Supports\n Plan & Accommodation decisions'] || ''); },
  living_arrangements_decisions: function(f) { return av(f['Living Arrangements decisions'] || ''); },
  legal_decisions: function(f) { return av(f['Legal Decisions'] || ''); }
};

FIELD_MAPS.leads = {
  ref_number: function(f) {
    var refNum = f['Name'] || '';
    if (!isNaN(refNum)) return '#' + refNum;
    return '';
  },
  lead_name: function(f) {
    var name = f['Lead Name or Initials'] || f['Lead Name'] || f['Client Name'] || f['Full Name'] || '';
    if (!name) name = ((f['First Name'] || '') + ' ' + (f['Last Name'] || '')).trim();
    if (!name && f['Name'] && isNaN(f['Name'])) name = f['Name'];
    return name;
  },
  full_name: 'Full Name',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: ['Email', 'Email Address'],
  phone: ['Phone', 'Mobile'],
  mobile: 'Mobile',
  source: function(f) { return av(f['Source'] || f['Lead Source'] || ''); },
  stage: function(f) { return av(f['Stage'] || f['Lead Stage'] || f['Status'] || 'Enquiry'); },
  status: function(f) { return f['Status'] || 'New'; },
  date: function(f) { return safeDate(f['Date'] || f['Created']); },
  notes: 'Notes',
  comments: 'Comments',
  suburb: function(f) { return av(f['Suburb'] || f['City'] || ''); },
  disability_type: function(f) { return av(f['Type of Disability'] || ''); },
  ndis_number: function(f) { return av(f['NDIS Number'] || ''); },
  service_type: function(f) { return av(f['Service Type'] || f['SIL or CAS?'] || ''); },
  sil_or_cas: function(f) { return av(f['SIL or CAS?'] || ''); },
  assignee: function(f) { return av(f['Assignee'] || f['Assigned To'] || ''); },
  sc_name: function(f) { return av(f['Support Coordinators Name'] || ''); },
  sc_email: function(f) { return av(f['Support Coordinators Email'] || ''); },
  sc_mobile: function(f) { return av(f['Support Coordinators Mobile'] || ''); },
  organisation_name: 'Organisation Name',
  contact_name: 'Contact Name',
  enquiry_type: 'Enquiry Type',
  message: 'Message',
  number_of_participants: function(f) { return parseInt(f['Number of Participants']) || null; },
  number_of_staff: function(f) { return parseInt(f['Number of Staff']) || null; }
};

FIELD_MAPS.rosters = {
  unique_ref: 'Unique Ref #',
  client_name: function(f) { return av(f['Client Name'] || f['Client Full Name'] || ''); },
  client_full_name: function(f) { return av(f['Client Full Name'] || ''); },
  staff_name: function(f) { return av(f['Staff Name'] || ''); },
  staff_email: 'Staff Email',
  start_shift: function(f) { return safeDate(f['Start Shift']); },
  end_shift: function(f) { return safeDate(f['End Shift']); },
  day_type: 'Day Type',
  total_hours_decimal: function(f) { return numVal(f['Total Hours (Decimal)']); },
  total_hours_hmm: 'Total Hours (H:MM)',
  type_of_shift: 'Type of Shift (Active or Non Active)',
  shift_status: 'Shift Status',
  has_sleepover: 'Has Sleepover',
  sil_or_cas: function(f) { return String(f['SIL or CAS?'] || ''); },
  progress_note_completed: function(f) { return f['Progress Note Completed?'] || false; },
  support_item_name: 'Support Item Name',
  charge_per_hour: function(f) { return numVal(f['Charge per hour']); },
  support_category_pace: 'Support Category Number (PACE)',
  broken_shift: 'Broken Shift?'
};

FIELD_MAPS.progress_notes = {
  support_worker_name: 'Support Workers Name',
  client_name: function(f) { return av(f['Client Name'] || ''); },
  start_datetime: function(f) { return safeDate(f['Start Date and Time']); },
  end_datetime: function(f) { return safeDate(f['End Date and Time']); },
  notes_summary: 'Notes/Summary',
  total_hours: 'Total Hours',
  transport: 'Transport',
  kms: 'KMs'
};

FIELD_MAPS.ir_reports = {
  unique_ir_ref: 'Unique IR #',
  person_completing: 'Person completing IR',
  incident_datetime: function(f) { return safeDate(f['Date & Time of Incident']); },
  description: 'Description',
  severity: function(f) { return f['Severity'] || 'Minor'; },
  status: function(f) { return f['Status'] || 'Open'; },
  client_name: function(f) { return av(f['Client Name'] || ''); },
  incident_summary: function(f) { return av(f['Summarise the incident and/or allegation (without reference to peoples names).'] || ''); },
  is_reportable: function(f) { return av(f['Is this a Reportable Incident to the NDIS Quality Safeguards Commission??'] || ''); }
};

FIELD_MAPS.client_core_budgets = {
  unique_ref: 'Unique Ref',
  client_name: function(f) { return av(f['Client Name'] || ''); },
  ndis_ref: function(f) { return av(f['NDIS Ref # (from Client Name)'] || f['NDIS Ref'] || f['NDIS Number'] || ''); },
  ndis_plan_type: function(f) { return av(f['Type of NDIS Plan (from Client Name)'] || f['Plan Type'] || ''); },
  account_type: function(f) { return av(f['Account Type:  Active or Inactive or Propsect (from Client Name)'] || f['Account Type'] || ''); },
  sil_or_cas: function(f) { return av(f['SIL or CAS? (from Client Name)'] || f['SIL or CAS'] || ''); },
  core_budget_sil: function(f) { return numVal(f['Core Budget (SIL) (from Client Name)'] || f['Core Budget (SIL)']); },
  core_budget_community_access: function(f) { return numVal(f['Core Budget (Community Access) (from Client Name)'] || f['Core Budget (Community Access)']); },
  core_budget_transport: function(f) { return numVal(f['Core Budget (Transport) (from Client Name)'] || f['Core Budget (Transport)']); },
  sil_budget: function(f) { return numVal(f['SIL Budget']); },
  sil_used: function(f) { return numVal(f['SIL Used']); },
  community_access_budget: function(f) { return numVal(f['Community Access Budget']); },
  community_access_used: function(f) { return numVal(f['Community Access Used']); },
  transport_budget: function(f) { return numVal(f['Transport Budget']); },
  transport_used: function(f) { return numVal(f['Transport Used']); },
  core_other_budget: function(f) { return numVal(f['Core Other Budget']); },
  capacity_building_budget: function(f) { return numVal(f['Capacity Building Budget']); },
  total_budget: function(f) { return numVal(f['Total Budget']); },
  invoice_amount: function(f) { return numVal(f['Invoice Amount']); },
  from_which_budget: ['from which Budget?', 'from which Budget'],
  line_items: 'Line Items from SOS Agreement',
  line_items_uploaded: function(f) { return f['Line Items from SOS Agreement uploaded'] || false; },
  plan_start_date: function(f) { return safeDate(f['Plan Start Date'] || f['Plan Start']); },
  plan_end_date: function(f) { return safeDate(f['Plan End Date'] || f['Plan End']); },
  plan_manager: 'Plan Manager',
  ndis_number: function(f) { return av(f['NDIS Number'] || f['NDIS #'] || ''); },
  notes: 'Notes'
};

FIELD_MAPS.sil_properties = {
  name: ['Name', 'Property Name'],
  suburb: 'Suburb',
  address: 'Address',
  status: 'Status',
  description: 'Description',
  sil_number: 'SIL Number',
  weekly_rent: function(f) { return numVal(f['Weekly Rent']); },
  property_type: 'Property Type',
  total_rooms: function(f) { return intVal(f['Total Rooms']); },
  vacancies: function(f) { return intVal(f['Vacancies']); },
  has_vacancy: 'Has Vacancy',
  type_of_accom: 'Type of Accom',
  bathrooms: function(f) { return intVal(f['Bathrooms']); },
  notes: 'Notes',
  real_estate_name: 'Real Estate Name',
  real_estate_phone: 'Real Estate Phone',
  real_estate_email: 'Real Estate Email',
  sda_provider_name: 'SDA Provider Name',
  sda_phone: 'SDA Phone',
  sda_email: 'SDA Email',
  lease_start_date: function(f) { return safeDate(f['Lease Start Date']); },
  lease_end_date: function(f) { return safeDate(f['Lease End Date']); },
  electricity_provider: 'Electricity Provider',
  gas_provider: 'Gas Provider',
  internet_provider: 'Internet Provider',
  electricity_connected: 'Electricity Connected',
  gas_connected: 'Gas Connected',
  internet_connected: 'Internet Connected',
  electrical_repairs: 'Electrical Repairs',
  plumbing_repairs: 'Plumbing Repairs',
  other_repairs: 'Other Repairs',
  lawns_maintenance: 'Lawns Maintenance',
  lawns_email: 'Lawns Email',
  lawns_mobile: 'Lawns Mobile',
  sil_landline: 'SIL Landline',
  sil_mobile: 'SIL Mobile',
  sil_email: 'SIL Email',
  mobile_pin: 'Mobile PIN',
  email_password: 'Email Password',
  laptop_password: 'Laptop Password',
  wifi_modem: 'WiFi Modem',
  wifi_password: 'WiFi Password',
  printer_make_model: 'Printer Make Model',
  printer_ink_cartridge: 'Printer Ink Cartridge',
  lockbox_details: 'Lockbox Details',
  house_leader: 'House Leader'
};

FIELD_MAPS.client_calendar = {
  unique_ref: 'Unique Ref',
  client_name: function(f) { return av(f['Client Name'] || ''); },
  event_name: ['Event Name', 'Event Title'],
  appointment_type: 'Appointment Type',
  start_datetime: function(f) { return safeDate(f['Start Date & Time'] || f['Start DateTime'] || f['Start']); },
  end_datetime: function(f) { return safeDate(f['End Date & Time'] || f['End DateTime'] || f['End']); },
  address: 'Address',
  details: 'Details',
  sw_instructions: 'SW Instructions',
  created_by: 'Created By',
  created_date: function(f) { return safeDate(f['Created Date']); },
  status: 'Status',
  sil_or_cas: function(f) { return av(f['SIL or CAS?'] || ''); },
  files: function(f) { return jsonAttachments(f['Files'] || f['Attachments']); }
};

FIELD_MAPS.support_plans = {
  client_name: function(f) { return av(f['Client Name'] || ''); },
  category: 'Category',
  goal: 'Goal',
  strategy: 'Strategy',
  notes: 'Notes',
  status: 'Status'
};

FIELD_MAPS.tasks = {
  ref_number: function(f) { return av(f['Reference #'] || f['Ref Number'] || f['Name'] || ''); },
  task_name: function(f) { return av(f['Task Name'] || f['Name'] || f['Title'] || ''); },
  client_name: function(f) { return av(f['Client Name'] || f['Client Full Name (from Client Name)'] || ''); },
  assignee: function(f) { return av(f['Assignee'] || f['Assigned To'] || f['Full Name (from Assigned to Email)'] || ''); },
  status: function(f) { return av(f['Status'] || f['Task Status'] || 'Not Started'); },
  priority: function(f) { return av(f['Priority'] || f['Task Priority'] || 'Medium'); },
  due_date: function(f) { return safeDate(f['Due Date'] || f['Due Date for task to be completed']); },
  date_completed: function(f) { return safeDate(f['Date Completed']); },
  project_name: function(f) { return av(f['Project'] || f['Project Name'] || ''); },
  created_by: function(f) { return av(f['Created By'] || ''); },
  created_date: function(f) { return safeDate(f['Created Date  & Time 2025'] || f['Created Date']); },
  type_of_update: function(f) { return av(f['Type of Update (Multi-select)'] || f['Type of Update'] || ''); },
  method_of_contact: 'Method of Contact',
  description: 'Detailed Description',
  notes: ['Notes', 'Description'],
  follow_up_required: 'Is there a follow up required?',
  follow_up_details: 'Details of follow up',
  actions_taken: 'Actions taken to Complete task',
  is_recurring: 'Recurring Task?',
  recurring_frequency: 'Frequency of Recurring Task',
  next_due_date: function(f) { return safeDate(f['Next Due Date to occur']); }
};

FIELD_MAPS.courses = {
  name: ['Name', 'Course Name'],
  category: 'Category',
  description: ['Course Description', 'Description'],
  frequency_months: ['Frequency of Delivery (months)', 'Frequency'],
  status: ['Status of Course', 'Status'],
  duration_minutes: ['Time in Minutes', 'Duration'],
  module_count: function(f) { return parseInt(f['Module Count'] || f['Modules'] || 0) || 0; }
};

FIELD_MAPS.course_enrollments = {
  staff_name: ['Staff Name', 'Staff Email'],
  staff_full_name: ['Staff Full Name', 'Full Name (from Staff Name)'],
  course_name: ['Course Name', 'Name (from Course)'],
  enrolled_datetime: function(f) { return safeDate(f['Enrolled Date'] || f['Enrolled DateTime'] || f['Created']); },
  progress: function(f) { return numVal(f['Progress'] || f['Progress %']); },
  course_expiry_date: function(f) { return safeDate(f['Course Expiry Date'] || f['Expiry Date']); }
};

FIELD_MAPS.course_modules = {
  name: ['Name', 'Module Name'],
  sort_order: function(f) { return numVal(f['Sort Order'] || f['Order']); },
  description: 'Description',
  status: 'Status',
  attachments: function(f) { return jsonAttachments(f['Attachments']); }
};

FIELD_MAPS.course_lessons = {
  name: ['Name', 'Lesson Name'],
  sort_order: function(f) { return numVal(f['Sort Order'] || f['Order']); },
  lesson_type: function(f) { return f['Lesson Type'] || f['Type'] || 'Content'; },
  content: 'Content',
  video_url: ['Video URL', 'Video'],
  status: 'Status',
  attachments: function(f) { return jsonAttachments(f['Attachments']); }
};

FIELD_MAPS.course_quizzes = {
  name: ['Name', 'Quiz Name'],
  pass_percentage: function(f) { return numVal(f['Pass Percentage'] || f['Pass %'] || 100); }
};

FIELD_MAPS.course_quiz_questions = {
  question: 'Question',
  options: 'Options',
  correct_answer: function(f) { return intVal(f['Correct Answer']); },
  sort_order: function(f) { return numVal(f['Sort Order'] || f['Order']); }
};

FIELD_MAPS.receipts = {
  unique_receipt_id: 'Unique ID',
  supplier_name: 'Supplier Name',
  purchase_date: function(f) { return safeDate(f['Purchase Date']); },
  purchase_date_formatted: 'Purchase Date (Formula)',
  total_amount: function(f) { return numVal(f['Total Receipt Amount']); },
  gst_amount: function(f) { return numVal(f['GST Amount']); },
  currency: function(f) { return f['Currency'] || 'AUD'; },
  purpose: function(f) { return arrVal(f['Purpose of Purchase']); },
  staff_email: 'Staff Name',
  staff_name: function(f) { return av(f['Full Name (from Staff Name)'] || ''); },
  job_title: function(f) { return av(f['Job Title (from Staff Name)'] || ''); },
  comments: 'Comments',
  receipt_url: function(f) {
    var uploads = f['Receipt Upload'] || [];
    return (Array.isArray(uploads) && uploads.length > 0) ? uploads[0].url || '' : '';
  },
  ai_summary: 'Summary (Receipt Upload)',
  reimbursement: function(f) { return f['Reimbursement?'] || 'NO'; }
};

FIELD_MAPS.employee_contact_history = {
  email: ['Email', 'Staff Email'],
  name: ['Name', 'Full Name', 'Staff Name'],
  contact_type: ['Contact Type', 'Type'],
  method: ['Method', 'Method of Contact'],
  reason: 'Reason',
  summary: ['Summary', 'Notes'],
  date: function(f) { return safeDate(f['Date'] || f['Created']); },
  created_by: 'Created By'
};

FIELD_MAPS.client_contact_history = {
  client_name: function(f) { return av(f['Client Name'] || ''); },
  contact_type: ['Contact Type', 'Type'],
  method: ['Method', 'Method of Contact'],
  reason: 'Reason',
  summary: ['Summary', 'Notes'],
  date: function(f) { return safeDate(f['Date'] || f['Created']); },
  created_by: 'Created By'
};

FIELD_MAPS.knowledge_base = {
  name: ['Name', 'Title', 'Document Name'],
  title: 'Title',
  category: ['Category', 'Type'],
  content: ['Content', 'Body', 'Text'],
  body: 'Body',
  summary: 'Summary',
  keywords: 'Keywords',
  tags: 'Tags'
};

FIELD_MAPS.sw_contractor_rates = {
  // Mostly JSONB-based, try common field names
  staff_name: ['Staff Name', 'Name', 'Contractor Name'],
  staff_email: ['Staff Email', 'Email'],
  hourly_rate: function(f) { return numVal(f['Hourly Rate'] || f['Rate']); },
  abn: ['ABN', 'ABN Number']
};

FIELD_MAPS.tfn_pay_rates = {
  classification: ['Classification', 'Level'],
  employment_type: ['Employment Type', 'Type of Employment'],
  pay_level: ['Pay Level', 'Level'],
  hourly_rate: function(f) { return numVal(f['Hourly Rate'] || f['Base Rate']); },
  afternoon_rate: function(f) { return numVal(f['Afternoon Rate']); },
  night_rate: function(f) { return numVal(f['Night Rate']); },
  saturday_rate: function(f) { return numVal(f['Saturday Rate']); },
  sunday_rate: function(f) { return numVal(f['Sunday Rate']); },
  public_holiday_rate: function(f) { return numVal(f['Public Holiday Rate']); },
  sleepover_rate: function(f) { return numVal(f['Sleepover Rate']); },
  award_stream: ['Award Stream', 'Stream'],
  effective_date: function(f) { return safeDate(f['Effective Date']); }
};

FIELD_MAPS.staff_availability = {
  staff_name: ['Staff Name', 'Name', 'Full Name'],
  staff_email: ['Staff Email', 'Email'],
  leave_type: ['Leave Type', 'Type'],
  start_date: function(f) { return safeDate(f['Start Date'] || f['From']); },
  end_date: function(f) { return safeDate(f['End Date'] || f['To']); },
  status: function(f) { return f['Status'] || 'Pending'; },
  notes: 'Notes'
};

// roc_participants — JSONB-only table, no mapped columns beyond base
// All fields go into data JSONB via fallback generic handler
// (no FIELD_MAPS entry = all fields stored in data)

// roc_shifts — JSONB-only table, all fields stored in data

FIELD_MAPS.client_sleep_chart = {
  client_name: function(f) { return av(f['Client Name'] || ''); }
};

FIELD_MAPS.bowel_chart = {
  client_name: function(f) { return av(f['Client Name'] || ''); }
};

FIELD_MAPS.fluid_intake_diary = {
  client_name: function(f) { return av(f['Client Name'] || ''); }
};

FIELD_MAPS.client_consumables = {
  client_name: function(f) { return av(f['Client Name'] || ''); }
};

FIELD_MAPS.client_behaviours = {
  client_name: function(f) { return av(f['Client Name'] || ''); }
};

FIELD_MAPS.document_signing_requests = {
  document_type: ['Document Type', 'Type'],
  client_name: function(f) { return av(f['Client Name'] || ''); },
  staff_name: function(f) { return av(f['Staff Name'] || ''); },
  signer_name: ['Signer Name', 'Signee Name'],
  signer_email: ['Signer Email', 'Signee Email'],
  status: function(f) { return f['Status'] || 'Pending'; },
  sent_date: function(f) { return safeDate(f['Sent Date'] || f['Date Sent']); },
  signed_date: function(f) { return safeDate(f['Signed Date'] || f['Date Signed']); }
};

// employment_documents — JSONB-only table, all fields stored in data

FIELD_MAPS.client_docs = {
  unique_ref: 'Unique Ref',
  client_name: function(f) { return av(f['Client Name'] || ''); },
  doc_type: ['Document Type', 'Type', 'Doc Type'],
  expiry_date: function(f) { return safeDate(f['Expiry Date'] || f['Expiry']); },
  last_updated: function(f) { return safeDate(f['Last Updated']); },
  updated_by: 'Updated By',
  attachment_summary: 'Attachment Summary',
  status: function(f) { return f['Status'] || 'Active'; },
  files: function(f) { return jsonAttachments(f['Files'] || f['Attachments'] || f['Document']); }
};

// company_files — JSONB-only table, all fields stored in data

FIELD_MAPS.ndis_price_guide = {
  support_item_number: function(f) { return (f['Support Item Number'] || '').trim(); },
  support_item_name: function(f) { return (f['Support Item Name'] || '').trim(); },
  support_category_name: function(f) { return (f['Support Category Name'] || f['Support Category Name (PACE)'] || '').trim(); },
  registration_group_number: 'Registration Group Number',
  unit: function(f) { return f['Unit'] || 'H'; },
  charge_per_hour: function(f) { return numVal(f['Charge per hour']); },
  remote_rate: function(f) { return numVal(f[' Remote '] || f['Remote']); },
  very_remote_rate: function(f) { return numVal(f[' Very Remote '] || f['Very Remote']); }
};

FIELD_MAPS.chat_conversations = {
  name: ['Name', 'Conversation Name', 'Title'],
  type: function(f) { return f['Type'] || 'group'; },
  members: function(f) { return f['Members'] || []; }
};

// chat_members — JSONB-only table, all fields stored in data

FIELD_MAPS.chat_messages = {
  sender_name: ['Sender Name', 'From', 'Name'],
  content: ['Content', 'Message', 'Text'],
  message_type: function(f) { return f['Message Type'] || f['Type'] || 'text'; },
  attachment_url: function(f) {
    var att = f['Attachments'] || f['Files'];
    if (Array.isArray(att) && att.length > 0) return att[0].url || '';
    return '';
  }
};

FIELD_MAPS.push_subscriptions = {
  // Mostly JSONB — pull common fields
  endpoint: 'Endpoint',
  user_email: ['User Email', 'Email'],
  user_name: ['User Name', 'Name']
};

FIELD_MAPS.client_media = {
  client_name: function(f) { return av(f['Client Name'] || ''); },
  media_type: ['Media Type', 'Type'],
  caption: ['Caption', 'Description'],
  files: function(f) { return jsonAttachments(f['Files'] || f['Attachments'] || f['Media']); }
};

FIELD_MAPS.weekly_stakeholder_reports = {
  client_name: function(f) { return av(f['Client Name'] || ''); },
  week_start: function(f) { return safeDate(f['Week Start'] || f['Period Start'] || f['Start Date']); },
  week_end: function(f) { return safeDate(f['Week End'] || f['Period End'] || f['End Date']); },
  report_content: ['Report Content', 'Report', 'Content'],
  status: 'Status',
  sent_to: ['Sent To', 'Recipients'],
  sent_date: function(f) { return safeDate(f['Sent Date'] || f['Date Sent']); }
};

FIELD_MAPS.candidate_interactions = {
  candidate_name: function(f) { return av(f['Candidate Name'] || f['Name'] || f['Full Name'] || ''); },
  candidate_email: ['Candidate Email', 'Email'],
  interaction_type: ['Interaction Type', 'Type'],
  date: function(f) { return safeDate(f['Date'] || f['Created']); },
  notes: ['Notes', 'Summary'],
  stage: ['Stage', 'Status'],
  interviewer: ['Interviewer', 'Conducted By']
};

FIELD_MAPS.independent_contractor_invoices = {
  contractor_name: function(f) { return av(f['Contractor Name'] || f['Name'] || ''); },
  invoice_number: ['Invoice Number', 'Invoice #', 'Invoice No'],
  shift_date: function(f) { return safeDate(f['Shift Date'] || f['Date']); },
  hours_worked: function(f) { return numVal(f['Hours Worked'] || f['Hours']); },
  hourly_rate: function(f) { return numVal(f['Hourly Rate'] || f['Rate']); },
  total_kilometres: function(f) { return numVal(f['Total Kilometres'] || f['KMs']); },
  amount: function(f) { return numVal(f['Amount']); },
  amount_ex_gst: function(f) { return numVal(f['Amount Ex GST'] || f['Amount (ex GST)']); },
  gst: function(f) { return numVal(f['GST']); },
  total: function(f) { return numVal(f['Total']); },
  status: function(f) { return f['Status'] || 'pending'; },
  period_start: function(f) { return safeDate(f['Period Start'] || f['Start Date']); },
  period_end: function(f) { return safeDate(f['Period End'] || f['End Date']); },
  submitted_date: function(f) { return safeDate(f['Submitted Date']); },
  paid_date: function(f) { return safeDate(f['Paid Date']); }
};


// ─── TABLE MIGRATION MAP ─────────────────────────────────────
// All 44 tables from Airtable → Supabase
var MIGRATION_TABLES = [
  { airtable: 'All Contacts',                    supabase: 'contacts',                       mapper: 'contacts' },
  { airtable: 'Clients',                         supabase: 'clients',                        mapper: 'clients' },
  { airtable: 'Leads',                           supabase: 'leads',                          mapper: 'leads' },
  { airtable: 'Rosters 2025',                    supabase: 'rosters',                        mapper: 'rosters' },
  { airtable: 'Progress Notes',                  supabase: 'progress_notes',                 mapper: 'progress_notes' },
  { airtable: 'IR Reports 2025',                 supabase: 'ir_reports',                     mapper: 'ir_reports' },
  { airtable: 'Client Core Budgets',             supabase: 'client_core_budgets',            mapper: 'client_core_budgets' },
  { airtable: 'SIL Properties',                  supabase: 'sil_properties',                 mapper: 'sil_properties' },
  { airtable: 'Client Calendar',                 supabase: 'client_calendar',                mapper: 'client_calendar' },
  { airtable: 'Support Plans 2025',              supabase: 'support_plans',                  mapper: 'support_plans' },
  { airtable: 'Tasks',                           supabase: 'tasks',                          mapper: 'tasks' },
  { airtable: 'Course List',                     supabase: 'courses',                        mapper: 'courses' },
  { airtable: 'Course Enrollments',              supabase: 'course_enrollments',             mapper: 'course_enrollments' },
  { airtable: 'Course Modules',                  supabase: 'course_modules',                 mapper: 'course_modules' },
  { airtable: 'Course Lessons',                  supabase: 'course_lessons',                 mapper: 'course_lessons' },
  { airtable: 'Course Quizzes',                  supabase: 'course_quizzes',                 mapper: 'course_quizzes' },
  { airtable: 'Course QuizQuestions',            supabase: 'course_quiz_questions',           mapper: 'course_quiz_questions' },
  { airtable: 'Receipts',                        supabase: 'receipts',                       mapper: 'receipts' },
  { airtable: 'Employee Contact History',        supabase: 'employee_contact_history',       mapper: 'employee_contact_history' },
  { airtable: 'Client Contact History',          supabase: 'client_contact_history',         mapper: 'client_contact_history' },
  { airtable: 'Messenger Knowledge Base',        supabase: 'knowledge_base',                 mapper: 'knowledge_base' },
  { airtable: 'SW Independant Contractor Rates', supabase: 'sw_contractor_rates',            mapper: 'sw_contractor_rates' },
  { airtable: 'TFN Pay Rates',                   supabase: 'tfn_pay_rates',                  mapper: 'tfn_pay_rates' },
  { airtable: 'Staff Availability',              supabase: 'staff_availability',             mapper: 'staff_availability' },
  { airtable: 'RoC Participants',                supabase: 'roc_participants',               mapper: 'roc_participants' },
  { airtable: 'RoC Shifts',                      supabase: 'roc_shifts',                     mapper: 'roc_shifts' },
  { airtable: 'Client Sleep Chart',              supabase: 'client_sleep_chart',             mapper: 'client_sleep_chart' },
  { airtable: 'Bowel Chart',                     supabase: 'bowel_chart',                    mapper: 'bowel_chart' },
  { airtable: 'Fluid Intake Diary',              supabase: 'fluid_intake_diary',             mapper: 'fluid_intake_diary' },
  { airtable: 'Client Consumables',              supabase: 'client_consumables',             mapper: 'client_consumables' },
  { airtable: 'QR Code Data - Behaviours',       supabase: 'client_behaviours',              mapper: 'client_behaviours' },
  { airtable: 'Document Signing Requests',       supabase: 'document_signing_requests',      mapper: 'document_signing_requests' },
  { airtable: 'Employment Documents',            supabase: 'employment_documents',           mapper: 'employment_documents' },
  { airtable: 'Client Docs',                     supabase: 'client_docs',                    mapper: 'client_docs' },
  { airtable: 'Company Files',                   supabase: 'company_files',                  mapper: 'company_files' },
  { airtable: 'NDIS Price Guide 2025 - 2026',    supabase: 'ndis_price_guide',               mapper: 'ndis_price_guide' },
  { airtable: 'Chat Conversations',              supabase: 'chat_conversations',             mapper: 'chat_conversations' },
  { airtable: 'Chat Members',                    supabase: 'chat_members',                   mapper: 'chat_members' },
  { airtable: 'Chat Messages',                   supabase: 'chat_messages',                  mapper: 'chat_messages' },
  { airtable: 'Push Subscriptions',              supabase: 'push_subscriptions',             mapper: 'push_subscriptions' },
  { airtable: 'Client Media',                    supabase: 'client_media',                   mapper: 'client_media' },
  { airtable: 'Weekly Stakeholder Reports',      supabase: 'weekly_stakeholder_reports',     mapper: 'weekly_stakeholder_reports' },
  { airtable: 'Candidate Interactions',          supabase: 'candidate_interactions',         mapper: 'candidate_interactions' },
  { airtable: 'Contractor Invoices',             supabase: 'independent_contractor_invoices', mapper: 'independent_contractor_invoices' }
];


// ─── MAIN MIGRATION ──────────────────────────────────────────
function migrate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Titus CRM — Airtable → Supabase Migration');
  console.log(' Tables: ' + MIGRATION_TABLES.length);
  console.log(' Batch size: ' + BATCH_SIZE);
  console.log(' Started: ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  var stats = { totalRecords: 0, inserted: 0, errors: 0, tablesOk: 0, tablesFailed: 0, tablesEmpty: 0, tableResults: [] };
  var tableErrors = [];

  // Process tables sequentially
  var idx = 0;

  function processNext() {
    if (idx >= MIGRATION_TABLES.length) {
      return printSummary();
    }

    var t = MIGRATION_TABLES[idx];
    var tableNum = idx + 1;
    idx++;

    console.log('\n[' + tableNum + '/' + MIGRATION_TABLES.length + '] ' + t.airtable + ' → ' + t.supabase);

    return fetchAllRecords(t.airtable, t.view || null).then(function(records) {
      if (records.length === 0) {
        console.log('  0 records (empty table)');
        stats.tablesEmpty++;
        stats.tableResults.push({ table: t.supabase, airtable: t.airtable, records: 0, inserted: 0, errors: 0, status: 'empty' });
        return processNext();
      }

      console.log('  Found ' + records.length + ' records in Airtable');

      // Map all records
      var fieldMap = FIELD_MAPS[t.mapper];
      var rows = [];
      var tableInserted = 0;
      var tableErrorCount = 0;

      for (var r = 0; r < records.length; r++) {
        try {
          var row;
          if (fieldMap) {
            row = buildRow(records[r], fieldMap);
          } else {
            // Fallback generic: airtable_id + all fields in data
            row = { airtable_id: records[r].id, data: records[r].fields || {} };
          }
          rows.push(row);
        } catch (mapErr) {
          tableErrorCount++;
          stats.errors++;
          console.error('  ERROR mapping record ' + (r + 1) + ' (' + records[r].id + '): ' + mapErr.message);
          tableErrors.push({ table: t.supabase, record: records[r].id, phase: 'map', error: mapErr.message });
        }
      }

      if (rows.length === 0) {
        console.log('  No rows to insert after mapping');
        stats.tableResults.push({ table: t.supabase, airtable: t.airtable, records: records.length, inserted: 0, errors: tableErrorCount, status: 'map_error' });
        stats.tablesFailed++;
        return processNext();
      }

      // Insert in batches of BATCH_SIZE, logging progress per batch
      var batchIdx = 0;
      var totalRows = rows.length;

      function insertNextBatch() {
        if (batchIdx >= totalRows) {
          // Done with this table
          console.log('  Completed: ' + tableInserted + ' inserted, ' + tableErrorCount + ' errors');
          stats.totalRecords += records.length;
          stats.inserted += tableInserted;
          if (tableErrorCount === 0) {
            stats.tablesOk++;
            stats.tableResults.push({ table: t.supabase, airtable: t.airtable, records: records.length, inserted: tableInserted, errors: 0, status: 'ok' });
          } else if (tableInserted > 0) {
            stats.tablesOk++;
            stats.tableResults.push({ table: t.supabase, airtable: t.airtable, records: records.length, inserted: tableInserted, errors: tableErrorCount, status: 'partial' });
          } else {
            stats.tablesFailed++;
            stats.tableResults.push({ table: t.supabase, airtable: t.airtable, records: records.length, inserted: 0, errors: tableErrorCount, status: 'failed' });
          }

          // Update sync_metadata (non-critical)
          return supabasePost('sync_metadata', [{
            table_name: t.supabase,
            last_sync_at: new Date().toISOString(),
            records_synced: tableInserted,
            status: 'migrated'
          }]).then(function() {
            return processNext();
          }).catch(function() {
            // sync_metadata update is non-critical
            return processNext();
          });
        }

        var batchEnd = Math.min(batchIdx + BATCH_SIZE, totalRows);
        var batch = rows.slice(batchIdx, batchEnd);
        var batchStart = batchIdx + 1;
        process.stdout.write('  Migrating ' + t.supabase + ': record ' + batchStart + ' of ' + totalRows + '\r');

        return supabasePost(t.supabase, batch).then(function() {
          tableInserted += batch.length;
          batchIdx = batchEnd;
          return insertNextBatch();
        }).catch(function(err) {
          console.error('\n  ERROR inserting batch ' + batchStart + '-' + batchEnd + ': ' + err.message);
          tableErrors.push({ table: t.supabase, phase: 'insert', batch: batchStart + '-' + batchEnd, error: err.message });

          // Try inserting records one-by-one for this failed batch
          var singleIdx = 0;
          function insertSingle() {
            if (singleIdx >= batch.length) {
              batchIdx = batchEnd;
              return insertNextBatch();
            }
            var singleRow = batch[singleIdx];
            singleIdx++;
            return supabasePost(t.supabase, [singleRow]).then(function() {
              tableInserted++;
              return insertSingle();
            }).catch(function(singleErr) {
              tableErrorCount++;
              stats.errors++;
              console.error('  ERROR record ' + singleRow.airtable_id + ': ' + singleErr.message.substring(0, 100));
              tableErrors.push({ table: t.supabase, record: singleRow.airtable_id, phase: 'insert_single', error: singleErr.message.substring(0, 200) });
              return insertSingle();
            });
          }
          return insertSingle();
        });
      }

      return insertNextBatch();
    }).catch(function(fetchErr) {
      console.error('  FETCH ERROR: ' + fetchErr.message);
      stats.tablesFailed++;
      stats.tableResults.push({ table: t.supabase, airtable: t.airtable, records: 0, inserted: 0, errors: 1, status: 'fetch_error', error: fetchErr.message });
      tableErrors.push({ table: t.supabase, phase: 'fetch', error: fetchErr.message });
      return processNext();
    });
  }

  function printSummary() {
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(' MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' Total Airtable records read:  ' + stats.totalRecords);
    console.log(' Records inserted to Supabase: ' + stats.inserted);
    console.log(' Total errors:                 ' + stats.errors);
    console.log(' Tables migrated OK:           ' + stats.tablesOk);
    console.log(' Tables failed:                ' + stats.tablesFailed);
    console.log(' Tables empty:                 ' + stats.tablesEmpty);
    console.log(' Finished: ' + new Date().toISOString());
    console.log('═══════════════════════════════════════════════════════════\n');

    // Table-by-table summary
    console.log('Table-by-table results:');
    console.log('─────────────────────────────────────────────────────────');
    for (var i = 0; i < stats.tableResults.length; i++) {
      var tr = stats.tableResults[i];
      var icon = tr.status === 'ok' ? '[OK]' : tr.status === 'partial' ? '[!!]' : tr.status === 'empty' ? '[--]' : '[XX]';
      var line = '  ' + icon + ' ' + tr.airtable + ' → ' + tr.table + ': ' + tr.inserted + '/' + tr.records + ' records';
      if (tr.errors > 0) line += ' (' + tr.errors + ' errors)';
      if (tr.error) line += ' — ' + tr.error.substring(0, 60);
      console.log(line);
    }

    // Error details
    if (tableErrors.length > 0) {
      console.log('\nError details (' + tableErrors.length + ' total):');
      console.log('─────────────────────────────────────────────────────────');
      for (var j = 0; j < Math.min(tableErrors.length, 50); j++) {
        var e = tableErrors[j];
        console.log('  [' + e.table + '] ' + e.phase + (e.record ? ' rec:' + e.record : '') + (e.batch ? ' batch:' + e.batch : '') + ' — ' + (e.error || '').substring(0, 100));
      }
      if (tableErrors.length > 50) {
        console.log('  ... and ' + (tableErrors.length - 50) + ' more errors');
      }
    }

    console.log('\nDone.');
    return Promise.resolve();
  }

  return processNext();
}

migrate().catch(function(e) {
  console.error('Migration fatal error:', e);
  process.exit(1);
});
