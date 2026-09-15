import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];

export default async function(req, res) {
  const { rows } = await db.query("SELECT id, title, monthly_pay_kes, slots_available FROM position_catalog WHERE active = true AND slots_available <> 0 ORDER BY title");
  return res.json({success:true, positions:rows});
}