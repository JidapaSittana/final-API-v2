// ตรวจ JWT และสิทธิ์ตาม role
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "ต้องเข้าสู่ระบบ" } });
  }
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "token ไม่ถูกต้อง" } });
  }
}

// อนุญาตเฉพาะ role ที่ระบุ เช่น requireRole("staff")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "ไม่มีสิทธิ์" } });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
