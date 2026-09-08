import { db } from "hatchable";

export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  const { rows } = await db.query("SELECT email, refresh_token_ciphertext IS NOT NULL AS connected, updated_at FROM google_gmail_oauth WHERE owner_key = 'quickmart-admin' LIMIT 1");
  const row = rows[0];
  res.json({success:true, configured:Boolean(process.env.GOOGLE_GMAIL_CLIENT_ID && process.env.GOOGLE_GMAIL_CLIENT_SECRET), connected:Boolean(row?.connected), email:row?.email || null, updatedAt:row?.updated_at || null, connectPath:"/api/google/oauth-start"});
}