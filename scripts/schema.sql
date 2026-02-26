-- ═══════════════════════════════════════════════════════════════
-- Titus CRM — Supabase Schema (migrated from Airtable)
-- Generated: 2026-02-26
-- Base ID: appg3Cz7mEsGA6IOI
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CONTACTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  type_of_contact TEXT,          -- 'NDIS Client (Active)', 'Support Worker', etc.
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
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_type ON contacts(type_of_contact);
CREATE INDEX idx_contacts_name ON contacts(full_name);
CREATE INDEX idx_contacts_airtable ON contacts(airtable_id);

-- ─── CLIENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  account_type TEXT,               -- 'Active', 'Inactive', 'Prospect'
  phone TEXT,
  mobile TEXT,
  email TEXT,
  ndis_number TEXT,
  ndis_ref TEXT,
  suburb TEXT,
  location TEXT,
  sil_or_cas TEXT,                 -- 'SIL', 'CAS', 'Both'
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
  -- Support Coordinator
  support_coordinator TEXT,
  support_coordinator_email TEXT,
  support_coordinator_phone TEXT,
  support_coordinator_company TEXT,
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
  -- PBSP (Positive Behaviour Support Plan)
  pbsp_yes_no TEXT,
  pbsp_prac_name TEXT,
  pbsp_prac_email TEXT,
  pbsp_phone TEXT,
  pbsp_strategies TEXT,
  known_triggers TEXT,
  support_ratio TEXT,
  gender_of_workers TEXT,
  required_staff_skills TEXT[],
  -- OPG (Office of the Public Guardian)
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
  -- Metadata
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_name ON clients(client_name);
CREATE INDEX idx_clients_ndis ON clients(ndis_number);
CREATE INDEX idx_clients_account ON clients(account_type);
CREATE INDEX idx_clients_airtable ON clients(airtable_id);

-- ─── LEADS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_date ON leads(date);
CREATE INDEX idx_leads_airtable ON leads(airtable_id);

-- ─── ROSTERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rosters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  unique_ref TEXT,
  client_id UUID REFERENCES clients(id),
  client_name TEXT,
  client_full_name TEXT,
  staff_name TEXT,
  staff_email TEXT,
  start_shift TIMESTAMPTZ,
  end_shift TIMESTAMPTZ,
  day_type TEXT,
  total_hours_decimal NUMERIC(6,2) DEFAULT 0,
  total_hours_hmm TEXT,
  type_of_shift TEXT,              -- 'Active', 'Non Active'
  shift_status TEXT DEFAULT 'Scheduled',
  has_sleepover TEXT,
  sil_or_cas TEXT,
  progress_note_completed BOOLEAN DEFAULT FALSE,
  support_item_name TEXT,
  charge_per_hour NUMERIC(8,2) DEFAULT 0,
  support_category_pace TEXT,
  broken_shift TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rosters_client ON rosters(client_name);
CREATE INDEX idx_rosters_staff ON rosters(staff_email);
CREATE INDEX idx_rosters_start ON rosters(start_shift);
CREATE INDEX idx_rosters_status ON rosters(shift_status);
CREATE INDEX idx_rosters_airtable ON rosters(airtable_id);

-- ─── PROGRESS NOTES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_notes_client ON progress_notes(client_name);
CREATE INDEX idx_progress_notes_airtable ON progress_notes(airtable_id);

-- ─── INCIDENT REPORTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ir_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ir_reports_status ON ir_reports(status);
CREATE INDEX idx_ir_reports_severity ON ir_reports(severity);
CREATE INDEX idx_ir_reports_airtable ON ir_reports(airtable_id);

-- ─── CLIENT CORE BUDGETS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_core_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budgets_client ON client_core_budgets(client_name);
CREATE INDEX idx_budgets_airtable ON client_core_budgets(airtable_id);

-- ─── SIL PROPERTIES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sil_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  name TEXT,
  suburb TEXT,
  address TEXT,
  status TEXT,                     -- 'Active', 'Inactive'
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
  -- Photos & attachments stored as JSONB arrays
  property_photos JSONB DEFAULT '[]',
  lease_agreement JSONB DEFAULT '[]',
  entry_report JSONB DEFAULT '[]',
  safe_environment_doc JSONB DEFAULT '[]',
  fire_drill_doc JSONB DEFAULT '[]',
  -- House leader
  house_leader TEXT,
  -- Linked clients (array of client IDs)
  linked_clients JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sil_properties_status ON sil_properties(status);
