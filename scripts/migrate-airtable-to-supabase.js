#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Titus CRM — Airtable → Supabase Initial Data Migration
// Run: node scripts/migrate-airtable-to-supabase.js
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();
var { createClient } = require('@supabase/supabase-js');

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

var supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

var AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID;
var RATE_LIMIT_MS = 260; // Airtable: 5 req/sec
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

// ─── Supabase helpers ────────────────────────────────────────
async function upsertBatch(tableName, rows) {
  if (!rows.length) return;
  // Supabase JS client max ~1000 rows per request; batch at 200
  for (var i = 0; i < rows.length; i += 200) {
    var batch = rows.slice(i, i + 200);
    var { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: 'airtable_id', ignoreDuplicates: false });
    if (error) throw new Error('Supabase upsert ' + tableName + ': ' + error.message);
  }
}

// ─── Field mappers (Airtable record → Supabase row) ─────────
function av(v) { return Array.isArray(v) ? v[0] || '' : v || ''; }
function numVal(v) { return parseFloat(Array.isArray(v) ? v[0] : v) || 0; }
function arrVal(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
// Sanitize dates — returns null for invalid/empty values
function safeDate(v) {
  if (!v) return null;
  var s = Array.isArray(v) ? v[0] : v;
  if (!s || typeof s !== 'string') return null;
  s = s.trim();
  if (!s || s.length < 6) return null;
  // Accept ISO dates (YYYY-MM-DD) and common formats
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  // Return ISO date string for DATE columns, full ISO for TIMESTAMPTZ
  if (s.includes('T') || s.includes(' ')) return d.toISOString();
  return d.toISOString().split('T')[0];
}
function jsonAttachments(v) {
  if (!Array.isArray(v)) return [];
  return v.map(function(a) {
    return { url: a.url || '', name: a.filename || '', size: a.size || 0, type: a.type || '' };
  });
}

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
      dob: safeDate(f['DOB'] || f['Date of Birth']),
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
      date_of_birth: safeDate(f['Date of Birth'] || f['DOB']),
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
      ndis_plan_start_date: safeDate(f['NDIS Plan Start Date']),
      ndis_plan_expiry_date: safeDate(f['NDIS Plan Expiry Date']),
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
      date: safeDate(f['Date'] || f['Created']),
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
    return {
      airtable_id: r.id,
      unique_ref: f['Unique Ref #'] || '',
      client_name: av(f['Client Name'] || f['Client Full Name'] || ''),
      client_full_name: av(f['Client Full Name'] || ''),
      staff_name: av(f['Staff Name'] || ''),
      staff_email: f['Staff Email'] || '',
      start_shift: safeDate(f['Start Shift']),
      end_shift: safeDate(f['End Shift']),
      day_type: f['Day Type'] || '',
      total_hours_decimal: numVal(f['Total Hours (Decimal)']),
      total_hours_hmm: f['Total Hours (H:MM)'] || '',
      type_of_shift: f['Type of Shift (Active or Non Active)'] || '',
      shift_status: f['Shift Status'] || '',
      has_sleepover: f['Has Sleepover'] || '',
      sil_or_cas: String(f['SIL or CAS?'] || ''),
      progress_note_completed: f['Progress Note Completed?'] || false,
      support_item_name: f['Support Item Name'] || '',
      charge_per_hour: numVal(f['Charge per hour']),
      support_category_pace: f['Support Category Number (PACE)'] || '',
      broken_shift: f['Broken Shift?'] || ''
    };
  },

  progress_notes: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      support_worker_name: f['Support Workers Name'] || '',
      client_name: av(f['Client Name'] || ''),
      start_datetime: safeDate(f['Start Date and Time']),
      end_datetime: safeDate(f['End Date and Time']),
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
      incident_datetime: safeDate(f['Date & Time of Incident']),
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
      plan_start_date: safeDate(f['Plan Start Date'] || f['Plan Start']),
      plan_end_date: safeDate(f['Plan End Date'] || f['Plan End']),
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
      due_date: safeDate(f['Due Date'] || f['Due Date for task to be completed']),
      date_completed: safeDate(f['Date Completed']),
      project_name: av(f['Project'] || f['Project Name'] || ''),
      created_by: av(f['Created By'] || ''),
      created_date: safeDate(f['Created Date  & Time 2025'] || f['Created Date']),
      type_of_update: av(f['Type of Update (Multi-select)'] || f['Type of Update'] || ''),
      method_of_contact: f['Method of Contact'] || '',
      description: f['Detailed Description'] || '',
      notes: f['Notes'] || f['Description'] || '',
      follow_up_required: f['Is there a follow up required?'] || '',
      follow_up_details: f['Details of follow up'] || '',
      actions_taken: f['Actions taken to Complete task'] || '',
      is_recurring: f['Recurring Task?'] || '',
      recurring_frequency: f['Frequency of Recurring Task'] || '',
      next_due_date: safeDate(f['Next Due Date to occur'])
    };
  },

  courses: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      name: f['Name'] || f['Course Name'] || '',
      category: f['Category'] || '',
      description: f['Course Description'] || f['Description'] || '',
      frequency_months: f['Frequency of Delivery (months)'] || f['Frequency'] || '',
      status: f['Status of Course'] || f['Status'] || '',
      duration_minutes: f['Time in Minutes'] || f['Duration'] || '',
      module_count: parseInt(f['Module Count'] || f['Modules'] || 0) || 0
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
      purchase_date: safeDate(f['Purchase Date']),
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

  ndis_price_guide: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      support_item_number: (f['Support Item Number'] || '').trim(),
      support_item_name: (f['Support Item Name'] || '').trim(),
      support_category_name: (f['Support Category Name'] || f['Support Category Name (PACE)'] || '').trim(),
      registration_group_number: f['Registration Group Number'] || '',
      unit: f['Unit'] || 'H',
      charge_per_hour: numVal(f['Charge per hour']),
      remote_rate: numVal(f[' Remote '] || f['Remote']),
      very_remote_rate: numVal(f[' Very Remote '] || f['Very Remote'])
    };
  },

  knowledge_base: function(r) {
    var f = r.fields || {};
    return {
      airtable_id: r.id,
      name: f['Name'] || f['Title'] || f['Document Name'] || '',
      title: f['Title'] || '',
      category: f['Category'] || f['Type'] || '',
      content: f['Content'] || f['Body'] || f['Text'] || '',
      body: f['Body'] || '',
      summary: f['Summary'] || '',
      keywords: f['Keywords'] || '',
      tags: f['Tags'] || ''
    };
  },

  // Generic mapper for JSONB-based tables
  generic: function(r) {
    return {
      airtable_id: r.id,
      data: r.fields || {}
    };
  }
};

