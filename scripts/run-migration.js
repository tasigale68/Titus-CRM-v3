#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// Run Supabase schema migration via pg module
// Usage: node scripts/run-migration.js
// Requires DATABASE_URL or SUPABASE_DB_URL in .env
// Or pass connection string as first argument
// ═══════════════════════════════════════════════════════════
require('dotenv').config();
var fs = require('fs');
var path = require('path');

var SCHEMA_FILE = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');

// Try to get connection string
var connStr = process.argv[2]
  || process.env.DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || process.env.POSTGRES_URL;

if (!connStr) {
  // Try to construct from Supabase URL
  var supaUrl = (process.env.SUPABASE_URL || '').trim();
  var match = supaUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (match) {
    var ref = match[1];
    console.log('Supabase project ref:', ref);
    console.log('');
    console.log('No DATABASE_URL found. To run this migration, you need the direct');
    console.log('PostgreSQL connection string from your Supabase dashboard:');
    console.log('');
    console.log('  1. Go to https://supabase.com/dashboard/project/' + ref + '/settings/database');
    console.log('  2. Copy the "Connection string" (URI format)');
    console.log('  3. Run: node scripts/run-migration.js "postgresql://postgres:PASSWORD@db.' + ref + '.supabase.co:5432/postgres"');
    console.log('');
    console.log('Or add DATABASE_URL to your .env file.');
    console.log('');
    console.log('Alternative: Run the SQL directly in the Supabase SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/' + ref + '/sql/new');
    console.log('  Paste contents of: supabase/migrations/001_initial_schema.sql');
  } else {
    console.log('No database connection string found.');
    console.log('Set DATABASE_URL in .env or pass as argument.');
  }
  process.exit(1);
}

// Read schema SQL
var sql;
try {
  sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
} catch (e) {
  console.error('Cannot read schema file:', SCHEMA_FILE);
  process.exit(1);
}

console.log('Schema file:', SCHEMA_FILE);
console.log('Size:', (sql.length / 1024).toFixed(1) + ' KB');
console.log('Connecting to database...');

var { Client } = require('pg');
var client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(function() {
    console.log('Connected. Running migration...');
    return client.query(sql);
  })
  .then(function() {
    console.log('');
    console.log('Migration completed successfully!');
    return client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  })
  .then(function(res) {
    console.log('');
    console.log('Tables in public schema (' + res.rows.length + '):');
    res.rows.forEach(function(r) { console.log('  ' + r.tablename); });
    return client.end();
  })
  .catch(function(err) {
    console.error('Migration error:', err.message);
    if (err.message.indexOf('already exists') >= 0) {
      console.log('');
      console.log('Some tables already exist. The schema uses CREATE TABLE IF NOT EXISTS,');
      console.log('so this is expected if you have run a partial migration before.');
      console.log('The migration may have partially succeeded.');
    }
    client.end().catch(function() {});
    process.exit(1);
  });
