-- LMS (courses, enrollments, modules, lessons, quizzes), receipts, contact history, knowledge base
-- Chunk 5 of 10 (FIXED: adds ALTER TABLE for pre-existing tables)

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

-- Backfill columns that may be missing on pre-existing courses
DO $$ BEGIN
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS category TEXT;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS frequency_months TEXT;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_minutes TEXT;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS module_count INTEGER DEFAULT 0;
  ALTER TABLE courses ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing course_enrollments
DO $$ BEGIN
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS staff_name TEXT;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS staff_full_name TEXT;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS course_name TEXT;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS enrolled_datetime TIMESTAMPTZ;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS enrolled_date TIMESTAMPTZ DEFAULT now();
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS progress NUMERIC(5,2) DEFAULT 0;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'enrolled';
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS due_date DATE;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS completed_date DATE;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS course_expiry_date DATE;
  ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing course_modules
DO $$ BEGIN
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS sort_order NUMERIC(6,1) DEFAULT 0;
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS status TEXT;
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
  ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing course_lessons
DO $$ BEGIN
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES course_modules(id);
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS sort_order NUMERIC(6,1) DEFAULT 0;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS lesson_type TEXT DEFAULT 'Content';
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS content TEXT;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS status TEXT;
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
  ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing course_quizzes
DO $$ BEGIN
  ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);
  ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS pass_percentage NUMERIC(5,2) DEFAULT 100;
  ALTER TABLE course_quizzes ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing course_quiz_questions
DO $$ BEGIN
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES course_quizzes(id);
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS question TEXT;
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS options TEXT;
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS correct_answer INTEGER;
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS sort_order NUMERIC(6,1) DEFAULT 0;
  ALTER TABLE course_quiz_questions ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing receipts
DO $$ BEGIN
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS unique_receipt_id TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS supplier_name TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS purchase_date DATE;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS purchase_date_formatted TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2);
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'AUD';
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS purpose TEXT[];
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS staff_email TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS staff_name TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS job_title TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS comments TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_url TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS ai_summary TEXT;
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reimbursement TEXT DEFAULT 'NO';
  ALTER TABLE receipts ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing employee_contact_history
DO $$ BEGIN
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS contact_type TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS method TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS reason TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE employee_contact_history ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing client_contact_history
DO $$ BEGIN
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS contact_type TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS method TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS reason TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE client_contact_history ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing contact_history
DO $$ BEGIN
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS contact_name TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS contact_type TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS method TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS reason TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'manual';
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS source TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS related_id UUID;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS tag TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing knowledge_base
DO $$ BEGIN
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS category TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS content TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS body TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS keywords TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS tags TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS filename TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS content_text TEXT;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS chunks JSONB;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS is_built_in BOOLEAN DEFAULT false;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS uploaded_by UUID;
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT now();
  ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_kb_airtable ON knowledge_base(airtable_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
