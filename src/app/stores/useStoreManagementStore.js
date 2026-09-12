// src/app/stores/useStoreManagementStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * =========================================================================
 * Zustand Store: useStoreManagementStore
 * =========================================================================
 * หน้าที่: จัดการ Context ร้านค้าที่กำลังดูแล (Store Management Hub)
 * - บันทึกรายการร้านค้าที่ผู้ใช้งานปัจจุบันมีสิทธิ์ดูแล (stores)
 * - บันทึกร้านค้าที่กำลังเปิดจัดการอยู่ (currentStore) ลงใน localStorage เพื่อความต่อเนื่อง
 * - ฟังก์ชันสลับร้านค้า (setCurrentStore) และล้างค่ากลับหน้ารวม (clearCurrentStore)
 * =========================================================================
 */

export const useStoreManagementStore = create(
  persist(
    (set, get) => ({
      stores: [],
      currentStore: null,
      loading: false,
      error: null,
      pagination: {
        page: 1,
        limit: 6,
        total: 0,
        totalPages: 1,
      },
      appliedSearch: '',

      // กำหนดร้านค้าที่ต้องการจัดการ
      setCurrentStore: (store) => {
        set({ currentStore: store, error: null });
      },

      // ล้างค่าร้านค้า (เช่น ตอนกดปุ่มกลับไปหน้ารวมร้านค้า)
      clearCurrentStore: () => {
        set({ currentStore: null, error: null });
      },

      // ดึงข้อมูลร้านค้าจาก API /api/stores (ยิงค้นหาและตัดแบ่งหน้าจริงจากเซิร์ฟเวอร์)
      fetchUserStores: async (token, { page = 1, limit = 6, search = '' } = {}) => {
        set({ loading: true, error: null });
        try {
          const headers = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const queryParams = new URLSearchParams({
            page: String(page),
            limit: String(limit),
          });
          if (search.trim()) {
            queryParams.set('search', search.trim());
          }

          const res = await fetch(`/api/stores?${queryParams.toString()}`, { headers, cache: 'no-store' });
          const json = await res.json();

          if (!res.ok) {
            throw new Error(json.error || 'เกิดข้อผิดพลาดในการโหลดรายการร้านค้า');
          }

          const storesList = json.data || [];
          const paginationData = json.pagination || {
            page,
            limit,
            total: storesList.length,
            totalPages: Math.max(1, Math.ceil(storesList.length / limit)),
          };

          set({
            stores: storesList,
            pagination: paginationData,
            appliedSearch: search.trim(),
            loading: false,
          });

          // ตรวจสอบว่า currentStore เดิมที่เซฟไว้ ยังอยู่ในรายการร้านที่ตนมีสิทธิ์หรือไม่
          const current = get().currentStore;
          if (current) {
            const matched = storesList.find((s) => s.store_id === current.store_id);
            if (matched) {
              set({ currentStore: matched });
            }
          }

          return storesList;
        } catch (err) {
          console.error('fetchUserStores error:', err);
          set({ error: err.message, loading: false });
          return [];
        }
      },

      // อัปเดตข้อมูลร้านค้า (ยิง PUT /api/stores และอัปเดต state ทันที)
      updateStoreInfo: async (token, storeData) => {
        set({ loading: true, error: null });
        try {
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch('/api/stores', {
            method: 'PUT',
            headers,
            body: JSON.stringify(storeData),
          });
          const json = await res.json();

          if (!res.ok || !json.success) {
            throw new Error(json.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลร้านค้า');
          }

          const updatedStore = json.data;

          // อัปเดตใน stores list และ currentStore
          const currentStores = get().stores;
          const newStores = currentStores.map((s) =>
            s.store_id === updatedStore.store_id ? { ...s, ...updatedStore } : s
          );

          set({
            stores: newStores,
            currentStore: updatedStore,
            loading: false,
          });

          return { success: true, data: updatedStore };
        } catch (err) {
          console.error('updateStoreInfo error:', err);
          set({ error: err.message, loading: false });
          throw err;
        }
      },
    }),
    {
      name: 'istore_management_store',
      partialize: (state) => ({ currentStore: state.currentStore }),
    }
  )
);
