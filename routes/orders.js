const express = require("express");
const { pool } = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { calcTotal, canChangeStatus } = require("../utils/order-utils");

const router = express.Router();

const VALID_STATUSES = ["pending", "preparing", "delivered"];

function validationError(res, message) {
  return res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
}

// POST /api/v1/orders  (ต้องเข้าสู่ระบบ)
// body: { customer_name, items: [{ menu_item_id, quantity }] }
// ราคาดึงจาก DB เสมอ (ไม่เชื่อ price ที่ client ส่งมา)
router.post("/", authenticate, async (req, res, next) => {
  const { customer_name, items } = req.body;

  // [1.1] ตรวจรูปแบบข้อมูลก่อนแตะ DB
  if (typeof customer_name !== "string" || customer_name.trim() === "") {
    return validationError(res, "ต้องมี customer_name");
  }
  if (!Array.isArray(items) || items.length === 0) {
    return validationError(res, "ต้องมี items อย่างน้อย 1 รายการ");
  }
  for (const item of items) {
    if (!Number.isInteger(item.menu_item_id) || item.menu_item_id <= 0) {
      return validationError(res, "menu_item_id ต้องเป็นจำนวนเต็มบวก");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return validationError(res, "quantity ต้องเป็นจำนวนเต็ม 1-20");
    }
  }

  // [1.4] ใช้ transaction: order + order_items ต้องสำเร็จพร้อมกันหรือไม่บันทึกเลย
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // [1.2][1.3] ดึงเมนูจริงจาก DB
    const ids = [...new Set(items.map((i) => i.menu_item_id))];
    const [menuRows] = await conn.query(
      "SELECT id, price, available FROM menu_items WHERE id IN (?)",
      [ids]
    );
    const menuById = new Map(menuRows.map((m) => [m.id, m]));

    for (const item of items) {
      const menu = menuById.get(item.menu_item_id);
      if (!menu) {
        await conn.rollback();
        return res.status(404).json({
          error: { code: "MENU_NOT_FOUND", message: `ไม่พบเมนู id ${item.menu_item_id}` },
        });
      }
      if (!menu.available) {
        await conn.rollback();
        return res.status(409).json({
          error: { code: "MENU_UNAVAILABLE", message: `เมนู id ${item.menu_item_id} หมดชั่วคราว` },
        });
      }
    }

    const [orderResult] = await conn.query("INSERT INTO orders (customer_name) VALUES (?)", [
      customer_name.trim(),
    ]);
    const orderId = orderResult.insertId;

    for (const item of items) {
      await conn.query(
        "INSERT INTO order_items (order_id, menu_item_id, quantity) VALUES (?, ?, ?)",
        [orderId, item.menu_item_id, item.quantity]
      );
    }

    await conn.commit();

    const priced = items.map((i) => ({
      price: menuById.get(i.menu_item_id).price,
      quantity: i.quantity,
    }));
    res.status(201).json({
      data: { id: orderId, customer_name: customer_name.trim(), status: "pending", ...calcTotal(priced) },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/v1/orders  (staff เท่านั้น) รายการคำสั่งซื้อทั้งหมดพร้อมยอดรวม ใหม่สุดก่อน
router.get("/", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      "SELECT id, customer_name, status, created_at FROM orders ORDER BY id DESC"
    );
    const [items] = await pool.query(
      `SELECT oi.order_id, m.name, m.price, oi.quantity
         FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
        ORDER BY oi.id`
    );
    const data = orders.map((o) => {
      const own = items.filter((i) => i.order_id === o.id);
      return { ...o, items: own, ...calcTotal(own) };
    });
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/:id  (ต้องเข้าสู่ระบบ)
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      "SELECT id, customer_name, status, created_at FROM orders WHERE id = ?",
      [req.params.id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "ไม่พบคำสั่งซื้อ" } });
    }
    const [items] = await pool.query(
      `SELECT oi.menu_item_id, m.name, m.price, oi.quantity
         FROM order_items oi JOIN menu_items m ON m.id = oi.menu_item_id
        WHERE oi.order_id = ?
        ORDER BY oi.id`,
      [req.params.id]
    );
    res.status(200).json({ data: { ...orders[0], items, ...calcTotal(items) } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/orders/:id/status  (staff เท่านั้น)  body: { status }
router.patch("/:id/status", authenticate, requireRole("staff"), async (req, res, next) => {
  try {
    const { status } = req.body;
    // [2.2] status ต้องอยู่ในรายการที่รู้จัก
    if (!VALID_STATUSES.includes(status)) {
      return validationError(res, `status ต้องเป็นหนึ่งใน ${VALID_STATUSES.join(", ")}`);
    }
    const [orders] = await pool.query("SELECT status FROM orders WHERE id = ?", [req.params.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "ไม่พบคำสั่งซื้อ" } });
    }
    // [2.3] เปลี่ยนได้ตามลำดับเท่านั้น
    if (!canChangeStatus(orders[0].status, status)) {
      return res.status(409).json({
        error: {
          code: "INVALID_STATUS_TRANSITION",
          message: `เปลี่ยนจาก ${orders[0].status} เป็น ${status} ไม่ได้`,
        },
      });
    }
    await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    res.status(200).json({ data: { id: Number(req.params.id), status } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
