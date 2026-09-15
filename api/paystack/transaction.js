import { db, config } from "hatchable";

export const access = "public";
export const methods = ["POST", "GET"];

const refPattern = /^QM-APP-[A-Z0-9]{10}$/;
const payRefPattern = /^QM-[A-Z0-9-]{10,80}$/;

async function paystackRequest(path, options = {}) {
  const secret = await config.get("PAYSTACK_LIVE_SECRET_KEY");
  const response = await fetch("https://api.paystack.co" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function completeFromPaystack(reference) {
  const { response, data } = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference), { method: "GET" });
  if (!response.ok || !data.status || !data.data) return { ok: false, message: data.message || "Paystack could not verify this transaction." };
  const tx = data.data;
  const { rows } = await db.query("SELECT id, applicant_id, amount_kes, status FROM payments WHERE payment_reference = $1 LIMIT 1", [reference]);
  if (!rows.length) return { ok: false, message: "Payment reference is not linked to a QuickMart application." };
  const payment = rows[0];
  const expected = Number(payment.amount_kes || 0) * 100;
  if (String(tx.currency || "KES").toUpperCase() !== "KES" || Number(tx.amount || 0) !== expected) return { ok: false, message: "Payment amount could not be verified." };
  if (tx.status === "success") {
    await db.query("UPDATE payments SET status = 'completed', completed_at = COALESCE(completed_at, now()), result_code = 0, result_desc = $2, raw_callback = $3::jsonb WHERE id = $1", [payment.id, String(tx.gateway_response || "Paystack payment successful"), JSON.stringify(tx)]);
    await db.query("UPDATE applicants SET payment_status = 'paid', paid_at = COALESCE(paid_at, now()), recruitment_stage = 'completed' WHERE id = $1", [payment.applicant_id]);
    return { ok: true, paid: true, transaction: { reference, receipt: tx.receipt_number || null, amount_kes: Number(tx.amount) / 100, paid_at: tx.paid_at || null } };
  }
  if (["failed", "abandoned", "reversed"].includes(String(tx.status))) {
    await db.query("UPDATE payments SET status = 'failed', result_desc = $2, raw_callback = $3::jsonb WHERE id = $1 AND status <> 'completed'", [payment.id, String(tx.gateway_response || tx.status), JSON.stringify(tx)]);
  }
  return { ok: true, paid: false, status: tx.status };
}

export default async function (req, res) {
  if (req.method === "GET") {
    const reference = String(req.query?.reference || "").trim();
    if (!payRefPattern.test(reference)) return res.status(400).json({ success: false, message: "A valid Paystack payment reference is required." });
    try {
      const result = await completeFromPaystack(reference);
      return res.status(result.ok ? 200 : 400).json({ success: result.ok, ...result });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Payment verification is temporarily unavailable." });
    }
  }

  const body = req.body || {};
  const applicationRef = String(body.applicationRef || "").trim().toUpperCase();
  if (!refPattern.test(applicationRef)) return res.status(400).json({ success: false, message: "A valid QuickMart application reference is required." });
  const { rows } = await db.query("SELECT id, application_ref, full_name, email, total_amount_kes, payment_status, recruitment_stage FROM applicants WHERE application_ref = $1 LIMIT 1", [applicationRef]);
  if (!rows.length) return res.status(404).json({ success: false, message: "Application not found." });
  const applicant = rows[0];
  if (String(applicant.payment_status).toLowerCase() === "paid") return res.json({ success: true, alreadyPaid: true, message: "This application is already paid." });
  const amountKes = Number(applicant.total_amount_kes || 0);
  if (amountKes <= 0) return res.status(400).json({ success: false, message: "There is no onboarding amount due for this application." });
  const reference = "QM-" + crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 24);
  const callbackUrl = "https://quickmart-kenya-ebl3.hatchable.site/payment-callback.html?ref=" + encodeURIComponent(applicationRef);
  try {
    const { response, data } = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: applicant.email,
        amount: String(amountKes * 100),
        currency: "KES",
        reference,
        callback_url: callbackUrl,
        metadata: { application_ref: applicationRef, applicant_id: applicant.id }
      })
    });
    if (!response.ok || !data.status || !data.data?.authorization_url) return res.status(502).json({ success: false, message: data.message || "Paystack could not start the payment." });
    await db.query("INSERT INTO payments (applicant_id, amount_kes, phone, status, requested_at, provider, payment_reference, authorization_url, metadata) VALUES ($1,$2,'',$3,now(),'paystack',$4,$5,$6::jsonb)", [applicant.id, amountKes, "pending", reference, data.data.authorization_url, JSON.stringify({ application_ref: applicationRef })]);
    return res.json({ success: true, authorization_url: data.data.authorization_url, access_code: data.data.access_code, reference, amount_kes: amountKes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Could not start the Paystack payment." });
  }
}