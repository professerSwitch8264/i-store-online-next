// src/app/store-management/products/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { productService } from '@/app/services/productService';
import { getThumbnailUrl } from '@/lib/utils';
import {
  RiBox3Line,
  RiStore2Line,
  RiArrowLeftLine,
  RiLoader4Line,
  RiCloseLine,
  RiRefreshLine,
  RiImageLine,
  RiPlayListAddLine,
  RiDeleteBinLine,
  RiShapesLine,
  RiFileTextLine,
  RiArrowDownSLine,
  RiChat1Line,
} from 'react-icons/ri';

/**
 * ProductThumbnail: คอมโพเนนต์แสดงรูปภาพสินค้าขนาดเล็กพร้อม fallback
 */
function ProductThumbnail({ thumbnail, productName }) {
  const [imageError, setImageError] = useState(false);
  const thumbUrl = getThumbnailUrl(thumbnail);

  if (!thumbUrl || imageError) {
    return (
      <div className="w-10 h-10 rounded bg-stone-100 border border-stone-200 flex items-center justify-center p-1 shrink-0 text-stone-300 mx-auto">
        <RiImageLine className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded bg-stone-50 border border-stone-200 flex items-center justify-center p-1 overflow-hidden shrink-0 mx-auto">
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

export default function StoreProductsPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const currentStore = useStoreManagementStore((state) => state.currentStore);
  const showError = useToastStore((state) => state.showError);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showConfirm = useToastStore((state) => state.showConfirm);

  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Receive Stock Modal States
  const [selectedProductForReceive, setSelectedProductForReceive] = useState(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    item_type: 'normal',
    quantity: 0,
    price: '',
    remark: '',
  });
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Search States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const storeId = currentStore?.store_id;

  // จัดการเปิด-ปิด Receive Modal
  const handleOpenReceiveModal = (product) => {
    setSelectedProductForReceive(product);
    setReceiveForm({
      item_type: 'normal',
      quantity: 0,
      price: product.product_price !== undefined && product.product_price !== null ? product.product_price : '',
      remark: '',
    });
    setIsReceiveModalOpen(true);
  };

  const handleCloseReceiveModal = () => {
    if (isSubmittingReceive) return;
    setIsReceiveModalOpen(false);
    setSelectedProductForReceive(null);
  };

  const handleReceiveSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedProductForReceive) return;

    const qty = parseFloat(receiveForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      showError('กรุณาระบุจำนวนสินค้าที่ถูกต้องและมากกว่า 0');
      return;
    }

    setIsSubmittingReceive(true);
    try {
      const payload = {
        product_id: selectedProductForReceive.product_id,
        item_type: receiveForm.item_type,
        quantity: qty,
        price: receiveForm.price !== '' ? parseFloat(receiveForm.price) : selectedProductForReceive.product_price,
        remark: receiveForm.remark.trim(),
      };

      const res = await productService.receiveStock(payload, token);
      showSuccess(res.message || 'รับสินค้าเข้าคลังเรียบร้อยแล้ว');
      handleCloseReceiveModal();
      loadProducts(page, appliedSearch, rowsPerPage);
    } catch (err) {
      console.error('Failed to receive stock:', err);
      showError(err.message || 'เกิดข้อผิดพลาดในการรับสินค้าเข้าคลัง');
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // สลับสถานะเปิดจำหน่าย / งดจำหน่าย (Toggle Switch สไตล์ระบบ)
  const handleToggleStatus = async (product) => {
    const currentStatus = product.status || 'Y';
    const newStatus = currentStatus === 'Y' ? 'N' : 'Y';
    const prevProducts = [...products];

    // Optimistic Update
    setProducts((prev) =>
      prev.map((item) =>
        item.product_id === product.product_id ? { ...item, status: newStatus } : item
      )
    );
    setTogglingId(product.product_id);

    try {
      await productService.updateProductStatus(product.product_id, newStatus, token);
      showSuccess(
        newStatus === 'Y'
          ? `เปิดจำหน่ายสินค้า "${product.product_name}" แล้ว`
          : `งดจำหน่ายสินค้า "${product.product_name}" แล้ว`
      );
    } catch (err) {
      console.error('Toggle status error:', err);
      showError(err.message || 'ไม่สามารถเปลี่ยนสถานะสินค้าได้');
      // Revert on error
      setProducts(prevProducts);
    } finally {
      setTogglingId(null);
    }
  };

  // ยืนยันการลบสินค้า
  const handleOpenDeleteModal = (product) => {
    showConfirm({
      title: 'คุณต้องการลบสินค้านี้ออกหรือไม่?',
      message: `ชื่อสินค้า : ${product.product_name}\nรายละเอียดสินค้า : ${product.product_desc || '-'}`,
      confirmText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          await productService.deleteProduct(product.product_id, token);
          showSuccess(`ลบสินค้า "${product.product_name}" เรียบร้อยแล้ว`);
          const targetPage = products.length === 1 && page > 1 ? page - 1 : page;
          if (targetPage !== page) setPage(targetPage);
          loadProducts(targetPage, appliedSearch, rowsPerPage);
        } catch (err) {
          console.error('Failed to delete product:', err);
          showError(err.message || 'เกิดข้อผิดพลาดในการลบสินค้า');
        }
      },
    });
  };

  // โหลดรายการสินค้าจาก Backend API
  const loadProducts = useCallback(
    async (targetPage = page, targetSearch = appliedSearch, targetLimit = rowsPerPage) => {
      if (!storeId) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await productService.getProducts(
          {
            store_id: storeId,
            search: targetSearch,
            page: targetPage,
            limit: targetLimit,
            include_all: true,
          },
          token
        );
        setProducts(res.data || []);
        setTotalCount(res.pagination?.total ?? (res.data || []).length);
      } catch (err) {
        console.error('Failed to load products:', err);
        showError(err.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้');
      } finally {
        setLoading(false);
      }
    },
    [storeId, token, showError, page, appliedSearch, rowsPerPage]
  );

  useEffect(() => {
    if (storeId) {
      loadProducts(1, '', rowsPerPage);
    }
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // การค้นหา
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    setAppliedSearch(q);
    setPage(1);
    loadProducts(1, q, rowsPerPage);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
    loadProducts(1, '', rowsPerPage);
  };

  // การแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      loadProducts(newPage, appliedSearch, rowsPerPage);
    }
  };

  const handleRowsPerPageChange = (newRowsPerPage) => {
    setRowsPerPage(newRowsPerPage);
    setPage(1);
    loadProducts(1, appliedSearch, newRowsPerPage);
  };

  // จัดรูปแบบราคา
  const formatPrice = (price) => {
    return Number(price || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // กรณียังไม่ได้เลือกร้านค้า
  if (!currentStore) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiStore2Line className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-[#2B2F38]">ยังไม่ได้เลือกร้านค้า</h2>
        <p className="text-xs text-stone-500 mt-1 max-w-sm mb-5">
          กรุณาเลือกร้านค้าที่คุณต้องการดูข้อมูลหรือจัดการจากหน้ารวมร้านค้า
        </p>
        <Link
          href="/store-management"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2B2F38] hover:bg-[#1E2229] text-white rounded-md text-xs font-medium transition-colors shadow-xs"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          <span>ไปหน้ารวมร้านค้า</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มแอ็กชัน (Header Bar)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              รายการสินค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            รายการสินค้าทั้งหมดในร้านค้า
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadProducts(page, appliedSearch, rowsPerPage)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3 py-2 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RiRefreshLine className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: ช่องค้นหา (Single Search Bar สไตล์มาตรฐาน)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาชื่อหรือรายละเอียดสินค้า..."
              className="w-full pl-3.5 pr-9 py-2 bg-white border border-r-0 border-stone-300 rounded-l-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#EB6E3E]/40 focus:outline-none transition-colors"
            />

            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#2B2F38] cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <RiCloseLine className="w-4 h-4" />
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
          ส่วนที่ 3: ตารางรายการสินค้า (ล็อกความสูงตามหน้าจอ)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white">
        <div
          style={{ maxHeight: 'calc(100vh - 320px)' }}
          className="overflow-x-auto overflow-y-auto"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[45rem]">
            <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 font-normal text-[#363636] text-center w-16 bg-white">
                  รูป
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] bg-white">
                  ชื่อสินค้า
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] bg-white">
                  ตำแหน่งจัดเก็บ
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-28 bg-white whitespace-nowrap">
                  จำนวน
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-24 bg-white whitespace-nowrap">
                  หน่วย
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-right w-28 bg-white whitespace-nowrap">
                  ราคา
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-24 sm:w-28 bg-white whitespace-nowrap">
                  สถานะ
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-24 sm:w-28 bg-white whitespace-nowrap">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RiLoader4Line className="w-6 h-6 animate-spin text-stone-400" />
                      <span className="text-xs">กำลังโหลดข้อมูลรายการสินค้า...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
                        <RiBox3Line className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-[#2B2F38]">
                        {appliedSearch ? `ไม่พบสินค้าที่ตรงกับ "${appliedSearch}"` : 'ยังไม่มีรายการสินค้าในร้านนี้'}
                      </p>
                      <p className="text-xs text-stone-500 max-w-xs">
                        {appliedSearch ? 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง' : 'รายการสินค้าในร้านค้าจะแสดงที่นี่'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product, idx) => {
                  const stock = Number(product.stock_quantity || 0);

                  return (
                    <tr
                      key={product.product_id || idx}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      {/* รูปภาพ */}
                      <td className="py-3 px-3 text-center">
                        <ProductThumbnail
                          thumbnail={product.product_thumbnail}
                          productName={product.product_name}
                        />
                      </td>

                      {/* ชื่อ และ รายละเอียดใต้ชื่อ */}
                      <td className="py-3 px-4 text-[#2B2F38] text-xs sm:text-sm">
                        <p className="font-medium text-[#2B2F38]">{product.product_name}</p>
                        {product.product_desc ? (
                          <p className="text-xs text-stone-500 font-normal mt-0.5 line-clamp-1">
                            {product.product_desc}
                          </p>
                        ) : (
                          <p className="text-xs text-stone-400 font-normal mt-0.5">-</p>
                        )}
                      </td>

                      {/* ตำแหน่งจัดเก็บ (Location) */}
                      <td className="py-3 px-4 text-xs sm:text-sm text-[#2B2F38] whitespace-nowrap">
                        {product.location_name ? (
                          <span className="font-normal text-stone-700">{product.location_name}</span>
                        ) : (
                          <span className="text-stone-400 font-normal">-</span>
                        )}
                      </td>

                      {/* จำนวน (คงเหลือในคลัง) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-xs sm:text-sm">
                        <span
                          className={`font-medium ${
                            stock > 0 ? 'text-[#2B2F38]' : 'text-stone-400'
                          }`}
                        >
                          {stock.toLocaleString()}
                        </span>
                      </td>

                      {/* หน่วย */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-xs text-stone-600">
                        {product.unit_name || product.uom || '-'}
                      </td>

                      {/* ราคา */}
                      <td className="py-3 px-4 text-right whitespace-nowrap text-xs sm:text-sm font-medium text-[#2B2F38]">
                        ฿{formatPrice(product.product_price)}
                      </td>

                      {/* สถานะเปิดจำหน่าย/งดจำหน่าย (Toggle Switch เหมือนตารางอื่น) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(product)}
                            disabled={togglingId === product.product_id}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#EB6E3E] ${
                              (product.status || 'Y') === 'Y' ? 'bg-[#2B2F38]' : 'bg-stone-300'
                            }`}
                            title={
                              (product.status || 'Y') === 'Y'
                                ? 'คลิกเพื่องดจำหน่าย'
                                : 'คลิกเพื่อเปิดจำหน่าย'
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                (product.status || 'Y') === 'Y' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* จัดการ (ปุ่มรับสินค้าเข้าคลัง + ปุ่มลบสินค้า ไว้หลังสุด) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenReceiveModal(product)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                            title="รับสินค้าเข้าคลัง"
                          >
                            <RiPlayListAddLine className="w-5 h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(product)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                            title="ลบสินค้า"
                          >
                            <RiDeleteBinLine className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 4: แถบ Pagination ด้านล่าง
          ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-[#D3D3D3] px-3 sm:px-4 py-2.5 flex items-center justify-end gap-2 sm:gap-6 text-xs text-[#363636]/80 select-none bg-white shrink-0 flex-wrap sm:flex-nowrap">
        {/* Rows per page Selector */}
        <div className="flex items-center gap-2">
          <span className="font-normal text-[#363636]/70">Rows per page:</span>
          <div className="relative">
            <select
              value={rowsPerPage}
              onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
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
            onClick={() => handlePageChange(1)}
            disabled={page <= 1 || loading}
            className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
            title="หน้าแรก"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
            className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
            title="หน้าก่อนหน้า"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
            className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
            title="หน้าถัดไป"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={page >= totalPages || loading}
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
          Modal รับสินค้าเข้า (ตาม UI ต้นแบบ media_1789373015334.png)
          ───────────────────────────────────────────────────────────── */}
      {isReceiveModalOpen && selectedProductForReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn font-sans">
          {/* Backdrop พื้นหลังมืดโปร่งแสงแบบไม่มี Blur (เหมือน Popup อื่นๆ ในระบบ) */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleCloseReceiveModal}
          />

          {/* Modal Container */}
          <div
            className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full p-6 sm:p-7 z-10 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5">
              <h3 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                รับสินค้าเข้า
              </h3>
            </div>

            {/* Content: ซ้าย (รูปภาพ) | ขวา (แบบฟอร์ม) */}
            <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch">
              {/* ซ้าย: รูปภาพสินค้าในกรอบเส้นประ สี่เหลี่ยมจัตุรัสสูงเท่าคอลัมน์ขวาพอดี (234px) */}
              <div className="w-full md:w-[234px] h-[234px] border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center p-4 bg-white shrink-0">
                {selectedProductForReceive.product_thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={getThumbnailUrl(selectedProductForReceive.product_thumbnail)}
                    alt={selectedProductForReceive.product_name || ''}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-stone-300">
                    <RiImageLine className="w-12 h-12 stroke-[1.5]" />
                  </div>
                )}
              </div>

              {/* ขวา: ช่องกรอกข้อมูลสไตล์ Outlined Label */}
              <div className="flex-1 flex flex-col justify-between gap-3 sm:gap-3.5">
                {/* แถวที่ 1: ชื่อสินค้า | หมวดหมู่สินค้า */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* ชื่อสินค้า */}
                  <div className="relative border border-stone-200 rounded-md px-3.5 py-2.5 bg-stone-100 flex items-center h-12 cursor-not-allowed select-none">
                    <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                      ชื่อสินค้า
                    </span>
                    <div className="flex items-center gap-2.5 text-stone-700 text-sm truncate w-full">
                      <span className="text-xs font-bold text-stone-400 shrink-0 font-mono tracking-tighter">ABC</span>
                      <span className="truncate font-normal">{selectedProductForReceive.product_name}</span>
                    </div>
                  </div>

                  {/* หมวดหมู่สินค้า */}
                  <div className="relative border border-stone-200 rounded-md px-3.5 py-2.5 bg-stone-100 flex items-center h-12 cursor-not-allowed select-none">
                    <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                      หมวดหมู่สินค้า
                    </span>
                    <div className="flex items-center gap-2.5 text-stone-700 text-sm truncate w-full">
                      <RiShapesLine className="w-5 h-5 text-stone-400 shrink-0" />
                      <span className="truncate font-normal">{selectedProductForReceive.category_name || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* แถวที่ 2: คำอธิบายสินค้า (เต็มความกว้าง) */}
                <div className="w-full relative border border-stone-200 rounded-md px-3.5 py-2.5 bg-stone-100 flex items-center h-12 cursor-not-allowed select-none">
                  <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                    คำอธิบายสินค้า
                  </span>
                  <div className="flex items-center gap-2.5 text-stone-700 text-sm truncate w-full">
                    <RiFileTextLine className="w-5 h-5 text-stone-400 shrink-0" />
                    <span className="truncate font-normal">
                      {selectedProductForReceive.product_desc || selectedProductForReceive.product_name}
                    </span>
                  </div>
                </div>

                {/* แถวที่ 3: ประเภทสินค้า * | ราคาสินค้า (บาท) * | จำนวนสินค้า * (ต่อกัน 3 ช่อง) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* ประเภทสินค้า * */}
                  <div className="relative border border-stone-300 rounded-md px-3.5 py-2 bg-white flex items-center h-12 focus-within:border-[#2B2F38] focus-within:ring-1 focus-within:ring-[#2B2F38]/20 transition-all">
                    <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                      ประเภทสินค้า *
                    </span>
                    <select
                      value={receiveForm.item_type}
                      onChange={(e) => setReceiveForm((prev) => ({ ...prev, item_type: e.target.value }))}
                      className="w-full bg-transparent outline-none text-sm text-stone-800 cursor-pointer appearance-none pr-6 font-normal"
                    >
                      <option value="normal">สินค้าใหม่</option>
                      <option value="preorder">สินค้าจองล่วงหน้า</option>
                      <option value="waste">สินค้าชำรุด</option>
                      <option value="lost">สินค้าหาย</option>
                    </select>
                    <RiArrowDownSLine className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* ราคาสินค้า (บาท) * */}
                  <div className="relative border border-stone-300 rounded-md px-3.5 py-2 bg-white flex items-center h-12 focus-within:border-[#2B2F38] focus-within:ring-1 focus-within:ring-[#2B2F38]/20 transition-all">
                    <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                      ราคาสินค้า (บาท) *
                    </span>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-stone-500 font-semibold text-base select-none">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={receiveForm.price}
                        onChange={(e) => setReceiveForm((prev) => ({ ...prev, price: e.target.value }))}
                        className="w-full bg-transparent outline-none text-sm text-stone-800 font-normal"
                      />
                    </div>
                  </div>

                  {/* จำนวนสินค้า * */}
                  <div className="relative border border-stone-300 rounded-md px-3.5 py-2 bg-white flex items-center h-12 focus-within:border-[#2B2F38] focus-within:ring-1 focus-within:ring-[#2B2F38]/20 transition-all">
                    <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                      จำนวนสินค้า *
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={receiveForm.quantity}
                      onChange={(e) => setReceiveForm((prev) => ({ ...prev, quantity: e.target.value }))}
                      className="w-full bg-transparent outline-none text-sm text-stone-800 font-normal"
                    />
                    <span className="text-stone-500 text-sm shrink-0 pl-1 select-none">
                      {selectedProductForReceive.unit_name || selectedProductForReceive.uom || 'อัน'}
                    </span>
                  </div>
                </div>

                {/* แถวที่ 4: คำอธิบายเพิ่มเติม (แยกมาไว้ล่างสุด เต็มความกว้าง) */}
                <div className="w-full relative border border-stone-300 rounded-md px-3.5 py-2.5 bg-white flex items-center h-12 focus-within:border-[#2B2F38] focus-within:ring-1 focus-within:ring-[#2B2F38]/20 transition-all">
                  <span className="absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs text-stone-500 font-normal leading-none select-none">
                    คำอธิบายเพิ่มเติม
                  </span>
                  <div className="flex items-center gap-2.5 w-full">
                    <RiChat1Line className="w-5 h-5 text-stone-400 shrink-0" />
                    <input
                      type="text"
                      value={receiveForm.remark}
                      onChange={(e) => setReceiveForm((prev) => ({ ...prev, remark: e.target.value }))}
                      className="w-full bg-transparent outline-none text-sm text-stone-800 font-normal"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* แถบปุ่ม Action มุมขวาล่าง ตามธีมของระบบ */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleReceiveSubmit}
                disabled={isSubmittingReceive}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                <RiPlayListAddLine className="w-4 h-4" />
                <span>{isSubmittingReceive ? 'กำลังบันทึก...' : 'รับสินค้าเข้า'}</span>
              </button>

              <button
                type="button"
                onClick={handleCloseReceiveModal}
                disabled={isSubmittingReceive}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#D32F2F] hover:bg-[#C62828] active:bg-[#B71C1C] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                <RiCloseLine className="w-4 h-4" />
                <span>ยกเลิก</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

