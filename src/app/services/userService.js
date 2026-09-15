// src/app/services/userService.js

/**
 * userService
 * จัดการการดึงข้อมูลพนักงานและการค้นหาพนักงานในระบบ
 */
export const userService = {
  /**
   * ดึงรายชื่อพนักงานทั้งหมดที่อยู่ในแผนกเดียวกับเรา (หรือตามแผนกที่ระบุ)
   * @param {Object} options - { department, search, token }
   * @returns {Promise<{ users: Array, departmentInfo: Object }>}
   */
  async getDepartmentUsers({ department = '', search = '', token = '' } = {}) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams();
    if (department) params.set('department', department);
    if (search) params.set('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/users${qs}`, {
      headers,
      cache: 'no-store',
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ไม่สามารถดึงข้อมูลพนักงานในแผนกได้');
    return {
      users: json.data || [],
      departmentInfo: json.departmentInfo || {},
    };
  },

  /**
   * ดึงข้อมูลพนักงานรายบุคคลจากรหัสพนักงาน
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
