#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Titus CRM — Airtable ↔ Supabase Sync Bridge (v2)
// Uses detailed field mappers (not generic JSONB) + tenant_id
// Run: node scripts/sync-airtable-to-supabase.js
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();

var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
var SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
var AIRTABLE_API_KEY = (process.env.AIRTABLE_API_KEY || '').trim();
var AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg3Cz7mEsGA6IOI';
var SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes
var TENANT_SLUG = process.env.TENANT_SLUG || 'delta-community';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !AIRTABLE_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, AIRTABLE_API_KEY');
  process.exit(1);
}

var AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID;
var RATE_LIMIT_MS = 260;
var lastReqTime = 0;
var tenantId = null; // Resolved on startup from TENANT_SLUG

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
      if (data.error) { console.error('  Airtable error:', JSON.stringify(data.error)); return all; }
      all = all.concat(data.records || []);
      if (data.offset) return page(data.offset);
      return all;
    });
  }
  return page(null);
}

// ─── Supabase helpers ────────────────────────────────────────

function supabasePost(tableName, body) {
  var url = SUPABASE_URL + '/rest/v1/' + tableName;
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase ' + r.status + ': ' + t.substring(0, 200)); });
    if (r.status === 204) return [];
    return r.json().catch(function() { return []; });
  });
}

function supabaseGet(path) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  return fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    }
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase GET ' + r.status + ': ' + t.substring(0, 200)); });
    return r.json();
  });
}

