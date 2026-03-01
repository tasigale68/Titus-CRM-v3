-- SIL properties, calendar, support plans, tasks
-- Chunk 4 of 10 (FIXED: adds ALTER TABLE for pre-existing tables)

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
  real_estate_name TEXT,
  real_estate_phone TEXT,
  real_estate_email TEXT,
  sda_provider_name TEXT,
  sda_phone TEXT,
  sda_email TEXT,
  lease_start_date DATE,
  lease_end_date DATE,
  electricity_provider TEXT,
  gas_provider TEXT,
  internet_provider TEXT,
  electricity_connected TEXT,
  gas_connected TEXT,
  internet_connected TEXT,
  electrical_repairs TEXT,
  plumbing_repairs TEXT,
  other_repairs TEXT,
  lawns_maintenance TEXT,
  lawns_email TEXT,
  lawns_mobile TEXT,
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
  site_visits JSONB DEFAULT '[]',
  gender_sw TEXT,
  emergency_drill_date DATE,
  condition_report TEXT,
  condition_report_by TEXT,
  property_photos JSONB DEFAULT '[]',
  lease_agreement JSONB DEFAULT '[]',
  entry_report JSONB DEFAULT '[]',
  safe_environment_doc JSONB DEFAULT '[]',
  fire_drill_doc JSONB DEFAULT '[]',
  house_leader TEXT,
  linked_clients JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing sil_properties
DO $$ BEGIN
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sil_number TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS weekly_rent NUMERIC(8,2);
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS property_type TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS total_rooms INTEGER;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS vacancies INTEGER;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS has_vacancy TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS type_of_accom TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS bathrooms INTEGER;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS real_estate_name TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS real_estate_phone TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS real_estate_email TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sda_provider_name TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sda_phone TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sda_email TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lease_start_date DATE;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lease_end_date DATE;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS electricity_provider TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS gas_provider TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS internet_provider TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS electricity_connected TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS gas_connected TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS internet_connected TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS electrical_repairs TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS plumbing_repairs TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS other_repairs TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lawns_maintenance TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lawns_email TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lawns_mobile TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sil_landline TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sil_mobile TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS sil_email TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS mobile_pin TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS email_password TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS laptop_password TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS wifi_modem TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS wifi_password TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS printer_make_model TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS printer_ink_cartridge TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lockbox_details TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS intake_form TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS risk_assessment TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS client_consent TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS emergency_plan TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS support_plan_completed TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS service_agreement TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS schedule_of_support TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS asset_register TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS wifi_connected TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS rooming_agreement TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS laptop_email_mobile TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS client_info_crm TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS policies_procedures TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS onboarding_pct TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS site_visits JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS gender_sw TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS emergency_drill_date DATE;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS condition_report TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS condition_report_by TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS property_photos JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS lease_agreement JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS entry_report JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS safe_environment_doc JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS fire_drill_doc JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS house_leader TEXT;
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS linked_clients JSONB DEFAULT '[]';
  ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing client_calendar
DO $$ BEGIN
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS unique_ref TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS event_name TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS event_title TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS event_date DATE;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS event_time TIME;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS event_type TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS appointment_type TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS details TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS sw_instructions TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS staff_id UUID;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS attended BOOLEAN;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS reason_not_attended TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS linked_shift_id UUID;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS status TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS sil_or_cas TEXT;
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
  ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns on pre-existing support_plans
DO $$ BEGIN
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS category TEXT;
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS goal TEXT;
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS strategy TEXT;
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS status TEXT;
  ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
  completed_by TEXT,
  completed_date DATE,
  last_reviewed_by TEXT,
  last_reviewed_date DATE,
  review_due_date DATE,
  preferred_name TEXT,
  photo_url TEXT,
  summary_key_info TEXT,
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
  communication_methods TEXT[],
  communication_partner TEXT,
  communication_aids TEXT[],
  communication_aids_notes TEXT,
  feel_respected_when TEXT[],
  helps_me_understand TEXT[],
  interpreter_required BOOLEAN DEFAULT FALSE,
  interpreter_language TEXT,
  other_communication_notes TEXT,
  identified_disabilities TEXT[],
  disability_other_notes TEXT,
  disability_impact_notes TEXT,
  decision_making_type TEXT,
  decision_making_supporters TEXT,
  legal_documents TEXT[],
  independence_level TEXT,
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
  personal_care_notes TEXT,
  wake_up_routine TEXT,
  breakfast_routine TEXT,
  lunch_routine TEXT,
  dinner_routine TEXT,
  bedtime_routine TEXT,
  sleep_notes TEXT,
  toileting_notes TEXT,
  support_days TEXT[],
  shopping_routine TEXT,
  community_access_routine TEXT,
  transport_type TEXT,
  support_ratio TEXT,
  vehicle_seat_preference TEXT,
  transport_strategies TEXT,
  restricted_addresses TEXT,
  transport_plan_url TEXT,
  money_handling_responsible TEXT,
  weekly_budget TEXT,
  worker_finance_role TEXT,
  receipts_protocol TEXT,
  online_shopping_notes TEXT,
  preferred_shops TEXT,
  financial_restrictions TEXT,
  gp_name TEXT,
  gp_practice TEXT,
  gp_phone TEXT,
  specialists JSONB DEFAULT '[]',
  support_network JSONB DEFAULT '[]',
  next_of_kin_name TEXT,
  next_of_kin_relationship TEXT,
  next_of_kin_phone TEXT,
  preferred_contact_method TEXT,
  plan_documents JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns on pre-existing client_support_plans
