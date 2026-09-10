// src/app/store-management/preparation/page.js
'use client';

/**
 * =========================================================================
 * Page: หน้ารายการจัดเตรียมสินค้าของร้านค้า (Store Preparation Orders Page)
 * Route: /store-management/preparation
 * =========================================================================
 * สถาปัตยกรรม & การทำงาน:
 * 1. ฟอนต์ Kanit 100% ทั้งหน้า
 * 2. โครงสร้าง UI และเลย์เอาต์ตามแบบหน้า "รายการรออนุมัติ" (/approvals) และ "คำสั่งซื้อ" (/orders)
 * 3. แสดงเฉพาะรายการที่อยู่ในสถานะ "กำลังเตรียมสินค้า" (Status 'X' / PREPARING)
 * 4. คุมธีมสี สะอาด คลีน เรียบง่าย ไม่แสดงข้อมูลรกรุงรัง
 * 5. กล่องค้นหาแบบ Single Search Bar ปุ่มเสถียร (Wobble-Free Search Button)
 * 6. ตารางแสดงรายการจัดเตรียมสินค้า พร้อม Sticky Header และ Action Icon (MdViewKanban)
 * 7. รองรับ Server-Side Pagination (Rows per page, Range, |< < > >|) & Sorting
 * 8. Modal แสดงรายละเอียดใบสั่งซื้อ พร้อมโหมด "จัดเตรียมสินค้า" (Preparation Mode):
 *    - ปุ่มเริ่มจัดเตรียมสินค้า (ธีมสีเข้ม #2B2F38)
 *    - ปรับจำนวนสินค้าใน Dropdown (จำนวนเดิม ถอยลงถึง 1)
 *    - ขีดฆ่าจำนวนเดิมเมื่อตัวเลขเปลี่ยน (~6~ 4)
 *    - ปุ่ม Action รายแถว: [ยืนยัน] (#2e7d32) และ [ยกเลิก] (#d32f2f)
 *    - เมื่อกดยืนยัน แสดงข้อความ "ยืนยันแล้ว" สีเขียว พร้อมปุ่ม [แก้ไข]
 *    - เมื่อกดยกเลิก แสดงข้อความ "ยกเลิก" สีแดง พร้อมปุ่ม [แก้ไข]
 *    - Pop-up ระบุเหตุผลการยกเลิกแบบ Select Dropdown เรียบง่าย สไตล์เดียวกับหน้ารายการรออนุมัติ
 *    - ปุ่ม "ยืนยันการจัดเตรียมสินค้า" ด้านล่างถูก Disable จนกว่าจะดำเนินการครบทุกแถว
 * =========================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useStorePreparationStore, STORE_CANCEL_REASONS } from '@/app/stores/useStorePreparationStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { getThumbnailUrl, formatThaiDateTime } from '@/app/lib/utils';
import { MdViewKanban } from 'react-icons/md';
import {
  RiImageLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiShoppingBag3Line,
  RiCheckLine,
  RiCloseLine,
  RiArrowGoBackLine,
  RiCloseCircleLine,
} from 'react-icons/ri';

/**
 * OrderItemThumbnail: แสดงรูปภาพสินค้าขนาดย่อพร้อม Fallback
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
        alt={productName || ''}
        onError={() => setImageError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export default function StorePreparationPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const { showSuccess, showError } = useToastStore();

  const currentStore = useStoreManagementStore((state) => state.currentStore);
  const storeId = currentStore?.store_id;

  const {
    orders,
    totalCount,
    page,
    rowsPerPage,
    loading,
    error,
    searchInput,
    appliedSearch,
    sortBy,
    sortOrder,
    selectedOrderForModal,
    isPreparationMode,
    isSubmitting,
    itemsPrepState,
    allocationModalItemKey,
    allocationForm,
    showConfirmSubmitModal,
    fetchPreparingOrders,
    setPage,
    setRowsPerPage,
    setSearchInput,
    applySearch,
    clearSearch,
    toggleSort,
    openOrderModal,
    closeOrderModal,
    startPreparation,
    cancelPreparation,
    openAllocationModal,
    closeAllocationModal,
    setAllocationFormField,
    incrementAllocationField,
    decrementAllocationField,
    setClampedAllocationField,
    applyAllocation,
    cancelItemDirect,
    openConfirmSubmitModal,
    closeConfirmSubmitModal,
    submitPreparation,
    showCancelOrderModal,
    selectedCancelReason,
    customCancelRemark,
    isCancellingOrder,
    openCancelOrderModal,
    closeCancelOrderModal,
    setSelectedCancelReason,
    setCustomCancelRemark,
    cancelOrder,
  } = useStorePreparationStore();

  // โหลดรายการคำสั่งซื้อที่ต้องจัดเตรียมเมื่อ Token หรือ storeId พร้อม
  useEffect(() => {
    if (token && storeId) {
      fetchPreparingOrders(token, storeId);
    }
  }, [token, storeId, fetchPreparingOrders]);

  // คำนวณช่วงแถวปัจจุบันของหน้า (Pagination Info: e.g. 1–10 of 16)
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  // รวมสินค้าทุกล๊อตเข้าด้วยกันสำหรับแสดงผลใน Modal ของร้านค้า
  const modalItems = useMemo(() => {
    if (!selectedOrderForModal?.items) return [];
    const map = new Map();
    for (const item of selectedOrderForModal.items) {
      const key = item.product_id || item.product_name;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity = (existing.quantity || 0) + Number(item.quantity || 0);
        existing.quantity_order = (existing.quantity_order || 0) + Number(item.quantity_order || item.quantity || 0);
        existing.item_total = (existing.item_total || 0) + Number(item.item_total || 0);
        if (item.quantity_sent != null) {
          existing.quantity_sent = (existing.quantity_sent || 0) + Number(item.quantity_sent);
        }
        if (item.remark) {
          existing.remark = existing.remark ? `${existing.remark}, ${item.remark}` : item.remark;
        }
        if ((!existing.location_name || existing.location_name === '-') && item.location_name && item.location_name !== '-') {
          existing.location_name = item.location_name;
        }
      } else {
        map.set(key, {
          ...item,
          quantity: Number(item.quantity || 0),
          quantity_order: Number(item.quantity_order || item.quantity || 0),
          quantity_sent: item.quantity_sent != null ? Number(item.quantity_sent) : null,
          remark: item.remark || null,
        });
      }
    }
    return Array.from(map.values());
  }, [selectedOrderForModal]);

  // ตรวจสอบว่าดำเนินการครบทุกแถวหรือยัง
  const isAllActionCompleted = useMemo(() => {
    const total = modalItems.length;
    if (total === 0) return false;
    return modalItems.every((item) => {
      const key = item.product_id || item.item_id;
      const prep = itemsPrepState[key];
      return prep && (prep.action === 'CONFIRMED' || prep.action === 'CANCELLED');
    });
  }, [modalItems, itemsPrepState]);

  // ตรวจสอบว่าทุกรายการถูกยกเลิก (ยอดส่งเป็น 0 ทุกรายการ) หรือไม่
  const isAllItemsCancelled = useMemo(() => {
    const total = modalItems.length;
    if (total === 0) return false;
    return modalItems.every((item) => {
      const key = item.product_id || item.item_id;
      const prep = itemsPrepState[key];
      return prep && (prep.action === 'CANCELLED' || Number(prep.quantity_sent || 0) === 0);
    });
  }, [modalItems, itemsPrepState]);

  // ส่งคำค้นหา
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    applySearch(searchInput, token, storeId);
  };

  // ล้างคำค้นหา
  const handleClearSearch = () => {
    clearSearch(token, storeId);
  };

  // เรียงลำดับคอลัมน์
  const handleSort = (field) => {
    toggleSort(field, token, storeId);
  };

  // รีเฟรชข้อมูล
  const handleRefresh = () => {
    if (token && storeId) {
      fetchPreparingOrders(token, storeId);
    }
  };

  // ส่งผลการจัดเตรียมไปยัง Backend
  const handleConfirmSubmitPreparation = async () => {
    const res = await submitPreparation(token, storeId);
    if (res.success) {
      showSuccess(res.message);
    } else {
      showError(res.error || 'เกิดข้อผิดพลาดในการบันทึกการจัดเตรียมสินค้า');
    }
  };

  // ดำเนินการยกเลิกคำสั่งซื้อของร้านค้า
  const handleConfirmCancelOrder = async () => {
    const res = await cancelOrder(token, storeId);
    if (res.success) {
      showSuccess(res.message);
    } else {
      showError(res.error || 'เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ');
    }
  };

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

  // กรณีผู้ใช้เข้ามาโดยยังไม่ได้เลือกร้านค้า
  if (!currentStore) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiStore2Line className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#2B2F38]">ยังไม่ได้เลือกร้านค้าที่ต้องการจัดการ</h3>
        <p className="text-xs text-[#363636]/70 mt-1 mb-5 max-w-sm">
          กรุณาเลือกร้านค้าจากหน้ารวมร้านค้าเพื่อดูรายการจัดเตรียมสินค้า
        </p>
        <Link
          href="/store-management"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2B2F38] hover:bg-[#1E2229] text-white text-xs font-medium rounded-md transition-colors shadow-xs"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          <span>กลับไปหน้ารวมร้านค้า</span>
        </Link>
      </div>
    );
  }

  // หาข้อมูลสินค้าที่กำลังถูกเปิดใน Modal จัดสรร
  const allocatingItem = modalItems.find(
    (item) => (item.product_id || item.item_id) === allocationModalItemKey
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มรีเฟรช (Pinned Header สไตล์ Approvals)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              รายการรอจัดเตรียมสินค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            ตรวจสอบและจัดเตรียมสินค้าตามคำสั่งซื้อของร้านค้า ({totalCount} รายการ)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
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
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: ช่องค้นหา (Single Search Bar ปุ่มเสถียร ไม่ดุกดิก)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาหมายเลขใบสั่งซื้อ, ผู้สั่งซื้อ หรือสินค้า..."
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
          ส่วนที่ 3: ตารางรายการคำสั่งซื้อรอจัดเตรียม
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {loading && orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#363636]/60">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-[#363636]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            กำลังโหลดรายการคำสั่งซื้อที่ต้องจัดเตรียม...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-red-600 bg-red-50/50">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#363636]/60">
            {appliedSearch
              ? `ไม่พบรายการคำสั่งซื้อที่ตรงกับ "${appliedSearch}"`
              : 'ขณะนี้ไม่มีรายการคำสั่งซื้อที่ต้องจัดเตรียมสำหรับร้านค้านี้'}
          </div>
        ) : (
          <div
            style={{ maxHeight: 'calc(100dvh - 300px)' }}
            className="overflow-x-auto overflow-y-auto"
          >
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
                <tr>
                  {/* คอลัมน์ Action ดูรายละเอียด */}
                  <th className="py-2.5 px-2.5 font-normal text-center bg-white w-10"></th>

                  {/* 1. หมายเลขสั่งซื้อ */}
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

                  {/* 2. วันที่ทำรายการ */}
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

                  {/* 4. รูปแบบการสั่งซื้อ */}
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

                  {/* 6. จำนวนเงิน (บาท) */}
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
                </tr>
              </thead>

              <tbody className="divide-y divide-[#D3D3D3]/50 bg-white text-xs sm:text-sm">
                {orders.map((row) => {
                  const customerName = row.fullname_th || row.fullname || row.owner;
                  const isPreorder = row.reserve_flag === 'Y' || row.reserve_flag === true || row.reserve_flag === '1';

                  return (
                    <tr
                      key={row.order_id || row.order_no}
                      onClick={() => openOrderModal(row)}
                      className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                    >
                      {/* คอลัมน์ Action ดูรายละเอียด (ไอคอน MdViewKanban) */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderModal(row);
                          }}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                          title="ดูรายละเอียดใบสั่งซื้อ"
                        >
                          <MdViewKanban className="w-6 h-6" />
                        </button>
                      </td>

                      {/* 1. หมายเลขสั่งซื้อ */}
                      <td className="py-2.5 px-3.5 font-normal text-[#363636] whitespace-nowrap">
                        {row.order_no}
                      </td>

                      {/* 2. วันที่ทำรายการ */}
                      <td className="py-2.5 px-3.5 text-[#363636]/90 font-normal whitespace-nowrap">
                        {formatThaiDateTime(row.order_date)}
                      </td>

                      {/* 3. ผู้สั่งซื้อ */}
                      <td className="py-2.5 px-3.5 font-normal text-[#363636] whitespace-nowrap" title={customerName}>
                        {customerName}
                      </td>

                      {/* 4. รูปแบบการสั่งซื้อ */}
                      <td className="py-2.5 px-3.5 font-normal text-center text-[#363636] whitespace-nowrap">
                        {isPreorder ? 'สั่งล่วงหน้า' : 'มาตรฐาน'}
                      </td>

                      {/* 5. จำนวน */}
                      <td className="py-2.5 px-3 font-normal text-center text-[#363636] whitespace-nowrap">
                        {row.total_items}
                      </td>

                      {/* 6. จำนวนเงิน (บาท) */}
                      <td className="py-2.5 px-3.5 font-normal text-right text-[#363636] whitespace-nowrap">
                        ฿{row.total_price.toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
      <div className="border-t border-[#D3D3D3] px-4 py-2.5 flex items-center justify-end gap-6 text-xs text-[#363636]/80 select-none bg-white shrink-0">
        {/* Rows per page Selector */}
        <div className="flex items-center gap-2">
          <span className="font-normal text-[#363636]/70">Rows per page:</span>
          <div className="relative">
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value), token, storeId)}
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
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Range text */}
        <span className="font-normal text-[#363636]/70">
          {startIndex}–{endIndex} of {totalCount}
        </span>

        {/* Page Nav Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1, token, storeId)}
            disabled={page <= 1}
            className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
            title="หน้าแรก"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1), token, storeId)}
            disabled={page <= 1}
            className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
            title="หน้าก่อนหน้า"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1), token, storeId)}
            disabled={page >= totalPages}
            className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
            title="หน้าถัดไป"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setPage(totalPages, token, storeId)}
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

      {/* ─────────────────────────────────────────────────────────────
          Modal: ดูรายละเอียดใบสั่งซื้อ พร้อมโหมดจัดเตรียมสินค้า
          ───────────────────────────────────────────────────────────── */}
      {selectedOrderForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-fadeIn">
          <div
            className={`bg-white rounded-lg shadow-2xl border border-stone-300 w-full ${
              isPreparationMode ? 'max-w-4xl' : 'max-w-2xl'
            } max-h-[90vh] flex flex-col font-sans overflow-hidden transition-all`}
          >
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-[#D3D3D3] bg-white flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-base font-medium text-[#363636]">
                  รายละเอียดใบสั่งซื้อ: {selectedOrderForModal.order_no}
                </h3>
                <p className="text-xs text-[#363636]/60 mt-0.5">
                  วันที่สั่งซื้อ: {formatThaiDateTime(selectedOrderForModal.order_date)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeOrderModal}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-6 space-y-4 text-xs sm:text-sm flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* ข้อมูลสรุป 6 ช่อง */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200 shrink-0">
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ร้านค้า</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.store_name || currentStore?.store_name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ผู้สั่งซื้อ</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.fullname_th || selectedOrderForModal.fullname || selectedOrderForModal.owner}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ฝ่าย / แผนก</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.department_th || selectedOrderForModal.department || selectedOrderForModal.owner_department_th || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">สถานที่จัดส่ง</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedOrderForModal.shipping_location || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">รูปแบบการสั่งซื้อ</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {(selectedOrderForModal.reserve_flag === 'Y' || selectedOrderForModal.reserve_flag === true || selectedOrderForModal.reserve_flag === '1') ? 'สั่งล่วงหน้า' : 'มาตรฐาน'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ยอดรวมสุทธิ</span>
                  <span className="text-sm font-medium text-[#363636]">
                    ฿{selectedOrderForModal.total_price.toLocaleString('th-TH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* การ์ดตารางสินค้า */}
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h4 className="font-medium text-xs text-[#363636] uppercase">
                    รายการสินค้าที่ต้องจัดเตรียม
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
                        <th className="py-2.5 px-3 font-normal bg-stone-100">ที่จัดเก็บ</th>
                        {isPreparationMode ? (
                          <>
                            <th className="py-2.5 px-2 font-normal text-center bg-stone-100 w-14">สั่ง</th>
                            <th className="py-2.5 px-2 font-normal text-center bg-stone-100 w-14">ส่งจริง</th>
                            <th className="py-2.5 px-2 font-normal text-center bg-stone-100 w-14">คืนคลัง</th>
                            <th className="py-2.5 px-2 font-normal text-center bg-stone-100 w-14">ชำรุด</th>
                            <th className="py-2.5 px-2 font-normal text-center bg-stone-100 w-14">สูญหาย</th>
                            <th className="py-2.5 px-2 font-normal text-center bg-stone-100 w-12">หน่วย</th>
                            <th className="py-2.5 px-3 font-normal text-center bg-stone-100 min-w-[130px]">
                              การดำเนินการ
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="py-2.5 px-3 font-normal text-center bg-stone-100 min-w-[80px]">จำนวน</th>
                            <th className="py-2.5 px-3 font-normal text-center bg-stone-100 w-16">หน่วย</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D3D3D3]/50">
                      {modalItems.map((item, idx) => {
                        const key = item.product_id || item.item_id;
                        const prep = itemsPrepState[key];
                        const orderQty = Number(item.quantity_order || item.quantity || 1);

                        return (
                          <tr key={idx} className="hover:bg-stone-50 transition-colors">
                            {/* รูปภาพ */}
                            <td className="py-2.5 px-3 text-center w-12">
                              <OrderItemThumbnail
                                thumbnail={item.product_thumbnail}
                                productName={item.product_name}
                              />
                            </td>

                            {/* ชื่อสินค้า */}
                            <td className="py-2.5 px-3">
                              <p className="font-normal text-xs text-[#363636] line-clamp-2 leading-relaxed">
                                {item.product_name}
                              </p>
                            </td>

                            {/* ที่จัดเก็บ */}
                            <td className="py-2.5 px-3 font-normal text-xs text-[#363636]">
                              {item.location_name || '-'}
                            </td>

                            {isPreparationMode ? (
                              <>
                                {/* 1. สั่ง */}
                                <td className="py-2.5 px-2 text-center text-xs font-semibold text-[#363636]">
                                  {orderQty}
                                </td>

                                {/* 2. ส่งจริง */}
                                <td className="py-2.5 px-2 text-center text-xs">
                                  {!prep || prep.action === 'PENDING' ? (
                                    <span className="text-stone-400 font-normal">-</span>
                                  ) : (
                                    <span className={`font-semibold ${prep.quantity_sent === 0 ? 'text-[#d32f2f]' : 'text-[#1F6F78]'}`}>
                                      {prep.quantity_sent}
                                    </span>
                                  )}
                                </td>

                                {/* 3. คืนคลัง */}
                                <td className="py-2.5 px-2 text-center text-xs">
                                  {!prep || prep.action === 'PENDING' ? (
                                    <span className="text-stone-400 font-normal">-</span>
                                  ) : prep.quantity_return > 0 ? (
                                    <span className="font-semibold text-[#4D7C55]">
                                      {prep.quantity_return}
                                    </span>
                                  ) : (
                                    <span className="text-stone-400">0</span>
                                  )}
                                </td>

                                {/* 4. ชำรุด */}
                                <td className="py-2.5 px-2 text-center text-xs">
                                  {!prep || prep.action === 'PENDING' ? (
                                    <span className="text-stone-400 font-normal">-</span>
                                  ) : prep.quantity_waste > 0 ? (
                                    <span className="font-semibold text-[#E05A47]">
                                      {prep.quantity_waste}
                                    </span>
                                  ) : (
                                    <span className="text-stone-400">0</span>
                                  )}
                                </td>

                                {/* 5. สูญหาย */}
                                <td className="py-2.5 px-2 text-center text-xs">
                                  {!prep || prep.action === 'PENDING' ? (
                                    <span className="text-stone-400 font-normal">-</span>
                                  ) : prep.quantity_lost > 0 ? (
                                    <span className="font-semibold text-[#E67E22]">
                                      {prep.quantity_lost}
                                    </span>
                                  ) : (
                                    <span className="text-stone-400">0</span>
                                  )}
                                </td>

                                {/* หน่วย */}
                                <td className="py-2.5 px-2 text-center text-xs font-normal text-[#363636]">
                                  {item.uom || 'ชิ้น'}
                                </td>

                                {/* การดำเนินการ */}
                                <td className="py-2.5 px-3 text-center">
                                  {!prep || prep.action === 'PENDING' ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openAllocationModal(key)}
                                        className="px-2.5 py-1 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white text-xs font-normal rounded shadow-2xs transition-colors cursor-pointer"
                                      >
                                        จัดเตรียม
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => cancelItemDirect(key)}
                                        className="px-2.5 py-1 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] text-white text-xs font-normal rounded shadow-2xs transition-colors cursor-pointer"
                                      >
                                        ยกเลิกรายการ
                                      </button>
                                    </div>
                                  ) : prep.action === 'CONFIRMED' ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="text-xs font-medium text-[#2e7d32]">
                                        {prep.quantity_sent === prep.original_quantity ? 'ครบตามสั่ง' : 'จัดเตรียมแล้ว'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openAllocationModal(key)}
                                        className="text-xs text-[#363636]/60 hover:text-[#2B2F38] underline cursor-pointer"
                                      >
                                        แก้ไข
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="text-xs font-medium text-[#d32f2f]">
                                        ยกเลิกแล้ว
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openAllocationModal(key)}
                                        className="text-xs text-[#363636]/60 hover:text-[#2B2F38] underline cursor-pointer"
                                      >
                                        แก้ไข
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                {/* มุมมองปกติ (ยังไม่เข้าโหมดจัดเตรียม) */}
                                <td className="py-2.5 px-3 text-center text-xs font-normal text-[#363636]">
                                  {item.quantity_sent != null && item.quantity_sent !== orderQty ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="line-through text-stone-400 text-xs">{orderQty}</span>
                                      <span className={`font-semibold ${item.quantity_sent === 0 ? 'text-[#d32f2f]' : 'text-[#2e7d32]'}`}>
                                        {item.quantity_sent}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>{item.quantity || orderQty}</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center text-xs font-normal text-[#363636]">
                                  {item.uom || 'ชิ้น'}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0 flex-wrap sm:flex-nowrap">
              {isPreparationMode ? (
                /* แถบปุ่มในโหมดจัดเตรียมสินค้า */
                <>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={cancelPreparation}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <RiArrowGoBackLine className="w-4 h-4 shrink-0 text-stone-500" />
                      <span>ยกเลิกการจัดเตรียม</span>
                    </button>

                    {isAllActionCompleted && isAllItemsCancelled && (
                      <span className="text-xs text-rose-600 flex items-center gap-1 font-normal animate-fadeIn">
                        <span>⚠</span>
                        <span>ยกเลิกครบทุกรายการ (ยอดส่งเป็น 0) ไม่สามารถกดยืนยันจัดเตรียมได้</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!isAllActionCompleted || isAllItemsCancelled || isSubmitting}
                    onClick={openConfirmSubmitModal}
                    title={isAllItemsCancelled ? 'ไม่สามารถจัดเตรียมได้เนื่องจากยกเลิกครบทุกรายการ' : undefined}
                    className="px-5 py-2 bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#144717] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RiCheckLine className="w-4 h-4 shrink-0" />
                    <span>ยืนยันการจัดเตรียมสินค้า</span>
                  </button>
                </>
              ) : (
                /* แถบปุ่มในโหมดดูรายละเอียดปกติ */
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startPreparation(modalItems)}
                      className="px-4 py-2 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white text-xs font-medium rounded-md shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RiShoppingBag3Line className="w-4 h-4 text-white" />
                      <span>จัดเตรียมสินค้า</span>
                    </button>

                    <button
                      type="button"
                      onClick={openCancelOrderModal}
                      className="px-4 py-2 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] text-white text-xs font-medium rounded-md shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RiCloseCircleLine className="w-4 h-4 shrink-0" />
                      <span>ยกเลิกรายการ</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeOrderModal}
                    className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <RiCloseLine className="w-4 h-4 shrink-0 text-stone-500" />
                    <span>ปิดหน้าต่าง</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Sub-Modal 1: Allocation Stepper Modal ตามแบบรูป Mockup
          ───────────────────────────────────────────────────────────── */}
      {allocationModalItemKey && allocatingItem && (() => {
        const origQty = Number(allocatingItem.quantity_order ?? allocatingItem.quantity ?? 1);
        const sent = Number(allocationForm.quantity_sent || 0);
        const wst = Number(allocationForm.quantity_waste || 0);
        const lost = Number(allocationForm.quantity_lost || 0);
        const ret = Number(allocationForm.quantity_return || 0);
        const totalAllocated = sent + wst + lost + ret;
        const remaining = Math.max(0, origQty - totalAllocated);
        const isPointComplete = totalAllocated >= origQty;
        const canSave = totalAllocated === origQty;

        const pctSent = origQty > 0 ? (sent / origQty) * 100 : 0;
        const pctWst = origQty > 0 ? (wst / origQty) * 100 : 0;
        const pctLost = origQty > 0 ? (lost / origQty) * 100 : 0;
        const pctRet = origQty > 0 ? (ret / origQty) * 100 : 0;

        const isPreorder = selectedOrderForModal?.reserve_flag === 'Y';

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/55 animate-fadeIn font-sans">
            <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[95vh] overflow-y-auto">
              
              {/* ส่วนหัว: ชื่อสินค้า และยอดสั่งซื้อทั้งหมด */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 line-clamp-2 leading-snug">
                    {allocatingItem.product_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    คำสั่งซื้อ #{selectedOrderForModal.order_no} 
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-black text-slate-900 leading-none">
                    {origQty}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    สั่งซื้อทั้งหมด ({allocatingItem.uom || 'ชิ้น'})
                  </div>
                </div>
              </div>

              {isPreorder && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <strong>รายการสั่งล่วงหน้า :</strong>  
                  <div>รายการนี้ไม่มีสต็อกในคลัง ระบบจะไม่สร้าง Transaction คืนสต็อกหรือของเสีย</div>
                </div>
              )}

              <hr className="border-slate-100 my-1" />

              {/* Progress Bar แสดงสัดส่วนยอดการจัดสรร */}
              <div className="space-y-2">
                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  {pctSent > 0 && (
                    <div
                      style={{ width: `${pctSent}%` }}
                      className="bg-[#1F6F78] transition-all duration-150"
                      title={`ส่งจริง: ${sent}`}
                    />
                  )}
                  {pctWst > 0 && (
                    <div
                      style={{ width: `${pctWst}%` }}
                      className="bg-[#E05A47] transition-all duration-150"
                      title={`ชำรุด: ${wst}`}
                    />
                  )}
                  {pctLost > 0 && (
                    <div
                      style={{ width: `${pctLost}%` }}
                      className="bg-[#E67E22] transition-all duration-150"
                      title={`สูญหาย: ${lost}`}
                    />
                  )}
                  {pctRet > 0 && (
                    <div
                      style={{ width: `${pctRet}%` }}
                      className="bg-[#4D7C55] transition-all duration-150"
                      title={`คืนคลัง: ${ret}`}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    จัดเตรียมแล้ว <strong className="font-bold text-slate-800">{totalAllocated}</strong> {allocatingItem.uom || 'ชิ้น'}
                  </span>
                  <span>
                    เหลือ <strong className="font-bold text-slate-800">{remaining}</strong> {allocatingItem.uom || 'ชิ้น'}
                  </span>
                </div>
              </div>

              {/* รายการการ์ด Stepper 4 ส่วน */}
              <div className="space-y-3 pt-1">
                {/* 1. ส่งจริง */}
                <div className="border border-slate-200 rounded-xl p-3 sm:p-3.5 flex items-center justify-between hover:border-slate-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center gap-2.5 pr-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1F6F78] shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        ส่งจริง
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        จัดเตรียมสำเร็จพร้อมส่งถึงลูกค้า
                      </div>
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementAllocationField('quantity_sent')}
                      disabled={sent <= 0}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title="ลดจำนวน"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={sent}
                      onChange={(e) => setClampedAllocationField('quantity_sent', e.target.value)}
                      className="w-14 h-8 text-center text-sm font-bold text-slate-800 focus:outline-none border-x border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => incrementAllocationField('quantity_sent')}
                      disabled={isPointComplete}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title={isPointComplete ? 'จัดสรรครบตามยอดสั่งซื้อแล้ว' : 'เพิ่มจำนวน'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 2. ชำรุด */}
                <div className="border border-slate-200 rounded-xl p-3 sm:p-3.5 flex items-center justify-between hover:border-slate-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center gap-2.5 pr-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E05A47] shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        ชำรุด
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ชำรุดเสียหายระหว่างการจัดเตรียม 
                      </div>
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementAllocationField('quantity_waste')}
                      disabled={wst <= 0}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title="ลดจำนวน"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={wst}
                      onChange={(e) => setClampedAllocationField('quantity_waste', e.target.value)}
                      className="w-14 h-8 text-center text-sm font-bold text-slate-800 focus:outline-none border-x border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => incrementAllocationField('quantity_waste')}
                      disabled={isPointComplete}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title={isPointComplete ? 'จัดสรรครบตามยอดสั่งซื้อแล้ว' : 'เพิ่มจำนวน'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. สูญหาย */}
                <div className="border border-slate-200 rounded-xl p-3 sm:p-3.5 flex items-center justify-between hover:border-slate-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center gap-2.5 pr-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E67E22] shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        สูญหาย
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        หาของไม่พบระหว่างการจัดเตรียม
                      </div>
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementAllocationField('quantity_lost')}
                      disabled={lost <= 0}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title="ลดจำนวน"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={lost}
                      onChange={(e) => setClampedAllocationField('quantity_lost', e.target.value)}
                      className="w-14 h-8 text-center text-sm font-bold text-slate-800 focus:outline-none border-x border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => incrementAllocationField('quantity_lost')}
                      disabled={isPointComplete}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title={isPointComplete ? 'จัดสรรครบตามยอดสั่งซื้อแล้ว' : 'เพิ่มจำนวน'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 4. คืนคลัง */}
                <div className="border border-slate-200 rounded-xl p-3 sm:p-3.5 flex items-center justify-between hover:border-slate-300 transition-colors bg-white shadow-2xs">
                  <div className="flex items-center gap-2.5 pr-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4D7C55] shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        คืนคลัง
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ส่งตรงคืนคลังของร้านค้า
                      </div>
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementAllocationField('quantity_return')}
                      disabled={ret <= 0}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title="ลดจำนวน"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ret}
                      onChange={(e) => setClampedAllocationField('quantity_return', e.target.value)}
                      className="w-14 h-8 text-center text-sm font-bold text-slate-800 focus:outline-none border-x border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => incrementAllocationField('quantity_return')}
                      disabled={isPointComplete}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-25 disabled:hover:bg-white disabled:cursor-not-allowed text-base font-medium transition-colors cursor-pointer"
                      title={isPointComplete ? 'จัดสรรครบตามยอดสั่งซื้อแล้ว' : 'เพิ่มจำนวน'}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* ข้อความตรวจสอบความครบถ้วน (Validation Message Bar) */}
              <div
                className={`py-2.5 px-3 rounded-lg text-xs text-center flex items-center justify-start gap-1.5 transition-colors ${
                  canSave
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-medium'
                    : 'bg-slate-100 text-slate-600 font-normal'
                }`}
              >
                {canSave ? (
                  <span>✓ จัดสรรยอดครบตามยอดสั่งซื้อเรียบร้อยแล้ว</span>
                ) : (
                  <span>✓ กรอกจำนวนให้ครบตามยอดสั่งซื้อ (เหลืออีก {remaining} {allocatingItem.uom || 'ชิ้น'})</span>
                )}
              </div>

              {/* ปุ่มดำเนินการด้านล่าง */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeAllocationModal}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <RiCloseLine className="w-4 h-4 text-slate-500" />
                  <span>ยกเลิก</span>
                </button>
                <button
                  type="button"
                  onClick={applyAllocation}
                  disabled={!canSave}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    canSave
                      ? 'bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white cursor-pointer shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RiCheckLine className="w-4 h-4" />
                  <span>บันทึกยอด</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          Sub-Modal 2: ยืนยันการบันทึกการจัดเตรียมสินค้า (Final Confirmation)
          ───────────────────────────────────────────────────────────── */}
      {showConfirmSubmitModal && selectedOrderForModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 font-sans">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                ยืนยันการจัดเตรียมสินค้า
              </h4>
              <p className="text-xs text-stone-600 mt-1.5">
                คุณต้องการยืนยันการจัดเตรียมสินค้าสำหรับคำสั่งซื้อหมายเลข{' '}
                <strong className="text-stone-900 font-semibold">
                  {selectedOrderForModal.order_no}
                </strong>{' '}
                ใช่หรือไม่?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={closeConfirmSubmitModal}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RiArrowGoBackLine className="w-4 h-4 shrink-0 text-stone-500" />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitPreparation}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#144717] text-white text-xs font-medium rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RiCheckLine className="w-4 h-4 shrink-0" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการจัดเตรียม'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Sub-Modal 3: ยืนยันการยกเลิกคำสั่งซื้อของร้านค้า (Cancel Order Modal)
          ───────────────────────────────────────────────────────────── */}
      {showCancelOrderModal && selectedOrderForModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 animate-fadeIn font-sans">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                ยืนยันการยกเลิกคำสั่งซื้อ
              </h4>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อหมายเลข{' '}
                <strong className="text-stone-900 font-semibold">
                  {selectedOrderForModal.order_no || selectedOrderForModal.order_id}
                </strong>{' '}
                และคืนสต็อกสินค้าทั้งหมดเข้าคลังสินค้า?
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
                  {STORE_CANCEL_REASONS.map((reason) => (
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
                onClick={closeCancelOrderModal}
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
