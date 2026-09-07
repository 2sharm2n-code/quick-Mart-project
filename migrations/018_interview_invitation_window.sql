ALTER TABLE applicants ADD COLUMN IF NOT EXISTS interview_invited_at timestamptz;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS interview_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS applicants_interview_expires_idx ON applicants(interview_expires_at);