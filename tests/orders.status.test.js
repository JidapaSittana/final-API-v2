// ข้อ 2: PATCH /api/v1/orders/:id/status
const request = require("supertest");
const app = require("../app");
const { pool } = require("../db");
const { tokenFor, resetDb } = require("./helpers");

const staff = tokenFor("staff", 99);
const customer = tokenFor("customer");

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("PATCH /api/v1/orders/:id/status", () => {
  test("ไม่มี token คืน 401", async () => {
    const res = await request(app).patch("/api/v1/orders/3/status").send({ status: "preparing" });
    expect(res.status).toBe(401);
  });

  test("customer เปลี่ยนสถานะไม่ได้ คืน 403", async () => {
    const res = await request(app)
      .patch("/api/v1/orders/3/status")
      .set("Authorization", `Bearer ${customer}`)
      .send({ status: "preparing" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("staff เปลี่ยน pending -> preparing ได้ และค่าใน DB เปลี่ยนจริง", async () => {
    const res = await request(app)
      .patch("/api/v1/orders/3/status")
      .set("Authorization", `Bearer ${staff}`)
      .send({ status: "preparing" });
    expect(res.status).toBe(200);
    const [rows] = await pool.query("SELECT status FROM orders WHERE id = 3");
    expect(rows[0].status).toBe("preparing");
  });

  test("delivered -> pending ไม่ได้ คืน 409 และค่าใน DB ไม่เปลี่ยน", async () => {
    const res = await request(app)
      .patch("/api/v1/orders/1/status")
      .set("Authorization", `Bearer ${staff}`)
      .send({ status: "pending" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    const [rows] = await pool.query("SELECT status FROM orders WHERE id = 1");
    expect(rows[0].status).toBe("delivered");
  });

  test("status ไม่รู้จัก คืน 400", async () => {
    const res = await request(app)
      .patch("/api/v1/orders/3/status")
      .set("Authorization", `Bearer ${staff}`)
      .send({ status: "eaten" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
