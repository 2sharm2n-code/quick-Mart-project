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
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

const PIPELINE = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Onboarding', 'Completed'];
const ALLOWED_STAGES = new Set([...PIPELINE, 'Rejected']);

function newLookupCode() { return `QM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`; }
function canTransition(from, to) {
  if (!ALLOWED_STAGES.has(to)) return false;
  if (from === to) return true;
  if (from === 'Rejected' || from === 'Completed') return false;
  if (to === 'Rejected') return true;
  return (from === 'Applied' && to === 'Screening') ||
    (from === 'Screening' && to === 'Interview') ||
    (from === 'Interview' && to === 'Offer') ||
    (from === 'Offer' && to === 'Hired') ||
    (from === 'Hired' && to === 'Onboarding') ||
    (from === 'Onboarding' && to === 'Completed');
}

async function recordStage(client, applicationId, previousStage, nextStage, reason, triggeredBy = 'System-Auto') {
  if (previousStage === nextStage) return;
  await client.query(`INSERT INTO stage_history
    (application_id, stage_name, status, previous_stage, triggered_by, reason, completed_at)
    VALUES ($1,$2,'Completed',$3,$4,$5,NOW())`,
    [applicationId, nextStage, previousStage || null, triggeredBy, reason || null]);
  await client.query(`UPDATE applications
    SET progress_log = COALESCE(progress_log,'[]'::jsonb) || jsonb_build_object('stage',$1,'from',$2,'at',NOW(),'reason',$3)
    WHERE id=$4`, [nextStage, previousStage || null, reason || null, applicationId]);
}

async function transition(client, applicationId, nextStage, reason, triggeredBy = 'System-Auto') {
  const current = await client.query('SELECT current_stage FROM applications WHERE id=$1 FOR UPDATE', [applicationId]);
  if (!current.rows.length) return { error: 'not_found' };
  const previousStage = current.rows[0].current_stage || 'Applied';
  if (!canTransition(previousStage, nextStage)) return { error: 'invalid_transition', previousStage };
  if (previousStage !== nextStage) {
    await client.query('UPDATE applications SET current_stage=$1 WHERE id=$2', [nextStage, applicationId]);
    await recordStage(client, applicationId, previousStage, nextStage, reason, triggeredBy);
  }
  return { previousStage, nextStage };
}

async function ensureOnboardingCosts(client, applicationId) {
  const existing = await client.query('SELECT 1 FROM onboarding_costs WHERE application_id=$1 LIMIT 1', [applicationId]);
  if (existing.rows.length) return;
  await client.query(`INSERT INTO onboarding_costs (application_id,cost_item,estimated_cost,payment_status)
    VALUES ($1,'Uniform Package',2500,'Unpaid'),($1,'Medical & Food Handler Certificate',1000,'Unpaid')`, [applicationId]);
}

