-- Explicit owner-set prices, independent for each dome. No automatic pricing rules.
-- The calendar row serializes rate edits and booking quotes for that dome.
CREATE TABLE IF NOT EXISTS rate_calendars (
  dome text PRIMARY KEY CHECK (dome IN ('domo-amplio', 'domo-romantico'))
);
INSERT INTO rate_calendars (dome) VALUES ('domo-amplio'), ('domo-romantico')
  ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS nightly_prices (
  dome text NOT NULL REFERENCES rate_calendars(dome),
  night date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000000),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dome, night)
);

-- Freeze the accepted breakdown, so later edits never reprice existing bookings.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nightly_prices jsonb NOT NULL DEFAULT '[]'::jsonb;
