// src/app/store-management/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useStoreOrderStore } from '@/app/stores/useStoreOrderStore';
import { getStoreLogoUrl } from '@/app/lib/utils';
import { FaShop } from 'react-icons/fa6';
import {
  RiArrowRightLine,
  RiBox3Line,
  RiStore2Line,
  RiTeamLine,
  RiSearchLine,
  RiTimeLine,
} from 'react-icons/ri';

/**
 * =========================================================================
 * Page: หน้ารวมร้านค้าที่ดูแล (Store Management Hub / Store Picker)
 * Route: /store-management
 * =========================================================================
 * หน้าที่:
 * 1. ดึงข้อมูลร้านค้าทั้งหมดที่ผู้ใช้งานคนนี้เป็นผู้ดูแล (Owners) หรือถ้าเป็น Admin จะดึงทุกร้าน
 * 2. แสดงผลเป็นการ์ดร้านค้า (Store Cards) ให้ผู้ใช้คลิกเลือก
 * 3. แจ้งเตือนสถานะ "กำลังเตรียมสินค้า" เด่นชัด เพื่อให้เจ้าหน้าที่ทราบทันทีว่ามีของต้องจัดเตรียม
 * 4. เมื่อกด "จัดการร้านค้านี้" จะบันทึกร้านที่เลือกและพาเข้าสู่หน้ารายการขาย (/store-management/orders)
 * =========================================================================
 */

