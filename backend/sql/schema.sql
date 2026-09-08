-- backend/sql/schema.sql

-- Table for Job Postings
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255),
    type VARCHAR(50),
    posted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Open'
);

-- Table for Applications
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    resume_link TEXT,
    cover_letter TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some dummy data (Optional, helps testing)
INSERT INTO jobs (title, description, location, type) VALUES
('Store Manager', 'Manage daily operations of Quick Mart.', 'New York', 'Full-time'),
('Cashier', 'Handle transactions and customer service.', 'Chicago', 'Part-time'),
('Stock Associate', 'Organize inventory and restock shelves.', 'Los Angeles', 'Full-time')
ON CONFLICT DO NOTHING;
