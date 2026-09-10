// src/app/components/header/SearchHeader.jsx
'use client';

import Image from 'next/image';
import { useProductStore } from '@/app/stores/useProductStore';
import { CartPopover } from '@/app/components/cart/CartPopover';

/**
 * Component: SearchHeader (แถบส่วนหัว: โลโก้, ช่องค้นหาสินค้า และปุ่มเปิดตะกร้า/พรีออเดอร์)
 * หน้าที่: 
 * 1. แสดงโลโก้ i-Store ด้านซ้าย
 * 2. ช่องกรอกค้นหาชื่อสินค้า และปุ่มกดค้นหา (ดึงและอัปเดต State ตรงไปยัง useProductStore)
 * 3. ปุ่มไอคอนเปิด Popover สำหรับสั่งจองล่วงหน้า (Pre-order) และตะกร้าสินค้าปกติ
 */
export function SearchHeader() {
  // ดึง State และ Action การค้นหาจาก Zustand useProductStore
  const {
    searchInput,    // ข้อความที่กำลังพิมพ์อยู่ในช่องค้นหา
    setSearchInput, // ฟังก์ชันอัปเดตข้อความในช่องค้นหา
    submitSearch,   // ฟังก์ชันส่งคำค้นหา (นำคำเข้า Tag แล้วสั่งโหลดสินค้าใหม่)
    loading,        // สถานะกำลังโหลดข้อมูลสินค้าหรือไม่
  } = useProductStore();

  // ฟังก์ชันดักจับปุ่มกด: ถ้าผู้ใช้กดปุ่ม Enter ในช่องค้นหา จะสั่งค้นหาทันที
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      submitSearch();
    }
  };

  return (
    <header className="w-full bg-white border-b border-stone-200 sticky top-8 z-40 shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
        {/* จัดวาง โลโก้ + ช่องค้นหา + ตะกร้าสินค้า ในแถวเดียวกันแบบ Responsive เต็มรูปแบบ */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-6">
          {/* 1. โลโก้ i-Store ด้านซ้าย */}
          <div className="flex items-center shrink-0 cursor-pointer">
            <Image
              src="/iStoreHome.png"
              alt="i-Store Logo"
              width={200}
              height={65}
              className="h-10 sm:h-12 w-auto object-contain"
              priority
            />
          </div>

          {/* 2. กล่องค้นหาสินค้า (ตรงกลาง): เปลี่ยนเป็นเส้นขอบสี stone-300 */}
          <div className="flex-1 min-w-0 max-w-2xl flex justify-center">
            <div className="w-full h-8.5 sm:h-9 flex items-center bg-white rounded-md border border-stone-300 overflow-hidden transition-all focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-[#EB6E3E]/30 shadow-2xs">
              <input
                type="text"
                placeholder="ค้นหาชื่อสินค้า หรือรายละเอียดสินค้า..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 h-full bg-transparent text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:outline-none px-3 sm:px-4 font-normal"
              />

              {/* ปุ่มแว่นขยายค้นหา สไตล์กล่องรูปแรก: สูงเต็มขอบ ชิดขวา สี Deep Charcoal ของเรา */}
              <button
                type="button"
                onClick={submitSearch}
                disabled={loading}
                className="bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white px-4 sm:px-6 h-full transition-colors shrink-0 flex items-center justify-center cursor-pointer font-medium text-xs sm:text-sm"
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
              </button>
            </div>
          </div>

          {/* 3. ปุ่มสั่งล่วงหน้า (Pre-order 🔖) & ตะกร้าสินค้า (🛒) ด้านขวา - แสดงชัดเจนตลอดเวลาทุกขนาดหน้าจอ */}
          <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
            <CartPopover mode="preorder" />
            <CartPopover mode="cart" />
          </div>
        </div>
      </div>
    </header>
  );
}
