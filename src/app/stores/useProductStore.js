// src/stores/useProductStore.js
import { create } from 'zustand';
import { productService } from '@/app/services/productService';

/**
 * Store: useProductStore (Zustand Store จัดการ State ค้นหาและรายการสินค้า)
 */
export const useProductStore = create((set, get) => ({
  // products: อาร์เรย์เก็บรายการสินค้าในหน้าปัจจุบันที่ดึงมาจาก API
  products: [],

  // pagination: อ็อบเจกต์เก็บข้อมูลแบ่งหน้า
  pagination: {
    page: 1,       // หน้าปัจจุบัน
    limit: 12,     // จำนวนสินค้าต่อ 1 หน้า (12 รายการ)
    total: 0,      // จำนวนสินค้าทั้งหมดที่ตรงตามเงื่อนไข
    totalPages: 1, // จำนวนหน้าทั้งหมด
  },

  // loading: สถานะกำลังโหลดข้อมูลจากเซิร์ฟเวอร์หรือไม่
  loading: false,

  // error: ข้อความ Error กรณีเรียก API ล้มเหลว
  error: null,

  // searchInput: ข้อความตัวอักษรที่พิมพ์ค้างไว้ในช่องค้นหา
  searchInput: '',

  // keywords: อาร์เรย์เก็บแท็กคำค้นหาที่ยืนยันแล้ว เช่น ['ปากกา', 'กระดาษ']
  keywords: [],

  // setSearchInput: ฟังก์ชันอัปเดตข้อความในช่องค้นหา
  setSearchInput: (text) => set({ searchInput: text }),

  // 🏷️ addKeyword: เพิ่มคำค้นหาใหม่เข้าแท็กคำค้นหา -> รีเซ็ตกลับไปหน้า 1 เสมอ
  addKeyword: (newKeyword) => {
    const clean = newKeyword.trim();
    if (!clean) return;

    const { keywords } = get();
    // ถ้ามีคำนี้อยู่ในรายการแท็กแล้ว ให้เคลียร์ช่องค้นหาและไม่ต้องทำอะไรซ้ำ
    if (keywords.some((k) => k.toLowerCase() === clean.toLowerCase())) {
      set({ searchInput: '' });
      return;
    }

    // เพิ่มคำใหม่เข้าแท็ก และรีเซ็ต page กลับไปที่หน้า 1
    set({
      searchInput: '',
      keywords: [...keywords, clean],
      pagination: { ...get().pagination, page: 1 },
    });
    get().fetchProducts();
  },

  // removeKeyword: ลบแท็กคำค้นหาออกทีละคำ
  removeKeyword: (keywordToRemove) => {
    const { keywords, pagination } = get();
    set({
      keywords: keywords.filter((k) => k.toLowerCase() !== keywordToRemove.toLowerCase()),
      pagination: { ...pagination, page: 1 },
    });
    get().fetchProducts();
  },

  // resetFilter: ล้างแท็กคำค้นหาทั้งหมด และกลับไปหน้า 1
  resetFilter: () => {
    set({
      searchInput: '',
      keywords: [],
      pagination: { ...get().pagination, page: 1 },
    });
    get().fetchProducts();
  },

  submitSearch: () => {
    const { searchInput } = get();
    if (searchInput.trim()) {
      get().addKeyword(searchInput.trim());
    } else {
      get().fetchProducts();
    }
  },

  // 📄 ฟังก์ชันเปลี่ยนหน้า (กดเลขหน้า / ปุ่มถัดไป)
  setPage: async (newPage) => {
    const { pagination, loading } = get();
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page || loading) {
      return;
    }

    set({
      pagination: { ...pagination, page: newPage },
    });

    // โหลดข้อมูลสินค้าของหน้าใหม่
    await get().fetchProducts();

    // เลื่อนหน้าจอกลับขึ้นด้านบนแบบนุ่มนวล
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  // 🚀 โหลดสินค้าตามหน้าปัจจุบัน
  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const { keywords, pagination } = get();
      const res = await productService.getProducts({
        search: keywords.join(','),
        page: pagination.page,
        limit: pagination.limit, // ส่ง limit=12 ไปที่ Backend
      });

      if (res.success && res.data) {
        set({
          products: res.data,
          pagination: res.pagination,
          loading: false,
        });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));