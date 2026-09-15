import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "DELETE"];

export default async function (req, res) {
  if (req.method === "GET") {
    const { rows } = await db.query("SELECT a.id, a.application_ref, a.full_name, a.national_id, a.phone, a.email, a.applied_position, a.home_county, a.preferred_branch_county, a.status, a.payment_status, a.total_amount_kes, COALESCE((SELECT p.amount_kes FROM payments p WHERE p.applicant_id = a.id AND p.status = 'completed' ORDER BY p.completed_at DESC NULLS LAST, p.requested_at DESC LIMIT 1), 0) AS paid_amount_kes, (SELECT p.payment_reference FROM payments p WHERE p.applicant_id = a.id AND p.status = 'completed' AND p.provider = 'paystack' ORDER BY p.completed_at DESC NULLS LAST, p.requested_at DESC LIMIT 1) AS payment_reference, a.applied_at, a.appointment_date, a.appointment_time, a.appointment_instructions FROM applicants a ORDER BY a.applied_at DESC LIMIT 500");
    return res.json({ success: true, applicants: rows });
  }

  const body = req.body || {};
  if (body.clearAll === true) {
    await db.query("DELETE FROM application_progress");
    await db.query("DELETE FROM payments");
    const { rows } = await db.query("DELETE FROM applicants RETURNING id, application_ref");
    return res.json({ success: true, cleared: rows.length });
  }
  const id = String(body.id || "").trim();
  if (!id) return res.status(400).json({ success: false, message: "Applicant id is required." });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, message: "Applicant id must be a valid UUID." });

  const { rows: existing } = await db.query("SELECT id, application_ref FROM applicants WHERE id = $1 LIMIT 1", [id]);
  if (!existing[0]) return res.status(404).json({ success: false, message: "Applicant not found." });
  await db.query("DELETE FROM payments WHERE applicant_id = $1", [id]);
  const { rows } = await db.query("DELETE FROM applicants WHERE id = $1 RETURNING id, [id]);

  return res.json({ success: true, deleted: rows[0] });
}