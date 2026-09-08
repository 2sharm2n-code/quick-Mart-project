import { db, config } from "hatchable";

export const access = "public";
export const methods = ["GET"];

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return `254${digits}`;
  return digits;
}

export default async function (req, res) {
  try {
    const ref = String(req.query?.ref || "").trim().toUpperCase();
    if (!/^QM-APP-[A-Z0-9]{10}$/.test(ref)) {
      return res.status(400).json({ success: false, message: "A valid QuickMart application reference is required." });
    }

    const { rows: applicants } = await db.query(
      "SELECT id, application_ref, phone, total_amount_kes, payment_status, status FROM applicants WHERE application_ref = $1 LIMIT 1",
      [ref]
    );
    if (!applicants.length) return res.status(404).json({ success: false, message: "Application reference was not found." });

    const applicant = applicants[0];
    if (String(applicant.payment_status || "").toLowerCase() === "paid") {
      return res.json({ success: true, payment_status: "paid", status: applicant.status, reference: ref, verified: true });
    }

    const { rows: payments } = await db.query(
      "SELECT id, amount_kes, phone, checkout_request_id, status FROM payments WHERE applicant_id = $1 ORDER BY requested_at DESC LIMIT 1",
      [applicant.id]
    );
    const payment = payments[0];
    if (!payment) return res.json({ success: true, payment_status: applicant.payment_status || "unpaid", status: applicant.status, reference: ref, verified: false });

    if (String(payment.status || "").toLowerCase() === "completed") {
      await db.query("UPDATE applicants SET payment_status = $1, status = $2, paid_at = COALESCE(paid_at, now()) WHERE id = $3", ["paid", "onboarded", applicant.id]);
      return res.json({ success: true, payment_status: "paid", status: "onboarded", reference: ref, verified: true });
    }

    const secretKey = await config.get("PAYSTACK_LIVE_SECRET_KEY");
    if (!secretKey) return res.status(503).json({ success: false, message: "Paystack live payments are not configured yet." });

    // Paystack transaction verification uses /transaction/verify/:reference.
    // The previous implementation called /charge/:reference, which is not the
    // verification endpoint and left successful mobile-money payments stuck in
    // "pending", so the success page and application status never appeared.
    const transactionReference = String(payment.checkout_request_id || ref).trim();
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(transactionReference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const verify = await verifyResponse.json().catch(() => ({}));

    if (!verifyResponse.ok || !verify.status) {
      return res.json({ success: true, payment_status: applicant.payment_status || "pending", status: applicant.status, reference: ref, verified: false });
    }

    const data = verify.data || {};
    const amountMatches = Number(data.amount || 0) === Math.round(Number(applicant.total_amount_kes || 0) * 100);
    const customerPhone = data.customer?.phone ? normalizePhone(data.customer.phone) : "";
    const applicationPhone = normalizePhone(applicant.phone);
    const phoneMatches = !customerPhone || customerPhone === applicationPhone;

    if (data.status === "success" && amountMatches && phoneMatches) {
      const receipt = data.receipt_number || data.transaction_code || data.transaction_id || null;
      const resultRaw = JSON.stringify(data);
      await db.query(
        "UPDATE payments SET status = $1, mpesa_receipt_number = $2, result_code = $3, result_desc = $4, raw_callback = $5, completed_at = COALESCE(completed_at, now()) WHERE id = $6",
        ["completed", receipt, 0, "Paystack transaction verified as successful.", resultRaw, payment.id]
      );
      await db.query(
        "UPDATE applicants SET payment_status = $1, status = $2, paid_at = COALESCE(paid_at, now()) WHERE id = $3",
        ["paid", "onboarded", applicant.id]
      );
      return res.json({ success: true, payment_status: "paid", status: "onboarded", reference: ref, verified: true });
    }

    return res.json({
      success: true,
      payment_status: data.status === "failed" ? "failed" : "pending",
      status: applicant.status,
      reference: ref,
      verified: false
    });
  } catch (error) {
    console.error("Payment status verification error", error?.message || error);
    return res.status(500).json({ success: false, message: "Unable to verify payment status right now." });
  }
}