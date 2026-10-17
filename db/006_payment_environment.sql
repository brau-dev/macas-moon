-- This site's existing Tilopay operations were all created in Test (owner-confirmed).
-- Freeze that history before enabling Production. New checkout inserts its environment explicitly.
-- Do not reuse this Test baseline for an unrelated database with unknown/live historical payments.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_environment text NOT NULL DEFAULT 'Test'
  CHECK (payment_environment IN ('Test', 'Production'));
-- Scope link IDs to their environment; never assume Test and live IDs cannot overlap.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_environment_link_idx
  ON reservations (payment_environment, payment_link_id) WHERE payment_link_id IS NOT NULL;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_payment_link_id_key;
