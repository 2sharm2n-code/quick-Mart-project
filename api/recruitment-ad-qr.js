import { storage } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const file = await storage.get("recruitment/quickmart-portal-qr.png");
  if (!file) return res.status(404).send("QR code not found");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Content-Type", file.contentType || "image/png");
  return res.send(file.buffer);
}