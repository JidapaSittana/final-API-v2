// ฟังก์ชันคำนวณที่ไม่มี I/O (เหมาะกับ unit test)

// กติการ้าน: ยอดรวมตั้งแต่ 500 บาทขึ้นไป ลด 10%
const DISCOUNT_THRESHOLD = 500;
const DISCOUNT_RATE = 0.1;

// items: [{ price, quantity }]  (price อาจเป็น string จาก DECIMAL ของ mysql2)
function calcTotal(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const discount = subtotal >= DISCOUNT_THRESHOLD ? subtotal * DISCOUNT_RATE : 0;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round((subtotal - discount) * 100) / 100,
  };
}

// ลำดับสถานะที่อนุญาต: pending -> preparing -> delivered
const NEXT_STATUS = {
  pending: "preparing",
  preparing: "delivered",
};

function canChangeStatus(current, next) {
  return NEXT_STATUS[current] === next;
}

module.exports = { calcTotal, canChangeStatus, DISCOUNT_THRESHOLD, DISCOUNT_RATE };
