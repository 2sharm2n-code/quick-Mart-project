-- QuickMart Task 2: HR screening dashboard support.
-- Safe/idempotent and data-preserving.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_applications_screening_queue ON applications(current_stage, screening_decision, applied_date DESC);

-- The applicant portal currently submits screening answers as JSON in screening_notes.
-- Keep that API contract compatible while also storing structured answers for HR.
CREATE OR REPLACE FUNCTION quickmart_sync_screening_answers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.screening_notes IS NOT NULL AND btrim(NEW.screening_notes) <> '' THEN
    BEGIN
      IF jsonb_typeof(NEW.screening_notes::jsonb) = 'object' THEN
        NEW.screening_answers := NEW.screening_notes::jsonb;
      END IF;
    EXCEPTION WHEN others THEN
      -- Human HR notes are valid text and must never break a screening update.
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_screening_answers ON applications;
CREATE TRIGGER trg_sync_screening_answers
BEFORE INSERT OR UPDATE OF screening_notes ON applications
FOR EACH ROW EXECUTE FUNCTION quickmart_sync_screening_answers();
