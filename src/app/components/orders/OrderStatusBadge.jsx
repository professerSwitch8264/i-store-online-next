'use client';

/**
 * =========================================================================
 * Component: OrderStatusBadge (ป้ายสถานะคำสั่งซื้อ)
 * Location: src/app/components/orders/OrderStatusBadge.jsx
 * =========================================================================
 * กำหนดสี ข้อความ และมิติของป้ายสถานะคำสั่งซื้อให้เป็นมาตรฐานเดียวกันทั้งระบบ:
 * - W / P : กำลังรออนุมัติ (สีน้ำเงิน #1976d2)
 * - X     : กำลังเตรียมสินค้า (สีส้ม #ed6c02)
 * - S     : รอยืนยันการรับสินค้า (สีฟ้า #0288d1)
 * - D     : ดำเนินการเสร็จสิ้น (สีเขียว #2e7d32)
 * - R     : ถูกปฏิเสธ (สีแดง #d32f2f)
 * - C     : ยกเลิกรายการ (สีเทา #757575)
 * =========================================================================
 */

export const ORDER_STATUS_CONFIG = {
  W: { label: 'กำลังรออนุมัติ', bg: 'bg-[#1976d2]', text: 'text-white' },
  P: { label: 'กำลังรออนุมัติ', bg: 'bg-[#1976d2]', text: 'text-white' },
  X: { label: 'กำลังเตรียมสินค้า', bg: 'bg-[#ed6c02]', text: 'text-white' },
  S: { label: 'รอยืนยันการรับสินค้า', bg: 'bg-[#0288d1]', text: 'text-white' },
  D: { label: 'ดำเนินการเสร็จสิ้น', bg: 'bg-[#2e7d32]', text: 'text-white' },
  R: { label: 'ถูกปฏิเสธ', bg: 'bg-[#d32f2f]', text: 'text-white' },
  C: { label: 'ยกเลิกรายการ', bg: 'bg-[#757575]', text: 'text-white' },
};

/**
 * ดึงข้อมูล Config สถานะคำสั่งซื้อ (Label, BG color, Text color)
 */
export function getOrderStatusConfig(status) {
  const s = (status || 'W').toUpperCase();
  return (
    ORDER_STATUS_CONFIG[s] || {
      label: status || '-',
      bg: 'bg-stone-500',
      text: 'text-white',
    }
  );
}

/**
 * OrderStatusBadge Component
 * @param {string} status - รหัสสถานะ (W, P, X, S, D, R, C)
 * @param {object} [order] - ออบเจกต์คำสั่งซื้อ (เผื่อส่ง context เพิ่มเติม)
 * @param {string} [className] - คลาสเพิ่มเติม
 * @param {'sm'|'md'|'lg'} [size] - ขนาดของ Badge (ค่าเริ่มต้น 'md' ขนาด 130px)
 */
export default function OrderStatusBadge({
  status,
  order = null,
  className = '',
  size = 'md',
}) {
  const config = getOrderStatusConfig(status);

  // การกำหนดขนาดความกว้างและ padding
  const sizeClasses = {
    sm: 'w-[110px] py-0.5 text-[11px]',
    md: 'w-[8.125rem] py-1 text-xs', // 130px (Standard across app)
    lg: 'w-[145px] py-1.5 text-xs sm:text-sm font-medium',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-normal ${config.text} ${config.bg} shadow-2xs whitespace-nowrap select-none ${currentSizeClass} ${className}`}
    >
      {config.label}
    </span>
  );
}

// Named alias เพื่อความสะดวกในการ import
export { OrderStatusBadge };