CREATE INDEX idx_sil_properties_airtable ON sil_properties(airtable_id);

-- ─── CLIENT CALENDAR ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  unique_ref TEXT,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  event_name TEXT,
  appointment_type TEXT,
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  address TEXT,
  details TEXT,
  sw_instructions TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ,
  status TEXT,
  sil_or_cas TEXT,
  files JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_client ON client_calendar(client_name);
CREATE INDEX idx_calendar_start ON client_calendar(start_datetime);
CREATE INDEX idx_calendar_airtable ON client_calendar(airtable_id);

-- ─── SUPPORT PLANS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  category TEXT,
  goal TEXT,
  strategy TEXT,
  notes TEXT,
  status TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_support_plans_client ON support_plans(client_name);
CREATE INDEX idx_support_plans_airtable ON support_plans(airtable_id);

-- ─── TASKS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  ref_number TEXT,
  task_name TEXT,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  assignee TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_client ON tasks(client_name);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_airtable ON tasks(airtable_id);

-- ─── LMS: COURSES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  name TEXT,
  category TEXT,
  description TEXT,
  frequency_months TEXT,
  status TEXT DEFAULT 'Active',
  duration_minutes TEXT,
  module_count INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_airtable ON courses(airtable_id);

-- ─── LMS: COURSE ENROLLMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  course_id UUID REFERENCES courses(id),
  staff_name TEXT,
  staff_full_name TEXT,
  course_name TEXT,
  enrolled_datetime TIMESTAMPTZ,
  progress NUMERIC(5,2) DEFAULT 0,
  course_expiry_date DATE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);
CREATE INDEX idx_enrollments_airtable ON course_enrollments(airtable_id);

-- ─── LMS: COURSE MODULES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  course_id UUID REFERENCES courses(id),
  name TEXT,
  sort_order NUMERIC(6,1) DEFAULT 0,
  description TEXT,
  status TEXT,
  attachments JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_modules_course ON course_modules(course_id);
CREATE INDEX idx_modules_airtable ON course_modules(airtable_id);

-- ─── LMS: COURSE LESSONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_module ON course_lessons(module_id);
CREATE INDEX idx_lessons_airtable ON course_lessons(airtable_id);

-- ─── LMS: COURSE QUIZZES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  course_id UUID REFERENCES courses(id),
  name TEXT,
  pass_percentage NUMERIC(5,2) DEFAULT 100,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quizzes_course ON course_quizzes(course_id);
CREATE INDEX idx_quizzes_airtable ON course_quizzes(airtable_id);

-- ─── LMS: QUIZ QUESTIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  quiz_id UUID REFERENCES course_quizzes(id),
  question TEXT,
  options TEXT,
  correct_answer INTEGER,
  sort_order NUMERIC(6,1) DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_q_quiz ON course_quiz_questions(quiz_id);
CREATE INDEX idx_quiz_q_airtable ON course_quiz_questions(airtable_id);

-- ─── RECEIPTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_date ON receipts(purchase_date);
CREATE INDEX idx_receipts_airtable ON receipts(airtable_id);

-- ─── CONTACT HISTORY ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_contact_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  email TEXT,
  name TEXT,
  contact_type TEXT,
  method TEXT,
  reason TEXT,
  summary TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emp_history_email ON employee_contact_history(email);
CREATE INDEX idx_emp_history_airtable ON employee_contact_history(airtable_id);

CREATE TABLE IF NOT EXISTS client_contact_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  contact_type TEXT,
  method TEXT,
  reason TEXT,
  summary TEXT,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_history_name ON client_contact_history(client_name);
CREATE INDEX idx_client_history_airtable ON client_contact_history(airtable_id);

-- ─── KNOWLEDGE BASE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  name TEXT,
  title TEXT,
  category TEXT,
  content TEXT,
  body TEXT,
  summary TEXT,
  keywords TEXT,
  tags TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_airtable ON knowledge_base(airtable_id);

-- ─── PAY RATES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sw_contractor_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tfn_pay_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STAFF AVAILABILITY ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  staff_name TEXT,
  staff_email TEXT,
  leave_type TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'Pending',
  notes TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_availability_email ON staff_availability(staff_email);
