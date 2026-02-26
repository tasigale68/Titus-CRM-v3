const env = require('../config/env');

const BASE_URL = `https://api.airtable.com/v0/${env.airtable.baseId}`;
const RATE_LIMIT_MS = 250; // 4 requests per second

let lastRequest = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequest = Date.now();
}

async function request(endpoint, options = {}) {
  await rateLimit();

  const url = `${BASE_URL}/${endpoint}`;
  const headers = {
    Authorization: `Bearer ${env.airtable.apiKey}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 429) {
    // Rate limited — wait and retry
    await new Promise((r) => setTimeout(r, 2000));
    return request(endpoint, options);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }

  return res.json();
}

async function listRecords(table, params = {}) {
  const records = [];
  let offset;

  do {
    const query = new URLSearchParams(params);
    if (offset) query.set('offset', offset);

    const data = await request(`${encodeURIComponent(table)}?${query}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

async function getRecord(table, recordId) {
  return request(`${encodeURIComponent(table)}/${recordId}`);
}

async function createRecords(table, records) {
  // Airtable allows max 10 records per batch
  const results = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const data = await request(encodeURIComponent(table), {
      method: 'POST',
      body: JSON.stringify({ records: batch.map((fields) => ({ fields })) }),
    });
    results.push(...data.records);
  }
  return results;
}

async function updateRecords(table, records) {
  const results = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const data = await request(encodeURIComponent(table), {
      method: 'PATCH',
      body: JSON.stringify({ records: batch }),
    });
    results.push(...data.records);
  }
  return results;
}

async function deleteRecords(table, recordIds) {
  const results = [];
  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const query = batch.map((id) => `records[]=${id}`).join('&');
    const data = await request(`${encodeURIComponent(table)}?${query}`, {
      method: 'DELETE',
    });
    results.push(...data.records);
  }
  return results;
}

// ─── Low-level fetch (matches monolith's airtableFetchTable pattern) ───
// urlPath is raw query string like "?pageSize=100&view=..." or "/recXXX"
function rawFetch(tableName, method, urlPath, body) {
  var url = BASE_URL + '/' + encodeURIComponent(tableName) + (urlPath || '');
  var opts = {
    method: method || 'GET',
    headers: {
      Authorization: 'Bearer ' + env.airtable.apiKey,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function (r) { return r.json(); });
}

// Paginated fetch — returns all records from a table
function fetchAllFromTable(tableName, filterFormula) {
  var allRecords = [];
  function fetchPage(offset) {
    var params = '?pageSize=100';
    if (filterFormula) params += '&filterByFormula=' + encodeURIComponent(filterFormula);
    if (offset) params += '&offset=' + encodeURIComponent(offset);
    return rawFetch(tableName, 'GET', params).then(function (data) {
      if (data.error) { console.log('Airtable error for ' + tableName + ':', data.error); return allRecords; }
      allRecords = allRecords.concat(data.records || []);
      if (data.offset) return fetchPage(data.offset);
      return allRecords;
    }).catch(function (e) { console.log('Fetch error for ' + tableName + ':', e.message); return allRecords; });
  }
  return fetchPage(null);
}

// Paginated fetch with view
function fetchAllFromTableView(tableName, viewName, filterFormula) {
  var allRecords = [];
  function fetchPage(offset) {
    var params = '?pageSize=100&view=' + encodeURIComponent(viewName);
    if (filterFormula) params += '&filterByFormula=' + encodeURIComponent(filterFormula);
    if (offset) params += '&offset=' + encodeURIComponent(offset);
    return rawFetch(tableName, 'GET', params).then(function (data) {
      if (data.error) { console.log('Airtable view error for ' + tableName + '/' + viewName + ':', JSON.stringify(data.error)); return allRecords; }
      allRecords = allRecords.concat(data.records || []);
      if (data.offset) return fetchPage(data.offset);
      return allRecords;
    }).catch(function (e) { console.log('Fetch view error for ' + tableName + ':', e.message); return allRecords; });
  }
  return fetchPage(null);
}

// Table name constants
const TABLES = {
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
  listRecords,
  getRecord,
  createRecords,
  updateRecords,
  deleteRecords,
  rawFetch,
  fetchAllFromTable,
  fetchAllFromTableView,
  TABLES,
};
