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

  // 🔎 Search Detail States:
  isDetailOpen: false,       // สถานะเปิด/ปิดแผงค้นหาละเอียด
  selectedStore: '',         // store_id ที่ถูกกรองใช้งาน
  selectedCategory: '',      // category_id ที่ถูกกรองใช้งาน
  stores: [],                // รายการร้านค้าสำหรับดรอปดาวน์
  categories: [],            // รายการหมวดหมู่สำหรับดรอปดาวน์
  loadingFilters: false,     // สถานะโหลดตัวเลือกร้านค้าและหมวดหมู่

  // setSearchInput: ฟังก์ชันอัปเดตข้อความในช่องค้นหา
  setSearchInput: (text) => set({ searchInput: text }),

  // สลับเปิด/ปิดแผง Search Detail
  setIsDetailOpen: (open) =>
    set((state) => ({
      isDetailOpen: typeof open === 'function' ? open(state.isDetailOpen) : open,
    })),

  // กำหนดร้านค้าที่เลือก
  setSelectedStore: (storeId) => set({ selectedStore: storeId }),

  // กำหนดหมวดหมู่ที่เลือก
  setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),

  // 🚀 สั่งค้นหาด้วยตัวกรองจาก Search Detail
  applyDetailSearch: ({ storeId, categoryId }) => {
    set({
      selectedStore: storeId || '',
      selectedCategory: categoryId || '',
      pagination: { ...get().pagination, page: 1 },
    });
    get().fetchProducts();
  },

  // 🧹 ลบเฉพาะตัวกรองร้านค้า
  clearStoreFilter: () => {
    set({
      selectedStore: '',
      pagination: { ...get().pagination, page: 1 },
    });
    get().fetchProducts();
  },

  // 🧹 ลบเฉพาะตัวกรองหมวดหมู่
  clearCategoryFilter: () => {
    set({
      selectedCategory: '',
      pagination: { ...get().pagination, page: 1 },
    });
    get().fetchProducts();
  },

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

  // resetFilter: ล้างแท็กคำค้นหาและตัวกรองทั้งหมด และกลับไปหน้า 1
  resetFilter: () => {
    set({
      searchInput: '',
      keywords: [],
      selectedStore: '',
      selectedCategory: '',
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

  // 📦 ดึงรายการร้านค้าและหมวดหมู่สำหรับใช้ในตัวกรอง Search Detail
  fetchFilterOptions: async () => {
    if (get().stores.length > 0 && get().categories.length > 0) return;
    set({ loadingFilters: true });
    try {
      const [storesRes, catsRes] = await Promise.all([
        fetch('/api/stores?mode=shop&all=true', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);

      const storesData = storesRes.ok ? await storesRes.json() : { data: [] };
      const catsData = catsRes.ok ? await catsRes.json() : { data: [] };

      set({
        stores: storesData.data || [],
        categories: catsData.data || [],
        loadingFilters: false,
      });
    } catch (err) {
      console.error('Error fetching filter options:', err);
      set({ loadingFilters: false });
    }
  },

  // 🚀 โหลดสินค้าตามหน้าปัจจุบันและตัวกรอง
  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const { keywords, pagination, selectedStore, selectedCategory } = get();
      const res = await productService.getProducts({
        search: keywords.join(','),
        store_id: selectedStore || undefined,
        category_id: selectedCategory || undefined,
        page: pagination.page,
        limit: pagination.limit, // ส่ง limit=12 ไปที่ Backend
      });

      if (res.success && Array.isArray(res.data)) {
        set({
          products: res.data,
          pagination: res.pagination || get().pagination,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      console.error('fetchProducts Error:', err);
      set({ error: err.message, loading: false });
    }
  },

  // 🔄 อัปเดตสต็อกของสินค้าชิ้นใดชิ้นหนึ่งทันทีในหน้าจอ (เช่น เมื่อมีคนซื้อตัดหน้าจนสต็อกหมด)
  updateProductStock: (productId, newStock) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.product_id?.toLowerCase() === productId?.toLowerCase()
          ? { ...p, stock_quantity: newStock }
          : p
      ),
    }));
  },
}));