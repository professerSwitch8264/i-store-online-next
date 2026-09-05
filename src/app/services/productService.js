// src/services/productService.js

export const productService = {
  async getProducts(params = {}) {
    try {
      const searchParams = new URLSearchParams();

      if (params.search) searchParams.append('search', params.search);
      if (params.category_id) searchParams.append('category_id', params.category_id);
      if (params.store_id) searchParams.append('store_id', params.store_id);
      if (params.page) searchParams.append('page', params.page);
      if (params.limit) searchParams.append('limit', params.limit);

      const res = await fetch(`/api/products?${searchParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ดึงข้อมูลสินค้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('productService.getProducts Error:', error);
      throw error;
    }
  },
};