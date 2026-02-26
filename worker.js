#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Titus CRM — Background Worker
// Runs the Airtable ↔ Supabase sync bridge
// Start: npm run worker
// ═══════════════════════════════════════════════════════════════

console.log('Titus CRM Worker starting...');
console.log('DATABASE=' + (process.env.DATABASE || 'airtable'));

// Only run sync bridge if DATABASE is 'supabase' or 'both'
var dbMode = (process.env.DATABASE || 'airtable').toLowerCase();

if (dbMode === 'supabase' || dbMode === 'both') {
  console.log('Starting Airtable ↔ Supabase sync bridge...');
  require('./scripts/sync-airtable-to-supabase');
} else {
  console.log('DATABASE=' + dbMode + ' — sync bridge not needed');
  console.log('Set DATABASE=supabase or DATABASE=both to enable sync');
  // Keep process alive for Railway
  setInterval(function() {}, 60000);
}
