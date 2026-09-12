// src/app/services/categoryService.js

export const categoryService = {
  async getCategories(params, token) {
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
    urlParams.append('store_id', storeId);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/categories?${urlParams.toString()}`, {
      headers,
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ดึงข้อมูลหมวดหมู่สินค้าไม่สำเร็จ');
    return {
      data: json.data || [],
      pagination: json.pagination || { page: 1, limit: json.data?.length || 0, total: json.data?.length || 0, totalPages: 1 },
    };
  },

  async createCategory(data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/categories', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'เพิ่มหมวดหมู่สินค้าไม่สำเร็จ');
    return json.data;
  },

  async updateCategory(data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/categories', {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'แก้ไขหมวดหมู่สินค้าไม่สำเร็จ');
    return json.data;
  },

  async deleteCategory(categoryId, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/categories?category_id=${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'ลบหมวดหมู่สินค้าไม่สำเร็จ');
    return json;
  },
};
