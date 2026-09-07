ALTER TABLE applicants ADD COLUMN IF NOT EXISTS interview_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS interview_submitted_at timestamptz;
CREATE INDEX IF NOT EXISTS applicants_interview_submitted_idx ON applicants(interview_submitted_at);