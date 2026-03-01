-- Pay rates, staff availability, roster of care, daily charts
-- Chunk 6 of 10 (FIXED: adds ALTER TABLE for pre-existing tables)

-- ============================================================================
-- SECTION 25: PAY RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS sw_contractor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing sw_contractor_rates
DO $$ BEGIN
  ALTER TABLE sw_contractor_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE sw_contractor_rates ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE sw_contractor_rates ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tfn_pay_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  classification TEXT,
  employment_type TEXT,
  pay_level TEXT,
  hourly_rate DECIMAL(10,2),
  afternoon_rate DECIMAL(10,2),
  night_rate DECIMAL(10,2),
  saturday_rate DECIMAL(10,2),
  sunday_rate DECIMAL(10,2),
  public_holiday_rate DECIMAL(10,2),
  sleepover_rate DECIMAL(10,2),
  award_stream TEXT,
  effective_date DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing tfn_pay_rates
DO $$ BEGIN
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS classification TEXT;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS employment_type TEXT;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS pay_level TEXT;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS afternoon_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS night_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS saturday_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS sunday_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS public_holiday_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS sleepover_rate DECIMAL(10,2);
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS award_stream TEXT;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS effective_date DATE;
  ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS schads_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  level_code TEXT NOT NULL,
  description TEXT,
  hourly_rate NUMERIC(8,2),
  effective_from DATE,
  is_default BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, level_code)
);

-- Backfill columns that may be missing on pre-existing schads_rates
DO $$ BEGIN
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS level_code TEXT;
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2);
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS effective_from DATE;
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
  ALTER TABLE schads_rates ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================================================
-- SECTION 26: STAFF AVAILABILITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  staff_name TEXT,
  staff_email TEXT,
  contact_id UUID,
  date DATE,
  start_date DATE,
  end_date DATE,
  available BOOLEAN DEFAULT true,
  availability_type TEXT,
  leave_type TEXT,
  status TEXT DEFAULT 'Pending',
  reason TEXT,
  notes TEXT,
  total_days DECIMAL(5,1),
  employment_type TEXT,
  approved_by TEXT,
  approved_date DATE,
  status_comments TEXT,
  updated_by UUID,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing staff_availability
DO $$ BEGIN
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS staff_name TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS staff_email TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS date DATE;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS start_date DATE;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS end_date DATE;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS availability_type TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS leave_type TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS reason TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS total_days DECIMAL(5,1);
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS employment_type TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS approved_by TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS approved_date DATE;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS status_comments TEXT;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS updated_by UUID;
  ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_availability_email ON staff_availability(staff_email);
CREATE INDEX IF NOT EXISTS idx_availability_airtable ON staff_availability(airtable_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_tenant ON staff_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_avail_contact ON staff_availability(contact_id);


-- ============================================================================
-- SECTION 27: ROSTER OF CARE
-- ============================================================================

CREATE TABLE IF NOT EXISTS roc_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing roc_participants
DO $$ BEGIN
  ALTER TABLE roc_participants ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE roc_participants ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE roc_participants ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_roc_part_airtable ON roc_participants(airtable_id);

CREATE TABLE IF NOT EXISTS roc_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing roc_shifts
DO $$ BEGIN
  ALTER TABLE roc_shifts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE roc_shifts ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE roc_shifts ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_roc_shifts_airtable ON roc_shifts(airtable_id);


-- ============================================================================
-- SECTION 28: CLIENT DAILY CHARTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_sleep_chart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing client_sleep_chart
DO $$ BEGIN
  ALTER TABLE client_sleep_chart ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_sleep_chart ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_sleep_chart ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_sleep_chart ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_sleep_chart ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sleep_chart_airtable ON client_sleep_chart(airtable_id);

CREATE TABLE IF NOT EXISTS bowel_chart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing bowel_chart
DO $$ BEGIN
  ALTER TABLE bowel_chart ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE bowel_chart ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE bowel_chart ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE bowel_chart ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE bowel_chart ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_bowel_chart_airtable ON bowel_chart(airtable_id);

CREATE TABLE IF NOT EXISTS fluid_intake_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing fluid_intake_diary
DO $$ BEGIN
  ALTER TABLE fluid_intake_diary ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE fluid_intake_diary ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE fluid_intake_diary ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE fluid_intake_diary ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE fluid_intake_diary ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fluid_intake_airtable ON fluid_intake_diary(airtable_id);

CREATE TABLE IF NOT EXISTS client_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing client_consumables
DO $$ BEGIN
  ALTER TABLE client_consumables ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_consumables ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_consumables ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_consumables ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_consumables ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_consumables_airtable ON client_consumables(airtable_id);

CREATE TABLE IF NOT EXISTS client_behaviours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing client_behaviours
DO $$ BEGIN
  ALTER TABLE client_behaviours ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_behaviours ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_behaviours ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_behaviours ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_behaviours ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_behaviours_airtable ON client_behaviours(airtable_id);
