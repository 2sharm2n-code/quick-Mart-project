export const access = "admin";
export const methods = ["GET"];

export default async function (req, res) {
  return res.json({
    success: true,
    authorized: true,
    member: {
      id: req.member.id,
      handle: req.member.handle,
      email: req.member.email || null,
      role: req.member.role || "admin",
    },
  });
}