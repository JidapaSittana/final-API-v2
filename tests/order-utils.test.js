// ข้อ 3.1: unit test ของ calcTotal (ไม่ต้องใช้ DB)
const { calcTotal } = require("../utils/order-utils");

describe("calcTotal", () => {
  test("ต่ำกว่า 500 ไม่มีส่วนลด", () => {
    const result = calcTotal([{ price: 60, quantity: 2 }]);
    expect(result).toEqual({ subtotal: 120, discount: 0, total: 120 });
  });

  test("ครบ 500 พอดี ต้องได้ส่วนลด 10% (boundary)", () => {
    const result = calcTotal([{ price: 50, quantity: 10 }]);
    expect(result).toEqual({ subtotal: 500, discount: 50, total: 450 });
  });

  test("price เป็น string จาก DECIMAL ก็คิดถูก", () => {
    const result = calcTotal([
      { price: "60.00", quantity: 2 },
      { price: "25.00", quantity: 2 },
    ]);
    expect(result.total).toBe(170);
  });
});
