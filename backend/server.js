// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./config/db');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE status = $1 ORDER BY posted_date DESC', ['Open']);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit application using reusable candidates + applications records
app.post('/api/apply', async (req, res) => {
  const { job_id, full_name, email, phone, resume_link, cover_letter, source } = req.body;
  if (!job_id || !full_name || !email) return res.status(400).json({ error: 'Missing required fields' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const candidateResult = await client.query(
      `INSERT INTO candidates (full_name, email, phone, resume_link, cover_letter, source)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name, phone=EXCLUDED.phone,
       resume_link=EXCLUDED.resume_link, cover_letter=EXCLUDED.cover_letter, source=EXCLUDED.source
       RETURNING id`,
      [full_name, email, phone || null, resume_link || null, cover_letter || null, source || null]
    );
    const candidateId = candidateResult.rows[0].id;
    const lookupCode = `QM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const result = await client.query(
      `INSERT INTO applications (job_id, candidate_id, lookup_code)
       VALUES ($1,$2,$3) RETURNING *`,
      [job_id, candidateId, lookupCode]
    );
    await client.query('COMMIT');
    res.status(201).json({ message: 'Application submitted successfully!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to submit application' });
  } finally {
    client.release();
  }
});

// Admin/application listing with payment and latest interview information
app.get('/api/applications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, j.title AS job_title, c.full_name, c.email, c.phone,
        COALESCE((SELECT p.payment_status FROM payments p WHERE p.application_id=a.id ORDER BY p.transaction_date DESC LIMIT 1), 'Pending') AS payment_status,
        (SELECT i.scheduled_time FROM interviews i WHERE i.application_id=a.id ORDER BY i.scheduled_time DESC LIMIT 1) AS last_interview,
        (SELECT sh.stage_name FROM stage_history sh WHERE sh.application_id=a.id ORDER BY sh.created_at DESC LIMIT 1) AS last_stage_event
      FROM applications a
      JOIN jobs j ON a.job_id=j.id
      JOIN candidates c ON a.candidate_id=c.id
      ORDER BY a.applied_date DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public application lookup
app.get('/api/lookup/:code', async (req, res) => {
  const code = String(req.params.code || '').trim();
  try {
    const result = await pool.query(`
      SELECT a.id, j.title AS job_title, a.current_stage, c.full_name, a.applied_date,
        (SELECT i.scheduled_time FROM interviews i WHERE i.application_id=a.id ORDER BY i.scheduled_time DESC LIMIT 1) AS interview_time,
        (SELECT p.payment_status FROM payments p WHERE p.application_id=a.id ORDER BY p.transaction_date DESC LIMIT 1) AS payment_status
      FROM applications a
      JOIN jobs j ON a.job_id=j.id
      JOIN candidates c ON a.candidate_id=c.id
      WHERE a.lookup_code=$1`, [code]);
    if (!result.rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change recruitment stage and record history
app.patch('/api/applications/:id/stage', async (req, res) => {
  const { stage } = req.body;
  const validStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
  if (!validStages.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('UPDATE applications SET current_stage=$1 WHERE id=$2 RETURNING *', [stage, req.params.id]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Application not found' }); }
    await client.query('INSERT INTO stage_history (application_id, stage_name, status) VALUES ($1,$2,$3)', [req.params.id, stage, 'Pending']);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

// Backward-compatible status endpoint
app.patch('/api/applications/:id/status', async (req, res) => {
  const { status } = req.body;
  const map = { Pending: 'Applied', Reviewed: 'Screening', Interview: 'Interview', Rejected: 'Rejected', Hired: 'Hired' };
  if (!map[status]) return res.status(400).json({ error: 'Invalid status' });
  req.body.stage = map[status];
  return app._router.handle(req, res, () => {});
});

// Schedule an interview
app.post('/api/interviews', async (req, res) => {
  const { application_id, interviewer_name, interview_type, scheduled_time, duration_minutes, meeting_link } = req.body;
  if (!application_id || !scheduled_time) return res.status(400).json({ error: 'application_id and scheduled_time are required' });
  try {
    const result = await pool.query(`INSERT INTO interviews
      (application_id, interviewer_name, interview_type, scheduled_time, duration_minutes, meeting_link)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [application_id, interviewer_name || null, interview_type || 'In-person', scheduled_time, duration_minutes || 60, meeting_link || null]);
    await pool.query(`UPDATE applications SET current_stage='Interview' WHERE id=$1`, [application_id]);
    await pool.query(`INSERT INTO stage_history (application_id, stage_name, status, scheduled_date) VALUES ($1,'Interview','Pending',$2)`, [application_id, scheduled_time]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

app.get('/api/applications/:id/interviews', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM interviews WHERE application_id=$1 ORDER BY scheduled_time DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Recruitment stage history
app.get('/api/applications/:id/stages', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stage_history WHERE application_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// M-PESA configuration. Real credentials must come from environment variables.
const MPESA_CONSUMER_KEY = process.env.MPESA_KEY;
const MPESA_SECRET = process.env.MPESA_SECRET;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL;

async function getMpesaToken() {
  if (!MPESA_CONSUMER_KEY || !MPESA_SECRET) throw new Error('M-PESA credentials are not configured');
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_SECRET}`).toString('base64');
  const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  });
  return response.data.access_token;
}

app.post('/api/pay/mpesa', async (req, res) => {
  const { application_id, phone, amount } = req.body;
  if (!application_id || !phone || !amount || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    return res.status(400).json({ error: 'application_id, phone, amount and M-PESA environment configuration are required' });
  }
  try {
    const token = await getMpesaToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(Number(amount)),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: `App-${application_id}`,
      TransactionDesc: 'Recruitment Fee'
    };
    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', stkPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await pool.query(`INSERT INTO payments (application_id, amount, mpesa_phone, payment_status, transaction_type, metadata)
      VALUES ($1,$2,$3,'Pending','Application Fee',$4)`, [application_id, amount, phone, response.data]);
    res.json({ message: 'STK Push sent successfully', checkoutRequestID: response.data.CheckoutRequestID });
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'M-PESA initiation failed' });
  }
});

app.post('/api/mpesa/callback', async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return res.status(400).json({ result: 'Invalid callback' });
    const resultCode = callback.ResultCode;
    const checkoutRequestID = callback.CheckoutRequestID;
    let receipt = null;
    let amount = null;
    let phone = null;
    const items = callback.CallbackMetadata?.Item || [];
    for (const item of items) {
      if (item.Name === 'MpesaReceiptNumber') receipt = item.Value;
      if (item.Name === 'Amount') amount = item.Value;
      if (item.Name === 'PhoneNumber') phone = item.Value;
    }
    const status = Number(resultCode) === 0 ? 'Completed' : 'Failed';
    await pool.query(`UPDATE payments SET payment_status=$1, mpesa_receipt_number=COALESCE($2,mpesa_receipt_number),
      mpesa_phone=COALESCE($3,mpesa_phone), amount=COALESCE($4,amount), metadata=$5
      WHERE metadata->>'CheckoutRequestID'=$6 OR metadata->>'checkoutRequestID'=$6`,
      [status, receipt, phone, amount, req.body, checkoutRequestID]);
    res.json({ result: 'OK' });
  } catch (err) { console.error(err); res.status(500).json({ result: 'ERROR' }); }
});

// Email utility and communication logging
const transporter = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
  : null;

app.post('/api/send-email', async (req, res) => {
  const { candidate_email, subject, message, application_id } = req.body;
  if (!candidate_email || !subject || !message || !application_id) return res.status(400).json({ error: 'candidate_email, subject, message and application_id are required' });
  if (!transporter) return res.status(503).json({ error: 'Gmail email service is not configured' });
  try {
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: candidate_email, subject, text: message });
    await pool.query(`INSERT INTO communications (application_id, channel, direction, subject, body, recipient)
      VALUES ($1,'Email','Outbound',$2,$3,$4)`, [application_id, subject, message, candidate_email]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to send email' }); }
});

const initDB = async () => {
  const schemaPath = path.join(__dirname, 'sql/schema.sql');
  try {
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('🗄️ Database tables initialized.');
  } catch (err) { console.error('Error initializing DB:', err); }
};

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initDB();
});