function upsertBatch(tableName, rows) {
  if (!rows.length) return Promise.resolve();
  var batches = [];
  for (var i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
  return batches.reduce(function(chain, batch) {
    return chain.then(function() { return supabasePost(tableName, batch); });
  }, Promise.resolve());
}

// ─── Field mappers (matching migrate-airtable-to-supabase.js) ─

function av(v) { return Array.isArray(v) ? v[0] || '' : v || ''; }
function numVal(v) { return parseFloat(Array.isArray(v) ? v[0] : v) || 0; }
function arrVal(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

var MAPPERS = {
  contacts: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      full_name: f['Full Name'] || '',
      first_name: f['First Name'] || '',
      last_name: f['Last Name'] || '',
      email: f['Email'] || '',
      phone: f['Phone'] || '',
      mobile: f['Mobile'] || '',
      formatted_mobile: f['Formatted Mobile'] || '',
      address: f['Address'] || '',
      suburb: f['Suburb'] || '',
      state: f['State'] || '',
      postcode: f['Postcode'] || '',
      dob: f['DOB'] || f['Date of Birth'] || null,
      type_of_contact: f['Type of Contact (Single Select)'] || '',
      type_of_employment: f['Type of Employment'] || '',
      job_title: f['Job Title'] || '',
      department: f['Department'] || '',
      team: f['Team'] || '',
      status: f['Status'] || 'Active',
      training_status: f['Training Status'] || '',
      photo_url: (Array.isArray(f['PIC - SW Photo']) && f['PIC - SW Photo'].length > 0) ? f['PIC - SW Photo'][0].url : '',
      emergency_contact: f['Emergency Contact'] || '',
      emergency_phone: f['Emergency Phone'] || '',
      ndis_number: f['NDIS Number'] || ''
    };
  },

  clients: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      client_name: av(f['Client Name'] || f['Full Name'] || ''),
      full_name: av(f['Full Name'] || ''),
      first_name: f['First Name'] || '',
      last_name: f['Last Name'] || '',
      account_type: av(f['Account Type: Active or Inactive or Propsect'] || f['Account Type: Active or Inactive or Prospect'] || f['Account Type'] || ''),
      phone: av(f['Phone'] || f['Mobile'] || ''),
      mobile: f['Mobile'] || '',
      email: av(f['Email'] || f['Email Address'] || ''),
      ndis_number: av(f['NDIS Number'] || f['NDIS Ref'] || ''),
      ndis_ref: av(f['NDIS Ref'] || ''),
      suburb: av(f['Suburb'] || f['Location'] || ''),
      location: f['Location'] || '',
      sil_or_cas: av(f['SIL or CAS?'] || f['SIL or CAS - Client'] || ''),
      date_of_birth: f['Date of Birth'] || f['DOB'] || null,
      gender: f['Gender'] || '',
      address: av(f['Address'] || f['Home Address'] || f['Street Address'] || ''),
      home_address: f['Home Address'] || '',
      street_address: f['Street Address'] || '',
      state: f['State'] || '',
      postcode: f['Postcode'] || '',
      emergency_contact: av(f['Emergency Contact'] || f['Emergency Contact Name'] || ''),
      emergency_phone: av(f['Emergency Phone'] || f['Emergency Contact Phone'] || ''),
      emergency_email: av(f['Emergency Email'] || f['Emergency Contact Email'] || ''),
      emergency_relationship: av(f['Emergency Relationship'] || f['Emergency Relationship to Client'] || ''),
      nominee: av(f['Nominee or Guardian'] || f['Nominee or Legal Guardian'] || ''),
      nominee_phone: f['Nominee Phone'] || '',
      nominee_email: f['Nominee Email'] || '',
      plan_manager: av(f['Plan Manager (from Plan Manager Link)'] || f['Plan Manager'] || ''),
      plan_manager_email: av(f['Plan Manager Email (from Plan Manager Link)'] || ''),
      plan_manager_phone: av(f['Plan Manager Phone (from Plan Manager Link)'] || ''),
      plan_manager_company: av(f['Company Name (from Plan Manager Link)'] || ''),
      support_coordinator: av(f['Support Coordinator (from Support Coordinator Link)'] || f['Support Coordinator'] || ''),
      support_coordinator_email: av(f['Support Coordinator Email (from Support Coordinator Link)'] || ''),
      support_coordinator_phone: av(f['Phone (from Support Coordinator )'] || ''),
      support_coordinator_company: av(f['Company Name (from Support Coordinator Link)'] || f['Organisation (from Support Coordinator Link)'] || ''),
      ndis_plan_type: av(f['Type of NDIS Plan Grouped'] || f['Type of NDIS Plan'] || ''),
      ndis_plan_start_date: f['NDIS Plan Start Date'] || null,
      ndis_plan_expiry_date: f['NDIS Plan Expiry Date'] || null,
      core_budget_sil: numVal(f['Core Budget (SIL)']),
      core_budget_community_access: numVal(f['Core Budget (Community Access)']),
      core_budget_transport: numVal(f['Core Budget (Transport)']),
      km_allowance: av(f['KM Allowance'] || f["KM's Allowance per week"] || ''),
      type_of_disability: av(f['Type of Disability'] || ''),
      general_background: av(f['General Background Info'] || ''),
      ndis_goals: av(f['NDIS Client Goals as outlined in their plan'] || f['NDIS Goals'] || ''),
      allergies: av(f['List the Allergies or Alerts & provide as much details here'] || f['Allergies'] || ''),
      has_allergies: av(f['Does the Client have any Allergies or Alerts?'] || ''),
      communication_aids: av(f['Do they use communication aids?'] || ''),
      communication_details: av(f['Tell us more about your communication aids.'] || ''),
      personal_care: av(f['Is there Personal Care involved in their Support?'] || ''),
      pbsp_yes_no: av(f['PBSP? Yes or No'] || ''),
      pbsp_prac_name: av(f['PBSP Prac Name'] || f['Behaviour Practitioner'] || ''),
      pbsp_prac_email: f['PBSP Prac Email'] || '',
      pbsp_phone: f['PBSP Phone'] || '',
      pbsp_strategies: av(f['PBSP Strategies Summary 2025'] || ''),
      known_triggers: av(f['Any known triggers'] || ''),
      support_ratio: av(f['Support Ratio'] || ''),
      gender_of_workers: av(f['Gender of Support Workers'] || ''),
      required_staff_skills: arrVal(f['Required Staff Skills']),
      opg_officer: av(f['OPG Officer'] || f['Public Guardian'] || ''),
      opg_phone: av(f['OPG Phone'] || ''),
      opg_email: av(f['OPG Email'] || ''),
      own_decision_maker: av(f['Is the Client their own decision maker?'] || ''),
      medical_decisions: av(f['Medical Decisions'] || ''),
      financial_decisions: av(f['Financial Decisions'] || ''),
      ndis_accommodation_decisions: av(f['NDIS Supports\n Plan & Accommodation decisions'] || f['NDIS Supports Plan & Accommodation decisions'] || ''),
      living_arrangements_decisions: av(f['Living Arrangements decisions'] || ''),
      legal_decisions: av(f['Legal Decisions'] || '')
    };
  },

  leads: function(r) {
    var f = r.fields || {};
    var leadName = f['Lead Name or Initials'] || f['Lead Name'] || f['Client Name'] || f['Full Name'] || '';
    if (!leadName) leadName = ((f['First Name'] || '') + ' ' + (f['Last Name'] || '')).trim();
    if (!leadName && f['Name'] && isNaN(f['Name'])) leadName = f['Name'];
    var refNum = f['Name'] || '';
    if (!isNaN(refNum)) refNum = '#' + refNum; else refNum = '';
    return {
      airtable_id: r.id,
      ref_number: refNum,
      lead_name: leadName,
      full_name: f['Full Name'] || '',
      first_name: f['First Name'] || '',
      last_name: f['Last Name'] || '',
      email: f['Email'] || f['Email Address'] || '',
      phone: f['Phone'] || f['Mobile'] || '',
      mobile: f['Mobile'] || '',
      source: av(f['Source'] || f['Lead Source'] || ''),
      stage: av(f['Stage'] || f['Lead Stage'] || f['Status'] || 'Enquiry'),
      status: f['Status'] || 'New',
      date: f['Date'] || f['Created'] || null,
      notes: f['Notes'] || '',
      comments: f['Comments'] || '',
      suburb: av(f['Suburb'] || f['City'] || ''),
      disability_type: av(f['Type of Disability'] || ''),
      ndis_number: av(f['NDIS Number'] || ''),
      service_type: av(f['Service Type'] || f['SIL or CAS?'] || ''),
      sil_or_cas: av(f['SIL or CAS?'] || ''),
      assignee: av(f['Assignee'] || f['Assigned To'] || ''),
      sc_name: av(f['Support Coordinators Name'] || ''),
      sc_email: av(f['Support Coordinators Email'] || ''),
      sc_mobile: av(f['Support Coordinators Mobile'] || ''),
      organisation_name: f['Organisation Name'] || '',
      contact_name: f['Contact Name'] || '',
      enquiry_type: f['Enquiry Type'] || '',
      message: f['Message'] || '',
      number_of_participants: parseInt(f['Number of Participants']) || null,
      number_of_staff: parseInt(f['Number of Staff']) || null
    };
  },

  rosters: function(r) {
    var f = r.fields || {};
    var staffName = av(f['Staff Name'] || '');
    var staffEmail = f['Staff Email'] || '';
    var totalHoursDecimal = numVal(f['Total Hours (Decimal)']);
    var shiftStatus = f['Shift Status'] || '';
    var typeOfShift = f['Type of Shift (Active or Non Active)'] || '';
    return {
      airtable_id: r.id,
      unique_ref: f['Unique Ref #'] || '',
      client_name: av(f['Client Name'] || f['Client Full Name'] || ''),
      client_full_name: av(f['Client Full Name'] || ''),
      staff_name: staffName,
      staff_email: staffEmail,
      start_shift: f['Start Shift'] || null,
      end_shift: f['End Shift'] || null,
      day_type: f['Day Type'] || '',
      total_hours_decimal: totalHoursDecimal,
      total_hours_hmm: f['Total Hours (H:MM)'] || '',
      type_of_shift: typeOfShift,
      shift_status: shiftStatus,
      has_sleepover: f['Has Sleepover'] || '',
      sil_or_cas: String(f['SIL or CAS?'] || ''),
      progress_note_completed: f['Progress Note Completed?'] || false,
      support_item_name: f['Support Item Name'] || '',
      charge_per_hour: numVal(f['Charge per hour']),
      support_category_pace: f['Support Category Number (PACE)'] || '',
      broken_shift: f['Broken Shift?'] || '',
      // SaaS columns (copied from legacy for compatibility)
      worker_name: staffName,
      worker_email: staffEmail,
      total_hours: totalHoursDecimal,
      status: shiftStatus || 'unconfirmed',
      shift_type: typeOfShift
    };
  },

  progress_notes: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      support_worker_name: f['Support Workers Name'] || '',
      client_name: av(f['Client Name'] || ''),
      start_datetime: f['Start Date and Time'] || null,
      end_datetime: f['End Date and Time'] || null,
      notes_summary: f['Notes/Summary'] || '',
      total_hours: f['Total Hours'] || '',
      transport: f['Transport'] || '',
      kms: f['KMs'] || ''
    };
  },

  ir_reports: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      unique_ir_ref: f['Unique IR #'] || '',
      person_completing: f['Person completing IR'] || '',
      incident_datetime: f['Date & Time of Incident'] || null,
      description: f['Description'] || '',
      severity: f['Severity'] || 'Minor',
      status: f['Status'] || 'Open',
      client_name: av(f['Client Name'] || ''),
      incident_summary: av(f['Summarise the incident and/or allegation (without reference to peoples names).'] || ''),
      is_reportable: av(f['Is this a Reportable Incident to the NDIS Quality Safeguards Commission??'] || '')
    };
  },

  client_core_budgets: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      unique_ref: f['Unique Ref'] || '',
      client_name: av(f['Client Name'] || ''),
      ndis_ref: av(f['NDIS Ref # (from Client Name)'] || f['NDIS Ref'] || f['NDIS Number'] || ''),
      ndis_plan_type: av(f['Type of NDIS Plan (from Client Name)'] || f['Plan Type'] || ''),
      account_type: av(f['Account Type:  Active or Inactive or Propsect (from Client Name)'] || f['Account Type'] || ''),
      sil_or_cas: av(f['SIL or CAS? (from Client Name)'] || f['SIL or CAS'] || ''),
      core_budget_sil: numVal(f['Core Budget (SIL) (from Client Name)'] || f['Core Budget (SIL)']),
      core_budget_community_access: numVal(f['Core Budget (Community Access) (from Client Name)'] || f['Core Budget (Community Access)']),
      core_budget_transport: numVal(f['Core Budget (Transport) (from Client Name)'] || f['Core Budget (Transport)']),
      sil_budget: numVal(f['SIL Budget']),
      sil_used: numVal(f['SIL Used']),
      community_access_budget: numVal(f['Community Access Budget']),
      community_access_used: numVal(f['Community Access Used']),
      transport_budget: numVal(f['Transport Budget']),
      transport_used: numVal(f['Transport Used']),
      core_other_budget: numVal(f['Core Other Budget']),
      capacity_building_budget: numVal(f['Capacity Building Budget']),
      total_budget: numVal(f['Total Budget']),
      invoice_amount: numVal(f['Invoice Amount']),
      from_which_budget: f['from which Budget?'] || f['from which Budget'] || '',
      line_items: f['Line Items from SOS Agreement'] || '',
      line_items_uploaded: f['Line Items from SOS Agreement uploaded'] || false,
      plan_start_date: f['Plan Start Date'] || f['Plan Start'] || null,
      plan_end_date: f['Plan End Date'] || f['Plan End'] || null,
      plan_manager: f['Plan Manager'] || '',
      ndis_number: av(f['NDIS Number'] || f['NDIS #'] || ''),
      notes: f['Notes'] || ''
    };
  },

  tasks: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      ref_number: av(f['Reference #'] || f['Ref Number'] || f['Name'] || ''),
      task_name: av(f['Task Name'] || f['Name'] || f['Title'] || ''),
      client_name: av(f['Client Name'] || f['Client Full Name (from Client Name)'] || ''),
      assignee: av(f['Assignee'] || f['Assigned To'] || f['Full Name (from Assigned to Email)'] || ''),
      status: av(f['Status'] || f['Task Status'] || 'Not Started'),
      priority: av(f['Priority'] || f['Task Priority'] || 'Medium'),
      due_date: f['Due Date'] || f['Due Date for task to be completed'] || null,
      date_completed: f['Date Completed'] || null,
      project_name: av(f['Project'] || f['Project Name'] || ''),
      created_by: av(f['Created By'] || ''),
      created_date: f['Created Date  & Time 2025'] || f['Created Date'] || null,
      type_of_update: av(f['Type of Update (Multi-select)'] || f['Type of Update'] || ''),
      method_of_contact: f['Method of Contact'] || '',
      description: f['Detailed Description'] || '',
      notes: f['Notes'] || f['Description'] || '',
      follow_up_required: f['Is there a follow up required?'] || '',
      follow_up_details: f['Details of follow up'] || '',
      actions_taken: f['Actions taken to Complete task'] || '',
      is_recurring: f['Recurring Task?'] || '',
      recurring_frequency: f['Frequency of Recurring Task'] || '',
      next_due_date: f['Next Due Date to occur'] || null
    };
  },

  receipts: function(r) {
    var f = r.fields || {};
    var uploads = f['Receipt Upload'] || [];
    var receiptUrl = (Array.isArray(uploads) && uploads.length > 0) ? uploads[0].url || '' : '';
    return {
      airtable_id: r.id,
      unique_receipt_id: f['Unique ID'] || '',
      supplier_name: f['Supplier Name'] || '',
      purchase_date: f['Purchase Date'] || null,
      purchase_date_formatted: f['Purchase Date (Formula)'] || '',
      total_amount: numVal(f['Total Receipt Amount']),
      gst_amount: numVal(f['GST Amount']),
      currency: f['Currency'] || 'AUD',
      purpose: arrVal(f['Purpose of Purchase']),
      staff_email: f['Staff Name'] || '',
      staff_name: av(f['Full Name (from Staff Name)'] || ''),
      job_title: av(f['Job Title (from Staff Name)'] || ''),
      comments: f['Comments'] || '',
      receipt_url: receiptUrl,
      ai_summary: f['Summary (Receipt Upload)'] || '',
      reimbursement: f['Reimbursement?'] || 'NO'
    };
  },

  knowledge_base: function(r) {
    var f = r.fields || {};
    var nameVal = f['Name'] || f['Title'] || f['Document Name'] || '';
    var contentVal = f['Content'] || f['Body'] || f['Text'] || '';
    return {
      airtable_id: r.id,
      name: nameVal,
      title: f['Title'] || '',
      category: f['Category'] || f['Type'] || '',
      content: contentVal,
      body: f['Body'] || '',
      summary: f['Summary'] || '',
      keywords: f['Keywords'] || '',
      tags: f['Tags'] || '',
      // SaaS columns (copied from legacy for chatbot compatibility)
      filename: nameVal,
      content_text: contentVal
    };
  },

  // Fallback for tables without detailed mappers
  generic: function(r) {
    return {
      airtable_id: r.id,
      data: r.fields || {}
    };
  }
};

