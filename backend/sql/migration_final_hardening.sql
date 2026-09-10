-- QuickMart final hardening: persistent CV metadata/data fields.
-- Idempotent and data-preserving.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file_data TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_mime_type VARCHAR(100);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_original_name VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_candidates_identity_verified ON candidates(identity_verified);
