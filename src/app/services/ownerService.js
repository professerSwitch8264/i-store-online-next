// src/app/services/ownerService.js

export const ownerService = {
  /**
   * ดึงรายการผู้ดูแลร้านค้าทั้งหมด พร้อมรองรับการค้นหาและแบ่งหน้า
   */
  async getOwners(params, token) {
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

    if (!storeId) throw new Error('ไม่พบ store_id สำหรับดึงข้อมูลผู้ดูแลร้านค้า');

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/stores/${storeId}/owners?${urlParams.toString()}`, {
      headers,
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ดึงข้อมูลผู้ดูแลร้านค้าไม่สำเร็จ');

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
   * เพิ่มผู้ดูแลร้านค้าคนใหม่
   */
  async addOwner({ store_id, username }, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/stores/${store_id}/owners`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'เพิ่มผู้ดูแลร้านค้าไม่สำเร็จ');
    return json;
  },

  /**
   * ลบสิทธิ์ผู้ดูแลร้านค้า
   */
  async deleteOwner({ store_id, username }, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `/api/stores/${store_id}/owners?username=${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
        headers,
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ลบผู้ดูแลร้านค้าไม่สำเร็จ');
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
