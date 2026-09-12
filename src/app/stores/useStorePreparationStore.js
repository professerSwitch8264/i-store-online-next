// src/app/stores/useStorePreparationStore.js

/**
 * =========================================================================
 * Zustand Store: useStorePreparationStore
 * =========================================================================
 * หน้าที่: จัดการ State และ Business Logic สำหรับ "หน้ารายการจัดเตรียมสินค้าของร้านค้า" (/store-management/preparation):
 * 1. รายการคำสั่งซื้อที่ต้องจัดเตรียม (Status = 'X' / PREPARING)
 * 2. การแบ่งหน้าแบบ Server-Side (Pagination: page, rowsPerPage, totalCount)
 * 3. การค้นหา (Search Input & Applied Search)
 * 4. การเรียงลำดับหัวตาราง (Sorting: sortBy, sortOrder)
 * 5. ข้อมูลการเปิด Modal ดูรายละเอียดคำสั่งซื้อ
 * 6. โหมดจัดเตรียมสินค้า (Preparation Mode):
 *    - ปรับจำนวนสินค้า (Dropdown quantity_sent)
 *    - การยืนยัน (Confirm) / ยกเลิก (Cancel) รายแถว
 *    - เหตุผลการยกเลิก (DAMAGED -> deposit-waste, LOST -> deposit-waste, RETURN -> return)
 *    - ตรวจสอบความครบถ้วนก่อนส่งข้อมูล
 * =========================================================================
 */

import { create } from 'zustand';
import { orderService } from '@/app/services/orderService';

export const WASTE_REASONS = [
  { id: 'DAMAGED', label: 'สินค้าชำรุด / ของพัง / เสียหาย' },
  { id: 'LOST', label: 'สินค้าสูญหาย / หาของไม่พบ' },
  { id: 'OTHER', label: 'อื่นๆ (ระบุเพิ่มเติม)' },
];

export const STORE_CANCEL_REASONS = [
  'สินค้าในคลังหมด / สต็อกไม่เพียงพอ',
  'สินค้าชำรุดเสียหายทั้งหมด ไม่สามารถจัดส่งได้',
  'ผู้สั่งซื้อขอยกเลิกคำสั่งซื้อ',
  'ไม่สามารถจัดส่งไปยังสถานที่ที่ระบุได้',
  'ข้อมูลคำสั่งซื้อไม่ถูกต้อง',
  'อื่นๆ (ระบุเพิ่มเติม)',
];

