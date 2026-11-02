# ข้อสอบซ้อม ส่วนที่ 2 (ปฏิบัติ) — ระบบสั่งอาหารออนไลน์

> ชุดนี้ทำขึ้นเพื่อซ้อมเท่านั้น **ไม่ใช่ข้อสอบจริง** โจทย์วันสอบอาจต่างไปทั้งหมด
> จับเวลา **60 นาที** · คะแนนเต็ม 15 · เปิดเอกสาร wk05–wk12 ได้ · อย่าเปิดเฉลยก่อนหมดเวลา

## เตรียมเครื่อง (ใช้ฐานข้อมูลจากชุด final-exam-setup ได้เลย)

```
cp .env.example .env
docker compose up -d        # ถ้าเปิด container ของ final-exam-setup อยู่แล้ว ข้ามขั้นนี้ได้
npm install
npm run seed
npm test                    # เทสต์ตัวอย่างใน tests/menu.test.js ควรผ่าน 4 ข้อ
```

ทุกไฟล์เทสต์ควรเรียก `resetDb()` จาก `tests/helpers.js` ใน `beforeEach` หรือ `beforeAll`
และใช้ `tokenFor("customer")` / `tokenFor("staff")` สร้าง token

## โครงสร้างโปรเจกต์

| ไฟล์ | หน้าที่ |
|---|---|
| `app.js` / `server.js` | แยก app ออกจาก listen (Supertest ใช้ `app.js`) |
| `routes/menu.js` | `GET /api/v1/menu`, `GET /api/v1/menu/:id`, `PATCH /api/v1/menu/:id/availability` |
| `routes/orders.js` | `POST /api/v1/orders`, `GET /api/v1/orders/:id`, `PATCH /api/v1/orders/:id/status` |
| `middleware/auth.js` | `authenticate`, `requireRole` |
| `utils/order-utils.js` | `calcTotal`, `canChangeStatus` |

รูปแบบ error ของระบบ: `{ "error": { "code": "...", "message": "..." } }`

---

## ข้อ 1 — แก้ `POST /api/v1/orders` (6 คะแนน)

ตอนนี้ endpoint นี้มีปัญหาหลายจุด ให้แก้ใน `routes/orders.js` ให้ตรงตามข้อกำหนดนี้

1. **(1 คะแนน)** ตรวจข้อมูลก่อนบันทึก: `customer_name` ต้องเป็น string ที่ไม่ว่าง ส่วน `menu_item_id` ของทุก item ต้องเป็นจำนวนเต็มบวก และ `quantity` ต้องเป็นจำนวนเต็ม 1–20 ถ้าไม่ผ่าน คืน **400** `VALIDATION_ERROR`
2. **(1 คะแนน)** ถ้ามี item ที่ไม่มีเมนูนี้ในระบบ คืน **404** `MENU_NOT_FOUND` และถ้ามี item ที่เมนูหมด (`available = false`) คืน **409** `MENU_UNAVAILABLE`
3. **(1 คะแนน)** ยอดเงิน (`subtotal`, `discount`, `total`) ต้องคิดจากราคาใน DB **ห้ามใช้** `price` ที่ client ส่งมา
4. **(1 คะแนน)** การบันทึก `orders` และ `order_items` ต้องสำเร็จพร้อมกันทั้งหมด หรือไม่บันทึกเลย
5. **(2 คะแนน)** เขียนเทสต์ไว้ใน `tests/orders.create.test.js` อย่างน้อย 4 กรณี ต้องมีกรณีต่อไปนี้
   - สร้างสำเร็จ (201) โดย client ส่ง `price` ปลอมมา แล้วตรวจว่า `total` ยังคิดจากราคาจริง
   - ส่ง `quantity: 0` แล้วได้ 400
   - ในรายการมีเมนูที่หมด (id 9) ปนอยู่ แล้วได้ 409 **และ** จำนวนแถวในตาราง `orders` ต้องไม่เพิ่มขึ้น

## ข้อ 2 — สิทธิ์และสถานะ order (4 คะแนน)

1. **(1 คะแนน)** ตอนนี้ customer ที่เรียก `PATCH /api/v1/orders/:id/status` ได้ status ที่ไม่ถูกต้อง ให้หาสาเหตุและแก้ให้ได้ **403** `FORBIDDEN` (ส่วนกรณีไม่มี token ต้องได้ 401 เหมือนเดิม)
2. **(1 คะแนน)** `status` ที่ส่งมาต้องเป็น `pending`, `preparing` หรือ `delivered` เท่านั้น ถ้าไม่ใช่ คืน **400** `VALIDATION_ERROR`
3. **(1 คะแนน)** เปลี่ยนสถานะได้ตามลำดับ `pending → preparing → delivered` เท่านั้น (มีฟังก์ชัน `canChangeStatus` ให้แล้ว) ถ้าข้ามลำดับหรือย้อนกลับ คืน **409** `INVALID_STATUS_TRANSITION` และค่าใน DB ต้องไม่เปลี่ยน
4. **(1 คะแนน)** เขียนเทสต์ไว้ใน `tests/orders.status.test.js` ให้ครอบคลุม 401, 403, 200 (และตรวจค่าใน DB ว่าเปลี่ยนจริง) และ 409

## ข้อ 3 — เทสต์หาบั๊กและ mock (5 คะแนน)

1. **(2 คะแนน)** เขียน unit test ของ `calcTotal` ไว้ใน `tests/order-utils.test.js` โดยไม่ต้องใช้ DB กติกาของร้านคือ *"ยอดรวม**ตั้งแต่** 500 บาทขึ้นไป ลด 10%"* ให้เขียนเทสต์ที่จับบั๊กใน `calcTotal` ให้ได้ แล้วแก้บั๊กนั้น และต้องมีกรณีที่ `price` เป็น string แบบ `"60.00"` อย่างน้อย 1 กรณี
2. **(1.5 คะแนน)** ลองเรียก `GET /api/v1/menu/abc` ดูว่าได้ผลอะไร ให้แก้ให้ id ที่ไม่ใช่จำนวนเต็มบวกได้ **400** `VALIDATION_ERROR` และแก้ปัญหาด้านความปลอดภัยของ query นี้ด้วย แล้วเพิ่มเทสต์ต่อท้ายใน `tests/menu.test.js`
3. **(1.5 คะแนน)** สร้าง `tests/menu.mock.test.js` ที่ mock `../db` แล้วทดสอบว่าเมื่อ `pool.query` reject แล้ว `GET /api/v1/menu` คืน **500** `INTERNAL_ERROR`
   - คำใบ้: `db.js` export เป็น `{ pool }` ให้ใช้ `jest.mock("../db", () => ({ pool: { query: jest.fn() } }))`

## ส่วนเขียนอธิบาย (ไม่มีคะแนน แต่ควรฝึก)

ให้ตอบในไฟล์ `ANSWERS.md` ด้วยคำพูดของตัวเอง ข้อละ 2–3 บรรทัด
- ข้อ 1.4: ถ้าไม่ใช้ transaction จะเกิดอะไรกับข้อมูลได้บ้าง
- ข้อ 2.1: 401 กับ 403 ต่างกันอย่างไร
- ข้อ 3.2: query เดิมอันตรายอย่างไร และแก้แล้วทำไมถึงปลอดภัย

## การส่ง (ฝึกให้ตรงกับข้อกำหนดจริง)

ให้ zip โฟลเดอร์โปรเจกต์ **โดยไม่ใส่** `.env` และ `node_modules`
