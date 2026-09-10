// src/app/stores/useOrderStore.js

/**
 * =========================================================================
 * Zustand Store: useOrderStore
 * =========================================================================
 * หน้าที่: จัดการ State และ Business Logic ทั้งหมดของระบบคำสั่งซื้อ (Orders):
 * 1. รายการคำสั่งซื้อ (Orders List)
 * 2. การแบ่งหน้าแบบ Server-Side (Pagination: page, rowsPerPage, totalCount)
 * 3. ตัวกรองแท็บ 7 สถานะ (Tabs & Tab Counts)
 * 4. การค้นหา (Search Input & Applied Search)
 * 5. การเรียงลำดับหัวตาราง (Sorting: sortBy, sortOrder)
 * 6. ข้อมูลการเปิด Modal ดูรายละเอียด (Detail Modal)
 * 7. การแก้ไขจำนวนสินค้าในออเดอร์ (Update Item Quantities)
 * 8. การยกเลิกคำสั่งซื้อ (Cancel Order)
 * 9. จำนวนคำขอรออนุมัติ (Pending Count สำหรับ Badge ใน Navbar & Sidebar)
 * =========================================================================
 */

import { create } from 'zustand';
import { orderService } from '@/app/services/orderService';
import { approvalService } from '@/app/services/approvalService';

// แผนผังแท็บสถานะทั้ง 7 แท็บและรหัสสถานะในฐานข้อมูล
export const ORDER_TABS = [
  { id: 'ALL', label: 'ทั้งหมด', statusCode: [] },
  { id: 'PENDING', label: 'รออนุมัติ', statusCode: ['W', 'P'] },
  { id: 'PREPARING', label: 'กำลังเตรียมสินค้า', statusCode: ['X'] },
  { id: 'AWAITING_RECEIPT', label: 'รอยืนยันการรับสินค้า', statusCode: ['S'] },
  { id: 'COMPLETED', label: 'ดำเนินการเสร็จสิ้น', statusCode: ['D'] },
  { id: 'REJECTED', label: 'ถูกปฏิเสธ', statusCode: ['R'] },
  { id: 'CANCELLED', label: 'ยกเลิกรายการ', statusCode: ['C'] },
];

// รายการเหตุผลมาตรฐานในการยกเลิกคำสั่งซื้อ
export const CANCEL_REASONS = [
  'สั่งสินค้าผิดรายการ / ต้องการแก้ไขคำสั่งซื้อ',
  'ระบุจำนวนสินค้าไม่ถูกต้อง',
  'สั่งซื้อซ้ำซ้อน',
  'เปลี่ยนใจ / ไม่ต้องการใช้งานแล้ว',
  'เลือกสถานที่จัดส่งผิดพลาด',
  'ต้องการเปลี่ยนร้านค้าที่สั่งซื้อ',
  'อื่นๆ (ระบุเพิ่มเติม)',
];

