import { db, config } from "hatchable";

export const access = "public";
export const methods = ["POST"];

async function verifySignature(req) {
  const secret = await config.get("PAYSTACK_LIVE_SECRET_KEY");
  if (!secret) return false;
  const signature = String(req.headers?.["x-paystack-signature"] || "");
  if (!signature) return false;
  const body = JSON.stringify(req.body || {});
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

export default async function (req, res) {
  try {
    if (!(await verifySignature(req))) return res.status(401).json({ success: false, message: "Invalid Paystack signature." });
    const event = req.body || {};
    if (event.event !== "charge.success") return res.json({ received: true });

    const data = event.data || {};
    const reference = String(data.reference || "").trim();
    const metadata = data.metadata || {};
    const applicationRef = String(metadata.application_ref || reference || "").trim().toUpperCase();
    const amountKes = Number(data.amount || 0) / 100;
    const customerPhone = data.customer?.phone ? String(data.customer.phone) : null;

    const { rows: payments } = await db.query("SELECT id, applicant_id, amount_kes, phone FROM payments WHERE checkout_request_id = $1 LIMIT 1", [reference]);
    const payment = payments[0];
    if (!payment) return res.json({ received: true });

    const amountMatches = Number(payment.amount_kes) === amountKes;
    const phoneMatches = !customerPhone || String(payment.phone).replace(/\D/g, "") === customerPhone.replace(/\D/g, "");
    if (!amountMatches || !phoneMatches) {
      await db.query("UPDATE payments SET status = $1, result_desc = $2, raw_callback = $3 WHERE id = $4", ["failed", "Paystack webhook validation failed.", JSON.stringify(event), payment.id]);
      return res.json({ received: true });
    }

    await db.query("UPDATE payments SET status = $1, mpesa_receipt_number = $2, result_code = $3, result_desc = $4, raw_callback = $5, completed_at = now() WHERE id = $6", ["completed", data.receipt_number || data.transaction_id || null, 0, "Paystack charge.success", JSON.stringify(event), payment.id]);
    await db.query("UPDATE applicants SET payment_status = $1, status = $2, paid_at = COALESCE(paid_at, now()) WHERE id = $3", ["paid", "onboarded", payment.applicant_id]);
    console.log("Paystack charge.success", { reference, applicationRef, amountKes });
    return res.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook error", error?.message || error);
    return res.status(200).json({ received: true });
  }
}