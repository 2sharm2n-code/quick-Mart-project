-- backend/sql/schema.sql (Comprehensive Update)

-- 1. JOBS (Enhanced)
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    type VARCHAR(50),
    department VARCHAR(100),
    hiring_manager_id INT,
    budget_limit DECIMAL(10, 2),
    posted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Open'
);

-- 2. CANDIDATES (Separate from applications for reusability)
CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    resume_link TEXT,
    cover_letter TEXT,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. APPLICATIONS (The core link)
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
    current_stage VARCHAR(50) DEFAULT 'Applied',
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    lookup_code VARCHAR(20) UNIQUE,
    UNIQUE(job_id, candidate_id)
);

-- 4. RECRUITMENT STAGES / PIPELINE HISTORY
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

-- 5. INTERVIEWS & APPOINTMENTS
CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    application_id INT REFERENCES applications(id) ON DELETE CASCADE,
    interviewer_name VARCHAR(100),
    interview_type VARCHAR(50),
    scheduled_time TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 60,
    meeting_link TEXT,
    status VARCHAR(20) DEFAULT 'Scheduled',
    outcome_notes TEXT
);

-- 6. COMMUNICATION LOGS (Gmail/SMS/Messages)
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

-- 7. FINANCIALS: M-PESA & PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    application_id INT REFERENCES applications(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    mpesa_receipt_number VARCHAR(50),
    mpesa_phone VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'Pending',
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- 8. ONBOARDING COSTS
CREATE TABLE IF NOT EXISTS onboarding_costs (
    id SERIAL PRIMARY KEY,
    application_id INT REFERENCES applications(id) ON DELETE CASCADE,
    cost_item VARCHAR(100),
    estimated_cost DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    payment_status VARCHAR(20) DEFAULT 'Unpaid',
    incurred_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SEED DATA FOR TESTING STAGES
INSERT INTO jobs (title, description, location, type, department) VALUES
('Senior Developer', 'Lead frontend team...', 'Nairobi', 'Full-time', 'Engineering'),
('HR Officer', 'Manage recruitment cycles...', 'Mombasa', 'Full-time', 'Human Resources')
ON CONFLICT DO NOTHING;