export default function StoreManagementHubPage() {
  const router = useRouter();
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;

  const {
    stores,
    loading,
    error,
    pagination,
    appliedSearch,
    fetchUserStores,
    setCurrentStore,
  } = useStoreManagementStore();

  const [searchInput, setSearchInput] = useState(''); // ข้อความที่กำลังพิมพ์อยู่ในช่องค้นหา

  // โหลดข้อมูลร้านค้าครั้งแรกผ่าน API (ดึงทีละ 6 รายการจากฐานข้อมูลจริง)
  useEffect(() => {
    if (token) {
      fetchUserStores(token, { page: 1, limit: 6, search: '' });
    }
  }, [token, fetchUserStores]);

  const handleSelectStore = (store, initialTab = 'ALL') => {
    setCurrentStore(store);
    if (initialTab === 'PREPARING') {
      router.push('/store-management/preparation');
      return;
    }
    if (initialTab !== 'ALL') {
      useStoreOrderStore.getState().setSelectedTab(initialTab, token, store.store_id);
    }
    router.push('/store-management/orders');
  };

  // ฟังก์ชันกดยืนยันการค้นหา (ยิง API ค้นหาจากฐานข้อมูลจริง พร้อมดึงทีละ 6 รายการ)
  const handleSearchSubmit = () => {
    const trimmed = searchInput.trim();
    fetchUserStores(token, { page: 1, limit: 6, search: trimmed });
    setSearchInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  // ฟังก์ชันล้างคำค้นหา (ยิง API ดึงรายการร้านค้าทั้งหมดกลับมา)
  const handleClearSearch = () => {
    setSearchInput('');
    fetchUserStores(token, { page: 1, limit: 6, search: '' });
  };

  // ตัวแปรที่เชื่อมต่อกับ API โดยรักษาโครงสร้างตัวแปรของ UI เดิมไว้ครบถ้วน
  const totalPages = pagination?.totalPages || 1;
  const validPage = pagination?.page || 1;
  const totalStores = pagination?.total || 0;
  const paginatedStores = stores;
  const filteredStores = { length: totalStores };

  // ฟังก์ชันเปลี่ยนหน้า (ยิง API หน้าใหม่ พร้อมรักษาคำค้นหาเดิม)
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === validPage || loading) {
      return;
    }
    fetchUserStores(token, { page: newPage, limit: 6, search: appliedSearch });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (validPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex-1 flex flex-col w-full">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Bar: ระบบจัดการร้านค้า (สไตล์บาร์หน้าเบิกสินค้า ชิดขอบบน sticky top-8)
          ───────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white border-b border-stone-200 sticky top-8 z-40 shadow-xs select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            {/* ฝั่งซ้าย: ไอคอนร้านค้า + หัวข้อ + คำอธิบาย */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#2B2F38] text-[#F5A82A] flex items-center justify-center shadow-xs shrink-0">
                <FaShop className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-[#2B2F38] truncate">
                    ระบบจัดการร้านค้า
                  </h1>
                </div>
                <p className="text-[11px] sm:text-xs text-stone-500 truncate hidden xs:block font-normal mt-0.5">
                  เลือกร้านค้าที่คุณต้องการตรวจสอบรายการขาย จัดการสต็อกสินค้า หรือตั้งค่าร้านค้า
                </p>
              </div>
            </div>

            {/* ฝั่งขวา: กล่องค้นหาร้านค้า (Search Box สไตล์รูปแรก: กรอบและปุ่มเชื่อมชิดกันไร้รอยต่อ สี Deep Charcoal ของเรา) */}
            <div className="w-52 sm:w-64 md:w-80 shrink-0">
              <div className="w-full h-8 sm:h-9 flex items-center bg-white rounded-md border border-stone-300 overflow-hidden transition-all focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-[#EB6E3E]/30 shadow-2xs">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ค้นหาชื่อร้านค้า หรือรายละเอียดร้านค้า..."
                  className="flex-1 min-w-0 h-full bg-transparent text-xs text-[#2B2F38] placeholder-stone-400 focus:outline-none px-2.5 sm:px-3 font-normal"
                />

                {/* ปุ่มแว่นขยายค้นหา สไตล์กล่องรูปแรก: สูงเต็มขอบ ชิดขวา สี Deep Charcoal ของเรา */}
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white px-3.5 sm:px-4.5 h-full transition-colors shrink-0 flex items-center justify-center cursor-pointer font-medium"
                  title="ค้นหา"
                >
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white"
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
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. แสดงรายการการ์ดร้านค้า (Store Cards Grid)
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* แถบแสดงหัวข้อร้านค้า และสรุปจำนวนผลลัพธ์ที่พบ (Store Sub-header Bar ตามแบบ SearchKeywords) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-4 sm:mb-5 border-b border-stone-200 select-none">
          {/* ฝั่งซ้าย: หัวข้อ 'รายการร้านค้าทั้งหมด' หรือ 'ร้านค้าที่ค้นพบ' พร้อมแท็กคำค้นหา */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-[#2B2F38] shrink-0">
              {appliedSearch ? 'ร้านค้าที่ค้นพบ' : 'รายการร้านค้าทั้งหมด'}
            </h2>

            {appliedSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-[#2B2F38] border border-stone-300 shadow-2xs animate-fadeIn">
                <span>&lsquo;{appliedSearch}&rsquo;</span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-stone-400 hover:text-[#2B2F38] font-bold ml-0.5 cursor-pointer text-xs transition-colors"
                  title={`ล้างคำค้นหา '${appliedSearch}'`}
                >
                  ✕
                </button>
              </span>
            )}

            {appliedSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-[11px] text-stone-500 hover:text-black underline font-medium cursor-pointer ml-1 transition-colors"
                title="ล้างคำค้นหาทั้งหมด"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          {/* ฝั่งขวา: จำนวนร้านค้าที่พบ เช่น 'พบทั้งหมด 32 รายการ' */}
          <div className="text-xs sm:text-sm font-medium text-stone-500 shrink-0">
            {loading ? (
              <span className="inline-block w-20 h-4 bg-stone-200 rounded animate-pulse" />
            ) : (
              <span>
                พบทั้งหมด{' '}
                <strong className="text-black font-bold">
                  {filteredStores.length}
                </strong>{' '}
                รายการ
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="relative bg-white rounded-xl border border-stone-200 p-5 shadow-xs animate-pulse flex flex-col justify-between"
              >
                <div className="absolute top-5 right-5 h-4 bg-stone-100 rounded-full w-12" />
                <div>
                  {/* หัวการ์ด Skeleton */}
                  <div className="flex items-start gap-3.5 mb-3.5 pr-14">
                    <div className="w-13 h-13 rounded-xl bg-stone-200 shrink-0" />

                    <div className="min-w-0 flex-1">
                      <div className="h-4 bg-stone-200 rounded w-28 mb-1.5" />
                      <div className="h-3.5 bg-stone-100 rounded w-3/4" />
                    </div>
                  </div>

                  {/* สรุปข้อมูลย่อย Skeleton: สินค้า / พนักงาน */}
                  <div className="flex items-center gap-4 text-xs my-3">
                    <div className="h-3.5 bg-stone-100 rounded w-16" />
                    <div className="h-3.5 bg-stone-100 rounded w-16" />
                  </div>

                  {/* กล่องสถานะ Skeleton */}
                  <div className="w-full h-9 bg-stone-100 rounded-lg mb-3.5" />
                </div>

                {/* ปุ่มแอ็กชัน Skeleton */}
                <div className="w-full py-2.5 px-4 bg-stone-200 rounded-lg flex items-center justify-center">
                  <div className="h-4 bg-stone-300 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center text-sm">
            <p className="font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
          </div>
        ) : totalStores === 0 && !appliedSearch ? (
          <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
              <RiStore2Line className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#2B2F38]">ไม่พบร้านค้าที่คุณมีสิทธิ์ดูแล</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              คุณยังไม่ได้รับการกำหนดให้เป็นผู้ดูแลร้านค้าใดๆ หากต้องการเปิดสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ (Admin)
            </p>
          </div>
        ) : totalStores === 0 && appliedSearch ? (
          <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
              <RiSearchLine className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#2B2F38]">
              ไม่พบร้านค้าที่ตรงกับ &quot;{appliedSearch}&quot;
            </h3>
            <p className="text-xs text-stone-500 mt-1 mb-4">
              ลองค้นหาด้วยชื่อร้านค้าหรือคำอธิบายอื่น
            </p>
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-3.5 py-1.5 bg-[#2B2F38] hover:bg-[#1E2229] text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-xs"
            >
              ล้างคำค้นหา
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedStores.map((store) => {
                const isPublic = store.store_access === 'public';
                const imgUrl = getStoreLogoUrl(store.store_image);

                return (
                  <div
                    key={store.store_id}
                    className="relative bg-white rounded-xl border border-stone-200 hover:border-[#EB6E3E]/60 shadow-xs hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group"
                  >
                    {/* ป้ายสถานะร้านค้า (ขวาบน) */}
                    <div className="absolute top-5 right-5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          isPublic
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>

                    <div>
                      {/* หัวการ์ด: โลโก้ + ชื่อร้าน */}
                      <div className="flex items-start gap-3.5 mb-3.5 pr-14">
                        <div className="w-13 h-13 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {imgUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imgUrl}
                              alt={store.store_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <FaShop className="w-6 h-6 text-[#2B2F38]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h2 className="text-base font-bold text-[#2B2F38] truncate group-hover:text-[#EB6E3E] transition-colors mb-1">
                            {store.store_name}
                          </h2>
                          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                            {store.store_desc || 'ไม่มีคำอธิบายร้านค้า'}
                          </p>
                        </div>
                      </div>

                      {/* สรุปข้อมูลย่อย: จำนวนสินค้า และ จำนวนพนักงาน/ผู้ดูแล */}
                      <div className="flex items-center gap-4 text-xs text-stone-500 my-3 font-normal select-none">
                        <div className="flex items-center gap-1.5">
                          <RiBox3Line className="w-4 h-4 text-stone-400 shrink-0" />
                          <span>สินค้า {store.product_count ?? 0}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <RiTeamLine className="w-4 h-4 text-stone-400 shrink-0" />
                          <span>พนักงาน {store.employee_count ?? 0}</span>
                        </div>
                      </div>

                      {/* กล่องสถานะรอจัดเตรียม (Amber Banner สไตล์สอดคล้องกับธีมสีเดิม) */}
                      {store.preparing_count > 0 ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectStore(store, 'PREPARING');
                          }}
                          className="flex items-center justify-between py-2.5 px-3.5 bg-amber-50/90 border border-amber-200/80 hover:bg-amber-100/80 rounded-lg text-xs text-amber-900 mb-3.5 cursor-pointer transition-colors select-none"
                          title={`มีคำสั่งซื้อรอจัดเตรียม ${store.preparing_count} รายการ (คลิกเพื่อดูรายการ)`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            <RiTimeLine className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>รายการรอจัดเตรียมสินค้า</span>
                          </div>
                          <span className="font-semibold text-amber-700">
                            {store.preparing_count} รายการ
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-2.5 px-3.5 bg-stone-50 border border-stone-200/60 rounded-lg text-xs text-stone-400 mb-3.5 select-none">
                          <div className="flex items-center gap-2 font-normal">
                            <RiTimeLine className="w-4 h-4 text-stone-400 shrink-0" />
                            <span>รายการรอจัดเตรียมสินค้า</span>
                          </div>
                          <span className="font-normal text-stone-400">0 รายการ</span>
                        </div>
                      )}
                    </div>

                    {/* ปุ่มแอ็กชัน: เข้าร้านค้านี้ */}
                    <button
                      type="button"
                      onClick={() => handleSelectStore(store)}
                      className="w-full py-2.5 px-4 bg-[#2B2F38] hover:bg-[#EB6E3E] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-xs group-hover:shadow"
                    >
                      <span>เข้าร้านค้านี้</span>
                      <RiArrowRightLine className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                3. แถบแบ่งหน้าร้านค้า (Pagination ทีละ 6 ร้าน)
                ───────────────────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 sm:gap-1.5 pt-6 pb-2 select-none">
                {/* ปุ่ม << ไปหน้าแรกสุด */}
                {totalPages > 3 && (
                  <button
                    type="button"
                    onClick={() => handlePageChange(1)}
                    disabled={validPage <= 1}
                    className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer rounded"
                    title="หน้าแรกสุด"
                  >
                    «
                  </button>
                )}

                {/* ปุ่ม < ย้อนกลับ */}
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, validPage - 1))}
                  disabled={validPage <= 1}
                  className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer rounded"
                  title="หน้าก่อนหน้า"
                >
                  ‹
                </button>

                {/* ปุ่มตัวเลขหน้า */}
                {getPageNumbers().map((item, idx) => {
                  if (item === '...') {
                    return (
                      <span
                        key={`dots-${idx}`}
                        className="w-8 h-8 flex items-center justify-center text-stone-400 text-xs font-bold"
                      >
                        ...
                      </span>
                    );
                  }

                  const isCurrent = item === validPage;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handlePageChange(Number(item))}
                      className={`min-w-[32px] h-8 px-2 flex items-center justify-center text-xs font-medium transition-all cursor-pointer rounded ${
                        isCurrent
                          ? 'bg-[#EB6E3E] text-white border border-[#d95d2f] font-bold shadow-xs'
                          : 'border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}

                {/* ปุ่ม > ถัดไป */}
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.min(totalPages, validPage + 1))}
                  disabled={validPage >= totalPages}
                  className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer rounded"
                  title="หน้าถัดไป"
                >
                  ›
                </button>

                {/* ปุ่ม >> ไปหน้าสุดท้าย */}
                {totalPages > 3 && (
                  <button
                    type="button"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={validPage >= totalPages}
                    className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer rounded"
                    title="หน้าสุดท้าย"
                  >
                    »
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
