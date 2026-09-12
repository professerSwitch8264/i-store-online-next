// src/app/store-management/categories/page.js
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { categoryService } from '@/app/services/categoryService';
import {
  RiAddLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiCloseLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiLoader4Line,
  RiAlertLine,
  RiGridLine,
  RiRefreshLine,
  RiFileTextLine,
  RiCheckLine,
} from 'react-icons/ri';

export default function StoreCategoriesPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const currentStore = useStoreManagementStore((state) => state.currentStore);

  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const showConfirm = useToastStore((state) => state.showConfirm);

  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [formData, setFormData] = useState({
    category_id: null,
    category_name: '',
    category_desc: '',
    en: 'Y',
    product_count: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggling status loading tracker by ID
  const [togglingId, setTogglingId] = useState(null);

  // โหลดรายการหมวดหมู่สินค้าจาก Backend API แบบ Server-Side Search & Pagination
  const loadCategories = useCallback(
    async (targetPage = page, targetSearch = appliedSearch, targetLimit = rowsPerPage) => {
      if (!currentStore?.store_id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await categoryService.getCategories(
          {
            store_id: currentStore.store_id,
            search: targetSearch,
            page: targetPage,
            limit: targetLimit,
          },
          token
        );
        setCategories(res.data || []);
        setTotalCount(res.pagination?.total ?? (res.data || []).length);
      } catch (err) {
        console.error('Failed to load categories:', err);
        showError(err.message || 'ไม่สามารถโหลดข้อมูลหมวดหมู่สินค้าได้');
      } finally {
        setLoading(false);
      }
    },
    [currentStore?.store_id, token, showError, page, appliedSearch, rowsPerPage]
  );

  useEffect(() => {
    if (currentStore?.store_id) {
      loadCategories(1, '', rowsPerPage);
    }
  }, [currentStore?.store_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // การค้นหา (ส่งคำค้นหาไปยังฐานข้อมูลจริง)
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    setAppliedSearch(q);
    setPage(1);
    loadCategories(1, q, rowsPerPage);
  };

  // ล้างคำค้นหา
  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
    loadCategories(1, '', rowsPerPage);
  };

  // การแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page || loading) return;
    setPage(newPage);
    loadCategories(newPage, appliedSearch, rowsPerPage);
  };

  const handleRowsPerPageChange = (newLimit) => {
    setRowsPerPage(newLimit);
    setPage(1);
    loadCategories(1, appliedSearch, newLimit);
  };

  // เปิด Modal เพิ่มหมวดหมู่
  const handleOpenCreateModal = () => {
    setFormData({
      category_id: null,
      category_name: '',
      category_desc: '',
      en: 'Y',
      product_count: 0,
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  // เปิด Modal แก้ไขหมวดหมู่
  const handleOpenEditModal = (cat) => {
    setFormData({
      category_id: cat.category_id,
      category_name: cat.category_name,
      category_desc: cat.category_desc || '',
      en: cat.en || 'Y',
      product_count: Number(cat.product_count) || 0,
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  // บันทึกข้อมูลเพิ่ม/แก้ไขหมวดหมู่
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.category_name.trim()) {
      showError('กรุณากรอกชื่อหมวดหมู่สินค้า');
      return;
    }

    if (formData.en === 'N' && (formData.product_count || 0) > 0) {
      showError(
        `ไม่สามารถปิดการใช้งานได้ เนื่องจากมีสินค้าใช้งานหมวดหมู่นี้อยู่ ${formData.product_count} รายการ`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        await categoryService.createCategory(
          {
            store_id: currentStore.store_id,
            category_name: formData.category_name.trim(),
            category_desc: formData.category_desc.trim(),
            en: formData.en,
          },
          token
        );
        showSuccess('เพิ่มหมวดหมู่สินค้าสำเร็จ');
      } else {
        await categoryService.updateCategory(
          {
            category_id: formData.category_id,
            category_name: formData.category_name.trim(),
            category_desc: formData.category_desc.trim(),
            en: formData.en,
          },
          token
        );
        showSuccess('แก้ไขหมวดหมู่สินค้าสำเร็จ');
      }
      setIsModalOpen(false);
      loadCategories(page, appliedSearch, rowsPerPage);
    } catch (err) {
      console.error('Save category error:', err);
      showError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // สลับสถานะเปิด/ปิด (Direct Toggle on row)
  const handleToggleStatus = async (cat) => {
    const pCount = Number(cat.product_count) || 0;
    if (cat.en === 'Y' && pCount > 0) {
      showError(
        `ไม่สามารถปิดการใช้งานได้ เนื่องจากมีสินค้าใช้งานหมวดหมู่นี้อยู่ ${pCount} รายการ`
      );
      return;
    }

    const newEn = cat.en === 'Y' ? 'N' : 'Y';
    const prevCategories = [...categories];

    // Optimistic Update
    setCategories((prev) =>
      prev.map((item) =>
        item.category_id === cat.category_id ? { ...item, en: newEn } : item
      )
    );
    setTogglingId(cat.category_id);

    try {
      await categoryService.updateCategory(
        {
          category_id: cat.category_id,
          en: newEn,
        },
        token
      );
      showSuccess(
        newEn === 'Y'
          ? `เปิดใช้งานหมวดหมู่ "${cat.category_name}" แล้ว`
          : `ปิดใช้งานหมวดหมู่ "${cat.category_name}" แล้ว`
      );
    } catch (err) {
      console.error('Toggle status error:', err);
      showError(err.message || 'ไม่สามารถเปลี่ยนสถานะได้');
      // Revert on error
      setCategories(prevCategories);
    } finally {
      setTogglingId(null);
    }
  };

  // เปิด Popup ถามยืนยันการลบหมวดหมู่ (ใช้ธีมมาตรฐานของระบบ)
  const handleOpenDeleteModal = (cat) => {
    const pCount = Number(cat.product_count) || 0;
    if (pCount > 0) {
      showError(
        `ไม่สามารถลบหมวดหมู่นี้ได้ เนื่องจากมีสินค้าใช้งานอยู่ ${pCount} รายการ (สามารถเลือกปิดสวิตช์สถานะแทนได้)`
      );
      return;
    }

    showConfirm({
      title: 'ยืนยันการลบหมวดหมู่สินค้า',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${cat.category_name}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      confirmText: 'ยืนยันการลบ',
      cancelText: 'ยกเลิก',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          await categoryService.deleteCategory(cat.category_id, token);
          showSuccess(`ลบหมวดหมู่ "${cat.category_name}" เรียบร้อยแล้ว`);
          const targetPage = categories.length === 1 && page > 1 ? page - 1 : page;
          if (targetPage !== page) setPage(targetPage);
          loadCategories(targetPage, appliedSearch, rowsPerPage);
        } catch (err) {
          console.error('Delete category error:', err);
          showError(err.message || 'เกิดข้อผิดพลาดในการลบหมวดหมู่');
        }
      },
    });
  };

  // กรณีผู้ใช้ยังไม่ได้เลือกร้านค้า
  if (!currentStore) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiStore2Line className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#2B2F38]">ยังไม่ได้เลือกร้านค้าที่ต้องการจัดการ</h3>
        <p className="text-xs text-[#363636]/70 mt-1 mb-5 max-w-sm">
          กรุณาเลือกร้านค้าจากหน้ารวมร้านค้าก่อนเพื่อจัดการหมวดหมู่สินค้า
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มแอ็กชัน (Header Bar)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              หมวดหมู่สินค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            จัดการหมวดหมู่สินค้าทั้งหมดในร้านค้า
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadCategories(page, appliedSearch, rowsPerPage)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3 py-2 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RiRefreshLine className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-1.5 bg-[#2B2F38] hover:bg-[#1E2229] text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-md transition-colors cursor-pointer shadow-xs active:scale-98"
          >
            <RiAddLine className="w-4 h-4" />
            <span>เพิ่มหมวดหมู่</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: ช่องค้นหา (Single Search Bar สไตล์เดียวกับหน้ารอจัดเตรียม)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาชื่อหรือรายละเอียดหมวดหมู่สินค้า..."
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
          ส่วนที่ 3: ตารางรายการหมวดหมู่สินค้า (ล็อกความสูงตามหน้าจอ)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white">
        <div
          style={{ maxHeight: 'calc((100vh / 1.1) - 270px)' }}
          className="overflow-x-auto overflow-y-auto"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[560px]">
            <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-2.5 px-5 sm:px-6 font-normal text-[#363636] bg-white">
                  หมวดหมู่
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-28 sm:w-32 bg-white whitespace-nowrap">
                  ใช้งานอยู่
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-28 sm:w-36 bg-white whitespace-nowrap">
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
                  <td colSpan={4} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RiLoader4Line className="w-6 h-6 animate-spin text-stone-400" />
                      <span className="text-xs">กำลังโหลดข้อมูลหมวดหมู่สินค้า...</span>
                    </div>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
                        <RiGridLine className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-[#2B2F38]">
                        {appliedSearch ? `ไม่พบหมวดหมู่ที่ตรงกับ "${appliedSearch}"` : 'ยังไม่มีหมวดหมู่สินค้าในร้านนี้'}
                      </p>
                      <p className="text-xs text-stone-500 max-w-xs">
                        {appliedSearch ? 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง' : 'กดปุ่ม "+ เพิ่มหมวดหมู่" ด้านบนเพื่อสร้างหมวดหมู่แรก'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => {
                  const isActive = cat.en === 'Y';
                  const isToggling = togglingId === cat.category_id;
                  const inUseCount = Number(cat.product_count) || 0;

                  return (
                    <tr
                      key={cat.category_id}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      {/* ชื่อหมวดหมู่ */}
                      <td className="py-3 px-5 sm:px-6 text-[#2B2F38] font-medium text-xs sm:text-sm">
                        <p className="font-medium text-[#2B2F38]">{cat.category_name}</p>
                        {cat.category_desc && (
                          <p className="text-xs text-stone-500 font-normal mt-0.5">
                            {cat.category_desc}
                          </p>
                        )}
                      </td>

                      {/* ใช้งานอยู่ (จำนวนสินค้าในหมวดหมู่นี้) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            inUseCount > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {inUseCount} รายการ
                        </span>
                      </td>

                      {/* สวิตช์สถานะเปิด/ปิด (Toggle Switch) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cat)}
                            disabled={isToggling}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#EB6E3E] ${
                              isActive ? 'bg-[#2B2F38]' : 'bg-stone-300'
                            }`}
                            title={
                              isActive
                                ? 'คลิกเพื่อปิดใช้งาน'
                                : 'คลิกเพื่อเปิดใช้งาน'
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* คอลัมน์ Action: รวมปุ่มแก้ไข และปุ่มลบ (สไตล์สีระบบ และ hover เป็นสีส้ม) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1">
                          {/* ปุ่มแก้ไข */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cat)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                            title="แก้ไขหมวดหมู่"
                          >
                            <RiEdit2Line className="w-4.5 h-4.5" />
                          </button>

                          {/* ปุ่มลบ */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(cat)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                            title="ลบหมวดหมู่"
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
          Modal: เพิ่ม / แก้ไขหมวดหมู่สินค้า (ดีไซน์ Outlined Input ตามแบบหน้าผู้ดูแลและลูกค้า)
          ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden font-sans animate-scale p-6 sm:p-7">
            {/* หัวข้อ Modal */}
            <h3 className="text-lg sm:text-xl font-bold text-[#2B2F38] mb-6">
              {modalMode === 'create' ? 'สร้างหมวดหมู่สินค้าใหม่' : 'แก้ไขหมวดหมู่สินค้า'}
            </h3>

            <form onSubmit={handleSubmitForm}>
              <div className="space-y-5">
                {/* ช่องชื่อหมวดหมู่สินค้า */}
                <div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                      <RiGridLine className="w-5 h-5 text-stone-600" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder=""
                      value={formData.category_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, category_name: e.target.value }))
                      }
                      className="w-full h-12 pl-10 pr-4 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                      ชื่อหมวดหมู่สินค้า <span className="text-stone-500">*</span>
                    </label>
                  </div>
                </div>

                {/* ช่องคำอธิบายหมวดหมู่สินค้า */}
                <div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                      <RiFileTextLine className="w-5 h-5 text-stone-600" />
                    </div>
                    <input
                      type="text"
                      placeholder=""
                      value={formData.category_desc}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, category_desc: e.target.value }))
                      }
                      className="w-full h-12 pl-10 pr-4 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                      คำอธิบายหมวดหมู่สินค้า
                    </label>
                  </div>
                </div>

                {/* สวิตช์สถานะเปิดใช้งาน */}
                <div className="pt-3 pb-1 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-stone-800">
                        สถานะการเปิดใช้งาน
                      </p>
                      <p className="text-[11px] text-stone-500">
                        เมื่อเปิดใช้งาน จะสามารถเลือกหมวดหมู่นี้ในรายการสินค้าได้
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.en === 'Y' && (formData.product_count || 0) > 0) {
                          showError(
                            `ไม่สามารถปิดการใช้งานได้ เนื่องจากมีสินค้าใช้งานหมวดหมู่นี้อยู่ ${formData.product_count} รายการ`
                          );
                          return;
                        }
                        setFormData((prev) => ({
                          ...prev,
                          en: prev.en === 'Y' ? 'N' : 'Y',
                        }));
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                        formData.en === 'Y' ? 'bg-[#2B2F38]' : 'bg-stone-300'
                      }`}
                      title={formData.en === 'Y' ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-1 ${
                          formData.en === 'Y' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {formData.en === 'Y' && (formData.product_count || 0) > 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
                      <RiAlertLine className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>
                        หมวดหมู่นี้มีสินค้าใช้งานอยู่ {formData.product_count} รายการ ไม่อนุญาตให้ปิดการใช้งาน
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* ปุ่มควบคุมด้านล่างขวา (ปุ่มสร้าง/บันทึก, ปุ่มยกเลิกสีแดง) */}
              <div className="flex items-center justify-end gap-3 mt-7">
                <button
                  type="submit"
                  disabled={!formData.category_name.trim() || isSubmitting}
                  className={`px-5 py-2 rounded text-sm font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                    formData.category_name.trim() && !isSubmitting
                      ? 'bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white cursor-pointer'
                      : 'bg-[#E0E0E0] text-stone-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                  ) : modalMode === 'create' ? (
                    <RiAddLine className="w-4 h-4" />
                  ) : (
                    <RiCheckLine className="w-4 h-4" />
                  )}
                  <span>{modalMode === 'create' ? 'สร้าง' : 'บันทึก'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#D32F2F] hover:bg-[#C62828] active:bg-[#B71C1C] text-white rounded text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <RiCloseLine className="w-4 h-4" />
                  <span>ยกเลิก</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
