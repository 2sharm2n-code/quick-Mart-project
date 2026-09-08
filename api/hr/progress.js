import { db } from "hatchable";

export const access = "member";
export const methods = ["GET"];

export default async function (req, res) {
  // HR progress is for identifiable applicants only. Anonymous browser sessions
  // are not recruitment candidates and must never appear as "Unnamed applicant".
  const { rows } = await db.query(`SELECT session_id, full_name, phone, email, applied_position, current_step, status, started_at, last_seen_at FROM application_progress WHERE NULLIF(TRIM(full_name), '') IS NOT NULL ORDER BY last_seen_at DESC`);
  res.json(rows);
}