// ─── TABLE MIGRATION MAP ─────────────────────────────────────
var MIGRATION_TABLES = [
  { airtable: 'All Contacts', supabase: 'contacts', mapper: 'contacts', view: 'Active Contacts 2026' },
  { airtable: 'Clients', supabase: 'clients', mapper: 'clients', view: 'Client Active View' },
  { airtable: 'Leads', supabase: 'leads', mapper: 'leads' },
  { airtable: 'Rosters 2025', supabase: 'rosters', mapper: 'rosters' },
  { airtable: 'Progress Notes', supabase: 'progress_notes', mapper: 'progress_notes' },
  { airtable: 'IR Reports 2025', supabase: 'ir_reports', mapper: 'ir_reports' },
  { airtable: 'Client Core Budgets', supabase: 'client_core_budgets', mapper: 'client_core_budgets' },
  { airtable: 'SIL Properties', supabase: 'sil_properties', mapper: 'generic' },
  { airtable: 'Client Calendar', supabase: 'client_calendar', mapper: 'generic' },
  { airtable: 'Support Plan - 2025', supabase: 'support_plans', mapper: 'generic' },
  { airtable: 'Tasks', supabase: 'tasks', mapper: 'tasks' },
  { airtable: 'Course List', supabase: 'courses', mapper: 'courses' },
  { airtable: 'Course Enrollments', supabase: 'course_enrollments', mapper: 'generic' },
  { airtable: 'Course Modules', supabase: 'course_modules', mapper: 'generic' },
  { airtable: 'Course Lessons', supabase: 'course_lessons', mapper: 'generic' },
  { airtable: 'Course Quizzes', supabase: 'course_quizzes', mapper: 'generic' },
  { airtable: 'Course QuizQuestions', supabase: 'course_quiz_questions', mapper: 'generic' },
  { airtable: 'Receipts', supabase: 'receipts', mapper: 'receipts' },
  { airtable: 'Employee Contact History', supabase: 'employee_contact_history', mapper: 'generic' },
  { airtable: 'Client Contact History', supabase: 'client_contact_history', mapper: 'generic' },
  { airtable: 'Messenger Knowledge Base', supabase: 'knowledge_base', mapper: 'knowledge_base' },
  { airtable: 'SW Independant Contractor Rates', supabase: 'sw_contractor_rates', mapper: 'generic' },
  { airtable: 'TFN Pay Rates', supabase: 'tfn_pay_rates', mapper: 'generic' },
  { airtable: 'Staff Availability', supabase: 'staff_availability', mapper: 'generic' },
  { airtable: 'RoC Participants', supabase: 'roc_participants', mapper: 'generic' },
  { airtable: 'RoC Shifts', supabase: 'roc_shifts', mapper: 'generic' },
  { airtable: 'Client Sleep Chart', supabase: 'client_sleep_chart', mapper: 'generic' },
  { airtable: 'Bowel Chart', supabase: 'bowel_chart', mapper: 'generic' },
  { airtable: 'Fluid Intake Diary', supabase: 'fluid_intake_diary', mapper: 'generic' },
  { airtable: 'Client Consumables', supabase: 'client_consumables', mapper: 'generic' },
  { airtable: 'QR Code Data - Behaviours', supabase: 'client_behaviours', mapper: 'generic' },
  { airtable: 'Document Signing Requests', supabase: 'document_signing_requests', mapper: 'generic' },
  { airtable: 'Employment Documents', supabase: 'employment_documents', mapper: 'generic' },
  { airtable: 'Client Docs', supabase: 'client_docs', mapper: 'generic' },
  { airtable: 'NDIS Price Guide 2025 - 2026', supabase: 'ndis_price_guide', mapper: 'ndis_price_guide' },
  { airtable: 'Chat Conversations', supabase: 'chat_conversations', mapper: 'generic' },
  { airtable: 'Chat Members', supabase: 'chat_members', mapper: 'generic' },
  { airtable: 'Chat Messages', supabase: 'chat_messages', mapper: 'generic' },
  { airtable: 'Push Subscriptions', supabase: 'push_subscriptions', mapper: 'generic' },
  { airtable: 'Client Media', supabase: 'client_media', mapper: 'generic' },
  { airtable: 'Weekly Stakeholder Reports', supabase: 'weekly_stakeholder_reports', mapper: 'generic' },
  { airtable: 'Candidate Interactions', supabase: 'candidate_interactions', mapper: 'generic' },
  { airtable: 'Company Files', supabase: 'company_files', mapper: 'generic' }
];

