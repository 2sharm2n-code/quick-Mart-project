-- QuickMart Task 2: HR screening dashboard support.
-- Safe/idempotent and data-preserving.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_applications_screening_queue ON applications(current_stage, screening_decision, applied_date DESC);
