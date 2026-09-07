ALTER TABLE applicants ADD COLUMN IF NOT EXISTS education text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS relevant_experience text;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS motivation text;