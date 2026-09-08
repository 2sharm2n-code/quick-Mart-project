import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET", "POST", "PUT", "DELETE"];

export default async function (req, res) {
  if (req.method === "GET") {
    const { rows } = await db.query("SELECT id, name, description, price_kes, is_required, active FROM cost_items ORDER BY is_required DESC, name ASC");
    return res.json({ success: true, items: rows });
  }
  const body = req.body || {};
  if (req.method === "POST") {
    if (!String(body.name || "").trim() || Number(body.priceKES) < 0) return res.status(400).json({ success: false, message: "Name and valid price are required." });
    const { rows } = await db.query("INSERT INTO cost_items (name, description, price_kes, is_required) VALUES ($1,$2,$3,$4) RETURNING id, name, description, price_kes, is_required, active", [body.name.trim(), String(body.description || "").trim(), Math.round(Number(body.priceKES)), Boolean(body.isRequired)]);
    return res.status(201).json({ success: true, item: rows[0] });
  }
  const id = String(body.id || "");
  if (!id) return res.status(400).json({ success: false, message: "Item id is required." });
  if (req.method === "PUT") {
    const price = Number(body.priceKES); if (!String(body.name || "").trim() || !Number.isFinite(price) || price < 0) return res.status(400).json({ success: false, message: "Name and valid price are required." });
    const { rows } = await db.query("UPDATE cost_items SET name = $1, description = $2, price_kes = $3, is_required = $4 WHERE id = $5 RETURNING id, name, description, price_kes, is_required, active", [String(body.name || "").trim(), String(body.description || "").trim(), Math.round(price), Boolean(body.isRequired), id]);
    return res.json({ success: true, item: rows[0] });
  }
  await db.query("UPDATE cost_items SET active = false WHERE id = $1 AND is_required = false", [id]);
  return res.json({ success: true });
}