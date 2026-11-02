// สำหรับทดลองผ่านหน้าเว็บเท่านั้น: ขอ token ตาม role โดยไม่ต้องมีระบบสมัครสมาชิก
// ปิดอัตโนมัติเมื่อ NODE_ENV=production (ระบบจริงต้องมี login ที่ตรวจรหัสผ่าน)
const express = require("express");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

const router = express.Router();

router.post("/demo-token", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทาง" } });
  }
  const { role } = req.body || {};
  if (!["customer", "staff"].includes(role)) {
    return res
      .status(400)
      .json({ error: { code: "VALIDATION_ERROR", message: "role ต้องเป็น customer หรือ staff" } });
  }
  const token = jwt.sign({ id: role === "staff" ? 99 : 1, role }, jwtSecret, { expiresIn: "8h" });
  res.status(200).json({ data: { role, token } });
});

module.exports = router;
