// เทสต์ตัวอย่างที่ให้มา (ผ่านอยู่แล้ว) ใช้ดูรูปแบบการเขียน
const request = require("supertest");
const app = require("../app");
const { pool } = require("../db");
const { resetDb } = require("./helpers");

beforeAll(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/v1/menu", () => {
  test("คืนเมนูทั้งหมด 22 รายการ", async () => {
    const res = await request(app).get("/api/v1/menu");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(22);
  });

  test("available=true คืนเฉพาะเมนูที่พร้อมขาย", async () => {
    const res = await request(app).get("/api/v1/menu?available=true");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
  });
});

describe("GET /api/v1/menu/:id", () => {
  test("คืนเมนู id 1 พร้อมราคา", async () => {
    const res = await request(app).get("/api/v1/menu/1");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("ข้าวผัดกุ้ง");
    expect(Number(res.body.data.price)).toBe(60);
  });

  test("ไม่พบเมนูคืน 404", async () => {
    const res = await request(app).get("/api/v1/menu/9999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MENU_NOT_FOUND");
  });
});

// ข้อ 3.2: id ที่ไม่ใช่ตัวเลข / ความพยายามทำ SQL injection
describe("GET /api/v1/menu/:id (validation)", () => {
  test("id = abc คืน 400", async () => {
    const res = await request(app).get("/api/v1/menu/abc");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("id = '1 OR 1=1' คืน 400 ไม่หลุดข้อมูล", async () => {
    const res = await request(app).get("/api/v1/menu/" + encodeURIComponent("1 OR 1=1"));
    expect(res.status).toBe(400);
  });
});
