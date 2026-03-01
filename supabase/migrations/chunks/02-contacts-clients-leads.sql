-- Contacts, clients, leads
-- Chunk 2 of 10

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

