import { db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

export default async function (req, res) {
  const b = req.body || {};
  if (!b.session_id) return res.status(400).json({ error: "session_id required" });
  // Do not create anonymous/unnamed HR progress records from a browser that has
  // only opened the portal. Progress becomes a real applicant record once the
  // applicant has supplied their actual full name. This prevents phantom
  // "Unnamed applicant" entries from appearing in the HR board.
  const fullName = String(b.full_name || "").trim().replace(/\s+/g, " ");
  if (!fullName) return res.json({ ok: true, ignored: true });
  const allowedSteps = ["started", "personal_details", "position", "onboarding", "payment", "submitted"];
  const step = allowedSteps.includes(b.current_step) ? b.current_step : "started";
  const status = step === "submitted" ? "completed" : "in_progress";
  await db.query(
    `INSERT INTO application_progress (session_id, full_name, phone, email, applied_position, current_step, status, last_seen_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now(),CASE WHEN $7='completed' THEN now() ELSE NULL END)
     ON CONFLICT (session_id) DO UPDATE SET full_name=COALESCE(EXCLUDED.full_name,application_progress.full_name), phone=COALESCE(EXCLUDED.phone,application_progress.phone), email=COALESCE(EXCLUDED.email,application_progress.email), applied_position=COALESCE(EXCLUDED.applied_position,application_progress.applied_position), current_step=EXCLUDED.current_step, status=EXCLUDED.status, last_seen_at=now(), completed_at=CASE WHEN EXCLUDED.status='completed' THEN now() ELSE application_progress.completed_at END`,
    [b.session_id, fullName, b.phone || null, b.email || null, b.applied_position || null, step, status]
  );
  res.json({ ok: true });
}