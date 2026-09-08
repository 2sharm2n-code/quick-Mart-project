import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "PUT"];

export default async function (req, res) {
  if (req.method === "GET") {
    const ref = String(req.query?.ref || "").trim();
    if (!ref) return res.status(400).json({ success: false, message: "Application reference is required." });
    const { rows } = await db.query("SELECT application_ref, appointment_date, appointment_time, appointment_instructions, appointment_updated_at FROM applicants WHERE application_ref = $1 LIMIT 1", [ref]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Applicant not found." });
    return res.json({ success: true, appointment: rows[0] });
  }
  const b = req.body || {};
  const ref = String(b.applicationRef || "").trim();
  const date = String(b.appointmentDate || "").trim();
  const time = String(b.appointmentTime || "").trim();
  const instructions = String(b.instructions || "").trim();
  if (!ref || !date || !time) return res.status(400).json({ success: false, message: "Application reference, date and time are required." });
  const { rows } = await db.query("UPDATE applicants SET appointment_date = $2, appointment_time = $3, appointment_instructions = $4, appointment_updated_at = now() WHERE application_ref = $1 RETURNING application_ref, appointment_date, appointment_time, appointment_instructions, appointment_updated_at", [ref, date, time, instructions || null]);
  if (!rows.length) return res.status(404).json({ success: false, message: "Applicant not found." });
  return res.json({ success: true, appointment: rows[0] });
}