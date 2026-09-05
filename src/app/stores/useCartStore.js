// src/app/stores/useCartStore.js
import { create } from 'zustand';
import { cartService } from '@/app/services/cartService';

/**
 * =========================================================================
 * Zustand Store: useCartStore
 * หน้าที่: บริหารจัดการ State ตะกร้าสินค้า และรายการสั่งจองล่วงหน้า (Pre-order) ทั้งหมดของระบบ
 * =========================================================================
 */
export const useCartStore = create((set, get) => ({
  // items: อาร์เรย์เก็บรายการสินค้าทั้งหมดในตะกร้าของผู้ใช้ (ทั้งโหมดปกติ reserve_flag='N' และพรีออเดอร์ 'Y')
  items: [],

  // summary: อ็อบเจกต์สรุปยอดรวม { totalItems, totalQuantity, totalPrice }
  summary: { totalItems: 0, totalQuantity: 0, totalPrice: 0 },

  // loading: สถานะกำลังโหลดข้อมูล (true = กำลังทำงาน, false = เสร็จสิ้น)
  loading: false,

  // error: ข้อความ Error กรณีเกิดข้อผิดพลาดในการทำงาน
  error: null,

  /**
   * fetchCart: ดึงข้อมูลรายการสินค้าในตะกร้าจาก Backend API (/api/cart)
   */
  fetchCart: async () => {
    try {
      set({ loading: true, error: null });
      const res = await cartService.getCart();

      if (res.success && res.data) {
        // sortedData: เรียงลำดับรายการสินค้าตาม ID เพื่อให้ลำดับคงที่ไม่สลับตำแหน่งเมื่อแก้ไขจำนวน
        const sortedData = [...res.data].sort((a, b) => String(a.id).localeCompare(String(b.id)));

        set({
          items: sortedData,
          summary: res.summary || {
            totalItems: sortedData.length,
            totalQuantity: sortedData.reduce((sum, item) => sum + item.quantity, 0),
            totalPrice: sortedData.reduce(
              (sum, item) => sum + (item.product?.product_price || 0) * item.quantity,
              0
            ),
          },
          loading: false,
        });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * addItem: ฟังก์ชันเพิ่มสินค้าลงตะกร้า (หรือสั่งจองล่วงหน้า)
   * @param {string} productId - รหัส UUID ของสินค้า
   * @param {number} quantity - จำนวนชิ้นที่ต้องการเพิ่ม
   * @param {string} reserveFlag - 'N' = ตะกร้าปกติ, 'Y' = สั่งจองล่วงหน้า (Pre-order)
   */
  addItem: async (productId, quantity = 1, reserveFlag = 'N') => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          quantity,
          reserve_flag: reserveFlag,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เพิ่มสินค้าไม่สำเร็จ');
      }

      // รีเฟรชข้อมูลตะกร้าใหม่ทันทีเพื่ออัปเดต Badge และ Popover
      await get().fetchCart();
      return data;
    } catch (err) {
      console.error('addItem error:', err);
      throw err;
    }
  },

  /**
   * updateQuantity: ปรับปรุงจำนวนสินค้าในตะกร้า (รองรับการแก้ไขผ่าน Stepper และ Input)
   * @param {string} cartId - รหัส UUID ของแถวในตะกร้า (carts.id)
   * @param {number} quantity - จำนวนสินค้าชิ้นใหม่
   */
  updateQuantity: async (cartId, quantity) => {
    try {
      // 1. Optimistic UI Update: ปรับค่าใน Local State ทันทีเพื่อให้หน้าจอไม่กระตุก
      const currentItems = get().items;
      const updatedItems = currentItems
        .map((item) => (item.id === cartId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0);

      set({
        items: updatedItems,
        summary: {
          totalItems: updatedItems.length,
          totalQuantity: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
          totalPrice: updatedItems.reduce(
            (sum, item) => sum + (item.product?.product_price || 0) * item.quantity,
            0
          ),
        },
      });

      // 2. ส่งคำขอไปยัง Backend API เพื่อบันทึกลงฐานข้อมูลจริง
      const res = await cartService.updateQuantity(cartId, quantity);

      // 3. โหลดข้อมูลล่าสุดจากฐานข้อมูลเพื่อให้มั่นใจว่าสต็อกและลิมิตตรงกัน
      await get().fetchCart();
      return res;
    } catch (err) {
      console.error('updateQuantity error:', err);
      // หากเกิด Error ให้ดึงข้อมูลเดิมกลับคืนมา
      await get().fetchCart();
      throw err;
    }
  },

  /**
   * removeItem: ลบรายการสินค้าออกจากตะกร้าทีละรายการ
   * @param {string} cartId - รหัส UUID ของรายการในตะกร้า
   */
  removeItem: async (cartId) => {
    try {
      // Optimistic UI Update: ลบออกจาก State ก่อนทันที
      const currentItems = get().items;
      const filtered = currentItems.filter((item) => item.id !== cartId);

      set({
        items: filtered,
        summary: {
          totalItems: filtered.length,
          totalQuantity: filtered.reduce((sum, item) => sum + item.quantity, 0),
          totalPrice: filtered.reduce(
            (sum, item) => sum + (item.product?.product_price || 0) * item.quantity,
            0
          ),
        },
      });

      const res = await cartService.removeItem(cartId);
      await get().fetchCart();
      return res;
    } catch (err) {
      console.error('removeItem error:', err);
      await get().fetchCart();
      throw err;
    }
  },

  /**
   * clearCart: ล้างรายการทั้งหมดในตะกร้า (ตาม reserve_flag หรือทั้งหมด)
   * @param {string} reserveFlag - 'N' = เฉพาะตะกร้าปกติ, 'Y' = เฉพาะพรีออเดอร์, หรือไม่ระบุเพื่อล้างทั้งหมด
   */
  clearCart: async (reserveFlag) => {
    try {
      const res = await cartService.clearCart(reserveFlag);
      await get().fetchCart();
      return res;
    } catch (err) {
      console.error('clearCart error:', err);
      throw err;
    }
  },
}));