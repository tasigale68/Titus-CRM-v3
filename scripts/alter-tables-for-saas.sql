-- ============================================================================
-- Titus CRM — Alter Existing Tables for SaaS Multi-Tenancy
-- Run AFTER schema.sql and saas-schema.sql, BEFORE backfill + migrate
--
-- What this does:
--   1. Adds tenant_id column (FK → tenants) to ALL existing tables from schema.sql
--   2. Adds missing SaaS-specific columns to 4 overlapping tables:
--      rosters, chat_conversations, chat_messages, knowledge_base
--   3. Copies data from old column names to new ones (backwards compat)
--   4. Creates tenant_id indexes for query performance
--   5. Creates RLS policies that saas-schema.sql couldn't (tenant_id didn't exist yet)
--
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS and DO...EXCEPTION blocks
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: ADD tenant_id TO ALL EXISTING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Core business tables
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE ir_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_core_budgets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sil_properties ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_calendar ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE support_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- LMS tables
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Contact history
ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Documents
ALTER TABLE document_signing_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE employment_documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE company_files ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Reference data
ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sw_contractor_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tfn_pay_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- RoC
ALTER TABLE roc_participants ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE roc_shifts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Daily charts
ALTER TABLE client_sleep_chart ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE bowel_chart ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE fluid_intake_diary ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_consumables ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_behaviours ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Chat & messaging
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Media & misc
ALTER TABLE client_media ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE weekly_stakeholder_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE candidate_interactions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2: ADD MISSING SaaS COLUMNS TO ROSTERS
-- Original schema has: staff_name, staff_email, shift_status, total_hours_decimal
-- SaaS routes expect: worker_name, worker_email, status, total_hours + payroll cols
-- We add the new columns WITHOUT removing old ones (both legacy sync + SaaS work)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE rosters ADD COLUMN IF NOT EXISTS worker_id UUID;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS worker_name TEXT;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS worker_email TEXT;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS shift_type TEXT;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS total_hours NUMERIC(6,2);
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS base_rate NUMERIC(8,2);
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS penalty_multiplier NUMERIC(4,2) DEFAULT 1.0;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS shift_cost NUMERIC(8,2);
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS ndis_line_item TEXT;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS ndis_unit_price NUMERIC(8,2);
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS ndis_total NUMERIC(8,2);
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unconfirmed';
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS clock_in_time TIMESTAMPTZ;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMPTZ;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS clock_in_location JSONB;
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS compliance_warnings JSONB DEFAULT '[]';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3: ADD MISSING SaaS COLUMNS TO CHAT_CONVERSATIONS
-- Original schema: bare JSONB (id, airtable_id, data, created_at, updated_at)
-- SaaS routes expect: name, type, members, pinned
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'group';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: ADD MISSING SaaS COLUMNS TO CHAT_MESSAGES
-- Original schema: bare JSONB (id, airtable_id, conversation_id, data, created_at)
-- SaaS routes expect: sender_id, sender_name, message_type, content, attachments, read_by
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_id UUID;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5: ADD MISSING SaaS COLUMNS TO KNOWLEDGE_BASE
-- Original schema: name, title, category, content, body, summary, keywords, tags
-- SaaS chatbot expects: filename, content_text, chunks, is_built_in, uploaded_by
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS chunks JSONB;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS is_built_in BOOLEAN DEFAULT false;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS uploaded_by UUID;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6: COPY DATA FROM OLD COLUMN NAMES TO NEW ONES
-- Ensures existing Airtable-migrated data is accessible via new column names
-- Only copies where new column is still NULL (safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- Rosters: staff_name → worker_name, staff_email → worker_email, etc.
UPDATE rosters SET worker_name = staff_name WHERE worker_name IS NULL AND staff_name IS NOT NULL;
UPDATE rosters SET worker_email = staff_email WHERE worker_email IS NULL AND staff_email IS NOT NULL;
UPDATE rosters SET total_hours = total_hours_decimal WHERE total_hours IS NULL AND total_hours_decimal IS NOT NULL;
UPDATE rosters SET status = COALESCE(shift_status, 'unconfirmed') WHERE status = 'unconfirmed' AND shift_status IS NOT NULL AND shift_status != '';
UPDATE rosters SET shift_type = type_of_shift WHERE shift_type IS NULL AND type_of_shift IS NOT NULL;

-- Knowledge base: name → filename, content → content_text
UPDATE knowledge_base SET filename = name WHERE filename IS NULL AND name IS NOT NULL;
UPDATE knowledge_base SET content_text = COALESCE(content, body, '') WHERE content_text IS NULL AND (content IS NOT NULL OR body IS NOT NULL);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 7: INDEXES ON tenant_id
-- These are the indexes that saas-schema.sql tried to create but failed
-- (tenant_id column didn't exist at that point)
-- ═══════════════════════════════════════════════════════════════════════════

-- Key tables queried by SaaS routes via scopeQuery
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant ON rosters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_tenant ON progress_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ir_reports_tenant ON ir_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_core_budgets_tenant ON client_core_budgets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_plans_tenant ON support_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant ON chat_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_tenant ON staff_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sil_properties_tenant ON sil_properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_calendar_tenant ON client_calendar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_tenant ON client_docs(tenant_id);

-- Composite indexes for common SaaS query patterns
-- Note: idx_rosters_client already exists on (client_name) from schema.sql
-- Use different name for the tenant-scoped composite index
CREATE INDEX IF NOT EXISTS idx_rosters_tenant_client ON rosters(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant_worker ON rosters(tenant_id, worker_email);
CREATE INDEX IF NOT EXISTS idx_rosters_tenant_dates ON rosters(tenant_id, start_shift, end_shift);
CREATE INDEX IF NOT EXISTS idx_progress_notes_tenant_client ON progress_notes(tenant_id, client_name);
CREATE INDEX IF NOT EXISTS idx_ir_reports_tenant_client ON ir_reports(tenant_id, client_name);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 8: RLS POLICIES FOR OVERLAPPING TABLES
-- saas-schema.sql couldn't create these because tenant_id didn't exist yet
-- Uses DO...EXCEPTION to handle idempotency (policy may already exist)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE POLICY rosters_isolation ON rosters
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY chat_conversations_isolation ON chat_conversations
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY chat_messages_isolation ON chat_messages
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY knowledge_base_isolation ON knowledge_base
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also add tenant isolation to other high-value tables from schema.sql
DO $$ BEGIN
  CREATE POLICY contacts_isolation ON contacts
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY clients_isolation ON clients
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY leads_isolation ON leads
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY progress_notes_isolation ON progress_notes
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY ir_reports_isolation ON ir_reports
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY support_plans_isolation ON support_plans
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tasks_isolation ON tasks
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY client_core_budgets_isolation ON client_core_budgets
    FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 9: ADD updated_at TRIGGERS TO NEW COLUMNS
-- Ensure the existing update_updated_at_column() trigger handles new tables
-- ═══════════════════════════════════════════════════════════════════════════

-- The trigger function already exists from schema.sql
-- Just make sure overlapping tables have the trigger (they should from schema.sql)
-- No action needed here — triggers fire on UPDATE regardless of which columns changed


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- Next step: Run backfill-delta-tenant.sql to set tenant_id on all rows
-- ═══════════════════════════════════════════════════════════════════════════
