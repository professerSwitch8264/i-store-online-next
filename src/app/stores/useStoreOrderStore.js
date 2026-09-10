// src/app/stores/useStoreOrderStore.js

/**
 * =========================================================================
 * Zustand Store: useStoreOrderStore
 * =========================================================================
 * หน้าที่: จัดการ State และ Business Logic สำหรับ "หน้ารายการขายของร้านค้า" (/store-management/orders):
 * 1. รายการคำสั่งซื้อที่ส่งเข้ามายังร้านค้า (Store Orders List)
 * 2. การแบ่งหน้าแบบ Server-Side (Pagination: page, rowsPerPage, totalCount)
 * 3. ตัวกรองแท็บ 7 สถานะ (Tabs & Tab Counts)
 * 4. การค้นหา (Search Input & Applied Search)
 * 5. การเรียงลำดับหัวตาราง (Sorting: sortBy, sortOrder)
 * 6. ข้อมูลการเปิด Modal ดูรายละเอียดคำสั่งซื้อของลูกค้า
 * =========================================================================
 */

import { create } from 'zustand';
import { orderService } from '@/app/services/orderService';

// แผนผังแท็บสถานะทั้ง 7 แท็บ (โครงสร้างเดียวกับหน้า /orders)
export const STORE_ORDER_TABS = [
  { id: 'ALL', label: 'ทั้งหมด', statusCode: [] },
  { id: 'PENDING', label: 'รออนุมัติ', statusCode: ['W', 'P'] },
  { id: 'PREPARING', label: 'กำลังเตรียมสินค้า', statusCode: ['X'] },
  { id: 'AWAITING_RECEIPT', label: 'รอยืนยันการรับสินค้า', statusCode: ['S'] },
  { id: 'COMPLETED', label: 'ดำเนินการเสร็จสิ้น', statusCode: ['D'] },
  { id: 'REJECTED', label: 'ถูกปฏิเสธ', statusCode: ['R'] },
  { id: 'CANCELLED', label: 'ยกเลิกรายการ', statusCode: ['C'] },
];

export const useStoreOrderStore = create((set, get) => ({
  // 1. สถานะข้อมูลคำสั่งซื้อและการแบ่งหน้า
  orders: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 10,
  loading: false,
  error: null,

  // แท็บสถานะที่เลือก และยอดนับในแต่ละแท็บ
  selectedTab: 'ALL',
  tabCounts: {
    ALL: 0,
    PENDING: 0,
    PREPARING: 0,
    AWAITING_RECEIPT: 0,
    COMPLETED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  },

  // กล่องค้นหา
  searchInput: '',
  appliedSearch: '',

  // การจัดเรียงลำดับ
  sortBy: 'order_date',
  sortOrder: 'desc',

  // Modal ดูรายละเอียด
  selectedOrderForModal: null,

  // 2. Fetch Orders สำหรับร้านค้าที่เลือก (is_store_view = true)
  fetchOrders: async (securityToken, storeId) => {
    if (!storeId) {
      set({ orders: [], totalCount: 0, loading: false });
      return;
    }

    const { page, rowsPerPage, selectedTab, appliedSearch, sortBy, sortOrder } = get();
    set({ loading: true, error: null });

    try {
      const tabConfig = STORE_ORDER_TABS.find((t) => t.id === selectedTab);
      const statusParam =
        tabConfig && tabConfig.statusCode.length > 0
          ? tabConfig.statusCode.join(',')
          : undefined;

      const res = await orderService.getOrders(
        {
          is_store_view: true,
          store_id: storeId,
          page,
          limit: rowsPerPage,
          status: statusParam,
          search: appliedSearch.trim() || undefined,
          sort_field: sortBy,
          sort_order: sortOrder,
        },
        securityToken
      );

      set({
        orders: res.data || [],
        totalCount: res.pagination?.total || 0,
        tabCounts: res.counts || get().tabCounts,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลรายการขาย';
      console.error('useStoreOrderStore fetchOrders error:', err);
      set({ error: msg, loading: false });
    }
  },

  // 3. Actions การปรับเปลี่ยน Filter, Search, Pagination, Sort
  setPage: (newPage, securityToken, storeId) => {
    set({ page: newPage });
    if (securityToken && storeId) {
      get().fetchOrders(securityToken, storeId);
    }
  },

  setRowsPerPage: (newLimit, securityToken, storeId) => {
    set({ rowsPerPage: newLimit, page: 1 });
    if (securityToken && storeId) {
      get().fetchOrders(securityToken, storeId);
    }
  },

  setSelectedTab: (tabId, securityToken, storeId) => {
    set({ selectedTab: tabId, page: 1 });
    if (securityToken && storeId) {
      get().fetchOrders(securityToken, storeId);
    }
  },

  setSearchInput: (val) => set({ searchInput: val }),

  applySearch: (val, securityToken, storeId) => {
    const clean = val !== undefined ? val.trim() : get().searchInput.trim();
    set({ appliedSearch: clean, page: 1 });
    if (securityToken && storeId) {
      get().fetchOrders(securityToken, storeId);
    }
  },

  clearSearch: (securityToken, storeId) => {
    set({ searchInput: '', appliedSearch: '', page: 1 });
    if (securityToken && storeId) {
      get().fetchOrders(securityToken, storeId);
    }
  },

  toggleSort: (field, securityToken, storeId) => {
    const { sortBy, sortOrder } = get();
    let newOrder = 'desc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    set({ sortBy: field, sortOrder: newOrder, page: 1 });
    if (securityToken && storeId) {
      get().fetchOrders(securityToken, storeId);
    }
  },

  // 4. Modal ดูรายละเอียด
  openOrderModal: (order) => {
    set({ selectedOrderForModal: order });
  },

  closeOrderModal: () => {
    set({ selectedOrderForModal: null });
  },
}));
