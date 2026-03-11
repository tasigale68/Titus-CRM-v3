ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS business_structures jsonb DEFAULT '[]'::jsonb;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS interested_features jsonb DEFAULT '[]'::jsonb;
