// src/app/orders/page.js

/**
 * =========================================================================
 * Page: หน้าติดตามสถานะและประวัติคำสั่งซื้อ (Order Tracking & History Page)
 * Route: /orders
 * =========================================================================
 * สถาปัตยกรรม & ดีไซน์:
 * 1. ฟอนต์ Kanit 100% ทั้งหน้า
 * 2. ขนาดความกว้าง max-w-7xl และโครงสร้าง UI เดียวกับระบบต้นแบบ 100%
 * 3. มีแถบ AccountSidebar นำทางด้านข้างสไตล์ Shopee
 * 4. กล่องค้นหาแบบ Joined Group (ช่อง Input เชื่อมติดกับปุ่มค้นหา)
 * 5. ตารางแสดงรายการคำสั่งซื้อ สไตล์ Scrollable พร้อม Sticky Header
 * 6. คอลัมน์ Action ไอคอน (MdViewKanban) สำหรับคลิกเปิด Modal ดูรายละเอียด
 * 7. รองรับ Server-Side Pagination & Sorting (order_date, order_no, total_price, reserve_flag, status) 100%
 * 8. แท็บตัวกรองสถานะ 7 สถานะแบบ Real-time จาก Server
 * 9. แถบ Pagination ด้านล่าง: Rows per page: [ 10 v ] | 1–10 of 16 | |<  <  >  >|
 * 10. Modal รายละเอียดคำสั่งซื้อ พร้อมปุ่ม "ยกเลิกคำสั่งซื้อ" (สำหรับสถานะรออนุมัติ)
 * 11. Modal ยืนยันการยกเลิกคำสั่งซื้อ พร้อมคืนสต็อกเข้าคลังอัตโนมัติ
 * =========================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { AccountSidebar } from '@/app/components/layout/AccountSidebar';
import { getThumbnailUrl, formatThaiDateTime } from '@/app/lib/utils';
import { useOrderStore, ORDER_TABS, CANCEL_REASONS } from '@/app/stores/useOrderStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { MdViewKanban } from 'react-icons/md';
import {
  RiImageLine,
  RiChat1Line,
  RiCloseLine,
  RiArrowGoBackLine,
  RiCloseCircleLine,
} from 'react-icons/ri';

/**
 * OrderItemThumbnail
 * คอมโพเนนต์รูปภาพสินค้าขนาดย่อ พร้อมระบบตรวจจับภาพเสีย (Broken Image Fallback)
 */