// ─── Tables to sync (with mapper assignments) ────────────────

var SYNC_TABLES = [
  { airtable: 'All Contacts', supabase: 'contacts', mapper: 'contacts', view: 'Active Contacts 2026' },
  { airtable: 'Clients', supabase: 'clients', mapper: 'clients', view: 'Client Active View' },
  { airtable: 'Leads', supabase: 'leads', mapper: 'leads' },
  { airtable: 'Rosters 2025', supabase: 'rosters', mapper: 'rosters' },
  { airtable: 'Progress Notes', supabase: 'progress_notes', mapper: 'progress_notes' },
  { airtable: 'IR Reports 2025', supabase: 'ir_reports', mapper: 'ir_reports' },
  { airtable: 'Client Core Budgets', supabase: 'client_core_budgets', mapper: 'client_core_budgets' },
  { airtable: 'Tasks', supabase: 'tasks', mapper: 'tasks' },
  { airtable: 'Receipts', supabase: 'receipts', mapper: 'receipts' },
  { airtable: 'Staff Availability', supabase: 'staff_availability', mapper: 'generic' },
  { airtable: 'Course Enrollments', supabase: 'course_enrollments', mapper: 'generic' },
  { airtable: 'Client Calendar', supabase: 'client_calendar', mapper: 'generic' },
  { airtable: 'Messenger Knowledge Base', supabase: 'knowledge_base', mapper: 'knowledge_base' }
];

