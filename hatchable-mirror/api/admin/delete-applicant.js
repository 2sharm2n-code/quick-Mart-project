import { db } from "hatchable";
export const access = "admin";
export const methods = ["DELETE"];
export default async function(req, res) {
  const ref = String(req.query?.ref || req.body?.applicationRef || "").trim().toUpperCase();
  if (!ref) return res.status(400).json({success:false,message:"Application reference is required."});
  const found = await db.query("SELECT id, application_ref, full_name FROM applicants WHERE application_ref = $1", [ref]);
  if (!found.rowCount) return res.status(404).json({success:false,message:"Applicant was not found."});
  const applicant = found.rows[0];
  await db.query("DELETE FROM recruitment_messages WHERE applicant_id = $1", [applicant.id]);
  await db.query("DELETE FROM applicant_presence WHERE application_ref = $1", [ref]);
  const result = await db.query("DELETE FROM applicants WHERE id = $1 RETURNING application_ref, full_name", [applicant.id]);
  return res.json({success:true,message:`Removed ${result.rows[0].full_name} (${result.rows[0].application_ref}) from applicant history.`});
}