// ประกาศ middleware และ route แล้ว export app (ไม่เรียก listen ที่นี่)
const path = require("path");
const express = require("express");
const authRoutes = require("./routes/auth");
const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");

const app = express();
app.use(express.json());

// หน้าเว็บ (public/index.html) เปิดที่ http://localhost:3000
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/menu", menuRoutes);
app.use("/api/v1/orders", orderRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "ไม่พบเส้นทาง" } });
});

// error handler กลาง
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาดภายในระบบ" } });
});

module.exports = app;
