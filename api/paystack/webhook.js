import { db, config, webhooks } from "hatchable";
import { sendRecruitmentEmail } from "lib/recruitment-mail.js";

export const access = "public";
export const methods = ["POST"];

export default async function (req, res) {
  const secret = await config.get("PAYSTACK_LIVE_SECRET_KEY");
  const signature = req.headers?.["x-paystack-signature"] || req.headers?.["X-Paystack-Signature"] || "";
  const ok = await webhooks.verifyHmac({ raw: req.rawBody, signature, secret, algorithm: "sha512", encoding: "hex", tolerance: 0 });
  if (!ok) return res.status(401).json({ success: false, message: "Invalid webhook signature." });
  const event = req.body || {};
  if (event.event !== "charge.success") return res.json({ success: true, ignored: true });
  const tx = event.data || {};
  const reference = String(tx.reference || "").trim();
  if (!reference) return res.status(400).json({ success: false, message: "Missing transaction reference." });
  const { rows } = await db.query("SELECT id, applicant_id, amount_kes, status FROM payments WHERE payment_reference = $1 LIMIT 1", [reference]);
  if (!rows.length) return res.json({ success: true, ignored: true });
  const payment = rows[0];
  if (payment.status === "completed") return res.json({ success: true, already_processed: true });
  const expected = Number(payment.amount_kes || 0) * 100;
  if (String(tx.currency || "KES").toUpperCase() !== "KES" || Number(tx.amount || 0) !== expected || tx.status !== "success") return res.status(400).json({ success: false, message: "Payment verification failed." });
  await db.query("UPDATE payments SET status='completed', completed_at=COALESCE(completed_at,now()), result_code=0, result_desc=$2, raw_callback=$3::jsonb WHERE id=$1", [payment.id, String(tx.gateway_response || "Paystack payment successful"), JSON.stringify(tx)]);
  const paidAt=new Date().toISOString();
  await db.query("UPDATE applicants SET payment_status='paid', paid_at=COALESCE(paid_at,now()), recruitment_stage='completed' WHERE id=$1", [payment.applicant_id]);
  try {
    const {rows:applicants}=await db.query("SELECT application_ref,full_name,email,applied_position,preferred_branch_county,paid_at,appointment_date,appointment_time FROM applicants WHERE id=$1 LIMIT 1",[payment.applicant_id]);
    const a=applicants[0];
    if(a?.email){
      const target=a.appointment_date?new Date(a.appointment_date):new Date(new Date(a.paid_at||paidAt).getTime()+10.5*24*60*60*1000);
      await sendRecruitmentEmail({applicant:a,type:"completed",extra:{report_date:target.toLocaleDateString("en-KE",{day:"numeric",month:"long",year:"numeric"}),report_time:a.appointment_time||"10:30 AM"}});
    }
  } catch(err) { console.warn("QuickMart completion email unavailable:",String(err?.message||err)); }
  return res.json({ success: true, processed: true });
}