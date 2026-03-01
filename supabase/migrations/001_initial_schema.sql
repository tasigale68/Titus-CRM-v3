-- ============================================================================
-- Titus CRM -- Consolidated Supabase Migration
-- 001_initial_schema.sql
--
-- Generated: 2026-03-01
-- Consolidates: schema.sql + saas-schema.sql + missing-tables.sql
--               + alter-tables-for-saas.sql + support-plan-schema.sql
--
-- CONVENTIONS:
--   - CREATE TABLE IF NOT EXISTS for all tables
--   - id UUID PRIMARY KEY DEFAULT gen_random_uuid() on every table
--   - created_at TIMESTAMPTZ DEFAULT now() on every table
--   - updated_at TIMESTAMPTZ DEFAULT now() on every table (where applicable)
--   - airtable_id TEXT UNIQUE on all legacy tables (migration mapping)
--   - data JSONB DEFAULT '{}' on all legacy tables (catch-all)
--   - tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE on all
--     business data tables (multi-tenant scoping)
--   - gen_random_uuid() used exclusively (built-in Postgres 13+)
--   - RLS enabled on ALL tables with service_role_all bypass policy
--   - update_updated_at_column() trigger on ALL tables with updated_at
-- ============================================================================


-- ============================================================================
-- SECTION 0: TRIGGER FUNCTION
-- Must exist before tables reference it
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 1: PROFILES (linked to Supabase auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'support_worker' CHECK (role IN (
    'superadmin', 'director', 'team_leader', 'roster_officer',
    'support_worker', 'contractor', 'stakeholder'
  )),
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);


-- ============================================================================
-- SECTION 2: TENANTS (must be created before anything that references it)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_admin_email ON tenants(admin_email);

-- Now add FK from profiles to tenants
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;


-- ============================================================================
-- SECTION 2a: TENANT MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  weekly_price NUMERIC(6,2),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);


-- ============================================================================
-- SECTION 2b: TENANT USAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  metric TEXT,
  value NUMERIC,
  data JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_metric ON tenant_usage(metric);


-- ============================================================================
-- SECTION 3: CONTACTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  formatted_mobile TEXT,
  address TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  dob DATE,
  date_of_birth DATE,
  age INTEGER,
  type_of_contact TEXT,
  type_of_employment TEXT,
  job_title TEXT,
  department TEXT,
  team TEXT,
  status TEXT DEFAULT 'Active',
  training_status TEXT,
  photo_url TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  ndis_number TEXT,
  cv_ai_summary TEXT,
  km_allowance DECIMAL(8,2),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type_of_contact);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(full_name);
CREATE INDEX IF NOT EXISTS idx_contacts_airtable ON contacts(airtable_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);


-- ============================================================================
-- SECTION 4: CLIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  account_type TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  ndis_number TEXT,
  ndis_ref TEXT,
  suburb TEXT,
  location TEXT,
  sil_or_cas TEXT,
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  home_address TEXT,
  street_address TEXT,
  state TEXT,
  postcode TEXT,
  -- Emergency contact
  emergency_contact TEXT,
  emergency_phone TEXT,
  emergency_email TEXT,
  emergency_relationship TEXT,
  -- Nominee/Guardian
  nominee TEXT,
  nominee_phone TEXT,
  nominee_email TEXT,
  nominee_relationship TEXT,
  -- Plan Manager
  plan_manager TEXT,
  plan_manager_email TEXT,
  plan_manager_phone TEXT,
  plan_manager_company TEXT,
  plan_manager_id UUID,
  -- Support Coordinator
  support_coordinator TEXT,
  support_coordinator_email TEXT,
  support_coordinator_phone TEXT,
  support_coordinator_company TEXT,
  support_coordinator_id UUID,
  -- NDIS Plan
  ndis_plan_type TEXT,
  ndis_plan_start_date DATE,
  ndis_plan_expiry_date DATE,
  -- Budgets (from linked fields)
  core_budget_sil NUMERIC(12,2) DEFAULT 0,
  core_budget_community_access NUMERIC(12,2) DEFAULT 0,
  core_budget_transport NUMERIC(12,2) DEFAULT 0,
  -- Care details
  km_allowance TEXT,
  type_of_disability TEXT,
  general_background TEXT,
  ndis_goals TEXT,
  allergies TEXT,
  has_allergies TEXT,
  communication_aids TEXT,
  communication_details TEXT,
  personal_care TEXT,
  -- PBSP
  pbsp_yes_no TEXT,
  pbsp_prac_name TEXT,
  pbsp_prac_email TEXT,
  pbsp_phone TEXT,
  pbsp_strategies TEXT,
  known_triggers TEXT,
  support_ratio TEXT,
  gender_of_workers TEXT,
  gender_of_support_workers TEXT,
  required_staff_skills TEXT[],
  -- OPG
  opg_officer TEXT,
  opg_phone TEXT,
  opg_email TEXT,
  -- Decision making
  own_decision_maker TEXT,
  medical_decisions TEXT,
  financial_decisions TEXT,
  ndis_accommodation_decisions TEXT,
  living_arrangements_decisions TEXT,
  legal_decisions TEXT,
  -- Photos
  profile_photo_url TEXT,
  photo_gallery JSONB DEFAULT '[]',
  -- Metadata
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_ndis ON clients(ndis_number);
CREATE INDEX IF NOT EXISTS idx_clients_account ON clients(account_type);
CREATE INDEX IF NOT EXISTS idx_clients_airtable ON clients(airtable_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);


