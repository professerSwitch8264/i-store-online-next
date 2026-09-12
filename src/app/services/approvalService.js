// src/app/services/approvalService.js

/**
 * =========================================================================
 * Service Layer: approvalService
 * =========================================================================
 * หน้าที่: จัดการการเชื่อมต่อ HTTP Request ไปยัง API รายการรออนุมัติ (/api/approvals)
 * และการเปลี่ยนสถานะคำสั่งซื้อ (/api/orders/status)
 * =========================================================================
 */

export const approvalService = {
  /**
   * ดึงรายการคำขออนุมัติที่รอการพิจารณา (GET /api/approvals)
   * @param {Object} params - { page, limit, search, sort_field, sort_order }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>} { success: true, data: [...], pagination: {...} }
   */
  async getApprovals(params = {}, token) {
    const urlParams = new URLSearchParams();
    if (params.page) urlParams.append('page', params.page.toString());
    if (params.limit) urlParams.append('limit', params.limit.toString());
    if (params.search) urlParams.append('search', params.search);
    if (params.order_no) urlParams.append('order_no', params.order_no);
    if (params.date_from) urlParams.append('date_from', params.date_from);
    if (params.date_to) urlParams.append('date_to', params.date_to);
    if (params.buyer) urlParams.append('buyer', params.buyer);
    if (params.reserve_flag && params.reserve_flag !== 'ALL') urlParams.append('reserve_flag', params.reserve_flag);
    if (params.sort_field) urlParams.append('sort_field', params.sort_field);
    if (params.sort_order) urlParams.append('sort_order', params.sort_order);

    const queryString = urlParams.toString();
    const url = `/api/approvals${queryString ? `?${queryString}` : ''}`;

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers, cache: 'no-store' });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `Failed to fetch approvals: ${res.statusText}`);
    }
    return json;
  },

  /**
   * อัปเดตสถานะคำสั่งซื้อ (POST /api/orders/status)
   * @param {Object} payload - { order_no, order_id, action: 'APPROVE'|'REJECT'|'CANCEL', remark }
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<Object>} { success: true, message: string, data: {...} }
   */
  async updateOrderStatus(payload, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/orders/status', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error || `Failed to update order status: ${res.statusText}`);
    }
    return json;
  },

  /**
   * อนุมัติคำขอสั่งซื้อ (Approve)
   * @param {string} orderNo - หมายเลขคำสั่งซื้อ
   * @param {string} token - Security Token
   */
  async approveOrder(orderNo, token) {
    return this.updateOrderStatus({ order_no: orderNo, action: 'APPROVE' }, token);
  },

  /**
   * ปฏิเสธคำขอสั่งซื้อ (Reject)
   * @param {string} orderNo - หมายเลขคำสั่งซื้อ
   * @param {string} remark - เหตุผลการปฏิเสธ
   * @param {string} token - Security Token
   */
  async rejectOrder(orderNo, remark, token) {
    return this.updateOrderStatus(
      { order_no: orderNo, action: 'REJECT', remark: remark || 'ปฏิเสธโดยผู้อนุมัติ' },
      token
    );
  },

  /**
   * ดึงจำนวนรายการที่รออนุมัติ (GET /api/approvals/count) สำหรับแสดง Badge บน Sidebar / Navbar
   * @param {string} token - Security Token (Optional)
   * @returns {Promise<number>}
   */
  async getPendingCount(token) {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch('/api/approvals/count', {
        headers,
        cache: 'no-store',
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        return 0;
      }
      if (typeof json.count === 'number') {
        return json.count;
      }
      if (typeof json.data?.pendingCount === 'number') {
        return json.data.pendingCount;
      }
      if (typeof json.data?.count === 'number') {
        return json.data.count;
      }
      return 0;
    } catch {
      return 0;
    }
  },
};
