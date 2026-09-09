-- QuickMart P1 Block 1 migration: application progress/session timeline.
-- Idempotent and data-preserving. Safe to run after backend/sql/schema.sql.

ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS previous_stage VARCHAR(50);
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(100);
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

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
