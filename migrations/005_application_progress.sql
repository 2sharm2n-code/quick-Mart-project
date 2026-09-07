CREATE TABLE IF NOT EXISTS application_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE NOT NULL,
  full_name text,
  phone text,
  email text,
  applied_position text,
  current_step text NOT NULL DEFAULT 'started',
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);