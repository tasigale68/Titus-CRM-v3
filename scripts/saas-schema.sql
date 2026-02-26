-- ============================================================================
-- Titus CRM SaaS Multi-Tenant Schema
-- PostgreSQL / Supabase
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: TENANTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  logo_url TEXT,
  primary_colour TEXT DEFAULT '#0d9488',
  secondary_colour TEXT DEFAULT '#0f172a',
  admin_email TEXT NOT NULL,
  status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  enabled_modules JSONB DEFAULT '[]',
  base_tier TEXT DEFAULT '1-10',
  weekly_price_total NUMERIC(8,2),
  max_users INT DEFAULT 10,
  max_clients INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  weekly_price NUMERIC(6,2),
  UNIQUE(tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  metric TEXT,
  value NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: WEEKLY REPORTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  period_start DATE,
  period_end DATE,
  report_date DATE,
  pdf_path TEXT,
  storage_bucket TEXT DEFAULT 'titus-reports',
  notes_count INT DEFAULT 0,
  incidents_count INT DEFAULT 0,
  hours_delivered NUMERIC(6,2),
  ai_content TEXT,
  sent_to_stakeholders BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5: ROSTERS, BUDGETS, PAYROLL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rosters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  worker_id UUID,
  client_name TEXT,
  worker_name TEXT,
  worker_email TEXT,
  start_shift TIMESTAMPTZ,
  end_shift TIMESTAMPTZ,
  shift_type TEXT,
  day_type TEXT,
  total_hours NUMERIC(6,2),
  base_rate NUMERIC(8,2),
  penalty_multiplier NUMERIC(4,2) DEFAULT 1.0,
  shift_cost NUMERIC(8,2),
  ndis_line_item TEXT,
  ndis_unit_price NUMERIC(8,2),
  ndis_total NUMERIC(8,2),
  status TEXT DEFAULT 'unconfirmed',
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  clock_in_location JSONB,
  compliance_warnings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  plan_start_date DATE,
  plan_end_date DATE,
  plan_type TEXT,
  total_funding NUMERIC(10,2),
  support_category TEXT,
  ndis_line_item TEXT,
  allocated_amount NUMERIC(10,2),
  spent_amount NUMERIC(10,2) DEFAULT 0,
  committed_amount NUMERIC(10,2) DEFAULT 0,
  remaining_amount NUMERIC(10,2),
  utilisation_pct NUMERIC(5,2),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  budget_id UUID REFERENCES client_budgets(id) ON DELETE CASCADE,
  roster_id UUID,
  transaction_type TEXT,
  amount NUMERIC(8,2),
  ndis_line_item TEXT,
  support_category TEXT,
  description TEXT,
  transaction_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  pay_period_start DATE,
  pay_period_end DATE,
  period_type TEXT,
  total_gross NUMERIC(10,2),
  total_super NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  worker_count INT,
  status TEXT DEFAULT 'draft',
  exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  worker_id UUID,
  worker_name TEXT,
  worker_email TEXT,
  classification_level TEXT,
  hourly_rate NUMERIC(8,2),
  ordinary_hours NUMERIC(6,2),
  overtime_15_hours NUMERIC(6,2),
  overtime_20_hours NUMERIC(6,2),
  saturday_hours NUMERIC(6,2),
  sunday_hours NUMERIC(6,2),
  public_holiday_hours NUMERIC(6,2),
  sleepover_count INT,
  sleepover_allowance NUMERIC(8,2),
  split_shift_count INT,
  split_shift_allowance NUMERIC(8,2),
  gross_pay NUMERIC(10,2),
  super_amount NUMERIC(8,2),
  total_cost NUMERIC(10,2),
  flags JSONB DEFAULT '[]',
  bsb TEXT,
  account_number TEXT
);

