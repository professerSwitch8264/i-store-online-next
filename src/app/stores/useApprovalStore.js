// src/app/stores/useApprovalStore.js

/**
 * =========================================================================
 * Zustand Store: useApprovalStore
 * =========================================================================
 * หน้าที่: จัดการ State และ Business Logic ทั้งหมดของระบบรายการรออนุมัติ (Approvals):
 * 1. รายการคำขออนุมัติ (Approvals List & Pagination)
 * 2. การค้นหา (Search Input & Applied Search)
 * 3. การเรียงลำดับหัวตาราง (Sorting: sortBy, sortOrder)
 * 4. การเปิดดู Modal รายละเอียดคำสั่งซื้อที่รออนุมัติ
 * 5. การดำเนินการอนุมัติ (Approve) และปฏิเสธ (Reject) พร้อมเหตุผล
 * 6. จำนวนคำขอรออนุมัติ (Pending Count สำหรับ Badge ใน Navbar & Sidebar)
 * =========================================================================
 */

import { create } from 'zustand';
import { approvalService } from '@/app/services/approvalService';
import { useOrderStore } from '@/app/stores/useOrderStore';

export const REJECT_REASONS = [
  'งบประมาณแผนกไม่เพียงพอ',
  'จำนวนที่ขอเบิกเกินความจำเป็นในการใช้งาน',
  'มีสินค้าชนิดนี้คงเหลือในแผนกอยู่แล้ว',
  'ข้อมูลคำสั่งซื้อไม่ถูกต้อง / สั่งสินค้าผิดรายการ',
  'เกินโควตาหรือสิทธิ์ในการเบิกจ่ายสินค้า',
  'ระงับการจัดซื้อหรือการเบิกจ่ายชั่วคราว',
  'ไม่อนุมัติ / กรุณาติดต่อผู้อนุมัติโดยตรง',
  'อื่นๆ (ระบุเพิ่มเติม)',
];

