-- QuickMart P1 Block 1 migration: application progress/session timeline.
-- Idempotent and data-preserving. Safe to run after backend/sql/schema.sql.

ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS previous_stage VARCHAR(50);
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(100);
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Guard against accidental Express middleware function values being persisted as the actor.
-- This keeps legacy callers safe while the API uses explicit actor strings.
CREATE OR REPLACE FUNCTION quickmart_sanitize_stage_actor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.triggered_by IS NOT NULL AND length(NEW.triggered_by) > 100 THEN
    NEW.triggered_by := 'HR';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sanitize_stage_actor ON stage_history;
CREATE TRIGGER trg_sanitize_stage_actor
BEFORE INSERT OR UPDATE OF triggered_by ON stage_history
FOR EACH ROW EXECUTE FUNCTION quickmart_sanitize_stage_actor();

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS expiry_time TIMESTAMP;

ALTER TABLE onboarding_costs ADD COLUMN IF NOT EXISTS item_name VARCHAR(100);
ALTER TABLE onboarding_costs ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_stage_history_timeline
  ON stage_history(application_id, COALESCE(completed_at, created_at), id);

CREATE INDEX IF NOT EXISTS idx_interviews_application_time
  ON interviews(application_id, scheduled_time);

CREATE INDEX IF NOT EXISTS idx_payments_application_time
  ON payments(application_id, transaction_date);
