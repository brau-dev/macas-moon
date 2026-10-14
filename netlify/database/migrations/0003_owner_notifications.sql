-- Keep guest and owner delivery independent. Do not notify owners retroactively
-- about reservations that already existed before this feature was installed.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS owner_notification_sent_at timestamptz;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS owner_notification_required boolean NOT NULL DEFAULT false;
ALTER TABLE reservations ALTER COLUMN owner_notification_required SET DEFAULT true;
