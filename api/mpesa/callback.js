import { db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

export default async function (req, res) {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (callback) {
      const resultCode = Number(callback.ResultCode);
      const metadata = callback.CallbackMetadata?.Item || [];
      const find = (name) => metadata.find((item) => item.Name === name)?.Value ?? null;
      const checkout = callback.CheckoutRequestID || null;
      const receipt = find("MpesaReceiptNumber");
      const amount = Number(find("Amount") || 0);
      const phone = find("PhoneNumber");
      const status = resultCode === 0 ? "completed" : "failed";

      const { rows: paymentRows } = await db.query("SELECT id, applicant_id, amount_kes, phone FROM payments WHERE checkout_request_id = $1 LIMIT 1", [checkout]);
      const payment = paymentRows[0];
      const amountMatches = !payment || !amount || Number(payment.amount_kes) === amount;
      const phoneMatches = !payment || !phone || String(payment.phone) === String(phone);
      const acceptedSuccess = resultCode === 0 && amountMatches && phoneMatches;
      const finalStatus = acceptedSuccess ? "completed" : (resultCode === 0 ? "failed" : "failed");

      await db.query("UPDATE payments SET status = $1, mpesa_receipt_number = $2, result_code = $3, result_desc = $4, raw_callback = $5, completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END WHERE checkout_request_id = $6", [finalStatus, receipt, resultCode, callback.ResultDesc || null, JSON.stringify(req.body || {}), checkout]);

      if (payment?.applicant_id) {
        if (acceptedSuccess) {
          await db.query("UPDATE applicants SET payment_status = $1, status = $2, paid_at = COALESCE(paid_at, now()) WHERE id = $3", ["paid", "onboarded", payment.applicant_id]);
        } else if (resultCode !== 0) {
          await db.query("UPDATE applicants SET payment_status = $1 WHERE id = $2", ["failed", payment.applicant_id]);
        }
      }
      console.log("M-PESA callback", { checkout, resultCode, receipt, amount, phone, acceptedSuccess });
    }
  } catch (error) {
    console.error("M-PESA callback processing error", error?.message || error);
  }
  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
}