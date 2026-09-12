// src/app/stores/useProfileStore.js
import { create } from 'zustand';

/**
 * =========================================================================
 * Zustand Store: useProfileStore
 * หน้าที่: จัดการรูปภาพโปรไฟล์ของผู้ใช้งาน เพื่อให้แสดงผลตรงกันทั่วทั้งแอปพลิเคชัน
 * (Navbar, Dropdown เมนู, AccountSidebar และหน้า Profile)
 * =========================================================================
 */
export const useProfileStore = create((set) => ({
  profileImage: null,
  loading: false,

  // อัปเดตรูปภาพโปรไฟล์โดยตรง (เช่น เมื่อผู้ใช้อัปโหลดรูปใหม่ในหน้า Profile)
  setProfileImage: (imageName) => {
    set({ profileImage: imageName });
  },

  // ดึงรูปภาพโปรไฟล์ปัจจุบันจาก API
  fetchProfileImage: async (token) => {
    if (!token) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/profile/image', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success && json.data?.image) {
        set({ profileImage: json.data.image, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      console.error('Failed to fetch profile image in useProfileStore:', err);
      set({ loading: false });
    }
  },
}));
