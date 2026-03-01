-- Documents, digital signing, NDIS price guide, chat/messaging, push subscriptions, AI chatbot
-- Chunk 7 of 10 (FIXED: adds ALTER TABLE for pre-existing tables)

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

-- Backfill columns that may be missing on pre-existing document_signing_requests
DO $$ BEGIN
  ALTER TABLE document_signing_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE document_signing_requests ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE document_signing_requests ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_doc_signing_airtable ON document_signing_requests(airtable_id);

CREATE TABLE IF NOT EXISTS employment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  airtable_id TEXT UNIQUE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill columns that may be missing on pre-existing employment_documents
DO $$ BEGIN
  ALTER TABLE employment_documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE employment_documents ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE employment_documents ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing client_docs
DO $$ BEGIN
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS unique_ref TEXT;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS client_name TEXT;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS doc_type TEXT;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS expiry_date DATE;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS updated_by TEXT;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS attachment_summary TEXT;
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
  ALTER TABLE client_docs ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing company_files
DO $$ BEGIN
  ALTER TABLE company_files ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE company_files ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE company_files ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing documents
DO $$ BEGIN
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_to TEXT DEFAULT 'both';
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by UUID;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS contact_id UUID;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id UUID;
  ALTER TABLE documents ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing signing_documents
DO $$ BEGIN
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS document_type TEXT;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS related_id UUID;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS related_type TEXT;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS template_id UUID;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS signatories JSONB DEFAULT '[]';
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS signed_count INT DEFAULT 0;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS required_signatures INT DEFAULT 2;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS pdf_template_path TEXT;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'titus-documents';
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  ALTER TABLE signing_documents ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing signing_requests
DO $$ BEGIN
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES signing_documents(id) ON DELETE CASCADE;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signer_name TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signer_email TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signer_phone TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signer_role TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS signature_data TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS ip_address TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS device_info TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS token TEXT;
  ALTER TABLE signing_requests ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing ndis_price_guide
DO $$ BEGIN
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS support_item_number TEXT;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS support_item_name TEXT;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS support_category_name TEXT;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS registration_group_number TEXT;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'H';
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS charge_per_hour NUMERIC(8,2) DEFAULT 0;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS remote_rate NUMERIC(8,2) DEFAULT 0;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS very_remote_rate NUMERIC(8,2) DEFAULT 0;
  ALTER TABLE ndis_price_guide ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing chat_conversations
DO $$ BEGIN
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'group';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS participant_ids JSONB;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing chat_messages
DO $$ BEGIN
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_id UUID;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_text TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- Backfill columns that may be missing on pre-existing chat_members
DO $$ BEGIN
  ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id);
  ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


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

-- Backfill columns that may be missing on pre-existing push_subscriptions
DO $$ BEGIN
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


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

-- Backfill columns that may be missing on pre-existing chatbot_sessions
DO $$ BEGIN
  ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS airtable_id TEXT;
  ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]';
  ALTER TABLE chatbot_sessions ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_tenant ON chatbot_sessions(tenant_id);
