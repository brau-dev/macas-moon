-- New checkouts have separate payment and night-hold deadlines. Existing
-- checkouts retain their original hold deadline; NULL uses that legacy deadline.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_link_expires_at timestamptz;