app.get('/api/jobs', async (req, res) => {
  try { const r = await pool.query('SELECT * FROM jobs WHERE status=$1 ORDER BY posted_date DESC', ['Open']); res.json(r.rows); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/jobs/:id', async (req, res) => {
  try { const r = await pool.query('SELECT * FROM jobs WHERE id=$1', [req.params.id]); if (!r.rows.length) return res.status(404).json({ error: 'Job not found' }); res.json(r.rows[0]); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/apply', async (req, res) => {
  const { job_id, full_name, email, phone, resume_link, cover_letter, source, county, qualification, experience, motivation, cv_file_path } = req.body;
  if (!job_id || !full_name || !email) return res.status(400).json({ error: 'Missing required fields' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const job = await client.query('SELECT id FROM jobs WHERE id=$1 AND status=$2', [job_id, 'Open']);
    if (!job.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Job not found or closed' }); }
    const c = await client.query(`INSERT INTO candidates
      (full_name,email,phone,resume_link,cover_letter,source,county,qualification,experience,motivation,cv_file_path)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,phone=EXCLUDED.phone,resume_link=EXCLUDED.resume_link,
      cover_letter=EXCLUDED.cover_letter,source=EXCLUDED.source,county=EXCLUDED.county,qualification=EXCLUDED.qualification,
      experience=EXCLUDED.experience,motivation=EXCLUDED.motivation,cv_file_path=EXCLUDED.cv_file_path RETURNING id`,
      [full_name,email,phone||null,resume_link||null,cover_letter||null,source||null,county||null,qualification||null,experience||null,motivation||null,cv_file_path||null]);
    const existing = await client.query('SELECT * FROM applications WHERE job_id=$1 AND candidate_id=$2 LIMIT 1', [job_id, c.rows[0].id]);
    if (existing.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Application already exists', data: existing.rows[0], lookup_code: existing.rows[0].lookup_code }); }
    const code = newLookupCode();
    const a = await client.query(`INSERT INTO applications
      (job_id,candidate_id,lookup_code,current_stage,payment_status,onboarding_status)
      VALUES ($1,$2,$3,'Applied','Pending','Not Started') RETURNING *`, [job_id,c.rows[0].id,code]);
    await recordStage(client, a.rows[0].id, null, 'Applied', 'Application submitted', 'System-Auto');
    await client.query('COMMIT');
    res.status(201).json({ message: 'Application submitted successfully!', data: a.rows[0], lookup_code: a.rows[0].lookup_code });
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ error: 'Failed to submit application' }); }
  finally { client.release(); }
});

app.get('/api/applications', async (req, res) => {
  try { const r = await pool.query(`SELECT a.*,j.title job_title,c.full_name,c.email,c.phone,c.county,c.qualification,c.experience,c.identity_verified,
    (SELECT p.payment_status FROM payments p WHERE p.application_id=a.id ORDER BY p.transaction_date DESC LIMIT 1) AS latest_payment_status,
    (SELECT i.scheduled_time FROM interviews i WHERE i.application_id=a.id ORDER BY i.scheduled_time DESC LIMIT 1) AS last_interview
    FROM applications a JOIN jobs j ON a.job_id=j.id JOIN candidates c ON a.candidate_id=c.id ORDER BY a.applied_date DESC`); res.json(r.rows); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/lookup/:code', async (req, res) => {
  try { const r = await pool.query(`SELECT a.id,a.lookup_code,j.title job_title,a.current_stage,a.payment_status,a.onboarding_status,
    c.full_name,a.applied_date,a.appointment_date,a.appointment_instructions,
    (SELECT i.scheduled_time FROM interviews i WHERE i.application_id=a.id ORDER BY i.scheduled_time DESC LIMIT 1) AS interview_time,
    (SELECT i.status FROM interviews i WHERE i.application_id=a.id ORDER BY i.scheduled_time DESC LIMIT 1) AS interview_status,
    (SELECT p.mpesa_receipt_number FROM payments p WHERE p.application_id=a.id AND p.payment_status IN ('Paid','Completed') ORDER BY p.transaction_date DESC LIMIT 1) AS mpesa_receipt_number
    FROM applications a JOIN jobs j ON a.job_id=j.id JOIN candidates c ON a.candidate_id=c.id WHERE a.lookup_code=$1`, [String(req.params.code||'').trim()]);
    if (!r.rows.length) return res.status(404).json({ error: 'Application not found' }); res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

async function handleStageUpdate(req, res, triggeredBy = 'HR') {
  const { stage } = req.body;
  if (!ALLOWED_STAGES.has(stage)) return res.status(400).json({ error: 'Invalid stage' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await transition(client, req.params.id, stage, 'Manual stage update', triggeredBy);
    if (t.error === 'not_found') { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Application not found' }); }
    if (t.error === 'invalid_transition') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Invalid transition from ${t.previousStage} to ${stage}` }); }
    if (stage === 'Offer') await ensureOnboardingCosts(client, req.params.id);
    if (stage === 'Onboarding') await client.query("UPDATE applications SET onboarding_status='In Progress' WHERE id=$1", [req.params.id]);
    if (stage === 'Completed') await client.query("UPDATE applications SET onboarding_status='Completed' WHERE id=$1", [req.params.id]);
    const r = await client.query('SELECT * FROM applications WHERE id=$1', [req.params.id]);
    await client.query('COMMIT'); res.json(r.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ error: 'Server error' }); }
  finally { client.release(); }
}
app.patch('/api/applications/:id/stage', handleStageUpdate);

app.patch('/api/applications/:id/status', async (req, res) => {
  const map = { Pending:'Applied', Reviewed:'Screening', Interview:'Interview', Rejected:'Rejected', Hired:'Hired' };
  const stage = map[req.body.status];
  if (!stage) return res.status(400).json({ error: 'Invalid status' });
  req.body.stage = stage;
  return handleStageUpdate(req, res, 'HR-Legacy');
});

app.post('/api/applications/:id/screening', async (req, res) => {
  const { score, decision, notes } = req.body;
  if (!['Pass','Fail','Pending'].includes(decision)) return res.status(400).json({ error: 'Invalid screening decision' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const a = await client.query('SELECT current_stage FROM applications WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!a.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Application not found' }); }
    if (!['Applied','Screening'].includes(a.rows[0].current_stage)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Application is not available for screening' }); }
    await client.query('UPDATE applications SET screening_score=$1,screening_decision=$2,screening_notes=$3,current_stage=CASE WHEN $2=\'Pending\' THEN \'Screening\' ELSE current_stage END WHERE id=$4', [score==null?null:Number(score),decision,notes||null,req.params.id]);
    if (decision === 'Pass' || decision === 'Fail') {
      const next = decision === 'Pass' ? 'Interview' : 'Rejected';
      const t = await transition(client, req.params.id, next, `Screening decision: ${decision}`, 'HR');
      if (t.error) throw new Error(t.error);
    } else if (a.rows[0].current_stage === 'Applied') {
      await client.query("UPDATE applications SET current_stage='Screening' WHERE id=$1", [req.params.id]);
      await recordStage(client, req.params.id, 'Applied', 'Screening', 'Screening started', 'HR');
    }
    const r = await client.query('SELECT * FROM applications WHERE id=$1', [req.params.id]);
    await client.query('COMMIT'); res.json(r.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ error: 'Failed to save screening' }); }
  finally { client.release(); }
});

app.post('/api/interviews', async (req, res) => {
  const { application_id, interviewer_name, interview_type, scheduled_time, duration_minutes, meeting_link } = req.body;
  if (!application_id || !scheduled_time) return res.status(400).json({ error: 'application_id and scheduled_time are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const a = await client.query('SELECT current_stage FROM applications WHERE id=$1 FOR UPDATE', [application_id]);
    if (!a.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Application not found' }); }
    if (['Rejected','Completed'].includes(a.rows[0].current_stage)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot schedule interview for this application' }); }
    if (a.rows[0].current_stage !== 'Interview') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Application must reach Interview stage before scheduling' }); }
    const r = await client.query(`INSERT INTO interviews(application_id,interviewer_name,interview_type,scheduled_time,duration_minutes,meeting_link,status)
      VALUES($1,$2,$3,$4,$5,$6,'Scheduled') RETURNING *`, [application_id,interviewer_name||null,interview_type||'In-person',scheduled_time,duration_minutes||60,meeting_link||null]);
    await client.query('UPDATE applications SET appointment_date=$1,appointment_instructions=$2 WHERE id=$3', [scheduled_time, meeting_link||'Please attend at the scheduled time.', application_id]);
    await client.query(`INSERT INTO stage_history(application_id,stage_name,status,scheduled_date,triggered_by,reason)
      VALUES($1,'Interview','Scheduled',$2,'HR','Interview scheduled')`, [application_id,scheduled_time]);
    await client.query('COMMIT'); res.status(201).json(r.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ error: 'Failed to schedule interview' }); }
  finally { client.release(); }
});

app.post('/api/interviews/:id/score', async (req, res) => {
  const { score, decision, feedback } = req.body;
  if (!['Hired','Rejected','Hold'].includes(decision)) return res.status(400).json({ error: 'Invalid interview decision' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const i = await client.query('SELECT * FROM interviews WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!i.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Interview not found' }); }
    await client.query("UPDATE interviews SET score=$1,feedback=$2,status='Completed' WHERE id=$3", [score==null?null:Number(score),feedback||null,req.params.id]);
    await client.query('UPDATE applications SET interview_score=$1,interview_decision=$2 WHERE id=$3', [score==null?null:Number(score),decision,i.rows[0].application_id]);
    if (decision === 'Hired') { const t=await transition(client,i.rows[0].application_id,'Offer',`Interview decision: ${decision}`,'HR'); if(t.error)throw new Error(t.error); await ensureOnboardingCosts(client,i.rows[0].application_id); }
    if (decision === 'Rejected') { const t=await transition(client,i.rows[0].application_id,'Rejected',`Interview decision: ${decision}`,'HR'); if(t.error)throw new Error(t.error); }
    const r=await client.query('SELECT * FROM interviews WHERE id=$1',[req.params.id]);
    await client.query('COMMIT'); res.json(r.rows[0]);
  } catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({error:'Failed to save interview score'});} finally{client.release();}
});

app.get('/api/applications/:id/interviews',async(req,res)=>{try{const r=await pool.query('SELECT * FROM interviews WHERE application_id=$1 ORDER BY scheduled_time DESC',[req.params.id]);res.json(r.rows);}catch(e){console.error(e);res.status(500).json({error:'Server error'});}});
app.get('/api/applications/:id/stages',async(req,res)=>{try{const r=await pool.query('SELECT * FROM stage_history WHERE application_id=$1 ORDER BY created_at ASC',[req.params.id]);res.json(r.rows);}catch(e){console.error(e);res.status(500).json({error:'Server error'});}});
app.get('/api/applications/:id/progress',async(req,res)=>{try{const a=await pool.query(`SELECT a.*,j.title job_title,c.full_name,c.email,c.phone,c.county,c.qualification,c.experience,c.identity_verified FROM applications a JOIN jobs j ON a.job_id=j.id JOIN candidates c ON a.candidate_id=c.id WHERE a.id=$1`,[req.params.id]);if(!a.rows.length)return res.status(404).json({error:'Application not found'});const [s,p,i]=await Promise.all([pool.query('SELECT * FROM stage_history WHERE application_id=$1 ORDER BY created_at ASC',[req.params.id]),pool.query('SELECT * FROM payments WHERE application_id=$1 ORDER BY transaction_date ASC',[req.params.id]),pool.query('SELECT * FROM interviews WHERE application_id=$1 ORDER BY scheduled_time ASC',[req.params.id])]);res.json({application:a.rows[0],timeline:s.rows,payments:p.rows,interviews:i.rows});}catch(e){console.error(e);res.status(500).json({error:'Server error'});}});

app.get('/api/dashboard/stats',async(req,res)=>{try{const r=await pool.query(`SELECT COUNT(*)::int total_applications,COUNT(*) FILTER(WHERE current_stage='Screening')::int screening,COUNT(*) FILTER(WHERE current_stage='Interview')::int interviews,COUNT(*) FILTER(WHERE current_stage='Offer')::int offers,COUNT(*) FILTER(WHERE current_stage='Hired')::int hired,COUNT(*) FILTER(WHERE current_stage='Rejected')::int rejected,COUNT(*) FILTER(WHERE payment_status='Pending')::int pending_payments,COUNT(*) FILTER(WHERE payment_status='Paid')::int paid_applications FROM applications`);const t=await pool.query("SELECT COUNT(*)::int interviews_today FROM interviews WHERE scheduled_time::date=CURRENT_DATE AND status='Scheduled'");res.json({...r.rows[0],...t.rows[0]});}catch(e){console.error(e);res.status(500).json({error:'Server error'});}});

const MPESA_CONSUMER_KEY=process.env.MPESA_CONSUMER_KEY||process.env.MPESA_KEY;
const MPESA_SECRET=process.env.MPESA_SECRET;
const MPESA_SHORTCODE=process.env.MPESA_SHORTCODE||'174379';
const MPESA_PASSKEY=process.env.MPESA_PASSKEY;
const MPESA_CALLBACK_URL=process.env.MPESA_CALLBACK_URL;
const MPESA_BASE_URL=(process.env.MPESA_BASE_URL||'https://sandbox.safaricom.co.ke').replace(/\/$/,'');
const MPESA_TEST_MODE=String(process.env.MPESA_TEST_MODE||'').toLowerCase()==='true';
async function getMpesaToken(){if(MPESA_TEST_MODE)return'test-token';if(!MPESA_CONSUMER_KEY||!MPESA_SECRET)throw new Error('M-PESA credentials are not configured');const auth=Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_SECRET}`).toString('base64');const r=await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,{headers:{Authorization:`Basic ${auth}`}});return r.data.access_token;}

app.post('/api/pay/mpesa',async(req,res)=>{const{application_id,phone,amount}=req.body;if(!application_id||!phone||!amount)return res.status(400).json({error:'application_id, phone and amount are required'});try{const a=await pool.query('SELECT id,current_stage FROM applications WHERE id=$1',[application_id]);if(!a.rows.length)return res.status(404).json({error:'Application not found'});if(['Applied','Screening','Interview','Rejected','Completed'].includes(a.rows[0].current_stage))return res.status(400).json({error:'Application is not eligible for onboarding payment'});let data;if(MPESA_TEST_MODE){data={MerchantRequestID:`TEST-MR-${Date.now()}`,CheckoutRequestID:`TEST-CR-${Date.now()}`,ResponseCode:'0',ResponseDescription:'Success. Request accepted for processing.'};}else{if(!MPESA_PASSKEY||!MPESA_CALLBACK_URL)return res.status(400).json({error:'M-PESA environment configuration is incomplete'});const token=await getMpesaToken();const timestamp=new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);const password=Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');const r=await axios.post(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,{BusinessShortCode:MPESA_SHORTCODE,Password:password,Timestamp:timestamp,TransactionType:'CustomerPayBillOnline',Amount:Math.round(Number(amount)),PartyA:phone,PartyB:MPESA_SHORTCODE,PhoneNumber:phone,CallBackURL:MPESA_CALLBACK_URL,AccountReference:`App-${application_id}`,TransactionDesc:'QuickMart Onboarding'},{headers:{Authorization:`Bearer ${token}`}});data=r.data;}await pool.query(`INSERT INTO payments(application_id,amount,mpesa_phone,payment_status,transaction_type,metadata,checkout_request_id,merchant_request_id,result_code,result_description) VALUES($1,$2,$3,'Pending','Onboarding',$4,$5,$6,$7,$8)`,[application_id,amount,phone,data,data.CheckoutRequestID||null,data.MerchantRequestID||null,data.ResponseCode==null?null:Number(data.ResponseCode),data.ResponseDescription||null]);res.json({message:'STK Push sent successfully',checkoutRequestID:data.CheckoutRequestID,CheckoutRequestID:data.CheckoutRequestID,merchantRequestID:data.MerchantRequestID||null});}catch(e){console.error(e.response?.data||e.message);res.status(500).json({error:'M-PESA initiation failed'});}});

app.post('/api/mpesa/callback',async(req,res)=>{const callback=req.body?.Body?.stkCallback;if(!callback)return res.status(400).json({result:'Invalid callback'});const checkout=callback.CheckoutRequestID;if(!checkout)return res.status(400).json({result:'CheckoutRequestID is required'});const code=Number(callback.ResultCode);let receipt=null,amount=null,phone=null;for(const item of callback.CallbackMetadata?.Item||[]){if(item.Name==='MpesaReceiptNumber')receipt=item.Value;if(item.Name==='Amount')amount=item.Value;if(item.Name==='PhoneNumber')phone=item.Value;}const client=await pool.connect();try{await client.query('BEGIN');const p=await client.query("SELECT * FROM payments WHERE checkout_request_id=$1 OR metadata->>'CheckoutRequestID'=$1 OR metadata->>'checkoutRequestID'=$1 FOR UPDATE",[checkout]);if(!p.rows.length){await client.query('ROLLBACK');return res.status(400).json({result:'Payment not found'});}const payment=p.rows[0];const status=code===0?'Paid':'Failed';await client.query(`UPDATE payments SET payment_status=$1,mpesa_receipt_number=COALESCE($2,mpesa_receipt_number),mpesa_phone=COALESCE($3,mpesa_phone),amount=COALESCE($4,amount),result_code=$5,result_description=$6,callback_payload=$7,metadata=COALESCE(metadata,'{}'::jsonb)||$7,checkout_request_id=COALESCE(checkout_request_id,$8) WHERE id=$9`,[status,receipt,phone,amount,code,callback.ResultDesc||null,req.body,checkout,payment.id]);if(status==='Paid'){await client.query("UPDATE applications SET payment_status='Paid' WHERE id=$1",[payment.application_id]);const a=await client.query('SELECT current_stage FROM applications WHERE id=$1 FOR UPDATE',[payment.application_id]);if(a.rows.length&&['Offer','Hired'].includes(a.rows[0].current_stage)){const t=await transition(client,payment.application_id,'Onboarding','M-PESA payment confirmed','System-Auto');if(t.error)throw new Error(t.error);await client.query("UPDATE applications SET onboarding_status='In Progress' WHERE id=$1",[payment.application_id]);await ensureOnboardingCosts(client,payment.application_id);}}else{await client.query("UPDATE applications SET payment_status='Failed' WHERE id=$1",[payment.application_id]);}await client.query('COMMIT');res.json({result:'OK'});}catch(e){await client.query('ROLLBACK');console.error(e);res.status(500).json({result:'ERROR'});}finally{client.release();}});

const transporter=(process.env.GMAIL_USER&&process.env.GMAIL_APP_PASSWORD)?nodemailer.createTransport({service:'gmail',auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}}):null;
async function logCommunication({application_id,channel='Email',recipient,subject='',body,status='Sent'}){await pool.query(`INSERT INTO communications(application_id,channel,direction,subject,body,recipient,status) VALUES($1,$2,'Outbound',$3,$4,$5,$6)`,[application_id,channel,subject,body,recipient,status]);}
app.post('/api/send-email',async(req,res)=>{const{candidate_email,subject,message,application_id}=req.body;if(!candidate_email||!subject||!message||!application_id)return res.status(400).json({error:'candidate_email, subject, message and application_id are required'});if(!transporter)return res.status(503).json({error:'Gmail email service is not configured'});try{await transporter.sendMail({from:process.env.GMAIL_USER,to:candidate_email,subject,text:message});await logCommunication({application_id,recipient:candidate_email,subject,body:message});res.json({success:true});}catch(e){console.error(e);res.status(500).json({error:'Failed to send email'});}});
app.post('/api/communications/send',async(req,res)=>{const{application_id,channel='Email',recipient,subject='',body}=req.body;if(!application_id||!recipient||!body)return res.status(400).json({error:'application_id, recipient and body are required'});if(channel!=='Email')return res.status(501).json({error:'SMS provider is not configured'});if(!transporter)return res.status(503).json({error:'Gmail email service is not configured'});try{await transporter.sendMail({from:process.env.GMAIL_USER,to:recipient,subject,text:body});await logCommunication({application_id,channel,recipient,subject,body});res.json({success:true});}catch(e){console.error(e);res.status(500).json({error:'Failed to send communication'});}});
app.get('/api/onboarding/:id/costs',async(req,res)=>{try{const r=await pool.query('SELECT * FROM onboarding_costs WHERE application_id=$1 ORDER BY id',[req.params.id]);res.json(r.rows);}catch(e){console.error(e);res.status(500).json({error:'Server error'});}});

const initDB=async()=>{try{await pool.query(fs.readFileSync(path.join(__dirname,'sql/schema.sql'),'utf8'));console.log('🗄️ Database tables initialized.');}catch(e){console.error('Error initializing DB:',e);}};
app.listen(PORT,()=>{console.log(`Server running on http://localhost:${PORT}`);initDB();});
