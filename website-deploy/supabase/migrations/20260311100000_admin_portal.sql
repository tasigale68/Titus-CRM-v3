-- Add status and notes columns to waitlist for lead tracking
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS status text DEFAULT 'new';
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS notes text;

-- Admin emails table for send/receive tracking
CREATE TABLE IF NOT EXISTS admin_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address text NOT NULL,
  to_address text NOT NULL,
  subject text,
  body_html text,
  lead_id uuid REFERENCES waitlist(id),
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_admin_emails_created_at ON admin_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_emails_lead_id ON admin_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
