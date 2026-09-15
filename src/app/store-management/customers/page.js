// src/app/store-management/customers/page.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { customerService } from '@/app/services/customerService';
import { userService } from '@/app/services/userService';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiLoader4Line,
  RiAlertLine,
  RiUserFollowLine,
  RiRefreshLine,
  RiHashtag,
  RiAccountBoxLine,
  RiBriefcaseLine,
  RiBuildingLine,
  RiLockLine,
  RiTeamLine,
} from 'react-icons/ri';

export default function StoreCustomersPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const currentStore = useStoreManagementStore((state) => state.currentStore);

  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const showConfirm = useToastStore((state) => state.showConfirm);

  const [customers, setCustomers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal States สำหรับการเพิ่มลูกค้า
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref สำหรับจัดการ Debounce การค้นหาพนักงาน
  const debounceRef = useRef(null);

  // โหลดรายการลูกค้าจาก Backend API
  const loadCustomers = useCallback(
    async (targetPage = page, targetSearch = appliedSearch, targetLimit = rowsPerPage) => {
      if (!currentStore?.store_id) {
        setCustomers([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await customerService.getCustomers(
          {
            store_id: currentStore.store_id,
            search: targetSearch,
            page: targetPage,
            limit: targetLimit,
          },
          token
        );
        setCustomers(res.data || []);
        setTotalCount(res.pagination?.total ?? (res.data || []).length);
      } catch (err) {
        console.error('Failed to load store customers:', err);
        showError(err.message || 'ไม่สามารถโหลดข้อมูลลูกค้าของร้านค้าได้');
      } finally {
        setLoading(false);
      }
    },
    [currentStore?.store_id, token, showError, page, appliedSearch, rowsPerPage]
  );

  useEffect(() => {
    if (currentStore?.store_id) {
      loadCustomers(1, '', rowsPerPage);
    }
  }, [currentStore?.store_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // การค้นหาในตาราง
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    setAppliedSearch(q);
    setPage(1);
    loadCustomers(1, q, rowsPerPage);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
    loadCustomers(1, '', rowsPerPage);
  };

  // การแบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      loadCustomers(newPage, appliedSearch, rowsPerPage);
    }
  };

  const handleRowsPerPageChange = (newRowsPerPage) => {
    setRowsPerPage(newRowsPerPage);
    setPage(1);
    loadCustomers(1, appliedSearch, newRowsPerPage);
  };

  // ─────────────────────────────────────────────────────────────
  // การค้นหาข้อมูลพนักงานแบบ Live Lookup ใน Modal
  // ─────────────────────────────────────────────────────────────
  const performLookup = async (usernameToSearch) => {
    const clean = usernameToSearch.trim().toUpperCase();
    if (!clean) {
      setFoundUser(null);
      setLookupError('');
      setLookupLoading(false);
      return;
    }

    setLookupLoading(true);
    setLookupError('');
    setFoundUser(null);

    try {
      const user = await customerService.getUserByUsername(clean, token);
      setFoundUser(user);

      // ตรวจสอบว่าพนักงานท่านนี้อยู่ในรายชื่อลูกค้าของร้านค้านี้อยู่แล้วหรือไม่
      const isAlreadyCustomer = customers.some((c) => c.username.toUpperCase() === clean);
      if (isAlreadyCustomer) {
        setLookupError('พนักงานท่านนี้อยู่ในรายชื่อลูกค้าของร้านค้านี้อยู่แล้ว');
      }
    } catch (err) {
      setFoundUser(null);
      setLookupError(err.message || 'ไม่พบข้อมูลพนักงานในระบบ');
    } finally {
      setLookupLoading(false);
    }
  };

  // เมื่อผู้ใช้พิมพ์รหัสพนักงาน (Debounce 350ms)
  const handleUsernameChange = (e) => {
    const val = e.target.value.toUpperCase();
    setInputUsername(val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!val.trim()) {
      setFoundUser(null);
      setLookupError('');
      setLookupLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performLookup(val);
    }, 350);
  };


  // เปิด Modal เพิ่มลูกค้า
  const handleOpenAddModal = () => {
    setInputUsername('');
    setFoundUser(null);
    setLookupError('');
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // ปิด Modal เพิ่มลูกค้า
  const handleCloseModal = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsModalOpen(false);
  };

  // บันทึกเพิ่มลูกค้า
  const handleSaveCustomer = async (e) => {
    e?.preventDefault();
    if (!foundUser) {
      showError('กรุณาระบุรหัสผู้ใช้งานและตรวจสอบความถูกต้องก่อนบันทึก');
      return;
    }

    const clean = foundUser.username.toUpperCase();
    const isAlreadyCustomer = customers.some((c) => c.username.toUpperCase() === clean);
    if (isAlreadyCustomer) {
      showError('พนักงานท่านนี้อยู่ในรายชื่อลูกค้าของร้านค้านี้อยู่แล้ว');
      return;
    }

    setIsSubmitting(true);
    try {
      await customerService.addCustomer(
        {
          store_id: currentStore.store_id,
          username: clean,
        },
        token
      );
      const fullName = `${foundUser.firstname_th || ''} ${foundUser.lastname_th || ''}`.trim() || clean;
      showSuccess(`เพิ่มลูกค้า "${fullName}" เรียบร้อยแล้ว`);
      handleCloseModal();
      loadCustomers(page, appliedSearch, rowsPerPage);
    } catch (err) {
      showError(err.message || 'เพิ่มลูกค้าไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // การลบสิทธิ์ลูกค้า
  // ─────────────────────────────────────────────────────────────
  const handleOpenDeleteModal = (customer) => {
    const customerFullName =
      `${customer.firstname_th || customer.firstname || ''} ${customer.lastname_th || customer.lastname || ''}`.trim() ||
      customer.username;

    const dept = customer.department_th || customer.department || '-';

    showConfirm({
      title: 'คุณต้องการลบรายชื่อลูกค้าออกหรือไม่?',
      message: `รหัสผู้ใช้งาน : ${customer.username}\nชื่อ-นามสกุล : ${customerFullName}\nฝ่าย : ${dept}`,
      confirmText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          await customerService.deleteCustomer(
            {
              store_id: currentStore.store_id,
              username: customer.username,
            },
            token
          );
          showSuccess(`ลบลูกค้า "${customerFullName}" เรียบร้อยแล้ว`);
          loadCustomers(page, appliedSearch, rowsPerPage);
        } catch (err) {
          showError(err.message || 'ไม่สามารถลบลูกค้าได้');
        }
      },
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

  // กรณีร้านค้าไม่ใช่ร้านค้า Private
  const isPrivate = currentStore.store_access?.toLowerCase() === 'private';
  if (!isPrivate) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
          <RiLockLine className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-[#2B2F38]">ร้านค้านี้ไม่ใช่ร้านค้าเฉพาะกลุ่ม (Private Store)</h2>
        <p className="text-xs text-stone-500 mt-1 max-w-md mb-5">
          ร้านค้านี้ถูกตั้งค่าเป็น &ldquo;สาธารณะ (Public)&rdquo; ผู้ใช้งานทุกคนสามารถเข้าถึงและสั่งซื้อสินค้าได้โดยตรง จึงไม่จำเป็นต้องกำหนดรายชื่อลูกค้า
        </p>
        <Link
          href="/store-management/info"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2B2F38] hover:bg-[#1E2229] text-white rounded-md text-xs font-medium transition-colors shadow-xs"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          <span>กลับไปหน้าข้อมูลร้านค้า</span>
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
              รายชื่อลูกค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            จัดการรายชื่อลูกค้าและผู้มีสิทธิ์เข้าถึงในการดูและสั่งซื้อสินค้าของร้านค้าเฉพาะกลุ่ม (Private Store)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadCustomers(page, appliedSearch, rowsPerPage)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3 py-2 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RiRefreshLine className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-1.5 bg-[#2B2F38] hover:bg-[#1E2229] text-white text-xs sm:text-sm font-medium px-3.5 py-2 rounded-md transition-colors cursor-pointer shadow-xs active:scale-98"
          >
            <RiAddLine className="w-4 h-4" />
            <span>เพิ่มลูกค้า</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: ช่องค้นหา (Single Search Bar)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหารหัสพนักงาน, ชื่อ-นามสกุล, หรือฝ่าย..."
              className="w-full pl-3.5 pr-9 py-2 bg-white border border-r-0 border-stone-300 rounded-l-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-stone-400/40 focus:outline-none transition-colors"
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
          ส่วนที่ 3: ตารางรายการลูกค้า (ล็อกความสูงตามหน้าจอ)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white">
        <div
          style={{ maxHeight: 'calc(100vh - 320px)' }}
          className="overflow-x-auto overflow-y-auto"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[35rem]">
            <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-12 bg-white">
                  #
                </th>
                <th className="py-2.5 px-5 sm:px-6 font-normal text-[#363636] bg-white w-40 whitespace-nowrap">
                  รหัสพนักงาน
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] bg-white">
                  ชื่อ - นามสกุล
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] bg-white">
                  ฝ่าย / แผนก
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-24 sm:w-28 bg-white whitespace-nowrap">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RiLoader4Line className="w-6 h-6 animate-spin text-stone-400" />
                      <span className="text-xs">กำลังโหลดข้อมูลลูกค้า...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
                        <RiUserFollowLine className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-[#2B2F38]">
                        {appliedSearch ? `ไม่พบลูกค้าที่ตรงกับ "${appliedSearch}"` : 'ยังไม่มีรายชื่อลูกค้าในร้านนี้'}
                      </p>
                      <p className="text-xs text-stone-500 max-w-xs">
                        {appliedSearch ? 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง' : 'กดปุ่ม "+ เพิ่มลูกค้า" ด้านบนเพื่อเพิ่มลูกค้าที่มีสิทธิ์เข้าถึงร้านนี้'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer, idx) => {
                  const fullName =
                    `${customer.firstname_th || customer.firstname || ''} ${customer.lastname_th || customer.lastname || ''}`.trim() ||
                    '-';
                  const dept = customer.department_th || customer.department || '-';

                  return (
                    <tr
                      key={customer.username}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      {/* ลำดับ */}
                      <td className="py-3 px-4 text-center text-stone-400 text-xs">
                        {startIndex + idx}
                      </td>

                      {/* รหัสพนักงาน */}
                      <td className="py-3 px-5 sm:px-6 whitespace-nowrap text-xs sm:text-sm">
                        <span className="font-medium text-[#2B2F38]">{customer.username}</span>
                      </td>

                      {/* ชื่อ - นามสกุล */}
                      <td className="py-3 px-4 text-[#2B2F38] font-medium text-xs sm:text-sm">
                        <p className="font-medium text-[#2B2F38]">{fullName}</p>
                        {customer.email && (
                          <p className="text-xs text-stone-500 font-normal mt-0.5">{customer.email}</p>
                        )}
                      </td>

                      {/* ฝ่าย / แผนก */}
                      <td className="py-3 px-4 text-stone-600 text-xs sm:text-sm">
                        <p>{dept}</p>
                        {customer.section_th && (
                          <p className="text-xs text-stone-400 font-normal mt-0.5">{customer.section_th}</p>
                        )}
                      </td>

                      {/* ปุ่มจัดการ (ปุ่มลบ) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(customer)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                            title="ลบสิทธิ์ลูกค้า"
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
          Modal: เพิ่มลูกค้าใหม่ (ดีไซน์ Outlined Input + Icon Adornment ตามภาพตัวอย่าง)
          ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden font-sans animate-scale p-6 sm:p-7">
            {/* หัวข้อ Modal */}
            <h3 className="text-lg sm:text-xl font-bold text-[#2B2F38] mb-6">
              เพิ่มลูกค้าใหม่
            </h3>

            <form onSubmit={handleSaveCustomer}>
              <div className="space-y-5">
                {/* แถวที่ 1: รหัสผู้ใช้งาน (Dropdown) * และ ชื่อ-นามสกุล */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* ช่องรหัสผู้ใช้งาน * */}
                  <div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                        <RiHashtag className="w-5 h-5 text-stone-600" />
                      </div>
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder=""
                        value={inputUsername}
                        onChange={handleUsernameChange}
                        className="w-full h-12 pl-10 pr-9 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors uppercase font-normal"
                      />
                      <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                        รหัสผู้ใช้งาน <span className="text-stone-500">*</span>
                      </label>
                      {lookupLoading && (
                        <RiLoader4Line className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 animate-spin" />
                      )}
                    </div>
                  </div>

                  {/* ช่องที่ 2: ชื่อ-นามสกุล (Disabled/ReadOnly) */}
                  <div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none flex items-center justify-center">
                        <RiAccountBoxLine className="w-5 h-5 text-stone-400" />
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={
                          foundUser
                            ? `${foundUser.firstname_th || foundUser.firstname || ''} ${foundUser.lastname_th || foundUser.lastname || ''}`.trim()
                            : ''
                        }
                        placeholder=""
                        className="w-full h-12 pl-10 pr-3 bg-stone-100 border border-stone-200 rounded-md text-sm text-stone-700 font-normal cursor-not-allowed select-none focus:outline-none"
                      />
                      <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-500 font-normal pointer-events-none">
                        ชื่อ-นามสกุล
                      </label>
                    </div>
                  </div>
                </div>

                {/* แถวที่ 2: ฝ่าย (Disabled/ReadOnly) */}
                <div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none flex items-center justify-center">
                      <RiBriefcaseLine className="w-5 h-5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={foundUser ? (foundUser.department_th || foundUser.department || '') : ''}
                      placeholder=""
                      className="w-full h-12 pl-10 pr-3 bg-stone-100 border border-stone-200 rounded-md text-sm text-stone-700 font-normal cursor-not-allowed select-none focus:outline-none"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-500 font-normal pointer-events-none">
                      ฝ่าย
                    </label>
                  </div>
                </div>

                {/* แถวที่ 3: แผนก (Disabled/ReadOnly) */}
                <div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none flex items-center justify-center">
                      <RiBuildingLine className="w-5 h-5 text-stone-400" />
                    </div>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={foundUser ? (foundUser.section_th || foundUser.section || '-') : ''}
                      placeholder=""
                      className="w-full h-12 pl-10 pr-3 bg-stone-100 border border-stone-200 rounded-md text-sm text-stone-700 font-normal cursor-not-allowed select-none focus:outline-none"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-500 font-normal pointer-events-none">
                      แผนก
                    </label>
                  </div>
                </div>

                {/* ข้อความแจ้งเตือนเมื่อไม่พบข้อมูลหรือซ้ำ */}
                {lookupError && !lookupLoading && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200/70 rounded-md flex items-center gap-2 text-xs text-rose-700">
                    <RiAlertLine className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{lookupError}</span>
                  </div>
                )}
              </div>

              {/* ปุ่มควบคุมด้านล่างขวา (ปุ่มเพิ่มสีเทา/สีพร้อมกด, ปุ่มยกเลิกสีแดง) */}
              <div className="flex items-center justify-end gap-3 mt-7">
                <button
                  type="submit"
                  disabled={!foundUser || Boolean(lookupError) || isSubmitting}
                  className={`px-5 py-2 rounded text-sm font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs ${foundUser && !lookupError && !isSubmitting
                      ? 'bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white cursor-pointer'
                      : 'bg-[#E0E0E0] text-stone-500 cursor-not-allowed'
                    }`}
                >
                  {isSubmitting ? (
                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                  ) : (
                    <RiAddLine className="w-4 h-4" />
                  )}
                  <span>เพิ่ม</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
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
