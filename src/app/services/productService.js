// src/services/productService.js

export const productService = {
  async getProducts(params = {}, token) {
    try {
      const searchParams = new URLSearchParams();

      if (params.search) searchParams.append('search', params.search);
      if (params.category_id) searchParams.append('category_id', params.category_id);
      if (params.store_id) searchParams.append('store_id', params.store_id);
      if (params.page) searchParams.append('page', params.page);
      if (params.limit) searchParams.append('limit', params.limit);
      if (params.include_all) searchParams.append('include_all', 'true');

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/products?${searchParams.toString()}`, {
        headers,
        cache: 'no-store',
      });
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

  async updateProductStatus(productId, status, token) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/products', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          product_id: productId,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'อัปเดตสถานะสินค้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('productService.updateProductStatus Error:', error);
      throw error;
    }
  },

  async receiveStock(payload, token) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/inventory/receive', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'บันทึกรับสินค้าเข้าคลังไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('productService.receiveStock Error:', error);
      throw error;
    }
  },

  async deleteProduct(productId, token) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/products?product_id=${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ลบสินค้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('productService.deleteProduct Error:', error);
      throw error;
    }
  },
};