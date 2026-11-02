# เฉลยข้อสอบซ้อม — อ่านหลังทำเสร็จหรือหมดเวลาแล้วเท่านั้น

โค้ดเฉลยฉบับเต็มอยู่ในโฟลเดอร์นี้ รัน `npm test` แล้วต้องผ่าน 21 เทสต์
ถ้าเอาเทสต์ชุดนี้ไปรันกับโค้ดก่อนแก้ จะล้ม 11 เทสต์ (เป็นการยืนยันว่าเทสต์จับบั๊กได้จริง)

## บั๊กที่ซ่อนไว้มีทั้งหมด 8 จุด

| # | ไฟล์ | บั๊ก | วิธีแก้ |
|---|---|---|---|
| 1 | `routes/orders.js` POST | ไม่ตรวจ `quantity` และ `menu_item_id` | ตรวจด้วย `Number.isInteger` และช่วง 1–20 ก่อนแตะ DB |
| 2 | `routes/orders.js` POST | ไม่เช็กว่าเมนูมีอยู่จริงและยังไม่หมด | `SELECT ... WHERE id IN (?)` แล้วคืน 404/409 |
| 3 | `routes/orders.js` POST | `calcTotal(items)` ใช้ `price` ที่ client ส่งมา | เอาราคาจากผล SELECT ใน DB มาคิดแทน |
| 4 | `routes/orders.js` POST | INSERT order แล้วค่อย INSERT items แยกกัน ถ้าพังกลางทางจะเหลือ order ที่ไม่มีรายการ | `pool.getConnection()` → `beginTransaction` → `commit` / `rollback` → `release` ใน `finally` |
| 5 | `middleware/auth.js` | `requireRole` คืน **401** ทั้งที่ควรเป็น **403** | เปลี่ยนเป็น `res.status(403)` |
| 6 | `routes/orders.js` PATCH | ไม่ตรวจ status และไม่ได้เรียก `canChangeStatus` (import มาแต่ไม่ได้ใช้) | ตรวจกับรายการ status ที่รู้จัก → 400 และเปลี่ยนข้ามลำดับไม่ได้ → 409 |
| 7 | `utils/order-utils.js` | ใช้ `subtotal > 500` แต่กติกาบอกว่า "ตั้งแต่ 500" | เปลี่ยนเป็น `>=` (บั๊กแบบนี้เรียกว่า boundary / off-by-one) |
| 8 | `routes/menu.js` GET /:id | เอา `${req.params.id}` ไปต่อเป็น SQL ตรง ๆ → SQL injection และ `abc` ทำให้ได้ 500 | ตรวจ id ก่อน แล้วใช้ placeholder `WHERE id = ?` |

(ข้อ 4 ไม่มีเทสต์ที่บังคับให้ fail ได้ง่าย ๆ เพราะเมื่อตรวจเมนูก่อน INSERT แล้วก็จะไม่เหลือ order ที่ไม่มีรายการ แต่ถ้าในวันสอบโจทย์บอกว่า "ต้องสำเร็จพร้อมกันหรือไม่บันทึกเลย" ก็คือให้ใช้ transaction)

## ตัวอย่างคำตอบส่วนอธิบาย

- **ทำไมต้องใช้ transaction:** ถ้า INSERT `orders` สำเร็จแต่ INSERT `order_items` ล้มกลางทาง (เช่น FK ผิด หรือ DB หลุด) จะเหลือ order ที่ไม่มีรายการ หรือมีแค่บางรายการค้างอยู่ใน DB ข้อมูลจะไม่สอดคล้องกัน transaction ทำให้ทั้งชุดเป็นหน่วยเดียว (atomic) ถ้า error ก็ rollback ทั้งหมด
- **401 กับ 403:** 401 Unauthorized คือระบบยังไม่รู้ว่าเป็นใคร (ไม่มี token หรือ token ไม่ถูกต้อง) ส่วน 403 Forbidden คือรู้แล้วว่าเป็นใคร แต่ role นั้นไม่มีสิทธิ์ทำ action นี้
- **SQL injection:** ค่าจาก URL ถูกเอาไปต่อเป็นส่วนหนึ่งของคำสั่ง SQL ผู้ใช้จึงแทรก SQL เองได้ เช่น `1 OR 1=1` ส่วน placeholder `?` จะให้ driver ส่งค่าแยกจากคำสั่ง ค่าที่ส่งมาจึงเป็นได้แค่ข้อมูล รันเป็นคำสั่งไม่ได้

## จุดที่มักพลาด

- `price` ได้มาเป็น `"60.00"` (string) → ใน `calcTotal` ต้องมี `Number(item.price)` อยู่แล้ว ส่วนในเทสต์ต้องเทียบด้วย `Number(...)`
- `available` ได้มาเป็น `1`/`0` → เขียน `if (!menu.available)` ได้ แต่ห้ามเขียน `=== false`
- `COUNT(*)` ใน mysql2 ได้มาเป็น number เทียบด้วย `toBe` ได้เลย
- ถ้าใช้ `pool.getConnection()` แล้วลืม `conn.release()` เทสต์จะค้างหรือ pool จะหมด
- ไฟล์ที่ `jest.mock("../db")` **ห้าม** เรียก `resetDb()` หรือ `pool.end()` เพราะ pool ในไฟล์นั้นเป็นของปลอม
- ต้องรันเทสต์ด้วย `--runInBand` (ตั้งไว้ใน `npm test` แล้ว) เพราะทุกไฟล์ reset DB ตัวเดียวกัน
- `toEqual` ใช้กับ object ส่วน `toBe` ใช้กับค่า primitive
