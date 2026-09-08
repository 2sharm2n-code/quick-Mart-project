import { storage } from "hatchable";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const file = await storage.get("recruitment/quickmart-recruitment-original.webp");
  if (!file) return res.status(404).send("Advertisement image not found");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Content-Type", file.contentType || "image/webp");
  return res.send(file.buffer);
}