-- Closing a link and verifying an already-paid single-use link are different facts.
-- Never infer either from cancellation alone, or rewrite financial history.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_consumed_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_checked_at timestamptz;
-- Only application-controlled labels/codes and a random support reference; no provider bodies.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_error jsonb;
