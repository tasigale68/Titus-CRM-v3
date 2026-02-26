#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Titus CRM — Airtable ↔ Supabase Sync Bridge
// Runs on a 5-minute interval, syncs modified records
// Run: node scripts/sync-airtable-to-supabase.js
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();

var SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
var SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
var AIRTABLE_API_KEY = (process.env.AIRTABLE_API_KEY || '').trim();
var AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg3Cz7mEsGA6IOI';
var SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !AIRTABLE_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, AIRTABLE_API_KEY');
  process.exit(1);
}

var AIRTABLE_BASE_URL = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID;
var RATE_LIMIT_MS = 260;
var lastReqTime = 0;

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

function supabaseRequest(path, method, body, headers) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var hdrs = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal,resolution=merge-duplicates'
  };
  if (headers) Object.assign(hdrs, headers);
  var opts = { method: method, headers: hdrs };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('Supabase ' + r.status + ': ' + t.substring(0, 200)); });
    if (r.status === 204) return [];
    return r.json().catch(function() { return []; });
  });
}

function upsertBatch(tableName, rows) {
  if (!rows.length) return Promise.resolve();
  var batches = [];
  for (var i = 0; i < rows.length; i += 200) batches.push(rows.slice(i, i + 200));
  return batches.reduce(function(chain, batch) {
    return chain.then(function() { return supabaseRequest(tableName, 'POST', batch); });
  }, Promise.resolve());
}

// ─── Generic mapper ──────────────────────────────────────────
function genericMap(r) {
  return { airtable_id: r.id, data: r.fields || {} };
}

// ─── Tables to sync ──────────────────────────────────────────
var SYNC_TABLES = [
  { airtable: 'All Contacts', supabase: 'contacts', view: 'Active Contacts 2026' },
  { airtable: 'Clients', supabase: 'clients', view: 'Client Active View' },
  { airtable: 'Leads', supabase: 'leads' },
  { airtable: 'Rosters 2025', supabase: 'rosters' },
  { airtable: 'Progress Notes', supabase: 'progress_notes' },
  { airtable: 'IR Reports 2025', supabase: 'ir_reports' },
  { airtable: 'Client Core Budgets', supabase: 'client_core_budgets' },
  { airtable: 'Tasks', supabase: 'tasks' },
  { airtable: 'Receipts', supabase: 'receipts' },
  { airtable: 'Staff Availability', supabase: 'staff_availability' },
  { airtable: 'Course Enrollments', supabase: 'course_enrollments' },
  { airtable: 'Client Calendar', supabase: 'client_calendar' },
  { airtable: 'Messenger Knowledge Base', supabase: 'knowledge_base' }
];

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

      // Use the migrate script mappers if available via require, else generic
      var rows = records.map(genericMap);

      await upsertBatch(t.supabase, rows);
      totalSynced += rows.length;

      // Update sync metadata
      await supabaseRequest('sync_metadata', 'POST', [{
        table_name: t.supabase,
        last_sync_at: new Date().toISOString(),
        records_synced: rows.length,
        status: 'synced'
      }]).catch(function() {});

    } catch (e) {
      errors++;
      console.error('[SYNC] Error syncing ' + t.airtable + ':', e.message.substring(0, 80));
      await supabaseRequest('sync_metadata', 'POST', [{
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
console.log('═══════════════════════════════════════════════════════════');
console.log(' Titus CRM — Airtable ↔ Supabase Sync Bridge');
console.log(' Interval: ' + (SYNC_INTERVAL_MS / 1000) + 's | Tables: ' + SYNC_TABLES.length);
console.log('═══════════════════════════════════════════════════════════');

// Run immediately, then on interval
syncCycle();
setInterval(syncCycle, SYNC_INTERVAL_MS);

// Graceful shutdown
process.on('SIGINT', function() {
  console.log('\n[SYNC] Shutting down...');
  process.exit(0);
});
process.on('SIGTERM', function() {
  console.log('\n[SYNC] Shutting down...');
  process.exit(0);
});
