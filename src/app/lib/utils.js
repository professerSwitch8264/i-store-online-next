// src/lib/utils.js

/**
 * แปลง URL รูปภาพสินค้าให้สมบูรณ์
 * รองรับทั้ง Full URL, Path ในเครื่อง หรือดึงจาก Zircon Server
 */
export function getThumbnailUrl(thumbnail) {
  if (!thumbnail || thumbnail.trim() === '') return null;
  const cleanThumb = thumbnail.trim();

  if (
    cleanThumb.startsWith('http://') ||
    cleanThumb.startsWith('https://') ||
    cleanThumb.startsWith('data:') ||
    cleanThumb.startsWith('/')
  ) {
    return cleanThumb;
  }

  const base = (
    process.env.NEXT_PUBLIC_IMAGE_URL ||
    'https://zircon.wanthaifoods.com/store/thumbnail'
  ).replace(/\/+$/, '');

  return `${base}/${encodeURI(cleanThumb)}`;
}

/**
 * จัดรูปแบบตัวเลขราคาให้เป็นสกุลเงินบาท (เช่น 1,250.00)
 */
export function formatPrice(amount) {
  const value = amount ?? 0;
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}