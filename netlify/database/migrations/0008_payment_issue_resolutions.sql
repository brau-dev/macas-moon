-- Private administrative acknowledgement; never changes a payment or a booking.
-- Match the exact incident text so a different incident becomes visible again.
CREATE TABLE IF NOT EXISTS payment_issue_resolutions (
  id uuid PRIMARY KEY,
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  issue text NOT NULL CHECK (length(issue) > 0),
  note text NOT NULL CHECK (length(note) BETWEEN 3 AND 500),
  resolved_by text NOT NULL CHECK (length(resolved_by) BETWEEN 1 AND 80),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, issue)
);
