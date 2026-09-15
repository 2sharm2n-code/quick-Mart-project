import { db } from "hatchable";
import { sendRecruitmentEmail } from "lib/recruitment-mail.js";

export const access = "public";
export const methods = ["GET", "POST"];

const makeRef = () => `QM-APP-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
const screeningQuestions = [
  "How old are you?",
  "What is your current highest education level?",
  "What certificate or qualification do you hold? If none, select None.",
  "How many years of relevant work experience do you have?",
  "Which QuickMart position are you applying for, and which county would you prefer to work in?",
  "Are you available to work shifts, weekends and public holidays when the role requires it?"
];

function screeningProfile(body) {
  const age=Number(body.age);
  if(!Number.isInteger(age)||age<18||age>65)return {error:"Applicants must enter an age from 18 to 65."};
  const level=String(body.educationLevel||"").trim();
  const qualification=String(body.highestQualification||"").trim();
  const experience=String(body.relevantExperience||"").trim();
  if(!level||!qualification||!experience)return {error:"Please complete your education level, qualification and experience fields."};
  return {age,level:level.slice(0,100),qualification:qualification.slice(0,200),experience:experience.slice(0,100)};
}

function publicApplication(row) {
  return {
    application_ref: row.application_ref, full_name: row.full_name, email: row.email, applied_position: row.applied_position,
    home_county: row.home_county, preferred_branch_county: row.preferred_branch_county, status: row.status,
    requires_relocation: row.requires_relocation, applied_at: row.applied_at, total_amount_kes: row.total_amount_kes,
    payment_status: row.payment_status, recruitment_stage: row.recruitment_stage, screening_decision: row.screening_decision,
    interview_date: row.interview_date, interview_time: row.interview_time, paid_at: row.paid_at,
    payment_reference: row.payment_reference || null, payment_receipt: row.payment_receipt || null,
    payment_amount_kes: row.payment_amount_kes || null, payment_completed_at: row.payment_completed_at || row.paid_at || null,
    appointment_date: row.appointment_date, appointment_time: row.appointment_time, appointment_instructions: row.appointment_instructions
  };
}

function answersFrom(body) {
  let source = body.screeningAnswers;
  if (typeof source === "string") { try { source = JSON.parse(source); } catch { source = null; } }
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  // Current screening UI intentionally uses the profile fields above plus one availability confirmation.
  // Keep compatibility with older indexed answers so existing links/data remain readable.
  if (typeof source.availability === "string" && source.availability.trim().length >= 2) {
    return {availability: source.availability.trim().slice(0, 1500)};
  }
  const clean = {};
  for (let i = 0; i < screeningQuestions.length; i++) {
    const value = String(source[String(i)] ?? "").trim();
    if (value.length < 2) return {error:`Please answer screening question ${i + 1}.`};
    clean[String(i)] = value.slice(0, 1500);
  }
  return clean;
}

export default async function(req, res) {
  if (req.method === "GET") {
    const ref = String(req.query?.ref || "").trim().toUpperCase();
    if (!ref || !/^QM-APP-[A-Z0-9]{10}$/.test(ref)) return res.status(400).json({success:false,message:"Enter a valid QuickMart application reference."});
    const { rows } = await db.query("SELECT a.application_ref,a.full_name,a.email,a.applied_position,a.home_county,a.preferred_branch_county,a.status,a.requires_relocation,a.applied_at,a.total_amount_kes,a.payment_status,a.recruitment_stage,a.screening_decision,a.interview_date,a.interview_time,a.paid_at,a.appointment_date,a.appointment_time,a.appointment_instructions,p.payment_reference,p.authorization_url,p.amount_kes AS payment_amount_kes,p.completed_at AS payment_completed_at,(p.metadata->>'receipt_number') AS payment_receipt FROM applicants a LEFT JOIN LATERAL (SELECT payment_reference,authorization_url,amount_kes,completed_at,metadata FROM payments WHERE applicant_id=a.id AND provider='paystack' ORDER BY completed_at DESC NULLS LAST,requested_at DESC LIMIT 1) p ON true WHERE a.application_ref=$1 LIMIT 1", [ref]);
    if (!rows.length) return res.status(404).json({success:false,message:"No application record was found."});
    const application = rows[0];
    if (application.payment_status === "paid" && application.paid_at && !application.appointment_date) {
      const target = new Date(new Date(application.paid_at).getTime() + 10.5 * 24 * 60 * 60 * 1000);
      const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(target);
      const part = type => parts.find(p=>p.type===type)?.value;
      application.appointment_date = `${part("year")}-${part("month")}-${part("day")}`;
      application.appointment_time = "10:30 AM";
      application.appointment_instructions = "Please bring your original National ID and one photocopy, your Paystack payment confirmation, relevant certificates or qualifications, two recent passport-size photos, and a notebook and pen. Report to your selected QuickMart branch at the assigned date and time.";
    }
    return res.json({success:true,application:publicApplication(application)});
  }

  const body=req.body||{};
  const required=["fullName","phone","email","homeCounty","preferredBranchCounty","appliedPosition"];
  const missing=required.find(key=>!String(body[key]??"").trim());
  if(missing)return res.status(400).json({success:false,message:`${missing} is required.`});
  const fullName=String(body.fullName).trim().replace(/\s+/g," "), nationalId=String(body.nationalId||"").trim()||null;
  const phone=String(body.phone).trim().replace(/[\s-]/g,""), email=String(body.email).trim().toLowerCase(), position=String(body.appliedPosition).trim();
  if(!/^[A-Z][A-Za-z'’-]+(?: [A-Z][A-Za-z'’-]+){1,2}$/.test(fullName))return res.status(400).json({success:false,message:"Full name must contain 2 or 3 names, each beginning with a capital letter."});
  if(nationalId&&!/^\d{7,9}$/.test(nationalId))return res.status(400).json({success:false,message:"Enter a valid Kenyan National ID number."});
  if(!/^254(?:7|1)\d{8}$/.test(phone))return res.status(400).json({success:false,message:"Phone must be a valid Kenyan mobile number in 254 format."});
  if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/.test(email))return res.status(400).json({success:false,message:"Only Gmail addresses ending in @gmail.com are accepted."});
  const {rows:positionRows}=await db.query("SELECT title,monthly_pay_kes,slots_available FROM position_catalog WHERE title=$1 AND active=true LIMIT 1",[position]);
  if(!positionRows.length||Number(positionRows[0].slots_available)<=0)return res.status(409).json({success:false,message:"That position is not currently open. Please choose an available position."});
  const duplicateClauses=["LOWER(email)=$1","phone=$2"],duplicateParams=[email,phone];
  if(nationalId){duplicateParams.push(nationalId);duplicateClauses.unshift(`national_id=$${duplicateParams.length}`);}
  const {rows:duplicateRows}=await db.query(`SELECT application_ref,payment_status FROM applicants WHERE ${duplicateClauses.join(" OR ")} ORDER BY applied_at DESC LIMIT 5`,duplicateParams);
  if(duplicateRows.length){const paidMatch=duplicateRows.find(row=>String(row.payment_status||"").toLowerCase()==="paid");if(paidMatch)return res.status(409).json({success:false,alreadyPaid:true,application_ref:paidMatch.application_ref,message:"These details are already linked to a completed payment. Use Application Status to view your confirmation."});return res.status(409).json({success:false,message:"An application already exists for these details. Use Application Status to continue."});}
  const screening=answersFrom(body); if(!screening)return res.status(400).json({success:false,message:"Please complete all screening questions before submitting."}); if(screening.error)return res.status(400).json({success:false,message:screening.error});
  const profile=screeningProfile(body); if(profile.error)return res.status(400).json({success:false,message:profile.error});
  const education=null, educationLevel=profile.level, qualification=profile.qualification, experience=profile.experience;
  const applicationRef=makeRef(), relocated=body.homeCounty!==body.preferredBranchCounty;
  const {rows:activeCosts}=await db.query("SELECT id,price_kes,is_required FROM cost_items WHERE active=true");
  const requested=new Set(Array.isArray(body.selectedCostItemIds)?body.selectedCostItemIds.map(String):[]);
  const optional=activeCosts.filter(item=>!item.is_required&&requested.has(String(item.id))).map(item=>String(item.id));
  const selectedIds=activeCosts.filter(item=>item.is_required||optional.includes(String(item.id))).map(item=>String(item.id));
  const total=activeCosts.reduce((sum,item)=>item.is_required||optional.includes(String(item.id))?sum+Number(item.price_kes||0):sum,0);
  const {rows}=await db.query("INSERT INTO applicants(application_ref,full_name,national_id,phone,email,home_county,preferred_branch_county,applied_position,requires_relocation,selected_cost_item_ids,total_amount_kes,recruitment_stage,age,education_level,education,highest_qualification,relevant_experience,screening_notes,screening_decision,screened_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'screening',$12,$13,$14,$15,$16,$17,'pending',now()) RETURNING application_ref,full_name,national_id,phone,email,home_county,preferred_branch_county,applied_position,requires_relocation,selected_cost_item_ids,total_amount_kes,status,payment_status,recruitment_stage,age,education_level,education,highest_qualification,relevant_experience,applied_at",[applicationRef,fullName,nationalId,phone,email,body.homeCounty,body.preferredBranchCounty,position,relocated,JSON.stringify(selectedIds),total,profile.age,educationLevel,education,qualification,experience,JSON.stringify(screening)]);
  try { await sendRecruitmentEmail({applicant:rows[0],type:"received"}); } catch(err) { console.warn("QuickMart application email unavailable:",String(err?.message||err)); }
  return res.status(201).json({success:true,application:rows[0],screening_questions:screeningQuestions});
}