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

export function getProfileUrl(image) {
  if (!image || image.trim() === '') return null;
  const cleanImg = image.trim();
  if (
    cleanImg.startsWith('http://') ||
    cleanImg.startsWith('https://') ||
    cleanImg.startsWith('data:') ||
    cleanImg.startsWith('/')
  ) {
    return cleanImg;
  }
  const base = (
    process.env.NEXT_PUBLIC_PROFILE_IMAGE_URL ||
    'https://zircon.wanthaifoods.com/store/profile'
  ).replace(/\/+$/, '');
  return `${base}/${encodeURI(cleanImg)}`;
}

/**
 * แปลง URL โลโก้ร้านค้าให้สมบูรณ์ (ดึงจาก Zircon Server /store/logo)
 */
export function getStoreLogoUrl(logo) {
  if (!logo || logo.trim() === '') return null;
  const cleanLogo = logo.trim();

  if (
    cleanLogo.startsWith('http://') ||
    cleanLogo.startsWith('https://') ||
    cleanLogo.startsWith('data:') ||
    cleanLogo.startsWith('/')
  ) {
    return cleanLogo;
  }

  const base = (
    process.env.NEXT_PUBLIC_STORE_LOGO_URL ||
    'https://zircon.wanthaifoods.com/store/logo'
  ).replace(/\/+$/, '');

  return `${base}/${encodeURI(cleanLogo)}`;
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

/**
 * จัดรูปแบบวันที่และเวลา (YYYY-MM-DD HH:mm:ss)
 * ป้องกันปัญหา Timezone Offset ซ้ำซ้อน (+7 ซ้ำ) จากฐานข้อมูล SQL Server
 */
export function formatDateTime(dateVal) {
  if (!dateVal) return '-';

  if (typeof dateVal === 'string') {
    if (dateVal.includes('T') || dateVal.endsWith('Z')) {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      const pad = (n) => n.toString().padStart(2, '0');
      const year = d.getUTCFullYear();
      const month = pad(d.getUTCMonth() + 1);
      const day = pad(d.getUTCDate());
      const hours = pad(d.getUTCHours());
      const minutes = pad(d.getUTCMinutes());
      const seconds = pad(d.getUTCSeconds());
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  const pad = (n) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * จัดรูปแบบวันที่และเวลาเป็นภาษาไทย พ.ศ. (เช่น 05 ก.ย. 2569 · 12:42)
 * ป้องกันปัญหา Timezone Offset ซ้ำซ้อน (+7 ซ้ำ) จากฐานข้อมูล SQL Server
 */
export function formatThaiDateTime(dateVal) {
  if (!dateVal) return '-';
  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const pad = (n) => n.toString().padStart(2, '0');

  if (typeof dateVal === 'string' && (dateVal.includes('T') || dateVal.endsWith('Z'))) {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const year = d.getUTCFullYear() + 543;
    const month = thaiMonths[d.getUTCMonth()] || '';
    const day = pad(d.getUTCDate());
    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    return `${day} ${month} ${year} · ${hours}:${minutes}`;
  }

  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  const year = d.getFullYear() + 543;
  const month = thaiMonths[d.getMonth()] || '';
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
}
