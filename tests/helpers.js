// ตัวช่วยสำหรับเทสต์: สร้าง token และ reset ฐานข้อมูลด้วย seed.sql
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const { db, jwtSecret } = require("../config");

function tokenFor(role, id = 1) {
  return jwt.sign({ id, role }, jwtSecret, { expiresIn: "1h" });
}

async function resetDb() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "seed.sql"), "utf8");
  const conn = await mysql.createConnection({ ...db, multipleStatements: true });
  await conn.query(sql);
  await conn.end();
}

module.exports = { tokenFor, resetDb };
