// ═══════════════════════════════════════════════════════════════
// Titus CRM — Database Toggle Layer
// Switches between Airtable and Supabase based on DATABASE env var
//
// Usage: const db = require('../services/database');
//        db.fetchAllFromTable('Clients')...
//
// DATABASE env var values:
//   'airtable'  — use Airtable only (default)
//   'supabase'  — use Supabase only
// ═══════════════════════════════════════════════════════════════

var DATABASE = (process.env.DATABASE || 'airtable').toLowerCase();

var service;

if (DATABASE === 'supabase') {
  service = require('./supabase');
  console.log('[DB] Using Supabase as primary database');
} else {
  service = require('./airtable');
  console.log('[DB] Using Airtable as primary database');
}

module.exports = service;