export const useStorePreparationStore = create((set, get) => ({
  // Modal ยกเลิกคำสั่งซื้อทั้งใบ (Cancel Order Modal)
  showCancelOrderModal: false,
  selectedCancelReason: '',
  customCancelRemark: '',
  isCancellingOrder: false,
  // 1. สถานะข้อมูลคำสั่งซื้อและการแบ่งหน้า
  orders: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 10,
  loading: false,
  error: null,

  // กล่องค้นหา
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

  // การจัดเรียงลำดับ (ค่าเริ่มต้น: วันที่สั่งซื้อ ล่าสุดขึ้นก่อน)
  sortBy: 'order_date',
  sortOrder: 'desc',

  // Modal ดูรายละเอียด
  selectedOrderForModal: null,

  // 2. โหมดจัดเตรียมสินค้า (Preparation Mode)
  isPreparationMode: false,
  isSubmitting: false,
  itemsPrepState: {}, // { [productId]: { action, quantity_sent, quantity_return, quantity_waste, waste_reason, waste_custom_remark, return_remark, original_quantity } }

  // Modal จัดสรรสินค้าส่วนที่ไม่ได้จัดส่ง (คืนคลังปกติ vs ของเสีย)
  allocationModalItemKey: null,
  allocationModalType: 'PARTIAL', // 'PARTIAL' | 'CANCEL'
  allocationForm: {
    quantity_sent: 0,
    quantity_return: 0,
    quantity_waste: 0,
    quantity_lost: 0,
    waste_reason: 'DAMAGED',
    waste_custom_remark: '',
    lost_custom_remark: '',
    return_remark: '',
  },

  // Modal ยืนยันการส่งข้อมูลจัดเตรียม
  showConfirmSubmitModal: false,

  // 3. Fetch Orders สำหรับร้านค้าที่เลือก (is_store_view = true, status = 'X')
  fetchPreparingOrders: async (securityToken, storeId) => {
    if (!storeId) {
      set({ orders: [], totalCount: 0, loading: false });
      return;
    }

    const { page, rowsPerPage, appliedSearch, appliedDetailFilters, sortBy, sortOrder } = get();
    set({ loading: true, error: null });

    try {
      const res = await orderService.getOrders(
        {
          is_store_view: true,
          store_id: storeId,
          page,
          limit: rowsPerPage,
          status: 'X', // เฉพาะสถานะกำลังเตรียมสินค้า
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

      set({
        orders: res.data || [],
        totalCount: res.pagination?.total || 0,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดรายการจัดเตรียมสินค้า';
      console.error('useStorePreparationStore fetchPreparingOrders error:', err);
      set({ error: msg, loading: false });
    }
  },

  // 4. Actions การปรับเปลี่ยน Filter, Search, Pagination, Sort
  setPage: (newPage, securityToken, storeId) => {
    set({ page: newPage });
    if (securityToken && storeId) {
      get().fetchPreparingOrders(securityToken, storeId);
    }
  },

  setRowsPerPage: (newLimit, securityToken, storeId) => {
    set({ rowsPerPage: newLimit, page: 1 });
    if (securityToken && storeId) {
      get().fetchPreparingOrders(securityToken, storeId);
    }
  },

  setSearchInput: (val) => set({ searchInput: val }),

  applySearch: (val, securityToken, storeId) => {
    const clean = val !== undefined ? val.trim() : get().searchInput.trim();
    set({ appliedSearch: clean, page: 1 });
    if (securityToken && storeId) {
      get().fetchPreparingOrders(securityToken, storeId);
    }
  },

  clearSearch: (securityToken, storeId) => {
    set({ searchInput: '', appliedSearch: '', page: 1 });
    if (securityToken && storeId) {
      get().fetchPreparingOrders(securityToken, storeId);
    }
  },

  // Actions ค้นหาละเอียด (Search Detail Actions)
  setIsDetailOpen: (val) => set((state) => ({ isDetailOpen: typeof val === 'function' ? val(state.isDetailOpen) : val })),

  setDetailFilters: (filters) =>
    set((state) => ({
      detailFilters: typeof filters === 'function' ? filters(state.detailFilters) : { ...state.detailFilters, ...filters },
    })),

  applyDetailSearch: (filters, securityToken, storeId) => {
    const current = get().detailFilters;
    const nextFilters = filters ? { ...current, ...filters } : current;
    set({
      detailFilters: nextFilters,
      appliedDetailFilters: { ...nextFilters },
      page: 1,
      isDetailOpen: false,
    });
    if (securityToken && storeId) {
      get().fetchPreparingOrders(securityToken, storeId);
    }
  },

  clearDetailSearch: (securityToken, storeId) => {
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
    if (securityToken && storeId) {
      get().fetchPreparingOrders(securityToken, storeId);
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
      get().fetchPreparingOrders(securityToken, storeId);
    }
  },

  // 5. Modal จัดการเปิด-ปิดคำสั่งซื้อ
  openOrderModal: (order) => {
    set({
      selectedOrderForModal: order,
      isPreparationMode: false,
      itemsPrepState: {},
      allocationModalItemKey: null,
      showConfirmSubmitModal: false,
    });
  },

  closeOrderModal: () => {
    set({
      selectedOrderForModal: null,
      isPreparationMode: false,
      itemsPrepState: {},
      allocationModalItemKey: null,
      showConfirmSubmitModal: false,
    });
  },

  // 6. โหมดจัดเตรียมสินค้า (Preparation Mode Actions)
  startPreparation: (modalItems = []) => {
    const initialPrep = {};
    modalItems.forEach((item) => {
      const key = item.product_id || item.item_id;
      const initialQty = Number(item.quantity ?? item.quantity_order ?? 1);
      initialPrep[key] = {
        action: 'PENDING', // PENDING, CONFIRMED, CANCELLED
        quantity_sent: initialQty,
        original_quantity: initialQty,
        quantity_return: 0,
        quantity_waste: 0,
        quantity_lost: 0,
        waste_reason: 'DAMAGED',
        waste_custom_remark: '',
        lost_custom_remark: '',
        return_remark: '',
      };
    });

    set({
      isPreparationMode: true,
      itemsPrepState: initialPrep,
      allocationModalItemKey: null,
      showConfirmSubmitModal: false,
    });
  },

  cancelPreparation: () => {
    set({
      isPreparationMode: false,
      itemsPrepState: {},
      allocationModalItemKey: null,
      showConfirmSubmitModal: false,
    });
  },

  setItemQuantitySent: (key, qty) => {
    const { itemsPrepState } = get();
    const cur = itemsPrepState[key];
    if (!cur) return;
    const newSent = Number(qty);
    const diff = Math.max(0, cur.original_quantity - newSent);
    set({
      itemsPrepState: {
        ...itemsPrepState,
        [key]: {
          ...cur,
          quantity_sent: newSent,
          quantity_return: diff,
          quantity_waste: 0,
          quantity_lost: 0,
        },
      },
    });
  },

  // 6.1 เปิด Modal จัดสรรสินค้าตาม UI Stepper ใหม่
  openAllocationModal: (key) => {
    const { itemsPrepState } = get();
    const cur = itemsPrepState[key];
    if (!cur) return;

    let qSent = cur.quantity_sent;
    let qReturn = cur.quantity_return;
    let qWaste = cur.quantity_waste;
    let qLost = cur.quantity_lost || 0;

    // ถ้ายังเป็น PENDING หรือยอดรวมยังไม่เท่ากับยอดสั่งซื้อ ให้เริ่มต้นด้วยการส่งมอบครบ 100%
    if (cur.action === 'PENDING' || (qSent + qReturn + qWaste + qLost !== cur.original_quantity)) {
      qSent = cur.original_quantity;
      qReturn = 0;
      qWaste = 0;
      qLost = 0;
    }

    set({
      allocationModalItemKey: key,
      allocationForm: {
        quantity_sent: qSent,
        quantity_return: qReturn,
        quantity_waste: qWaste,
        quantity_lost: qLost,
        waste_reason: cur.waste_reason || 'DAMAGED',
        waste_custom_remark: cur.waste_custom_remark || '',
        lost_custom_remark: cur.lost_custom_remark || '',
        return_remark: cur.return_remark || '',
      },
    });
  },

  closeAllocationModal: () => {
    set({
      allocationModalItemKey: null,
    });
  },

  setAllocationFormField: (field, val) => {
    const { allocationForm } = get();
    set({
      allocationForm: {
        ...allocationForm,
        [field]: val,
      },
    });
  },

  // Stepper [+] : ถ้า point ครบ จะไม่เพิ่ม (disabled)
  incrementAllocationField: (field) => {
    const { allocationModalItemKey, allocationForm, itemsPrepState } = get();
    if (!allocationModalItemKey) return;
    const cur = itemsPrepState[allocationModalItemKey];
    if (!cur) return;

    const origQty = cur.original_quantity;
    const sent = Number(allocationForm.quantity_sent || 0);
    const wst = Number(allocationForm.quantity_waste || 0);
    const lost = Number(allocationForm.quantity_lost || 0);
    const ret = Number(allocationForm.quantity_return || 0);
    const total = sent + wst + lost + ret;

    if (total >= origQty) return; // point ครบแล้ว ไม่ให้บวกเพิ่ม

    set({
      allocationForm: {
        ...allocationForm,
        [field]: Number(allocationForm[field] || 0) + 1,
      },
    });
  },

  // Stepper [-] : ไม่ให้ลดต่ำกว่า 0
  decrementAllocationField: (field) => {
    const { allocationForm } = get();
    const curVal = Number(allocationForm[field] || 0);
    if (curVal <= 0) return;

    set({
      allocationForm: {
        ...allocationForm,
        [field]: curVal - 1,
      },
    });
  },

  // พิมพ์ตัวเลขในช่อง Stepper : หากพิมพ์เกินจะปัดลงให้พอดีกับยอดที่เหลือ
  setClampedAllocationField: (field, rawValue) => {
    const { allocationModalItemKey, allocationForm, itemsPrepState } = get();
    if (!allocationModalItemKey) return;
    const cur = itemsPrepState[allocationModalItemKey];
    if (!cur) return;

    const origQty = cur.original_quantity;
    const val = typeof rawValue === 'number' ? rawValue : parseInt(String(rawValue).replace(/\D/g, ''), 10) || 0;

    const sent = field === 'quantity_sent' ? 0 : Number(allocationForm.quantity_sent || 0);
    const wst = field === 'quantity_waste' ? 0 : Number(allocationForm.quantity_waste || 0);
    const lost = field === 'quantity_lost' ? 0 : Number(allocationForm.quantity_lost || 0);
    const ret = field === 'quantity_return' ? 0 : Number(allocationForm.quantity_return || 0);

    const othersSum = sent + wst + lost + ret;
    const maxAllowed = Math.max(0, origQty - othersSum);
    const clamped = Math.min(maxAllowed, Math.max(0, val));

    set({
      allocationForm: {
        ...allocationForm,
        [field]: clamped,
      },
    });
  },

  // บันทึกยอดการจัดสรรสินค้าจาก Modal
  applyAllocation: () => {
    const { allocationModalItemKey, allocationForm, itemsPrepState } = get();
    if (!allocationModalItemKey) return;
    const cur = itemsPrepState[allocationModalItemKey];
    if (!cur) return;

    const sent = Number(allocationForm.quantity_sent || 0);
    const ret = Number(allocationForm.quantity_return || 0);
    const wst = Number(allocationForm.quantity_waste || 0);
    const lost = Number(allocationForm.quantity_lost || 0);

    const action = sent > 0 ? 'CONFIRMED' : 'CANCELLED';

    set({
      itemsPrepState: {
        ...itemsPrepState,
        [allocationModalItemKey]: {
          ...cur,
          action,
          quantity_sent: sent,
          quantity_return: ret,
          quantity_waste: wst,
          quantity_lost: lost,
          waste_reason: 'DAMAGED',
          waste_custom_remark: wst > 0 ? (allocationForm.waste_custom_remark || 'สินค้าชำรุดระหว่างการจัดเตรียม') : '',
          lost_custom_remark: lost > 0 ? (allocationForm.lost_custom_remark || 'สินค้าสูญหายระหว่างการจัดเตรียม') : '',
          return_remark: ret > 0 ? (allocationForm.return_remark || 'คืนสต็อกเข้าคลังสินค้า') : '',
        },
      },
      allocationModalItemKey: null,
    });
  },

  // กดยกเลิกจากแถวตารางโดยตรง: คืนคลังทันที 100% ทั้งหมด
  cancelItemDirect: (key) => {
    const { itemsPrepState } = get();
    const cur = itemsPrepState[key];
    if (!cur) return;
    set({
      itemsPrepState: {
        ...itemsPrepState,
        [key]: {
          ...cur,
          action: 'CANCELLED',
          quantity_sent: 0,
          quantity_return: cur.original_quantity,
          quantity_waste: 0,
          quantity_lost: 0,
          waste_reason: 'DAMAGED',
          waste_custom_remark: '',
          lost_custom_remark: '',
          return_remark: 'ยกเลิกรายการจัดเตรียม คืนสต็อกเข้าคลังทั้งหมด',
        },
      },
    });
  },

  // รีเซ็ตสถานะแถวสินค้า
  resetItemAction: (key) => {
    const { itemsPrepState } = get();
    const cur = itemsPrepState[key];
    if (!cur) return;
    set({
      itemsPrepState: {
        ...itemsPrepState,
        [key]: {
          ...cur,
          action: 'PENDING',
          quantity_sent: cur.original_quantity,
          quantity_return: 0,
          quantity_waste: 0,
          quantity_lost: 0,
          waste_reason: 'DAMAGED',
          waste_custom_remark: '',
          lost_custom_remark: '',
          return_remark: '',
        },
      },
    });
  },

  openConfirmSubmitModal: () => set({ showConfirmSubmitModal: true }),
  closeConfirmSubmitModal: () => set({ showConfirmSubmitModal: false }),

  // 7. บันทึกผลการจัดเตรียมสินค้า (POST /api/orders/prepare)
  submitPreparation: async (securityToken, storeId) => {
    const { selectedOrderForModal, itemsPrepState } = get();
    if (!selectedOrderForModal) {
      return { success: false, error: 'ไม่พบข้อมูลคำสั่งซื้อที่ต้องการบันทึก' };
    }

    set({ isSubmitting: true });

    try {
      const prepared_items = Object.entries(itemsPrepState).map(([productId, state]) => ({
        product_id: productId,
        action: state.action,
        quantity_sent: Number(state.quantity_sent || 0),
        quantity_return: Number(state.quantity_return || 0),
        quantity_waste: Number(state.quantity_waste || 0),
        quantity_lost: Number(state.quantity_lost || 0),
        waste_reason: state.waste_reason || 'DAMAGED',
        waste_custom_remark: state.waste_custom_remark || '',
        lost_custom_remark: state.lost_custom_remark || '',
        return_remark: state.return_remark || '',
      }));

      const res = await orderService.prepareOrder(
        {
          order_id: selectedOrderForModal.order_id,
          order_no: selectedOrderForModal.order_no,
          prepared_items,
        },
        securityToken
      );

      // รีเฟรชรายการคำสั่งซื้อของร้านค้า
      if (securityToken && storeId) {
        await get().fetchPreparingOrders(securityToken, storeId);
      }

      set({
        isSubmitting: false,
        isPreparationMode: false,
        itemsPrepState: {},
        selectedOrderForModal: null,
        showConfirmSubmitModal: false,
      });

      return {
        success: true,
        message: res.message || `บันทึกการจัดเตรียมสินค้า ${selectedOrderForModal.order_no} เรียบร้อยแล้ว`,
        data: res.data,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกการจัดเตรียมสินค้า';
      set({ isSubmitting: false, showConfirmSubmitModal: false });
      return { success: false, error: msg };
    }
  },

  // 8. Actions สำหรับการยกเลิกคำสั่งซื้อทั้งใบ (Cancel Order)
  openCancelOrderModal: () => set({
    showCancelOrderModal: true,
    selectedCancelReason: '',
    customCancelRemark: '',
  }),

  closeCancelOrderModal: () => set({
    showCancelOrderModal: false,
    selectedCancelReason: '',
    customCancelRemark: '',
  }),

  setSelectedCancelReason: (reason) => set({ selectedCancelReason: reason }),
  setCustomCancelRemark: (remark) => set({ customCancelRemark: remark }),

  cancelOrder: async (securityToken, storeId) => {
    const { selectedOrderForModal, selectedCancelReason, customCancelRemark } = get();
    if (!selectedOrderForModal) {
      return { success: false, error: 'ไม่พบข้อมูลคำสั่งซื้อที่ต้องการยกเลิก' };
    }

    let finalRemark = selectedCancelReason;
    if (selectedCancelReason === 'อื่นๆ (ระบุเพิ่มเติม)' && customCancelRemark.trim()) {
      finalRemark = customCancelRemark.trim();
    } else if (!finalRemark) {
      finalRemark = 'ร้านค้ายกเลิกคำสั่งซื้อ';
    }

    set({ isCancellingOrder: true });

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
          isCancellingOrder: false,
          showCancelOrderModal: false,
          selectedOrderForModal: null,
          isPreparationMode: false,
          itemsPrepState: {},
          selectedCancelReason: '',
          customCancelRemark: '',
        });

        // รีเฟรชรายการคำสั่งซื้อของร้านค้า
        if (securityToken && storeId) {
          await get().fetchPreparingOrders(securityToken, storeId);
        }

        return {
          success: true,
          message: res.message || `ยกเลิกคำสั่งซื้อ ${selectedOrderForModal.order_no} เรียบร้อยแล้ว`,
          orderNo: selectedOrderForModal.order_no,
        };
      }

      set({ isCancellingOrder: false });
      return { success: false, error: res.error || 'เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ';
      set({ isCancellingOrder: false });
      return { success: false, error: msg };
    }
  },
}));