function OrderItemThumbnail({ thumbnail, productName }) {
  const [imageError, setImageError] = useState(false);
  const thumbUrl = getThumbnailUrl(thumbnail);

  if (!thumbUrl || imageError) {
    return (
      <div className="w-10 h-10 rounded bg-stone-100 border border-stone-200 flex items-center justify-center p-1 shrink-0 text-stone-300">
        <RiImageLine className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded bg-stone-50 border border-stone-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl}
        alt={productName}
        onError={() => setImageError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export default function OrdersPage() {
  const { userInfo } = useAuth();
  const { showSuccess, showError } = useToastStore();
  const token = userInfo?.securityToken;

  // ดึง State และ Actions ทั้งหมดจาก useOrderStore
  const {
    orders,
    totalCount,
    page,
    rowsPerPage,
    loading,
    error,
    selectedTab,
    tabCounts,
    searchInput,
    appliedSearch,
    sortBy,
    sortOrder,
    selectedOrderForModal,
    showCancelModal,
    isCancellingOrder,
    fetchOrders,
    setPage,
    setRowsPerPage,
    setSelectedTab,
    setSearchInput,
    applySearch,
    clearSearch,
    toggleSort,
    openOrderModal,
    closeOrderModal,
    openCancelModal,
    closeCancelModal,
    confirmCancelOrder,
    selectedCancelReason,
    setSelectedCancelReason,
    customCancelRemark,
    setCustomCancelRemark,
  } = useOrderStore();

  const tabs = ORDER_TABS;

  // โหลดรายการคำสั่งซื้อครั้งแรกและเมื่อตัวกรองเปลี่ยน
  useEffect(() => {
    fetchOrders(token);
  }, [fetchOrders, token, page, rowsPerPage, selectedTab, appliedSearch, sortBy, sortOrder]);

  const triggerRefresh = () => {
    fetchOrders(token);
  };

  // ป้องกันการเกิด Scrollbar บนระดับ Window/Body ขณะอยู่ในหน้า Orders
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ฟังก์ชันสลับการเรียงลำดับเมื่อคลิกหัวคอลัมน์
  const handleSort = (field) => {
    toggleSort(field, token);
  };

  // ฟังก์ชันเมื่อกดค้นหา หรือกด Enter
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    applySearch(undefined, token);
  };

  // ฟังก์ชันล้างคำค้นหา
  const handleClearSearch = () => {
    clearSearch(token);
  };

  // คำนวณช่วงข้อมูลที่กำลังแสดง (เช่น 1–10 of 16)
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  // ยืนยันการยกเลิกคำสั่งซื้อ
  const handleConfirmCancelOrder = async () => {
    const res = await confirmCancelOrder(token);
    if (res.success) {
      showSuccess(`ยกเลิกคำสั่งซื้อ ${res.orderNo} เรียบร้อยแล้ว`);
    } else if (res.error) {
      showError(res.error);
    }
  };

  // เปิด Modal ดูรายละเอียดคำสั่งซื้อ
  const handleOpenOrderModal = (ord) => {
    openOrderModal(ord);
  };

  // รายการสินค้าใน Modal ของคำสั่งซื้อ: รวมล๊อตสินค้าชิ้นเดียวกันที่มีราคาเท่ากัน
  const modalItems = useMemo(() => {
    if (!selectedOrderForModal?.items) return [];
    const grouped = [];
    selectedOrderForModal.items.forEach((item) => {
      const pId = item.product_id ? String(item.product_id).toLowerCase() : '';
      const price = Number(item.price || 0);

      const existing = grouped.find((g) => {
        const sameProduct = pId && g.product_id
          ? String(g.product_id).toLowerCase() === pId
          : g.product_name === item.product_name;
        return sameProduct && Math.abs(Number(g.price || 0) - price) < 0.0001;
      });

      const orderQty = Number(item.quantity_order ?? item.quantity ?? 1);
      const qty = Number(item.quantity ?? 1);
      const qtySent = item.quantity_sent !== null && item.quantity_sent !== undefined ? Number(item.quantity_sent) : null;
      const returnQty = Number(item.quantity_return || 0);
      const wasteQty = Number(item.quantity_waste || 0);
      const lostQty = Number(item.quantity_lost || 0);

      if (existing) {
        existing.quantity_order = (existing.quantity_order || 0) + orderQty;
        existing.quantity = (existing.quantity || 0) + qty;
        if (qtySent !== null) {
          existing.quantity_sent = (existing.quantity_sent !== null ? existing.quantity_sent : 0) + qtySent;
        }
        existing.quantity_return = Math.max(existing.quantity_return || 0, returnQty);
        existing.quantity_waste = Math.max(existing.quantity_waste || 0, wasteQty);
        existing.quantity_lost = Math.max(existing.quantity_lost || 0, lostQty);
        if (item.remark && item.remark !== existing.remark) {
          existing.remark = existing.remark ? `${existing.remark}, ${item.remark}` : item.remark;
        }
        if ((!existing.location_name || existing.location_name === '-') && item.location_name && item.location_name !== '-') {
          existing.location_name = item.location_name;
        }
      } else {
        grouped.push({
          ...item,
          quantity_order: orderQty,
          quantity: qty,
          quantity_sent: qtySent,
          quantity_return: returnQty,
          quantity_waste: wasteQty,
          quantity_lost: lostQty,
        });
      }
    });
    return grouped;
  }, [selectedOrderForModal]);

  // คำนวณยอดรวมใน Modal (รองรับยอดเดิม และยอดปรับลดหลังจัดเตรียม)
  const modalComputedTotals = useMemo(() => {
    if (!modalItems || modalItems.length === 0) {
      return { totalItems: 0, totalPrice: 0, originalTotalPrice: 0, hasAdjustments: false, hasPreparationData: false };
    }
    let totalItems = 0;
    let totalPrice = 0;
    let originalTotalPrice = 0;
    let hasAdjustments = false;
    let hasPreparationData = false;

    modalItems.forEach((item) => {
      const orderQty = Number(item.quantity_order ?? item.quantity ?? 1);
      const isPrepared = item.quantity_sent !== null && item.quantity_sent !== undefined;
      if (isPrepared) hasPreparationData = true;

      const sentQty = isPrepared ? Number(item.quantity_sent) : orderQty;
      const price = Number(item.price || 0);

      if (isPrepared && sentQty !== orderQty) {
        hasAdjustments = true;
      }

      totalItems += 1;
      originalTotalPrice += orderQty * price;
      totalPrice += sentQty * price;
    });

    return {
      totalItems,
      totalPrice: Number(totalPrice.toFixed(2)),
      originalTotalPrice: Number(originalTotalPrice.toFixed(2)),
      hasAdjustments,
      hasPreparationData,
    };
  }, [modalItems]);

  // ไอคอนลูกศร Sorting บนหัวตาราง
  const renderSortIcon = (field) => {
    if (sortBy !== field) {
      return (
        <span className="text-stone-300 group-hover:text-stone-500 transition-colors ml-1 inline-block text-[10px]">
          ↕
        </span>
      );
    }
    return (
      <span className="text-[#363636] font-bold ml-1 inline-block text-[10px]">
        {sortOrder === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  // ป้ายสถานะแบบ Pill Button (กำหนดความกว้างเท่ากันทั้งหมด w-[130px] สบายตา)
  const renderStatusPill = (status) => {
    const s = (status || 'W').toUpperCase();
    switch (s) {
      case 'W':
      case 'P':
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-[#1976d2] shadow-2xs whitespace-nowrap">
            กำลังรออนุมัติ
          </span>
        );
      case 'X':
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-[#ed6c02] shadow-2xs whitespace-nowrap">
            กำลังเตรียมสินค้า
          </span>
        );
      case 'S':
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-[#0288d1] shadow-2xs whitespace-nowrap">
            รอยืนยันการรับสินค้า
          </span>
        );
      case 'D':
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-[#2e7d32] shadow-2xs whitespace-nowrap">
            ดำเนินการเสร็จสิ้น
          </span>
        );
      case 'R':
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-[#d32f2f] shadow-2xs whitespace-nowrap">
            ถูกปฏิเสธ
          </span>
        );
      case 'C':
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-[#757575] shadow-2xs whitespace-nowrap">
            ยกเลิกรายการ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-[130px] py-1 rounded-full text-xs font-normal text-white bg-stone-500 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  // ตรวจสอบว่าออเดอร์นี้สามารถแก้ไขหรือยกเลิกได้หรือไม่ (เฉพาะสถานะ 'W' หรือ 'P')
  const isOrderEditable = (status) => {
    const s = (status || '').toUpperCase();
    return s === 'W' || s === 'P';
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#f8f9fa] text-stone-900 font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start gap-6">
        {/* บาร์เมนูด้านข้าง Account Sidebar */}
        <div className="hidden md:block shrink-0">
          <AccountSidebar />
        </div>

        {/* การ์ดตารางคำสั่งซื้อหลัก */}
        <div className="flex-1 min-w-0 w-full">
          <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden">
            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 1: หัวข้อหน้า และปุ่มเบิกสินค้า (Pinned Header)
                ───────────────────────────────────────────────────────────── */}
            <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                  คำสั่งซื้อของฉัน
                </h1>
                <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
                  ตรวจสอบสถานะการเบิกสินค้า การอนุมัติ และรายละเอียดสินค้าในแต่ละออเดอร์ 
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerRefresh}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3 py-2 rounded-md transition-colors cursor-pointer"
                  title="รีเฟรชข้อมูล"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-[#363636] ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>รีเฟรช</span>
                </button>

                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white text-xs font-medium px-3.5 py-2 rounded-md transition-colors shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>เบิกสินค้าใหม่</span>
                </Link>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 2: แท็บสถานะทั้ง 7 สถานะ + ช่องค้นหา (Joined Search Group)
                ───────────────────────────────────────────────────────────── */}
            <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-[#D3D3D3] space-y-2.5 bg-stone-50/50 shrink-0">
              {/* แท็บกรองสถานะ 7 สถานะ */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-stone-200">
                {tabs.map((tab) => {
                  const isActive = selectedTab === tab.id;
                  const count = tabCounts[tab.id] || 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSelectedTab(tab.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#2B2F38] text-white shadow-2xs'
                          : 'text-stone-600 hover:text-[#2B2F38] hover:bg-stone-200/60'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-[#EB6E3E] text-white' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ช่องค้นหา Joined Input Group เชื่อมชิดกับปุ่มค้นหา */}
              <form onSubmit={handleSearchSubmit} className="flex w-full">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="ค้นหาหมายเลขใบสั่งซื้อ..."
                    className="w-full pl-3.5 pr-9 py-2 bg-white border border-r-0 border-stone-300 rounded-l-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#EB6E3E]/40 focus:outline-none transition-colors"
                  />

                  {searchInput && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#2B2F38] cursor-pointer"
                      title="ล้างคำค้นหา"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 sm:px-6 py-2 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white text-xs sm:text-sm font-medium rounded-r-md transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-[#2B2F38]"
                  title="ค้นหา"
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.4}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span>ค้นหา</span>
                </button>
              </form>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 3: ตารางรายการคำสั่งซื้อ
                ความสูงปรับตามจำนวนแถว (auto) แต่ยืดหยุ่นไม่เกินหน้าจอ (max-height: calc(100dvh - 290px))
                ───────────────────────────────────────────────────────────── */}
            <div className="flex flex-col bg-white">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto border-3 border-stone-200 border-t-[#363636] rounded-full animate-spin" />
                  <p className="text-xs sm:text-sm font-normal text-[#363636]">กำลังโหลดข้อมูลคำสั่งซื้อ...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 text-rose-600">
                  <p className="text-sm font-normal">เกิดข้อผิดพลาดในการโหลดข้อมูล: {error}</p>
                  <button
                    type="button"
                    onClick={triggerRefresh}
                    className="px-4 py-2 bg-[#363636] text-white text-xs font-normal rounded-md hover:bg-black cursor-pointer"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#2B2F38]">ไม่มีรายการคำสั่งซื้อในขณะนี้</p>
                  <p className="text-xs text-[#363636]/60">
                    {appliedSearch
                      ? `ไม่พบข้อมูลที่ตรงกับคำค้นหา "${appliedSearch}"`
                      : 'เมื่อมีรายการสั่งซื้อ ข้อมูลจะแสดงที่นี่โดยอัตโนมัติ'}
                  </p>
                </div>
              ) : (
                <div
                  className="overflow-x-auto overflow-y-auto max-h-[calc(100dvh-415px)] sm:max-h-[calc(100dvh-365px)]"
                >
                  <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[760px]">
                    <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
                      <tr>
                        {/* คอลัมน์ Action ดูรายละเอียด */}
                        <th className="py-2.5 px-2.5 font-normal text-center bg-white w-10"></th>

                        {/* 1. หมายเลขสั่งซื้อ (คลิก Sort ได้) */}
                        <th
                          onClick={() => handleSort('order_no')}
                          className="py-2.5 px-3.5 font-normal cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามหมายเลขสั่งซื้อ"
                        >
                          <div className="flex items-center gap-1">
                            <span>หมายเลขสั่งซื้อ</span>
                            {renderSortIcon('order_no')}
                          </div>
                        </th>

                        {/* 2. วันที่ทำรายการ (คลิก Sort ได้) */}
                        <th
                          onClick={() => handleSort('order_date')}
                          className="py-2.5 px-3.5 font-normal cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามวันที่ทำรายการ"
                        >
                          <div className="flex items-center gap-1">
                            <span>วันที่ทำรายการ</span>
                            {renderSortIcon('order_date')}
                          </div>
                        </th>

                        {/* 3. ผู้สั่งซื้อ */}
                        <th className="py-2.5 px-3.5 font-normal bg-white whitespace-nowrap">
                          <span>ผู้สั่งซื้อ</span>
                        </th>

                        {/* 4. รูปแบบการสั่งซื้อ (คลิก Sort ได้) */}
                        <th
                          onClick={() => handleSort('reserve_flag')}
                          className="py-2.5 px-3.5 font-normal text-center cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามรูปแบบการสั่งซื้อ"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>รูปแบบการสั่งซื้อ</span>
                            {renderSortIcon('reserve_flag')}
                          </div>
                        </th>

                        {/* 5. จำนวน */}
                        <th className="py-2.5 px-3.5 font-normal text-center bg-white whitespace-nowrap">
                          <span>จำนวน</span>
                        </th>

                        {/* 6. จำนวนเงิน (บาท) (คลิก Sort ได้) */}
                        <th
                          onClick={() => handleSort('total_price')}
                          className="py-2.5 px-3.5 font-normal text-right cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามยอดเงิน"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>จำนวนเงิน (บาท)</span>
                            {renderSortIcon('total_price')}
                          </div>
                        </th>

                        {/* 7. สถานะการสั่งซื้อ (คลิก Sort ได้) */}
                        <th
                          onClick={() => handleSort('status')}
                          className="py-2.5 px-3.5 font-normal text-center cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามสถานะ"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>สถานะการสั่งซื้อ</span>
                            {renderSortIcon('status')}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#D3D3D3]/50">
                      {orders.map((ord) => {
                        const isPreorder = ord.reserve_flag === 'Y';
                        const requesterName = ord.fullname_th || ord.owner;

                        return (
                          <tr
                            key={ord.order_id || ord.order_no}
                            onClick={() => handleOpenOrderModal(ord)}
                            className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                          >
                            {/* คอลัมน์ Action ดูรายละเอียด (ไอคอน MdViewKanban) */}
                            <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenOrderModal(ord);
                                }}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                                title="ดูรายละเอียดคำสั่งซื้อ"
                              >
                                <MdViewKanban className="w-6 h-6" />
                              </button>
                            </td>

                            {/* 1. หมายเลขสั่งซื้อ */}
                            <td className="py-2.5 px-3.5 font-normal text-[#363636] whitespace-nowrap">
                              {ord.order_no || ord.order_id}
                            </td>

                            {/* 2. วันที่ทำรายการ */}
                            <td className="py-2.5 px-3.5 text-[#363636]/90 font-normal whitespace-nowrap">
                              {formatThaiDateTime(ord.order_date)}
                            </td>

                            {/* 3. ผู้สั่งซื้อ */}
                            <td className="py-2.5 px-3.5 font-normal text-[#363636] whitespace-nowrap" title={requesterName}>
                              {requesterName}
                            </td>

                            {/* 4. รูปแบบการสั่งซื้อ */}
                            <td className="py-2.5 px-3.5 font-normal text-center text-[#363636] whitespace-nowrap">
                              {isPreorder ? 'สั่งล่วงหน้า' : 'มาตรฐาน'}
                            </td>

                            {/* 5. จำนวน */}
                            <td className="py-2.5 px-3.5 font-normal text-center text-[#363636] whitespace-nowrap">
                              {ord.total_items}
                            </td>

                            {/* 6. จำนวนเงิน (บาท) */}
                            <td className="py-2.5 px-3.5 font-normal text-right text-[#363636] whitespace-nowrap">
                              ฿{ord.total_price.toLocaleString('th-TH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>

                            {/* 7. สถานะการสั่งซื้อ */}
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              {renderStatusPill(ord.status)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 4: แถบ Pagination ด้านล่าง
                ───────────────────────────────────────────────────────────── */}
            <div className="border-t border-[#D3D3D3] px-3 sm:px-4 py-2.5 flex items-center justify-between sm:justify-end gap-2 sm:gap-6 text-xs text-[#363636]/80 select-none bg-white shrink-0 flex-wrap sm:flex-nowrap">
              {/* Rows per page Selector */}
              <div className="flex items-center gap-2">
                <span className="font-normal text-[#363636]/70">Rows per page:</span>
                <div className="relative">
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-transparent text-xs font-normal text-[#363636] py-1 pl-2 pr-6 border-b border-stone-300 focus:outline-none cursor-pointer appearance-none"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <svg
                    className="w-3 h-3 text-stone-600 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              {/* Range Info: e.g. 1–10 of 16 */}
              <div className="font-normal text-[#363636]/90 min-w-[80px] text-center">
                {totalCount === 0 ? '0 of 0' : `${startIndex}–${endIndex} of ${totalCount}`}
              </div>

              {/* Navigation Buttons: |<  <  >  >| */}
              <div className="flex items-center gap-1">
                {/* First Page |< */}
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
                  title="หน้าแรกสุด"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>

                {/* Previous Page < */}
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Next Page > */}
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Last Page >| */}
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
                  title="หน้าสุดท้าย"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 5: Modal แสดงรายละเอียดคำสั่งซื้อ
          ───────────────────────────────────────────────────────────── */}
      {selectedOrderForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-300 max-w-2xl w-full max-h-[90vh] flex flex-col font-sans overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-[#D3D3D3] bg-white flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-base font-medium text-[#363636]">
                  รายละเอียดใบสั่งซื้อ: {selectedOrderForModal.order_no || selectedOrderForModal.order_id}
                </h3>
                <p className="text-xs text-[#363636]/60 mt-0.5">
                  วันที่สั่งซื้อ: {formatThaiDateTime(selectedOrderForModal.order_date)}
                </p>
              </div>

              {/* ป้ายสถานะมุมบนขวา */}
              <div className="shrink-0">
                {renderStatusPill(selectedOrderForModal.status)}
              </div>
            </div>

            {/* Body Modal */}
            <div className="p-6 space-y-4 text-xs sm:text-sm flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* ข้อมูลสรุป 6 ช่อง */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200 shrink-0">
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ร้านค้า</span>
                  <span className="text-xs font-medium text-[#363636]">{selectedOrderForModal.store_name}</span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ผู้สั่งซื้อ</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.fullname_th || selectedOrderForModal.owner}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ฝ่าย / แผนก</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.department_th || selectedOrderForModal.department || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">สถานที่จัดส่ง</span>
                  <span className="text-xs font-medium text-[#363636]">{selectedOrderForModal.shipping_location}</span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">รูปแบบการสั่งซื้อ</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.reserve_flag === 'Y' ? 'สั่งล่วงหน้า' : 'มาตรฐาน'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ยอดรวมสุทธิ</span>
                  {modalComputedTotals.hasAdjustments ? (
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-xs text-stone-400 line-through">
                          ฿{modalComputedTotals.originalTotalPrice.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-sm font-semibold text-[#1F6F78]">
                          ฿{modalComputedTotals.totalPrice.toLocaleString('th-TH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                    </div>
                  ) : (
                    <span className="text-sm font-medium text-[#363636]">
                      ฿{modalComputedTotals.totalPrice.toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* การ์ดตารางสินค้า */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h4 className="font-medium text-xs text-[#363636] uppercase">
                    รายการสินค้าที่สั่งซื้อ
                  </h4>
                  <span className="text-xs text-[#363636]/70 font-normal">
                    {modalItems.length} รายการ
                  </span>
                </div>
                <div className="border border-[#D3D3D3] rounded-lg overflow-x-auto overflow-y-auto flex-1 min-h-0">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 border-b border-[#D3D3D3] text-[11px] font-normal text-[#363636]/70 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 font-normal bg-stone-100 w-12 text-center">รูปภาพ</th>
                        <th className="py-2.5 px-3 font-normal bg-stone-100">ชื่อสินค้า</th>
                        <th className="py-2.5 px-3 font-normal text-center bg-stone-100 whitespace-nowrap">ราคาต่อหน่วย</th>
                        <th className="py-2.5 px-3 font-normal text-center bg-stone-100 whitespace-nowrap">จำนวน</th>
                        <th className="py-2.5 px-3 font-normal text-center bg-stone-100 whitespace-nowrap">หน่วย</th>
                        <th className="py-2.5 px-3 font-normal text-right bg-stone-100 whitespace-nowrap">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D3D3D3]/50">
                      {modalItems.map((item, idx) => {
                        const orderQty = Number(item.quantity_order ?? item.quantity ?? 1);
                        const isPrepared = item.quantity_sent !== null && item.quantity_sent !== undefined;
                        const sentQty = isPrepared ? Number(item.quantity_sent) : orderQty;
                        const isCancelled = isPrepared && sentQty === 0;
                        const isReduced = isPrepared && sentQty > 0 && sentQty < orderQty;

                        const returnQty = Number(item.quantity_return || 0);
                        const wasteQty = Number(item.quantity_waste || 0);
                        const lostQty = Number(item.quantity_lost || 0);
                        const isAwaitingReceipt = selectedOrderForModal.status === 'S';

                        const originalTotal = orderQty * item.price;
                        const deliveredTotal = sentQty * item.price;

                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${isCancelled ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-stone-50'}`}
                          >
                            {/* รูปภาพ */}
                            <td className="py-2.5 px-3 text-center w-12 align-middle">
                              <OrderItemThumbnail
                                thumbnail={item.product_thumbnail}
                                productName={item.product_name}
                              />
                            </td>

                            {/* ชื่อสินค้า */}
                            <td className="py-2.5 px-3 align-middle">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-normal ${isCancelled ? 'line-through text-stone-400' : 'text-[#363636]'}`}>
                                    {item.product_name}
                                  </span>
                                  {isAwaitingReceipt && isReduced && (
                                    <span className="text-[11px] font-medium text-amber-700 whitespace-nowrap">
                                      (ปรับยอดจัดส่ง)
                                    </span>
                                  )}
                                  {isAwaitingReceipt && isCancelled && (
                                    <span className="text-[11px] font-medium text-rose-600 whitespace-nowrap">
                                      (ไม่จัดส่ง)
                                    </span>
                                  )}
                                </div>

                                {/* ป้ายสถานะการคืนคลัง, ชำรุด และ สูญหาย (แสดงเฉพาะสถานะรอยืนยันการรับสินค้า) */}
                                {isAwaitingReceipt && (returnQty > 0 || wasteQty > 0 || lostQty > 0) && (
                                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-0.5">
                                    {returnQty > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-normal whitespace-nowrap shadow-2xs">
                                        <span>↩</span>
                                        <span>คืนคลัง {returnQty} {item.uom || 'ชิ้น'}</span>
                                      </span>
                                    )}
                                    {wasteQty > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 font-normal whitespace-nowrap shadow-2xs">
                                        <span>⚠</span>
                                        <span>ชำรุด {wasteQty} {item.uom || 'ชิ้น'}</span>
                                      </span>
                                    )}
                                    {lostQty > 0 && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-normal whitespace-nowrap shadow-2xs">
                                        <span>⚠</span>
                                        <span>สูญหาย {lostQty} {item.uom || 'ชิ้น'}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* ราคาต่อหน่วย */}
                            <td className="py-2.5 px-3 text-center font-normal text-[#363636] align-middle whitespace-nowrap">
                              ฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            {/* จำนวน */}
                            <td className="py-2.5 px-3 text-center align-middle whitespace-nowrap">
                              {isCancelled ? (
                                <div className="inline-flex flex-col items-center justify-center leading-tight">
                                  <span className="font-semibold text-rose-600 text-xs">0</span>
                                  <span className="line-through text-stone-400 text-[10.5px]">{orderQty}</span>
                                </div>
                              ) : isReduced ? (
                                <div className="inline-flex flex-col items-center justify-center leading-tight">
                                  <span className="font-semibold text-[#1F6F78] text-xs">{sentQty}</span>
                                  <span className="line-through text-stone-400 text-[10.5px]">{orderQty}</span>
                                </div>
                              ) : (
                                <span className="font-normal text-[#363636]">{orderQty}</span>
                              )}
                            </td>

                            {/* หน่วย */}
                            <td className="py-2.5 px-3 text-center font-normal text-[#363636] align-middle whitespace-nowrap">
                              {item.uom || 'ชิ้น'}
                            </td>

                            {/* จำนวนเงิน (บาท) */}
                            <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                              {isCancelled ? (
                                <div className="inline-flex flex-col items-end justify-center leading-tight">
                                  <span className="font-semibold text-stone-400 text-xs">฿0.00</span>
                                  <span className="line-through text-stone-400 text-[10.5px]">
                                    ฿{originalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ) : isReduced ? (
                                <div className="inline-flex flex-col items-end justify-center leading-tight">
                                  <span className="font-semibold text-[#1F6F78] text-xs">
                                    ฿{deliveredTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span className="line-through text-stone-400 text-[10.5px]">
                                    ฿{originalTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-normal text-[#363636]">
                                  ฿{deliveredTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ข้อมูลการปฏิเสธหรือยกเลิกคำสั่งซื้อ (Activity Log Style) */}
              {selectedOrderForModal.remark && (
                <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 shrink-0 mt-3 space-y-1.5 text-xs font-sans">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-stone-900">
                      <span className="font-semibold">
                        {selectedOrderForModal.response_by_name || selectedOrderForModal.response_by || 'ผู้ดำเนินการ'}
                      </span>{' '}
                      <span className="font-normal text-stone-500">
                        -
                      </span>{' '}
                      <span className="font-normal text-stone-700">
                        {selectedOrderForModal.status === 'R'
                          ? 'ปฏิเสธคำขอ'
                          : selectedOrderForModal.status === 'C'
                          ? 'ยกเลิกคำขอ'
                          : 'บันทึกหมายเหตุ'}
                      </span>
                    </div>
                    <span className="text-stone-500 font-normal shrink-0 text-[11px] sm:text-xs">
                      {formatThaiDateTime(selectedOrderForModal.response_date)}
                    </span>
                  </div>

                  <div className="flex items-start gap-1.5 text-stone-700 font-normal">
                    <RiChat1Line className="w-4 h-4 mt-0.5 shrink-0 text-stone-500" />
                    <span className="break-words leading-relaxed text-stone-900">
                      {(selectedOrderForModal.remark || '').replace(/^(Rejected|Cancelled):\s*/i, '')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal: ปุ่มยกเลิกคำสั่งซื้อและปิดหน้าต่าง */}
            <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2 shrink-0">
              {/* ปุ่มฝั่งซ้าย: ยกเลิกคำสั่งซื้อ (เฉพาะสถานะรออนุมัติ - สไตล์ A สีแดงทึบ) */}
              <div>
                {isOrderEditable(selectedOrderForModal.status) && (
                  <button
                    type="button"
                    onClick={openCancelModal}
                    className="px-4 py-2 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] text-white text-xs font-medium rounded-md shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RiCloseCircleLine className="w-4 h-4 shrink-0" />
                    <span>ยกเลิกคำสั่งซื้อ</span>
                  </button>
                )}
              </div>

              {/* ปุ่มฝั่งขวา: ปิดหน้าต่าง (สไตล์ B) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeOrderModal}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <RiCloseLine className="w-4 h-4 shrink-0 text-stone-500" />
                  <span>ปิดหน้าต่าง</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 6: Modal ยืนยันการยกเลิกคำสั่งซื้อ
          ───────────────────────────────────────────────────────────── */}
      {showCancelModal && selectedOrderForModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 font-sans">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                ยืนยันการยกเลิกคำสั่งซื้อ
              </h4>
              <p className="text-xs text-stone-600 mt-1.5">
                คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อหมายเลข{' '}
                <strong className="text-stone-900 font-semibold">
                  {selectedOrderForModal.order_no || selectedOrderForModal.order_id}
                </strong>
                ?
              </p>
            </div>

            <div>
              <label className="text-xs text-stone-700 font-medium block mb-1.5">
                เหตุผลในการยกเลิก <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCancelReason}
                  onChange={(e) => setSelectedCancelReason(e.target.value)}
                  className="w-full h-9.5 px-3 text-xs text-stone-900 bg-white border border-stone-300 rounded-md focus:border-red-500 focus:ring-1 focus:ring-red-500/50 focus:outline-none transition-colors cursor-pointer appearance-none pr-8 font-normal"
                >
                  <option value="" disabled>
                    -- เลือกเหตุผลในการยกเลิก --
                  </option>
                  {CANCEL_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-stone-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* แสดงช่องกรอกเพิ่มเติมเฉพาะเมื่อเลือก อื่นๆ */}
              {selectedCancelReason === 'อื่นๆ (ระบุเพิ่มเติม)' && (
                <div className="mt-2.5 animate-fadeIn">
                  <textarea
                    value={customCancelRemark}
                    onChange={(e) => setCustomCancelRemark(e.target.value)}
                    placeholder="ระบุเหตุผลเพิ่มเติม..."
                    rows={2}
                    className="w-full p-2.5 text-xs text-stone-900 bg-white border border-stone-300 rounded-md focus:border-red-500 focus:ring-1 focus:ring-red-500/50 focus:outline-none transition-colors resize-none font-normal"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={isCancellingOrder}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RiArrowGoBackLine className="w-4 h-4 shrink-0 text-stone-500" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                disabled={
                  isCancellingOrder ||
                  !selectedCancelReason ||
                  (selectedCancelReason === 'อื่นๆ (ระบุเพิ่มเติม)' && !customCancelRemark.trim())
                }
                className="px-4 py-2 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] text-white text-xs font-medium rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <RiCloseCircleLine className="w-4 h-4 shrink-0" />
                <span>{isCancellingOrder ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
