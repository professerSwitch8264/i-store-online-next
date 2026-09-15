// src/app/services/unitService.js

export const unitService = {
  /**
   * ดึงรายการหน่วยนับสินค้าทั้งหมด
   */
  async getUnits(token) {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/units', {
        headers,
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ดึงข้อมูลหน่วยสินค้าไม่สำเร็จ');
      }

      return data.data || [];
    } catch (error) {
      console.error('unitService.getUnits Error:', error);
      throw error;
    }
  },
};