// ─── BUILD AIRTABLE ID MAP ───────────────────────────────────
function buildIdMap(records, supabaseTable) {
  var maps = records.map(function(r) {
    return {
      airtable_id: r.airtable_id || r.id,
      supabase_table: supabaseTable,
      supabase_id: r.id || r.airtable_id
    };
  });
  if (maps.length > 0) {
    return upsertBatch('airtable_id_map', maps).catch(function(e) {
      // ID map is non-critical
      console.log('  (ID map upsert skipped: ' + e.message.substring(0, 60) + ')');
    });
  }
  return Promise.resolve();
}

// ─── MAIN MIGRATION ──────────────────────────────────────────
async function migrate() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Titus CRM — Airtable → Supabase Migration');
  console.log(' Started: ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  var stats = { total: 0, success: 0, failed: 0, tables: [] };

  for (var i = 0; i < MIGRATION_TABLES.length; i++) {
    var t = MIGRATION_TABLES[i];
    process.stdout.write('[' + (i + 1) + '/' + MIGRATION_TABLES.length + '] ' + t.airtable + ' → ' + t.supabase + '...');

    try {
      var records = await fetchAllRecords(t.airtable, t.view || null);
      if (records.length === 0) {
        console.log(' 0 records (empty table)');
        stats.tables.push({ table: t.supabase, records: 0, status: 'empty' });
        continue;
      }

      var mapper = MAPPERS[t.mapper] || MAPPERS.generic;
      var rows = records.map(mapper);

      await upsertBatch(t.supabase, rows);
      stats.total += rows.length;
      stats.success++;
      stats.tables.push({ table: t.supabase, records: rows.length, status: 'ok' });
      console.log(' ' + rows.length + ' records migrated');

      // Update sync metadata
      await supabase.from('sync_metadata').upsert([{
        table_name: t.supabase,
        last_sync_at: new Date().toISOString(),
        records_synced: rows.length,
        status: 'migrated'
      }], { onConflict: 'table_name' }).catch(function() {});

    } catch (e) {
      stats.failed++;
      stats.tables.push({ table: t.supabase, records: 0, status: 'error', error: e.message });
      console.log(' ERROR: ' + e.message.substring(0, 80));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' Migration Complete');
  console.log(' Total records: ' + stats.total);
  console.log(' Tables OK: ' + stats.success + ' | Failed: ' + stats.failed);
  console.log(' Finished: ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  // Print table-by-table summary
  console.log('Table Summary:');
  stats.tables.forEach(function(t) {
    var icon = t.status === 'ok' ? '[OK]' : t.status === 'empty' ? '[--]' : '[!!]';
    console.log('  ' + icon + ' ' + t.table + ': ' + t.records + ' records' + (t.error ? ' (' + t.error.substring(0, 50) + ')' : ''));
  });
}

migrate().catch(function(e) {
  console.error('Migration fatal error:', e);
  process.exit(1);
});
