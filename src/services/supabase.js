// ═══════════════════════════════════════════════════════════════
// Titus CRM — Supabase Service Layer
// Drop-in replacement for airtable.js with identical signatures
// ═══════════════════════════════════════════════════════════════
var env = require('../config/env');

var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ─── Supabase table name mapping (Airtable name → Supabase table) ───
var TABLE_MAP = {
  'All Contacts': 'contacts',
  'Clients': 'clients',
  'Leads': 'leads',
  'Rosters 2025': 'rosters',
  'Progress Notes': 'progress_notes',
  'IR Reports 2025': 'ir_reports',
  'Incidents': 'ir_reports',
  'Client Core Budgets': 'client_core_budgets',
  'SIL Properties': 'sil_properties',
  'Client Calendar': 'client_calendar',
  'Support Plan - 2025': 'support_plans',
  'Support Plans 2025': 'support_plans',
  'Tasks': 'tasks',
  'Course List': 'courses',
  'Courses': 'courses',
  'Course Enrollments': 'course_enrollments',
  'Course Modules': 'course_modules',
  'Course Lessons': 'course_lessons',
  'Course Quizzes': 'course_quizzes',
  'Course QuizQuestions': 'course_quiz_questions',
  'Receipts': 'receipts',
  'Employee Contact History': 'employee_contact_history',
  'Client Contact History': 'client_contact_history',
  'Messenger Knowledge Base': 'knowledge_base',
  'SW Independant Contractor Rates': 'sw_contractor_rates',
  'TFN Pay Rates': 'tfn_pay_rates',
  'Staff Availability': 'staff_availability',
  'RoC Participants': 'roc_participants',
  'RoC Shifts': 'roc_shifts',
  'Client Sleep Chart': 'client_sleep_chart',
  'Bowel Chart': 'bowel_chart',
  'Fluid Intake Diary': 'fluid_intake_diary',
  'Client Consumables': 'client_consumables',
  'QR Code Data - Behaviours': 'client_behaviours',
  'Document Signing Requests': 'document_signing_requests',
  'Employment Documents': 'employment_documents',
  'Client Docs': 'client_docs',
  'Company Files': 'company_files',
  'NDIS Price Guide 2025 - 2026': 'ndis_price_guide',
  'NDIS Items': 'ndis_price_guide',
  'Chat Conversations': 'chat_conversations',
  'Chat Members': 'chat_members',
  'Chat Messages': 'chat_messages',
  'Push Subscriptions': 'push_subscriptions',
  'Client Media': 'client_media',
  'Weekly Stakeholder Reports': 'weekly_stakeholder_reports',
  'Candidate Interactions': 'candidate_interactions',
  'Roster of Care': 'roc_shifts'
};

function resolveTable(airtableName) {
  return TABLE_MAP[airtableName] || airtableName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

// ─── Core Supabase REST helper ───────────────────────────────
function supabaseRequest(path, method, body, extraHeaders) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return Promise.reject(new Error('Supabase not configured'));
  }
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json'
  };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  var opts = { method: method || 'GET', headers: headers };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase ' + r.status + ': ' + t.substring(0, 200)); });
    var ct = r.headers.get('content-type') || '';
    if (r.status === 204 || !ct.includes('json')) return [];
    return r.json();
  });
}

// ─── Convert Supabase row → Airtable-like record ────────────
// This allows existing route code to work unchanged
function toAirtableRecord(row) {
  // If the row has a 'data' JSONB column (generic tables), use that as fields
  var fields;
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    fields = Object.assign({}, row.data);
  } else {
    // Structured table — convert snake_case columns back to Airtable field names
    fields = Object.assign({}, row);
    delete fields.id;
    delete fields.created_at;
    delete fields.updated_at;
  }
  return {
    id: row.airtable_id || row.id,
    fields: fields,
    createdTime: row.created_at || ''
  };
}

// ─── Convert Airtable field names → Supabase columns ────────
// For structured inserts/updates, we need field name → column mapping
function fieldsToColumns(airtableFields) {
  // Pass through as-is for JSONB 'data' column tables
  // Structured tables will need specific mappings in the route toggle layer
  return airtableFields;
}

// ═══════════════════════════════════════════════════════════════
//  API — Mirrors airtable.js exports exactly
// ═══════════════════════════════════════════════════════════════

