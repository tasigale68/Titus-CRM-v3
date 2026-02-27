-- ============================================================================
-- Titus CRM — Backfill tenant_id for Delta Community Support
-- Run AFTER: schema.sql → saas-schema.sql → alter-tables-for-saas.sql → migrate
--
-- What this does:
--   Looks up Delta Community Support's UUID from the tenants table
--   Sets tenant_id on ALL existing rows (WHERE tenant_id IS NULL)
--   Safe to re-run — only updates rows that haven't been assigned yet
--
-- Prerequisites:
--   - tenants table must exist (from saas-schema.sql)
--   - tenant_id columns must exist (from alter-tables-for-saas.sql)
-- ============================================================================

-- Seed Delta Community Support as the first tenant (moved from saas-schema.sql)
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

DO $$
DECLARE
  delta_id UUID;
  row_count BIGINT;
  total_updated BIGINT := 0;
BEGIN
  -- Look up Delta's tenant UUID
  SELECT id INTO delta_id FROM tenants WHERE slug = 'delta-community';

  IF delta_id IS NULL THEN
    RAISE EXCEPTION 'Delta Community Support tenant not found (slug=delta-community). Run saas-schema.sql first to seed the tenant.';
  END IF;

  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE ' Backfilling tenant_id = % for Delta Community Support', delta_id;
  RAISE NOTICE '══════════════════════════════════════════════════════';

  -- ─── Core business tables ─────────────────────────────────

  UPDATE contacts SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  contacts: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE clients SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  clients: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE leads SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  leads: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE rosters SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  rosters: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE progress_notes SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  progress_notes: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE ir_reports SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  ir_reports: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE client_core_budgets SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_core_budgets: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE sil_properties SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  sil_properties: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE client_calendar SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_calendar: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE support_plans SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  support_plans: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE tasks SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  tasks: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE receipts SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  receipts: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE staff_availability SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  staff_availability: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Overlapping tables (also need SaaS columns) ──────────

  UPDATE knowledge_base SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  knowledge_base: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE chat_conversations SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  chat_conversations: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE chat_messages SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  chat_messages: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── LMS tables ───────────────────────────────────────────

  UPDATE courses SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  courses: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE course_enrollments SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  course_enrollments: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE course_modules SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  course_modules: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE course_lessons SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  course_lessons: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE course_quizzes SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  course_quizzes: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE course_quiz_questions SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  course_quiz_questions: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Contact history ──────────────────────────────────────

  UPDATE employee_contact_history SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  employee_contact_history: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE client_contact_history SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_contact_history: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Documents ────────────────────────────────────────────

  UPDATE document_signing_requests SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  document_signing_requests: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE employment_documents SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  employment_documents: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE client_docs SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_docs: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE company_files SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  company_files: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Reference data ───────────────────────────────────────

  UPDATE ndis_price_guide SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  ndis_price_guide: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE sw_contractor_rates SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  sw_contractor_rates: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE tfn_pay_rates SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  tfn_pay_rates: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── RoC ──────────────────────────────────────────────────

  UPDATE roc_participants SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  roc_participants: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE roc_shifts SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  roc_shifts: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Daily charts ─────────────────────────────────────────

  UPDATE client_sleep_chart SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_sleep_chart: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE bowel_chart SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  bowel_chart: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE fluid_intake_diary SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  fluid_intake_diary: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE client_consumables SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_consumables: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE client_behaviours SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_behaviours: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Chat & messaging ────────────────────────────────────

  UPDATE chat_members SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  chat_members: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE push_subscriptions SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  push_subscriptions: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Media & misc ─────────────────────────────────────────

  UPDATE client_media SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  client_media: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE weekly_stakeholder_reports SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  weekly_stakeholder_reports: % rows', row_count; total_updated := total_updated + row_count; END IF;

  UPDATE candidate_interactions SET tenant_id = delta_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  IF row_count > 0 THEN RAISE NOTICE '  candidate_interactions: % rows', row_count; total_updated := total_updated + row_count; END IF;

  -- ─── Summary ──────────────────────────────────────────────

  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE ' Backfill complete: % total rows updated', total_updated;
  RAISE NOTICE '══════════════════════════════════════════════════════';
END $$;
