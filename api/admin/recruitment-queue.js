import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function(req, res) {
  const { rows } = await db.query(
    "SELECT a.id, a.application_ref, a.full_name, a.email, a.phone, a.national_id, a.applied_position, a.home_county, a.preferred_branch_county, a.education, a.highest_qualification, a.relevant_experience, a.motivation, a.status, a.payment_status, a.total_amount_kes, a.recruitment_stage, a.screening_score, a.screening_notes, a.screened_at, a.screening_decision, a.interview_date, a.interview_time, a.interview_score, a.interview_answers, a.interview_submitted_at, a.cv_url, a.cv_filename, a.verification_status, a.hr_notes, a.applied_at, a.paid_at, a.appointment_date, a.appointment_time, COALESCE((SELECT p.amount_kes FROM payments p WHERE p.applicant_id = a.id AND p.status = 'completed' ORDER BY p.completed_at DESC NULLS LAST, p.requested_at DESC LIMIT 1), 0) AS paid_amount_kes, (SELECT p.mpesa_receipt_number FROM payments p WHERE p.applicant_id = a.id AND p.status = 'completed' ORDER BY p.completed_at DESC NULLS LAST, p.requested_at DESC LIMIT 1) AS mpesa_receipt_number FROM applicants a ORDER BY a.applied_at DESC LIMIT 500"
  );
  const screening = rows.filter(a => ["application_received", "screening"].includes(String(a.recruitment_stage || "")));
  const interviews = rows.filter(a => String(a.recruitment_stage || "") === "interview_submitted");
  const payments = rows.filter(a => String(a.payment_status || "").toLowerCase() === "paid");
  const rejected = rows.filter(a => String(a.recruitment_stage || "") === "rejected");
  return res.json({success:true,notifications:{screening:screening.length,interviews:interviews.length,payments:payments.length,rejected:rejected.length},queues:{screening,interviews,payments,rejected}});
}