DO $$ BEGIN
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS completed_by TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS completed_date DATE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS last_reviewed_by TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS last_reviewed_date DATE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS review_due_date DATE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS preferred_name TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS photo_url TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS summary_key_info TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS preferred_language TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS cultural_identity TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS cultural_background_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS traditional_country TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS gender_identity TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS pronouns TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS lives_at_type TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS lives_with TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS what_makes_my_day TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS loved_ones_description TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS proud_of_and_talks_about TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS favourite_activities TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS favourite_tv_movies TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS favourite_food_drink TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS communication_methods TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS communication_partner TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS communication_aids TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS communication_aids_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS feel_respected_when TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS helps_me_understand TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS interpreter_required BOOLEAN DEFAULT FALSE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS interpreter_language TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS other_communication_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS identified_disabilities TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS disability_other_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS disability_impact_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS decision_making_type TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS decision_making_supporters TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS legal_documents TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS independence_level TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS calm_appearance TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS calm_strategies TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS known_triggers TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS escalation_signs TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS de_escalation_steps TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS calming_techniques TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS scripted_phrases TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS do_not_say_or_do TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS restricted_persons TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS behaviour_video_links JSONB DEFAULT '[]';
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS behaviour_documents JSONB DEFAULT '[]';
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS allergies_present TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS allergies_detail TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS medications_present BOOLEAN DEFAULT FALSE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS medications_management TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS medications_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS swallowing_difficulty TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS swallowing_detail TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS diet_type TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS fluid_consistency TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS mealtime_plan_exists BOOLEAN DEFAULT FALSE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS mealtime_plan_url TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS how_i_eat TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS how_i_drink TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS mobility_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS mobility_aids TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS skin_care_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS bowel_bladder_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS breathing_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS pain_description TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS pain_triggers TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS pain_indicators TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS pain_management TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS hospital_safety_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS dentures BOOLEAN DEFAULT FALSE;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS dentures_detail TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS medical_history_summary TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS medical_assessment_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS personal_care_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS wake_up_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS breakfast_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS lunch_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS dinner_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS bedtime_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS sleep_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS toileting_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS support_days TEXT[];
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS shopping_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS community_access_routine TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS transport_type TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS support_ratio TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS vehicle_seat_preference TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS transport_strategies TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS restricted_addresses TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS transport_plan_url TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS money_handling_responsible TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS weekly_budget TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS worker_finance_role TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS receipts_protocol TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS online_shopping_notes TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS preferred_shops TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS financial_restrictions TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS gp_name TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS gp_practice TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS gp_phone TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS specialists JSONB DEFAULT '[]';
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS support_network JSONB DEFAULT '[]';
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS next_of_kin_relationship TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS plan_documents JSONB DEFAULT '[]';
  ALTER TABLE client_support_plans ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
  linked_incident_ref TEXT,
  incident_summary TEXT,
  is_ndis_reportable TEXT,
  is_recurring TEXT,
  recurring_frequency TEXT,
  next_due_date DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns on pre-existing tasks
DO $$ BEGIN
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ref_number TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_name TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_email TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS date_completed DATE;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_name TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type_of_update TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS method_of_contact TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS detailed_description TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS follow_up_required TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS follow_up_details TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actions_taken TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_incident_ref TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS incident_summary TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_ndis_reportable TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_frequency TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_due_date DATE;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_name);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_airtable ON tasks(airtable_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
