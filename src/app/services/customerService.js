// src/app/services/customerService.js

export const customerService = {
  /**
   * ดึงรายการลูกค้าทั้งหมดของร้านค้า พร้อมรองรับการค้นหาและแบ่งหน้า
   */
  async getCustomers(params, token) {
    const urlParams = new URLSearchParams();
    let storeId = '';

    if (typeof params === 'object' && params !== null) {
      storeId = params.store_id || '';
      if (params.search && params.search.trim()) urlParams.append('search', params.search.trim());
      if (params.page) urlParams.append('page', params.page.toString());
      if (params.limit) urlParams.append('limit', params.limit.toString());
    } else {
      storeId = params || '';
    }

    if (!storeId) throw new Error('ไม่พบ store_id สำหรับดึงข้อมูลลูกค้าของร้านค้า');

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/stores/${storeId}/customers?${urlParams.toString()}`, {
      headers,
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ดึงข้อมูลลูกค้าไม่สำเร็จ');

    return {
      data: json.data || [],
      pagination: json.pagination || {
        page: 1,
        limit: json.data?.length || 0,
        total: json.data?.length || 0,
        totalPages: 1,
      },
    };
  },

  /**
   * เพิ่มลูกค้าคนใหม่ของร้านค้าเฉพาะกลุ่ม
   */
  async addCustomer({ store_id, username }, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/stores/${store_id}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'เพิ่มลูกค้าไม่สำเร็จ');
    return json;
  },

  /**
   * ลบสิทธิ์ลูกค้าออกจากร้านค้า
   */
  async deleteCustomer({ store_id, username }, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `/api/stores/${store_id}/customers?username=${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
        headers,
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ลบลูกค้าไม่สำเร็จ');
    return json;
  },

  /**
   * ดึงข้อมูลพนักงานรายบุคคลจากรหัสพนักงาน สำหรับแสดงผลแบบเรียลไทม์ตอนกรอกฟอร์ม
   */
  async getUserByUsername(username, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      headers,
      cache: 'no-store',
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ไม่พบข้อมูลพนักงาน');
    return json.data;
  },
};
