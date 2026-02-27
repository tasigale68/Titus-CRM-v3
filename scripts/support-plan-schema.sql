-- =============================================================================
-- CLIENT SUPPORT PLANS SCHEMA
-- =============================================================================
-- Stores comprehensive support plans for NDIS clients across 11 tabbed sections:
--   1. Quick Reference Summary
--   2. About Me
--   3. How I Communicate
--   4. Disability & Support Needs
--   5. Behavioural & Emotional Support
--   6. Health & Medical
--   7. Daily Living & Personal Care
--   8. Community Access & Transport
--   9. Financial Management
--  10. Support Network & Professionals
--  11. Documents
--
-- RUN ORDER:
--   1. scripts/schema.sql           (core tables: tenants, clients, etc.)
--   2. scripts/saas-schema.sql      (SaaS multi-tenancy additions)
--   3. scripts/support-plan-schema.sql  (this file)
-- =============================================================================

-- 1. TABLE
CREATE TABLE IF NOT EXISTS client_support_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- META
  completed_by TEXT,
  completed_date DATE,
  last_reviewed_by TEXT,
  last_reviewed_date DATE,
  review_due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

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
  behaviour_video_links JSONB DEFAULT '[]'::JSONB,
  behaviour_documents JSONB DEFAULT '[]'::JSONB,

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
  specialists JSONB DEFAULT '[]'::JSONB,
  support_network JSONB DEFAULT '[]'::JSONB,
  next_of_kin_name TEXT,
  next_of_kin_relationship TEXT,
  next_of_kin_phone TEXT,
  preferred_contact_method TEXT,

  -- TAB 11: DOCUMENTS
  plan_documents JSONB DEFAULT '[]'::JSONB
);

-- 2. TRIGGER FUNCTION: auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_support_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGER: attach to client_support_plans
CREATE TRIGGER trg_update_support_plan_timestamp
  BEFORE UPDATE ON client_support_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_support_plan_timestamp();

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_support_plans_client_id
  ON client_support_plans(client_id);

CREATE INDEX IF NOT EXISTS idx_support_plans_tenant_id
  ON client_support_plans(tenant_id);
