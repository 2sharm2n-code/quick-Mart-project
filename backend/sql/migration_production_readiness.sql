-- QuickMart production-readiness additions. Idempotent and data-preserving.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file_data TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_mime_type VARCHAR(120);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_original_name VARCHAR(255);
ALTER TABLE communications ADD COLUMN IF NOT EXISTS provider VARCHAR(40);
ALTER TABLE communications ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(160);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_applications_lookup_code ON applications(lookup_code);

INSERT INTO communication_templates(template_key,channel,subject,body) VALUES
('interview_invite_sms','SMS',NULL,'QuickMart Kenya: Dear {{full_name}}, application {{lookup_code}} has reached the interview stage. Check your email and the same application link for details.'),
('payment_receipt_sms','SMS',NULL,'QuickMart Kenya: Payment for application {{lookup_code}} has been confirmed. Keep your application link and receipt for your records.')
ON CONFLICT (template_key) DO NOTHING;
