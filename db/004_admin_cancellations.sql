-- Preserve the original reservation, financial details and cancellation audit.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_from_status text
  CHECK (cancelled_from_status IN ('pending', 'confirmed', 'expired'));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_check_in date;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_check_out date
  CHECK (cancellation_check_out > cancellation_check_in);
-- Splitting a manual block retains a link to the cancelled original.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS parent_block_id uuid REFERENCES reservations(id);
CREATE INDEX IF NOT EXISTS reservations_parent_block_idx ON reservations(parent_block_id)
  WHERE parent_block_id IS NOT NULL;
