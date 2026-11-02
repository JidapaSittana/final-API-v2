// ข้อ 3.3: mock DB เพื่อทดสอบกรณีฐานข้อมูลล้มเหลว
// jest.mock ต้องอยู่บนสุด (ถูก hoist ขึ้นไปก่อน require)
jest.mock("../db", () => ({ pool: { query: jest.fn() } }));

const request = require("supertest");
const app = require("../app");
const { pool } = require("../db");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {}); // เงียบ log ของ error handler
});

afterEach(() => {
  console.error.mockRestore();
});

test("GET /api/v1/menu คืน 500 INTERNAL_ERROR เมื่อ DB ล้มเหลว", async () => {
  pool.query.mockRejectedValueOnce(new Error("Connection lost"));
  const res = await request(app).get("/api/v1/menu");
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe("INTERNAL_ERROR");
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test("GET /api/v1/menu/:id ส่ง id เป็น parameter ไม่ใช่ต่อ string", async () => {
  pool.query.mockResolvedValueOnce([[{ id: 1, name: "ข้าวผัดกุ้ง", price: "60.00", available: 1 }]]);
  const res = await request(app).get("/api/v1/menu/1");
  expect(res.status).toBe(200);
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("WHERE id = ?"), [1]);
});