CREATE INDEX idx_availability_airtable ON staff_availability(airtable_id);

-- ─── ROSTER OF CARE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roc_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roc_part_airtable ON roc_participants(airtable_id);

CREATE TABLE IF NOT EXISTS roc_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roc_shifts_airtable ON roc_shifts(airtable_id);

-- ─── CLIENT DAILY CHARTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_sleep_chart (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sleep_chart_airtable ON client_sleep_chart(airtable_id);

CREATE TABLE IF NOT EXISTS bowel_chart (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bowel_chart_airtable ON bowel_chart(airtable_id);

CREATE TABLE IF NOT EXISTS fluid_intake_diary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fluid_intake_airtable ON fluid_intake_diary(airtable_id);

CREATE TABLE IF NOT EXISTS client_consumables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consumables_airtable ON client_consumables(airtable_id);

CREATE TABLE IF NOT EXISTS client_behaviours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_behaviours_airtable ON client_behaviours(airtable_id);

-- ─── DOCUMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_signing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_signing_airtable ON document_signing_requests(airtable_id);

CREATE TABLE IF NOT EXISTS employment_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emp_docs_airtable ON employment_documents(airtable_id);

CREATE TABLE IF NOT EXISTS client_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_docs_client ON client_docs(client_name);
CREATE INDEX idx_client_docs_airtable ON client_docs(airtable_id);

CREATE TABLE IF NOT EXISTS company_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_files_airtable ON company_files(airtable_id);

-- ─── NDIS PRICE GUIDE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ndis_price_guide (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ndis_item_number ON ndis_price_guide(support_item_number);
CREATE INDEX idx_ndis_airtable ON ndis_price_guide(airtable_id);

-- ─── CHAT / MESSAGING ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  conversation_id UUID REFERENCES chat_conversations(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  conversation_id UUID REFERENCES chat_conversations(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PUSH SUBSCRIPTIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CLIENT MEDIA ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  client_name TEXT,
  client_id UUID REFERENCES clients(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_media_client ON client_media(client_name);
CREATE INDEX idx_client_media_airtable ON client_media(airtable_id);

-- ─── WEEKLY STAKEHOLDER REPORTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_stakeholder_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_reports_airtable ON weekly_stakeholder_reports(airtable_id);

-- ─── RECRUITMENT (Candidate Interactions) ────────────────────
CREATE TABLE IF NOT EXISTS candidate_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_candidate_interactions_airtable ON candidate_interactions(airtable_id);

-- ─── SYNC METADATA ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_metadata (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_sync_meta_table ON sync_metadata(table_name);

-- ─── AIRTABLE ID MAPPING (for resolving linked records) ─────
CREATE TABLE IF NOT EXISTS airtable_id_map (
  airtable_id TEXT PRIMARY KEY,
  supabase_table TEXT NOT NULL,
  supabase_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_id_map_table ON airtable_id_map(supabase_table);

-- ─── AUTO-UPDATE updated_at TRIGGER ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all main tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contacts', 'clients', 'leads', 'rosters', 'progress_notes',
    'ir_reports', 'client_core_budgets', 'sil_properties',
    'client_calendar', 'support_plans', 'tasks', 'courses',
    'course_enrollments', 'course_modules', 'course_lessons',
    'course_quizzes', 'course_quiz_questions', 'receipts',
    'knowledge_base', 'staff_availability', 'client_docs',
    'ndis_price_guide', 'client_media'
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

-- ─── ROW LEVEL SECURITY (basic — can be refined later) ──────
-- Enable RLS on all tables but allow service role full access
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'contacts', 'clients', 'leads', 'rosters', 'progress_notes',
    'ir_reports', 'client_core_budgets', 'sil_properties',
    'client_calendar', 'support_plans', 'tasks', 'courses',
    'course_enrollments', 'course_modules', 'course_lessons',
    'course_quizzes', 'course_quiz_questions', 'receipts',
    'knowledge_base', 'staff_availability', 'client_docs',
    'ndis_price_guide'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('
      DROP POLICY IF EXISTS service_role_all ON %I;
      CREATE POLICY service_role_all ON %I
        FOR ALL USING (TRUE) WITH CHECK (TRUE);
    ', t, t);
  END LOOP;
END;
$$;
