// src/app/store-management/owners/page.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { ownerService } from '@/app/services/ownerService';
import { userService } from '@/app/services/userService';
import TablePagination from '@/app/components/ui/TablePagination';
import DataTable from '@/app/components/ui/DataTable';
import TableActionButton from '@/app/components/ui/TableActionButton';
import OutlinedField from '@/app/components/ui/OutlinedField';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiStore2Line,
  RiArrowLeftLine,
  RiLoader4Line,
  RiAlertLine,
  RiTeamLine,
  RiSearchLine,
  RiUserLine,
  RiBuildingLine,
  RiCheckLine,
  RiRefreshLine,
  RiHashtag,
  RiAccountBoxLine,
  RiBriefcaseLine,
} from 'react-icons/ri';

export default function StoreOwnersPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const currentUsername = (userInfo?.info?.username || '').trim().toUpperCase();
  const currentStore = useStoreManagementStore((state) => state.currentStore);

  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const showConfirm = useToastStore((state) => state.showConfirm);

  const [owners, setOwners] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Search States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modal States สำหรับการเพิ่มผู้ดูแล
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref สำหรับจัดการ Debounce การค้นหาพนักงาน
  const debounceRef = useRef(null);

  // โหลดรายการผู้ดูแลร้านค้าจาก Backend API
  const loadOwners = useCallback(
    async (targetPage = page, targetSearch = appliedSearch, targetLimit = rowsPerPage) => {
      if (!currentStore?.store_id) {
        setOwners([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await ownerService.getOwners(
          {
            store_id: currentStore.store_id,
            search: targetSearch,
            page: targetPage,
            limit: targetLimit,
          },
          token
        );
        setOwners(res.data || []);
        setTotalCount(res.pagination?.total ?? (res.data || []).length);
      } catch (err) {
        console.error('Failed to load store owners:', err);
        showError(err.message || 'ไม่สามารถโหลดข้อมูลผู้ดูแลร้านค้าได้');
      } finally {
        setLoading(false);
      }
    },
    [currentStore?.store_id, token, showError, page, appliedSearch, rowsPerPage]
  );

  useEffect(() => {
    if (currentStore?.store_id) {
      loadOwners(1, '', rowsPerPage);
    }
  }, [currentStore?.store_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // การค้นหาในตาราง
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    setAppliedSearch(q);
    setPage(1);
    loadOwners(1, q, rowsPerPage);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
    loadOwners(1, '', rowsPerPage);
  };

  // การแบ่งหน้า
  const handlePageChange = (newPage) => {
    if (newPage !== page) {
      setPage(newPage);
      loadOwners(newPage, appliedSearch, rowsPerPage);
    }
  };

  const handleRowsPerPageChange = (newRowsPerPage) => {
    setRowsPerPage(newRowsPerPage);
    setPage(1);
    loadOwners(1, appliedSearch, newRowsPerPage);
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
      const user = await ownerService.getUserByUsername(clean, token);
      setFoundUser(user);

      // ตรวจสอบว่าพนักงานท่านนี้เป็นผู้ดูแลร้านค้านี้อยู่แล้วหรือไม่
      const isAlreadyOwner = owners.some((o) => o.username.toUpperCase() === clean);
      if (isAlreadyOwner) {
        setLookupError('พนักงานท่านนี้เป็นผู้ดูแลของร้านค้านี้อยู่แล้ว');
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


  // เปิด Modal เพิ่มผู้ดูแล
  const handleOpenAddModal = () => {
    setInputUsername('');
    setFoundUser(null);
    setLookupError('');
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // ปิด Modal เพิ่มผู้ดูแล
  const handleCloseModal = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsModalOpen(false);
  };

  // บันทึกเพิ่มผู้ดูแล
  const handleSaveOwner = async (e) => {
    e?.preventDefault();
    if (!foundUser) {
      showError('กรุณาระบุรหัสพนักงานและตรวจสอบความถูกต้องก่อนบันทึก');
      return;
    }

    const clean = foundUser.username.toUpperCase();
    const isAlreadyOwner = owners.some((o) => o.username.toUpperCase() === clean);
    if (isAlreadyOwner) {
      showError('พนักงานท่านนี้เป็นผู้ดูแลของร้านค้านี้อยู่แล้ว');
      return;
    }

    setIsSubmitting(true);
    try {
      await ownerService.addOwner(
        {
          store_id: currentStore.store_id,
          username: clean,
        },
        token
      );
      const fullName = `${foundUser.firstname_th || ''} ${foundUser.lastname_th || ''}`.trim() || clean;
      showSuccess(`เพิ่มผู้ดูแล "${fullName}" เรียบร้อยแล้ว`);
      handleCloseModal();
      loadOwners(page, appliedSearch, rowsPerPage);
    } catch (err) {
      showError(err.message || 'เพิ่มผู้ดูแลร้านค้าไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // การลบผู้ดูแลร้านค้า (พร้อมกฎเหล็ก: ห้ามลบตัวเอง)
  // ─────────────────────────────────────────────────────────────
  const handleOpenDeleteModal = (owner) => {
    const targetUsername = owner.username.toUpperCase();

    // ❌ กฎเหล็ก: ห้ามลบตนเอง
    if (targetUsername === currentUsername) {
      showError('ไม่สามารถลบสิทธิ์ผู้ดูแลของตนเองได้');
      return;
    }

    const ownerFullName =
      `${owner.firstname_th || owner.firstname || ''} ${owner.lastname_th || owner.lastname || ''}`.trim() ||
      owner.username;

    const dept = owner.department_th || owner.department || '-';

    showConfirm({
      title: 'คุณต้องการลบผู้ดูแลร้านออกหรือไม่?',
      message: `รหัสผู้ใช้งาน : ${owner.username}\nชื่อ-นามสกุล : ${ownerFullName}\nฝ่าย : ${dept}`,
      confirmText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          await ownerService.deleteOwner(
            {
              store_id: currentStore.store_id,
              username: owner.username,
            },
            token
          );
          showSuccess(`ลบผู้ดูแล "${ownerFullName}" เรียบร้อยแล้ว`);
          loadOwners(page, appliedSearch, rowsPerPage);
        } catch (err) {
          showError(err.message || 'ไม่สามารถลบผู้ดูแลร้านค้าได้');
        }
      },
    });
  };

  // จัดรูปแบบวันที่
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
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

  const startIndex = (page - 1) * rowsPerPage + 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มแอ็กชัน (Header Bar)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              ผู้ดูแลร้านค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            จัดการรายชื่อเจ้าของและผู้มีสิทธิ์ดูแลร้านค้าในการจัดการสินค้าและการทำงานของร้าน
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadOwners(page, appliedSearch, rowsPerPage)}
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
            <span>เพิ่มผู้ดูแล</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: ช่องค้นหา (Single Search Bar สไตล์เดียวกับหมวดหมู่/ตำแหน่ง)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหารหัสพนักงาน, ชื่อ-นามสกุล, หรือฝ่าย..."
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
          ส่วนที่ 3 & 4: ตารางรายการผู้ดูแลร้านค้า (ล็อกความสูงตามหน้าจอ) + Pagination
          ───────────────────────────────────────────────────────────── */}
      <DataTable
        columns={[
          {
            key: 'index',
            label: '#',
            align: 'center',
            width: 'w-12',
            render: (_row, idx) => (
              <span className="text-stone-400 text-xs">{startIndex + idx}</span>
            ),
          },
          {
            key: 'username',
            label: 'รหัสพนักงาน',
            width: 'w-40',
            render: (owner) => {
              const isSelf = owner.username.toUpperCase() === currentUsername;
              return (
                <div className="flex items-center min-w-0 pr-2">
                  <span className="font-medium text-[#2B2F38] text-xs sm:text-sm truncate">
                    {owner.username}
                  </span>
                  {isSelf && (
                    <span className="text-stone-400 font-normal ml-1.5 shrink-0 text-xs">
                      (คุณ)
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'fullname',
            label: 'ชื่อ - นามสกุล',
            render: (owner) => {
              const fullName =
                `${owner.firstname_th || owner.firstname || ''} ${owner.lastname_th || owner.lastname || ''}`.trim() ||
                '-';
              return (
                <div className="flex flex-col justify-center min-w-0 pr-2">
                  <p className="font-medium text-[#2B2F38] text-xs sm:text-sm truncate" title={fullName}>
                    {fullName}
                  </p>
                  {owner.email ? (
                    <p className="text-xs text-stone-500 font-normal truncate mt-0.5" title={owner.email}>
                      {owner.email}
                    </p>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'department',
            label: 'ฝ่าย / แผนก',
            render: (owner) => {
              const dept = owner.department_th || owner.department || '-';
              return (
                <div className="flex flex-col justify-center min-w-0 pr-2">
                  <p className="text-xs sm:text-sm text-stone-600 truncate" title={dept}>
                    {dept}
                  </p>
                  {owner.section_th ? (
                    <p className="text-xs text-stone-400 font-normal truncate mt-0.5" title={owner.section_th}>
                      {owner.section_th}
                    </p>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: 'actions',
            label: 'จัดการ',
            align: 'center',
            width: 'w-24 sm:w-28',
            render: (owner) => {
              const isSelf = owner.username.toUpperCase() === currentUsername;
              return (
                <div className="flex items-center justify-center">
                  <TableActionButton
                    icon="delete"
                    title={isSelf ? 'ไม่สามารถลบสิทธิ์ผู้ดูแลของตนเองได้' : 'ลบผู้ดูแลร้านค้า'}
                    disabled={isSelf}
                    onClick={() => handleOpenDeleteModal(owner)}
                  />
                </div>
              );
            },
          },
        ]}
        data={owners}
        rowKey="username"
        loading={loading}
        loadingText="กำลังโหลดข้อมูลผู้ดูแลร้านค้า..."
        emptyState={{
          icon: RiTeamLine,
          title: appliedSearch ? `ไม่พบผู้ดูแลที่ตรงกับ "${appliedSearch}"` : 'ยังไม่มีผู้ดูแลในร้านนี้',
          description: appliedSearch ? 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง' : 'กดปุ่ม "+ เพิ่มผู้ดูแล" ด้านบนเพื่อเพิ่มผู้ดูแลร้าน',
        }}
        rowHeight="h-14"
        maxHeight="calc(100vh - 320px)"
        minWidth="min-w-[35rem]"
        pagination={{
          page,
          totalCount,
          rowsPerPage,
          onPageChange: handlePageChange,
          onRowsPerPageChange: handleRowsPerPageChange,
          loading,
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          Modal: เพิ่มผู้ดูแลร้านค้าใหม่ (ดีไซน์ Outlined Input + Icon Adornment ตามภาพตัวอย่าง)
          ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden font-sans animate-scale p-6 sm:p-7">
            {/* หัวข้อ Modal */}
            <h3 className="text-lg sm:text-xl font-bold text-[#2B2F38] mb-6">
              เพิ่มผู้ดูแลร้านค้าใหม่
            </h3>

            <form onSubmit={handleSaveOwner}>
              <div className="space-y-5">
                {/* แถวที่ 1: รหัสผู้ใช้งาน (Dropdown) * และ ชื่อ-นามสกุล */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <OutlinedField
                    label="รหัสผู้ใช้งาน *"
                    type="text"
                    required
                    autoFocus
                    uppercase
                    prefix={<RiHashtag className="w-5 h-5 text-stone-600" />}
                    suffix={lookupLoading ? <RiLoader4Line className="w-4 h-4 text-stone-400 animate-spin" /> : null}
                    value={inputUsername}
                    onChange={handleUsernameChange}
                  />

                  <OutlinedField
                    label="ชื่อ-นามสกุล"
                    readOnly
                    prefix={<RiAccountBoxLine className="w-5 h-5 text-stone-400" />}
                    value={
                      foundUser
                        ? `${foundUser.firstname_th || foundUser.firstname || ''} ${foundUser.lastname_th || foundUser.lastname || ''}`.trim()
                        : ''
                    }
                  />
                </div>

                {/* แถวที่ 2: ฝ่าย (Disabled/ReadOnly) */}
                <OutlinedField
                  label="ฝ่าย"
                  readOnly
                  prefix={<RiBriefcaseLine className="w-5 h-5 text-stone-400" />}
                  value={foundUser ? (foundUser.department_th || foundUser.department || '') : ''}
                />

                {/* แถวที่ 3: แผนก (Disabled/ReadOnly) */}
                <OutlinedField
                  label="แผนก"
                  readOnly
                  prefix={<RiBuildingLine className="w-5 h-5 text-stone-400" />}
                  value={foundUser ? (foundUser.section_th || foundUser.section || '-') : ''}
                />

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
