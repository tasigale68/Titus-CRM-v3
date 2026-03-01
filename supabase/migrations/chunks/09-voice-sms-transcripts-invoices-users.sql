-- Voice & SMS, transcripts, contractor invoices, users, sync metadata, airtable mapping
-- Chunk 9 of 10 (FIXED: adds ALTER TABLE for pre-existing tables)

-- ============================================================================
-- SECTION 40: VOICE & SMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  twilio_number TEXT,
  friendly_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing phone_numbers
DO $$ BEGIN
  ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS twilio_number TEXT;
  ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS friendly_name TEXT;
  ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
  ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  contact_id UUID,
  twilio_call_sid TEXT UNIQUE,
  direction TEXT,
  from_number TEXT,
  to_number TEXT,
  status TEXT,
  duration_seconds INT,
  recording_url TEXT,
  recording_storage_path TEXT,
  transcript TEXT,
  transcript_summary TEXT,
  ai_action_items TEXT,
  handled_by UUID,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing call_log
DO $$ BEGIN
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS direction TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS from_number TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS to_number TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS status TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS duration_seconds INT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS recording_url TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS transcript TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS transcript_summary TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS ai_action_items TEXT;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS handled_by UUID;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
  ALTER TABLE call_log ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_log_tenant ON call_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_log_sid ON call_log(twilio_call_sid);

CREATE TABLE IF NOT EXISTS sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  contact_id UUID,
  twilio_message_sid TEXT UNIQUE,
  direction TEXT,
  from_number TEXT,
  to_number TEXT,
  body TEXT,
  status TEXT,
  media_url TEXT,
  media_storage_path TEXT,
  ai_classification TEXT,
  ai_summary TEXT,
  read BOOLEAN DEFAULT false,
  handled_by UUID,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing sms_log
DO $$ BEGIN
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS direction TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS from_number TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS to_number TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS body TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS status TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS media_url TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS media_storage_path TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS ai_classification TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS ai_summary TEXT;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS handled_by UUID;
  ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sms_log_tenant ON sms_log(tenant_id);

CREATE TABLE IF NOT EXISTS voicemails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  contact_id UUID,
  twilio_call_sid TEXT,
  recording_url TEXT,
  storage_path TEXT,
  transcript TEXT,
  duration_seconds INT,
  listened BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing voicemails
DO $$ BEGIN
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS recording_url TEXT;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS storage_path TEXT;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS transcript TEXT;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS duration_seconds INT;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS listened BOOLEAN DEFAULT false;
  ALTER TABLE voicemails ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_voicemails_tenant ON voicemails(tenant_id);

CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  name TEXT,
  category TEXT,
  body TEXT,
  variables JSONB DEFAULT '[]',
  created_by UUID,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing sms_templates
DO $$ BEGIN
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS category TEXT;
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS body TEXT;
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]';
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS created_by UUID;
  ALTER TABLE sms_templates ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS hunt_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  name TEXT,
  members JSONB DEFAULT '[]',
  ring_strategy TEXT DEFAULT 'sequential',
  timeout_seconds INT DEFAULT 30,
  voicemail_enabled BOOLEAN DEFAULT true,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing hunt_groups
DO $$ BEGIN
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]';
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS ring_strategy TEXT DEFAULT 'sequential';
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS timeout_seconds INT DEFAULT 30;
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS voicemail_enabled BOOLEAN DEFAULT true;
  ALTER TABLE hunt_groups ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_hunt_groups_tenant ON hunt_groups(tenant_id);


-- ============================================================================
-- SECTION 41: TRANSCRIPTS (ElevenLabs / Twilio)
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  call_sid TEXT UNIQUE,
  conversation_id TEXT,
  caller_phone TEXT,
  contact_id UUID,
  transcript TEXT,
  transcript_text TEXT,
  summary TEXT,
  duration INTEGER DEFAULT 0,
  duration_secs INTEGER DEFAULT 0,
  source TEXT DEFAULT 'elevenlabs',
  call_direction TEXT DEFAULT 'inbound',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing transcripts
DO $$ BEGIN
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS call_sid TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS conversation_id TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS caller_phone TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS transcript TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS transcript_text TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS duration_secs INTEGER DEFAULT 0;
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'elevenlabs';
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS call_direction TEXT DEFAULT 'inbound';
  ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transcripts_sid ON transcripts(call_sid);
CREATE INDEX IF NOT EXISTS idx_transcripts_phone ON transcripts(caller_phone);
CREATE INDEX IF NOT EXISTS idx_transcripts_conversation ON transcripts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_contact ON transcripts(contact_id);


-- ============================================================================
-- SECTION 42: INDEPENDENT CONTRACTOR INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS independent_contractor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  contractor_id UUID,
  contractor_name TEXT,
  invoice_number TEXT,
  shift_date DATE,
  shift_id UUID,
  client_id UUID,
  hours_worked DECIMAL(5,2),
  hourly_rate DECIMAL(10,2),
  total_kilometres DECIMAL(8,2),
  amount DECIMAL(10,2),
  amount_ex_gst DECIMAL(10,2),
  gst DECIMAL(10,2),
  total DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  period_start DATE,
  period_end DATE,
  submitted_date DATE,
  paid_date DATE,
  shifts JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing independent_contractor_invoices
DO $$ BEGIN
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS contractor_id UUID;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS contractor_name TEXT;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS shift_date DATE;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS shift_id UUID;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS client_id UUID;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS hours_worked DECIMAL(5,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS total_kilometres DECIMAL(8,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS amount_ex_gst DECIMAL(10,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS gst DECIMAL(10,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS total DECIMAL(10,2);
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS period_start DATE;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS period_end DATE;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS submitted_date DATE;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS paid_date DATE;
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS shifts JSONB DEFAULT '[]';
  ALTER TABLE independent_contractor_invoices ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_contractor ON independent_contractor_invoices(contractor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON independent_contractor_invoices(tenant_id);


-- ============================================================================
-- SECTION 43: USERS (app-level, references in missing-tables.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  full_name TEXT,
  name TEXT,
  role TEXT DEFAULT 'support_worker',
  active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing users
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'support_worker';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);


-- ============================================================================
-- SECTION 44: SYNC METADATA (non-tenant-scoped utility table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  last_sync_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing sync_metadata
DO $$ BEGIN
  ALTER TABLE sync_metadata ADD COLUMN IF NOT EXISTS table_name TEXT;
  ALTER TABLE sync_metadata ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
  ALTER TABLE sync_metadata ADD COLUMN IF NOT EXISTS records_synced INTEGER DEFAULT 0;
  ALTER TABLE sync_metadata ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle';
  ALTER TABLE sync_metadata ADD COLUMN IF NOT EXISTS error_message TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================================================
-- SECTION 45: AIRTABLE ID MAPPING (non-tenant-scoped utility table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS airtable_id_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id TEXT UNIQUE NOT NULL,
  supabase_table TEXT NOT NULL,
  supabase_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing airtable_id_map
DO $$ BEGIN
  ALTER TABLE airtable_id_map ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE airtable_id_map ADD COLUMN IF NOT EXISTS supabase_table TEXT;
  ALTER TABLE airtable_id_map ADD COLUMN IF NOT EXISTS supabase_id UUID;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_id_map_table ON airtable_id_map(supabase_table);
CREATE INDEX IF NOT EXISTS idx_id_map_airtable ON airtable_id_map(airtable_id);