export const useOrderStore = create((set, get) => ({
  // ─────────────────────────────────────────────────────────────────────────
  // 1. สถานะข้อมูลคำสั่งซื้อและการแบ่งหน้า (Orders State)
  // ─────────────────────────────────────────────────────────────────────────
  orders: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 10,
  loading: false,
  error: null,

  // แท็บสถานะที่เลือก และจำนวนในแต่ละแท็บ
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

  // จำนวนรายการรออนุมัติ (สำหรับ Badge ใน Navbar & Sidebar)
  pendingCount: 0,
  pendingLoading: false,

  // การค้นหา
  searchInput: '',
  appliedSearch: '',

  // การเรียงลำดับ
  sortBy: 'order_date',
  sortOrder: 'desc',

  // ─────────────────────────────────────────────────────────────────────────
  // 2. สถานะ Modal และการยกเลิกคำสั่งซื้อ
  // ─────────────────────────────────────────────────────────────────────────
  selectedOrderForModal: null,
  showCancelModal: false,
  isCancellingOrder: false,
  selectedCancelReason: '',
  customCancelRemark: '',
  setSelectedCancelReason: (reason) => set({ selectedCancelReason: reason }),
  setCustomCancelRemark: (remark) => set({ customCancelRemark: remark }),

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Actions การดึงข้อมูล (Fetch Actions)
  // ─────────────────────────────────────────────────────────────────────────

  // ดึงรายการคำสั่งซื้อตามตัวกรองทั้งหมดใน State
  fetchOrders: async (securityToken) => {
    const { page, rowsPerPage, selectedTab, appliedSearch, sortBy, sortOrder } = get();
    set({ loading: true, error: null });

    try {
      const tabConfig = ORDER_TABS.find((t) => t.id === selectedTab);
      const statusParam =
        tabConfig && tabConfig.statusCode.length > 0
          ? tabConfig.statusCode.join(',')
          : undefined;

      const res = await orderService.getOrders(
        {
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
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลคำสั่งซื้อ';
      console.error('fetchOrders error:', err);
      set({ error: msg, loading: false });
    }
  },

  // ดึงจำนวนคำขอรออนุมัติสำหรับแสดง Badge
  fetchPendingCount: async (securityToken) => {
    try {
      set({ pendingLoading: true });
      const count = await approvalService.getPendingCount(securityToken);
      set({ pendingCount: count, pendingLoading: false });
    } catch (err) {
      console.error('fetchPendingCount error:', err);
      set({ pendingLoading: false });
    }
  },

  setPendingCount: (count) => set({ pendingCount: count }),

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Actions การปรับเปลี่ยน Filter, Search, Pagination, Sort
  // ─────────────────────────────────────────────────────────────────────────
  setPage: (newPage, securityToken) => {
    const evaluated = typeof newPage === 'function' ? newPage(get().page) : newPage;
    const safePage = Math.max(1, parseInt(evaluated, 10) || 1);
    set({ page: safePage });
    if (securityToken !== undefined) {
      get().fetchOrders(securityToken);
    }
  },

  setRowsPerPage: (newLimit, securityToken) => {
    set({ rowsPerPage: newLimit, page: 1 });
    if (securityToken !== undefined) {
      get().fetchOrders(securityToken);
    }
  },

  setSelectedTab: (tabId, securityToken) => {
    set({ selectedTab: tabId, page: 1 });
    if (securityToken !== undefined) {
      get().fetchOrders(securityToken);
    }
  },

  setSearchInput: (val) => set({ searchInput: val }),

  applySearch: (val, securityToken) => {
    const clean = val !== undefined ? val.trim() : get().searchInput.trim();
    set({ appliedSearch: clean, page: 1 });
    if (securityToken !== undefined) {
      get().fetchOrders(securityToken);
    }
  },

  clearSearch: (securityToken) => {
    set({ searchInput: '', appliedSearch: '', page: 1 });
    if (securityToken !== undefined) {
      get().fetchOrders(securityToken);
    }
  },

  toggleSort: (field, securityToken) => {
    const { sortBy, sortOrder } = get();
    let newOrder = 'desc';
    if (sortBy === field) {
      newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    set({ sortBy: field, sortOrder: newOrder, page: 1 });
    if (securityToken !== undefined) {
      get().fetchOrders(securityToken);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Actions การจัดการ Modal ดูรายละเอียด, ยกเลิกคำสั่งซื้อ
  // ─────────────────────────────────────────────────────────────────────────
  openOrderModal: (order) => {
    set({
      selectedOrderForModal: order,
    });
  },

  closeOrderModal: () => {
    set({
      selectedOrderForModal: null,
    });
  },

  // Modal ยกเลิกคำสั่งซื้อ
  openCancelModal: () =>
    set({
      showCancelModal: true,
      selectedCancelReason: '',
      customCancelRemark: '',
    }),
  closeCancelModal: () =>
    set({
      showCancelModal: false,
      selectedCancelReason: '',
      customCancelRemark: '',
    }),

  confirmCancelOrder: async (securityToken) => {
    const { selectedOrderForModal, selectedCancelReason, customCancelRemark } = get();
    if (!selectedOrderForModal) return { success: false };

    set({ isCancellingOrder: true });

    let finalRemark = selectedCancelReason;
    if (selectedCancelReason === 'อื่นๆ (ระบุเพิ่มเติม)') {
      finalRemark = customCancelRemark.trim() ? `อื่นๆ: ${customCancelRemark.trim()}` : 'อื่นๆ';
    } else if (!finalRemark) {
      finalRemark = 'ยกเลิกโดยผู้สั่งซื้อ';
    }

    try {
      const res = await orderService.cancelOrder(
        {
          order_id: selectedOrderForModal.order_id,
          order_no: selectedOrderForModal.order_no,
          remark: finalRemark,
        },
        securityToken
      );

      if (res.success) {
        set({
          showCancelModal: false,
          selectedOrderForModal: null,
          selectedCancelReason: '',
          customCancelRemark: '',
        });
        await Promise.all([
          get().fetchOrders(securityToken),
          get().fetchPendingCount(securityToken),
        ]);
        return { success: true, orderNo: selectedOrderForModal.order_no };
      }
      return { success: false, error: res.error };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ';
      return { success: false, error: msg };
    } finally {
      set({ isCancellingOrder: false });
    }
  },

  // ส่งคำสั่งซื้อใหม่ (ใช้ใน checkout)
  placeOrder: async (payload, securityToken) => {
    const res = await orderService.placeOrder(payload, securityToken);
    get().fetchPendingCount(securityToken);
    return res;
  },
}));
