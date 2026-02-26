const Database = require('better-sqlite3');
const path = require('path');
const env = require('../config/env');

const dbPath = env.railway.volumeMountPath
  ? path.join(env.railway.volumeMountPath, 'titus-voice.db')
  : path.join(__dirname, '..', '..', 'titus-voice.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      job_title TEXT DEFAULT '',
      permissions TEXT DEFAULT '{}',
      phone_number TEXT DEFAULT '',
      reset_code TEXT DEFAULT NULL,
      reset_code_expiry TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS permission_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      permissions TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sid TEXT UNIQUE,
      type TEXT DEFAULT 'inbound',
      from_number TEXT,
      to_number TEXT,
      participant TEXT,
      status TEXT DEFAULT 'ringing',
      duration INTEGER DEFAULT 0,
      recording_url TEXT,
      transcript TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sms_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sid TEXT UNIQUE,
      direction TEXT NOT NULL,
      from_number TEXT,
      to_number TEXT,
      body TEXT,
      participant TEXT,
      media_urls TEXT DEFAULT '[]',
      channel TEXT DEFAULT 'sms',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS template_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      airtable_id TEXT UNIQUE NOT NULL,
      reminder_settings TEXT DEFAULT '{}',
      signing_fields TEXT DEFAULT '[]',
      merge_fields TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      conversation_id TEXT,
      direction TEXT NOT NULL,
      from_address TEXT,
      from_name TEXT,
      to_address TEXT,
      to_name TEXT,
      cc TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      body_preview TEXT DEFAULT '',
      body_html TEXT DEFAULT '',
      has_attachments INTEGER DEFAULT 0,
      attachments TEXT DEFAULT '[]',
      is_read INTEGER DEFAULT 0,
      importance TEXT DEFAULT 'normal',
      received_at DATETIME,
      sent_at DATETIME,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_address);
    CREATE INDEX IF NOT EXISTS idx_emails_to ON emails(to_address);
    CREATE INDEX IF NOT EXISTS idx_emails_conv ON emails(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS call_hunt_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      strategy TEXT NOT NULL DEFAULT 'sequential',
      ring_seconds INTEGER DEFAULT 20,
      members TEXT NOT NULL DEFAULT '[]',
      active INTEGER DEFAULT 1,
      skip_if_busy INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agent_availability_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      duration_secs INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      entity_label TEXT,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_email);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type);

    CREATE TABLE IF NOT EXISTS stakeholder_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      contact_id TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      pin TEXT,
      expires_at DATETIME,
      created_by INTEGER,
      created_by_name TEXT,
      active INTEGER DEFAULT 1,
      last_accessed DATETIME,
      access_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_stakeholder_token ON stakeholder_access(token);

    CREATE TABLE IF NOT EXISTS knowledge_base_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER,
      category TEXT DEFAULT 'Other',
      description TEXT,
      tags TEXT,
      extracted_text TEXT,
      word_count INTEGER DEFAULT 0,
      page_count INTEGER,
      status TEXT DEFAULT 'processing',
      error_message TEXT,
      uploaded_by TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'Medium',
      category TEXT DEFAULT 'Other',
      status TEXT DEFAULT 'Open',
      assigned_to INTEGER,
      assigned_name TEXT,
      requester_email TEXT,
      requester_name TEXT,
      contact_id TEXT,
      thread TEXT DEFAULT '[]',
      internal_notes TEXT DEFAULT '[]',
      hours_spent REAL DEFAULT 0,
      sla_target TEXT,
      sla_met INTEGER,
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

    CREATE TABLE IF NOT EXISTS incident_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      airtable_id TEXT,
      participant_name TEXT,
      participant_contact_id TEXT,
      incident_date TEXT,
      incident_time TEXT,
      location TEXT,
      incident_type TEXT,
      severity TEXT DEFAULT 'Minor',
      description TEXT,
      immediate_actions TEXT,
      witnesses TEXT,
      staff_involved TEXT,
      police_involved INTEGER DEFAULT 0,
      ambulance_called INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Reported',
      follow_up_actions TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      escalation_sent INTEGER DEFAULT 0,
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incident_reports(status);

    CREATE TABLE IF NOT EXISTS continuous_improvement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_identified TEXT,
      source TEXT,
      description TEXT,
      root_cause TEXT,
      corrective_action TEXT,
      responsible_person TEXT,
      target_date TEXT,
      completed_date TEXT,
      status TEXT DEFAULT 'Identified',
      linked_incident_id INTEGER,
      evidence TEXT DEFAULT '[]',
      created_by INTEGER,
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_settings (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      enabled INTEGER DEFAULT 0,
      schedule TEXT,
      last_run_at TEXT,
      last_run_by TEXT,
      last_run_status TEXT,
      last_output TEXT,
      next_run TEXT,
      toggled_by TEXT,
      toggled_at TEXT,
      config TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id TEXT,
      run_at TEXT,
      triggered_by TEXT,
      trigger_type TEXT,
      status TEXT,
      records_processed INTEGER DEFAULT 0,
      output_summary TEXT,
      errors TEXT,
      duration_seconds REAL
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      user_name TEXT,
      event_type TEXT,
      portal TEXT,
      ip TEXT,
      device TEXT,
      session_duration INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sw_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      airtable_id TEXT,
      full_name TEXT,
      contact_type TEXT,
      type_of_employment TEXT,
      photo_url TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sw_sessions (
      token TEXT PRIMARY KEY,
      sw_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sw_user_id) REFERENCES sw_users(id)
    );

    CREATE TABLE IF NOT EXISTS sw_clock_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roster_id TEXT NOT NULL,
      sw_email TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      lat REAL,
      lng REAL,
      distance_m REAL,
      override_reason TEXT,
      client_name TEXT
    );

    CREATE TABLE IF NOT EXISTS sw_otp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used INTEGER DEFAULT 0,
      reset_token TEXT DEFAULT NULL
    );
  `);
}

module.exports = { db, migrate };
