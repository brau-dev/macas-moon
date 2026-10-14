-- Additive migration: preserves existing reservations and their legacy billing data.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'booking'
  CHECK (kind IN ('booking', 'manual'));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_id text UNIQUE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_closed_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_issue text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_checked_at timestamptz;
ALTER TABLE reservations ALTER COLUMN billing_address SET DEFAULT '';
ALTER TABLE reservations ALTER COLUMN billing_city SET DEFAULT '';
ALTER TABLE reservations ALTER COLUMN billing_state SET DEFAULT '';
ALTER TABLE reservations ALTER COLUMN billing_postal_code SET DEFAULT '';
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_payment_provider_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_payment_provider_check
  CHECK (payment_provider IN ('tilopay', 'test', 'manual'));

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  credentials_fingerprint text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_login_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL,
  window_started_at timestamptz NOT NULL
);
