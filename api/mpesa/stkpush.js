import { db, config } from "hatchable";

export const access = "public";
export const methods = ["POST"];

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return `+254${digits}`;
  throw new Error("Enter a valid Kenyan M-PESA number, for example 0712345678.");
}

export default async function (req, res) {
  try {
    const { phone, applicationRef } = req.body || {};
    const normalizedPhone = normalizePhone(phone);
    const ref = String(applicationRef || "").trim().toUpperCase();
    if (!/^QM-APP-[A-Z0-9]{10}$/.test(ref)) return res.status(400).json({ success: false, message: "A valid QuickMart application reference is required." });

    const { rows: applicants } = await db.query("SELECT id, phone, email, full_name, payment_status, total_amount_kes FROM applicants WHERE application_ref = $1 LIMIT 1", [ref]);
    if (!applicants.length) return res.status(404).json({ success: false, message: "Application reference was not found." });
    const applicant = applicants[0];
    const storedPhone = normalizePhone(applicant.phone);
    if (storedPhone !== normalizedPhone) return res.status(400).json({ success: false, message: "The payment phone number must match the phone number on the application." });
    if (String(applicant.payment_status || "") === "paid") return res.status(409).json({ success: false, message: "This application has already been paid." });

    const amount = Number(applicant.total_amount_kes || 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "No valid payment amount is attached to this application." });

    const secretKey = await config.get("PAYSTACK_LIVE_SECRET_KEY");
    if (!secretKey) return res.status(503).json({ success: false, message: "Paystack live payments are not configured yet." });
    // Paystack requires every charge reference to be unique. The application
    // reference identifies the applicant, but it must NOT be reused as the
    // payment transaction reference when a failed/pending attempt is retried.
    const paymentReference = `QM-PAY-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const webhookUrl = `${new URL(req.url).origin}/api/paystack/webhook`;
    const response = await fetch("https://api.paystack.co/charge", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        email: applicant.email,
        currency: "KES",
        mobile_money: { phone: normalizedPhone, provider: "mpesa" },
        reference: paymentReference,
        metadata: { application_ref: ref, applicant_name: applicant.full_name, webhook_url: webhookUrl }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.status) throw new Error(result.message || `Paystack returned HTTP ${response.status}.`);

    const payment = result.data || {};
    await db.query("INSERT INTO payments (applicant_id, amount_kes, phone, merchant_request_id, checkout_request_id, status, requested_at, raw_callback) VALUES ($1,$2,$3,$4,$5,$6,now(),$7)", [applicant.id, amount, normalizedPhone, null, payment.reference || null, payment.status === "success" ? "completed" : "initiated", JSON.stringify(result)]);
    await db.query("UPDATE applicants SET payment_status = $1 WHERE id = $2", [payment.status === "success" ? "paid" : "pending", applicant.id]);

    return res.json({ success: true, message: payment.display_text || "M-PESA prompt sent. Check your phone and enter your PIN.", reference: payment.reference || paymentReference, status: payment.status || "pay_offline" });
  } catch (error) {
    console.error("Paystack M-PESA error", error?.message || error);
    const message = error?.message || "Unable to initiate payment.";
    const missingConfig = /Configuration value .* is declared as required but not set/i.test(message);
    return res.status(missingConfig ? 503 : 500).json({ success: false, message: missingConfig ? "Paystack live payments are not configured yet." : message });
  }
}