// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Route: Get All Jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE status = $1 ORDER BY posted_date DESC', ['Open']);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route: Get Single Job
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route: Submit Application
app.post('/api/apply', async (req, res) => {
  const { job_id, full_name, email, phone, resume_link, cover_letter } = req.body;

  if (!job_id || !full_name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO applications (job_id, full_name, email, phone, resume_link, cover_letter) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [job_id, full_name, email, phone, resume_link, cover_letter]
    );
    res.status(201).json({ message: 'Application submitted successfully!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Route: Get All Applications (Admin only - simplified for now)
app.get('/api/applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications ORDER BY applied_date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize DB Schema on startup (Helper)
const initDB = async () => {
  const schemaPath = path.join(__dirname, 'sql/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(schema);
    console.log('🗄️ Database tables initialized.');
  } catch (err) {
    console.error('Error initializing DB:', err);
  }
};

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initDB();
});
