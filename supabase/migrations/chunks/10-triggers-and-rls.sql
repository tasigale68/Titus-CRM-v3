-- Updated_at triggers and RLS policies for all tables
-- Chunk 10 of 10

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