// ─── Resolve tenant_id on startup ────────────────────────────

async function loadTenantId() {
  var rows = await supabaseGet('tenants?slug=eq.' + encodeURIComponent(TENANT_SLUG) + '&select=id');
  if (!rows || !rows.length) {
    console.error('[SYNC] Tenant not found: ' + TENANT_SLUG);
    console.error('[SYNC] Run saas-schema.sql first to seed the Delta tenant.');
    process.exit(1);
  }
  tenantId = rows[0].id;
  console.log('[SYNC] Tenant: ' + TENANT_SLUG + ' (' + tenantId + ')');
}

// ─── Single sync cycle ───────────────────────────────────────

var syncRunning = false;

async function syncCycle() {
  if (syncRunning) { console.log('[SYNC] Skipping — previous cycle still running'); return; }
  syncRunning = true;
  var cycleStart = Date.now();
  console.log('[SYNC] Cycle started at ' + new Date().toISOString());

  var totalSynced = 0;
  var errors = 0;

  for (var i = 0; i < SYNC_TABLES.length; i++) {
    var t = SYNC_TABLES[i];
    try {
      var records = await fetchAllRecords(t.airtable, t.view || null);
      if (!records.length) continue;

      // Use the detailed field mapper (not generic JSONB)
      var mapper = MAPPERS[t.mapper] || MAPPERS.generic;
      var rows = records.map(function(r) {
        var row = mapper(r);
        // Add tenant_id to every row for SaaS multi-tenancy
        row.tenant_id = tenantId;
        return row;
      });

      await upsertBatch(t.supabase, rows);
      totalSynced += rows.length;

      // Update sync metadata
      await supabasePost('sync_metadata', [{
        table_name: t.supabase,
        last_sync_at: new Date().toISOString(),
        records_synced: rows.length,
        status: 'synced'
      }]).catch(function() {});

    } catch (e) {
      errors++;
      console.error('[SYNC] Error syncing ' + t.airtable + ':', e.message.substring(0, 80));
      await supabasePost('sync_metadata', [{
        table_name: t.supabase,
        last_sync_at: new Date().toISOString(),
        records_synced: 0,
        status: 'error',
        error_message: e.message.substring(0, 500)
      }]).catch(function() {});
    }
  }

  var elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log('[SYNC] Cycle complete: ' + totalSynced + ' records synced, ' + errors + ' errors, ' + elapsed + 's');
  syncRunning = false;
}

// ─── Start loop ──────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Titus CRM — Airtable ↔ Supabase Sync Bridge v2');
  console.log(' Interval: ' + (SYNC_INTERVAL_MS / 1000) + 's | Tables: ' + SYNC_TABLES.length);
  console.log(' Mappers: detailed field mappers (structured columns)');
  console.log('═══════════════════════════════════════════════════════════');

  // Resolve tenant_id before first sync
  await loadTenantId();

  // Run immediately, then on interval
  await syncCycle();
  setInterval(syncCycle, SYNC_INTERVAL_MS);
}

main().catch(function(e) {
  console.error('[SYNC] Fatal error:', e.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', function() {
  console.log('\n[SYNC] Shutting down...');
  process.exit(0);
});
process.on('SIGTERM', function() {
  console.log('\n[SYNC] Shutting down...');
  process.exit(0);
});
