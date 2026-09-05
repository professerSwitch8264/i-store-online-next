// src/app/services/orderService.js

/**
 * =========================================================================
 * Service Layer: orderService
 * หน้าที่: จัดการการส่งข้อมูลคำสั่งซื้อไปยัง API คำสั่งซื้อ (/api/orders/place)
 * =========================================================================
 */
export const orderService = {
  /**
   * placeOrder: ส่งคำสั่งซื้อสินค้าและสร้างเอกสารคำขออนุมัติ
   * @param {Object} payload - ข้อมูลคำสั่งซื้อ { store_id, owner, shipping_location, reserve_flag, products }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>} ผลลัพธ์จาก API
   */
  async placeOrder(payload, token) {
    // headers: กำหนดประเภทข้อมูลเป็น JSON พร้อมแนบ Token
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // res: ยิงคำขอ HTTP POST
    const res = await fetch('/api/orders/place', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // json: แปลงผลลัพธ์เป็น JSON Object
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || 'ไม่สามารถสร้างคำสั่งซื้อได้');
    }

    return json;
  },
};