export const useApprovalStore = create((set, get) => ({
  // ─────────────────────────────────────────────────────────────────────────
  // 1. ข้อมูลรายการรออนุมัติและการแบ่งหน้า
  // ─────────────────────────────────────────────────────────────────────────
  approvals: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 10,
  loading: false,
  error: null,

  // จำนวนรายการรออนุมัติ (สำหรับ Badge)
  pendingCount: 0,
  pendingLoading: false,

  // การค้นหา
  searchInput: '',
  appliedSearch: '',

  // ค้นหาละเอียด (Search Detail)
  isDetailOpen: false,
  detailFilters: {
    orderNo: '',
    dateFrom: '',
    dateTo: '',
    buyer: '',
    reserveFlag: 'ALL',
  },
  appliedDetailFilters: {
    orderNo: '',
    dateFrom: '',
    dateTo: '',
    buyer: '',
    reserveFlag: 'ALL',
  },

  // การเรียงลำดับ
  sortBy: 'request_date',
  sortOrder: 'desc',

  // ─────────────────────────────────────────────────────────────────────────
  // 2. สถานะ Modal และ Action State
  // ─────────────────────────────────────────────────────────────────────────
  selectedApprovalForModal: null,
  isActionLoading: false,

  // Modal ยืนยันการปฏิเสธ (Reject Confirmation)
  showRejectModal: false,
  rejectRemark: '',
  selectedRejectReason: '',
  customRejectRemark: '',

  // Modal ยืนยันการอนุมัติ (Approve Confirmation)
  showApproveModal: false,

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Actions การดึงข้อมูล (Fetch Actions)
  // ─────────────────────────────────────────────────────────────────────────

  // ดึงรายการคำขออนุมัติทั้งหมดตามตัวกรอง
  fetchApprovals: async (securityToken) => {
    const { page, rowsPerPage, appliedSearch, appliedDetailFilters, sortBy, sortOrder } = get();
    set({ loading: true, error: null });

    try {
      const res = await approvalService.getApprovals(
        {
          page,
          limit: rowsPerPage,
          search: appliedSearch.trim() || undefined,
          order_no: appliedDetailFilters?.orderNo?.trim() || undefined,
          date_from: appliedDetailFilters?.dateFrom || undefined,
          date_to: appliedDetailFilters?.dateTo || undefined,
          buyer: appliedDetailFilters?.buyer?.trim() || undefined,
          reserve_flag:
            appliedDetailFilters?.reserveFlag && appliedDetailFilters.reserveFlag !== 'ALL'
              ? appliedDetailFilters.reserveFlag
              : undefined,
          sort_field: sortBy,
          sort_order: sortOrder,
        },
        securityToken
      );

      const items = res.data || [];
      const total = res.pagination?.totalCount ?? res.pagination?.total ?? items.length;

      set({
        approvals: items,
        totalCount: total,
        pendingCount: total,
        loading: false,
      });

      // ซิงค์จำนวน Badge ไปยัง useOrderStore ด้วยเพื่อความถูกต้องของ Navbar/Sidebar
      try {
        useOrderStore.getState().setPendingCount(total);
      } catch (syncErr) {
        // ignore sync error if any
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดรายการอนุมัติ';
      console.error('fetchApprovals error:', err);
      set({ error: msg, loading: false });
    }
  },

  // ดึงจำนวนรายการรออนุมัติสำหรับแสดง Badge
  fetchPendingCount: async (securityToken) => {
    try {
      set({ pendingLoading: true });
      const count = await approvalService.getPendingCount(securityToken);
      set({ pendingCount: count, pendingLoading: false });
      useOrderStore.getState().setPendingCount(count);
    } catch (err) {
      console.error('fetchPendingCount error:', err);
      set({ pendingLoading: false });
    }
  },

  setPendingCount: (count) => set({ pendingCount: count }),

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Actions การปรับเปลี่ยน Search, Sort, Pagination
  // ─────────────────────────────────────────────────────────────────────────
  setPage: (newPage, securityToken) => {
    set({ page: newPage });
    if (securityToken !== undefined) {
      get().fetchApprovals(securityToken);
    }
  },

  setRowsPerPage: (newLimit, securityToken) => {
    set({ rowsPerPage: newLimit, page: 1 });
    if (securityToken !== undefined) {
      get().fetchApprovals(securityToken);
    }
  },

  setSearchInput: (val) => set({ searchInput: val }),

  applySearch: (val, securityToken) => {
    const clean = val !== undefined ? val.trim() : get().searchInput.trim();
    set({ appliedSearch: clean, page: 1 });
    if (securityToken !== undefined) {
      get().fetchApprovals(securityToken);
    }
  },

  clearSearch: (securityToken) => {
    set({ searchInput: '', appliedSearch: '', page: 1 });
    if (securityToken !== undefined) {
      get().fetchApprovals(securityToken);
    }
  },

  // Actions ค้นหาละเอียด (Search Detail Actions)
  setIsDetailOpen: (val) => set((state) => ({ isDetailOpen: typeof val === 'function' ? val(state.isDetailOpen) : val })),

  setDetailFilters: (filters) =>
    set((state) => ({
      detailFilters: typeof filters === 'function' ? filters(state.detailFilters) : { ...state.detailFilters, ...filters },
    })),

  applyDetailSearch: (filters, securityToken) => {
    const current = get().detailFilters;
    const nextFilters = filters ? { ...current, ...filters } : current;
    set({
      detailFilters: nextFilters,
      appliedDetailFilters: { ...nextFilters },
      page: 1,
      isDetailOpen: false,
    });
    if (securityToken !== undefined) {
      get().fetchApprovals(securityToken);
    }
  },

  clearDetailSearch: (securityToken) => {
    const cleared = {
      orderNo: '',
      dateFrom: '',
      dateTo: '',
      buyer: '',
      reserveFlag: 'ALL',
    };
    set({
      detailFilters: cleared,
      appliedDetailFilters: cleared,
      page: 1,
      isDetailOpen: false,
    });
    if (securityToken !== undefined) {
      get().fetchApprovals(securityToken);
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
      get().fetchApprovals(securityToken);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Actions การจัดการ Modal
  // ─────────────────────────────────────────────────────────────────────────
  openApprovalModal: (approval) => {
    set({
      selectedApprovalForModal: approval,
      showRejectModal: false,
      showApproveModal: false,
      rejectRemark: '',
    });
  },

  closeApprovalModal: () => {
    set({
      selectedApprovalForModal: null,
      showRejectModal: false,
      showApproveModal: false,
      rejectRemark: '',
      selectedRejectReason: '',
      customRejectRemark: '',
    });
  },

  openRejectModal: () =>
    set({
      showRejectModal: true,
      rejectRemark: '',
      selectedRejectReason: '',
      customRejectRemark: '',
    }),
  closeRejectModal: () =>
    set({
      showRejectModal: false,
      rejectRemark: '',
      selectedRejectReason: '',
      customRejectRemark: '',
    }),
  setRejectRemark: (val) => set({ rejectRemark: val }),
  setSelectedRejectReason: (val) => set({ selectedRejectReason: val }),
  setCustomRejectRemark: (val) => set({ customRejectRemark: val }),

  openApproveModal: () => set({ showApproveModal: true }),
  closeApproveModal: () => set({ showApproveModal: false }),

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Actions อนุมัติและปฏิเสธคำสั่งซื้อ
  // ─────────────────────────────────────────────────────────────────────────

  // อนุมัติคำสั่งซื้อ (Approve Action)
  approveOrder: async (securityToken) => {
    const { selectedApprovalForModal } = get();
    if (!selectedApprovalForModal) return { success: false };

    const orderNo = selectedApprovalForModal.order_no;
    set({ isActionLoading: true });

    try {
      const res = await approvalService.approveOrder(orderNo, securityToken);
      if (res.success) {
        set({
          selectedApprovalForModal: null,
          showApproveModal: false,
          isActionLoading: false,
        });

        // รีเฟรชตารางและจำนวนรออนุมัติ
        await Promise.all([
          get().fetchApprovals(securityToken),
          get().fetchPendingCount(securityToken),
        ]);

        return { success: true, orderNo, message: res.message };
      }
      return { success: false, error: res.error };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอนุมัติคำสั่งซื้อ';
      return { success: false, error: msg };
    } finally {
      set({ isActionLoading: false });
    }
  },

  // ปฏิเสธคำสั่งซื้อ (Reject Action)
  rejectOrder: async (securityToken) => {
    const { selectedApprovalForModal, selectedRejectReason, customRejectRemark, rejectRemark } = get();
    if (!selectedApprovalForModal) return { success: false };

    const orderNo = selectedApprovalForModal.order_no;
    set({ isActionLoading: true });

    let finalRemark = selectedRejectReason || rejectRemark;
    if (selectedRejectReason === 'อื่นๆ (ระบุเพิ่มเติม)') {
      finalRemark = customRejectRemark.trim() ? `อื่นๆ: ${customRejectRemark.trim()}` : 'อื่นๆ';
    } else if (!finalRemark) {
      finalRemark = 'ปฏิเสธโดยผู้อนุมัติ';
    }

    try {
      const res = await approvalService.rejectOrder(
        orderNo,
        finalRemark,
        securityToken
      );

      if (res.success) {
        set({
          selectedApprovalForModal: null,
          showRejectModal: false,
          rejectRemark: '',
          selectedRejectReason: '',
          customRejectRemark: '',
          isActionLoading: false,
        });

        // รีเฟรชตารางและจำนวนรออนุมัติ
        await Promise.all([
          get().fetchApprovals(securityToken),
          get().fetchPendingCount(securityToken),
        ]);

        return { success: true, orderNo, message: res.message };
      }
      return { success: false, error: res.error };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปฏิเสธคำสั่งซื้อ';
      return { success: false, error: msg };
    } finally {
      set({ isActionLoading: false });
    }
  },
}));

export default useApprovalStore;
