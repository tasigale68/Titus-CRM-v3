-- Rosters, progress notes, incidents, budgets
-- Chunk 3 of 10

-- ============================================================================
-- SECTION 6: ROSTERS (consolidated: legacy + SaaS columns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  unique_ref TEXT,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  client_full_name TEXT,
  -- Legacy staff columns
  staff_name TEXT,
  staff_email TEXT,
  -- SaaS worker columns
  worker_id UUID,
  worker_name TEXT,
  worker_email TEXT,
  -- Shift timing
  start_shift TIMESTAMPTZ,
  end_shift TIMESTAMPTZ,
  day_type TEXT,
  total_hours_decimal NUMERIC(6,2) DEFAULT 0,
  total_hours_hmm TEXT,
  total_hours NUMERIC(6,2),
  -- Shift details
  type_of_shift TEXT,
  shift_type TEXT,
  shift_status TEXT DEFAULT 'Scheduled',
  status TEXT DEFAULT 'unconfirmed',
  has_sleepover TEXT,
  sil_or_cas TEXT,
  broken_shift TEXT,
  progress_note_completed BOOLEAN DEFAULT FALSE,
  -- NDIS billing
  support_item_name TEXT,
  charge_per_hour NUMERIC(8,2) DEFAULT 0,
  support_category_pace TEXT,
  ndis_line_item TEXT,
  ndis_unit_price NUMERIC(8,2),
  ndis_total NUMERIC(8,2),
  -- Payroll / costing
  base_rate NUMERIC(8,2),
  penalty_multiplier NUMERIC(4,2) DEFAULT 1.0,
  shift_cost NUMERIC(8,2),
  -- Clock in/out
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  clock_in_location JSONB,
  -- Compliance
  compliance_warnings JSONB DEFAULT '[]',
  -- Transport
  km_allowance DECIMAL(8,2),
  -- Metadata
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rosters_client ON rosters(client_name);
CREATE INDEX IF NOT EXISTS idx_rosters_staff ON rosters(staff_email);
CREATE INDEX IF NOT EXISTS idx_rosters_start ON rosters(start_shift);
CREATE INDEX IF NOT EXISTS idx_rosters_status ON rosters(shift_status);
CREATE INDEX IF NOT EXISTS idx_rosters_airtable ON rosters(airtable_id);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant ON rosters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant_client ON rosters(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant_worker ON rosters(tenant_id, worker_email);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant_dates ON rosters(tenant_id, start_shift, end_shift);


-- ============================================================================
-- SECTION 7: PROGRESS NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  support_worker_name TEXT,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  notes_summary TEXT,
  total_hours TEXT,
  transport TEXT,
  kms TEXT,
  roster_id UUID REFERENCES rosters(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_notes_client ON progress_notes(client_name);
CREATE INDEX IF NOT EXISTS idx_progress_notes_airtable ON progress_notes(airtable_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_tenant ON progress_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_tenant_client ON progress_notes(tenant_id, client_name);


-- ============================================================================
-- SECTION 8: INCIDENT REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ir_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  unique_ir_ref TEXT,
  person_completing TEXT,
  incident_datetime TIMESTAMPTZ,
  description TEXT,
  severity TEXT DEFAULT 'Minor',
  status TEXT DEFAULT 'Open',
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  incident_summary TEXT,
  is_reportable TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ir_reports_status ON ir_reports(status);
CREATE INDEX IF NOT EXISTS idx_ir_reports_severity ON ir_reports(severity);
CREATE INDEX IF NOT EXISTS idx_ir_reports_airtable ON ir_reports(airtable_id);
CREATE INDEX IF NOT EXISTS idx_ir_reports_tenant ON ir_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ir_reports_tenant_client ON ir_reports(tenant_id, client_name);


-- ============================================================================
-- SECTION 9: CLIENT CORE BUDGETS (legacy Airtable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_core_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  unique_ref TEXT,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  ndis_ref TEXT,
  ndis_plan_type TEXT,
  account_type TEXT,
  sil_or_cas TEXT,
  -- Budget amounts
  core_budget_sil NUMERIC(12,2) DEFAULT 0,
  core_budget_community_access NUMERIC(12,2) DEFAULT 0,
  core_budget_transport NUMERIC(12,2) DEFAULT 0,
  sil_budget NUMERIC(12,2) DEFAULT 0,
  sil_used NUMERIC(12,2) DEFAULT 0,
  community_access_budget NUMERIC(12,2) DEFAULT 0,
  community_access_used NUMERIC(12,2) DEFAULT 0,
  transport_budget NUMERIC(12,2) DEFAULT 0,
  transport_used NUMERIC(12,2) DEFAULT 0,
  core_other_budget NUMERIC(12,2) DEFAULT 0,
  capacity_building_budget NUMERIC(12,2) DEFAULT 0,
  total_budget NUMERIC(12,2) DEFAULT 0,
  invoice_amount NUMERIC(12,2) DEFAULT 0,
  from_which_budget TEXT,
  -- SOS Agreement
  upload_sos_url TEXT,
  line_items TEXT,
  line_items_uploaded BOOLEAN DEFAULT FALSE,
  -- Plan dates
  plan_start_date DATE,
  plan_end_date DATE,
  plan_manager TEXT,
  ndis_number TEXT,
  notes TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_client ON client_core_budgets(client_name);
CREATE INDEX IF NOT EXISTS idx_budgets_airtable ON client_core_budgets(airtable_id);
CREATE INDEX IF NOT EXISTS idx_client_core_budgets_tenant ON client_core_budgets(tenant_id);


-- ============================================================================
-- SECTION 10: CLIENT BUDGETS (SaaS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
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
  last_updated TIMESTAMPTZ DEFAULT now(),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_budgets_tenant ON client_budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_budgets_client ON client_budgets(tenant_id, client_id);


-- ============================================================================
-- SECTION 11: BUDGET TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_id UUID,
  budget_id UUID REFERENCES client_budgets(id) ON DELETE CASCADE,
  roster_id UUID,
  transaction_type TEXT,
  amount NUMERIC(8,2),
  ndis_line_item TEXT,
  support_category TEXT,
  description TEXT,
  transaction_date DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_tx_tenant ON budget_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_budget_tx_client ON budget_transactions(tenant_id, client_id);

