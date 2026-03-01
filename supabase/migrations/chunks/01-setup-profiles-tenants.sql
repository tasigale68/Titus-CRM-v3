-- Trigger function, profiles, tenants, modules, usage
-- Chunk 1 of 10

-- ============================================================================
-- Titus CRM -- Consolidated Supabase Migration
-- 001_initial_schema.sql
--
-- Generated: 2026-03-01
-- Consolidates: schema.sql + saas-schema.sql + missing-tables.sql
--               + alter-tables-for-saas.sql + support-plan-schema.sql
--
-- CONVENTIONS:
--   - CREATE TABLE IF NOT EXISTS for all tables
--   - id UUID PRIMARY KEY DEFAULT gen_random_uuid() on every table
--   - created_at TIMESTAMPTZ DEFAULT now() on every table
--   - updated_at TIMESTAMPTZ DEFAULT now() on every table (where applicable)
--   - airtable_id TEXT UNIQUE on all legacy tables (migration mapping)
--   - data JSONB DEFAULT '{}' on all legacy tables (catch-all)
--   - tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE on all
--     business data tables (multi-tenant scoping)
--   - gen_random_uuid() used exclusively (built-in Postgres 13+)
--   - RLS enabled on ALL tables with service_role_all bypass policy
--   - update_updated_at_column() trigger on ALL tables with updated_at
-- ============================================================================


-- ============================================================================
-- SECTION 0: TRIGGER FUNCTION
-- Must exist before tables reference it
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 1: PROFILES (linked to Supabase auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'support_worker' CHECK (role IN (
    'superadmin', 'director', 'team_leader', 'roster_officer',
    'support_worker', 'contractor', 'stakeholder'
  )),
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);


-- ============================================================================
-- SECTION 2: TENANTS (must be created before anything that references it)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  logo_url TEXT,
  primary_colour TEXT DEFAULT '#0d9488',
  secondary_colour TEXT DEFAULT '#0f172a',
  admin_email TEXT NOT NULL,
  status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  enabled_modules JSONB DEFAULT '[]',
  base_tier TEXT DEFAULT '1-10',
  weekly_price_total NUMERIC(8,2),
  max_users INT DEFAULT 10,
  max_clients INT DEFAULT 50,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_admin_email ON tenants(admin_email);

-- Now add FK from profiles to tenants
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;


-- ============================================================================
-- SECTION 2a: TENANT MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  weekly_price NUMERIC(6,2),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules(tenant_id);


-- ============================================================================
-- SECTION 2b: TENANT USAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  metric TEXT,
  value NUMERIC,
  data JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_metric ON tenant_usage(metric);

