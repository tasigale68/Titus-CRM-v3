-- Client media/photos, weekly reports, recruitment, payroll, stakeholder portal
-- Chunk 8 of 10 (FIXED: adds ALTER TABLE for pre-existing tables)

-- ============================================================================
-- SECTION 35: CLIENT MEDIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing client_media
DO $$ BEGIN
  ALTER TABLE client_media ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_media ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_media ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_media ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_media ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_media_client ON client_media(client_name);
CREATE INDEX IF NOT EXISTS idx_client_media_airtable ON client_media(airtable_id);


-- ============================================================================
-- SECTION 35a: CLIENT PHOTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_id UUID,
  client_name TEXT,
  photo_url TEXT,
  is_profile BOOLEAN DEFAULT false,
  uploaded_by UUID,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing client_photos
DO $$ BEGIN
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS client_id UUID;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS photo_url TEXT;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS is_profile BOOLEAN DEFAULT false;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS uploaded_by UUID;
  ALTER TABLE client_photos ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_photos_client ON client_photos(client_name);
CREATE INDEX IF NOT EXISTS idx_client_photos_tenant ON client_photos(tenant_id);


-- ============================================================================
-- SECTION 36: WEEKLY REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS weekly_stakeholder_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing weekly_stakeholder_reports
DO $$ BEGIN
  ALTER TABLE weekly_stakeholder_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE weekly_stakeholder_reports ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE weekly_stakeholder_reports ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_reports_airtable ON weekly_stakeholder_reports(airtable_id);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
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
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing weekly_reports
DO $$ BEGIN
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS client_id UUID;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS period_start DATE;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS period_end DATE;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS report_date DATE;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS pdf_path TEXT;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'titus-reports';
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS notes_count INT DEFAULT 0;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS incidents_count INT DEFAULT 0;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS hours_delivered NUMERIC(6,2);
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS ai_content TEXT;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS sent_to_stakeholders BOOLEAN DEFAULT false;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_reports_tenant ON weekly_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_client ON weekly_reports(tenant_id, client_id);


-- ============================================================================
-- SECTION 37: RECRUITMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS candidate_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing candidate_interactions
DO $$ BEGIN
  ALTER TABLE candidate_interactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE candidate_interactions ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE candidate_interactions ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_candidate_interactions_airtable ON candidate_interactions(airtable_id);


-- ============================================================================
-- SECTION 38: PAYROLL
-- ============================================================================

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  pay_period_start DATE,
  pay_period_end DATE,
  period_type TEXT,
  total_gross NUMERIC(10,2),
  total_super NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  worker_count INT,
  status TEXT DEFAULT 'draft',
  exported_at TIMESTAMPTZ,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing payroll_runs
DO $$ BEGIN
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS pay_period_start DATE;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS pay_period_end DATE;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS period_type TEXT;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS total_gross NUMERIC(10,2);
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS total_super NUMERIC(10,2);
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,2);
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS worker_count INT;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;
  ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON payroll_runs(tenant_id);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
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
  account_number TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing payroll_lines
DO $$ BEGIN
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS worker_id UUID;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS worker_name TEXT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS worker_email TEXT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS classification_level TEXT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS ordinary_hours NUMERIC(6,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS overtime_15_hours NUMERIC(6,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS overtime_20_hours NUMERIC(6,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS saturday_hours NUMERIC(6,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS sunday_hours NUMERIC(6,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS public_holiday_hours NUMERIC(6,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS sleepover_count INT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS sleepover_allowance NUMERIC(8,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS split_shift_count INT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS split_shift_allowance NUMERIC(8,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS gross_pay NUMERIC(10,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS super_amount NUMERIC(8,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10,2);
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]';
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS bsb TEXT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS account_number TEXT;
  ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payroll_lines_run ON payroll_lines(payroll_run_id);


-- ============================================================================
-- SECTION 39: STAKEHOLDER PORTAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
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
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing portal_users
DO $$ BEGIN
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS client_id UUID;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS role TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS access_level TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS temp_password TEXT;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
  ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_users_tenant ON portal_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  ip_address TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing portal_sessions
DO $$ BEGIN
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE;
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS token TEXT;
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
  ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token);
