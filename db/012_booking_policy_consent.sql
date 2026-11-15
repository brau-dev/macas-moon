-- Existing reservations keep NULL: never invent historical consent.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS policy_version text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS policy_accepted_at timestamptz;
