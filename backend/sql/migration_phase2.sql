-- QuickMart Phase 2 migration
-- Safe/idempotent: creates missing workflow tables and adds columns without dropping data.

CREATE TABLE IF NOT EXISTS stage_history (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  stage_name VARCHAR(50) NOT NULL,
  status VARCHAR(20),
  reviewer_name VARCHAR(100),
  feedback TEXT,
  scheduled_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  interviewer_name VARCHAR(100),
  interview_type VARCHAR(50),
  scheduled_time TIMESTAMP NOT NULL,
  duration_minutes INT DEFAULT 60,
  meeting_link TEXT,
  status VARCHAR(20) DEFAULT 'Scheduled',
  score INTEGER,
  feedback TEXT,
  outcome_notes TEXT
);

CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  channel VARCHAR(20),
  direction VARCHAR(10),
  subject VARCHAR(255),
  body TEXT,
  recipient VARCHAR(255),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'Sent'
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KES',
  mpesa_receipt_number VARCHAR(50),
  mpesa_phone VARCHAR(20),
  payment_status VARCHAR(20) DEFAULT 'Pending',
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS onboarding_costs (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  cost_item VARCHAR(100),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  payment_status VARCHAR(20) DEFAULT 'Unpaid',
  incurred_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS county VARCHAR(100);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_file_path VARCHAR(500);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_score INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_decision VARCHAR(20) DEFAULT 'Pending';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS screening_notes TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_score INTEGER;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_decision VARCHAR(20);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS appointment_instructions TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(30) DEFAULT 'Not Started';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'Pending';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS hr_notes TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS progress_log JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS previous_stage VARCHAR(50);
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(100);
ALTER TABLE stage_history ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mpesa_receipt_number VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS result_code INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS result_description TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS callback_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_checkout_request_id ON payments(checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_stage_history_application ON stage_history(application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_payments_application ON payments(application_id, transaction_date);
