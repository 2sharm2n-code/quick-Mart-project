-- QuickMart P2 completion migration. Idempotent and data-preserving.
-- Adds structured screening answers, communication templates, applicant presence,
-- audit fields, and safer lookup/index support without deleting existing data.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_submitted_at TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_submitted_at TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_seen_stage VARCHAR(50);

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS expiry_time TIMESTAMP;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS room_name VARCHAR(100);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

ALTER TABLE onboarding_costs ADD COLUMN IF NOT EXISTS item_name VARCHAR(100);
ALTER TABLE onboarding_costs ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE onboarding_costs ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'Unpaid';

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file_path VARCHAR(500);

ALTER TABLE communications ADD COLUMN IF NOT EXISTS template_id VARCHAR(80);
ALTER TABLE communications ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE TABLE IF NOT EXISTS communication_templates (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(80) UNIQUE NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'Email',
  subject VARCHAR(255),
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applicant_presence (
  application_id INT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  current_stage VARCHAR(50) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_token VARCHAR(120),
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(100),
  ip_address VARCHAR(64),
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applicant_presence_seen ON applicant_presence(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_application_time ON audit_log(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_application_time ON communications(application_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_last_seen ON applications(last_seen_at DESC);

INSERT INTO communication_templates(template_key,channel,subject,body) VALUES
('interview_invite','Email','QuickMart Kenya Interview Invitation','Dear {{full_name}}, your QuickMart Kenya application {{lookup_code}} has progressed to the interview stage. Please check this same application link and your email for the scheduled interview details.'),
('screening_pass','Email','QuickMart Kenya Application Update','Dear {{full_name}}, your screening for application {{lookup_code}} was successful. Your application has progressed to the interview stage. Please keep checking your email for the next instructions.'),
('screening_fail','Email','QuickMart Kenya Application Update','Dear {{full_name}}, thank you for applying to QuickMart Kenya. Your application {{lookup_code}} was not successful at this stage. We appreciate your interest.'),
('payment_receipt','Email','QuickMart Kenya Payment Confirmation','Dear {{full_name}}, payment for application {{lookup_code}} has been confirmed. Please keep this application link and your payment receipt for your records.')
ON CONFLICT (template_key) DO NOTHING;

-- Backfill structured answers from the previous notes field where possible.
UPDATE applications
SET screening_answers = CASE
  WHEN screening_answers = '{}'::jsonb AND screening_notes IS NOT NULL
       AND left(trim(screening_notes),1) = '{'
  THEN COALESCE(screening_notes::jsonb, '{}'::jsonb)
  ELSE screening_answers
END
WHERE screening_notes IS NOT NULL;
