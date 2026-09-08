import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "PUT"];

export default async function(req,res){
  const ref=String(req.query?.ref||req.body?.applicationRef||"").trim().toUpperCase();
  if(!/^QM-APP-[A-Z0-9]{10}$/.test(ref))return res.status(400).json({success:false,message:"Enter a valid application reference."});
  const {rows}=await db.query("SELECT id, application_ref, full_name, national_id, email, phone, applied_position, recruitment_stage, screening_decision, interview_date, interview_time, interview_score, interview_answers, interview_submitted_at, verification_status, status, payment_status FROM applicants WHERE application_ref = $1 LIMIT 1",[ref]);
  const applicant=rows[0];
  if(!applicant)return res.status(404).json({success:false,message:"Applicant not found."});
  if(req.method==="GET")return res.json({success:true,applicant});
  if(String(applicant.recruitment_stage||"")!=="interview_submitted" || !applicant.interview_submitted_at) return res.status(409).json({success:false,message:"Interview review is only available after the applicant has submitted the interview."});
  if(applicant.recruitment_stage!=="interview_submitted" && applicant.recruitment_stage!=="selected" && applicant.recruitment_stage!=="rejected") return res.status(409).json({success:false,message:"This interview has not been submitted by the applicant yet."});
  const raw=req.body?.interviewScore;
  const score=raw===null||raw===undefined||raw===""?null:Number(raw);
  if(score!==null&&(!Number.isInteger(score)||score<0||score>100))return res.status(400).json({success:false,message:"Interview score must be a whole number from 0 to 100."});
  const decision=String(req.body?.decision||"").trim();
  if(!["pending","selected","rejected"].includes(decision))return res.status(400).json({success:false,message:"Choose pending, selected, or rejected."});
  const stage=decision==="selected"?"selected":decision==="rejected"?"rejected":"interview_submitted";
  const {rows:updated}=await db.query("UPDATE applicants SET interview_score = $2, recruitment_stage = $3, verification_status = CASE WHEN $3 = 'selected' THEN 'pending' ELSE verification_status END WHERE id = $1 RETURNING application_ref, full_name, recruitment_stage, interview_score, verification_status",[applicant.id,score,stage]);
  return res.json({success:true,message:"Interview review saved.",applicant:updated[0]});
}