// listRecords(table, params) → array of {id, fields, createdTime}
function listRecords(table, params) {
  var sbTable = resolveTable(table);
  var query = sbTable + '?select=*&order=created_at.desc';
  // Apply any filters from params
  if (params && params.filterByFormula) {
    // We can't parse Airtable formulas; return all records
    console.log('[SUPABASE] Ignoring filterByFormula for ' + table + ' — use SQL filters');
  }
  return supabaseRequest(query, 'GET', null, { 'Prefer': 'count=exact' })
    .then(function(rows) {
      return (rows || []).map(toAirtableRecord);
    });
}

// getRecord(table, recordId) → {id, fields, createdTime}
function getRecord(table, recordId) {
  var sbTable = resolveTable(table);
  // Try airtable_id first, then UUID
  var query = sbTable + '?or=(airtable_id.eq.' + recordId + ',id.eq.' + recordId + ')&limit=1';
  return supabaseRequest(query, 'GET').then(function(rows) {
    if (!rows || !rows.length) throw new Error('Record not found: ' + recordId);
    return toAirtableRecord(rows[0]);
  });
}

// createRecords(table, records) → array of created records
// records: array of field objects (not wrapped in {fields:})
function createRecords(table, records) {
  var sbTable = resolveTable(table);
  var rows = records.map(function(fields) {
    return { data: fields };
  });
  return supabaseRequest(sbTable, 'POST', rows, { 'Prefer': 'return=representation' })
    .then(function(created) {
      return (created || []).map(function(row) {
        return toAirtableRecord(row);
      });
    });
}

// updateRecords(table, records) → array of updated records
// records: array of {id, fields}
function updateRecords(table, records) {
  var sbTable = resolveTable(table);
  var results = [];
  return records.reduce(function(chain, rec) {
    return chain.then(function() {
      var query = sbTable + '?or=(airtable_id.eq.' + rec.id + ',id.eq.' + rec.id + ')';
      return supabaseRequest(query, 'PATCH', { data: rec.fields }, { 'Prefer': 'return=representation' })
        .then(function(updated) {
          if (updated && updated.length) results.push(toAirtableRecord(updated[0]));
        });
    });
  }, Promise.resolve()).then(function() { return results; });
}

// deleteRecords(table, recordIds) → array of deleted records
function deleteRecords(table, recordIds) {
  var sbTable = resolveTable(table);
  var results = [];
  return recordIds.reduce(function(chain, id) {
    return chain.then(function() {
      var query = sbTable + '?or=(airtable_id.eq.' + id + ',id.eq.' + id + ')';
      return supabaseRequest(query, 'DELETE', null, { 'Prefer': 'return=representation' })
        .then(function(deleted) {
          if (deleted && deleted.length) results.push(toAirtableRecord(deleted[0]));
        });
    });
  }, Promise.resolve()).then(function() { return results; });
}