-- ============================================================================
-- SECTION 5: LEADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  ref_number TEXT,
  lead_name TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  source TEXT,
  stage TEXT DEFAULT 'Enquiry',
  status TEXT DEFAULT 'New',
  date DATE,
  notes TEXT,
  comments TEXT,
  suburb TEXT,
  disability_type TEXT,
  ndis_number TEXT,
  service_type TEXT,
  sil_or_cas TEXT,
  assignee TEXT,
  -- Support Coordinator
  sc_name TEXT,
  sc_email TEXT,
  sc_mobile TEXT,
  -- Website enquiry fields
  organisation_name TEXT,
  contact_name TEXT,
  enquiry_type TEXT,
  message TEXT,
  number_of_participants INTEGER,
  number_of_staff INTEGER,
  -- Metadata
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_date ON leads(date);
CREATE INDEX IF NOT EXISTS idx_leads_airtable ON leads(airtable_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);


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


-- ============================================================================
-- SECTION 12: SIL PROPERTIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS sil_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  name TEXT,
  suburb TEXT,
  address TEXT,
  status TEXT,
  description TEXT,
  sil_number TEXT,
  weekly_rent NUMERIC(8,2),
  property_type TEXT,
  total_rooms INTEGER,
  vacancies INTEGER,
  has_vacancy TEXT,
  type_of_accom TEXT,
  bathrooms INTEGER,
  notes TEXT,
  -- Real Estate
  real_estate_name TEXT,
  real_estate_phone TEXT,
  real_estate_email TEXT,
  sda_provider_name TEXT,
  sda_phone TEXT,
  sda_email TEXT,
  lease_start_date DATE,
  lease_end_date DATE,
  -- Utilities
  electricity_provider TEXT,
  gas_provider TEXT,
  internet_provider TEXT,
  electricity_connected TEXT,
  gas_connected TEXT,
  internet_connected TEXT,
  -- Repairs
  electrical_repairs TEXT,
  plumbing_repairs TEXT,
  other_repairs TEXT,
  -- Lawns
  lawns_maintenance TEXT,
  lawns_email TEXT,
  lawns_mobile TEXT,
  -- SIL Details
  sil_landline TEXT,
  sil_mobile TEXT,
  sil_email TEXT,
  mobile_pin TEXT,
  email_password TEXT,
  laptop_password TEXT,
  wifi_modem TEXT,
  wifi_password TEXT,
  printer_make_model TEXT,
  printer_ink_cartridge TEXT,
  lockbox_details TEXT,
  -- Onboarding checklist
  intake_form TEXT,
  risk_assessment TEXT,
  client_consent TEXT,
  emergency_plan TEXT,
  support_plan_completed TEXT,
  service_agreement TEXT,
  schedule_of_support TEXT,
  asset_register TEXT,
  wifi_connected TEXT,
  rooming_agreement TEXT,
  laptop_email_mobile TEXT,
  client_info_crm TEXT,
  policies_procedures TEXT,
  onboarding_pct TEXT,
  -- Site audit
  site_visits JSONB DEFAULT '[]',
  gender_sw TEXT,
  emergency_drill_date DATE,
  -- Condition report
  condition_report TEXT,
  condition_report_by TEXT,
  -- Photos & attachments
  property_photos JSONB DEFAULT '[]',
  lease_agreement JSONB DEFAULT '[]',
  entry_report JSONB DEFAULT '[]',
  safe_environment_doc JSONB DEFAULT '[]',
  fire_drill_doc JSONB DEFAULT '[]',
  -- House leader
  house_leader TEXT,
  -- Linked clients
  linked_clients JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sil_properties_status ON sil_properties(status);
