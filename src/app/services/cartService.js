// src/app/services/cartService.js

/**
 * =========================================================================
 * Service Layer: cartService
 * หน้าที่: จัดการการเชื่อมต่อไปยัง API ตะกร้าสินค้า (/api/cart)
 * =========================================================================
 */
export const cartService = {
  /**
   * getCart: ดึงรายการสินค้าทั้งหมดในตะกร้าของผู้ใช้
   * @param {string} reserveFlag - 'N' = สินค้าปกติ, 'Y' = สินค้าสั่งล่วงหน้า (ถ้าไม่ส่งจะดึงทั้งหมด)
   * @returns {Promise<Object>} ข้อมูลสินค้าและสรุปยอดรวม
   */
  async getCart(reserveFlag) {
    try {
      const url = reserveFlag ? `/api/cart?reserve_flag=${reserveFlag}` : '/api/cart';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ดึงข้อมูลตะกร้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('cartService.getCart Error:', error);
      throw error;
    }
  },

  /**
   * updateQuantity: ปรับปรุงจำนวนสินค้าของรายการหนึ่งในตะกร้า
   * @param {string} cartId - รหัส UUID ของรายการในตะกร้า (carts.id)
   * @param {number} quantity - จำนวนสินค้าชิ้นใหม่
   * @returns {Promise<Object>}
   */
  async updateQuantity(cartId, quantity) {
    try {
      const res = await fetch(`/api/cart/${cartId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'อัปเดตจำนวนสินค้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('cartService.updateQuantity Error:', error);
      throw error;
    }
  },

  /**
   * removeItem: ลบรายการสินค้าชิ้นนั้นออกจากตะกร้า
   * @param {string} cartId - รหัส UUID ของรายการในตะกร้า
   * @returns {Promise<Object>}
   */
  async removeItem(cartId) {
    try {
      const res = await fetch(`/api/cart/${cartId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ลบรายการสินค้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('cartService.removeItem Error:', error);
      throw error;
    }
  },

  /**
   * clearCart: ล้างรายการทั้งหมดในตะกร้า
   * @param {string} reserveFlag - 'N' หรือ 'Y' (หากไม่ระบุจะล้างทั้งหมด)
   * @returns {Promise<Object>}
   */
  async clearCart(reserveFlag) {
    try {
      const url = reserveFlag ? `/api/cart?reserve_flag=${reserveFlag}` : '/api/cart';
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ล้างตะกร้าไม่สำเร็จ');
      }

      return data;
    } catch (error) {
      console.error('cartService.clearCart Error:', error);
      throw error;
    }
  },
};