// src/app/approvals/page.js
'use client';

/**
 * =========================================================================
 * Page: หน้าผู้อนุมัติคำสั่งซื้อ (Approvals Dashboard Page)
 * Route: /approvals
 * =========================================================================
 * คุณสมบัติ & การทำงาน:
 * 1. ฟอนต์ Kanit 100% สไตล์และมิติเดียวกับหน้าคำสั่งซื้อ (/orders)
 * 2. ใช้ Zustand Store (useApprovalStore) รวมศูนย์ State และ Actions
 *    (ไม่มีการเรียก service หรือ fetch โดยตรงใน Component)
 * 3. ความสูงตารางยืดหยุ่นตามเนื้อหาจริง (Auto-height) และล็อกไม่เกินหน้าจอ (maxHeight: calc(100dvh - 290px))
 * 4. ล็อก window scroll ป้องกันหน้าจอด้านนอกเลื่อนซ้อน (Zero Outer Scrollbar)
 * 5. ปุ่มค้นหาขนาดคงที่ ไม่ดุกดิกขณะโหลด (Wobble-Free Search Button)
 * 6. Modal รายละเอียดคำสั่งซื้อ พร้อมระบบยืนยันการอนุมัติ (Approve) และกล่องระบุเหตุผลการปฏิเสธ (Reject)
 * =========================================================================
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { AccountSidebar } from '@/app/components/layout/AccountSidebar';
import { useApprovalStore, REJECT_REASONS } from '@/app/stores/useApprovalStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { OrderSearchBox } from '@/app/components/orders/OrderSearchBox';
import { getThumbnailUrl, formatThaiDateTime } from '@/lib/utils';
import { MdViewKanban } from 'react-icons/md';
import {
  RiImageLine,
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

export default function ApprovalsPage() {
  const { userInfo } = useAuth();
  const { showSuccess, showError } = useToastStore();
  const token = userInfo?.securityToken;

  // ดึง State และ Actions ทั้งหมดจาก useApprovalStore
  const {
    approvals,
    totalCount,
    page,
    rowsPerPage,
    loading,
    error,
    searchInput,
    appliedSearch,
    isDetailOpen,
    setIsDetailOpen,
    appliedDetailFilters,
    applyDetailSearch,
    clearDetailSearch,
    sortBy,
    sortOrder,
    selectedApprovalForModal,
    isActionLoading,
    showRejectModal,
    rejectRemark,
    selectedRejectReason,
    customRejectRemark,
    showApproveModal,
    fetchApprovals,
    setPage,
    setRowsPerPage,
    setSearchInput,
    applySearch,
    clearSearch,
    toggleSort,
    openApprovalModal,
    closeApprovalModal,
    openRejectModal,
    closeRejectModal,
    setRejectRemark,
    setSelectedRejectReason,
    setCustomRejectRemark,
    openApproveModal,
    closeApproveModal,
    approveOrder,
    rejectOrder,
  } = useApprovalStore();

  // โหลดข้อมูลเมื่อตัวกรองเปลี่ยน
  useEffect(() => {
    fetchApprovals(token);
  }, [fetchApprovals, token, page, rowsPerPage, appliedSearch, appliedDetailFilters, sortBy, sortOrder]);

  const triggerRefresh = () => {
    fetchApprovals(token);
  };

  // ล็อก body overflow ขณะอยู่ในหน้านี้
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ฟังก์ชันสลับการเรียงลำดับหัวคอลัมน์
  const handleSort = (field) => {
    toggleSort(field, token);
  };

  // ฟังก์ชันค้นหา
  const handleSearchSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    applySearch(undefined, token);
  };

  // ฟังก์ชันล้างค้นหา
  const handleClearSearch = () => {
    clearSearch(token);
  };

  // คำนวณช่วงข้อมูลที่กำลังแสดง (เช่น 1–10 of 16)
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  // รายการสินค้าใน Modal: รวมล๊อตสินค้าชิ้นเดียวกันที่มีราคาเท่ากัน
  const modalItems = useMemo(() => {
    if (!selectedApprovalForModal?.items) return [];
    const grouped = [];
    selectedApprovalForModal.items.forEach((item) => {
      const pId = item.product_id ? String(item.product_id).toLowerCase() : '';
      const price = Number(item.price || 0);

      const existing = grouped.find((g) => {
        const sameProduct = pId && g.product_id
          ? String(g.product_id).toLowerCase() === pId
          : g.product_name === item.product_name;
        return sameProduct && Math.abs(Number(g.price || 0) - price) < 0.0001;
      });

      const qty = Number(item.quantity ?? 1);

      if (existing) {
        existing.quantity = (existing.quantity || 0) + qty;
      } else {
        grouped.push({
          ...item,
          quantity: qty,
        });
      }
    });
    return grouped;
  }, [selectedApprovalForModal]);

  // ดำเนินการอนุมัติคำสั่งซื้อ
  const handleConfirmApprove = async () => {
    const res = await approveOrder(token);
    if (res.success) {
      showSuccess(`อนุมัติคำสั่งซื้อ "${res.orderNo}" เรียบร้อยแล้ว`);
    } else if (res.error) {
      showError(res.error);
    }
  };

  // ดำเนินการปฏิเสธคำสั่งซื้อ
  const handleConfirmReject = async () => {
    const res = await rejectOrder(token);
    if (res.success) {
      showSuccess(`ปฏิเสธคำสั่งซื้อ "${res.orderNo}" เรียบร้อยแล้ว`);
    } else if (res.error) {
      showError(res.error);
    }
  };

  // ป้ายสถานะการอนุมัติ (ขนาด w-[130px] สบายตา)
  const renderApprovalStatusBadge = (status) => {
    const s = (status || 'P').toUpperCase();
    switch (s) {
      case 'P':
      case 'W':
        return (
          <span className="inline-flex items-center justify-center w-[8.125rem] py-1 rounded-full text-xs font-normal text-white bg-[#1976d2] shadow-2xs whitespace-nowrap">
            กำลังรออนุมัติ
          </span>
        );
      case 'A':
      case 'X':
        return (
          <span className="inline-flex items-center justify-center w-[8.125rem] py-1 rounded-full text-xs font-normal text-white bg-[#2e7d32] shadow-2xs whitespace-nowrap">
            อนุมัติแล้ว
          </span>
        );
      case 'R':
        return (
          <span className="inline-flex items-center justify-center w-[8.125rem] py-1 rounded-full text-xs font-normal text-white bg-[#d32f2f] shadow-2xs whitespace-nowrap">
            ถูกปฏิเสธ
          </span>
        );
      case 'C':
        return (
          <span className="inline-flex items-center justify-center w-[8.125rem] py-1 rounded-full text-xs font-normal text-white bg-[#757575] shadow-2xs whitespace-nowrap">
            ยกเลิกรายการ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-[8.125rem] py-1 rounded-full text-xs font-normal text-white bg-stone-500 whitespace-nowrap">
            {s}
          </span>
        );
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

  return (
    <div className="flex-1 bg-[#f8f9fa] text-stone-900 flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start gap-6">
        {/* บาร์เมนูด้านข้าง (Account Sidebar) */}
        <div className="hidden md:block shrink-0">
          <AccountSidebar />
        </div>

        {/* การ์ดตารางรายการรออนุมัติหลัก */}
        <div className="flex-1 min-w-0 w-full">
          <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col">
            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 1: หัวข้อหน้า และปุ่มรีเฟรช (Pinned Header)
                ───────────────────────────────────────────────────────────── */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white rounded-t-lg">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                  รายการรออนุมัติ
                </h1>
                <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
                  ตรวจสอบและพิจารณาคำขอเบิกสินค้าของแผนก 
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={triggerRefresh}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3.5 py-2 rounded-md transition-colors cursor-pointer"
                  title="โหลดข้อมูลใหม่"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-[#363636] shrink-0 ${loading ? 'animate-spin' : ''}`}
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
                ส่วนที่ 2: ช่องค้นหา พร้อมปุ่มค้นหา และปุ่ม Search Detail (3 ขีด)
                ───────────────────────────────────────────────────────────── */}
            <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
              <OrderSearchBox
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                onSearchSubmit={handleSearchSubmit}
                onSearchClear={handleClearSearch}
                placeholder="ค้นหาหมายเลขใบสั่งซื้อ, ผู้สั่งซื้อ, แผนก, ร้านค้า หรือสินค้า..."
                isDetailOpen={isDetailOpen}
                setIsDetailOpen={setIsDetailOpen}
                appliedDetailFilters={appliedDetailFilters}
                onApplyDetail={(filters) => applyDetailSearch(filters, token)}
                onClearDetail={() => clearDetailSearch(token)}
                loading={loading}
              />
            </div>

            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 3: ตารางแสดงรายการคำขออนุมัติ
                (ความสูงยืดหยุ่นตามแถวจริง เพดานสูงสุดไม่เกินหน้าจอ 100%)
                ───────────────────────────────────────────────────────────── */}
            <div className="flex flex-col bg-white">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto border-3 border-stone-200 border-t-[#363636] rounded-full animate-spin" />
                  <p className="text-xs sm:text-sm font-normal text-[#363636]">กำลังโหลดรายการคำขออนุมัติ...</p>
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
              ) : approvals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#2B2F38]">ไม่มีรายการรอการอนุมัติในขณะนี้</p>
                  <p className="text-xs text-[#363636]/60">
                    {appliedSearch
                      ? `ไม่พบข้อมูลที่ตรงกับคำค้นหา "${appliedSearch}"`
                      : 'เมื่อมีคำขอเบิกสินค้าจากพนักงาน ข้อมูลจะแสดงที่นี่โดยอัตโนมัติ'}
                  </p>
                </div>
              ) : (
                <div
                  style={{ maxHeight: 'calc(100vh - 280px)' }}
                  className="overflow-x-auto overflow-y-auto w-full max-w-full"
                >
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
                      <tr>
                        {/* คอลัมน์ Action ดูรายละเอียด */}
                        <th className="py-2.5 px-2.5 font-normal text-center bg-white w-10"></th>

                        {/* 1. หมายเลขสั่งซื้อ (Sortable) */}
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

                        {/* 2. วันที่ทำรายการ (Sortable) */}
                        <th
                          onClick={() => handleSort('request_date')}
                          className="py-2.5 px-3.5 font-normal cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามวันที่ขออนุมัติ"
                        >
                          <div className="flex items-center gap-1">
                            <span>วันที่ทำรายการ</span>
                            {renderSortIcon('request_date')}
                          </div>
                        </th>

                        {/* 3. ผู้สั่งซื้อ (Sortable) */}
                        <th
                          onClick={() => handleSort('owner')}
                          className="py-2.5 px-3.5 font-normal cursor-pointer hover:bg-stone-50 transition-colors group bg-white whitespace-nowrap"
                          title="คลิกเพื่อเรียงลำดับตามผู้สั่งซื้อ"
                        >
                          <div className="flex items-center gap-1">
                            <span>ผู้สั่งซื้อ</span>
                            {renderSortIcon('owner')}
                          </div>
                        </th>

                        {/* 4. รูปแบบการสั่งซื้อ */}
                        <th className="py-2.5 px-3.5 font-normal bg-white whitespace-nowrap">
                          <span>รูปแบบการสั่งซื้อ</span>
                        </th>

                        {/* 5. จำนวน */}
                        <th className="py-2.5 px-3 font-normal text-center bg-white whitespace-nowrap">
                          <span>จำนวน</span>
                        </th>

                        {/* 6. จำนวนเงิน (บาท) (Sortable) */}
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

                    <tbody className="divide-y divide-[#D3D3D3]/50">
                      {approvals.map((row) => {
                        const isPreorder = row.reserve_flag === 'Y' || row.reserve_flag === true || row.reserve_flag === '1';
                        const requesterName = row.owner_fullname_th || row.owner_fullname || row.owner;

                        return (
                          <tr
                            key={row.approval_id}
                            onClick={() => openApprovalModal(row)}
                            className="hover:bg-stone-50/80 transition-colors cursor-pointer"
                          >
                            {/* คอลัมน์ Action ดูรายละเอียด (ไอคอน MdViewKanban) */}
                            <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openApprovalModal(row);
                                }}
                                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                                title="ดูรายละเอียดคำขออนุมัติ"
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
                              {formatThaiDateTime(row.request_date)}
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
            <div className="border-t border-[#D3D3D3] px-4 py-2.5 flex items-center justify-end gap-6 text-xs text-[#363636]/80 select-none bg-white shrink-0 rounded-b-lg">
              {/* Rows per page Selector */}
              <div className="flex items-center gap-2">
                <span className="font-normal text-[#363636]/70">Rows per page:</span>
                <div className="relative">
                  <select
                    value={rowsPerPage}
                    onChange={(e) => setRowsPerPage(Number(e.target.value), token)}
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
              <div className="font-normal text-[#363636]/90 min-w-[5rem] text-center">
                {totalCount === 0 ? '0 of 0' : `${startIndex}–${endIndex} of ${totalCount}`}
              </div>

              {/* Navigation Buttons: |<  <  >  >| */}
              <div className="flex items-center gap-1">
                {/* First Page |< */}
                <button
                  type="button"
                  onClick={() => setPage(1, token)}
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
                  onClick={() => setPage(Math.max(1, page - 1), token)}
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
                  onClick={() => setPage(Math.min(totalPages, page + 1), token)}
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
                  onClick={() => setPage(totalPages, token)}
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
          Modal 1: ดูรายละเอียดคำขออนุมัติคำสั่งซื้อ
          ───────────────────────────────────────────────────────────── */}
      {selectedApprovalForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-300 max-w-2xl w-full max-h-[90vh] flex flex-col font-sans overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-[#D3D3D3] bg-white flex items-center justify-between gap-4 shrink-0">
              <div>
                <h3 className="text-base font-medium text-[#363636]">
                  รายละเอียดใบสั่งซื้อ: {selectedApprovalForModal.order_no}
                </h3>
                <p className="text-xs text-[#363636]/60 mt-0.5">
                  วันที่ส่งคำขอ: {formatThaiDateTime(selectedApprovalForModal.request_date)}
                </p>
              </div>

              {/* ป้ายสถานะคำขออนุมัติมุมบนขวา */}
              <div className="shrink-0">
                {renderApprovalStatusBadge(selectedApprovalForModal.approval_status)}
              </div>
            </div>

            {/* Body Modal */}
            <div className="p-6 space-y-4 text-xs sm:text-sm flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* ข้อมูลสรุป 6 ช่อง */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200 shrink-0">
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ร้านค้า</span>
                  <span className="text-xs font-medium text-[#363636]">{selectedApprovalForModal.store_name}</span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ผู้สั่งซื้อ</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedApprovalForModal.owner_fullname_th || selectedApprovalForModal.owner}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ฝ่าย / แผนก</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedApprovalForModal.owner_department_th || selectedApprovalForModal.owner_department || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">สถานที่จัดส่ง</span>
                  <span className="text-xs font-medium text-[#363636]">{selectedApprovalForModal.shipping_location}</span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">รูปแบบการสั่งซื้อ</span>
                  <span className="text-xs font-medium text-[#363636]">
                    {selectedApprovalForModal.reserve_flag ? 'สั่งล่วงหน้า' : 'มาตรฐาน'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#363636]/60 block font-normal">ยอดรวมสุทธิ</span>
                  <span className="text-sm font-medium text-[#363636]">
                    ฿{selectedApprovalForModal.total_price.toLocaleString('th-TH', {
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
                    รายการสินค้าที่ขออนุมัติ
                  </h4>
                  <span className="text-xs text-[#363636]/70 font-normal">
                    {modalItems.length} รายการ
                  </span>
                </div>
                <div className="border border-[#D3D3D3] rounded-lg overflow-x-auto overflow-y-auto flex-1 min-h-0">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 border-b border-[#D3D3D3] text-[11px] font-normal text-[#363636]/70 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-3 font-normal bg-stone-100">รูปภาพ</th>
                        <th className="py-2.5 px-3 font-normal bg-stone-100">ชื่อสินค้า</th>
                        <th className="py-2.5 px-3 font-normal text-center bg-stone-100">ราคาต่อหน่วย</th>
                        <th className="py-2.5 px-3 font-normal text-center bg-stone-100">จำนวน</th>
                        <th className="py-2.5 px-3 font-normal text-center bg-stone-100">หน่วย</th>
                        <th className="py-2.5 px-3 font-normal text-right bg-stone-100">จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D3D3D3]/50">
                      {modalItems.map((item, idx) => {
                        const lineTotal = item.quantity * item.price;

                        return (
                          <tr key={idx} className="hover:bg-stone-50">
                            <td className="py-2 px-3">
                              <OrderItemThumbnail
                                thumbnail={item.product_thumbnail}
                                productName={item.product_name}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <p className="font-normal text-xs text-[#363636] line-clamp-2 leading-relaxed">
                                {item.product_name}
                              </p>
                            </td>
                            <td className="py-2 px-3 text-center text-xs font-normal text-[#363636]">
                              ฿{item.price.toLocaleString('th-TH', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-3 text-center text-xs font-normal text-[#363636]">
                              {item.quantity}
                            </td>
                            <td className="py-2 px-3 text-center text-xs font-normal text-[#363636]">
                              {item.uom || 'ชิ้น'}
                            </td>
                            <td className="py-2 px-3 text-right text-xs font-normal text-[#363636]">
                              ฿{lineTotal.toLocaleString('th-TH', {
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
              </div>
            </div>

            {/* Footer Modal: ปุ่มปฏิเสธ / อนุมัติ / ปิดหน้าต่าง */}
            <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3 shrink-0">
              {/* ฝั่งซ้าย: ปุ่มปฏิเสธ และปุ่มอนุมัติ */}
              <div className="flex items-center gap-2.5">
                {selectedApprovalForModal.approval_status === 'P' && (
                  <>
                    <button
                      type="button"
                      onClick={openRejectModal}
                      disabled={isActionLoading}
                      className="px-4 py-2 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RiCloseCircleLine className="w-4 h-4 shrink-0" />
                      <span>ปฏิเสธ</span>
                    </button>

                    <button
                      type="button"
                      onClick={openApproveModal}
                      disabled={isActionLoading}
                      className="px-4 py-2 bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#144717] disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RiCheckLine className="w-4 h-4 shrink-0" />
                      <span>อนุมัติ</span>
                    </button>
                  </>
                )}
              </div>

              {/* ฝั่งขวา: ปุ่มปิดหน้าต่าง (สไตล์ B) */}
              <button
                type="button"
                onClick={closeApprovalModal}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RiCloseLine className="w-4 h-4 shrink-0 text-stone-500" />
                <span>ปิดหน้าต่าง</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 2: ยืนยันการอนุมัติคำสั่งซื้อ (Approve Confirmation)
          ───────────────────────────────────────────────────────────── */}
      {showApproveModal && selectedApprovalForModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 font-sans">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                ยืนยันการอนุมัติคำสั่งซื้อ
              </h4>
              <p className="text-xs text-stone-600 mt-1.5">
                คุณต้องการอนุมัติคำสั่งซื้อหมายเลข{' '}
                <strong className="text-stone-900 font-semibold">
                  {selectedApprovalForModal.order_no}
                </strong>{' '}

                ใช่หรือไม่? 
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={closeApproveModal}
                disabled={isActionLoading}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RiArrowGoBackLine className="w-4 h-4 shrink-0 text-stone-500" />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isActionLoading}
                className="px-4 py-2 bg-[#2e7d32] hover:bg-[#1b5e20] active:bg-[#144717] text-white text-xs font-medium rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RiCheckLine className="w-4 h-4 shrink-0" />
                <span>{isActionLoading ? 'กำลังอนุมัติ...' : 'ยืนยันการอนุมัติ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 3: ยืนยันการปฏิเสธคำสั่งซื้อ พร้อมระบุเหตุผล (Reject Confirmation)
          ───────────────────────────────────────────────────────────── */}
      {showRejectModal && selectedApprovalForModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 font-sans">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                ยืนยันการปฏิเสธคำสั่งซื้อ
              </h4>
              <p className="text-xs text-stone-600 mt-1.5">
                คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธคำสั่งซื้อหมายเลข{' '}
                <strong className="text-stone-900 font-semibold">
                  {selectedApprovalForModal.order_no}
                </strong>
                ? 
              </p>
            </div>

            <div>
              <label className="text-xs text-stone-700 font-medium block mb-1.5">
                เหตุผลในการปฏิเสธ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRejectReason}
                  onChange={(e) => setSelectedRejectReason(e.target.value)}
                  className="w-full h-9.5 px-3 text-xs text-stone-900 bg-white border border-stone-300 rounded-md focus:border-red-500 focus:ring-1 focus:ring-red-500/50 focus:outline-none transition-colors cursor-pointer appearance-none pr-8 font-normal"
                >
                  <option value="" disabled>
                    -- เลือกเหตุผลในการปฏิเสธ --
                  </option>
                  {REJECT_REASONS.map((reason) => (
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
              {selectedRejectReason === 'อื่นๆ (ระบุเพิ่มเติม)' && (
                <div className="mt-2.5 animate-fadeIn">
                  <textarea
                    value={customRejectRemark}
                    onChange={(e) => setCustomRejectRemark(e.target.value)}
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
                onClick={closeRejectModal}
                disabled={isActionLoading}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RiArrowGoBackLine className="w-4 h-4 shrink-0 text-stone-500" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={
                  isActionLoading ||
                  !selectedRejectReason ||
                  (selectedRejectReason === 'อื่นๆ (ระบุเพิ่มเติม)' && !customRejectRemark.trim())
                }
                className="px-4 py-2 bg-[#d32f2f] hover:bg-[#c62828] active:bg-[#b71c1c] text-white text-xs font-medium rounded-md transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <RiCloseCircleLine className="w-4 h-4 shrink-0" />
                <span>{isActionLoading ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
