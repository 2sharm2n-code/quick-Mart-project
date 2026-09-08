import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET", "PUT"];
const stages = new Set(["application_received", "screening", "shortlisted", "interview", "verification", "selected", "rejected", "onboarding", "completed"]);
const decisions = new Set(["pending", "shortlisted", "rejected"]);
const verification = new Set(["not_started", "pending", "verified", "failed"]);
export default async function (req, res) {
  if (req.method === "GET") {
    const ref = String(req.query?.ref || "").trim().toUpperCase();
    if (ref && !/^QM-APP-[A-Z0-9]{10}$/.test(ref)) return res.status(400).json({ success:false, message:"Enter a valid QuickMart application reference." });
    const { rows } = await db.query("SELECT id, application_ref, full_name, email, phone, applied_position, home_county, preferred_branch_county, status, payment_status, recruitment_stage, education, highest_qualification, screening_score, screening_notes, screened_at, screening_decision, interview_date, interview_time, interview_score, verification_status, hr_notes, applied_at FROM applicants WHERE ($1 = '' OR application_ref = $1) ORDER BY applied_at DESC LIMIT 1", [ref]);
    if (!rows.length) return res.status(404).json({ success:false, message:"Applicant not found." });
    return res.json({ success:true, applicant:rows[0] });
  }
  const body = req.body || {}; let id = String(body.id || "").trim(); const applicationRef = String(body.applicationRef || "").trim().toUpperCase();
  if (applicationRef && !/^QM-APP-[A-Z0-9]{10}$/.test(applicationRef)) return res.status(400).json({ success:false, message:"Enter a valid QuickMart application reference." });
  if (!id && applicationRef) { const { rows: byRef } = await db.query("SELECT id FROM applicants WHERE application_ref = $1 LIMIT 1", [applicationRef]); if (!byRef.length) return res.status(404).json({ success:false, message:"Applicant not found." }); id = String(byRef[0].id); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success:false, message:"Applicant reference or id is required." });
  if (body.recruitmentStage !== undefined && !stages.has(String(body.recruitmentStage))) return res.status(400).json({ success:false, message:"Invalid recruitment stage." });
  if (body.screeningDecision !== undefined && !decisions.has(String(body.screeningDecision))) return res.status(400).json({ success:false, message:"Invalid screening decision." });
  if (body.verificationStatus !== undefined && !verification.has(String(body.verificationStatus))) return res.status(400).json({ success:false, message:"Invalid verification status." });
  const score = body.screeningScore === null || body.screeningScore === undefined || body.screeningScore === '' ? null : Number(body.screeningScore);
  if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) return res.status(400).json({ success:false, message:"Screening score must be a whole number from 0 to 100." });
  const interviewScore = body.interviewScore === null || body.interviewScore === undefined || body.interviewScore === '' ? null : Number(body.interviewScore);
  if (interviewScore !== null && (!Number.isInteger(interviewScore) || interviewScore < 0 || interviewScore > 100)) return res.status(400).json({ success:false, message:"Interview score must be a whole number from 0 to 100." });
  const stage = body.recruitmentStage === undefined ? undefined : String(body.recruitmentStage); const decision = body.screeningDecision === undefined ? undefined : String(body.screeningDecision);
  const { rows: existing } = await db.query("SELECT id, recruitment_stage FROM applicants WHERE id = $1 LIMIT 1", [id]); if (!existing.length) return res.status(404).json({ success:false, message:"Applicant not found." });
  const currentStage=String(existing[0].recruitment_stage||"application_received"); if ((decision === "shortlisted" || decision === "rejected") && !["application_received","screening"].includes(currentStage)) return res.status(409).json({ success:false, message:"This applicant is no longer waiting for screening review." });
  const verificationStatus = body.verificationStatus === undefined ? undefined : String(body.verificationStatus); const notes = body.screeningNotes === undefined ? undefined : String(body.screeningNotes).slice(0,2000); const interviewDate = body.interviewDate === undefined ? undefined : (String(body.interviewDate).trim() || null); const interviewTime = body.interviewTime === undefined ? undefined : (String(body.interviewTime).trim() || null); const hrNotes = body.hrNotes === undefined ? undefined : String(body.hrNotes).slice(0,2000);
  const sets = []; const params = [id]; const add = (sql, value) => { params.push(value); sets.push(`${sql} = $${params.length}`); }; if (stage !== undefined) add("recruitment_stage", stage); if (score !== null) add("screening_score", score); if (notes !== undefined) add("screening_notes", notes); if (decision !== undefined) add("screening_decision", decision); if (interviewDate !== undefined) add("interview_date", interviewDate); if (interviewTime !== undefined) add("interview_time", interviewTime); if (interviewScore !== null) add("interview_score", interviewScore); if (verificationStatus !== undefined) add("verification_status", verificationStatus); if (hrNotes !== undefined) add("hr_notes", hrNotes); if (score !== null || decision !== undefined) sets.push("screened_at = now()"); if (!sets.length) return res.status(400).json({ success:false, message:"No screening changes were supplied." });
  const { rows } = await db.query(`UPDATE applicants SET ${sets.join(", ")} WHERE id = $1 RETURNING id, application_ref, full_name, recruitment_stage, screening_score, screening_decision, interview_date, interview_time, interview_score, verification_status, hr_notes`, params); return res.json({ success:true, applicant:rows[0] });
}