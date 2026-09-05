// src/app/services/shippingLocationService.js

/**
 * =========================================================================
 * Service Layer: shippingLocationService
 * หน้าที่: จัดการการเชื่อมต่อไปยัง API สถานที่จัดส่งสินค้า (/api/shipping-locations)
 * =========================================================================
 */
export const shippingLocationService = {
  /**
   * getShippingLocations: ดึงรายการสถานที่จัดส่งทั้งหมดที่เปิดใช้งาน
   * @param {string} token - Security Token ของผู้ใช้ (Optional)
   * @returns {Promise<Object>} { success: true, data: [...], total: number }
   */
  async getShippingLocations(token) {
    // headers: กำหนด Header สำหรับ Request (แนบ Bearer Token หากมี)
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // res: ส่งคำขอ HTTP GET ไปยัง Backend API
    const res = await fetch('/api/shipping-locations', {
      headers,
      cache: 'no-store',
    });

    // json: แปลงข้อมูลผลลัพธ์เป็น JSON
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `ไม่สามารถดึงข้อมูลสถานที่จัดส่งได้: ${res.statusText}`);
    }

    return json;
  },
};
