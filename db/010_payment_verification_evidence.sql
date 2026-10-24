-- Store only identities learned from the authenticated detail of this exact link.
-- These are lookup candidates, never proof that a payment was approved.
CREATE TABLE IF NOT EXISTS reservation_payment_attempts (
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  identity text NOT NULL,
  transaction_id text,
  order_number text,
  payment_day date,
  PRIMARY KEY (reservation_id, identity),
  CHECK (transaction_id IS NOT NULL OR order_number IS NOT NULL)
);

-- Separate an unavailable verification from a known approved-payment incident.
-- Only sanitized diagnostics, never provider bodies or callback/card data.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_verification_error jsonb;