CREATE TABLE IF NOT EXISTS schads_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  level_code TEXT NOT NULL,
  description TEXT,
  hourly_rate NUMERIC(8,2),
  effective_from DATE,
  is_default BOOLEAN DEFAULT false,
  UNIQUE(tenant_id, level_code)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6: DIGITAL SIGNING
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS signing_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  document_type TEXT,
  related_id UUID,
  related_type TEXT,
  template_id UUID,
  title TEXT,
  status TEXT DEFAULT 'draft',
  signatories JSONB DEFAULT '[]',
  signed_count INT DEFAULT 0,
  required_signatures INT DEFAULT 2,
  pdf_template_path TEXT,
  signed_pdf_path TEXT,
  storage_bucket TEXT DEFAULT 'titus-documents',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID REFERENCES signing_documents(id) ON DELETE CASCADE,
  signer_name TEXT,
  signer_email TEXT,
  signer_phone TEXT,
  signer_role TEXT,
  status TEXT DEFAULT 'pending',
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  ip_address TEXT,
  device_info TEXT,
  reminder_sent_at TIMESTAMPTZ,
  token TEXT UNIQUE
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 8: MESSENGER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT DEFAULT 'group',
  members JSONB DEFAULT '[]',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT,
  message_type TEXT DEFAULT 'text',
  content TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  read_by JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 9: AI CHATBOT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT,
  category TEXT,
  content_text TEXT,
  chunks JSONB,
  is_built_in BOOLEAN DEFAULT false,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 10: STAKEHOLDER PORTAL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID,
  name TEXT,
  email TEXT,
  password_hash TEXT,
  role TEXT,
  access_level TEXT,
  temp_password TEXT,
  must_change_password BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 11: VOICE & SMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS phone_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  twilio_number TEXT,
  friendly_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voicemails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID,
  twilio_call_sid TEXT,
  recording_url TEXT,
  storage_path TEXT,
  transcript TEXT,
  duration_seconds INT,
  listened BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  category TEXT,
  body TEXT,
  variables JSONB DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hunt_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  members JSONB DEFAULT '[]',
  ring_strategy TEXT DEFAULT 'sequential',
  timeout_seconds INT DEFAULT 30,
  voicemail_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant ON rosters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rosters_client ON rosters(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_rosters_worker ON rosters(tenant_id, worker_email);
CREATE INDEX IF NOT EXISTS idx_rosters_dates ON rosters(start_shift, end_shift);
CREATE INDEX IF NOT EXISTS idx_client_budgets_tenant ON client_budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_budgets_client ON client_budgets(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_budget_tx_tenant ON budget_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_tx_client ON budget_transactions(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON payroll_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_run ON payroll_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_signing_docs_tenant ON signing_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signing_requests_token ON signing_requests(token);
CREATE INDEX IF NOT EXISTS idx_signing_requests_doc ON signing_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant ON chat_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_tenant ON weekly_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_client ON weekly_reports(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_tenant ON chatbot_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_tenant ON portal_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_call_log_tenant ON call_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_log_sid ON call_log(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_sms_log_tenant ON sms_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_tenant ON voicemails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hunt_groups_tenant ON hunt_groups(tenant_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE schads_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE voicemails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_groups ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. Authenticated users access own tenant data only.
-- These policies use auth.jwt() ->> 'tenant_id' to get the tenant claim.

-- Tenants: users can only see their own tenant
CREATE POLICY tenant_isolation ON tenants
  FOR ALL USING (id::text = auth.jwt() ->> 'tenant_id');

-- Tenant modules
CREATE POLICY tenant_modules_isolation ON tenant_modules
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Tenant usage
CREATE POLICY tenant_usage_isolation ON tenant_usage
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Weekly reports
CREATE POLICY weekly_reports_isolation ON weekly_reports
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Rosters
CREATE POLICY rosters_isolation ON rosters
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Client budgets
CREATE POLICY client_budgets_isolation ON client_budgets
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Budget transactions
CREATE POLICY budget_transactions_isolation ON budget_transactions
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Payroll runs
CREATE POLICY payroll_runs_isolation ON payroll_runs
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Payroll lines
CREATE POLICY payroll_lines_isolation ON payroll_lines
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- SCHADS rates
CREATE POLICY schads_rates_isolation ON schads_rates
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Signing documents
CREATE POLICY signing_documents_isolation ON signing_documents
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Signing requests
CREATE POLICY signing_requests_isolation ON signing_requests
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Chat conversations
CREATE POLICY chat_conversations_isolation ON chat_conversations
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Chat messages
CREATE POLICY chat_messages_isolation ON chat_messages
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Knowledge base
CREATE POLICY knowledge_base_isolation ON knowledge_base
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Chatbot sessions
CREATE POLICY chatbot_sessions_isolation ON chatbot_sessions
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Portal users
CREATE POLICY portal_users_isolation ON portal_users
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Portal sessions
CREATE POLICY portal_sessions_isolation ON portal_sessions
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Phone numbers
CREATE POLICY phone_numbers_isolation ON phone_numbers
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Call log
CREATE POLICY call_log_isolation ON call_log
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- SMS log
CREATE POLICY sms_log_isolation ON sms_log
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Voicemails
CREATE POLICY voicemails_isolation ON voicemails
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- SMS templates
CREATE POLICY sms_templates_isolation ON sms_templates
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Hunt groups
CREATE POLICY hunt_groups_isolation ON hunt_groups
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- Seed Delta Community Support as the first tenant
INSERT INTO tenants (org_name, slug, domain, admin_email, status, enabled_modules, base_tier, weekly_price_total, max_users, max_clients, trial_ends_at)
VALUES (
  'Delta Community Support',
  'delta-community',
  'deltacommunity.com.au',
  'gus@deltacommunity.com.au',
  'active',
  '["recruiter","leads","voice_sms","ai_voice","client_management","billing","lms","ai_reports","employment_signing","stakeholder_portal"]',
  '50+',
  599.00,
  100,
  500,
  NULL
) ON CONFLICT (slug) DO NOTHING;

-- Seed SCHADS rates for Delta (or default tenant)
-- Default rates will be inserted via application code after tenant creation
