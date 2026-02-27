-- ═══════════════════════════════════════════════════════════
-- MISSING TABLES & COLUMNS — Run in Supabase SQL Editor
-- Generated for Titus CRM v3 — Full Patch
-- ═══════════════════════════════════════════════════════════

-- 1. TRANSCRIPTS — for ElevenLabs call transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  conversation_id TEXT,
  call_sid TEXT UNIQUE,
  caller_phone TEXT,
  transcript TEXT,
  transcript_text TEXT,
  summary TEXT,
  duration INTEGER DEFAULT 0,
  duration_secs INTEGER DEFAULT 0,
  contact_id UUID,
  source TEXT DEFAULT 'elevenlabs',
  call_direction TEXT DEFAULT 'inbound',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transcripts_conversation ON transcripts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_contact ON transcripts(contact_id);

-- 2. TASKS — ensure columns exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_name TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS airtable_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS date_completed DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_airtable ON tasks(airtable_id) WHERE airtable_id IS NOT NULL;

-- 3. CHAT_MESSAGES — ensure columns
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_id TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- 4. CHAT_CONVERSATIONS — ensure columns
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS participant_ids JSONB;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'group';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- 5. CLIENTS — ensure columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender_of_support_workers TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ndis_goals TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_gallery JSONB DEFAULT '[]';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_manager_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS support_coordinator_id UUID;

-- 6. CONTACTS — ensure columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cv_ai_summary TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS km_allowance DECIMAL(8,2);

-- 7. CONTACT_HISTORY — ensure columns
ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'manual';
ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS related_id UUID;
ALTER TABLE contact_history ADD COLUMN IF NOT EXISTS tag TEXT;

-- 8. STAFF_AVAILABILITY
CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
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
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_avail_contact ON staff_availability(contact_id);

-- 9. TFN_PAY_RATES
CREATE TABLE IF NOT EXISTS tfn_pay_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
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
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. INDEPENDENT_CONTRACTOR_INVOICES
CREATE TABLE IF NOT EXISTS independent_contractor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
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
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_contractor ON independent_contractor_invoices(contractor_id);

-- 11. CLIENT_CALENDAR — ensure exists with all fields
CREATE TABLE IF NOT EXISTS client_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  client_id UUID,
  client_name TEXT,
  event_title TEXT,
  event_name TEXT,
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
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_client ON client_calendar(client_name);
CREATE INDEX IF NOT EXISTS idx_calendar_start ON client_calendar(start_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON client_calendar(event_date);

-- 12. CLIENT_PHOTOS
CREATE TABLE IF NOT EXISTS client_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  client_id UUID,
  client_name TEXT,
  photo_url TEXT,
  is_profile BOOLEAN DEFAULT false,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_photos_client ON client_photos(client_name);

-- 13. COURSE_ENROLLMENTS — ensure table and columns
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  contact_id UUID,
  course_id UUID,
  course_name TEXT,
  status TEXT DEFAULT 'enrolled',
  enrolled_date TIMESTAMPTZ DEFAULT now(),
  due_date DATE,
  completed_date DATE,
  progress INTEGER DEFAULT 0,
  airtable_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON course_enrollments(contact_id);

-- 14. DOCUMENTS — ensure columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_to TEXT DEFAULT 'both';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- 15. ROSTERS — ensure km_allowance
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS km_allowance DECIMAL(8,2);

-- 16. USERS — ensure name column for name resolution
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