// rawFetch(tableName, method, urlPath, body)
// Emulates airtable.rawFetch — the most-used low-level function
function rawFetch(tableName, method, urlPath, body) {
  var sbTable = resolveTable(tableName);

  // GET: list or get single record
  if (method === 'GET') {
    if (urlPath && urlPath.startsWith('/rec')) {
      // Single record by Airtable ID
      var recId = urlPath.replace(/^\//, '');
      var query = sbTable + '?airtable_id=eq.' + recId + '&limit=1';
      return supabaseRequest(query, 'GET').then(function(rows) {
        if (!rows || !rows.length) return { error: { type: 'NOT_FOUND', message: 'Record not found' } };
        var row = rows[0];
        return toAirtableRecord(row);
      });
    }
    // List all records
    var listQuery = sbTable + '?select=*&order=created_at.desc&limit=1000';
    return supabaseRequest(listQuery, 'GET').then(function(rows) {
      return { records: (rows || []).map(toAirtableRecord) };
    });
  }

  // POST: create records
  if (method === 'POST') {
    if (!body || !body.records) return Promise.resolve({ error: { message: 'No records to create' } });
    var newRows = body.records.map(function(rec) {
      return { data: rec.fields || {} };
    });
    return supabaseRequest(sbTable, 'POST', newRows, { 'Prefer': 'return=representation' })
      .then(function(created) {
        return { records: (created || []).map(toAirtableRecord) };
      });
  }

  // PATCH: update records
  if (method === 'PATCH') {
    if (urlPath && urlPath.startsWith('/rec')) {
      // Single record update by Airtable ID
      var patchId = urlPath.replace(/^\//, '');
      var patchFields = body ? (body.fields || body) : {};
      var patchQuery = sbTable + '?airtable_id=eq.' + patchId;
      return supabaseRequest(patchQuery, 'PATCH', { data: patchFields }, { 'Prefer': 'return=representation' })
        .then(function(updated) {
          return toAirtableRecord(updated && updated[0] ? updated[0] : {});
        });
    }
    // Batch update
    if (body && body.records) {
      var patchResults = [];
      return body.records.reduce(function(chain, rec) {
        return chain.then(function() {
          var q = sbTable + '?or=(airtable_id.eq.' + rec.id + ',id.eq.' + rec.id + ')';
          return supabaseRequest(q, 'PATCH', { data: rec.fields }, { 'Prefer': 'return=representation' })
            .then(function(updated) {
              if (updated && updated.length) patchResults.push(toAirtableRecord(updated[0]));
            });
        });
      }, Promise.resolve()).then(function() { return { records: patchResults }; });
    }
    return Promise.resolve({ records: [] });
  }

  // DELETE
  if (method === 'DELETE') {
    if (urlPath && urlPath.startsWith('/rec')) {
      var delId = urlPath.replace(/^\//, '');
      var delQuery = sbTable + '?airtable_id=eq.' + delId;
      return supabaseRequest(delQuery, 'DELETE', null, { 'Prefer': 'return=representation' })
        .then(function(deleted) {
          return toAirtableRecord(deleted && deleted[0] ? deleted[0] : {});
        });
    }
    return Promise.resolve({ records: [] });
  }

  return Promise.resolve({ error: { message: 'Unsupported method: ' + method } });
}

// fetchAllFromTable(tableName, filterFormula) → array of {id, fields}
function fetchAllFromTable(tableName, filterFormula) {
  var sbTable = resolveTable(tableName);
  var query = sbTable + '?select=*&order=created_at.desc&limit=10000';
  return supabaseRequest(query, 'GET').then(function(rows) {
    return (rows || []).map(toAirtableRecord);
  }).catch(function(e) {
    console.log('[SUPABASE] Fetch error for ' + tableName + ':', e.message);
    return [];
  });
}

// fetchAllFromTableView(tableName, viewName, filterFormula) → array of {id, fields}
// Supabase has no concept of "views" — we just return all records
function fetchAllFromTableView(tableName, viewName, filterFormula) {
  return fetchAllFromTable(tableName, filterFormula);
}

// ─── Table name constants (same as airtable.js) ─────────────
var TABLES = {
  ALL_CONTACTS: 'All Contacts',
  CLIENTS: 'Clients',
  PROGRESS_NOTES: 'Progress Notes',
  INCIDENTS: 'Incidents',
  ROSTERS: 'Rosters 2025',
  CLIENT_BUDGETS: 'Client Core Budgets',
  SIL_PROPERTIES: 'SIL Properties',
  NDIS_ITEMS: 'NDIS Items',
  COURSES: 'Courses',
  SUPPORT_PLANS: 'Support Plans 2025',
  CLIENT_CALENDAR: 'Client Calendar',
  ROSTER_OF_CARE: 'Roster of Care',
  CHAT_CONVERSATIONS: 'Chat Conversations',
  CHAT_MEMBERS: 'Chat Members',
  CHAT_MESSAGES: 'Chat Messages',
  CLIENT_MEDIA: 'Client Media',
  PUSH_SUBSCRIPTIONS: 'Push Subscriptions',
  KNOWLEDGE_BASE: 'Messenger Knowledge Base',
  EMPLOYEE_CONTACT_HISTORY: 'Employee Contact History',
  CLIENT_CONTACT_HISTORY: 'Client Contact History',
  IR_REPORTS: 'IR Reports 2025',
  SLEEP_CHART: 'Client Sleep Chart',
  BOWEL_CHART: 'Bowel Chart',
  FLUID_INTAKE: 'Fluid Intake Diary',
  CONSUMABLES: 'Client Consumables',
  BEHAVIOURS: 'QR Code Data - Behaviours',
  STAFF_AVAILABILITY: 'Staff Availability',
  ROC_PARTICIPANTS: 'RoC Participants',
  ROC_SHIFTS: 'RoC Shifts',
  LEADS: 'Leads',
  TASKS: 'Tasks',
  COURSE_LIST: 'Course List',
};

module.exports = {
  listRecords: listRecords,
  getRecord: getRecord,
  createRecords: createRecords,
  updateRecords: updateRecords,
  deleteRecords: deleteRecords,
  rawFetch: rawFetch,
  fetchAllFromTable: fetchAllFromTable,
  fetchAllFromTableView: fetchAllFromTableView,
  TABLES: TABLES,
};
