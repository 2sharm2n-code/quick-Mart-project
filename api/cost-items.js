import { db } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const { rows } = await db.query("SELECT id, name, description, price_kes, is_required FROM cost_items WHERE active = true ORDER BY is_required DESC, name ASC");
  res.json({ success: true, items: rows });
}