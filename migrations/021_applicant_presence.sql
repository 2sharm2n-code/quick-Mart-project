CREATE TABLE IF NOT EXISTS applicant_presence (
  application_ref text PRIMARY KEY REFERENCES applicants(application_ref) ON DELETE CASCADE,
  current_section text NOT NULL DEFAULT 'screening',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  session_token text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS applicant_presence_last_seen_idx ON applicant_presence(last_seen_at DESC);