CREATE INDEX IF NOT EXISTS idx_sil_properties_airtable ON sil_properties(airtable_id);
CREATE INDEX IF NOT EXISTS idx_sil_properties_tenant ON sil_properties(tenant_id);


-- ============================================================================
-- SECTION 13: CLIENT CALENDAR
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  unique_ref TEXT,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  event_name TEXT,
  event_title TEXT,
  event_date DATE,
  event_time TIME,
  event_type TEXT,
  appointment_type TEXT,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  address TEXT,
  details TEXT,
  sw_instructions TEXT,
  notes TEXT,
  staff_id UUID,
  created_by TEXT,
  created_date TIMESTAMPTZ,
  attended BOOLEAN,
  reason_not_attended TEXT,
  linked_shift_id UUID,
  status TEXT,
  sil_or_cas TEXT,
  files JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_client ON client_calendar(client_name);
CREATE INDEX IF NOT EXISTS idx_calendar_start ON client_calendar(start_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_airtable ON client_calendar(airtable_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON client_calendar(event_date);
CREATE INDEX IF NOT EXISTS idx_client_calendar_tenant ON client_calendar(tenant_id);


-- ============================================================================
-- SECTION 14: SUPPORT PLANS (legacy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  category TEXT,
  goal TEXT,
  strategy TEXT,
  notes TEXT,
  status TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_plans_client ON support_plans(client_name);
CREATE INDEX IF NOT EXISTS idx_support_plans_airtable ON support_plans(airtable_id);
CREATE INDEX IF NOT EXISTS idx_support_plans_tenant ON support_plans(tenant_id);


-- ============================================================================
-- SECTION 14a: CLIENT SUPPORT PLANS (comprehensive SaaS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,

  -- META
  completed_by TEXT,
  completed_date DATE,
  last_reviewed_by TEXT,
  last_reviewed_date DATE,
  review_due_date DATE,

  -- TAB 1: QUICK REFERENCE SUMMARY
  preferred_name TEXT,
  photo_url TEXT,
  summary_key_info TEXT,

  -- TAB 2: ABOUT ME
  preferred_language TEXT,
  cultural_identity TEXT[],
  cultural_background_notes TEXT,
  traditional_country TEXT,
  gender_identity TEXT,
  pronouns TEXT,
  lives_at_type TEXT,
  lives_with TEXT,
  what_makes_my_day TEXT,
  loved_ones_description TEXT,
  proud_of_and_talks_about TEXT,
  favourite_activities TEXT,
  favourite_tv_movies TEXT,
  favourite_food_drink TEXT,

  -- TAB 3: HOW I COMMUNICATE
  communication_methods TEXT[],
  communication_partner TEXT,
  communication_aids TEXT[],
  communication_aids_notes TEXT,
  feel_respected_when TEXT[],
  helps_me_understand TEXT[],
  interpreter_required BOOLEAN DEFAULT FALSE,
  interpreter_language TEXT,
  other_communication_notes TEXT,

  -- TAB 4: DISABILITY & SUPPORT NEEDS
  identified_disabilities TEXT[],
  disability_other_notes TEXT,
  disability_impact_notes TEXT,
  decision_making_type TEXT,
  decision_making_supporters TEXT,
  legal_documents TEXT[],
  independence_level TEXT,

  -- TAB 5: BEHAVIOURAL & EMOTIONAL SUPPORT
  calm_appearance TEXT,
  calm_strategies TEXT,
  known_triggers TEXT,
  escalation_signs TEXT,
  de_escalation_steps TEXT,
  calming_techniques TEXT,
  scripted_phrases TEXT,
  do_not_say_or_do TEXT,
  restricted_persons TEXT,
  behaviour_video_links JSONB DEFAULT '[]',
  behaviour_documents JSONB DEFAULT '[]',

  -- TAB 6: HEALTH & MEDICAL
  medical_conditions TEXT,
  allergies_present TEXT,
  allergies_detail TEXT,
  medications_present BOOLEAN DEFAULT FALSE,
  medications_management TEXT,
  medications_notes TEXT,
  swallowing_difficulty TEXT,
  swallowing_detail TEXT,
  diet_type TEXT,
  fluid_consistency TEXT,
  mealtime_plan_exists BOOLEAN DEFAULT FALSE,
  mealtime_plan_url TEXT,
  how_i_eat TEXT,
  how_i_drink TEXT,
  mobility_notes TEXT,
  mobility_aids TEXT,
  skin_care_notes TEXT,
  bowel_bladder_notes TEXT,
  breathing_notes TEXT,
  pain_description TEXT,
  pain_triggers TEXT,
  pain_indicators TEXT,
  pain_management TEXT,
  hospital_safety_notes TEXT,
  dentures BOOLEAN DEFAULT FALSE,
  dentures_detail TEXT,
  medical_history_summary TEXT,
  medical_assessment_notes TEXT,

  -- TAB 7: DAILY LIVING & PERSONAL CARE
  personal_care_notes TEXT,
  wake_up_routine TEXT,
  breakfast_routine TEXT,
  lunch_routine TEXT,
  dinner_routine TEXT,
  bedtime_routine TEXT,
  sleep_notes TEXT,
  toileting_notes TEXT,
  support_days TEXT[],

  -- TAB 8: COMMUNITY ACCESS & TRANSPORT
  shopping_routine TEXT,
  community_access_routine TEXT,
  transport_type TEXT,
  support_ratio TEXT,
  vehicle_seat_preference TEXT,
  transport_strategies TEXT,
  restricted_addresses TEXT,
  transport_plan_url TEXT,

  -- TAB 9: FINANCIAL MANAGEMENT
  money_handling_responsible TEXT,
  weekly_budget TEXT,
  worker_finance_role TEXT,
  receipts_protocol TEXT,
  online_shopping_notes TEXT,
  preferred_shops TEXT,
  financial_restrictions TEXT,

  -- TAB 10: SUPPORT NETWORK & PROFESSIONALS
  gp_name TEXT,
  gp_practice TEXT,
  gp_phone TEXT,
  specialists JSONB DEFAULT '[]',
  support_network JSONB DEFAULT '[]',
  next_of_kin_name TEXT,
  next_of_kin_relationship TEXT,
  next_of_kin_phone TEXT,
  preferred_contact_method TEXT,

  -- TAB 11: DOCUMENTS
  plan_documents JSONB DEFAULT '[]',

  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_support_plans_client ON client_support_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_client_support_plans_tenant ON client_support_plans(tenant_id);


-- ============================================================================
-- SECTION 15: TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  ref_number TEXT,
  task_name TEXT,
  title TEXT,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  assignee TEXT,
  assigned_to TEXT,
  assigned_to_email TEXT,
  status TEXT DEFAULT 'Not Started',
  priority TEXT DEFAULT 'Medium',
  due_date DATE,
  date_completed DATE,
  project_name TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ,
  type_of_update TEXT,
  method_of_contact TEXT,
  description TEXT,
  notes TEXT,
  detailed_description TEXT,
  follow_up_required TEXT,
  follow_up_details TEXT,
  actions_taken TEXT,
  -- Linked incident
  linked_incident_ref TEXT,
  incident_summary TEXT,
  is_ndis_reportable TEXT,
  -- Recurring
  is_recurring TEXT,
  recurring_frequency TEXT,
  next_due_date DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_name);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_airtable ON tasks(airtable_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);


-- ============================================================================
-- SECTION 16: LMS - COURSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  name TEXT,
  category TEXT,
  description TEXT,
  frequency_months TEXT,
  status TEXT DEFAULT 'Active',
  duration_minutes TEXT,
  module_count INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_airtable ON courses(airtable_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant ON courses(tenant_id);


-- ============================================================================
-- SECTION 17: LMS - COURSE ENROLLMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  course_id UUID REFERENCES courses(id),
  contact_id UUID,
  staff_name TEXT,
  staff_full_name TEXT,
  course_name TEXT,
  enrolled_datetime TIMESTAMPTZ,
  enrolled_date TIMESTAMPTZ DEFAULT now(),
  progress NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'enrolled',
  due_date DATE,
  completed_date DATE,
  course_expiry_date DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_airtable ON course_enrollments(airtable_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON course_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON course_enrollments(tenant_id);


-- ============================================================================
-- SECTION 18: LMS - COURSE MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  course_id UUID REFERENCES courses(id),
  name TEXT,
  sort_order NUMERIC(6,1) DEFAULT 0,
  description TEXT,
  status TEXT,
  attachments JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_airtable ON course_modules(airtable_id);


-- ============================================================================
-- SECTION 19: LMS - COURSE LESSONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  module_id UUID REFERENCES course_modules(id),
  name TEXT,
  sort_order NUMERIC(6,1) DEFAULT 0,
  lesson_type TEXT DEFAULT 'Content',
  content TEXT,
  video_url TEXT,
  status TEXT,
  attachments JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_airtable ON course_lessons(airtable_id);


-- ============================================================================
-- SECTION 20: LMS - COURSE QUIZZES
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  course_id UUID REFERENCES courses(id),
  name TEXT,
  pass_percentage NUMERIC(5,2) DEFAULT 100,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course ON course_quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_airtable ON course_quizzes(airtable_id);


-- ============================================================================
-- SECTION 21: LMS - QUIZ QUESTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  quiz_id UUID REFERENCES course_quizzes(id),
  question TEXT,
  options TEXT,
  correct_answer INTEGER,
  sort_order NUMERIC(6,1) DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_q_quiz ON course_quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_q_airtable ON course_quiz_questions(airtable_id);


-- ============================================================================
-- SECTION 22: RECEIPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  unique_receipt_id TEXT,
  supplier_name TEXT,
  purchase_date DATE,
  purchase_date_formatted TEXT,
  total_amount NUMERIC(12,2),
  gst_amount NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'AUD',
  purpose TEXT[],
  staff_email TEXT,
  staff_name TEXT,
  job_title TEXT,
  comments TEXT,
  receipt_url TEXT,
  ai_summary TEXT,
  reimbursement TEXT DEFAULT 'NO',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(purchase_date);
CREATE INDEX IF NOT EXISTS idx_receipts_airtable ON receipts(airtable_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);


-- ============================================================================
-- SECTION 23: CONTACT HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  email TEXT,
  name TEXT,
  contact_type TEXT,
  method TEXT,
  reason TEXT,
  summary TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_history_email ON employee_contact_history(email);
CREATE INDEX IF NOT EXISTS idx_emp_history_airtable ON employee_contact_history(airtable_id);

CREATE TABLE IF NOT EXISTS client_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  contact_type TEXT,
  method TEXT,
  reason TEXT,
  summary TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_history_name ON client_contact_history(client_name);
CREATE INDEX IF NOT EXISTS idx_client_history_airtable ON client_contact_history(airtable_id);

-- Generic contact_history table (referenced in missing-tables.sql)
CREATE TABLE IF NOT EXISTS contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  contact_id UUID,
  contact_name TEXT,
  contact_type TEXT,
  method TEXT,
  reason TEXT,
  summary TEXT,
  type TEXT DEFAULT 'manual',
  source TEXT,
  related_id UUID,
  tag TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_history_contact ON contact_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_tenant ON contact_history(tenant_id);


-- ============================================================================
-- SECTION 24: KNOWLEDGE BASE (consolidated: legacy + SaaS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  -- Legacy columns
  name TEXT,
  title TEXT,
  category TEXT,
  content TEXT,
  body TEXT,
  summary TEXT,
  keywords TEXT,
  tags TEXT,
  -- SaaS columns
  filename TEXT,
  content_text TEXT,
  chunks JSONB,
  is_built_in BOOLEAN DEFAULT false,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_airtable ON knowledge_base(airtable_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);


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

CREATE INDEX IF NOT EXISTS idx_roc_part_airtable ON roc_participants(airtable_id);

CREATE TABLE IF NOT EXISTS roc_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_behaviours_airtable ON client_behaviours(airtable_id);


-- ============================================================================
-- SECTION 29: DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_signing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_signing_airtable ON document_signing_requests(airtable_id);

CREATE TABLE IF NOT EXISTS employment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_airtable ON employment_documents(airtable_id);

CREATE TABLE IF NOT EXISTS client_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  unique_ref TEXT,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  doc_type TEXT,
  expiry_date DATE,
  last_updated TIMESTAMPTZ,
  updated_by TEXT,
  attachment_summary TEXT,
  status TEXT DEFAULT 'Active',
  files JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_docs_client ON client_docs(client_name);
CREATE INDEX IF NOT EXISTS idx_client_docs_airtable ON client_docs(airtable_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_tenant ON client_docs(tenant_id);

CREATE TABLE IF NOT EXISTS company_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_files_airtable ON company_files(airtable_id);

-- Generic documents table (referenced in missing-tables.sql)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  name TEXT,
  doc_type TEXT,
  visible_to TEXT DEFAULT 'both',
  expiry_date DATE,
  file_url TEXT,
  storage_path TEXT,
  uploaded_by UUID,
  contact_id UUID,
  client_id UUID,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);


-- ============================================================================
-- SECTION 30: DIGITAL SIGNING (SaaS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS signing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
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
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signing_docs_tenant ON signing_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signing_docs_status ON signing_documents(status);

CREATE TABLE IF NOT EXISTS signing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
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
  token TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signing_requests_token ON signing_requests(token);
CREATE INDEX IF NOT EXISTS idx_signing_requests_doc ON signing_requests(document_id);


-- ============================================================================
-- SECTION 31: NDIS PRICE GUIDE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ndis_price_guide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  support_item_number TEXT,
  support_item_name TEXT,
  support_category_name TEXT,
  registration_group_number TEXT,
  unit TEXT DEFAULT 'H',
  charge_per_hour NUMERIC(8,2) DEFAULT 0,
  remote_rate NUMERIC(8,2) DEFAULT 0,
  very_remote_rate NUMERIC(8,2) DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_item_number ON ndis_price_guide(support_item_number);
CREATE INDEX IF NOT EXISTS idx_ndis_airtable ON ndis_price_guide(airtable_id);


-- ============================================================================
-- SECTION 32: CHAT / MESSAGING (consolidated: legacy + SaaS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  name TEXT,
  type TEXT DEFAULT 'group',
  members JSONB DEFAULT '[]',
  participant_ids JSONB,
  pinned BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant ON chat_conversations(tenant_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT,
  message_type TEXT DEFAULT 'text',
  message_text TEXT,
  content TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  read_by JSONB DEFAULT '[]',
  read_at TIMESTAMPTZ,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id);

CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  conversation_id UUID REFERENCES chat_conversations(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- SECTION 33: PUSH SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- SECTION 34: AI CHATBOT SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  user_id UUID,
  messages JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_tenant ON chatbot_sessions(tenant_id);


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

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token);


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

CREATE INDEX IF NOT EXISTS idx_id_map_table ON airtable_id_map(supabase_table);
CREATE INDEX IF NOT EXISTS idx_id_map_airtable ON airtable_id_map(airtable_id);


-- ============================================================================
-- SECTION 46: APPLY updated_at TRIGGERS TO ALL TABLES
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    -- Auth / Profiles
    'profiles',
    -- Tenants
    'tenants', 'tenant_modules', 'tenant_usage',
    -- Core business
    'contacts', 'clients', 'leads', 'rosters', 'progress_notes',
    'ir_reports', 'client_core_budgets', 'client_budgets', 'budget_transactions',
    'sil_properties', 'client_calendar', 'support_plans', 'client_support_plans',
    'tasks', 'receipts', 'staff_availability',
    -- LMS
    'courses', 'course_enrollments', 'course_modules', 'course_lessons',
    'course_quizzes', 'course_quiz_questions',
    -- Documents
    'document_signing_requests', 'employment_documents', 'client_docs',
    'company_files', 'documents', 'signing_documents', 'signing_requests',
    -- Knowledge base & chatbot
    'knowledge_base', 'chatbot_sessions',
    -- Chat / messaging
    'chat_conversations', 'chat_messages', 'chat_members', 'push_subscriptions',
    -- Pay rates
    'sw_contractor_rates', 'tfn_pay_rates', 'schads_rates',
    -- RoC
    'roc_participants', 'roc_shifts',
    -- Daily charts
    'client_sleep_chart', 'bowel_chart', 'fluid_intake_diary',
    'client_consumables', 'client_behaviours',
    -- NDIS
    'ndis_price_guide',
    -- Media & reports
    'client_media', 'client_photos', 'weekly_stakeholder_reports', 'weekly_reports',
    -- Recruitment
    'candidate_interactions',
    -- Payroll
    'payroll_runs', 'payroll_lines',
    -- Portal
    'portal_users', 'portal_sessions',
    -- Voice & SMS
    'phone_numbers', 'call_log', 'sms_log', 'voicemails',
    'sms_templates', 'hunt_groups',
    -- Transcripts
    'transcripts',
    -- Contractor invoices
    'independent_contractor_invoices',
    -- Users
    'users',
    -- Contact history
    'employee_contact_history', 'client_contact_history', 'contact_history',
    -- Utility
    'sync_metadata', 'airtable_id_map'
  ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END;
$$;


-- ============================================================================
-- SECTION 47: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- With service_role_all bypass policy (allows service role full access)
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    -- Auth / Profiles
    'profiles',
    -- Tenants
    'tenants', 'tenant_modules', 'tenant_usage',
    -- Core business
    'contacts', 'clients', 'leads', 'rosters', 'progress_notes',
    'ir_reports', 'client_core_budgets', 'client_budgets', 'budget_transactions',
    'sil_properties', 'client_calendar', 'support_plans', 'client_support_plans',
    'tasks', 'receipts', 'staff_availability',
    -- LMS
    'courses', 'course_enrollments', 'course_modules', 'course_lessons',
    'course_quizzes', 'course_quiz_questions',
    -- Documents
    'document_signing_requests', 'employment_documents', 'client_docs',
    'company_files', 'documents', 'signing_documents', 'signing_requests',
    -- Knowledge base & chatbot
    'knowledge_base', 'chatbot_sessions',
    -- Chat / messaging
    'chat_conversations', 'chat_messages', 'chat_members', 'push_subscriptions',
    -- Pay rates
    'sw_contractor_rates', 'tfn_pay_rates', 'schads_rates',
    -- RoC
    'roc_participants', 'roc_shifts',
    -- Daily charts
    'client_sleep_chart', 'bowel_chart', 'fluid_intake_diary',
    'client_consumables', 'client_behaviours',
    -- NDIS
    'ndis_price_guide',
    -- Media & reports
    'client_media', 'client_photos', 'weekly_stakeholder_reports', 'weekly_reports',
    -- Recruitment
    'candidate_interactions',
    -- Payroll
    'payroll_runs', 'payroll_lines',
    -- Portal
    'portal_users', 'portal_sessions',
    -- Voice & SMS
    'phone_numbers', 'call_log', 'sms_log', 'voicemails',
    'sms_templates', 'hunt_groups',
    -- Transcripts
    'transcripts',
    -- Contractor invoices
    'independent_contractor_invoices',
    -- Users
    'users',
    -- Contact history
    'employee_contact_history', 'client_contact_history', 'contact_history',
    -- Utility
    'sync_metadata', 'airtable_id_map'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('
      DROP POLICY IF EXISTS service_role_all ON %I;
      CREATE POLICY service_role_all ON %I
        FOR ALL USING (true) WITH CHECK (true);
    ', t, t);
  END LOOP;
END;
$$;


-- ============================================================================
-- DONE
-- ============================================================================
-- Tables created:  60+
-- Indexes:         100+
-- Triggers:        updated_at on all tables
-- RLS:             enabled on all tables with service_role_all policy
-- ============================================================================
