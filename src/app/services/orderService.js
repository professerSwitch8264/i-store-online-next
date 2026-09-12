// src/app/services/orderService.js

/**
 * =========================================================================
 * Service Layer: orderService
 * =========================================================================
 * หน้าที่: จัดการการเชื่อมต่อ HTTP Request ไปยัง API คำสั่งซื้อ (/api/orders)
 * รองรับการดึงประวัติ, สร้างคำสั่งซื้อใหม่, แก้ไขจำนวนสินค้า, และยกเลิกคำสั่งซื้อ
 * =========================================================================
 */

export const orderService = {
  /**
   * getOrders: ดึงรายการคำสั่งซื้อแบบแบ่งหน้าและกรองตามสถานะ
   * @param {Object} params - { page, limit, status, search, store_id, reserve_flag, sort_field, sort_order, owner }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>}
   */
  async getOrders(params = {}, token) {
    const urlParams = new URLSearchParams();
    if (params.owner) urlParams.append('owner', params.owner);
    if (params.status && params.status !== 'ALL') urlParams.append('status', params.status);
    if (params.search) urlParams.append('search', params.search);
    if (params.store_id) urlParams.append('store_id', params.store_id);
    if (params.is_store_view) urlParams.append('is_store_view', 'true');
    if (params.reserve_flag && params.reserve_flag !== 'ALL') urlParams.append('reserve_flag', params.reserve_flag);
    if (params.order_no) urlParams.append('order_no', params.order_no);
    if (params.date_from) urlParams.append('date_from', params.date_from);
    if (params.date_to) urlParams.append('date_to', params.date_to);
    if (params.buyer) urlParams.append('buyer', params.buyer);
    if (params.page) urlParams.append('page', params.page.toString());
    if (params.limit) urlParams.append('limit', params.limit.toString());
    if (params.sort_field) urlParams.append('sort_field', params.sort_field);
    if (params.sort_order) urlParams.append('sort_order', params.sort_order);

    const queryString = urlParams.toString();
    const url = `/api/orders${queryString ? `?${queryString}` : ''}`;

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers, cache: 'no-store' });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `Failed to fetch orders: ${res.statusText}`);
    }
    return json;
  },

  /**
   * getOrderById: ดึงรายละเอียดคำสั่งซื้อรายฉบับ (GET /api/orders/[id])
   * @param {string} orderId - รหัสคำสั่งซื้อ order_id หรือ order_no
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>}
   */
  async getOrderById(orderId, token) {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      headers,
      cache: 'no-store',
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to fetch order details');
    }
    return json;
  },

  /**
   * placeOrder: ส่งคำสั่งซื้อสินค้าและสร้างเอกสารคำขออนุมัติ (POST /api/orders/place)
   * @param {Object} payload - ข้อมูลคำสั่งซื้อ { store_id, owner, shipping_location, reserve_flag, products }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>} ผลลัพธ์จาก API
   */
  async placeOrder(payload, token) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/orders/place', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || 'ไม่สามารถสร้างคำสั่งซื้อได้');
    }

    return json;
  },


  /**
   * cancelOrder: ยกเลิกคำสั่งซื้อ (POST /api/orders/cancel) - เฉพาะสถานะ 'W' / 'P'
   * @param {Object} payload - { order_no, order_id, remark }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>}
   */
  async cancelOrder(payload, token) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/orders/cancel', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to cancel order');
    }
    return json;
  },

  /**
   * prepareOrder: ยืนยันการจัดเตรียมสินค้าของร้านค้า (POST /api/orders/prepare)
   * @param {Object} payload - { order_id, order_no, prepared_items }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>}
   */
  async prepareOrder(payload, token) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/orders/prepare', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'ไม่สามารถบันทึกการจัดเตรียมสินค้าได้');
    }
    return json;
  },
};
