// ข้อ 1: POST /api/v1/orders
const request = require("supertest");
const app = require("../app");
const { pool } = require("../db");
const { tokenFor, resetDb } = require("./helpers");

const customer = tokenFor("customer");

async function countOrders() {
  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM orders");
  return rows[0].n;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("POST /api/v1/orders", () => {
  test("สร้างสำเร็จ คืน 201 และคิดราคาจาก DB ไม่ใช่จาก client", async () => {
    // Arrange: client ส่ง price ปลอมมาเป็น 1 บาท
    const body = {
      customer_name: "ทดสอบ",
      items: [
        { menu_item_id: 1, quantity: 2, price: 1 }, // ข้าวผัดกุ้ง 60
        { menu_item_id: 15, quantity: 1, price: 1 }, // ชาเย็น 25
      ],
    };
    // Act
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer}`)
      .send(body);
    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.total).toBe(145);

    const [items] = await pool.query("SELECT * FROM order_items WHERE order_id = ?", [
      res.body.data.id,
    ]);
    expect(items).toHaveLength(2);
  });

  test("ไม่มี token คืน 401", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .send({ customer_name: "x", items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  test("quantity = 0 คืน 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer}`)
      .send({ customer_name: "x", items: [{ menu_item_id: 1, quantity: 0 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("เมนูไม่มีอยู่จริง คืน 404 MENU_NOT_FOUND", async () => {
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer}`)
      .send({ customer_name: "x", items: [{ menu_item_id: 9999, quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MENU_NOT_FOUND");
  });

  test("มีเมนูหมด (id 9) ปนอยู่ คืน 409 และไม่มี order ใหม่ถูกบันทึก", async () => {
    const before = await countOrders();
    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customer}`)
      .send({
        customer_name: "x",
        items: [
          { menu_item_id: 1, quantity: 1 },
          { menu_item_id: 9, quantity: 1 },
        ],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MENU_UNAVAILABLE");
    expect(await countOrders()).toBe(before);
  });
});
