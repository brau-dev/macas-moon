CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY,
  dome text NOT NULL CHECK (dome IN ('domo-romantico', 'domo-amplio')),
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL CHECK (guests BETWEEN 1 AND 4),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL,
  billing_address text NOT NULL,
  billing_city text NOT NULL,
  billing_state text NOT NULL,
  billing_postal_code text NOT NULL,
  billing_country text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL,
  payment_provider text NOT NULL CHECK (payment_provider IN ('tilopay', 'test')),
  payment_reference text UNIQUE,
  expires_at timestamptz,
  confirmed_at timestamptz,
  confirmation_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE TABLE IF NOT EXISTS reservation_nights (
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  dome text NOT NULL,
  night date NOT NULL,
  PRIMARY KEY (reservation_id, night),
  UNIQUE (dome, night)
);

CREATE INDEX IF NOT EXISTS reservations_dome_status_idx ON reservations(dome, status, check_in);
