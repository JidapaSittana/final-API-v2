const express = require("express");
const { pool } = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/v1/menu?available=true
router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT id, name, price, available FROM menu_items";
    const params = [];
    if (req.query.available === "true") {
      sql += " WHERE available = ?";
      params.push(true);
    }
    sql += " ORDER BY id";
    const [rows] = await pool.query(sql, params);
    res.status(200).json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/menu/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "id ต้องเป็นจำนวนเต็มบวก" } });
    }
    const [rows] = await pool.query(
      "SELECT id, name, price, available FROM menu_items WHERE id = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: "MENU_NOT_FOUND", message: "ไม่พบเมนู" } });
    }
    res.status(200).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/menu/:id/availability  (staff เท่านั้น)  body: { available: boolean }
router.patch("/:id/availability", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { available } = req.body;
    if (typeof available !== "boolean") {
      return res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "available ต้องเป็น boolean" } });
    }
    const [result] = await pool.query("UPDATE menu_items SET available = ? WHERE id = ?", [
      available,
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: { code: "MENU_NOT_FOUND", message: "ไม่พบเมนู" } });
    }
    res.status(200).json({ data: { id: Number(req.params.id), available } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
