// src/app/components/header/SearchKeywords.jsx
'use client';

import { useProductStore } from '@/app/stores/useProductStore';

/**
 * Component: SearchKeywords (แถบแสดงแท็กคำค้นหาและสรุปจำนวนสินค้าที่พบ)
 * หน้าที่: 
 * 1. แสดงหัวข้อ 'สินค้าที่ค้นพบ' หรือ 'รายการสินค้าทั้งหมด'
 * 2. แสดงแท็กคำค้นหาทั้งหมด (Keywords Tag) พร้อมปุ่มกดลบทีละคำ (✕)
 * 3. ปุ่ม 'ล้างทั้งหมด' เพื่อเคลียร์แท็กทั้งหมดและกลับสู่หน้าแรก
 * 4. แสดงตัวเลขสรุปยอดสินค้าทั้งหมดที่ตรงตามเงื่อนไข (เช่น 'พบทั้งหมด 12 รายการ')
 */
export function SearchKeywords() {
  // ดึง State และ Action จาก Zustand useProductStore โดยตรง
  const {
    keywords,            // อาร์เรย์เก็บแท็กคำค้นหาทั้งหมด เช่น ['ปากกา', 'สมุด']
    removeKeyword,       // ฟังก์ชันลบแท็กคำค้นหาออกทีละคำ
    resetFilter,         // ฟังก์ชันล้างคำค้นหาและตัวกรองทั้งหมดกลับสู่หน้าแรก
    selectedStore,       // store_id ที่เลือก
    selectedCategory,    // category_id ที่เลือก
    stores,              // รายการร้านค้า
    categories,          // รายการหมวดหมู่
    clearStoreFilter,    // ลบตัวกรองร้านค้า
    clearCategoryFilter, // ลบตัวกรองหมวดหมู่
    pagination,          // ข้อมูลการแบ่งหน้า { page, limit, total, totalPages }
    products,            // รายการสินค้า (ใช้สำรองกรณีไม่มี pagination)
    loading,             // สถานะกำลังโหลดข้อมูลสินค้าหรือไม่
  } = useProductStore();

  // total: จำนวนสินค้าทั้งหมดที่ค้นพบ
  const total = pagination?.total ?? products.length;

  // หาชื่อร้านค้าและหมวดหมู่ที่เลือก
  const activeStoreName = stores.find((s) => s.store_id === selectedStore)?.store_name;
  const activeCategoryName = categories.find((c) => c.category_id === selectedCategory)?.category_name;

  const hasActiveFilters = keywords.length > 0 || !!selectedStore || !!selectedCategory;

  return (
    <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-200 select-none">
      {/* 1. ฝั่งซ้าย: หัวข้อ และรายการแท็กคำค้นหา & ตัวกรอง (Keyword & Filter Badges) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <h2 className="text-xs sm:text-sm font-bold text-[#2B2F38] shrink-0">
          {hasActiveFilters ? 'สินค้าที่ค้นพบ' : 'รายการสินค้าทั้งหมด'}
        </h2>

        {/* แท็กตัวกรองร้านค้า */}
        {selectedStore && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-[#2B2F38] border border-stone-300 shadow-2xs animate-fadeIn">
            <span>ร้านค้า: <strong>{activeStoreName || selectedStore}</strong></span>
            <button
              type="button"
              onClick={clearStoreFilter}
              className="text-stone-400 hover:text-[#2B2F38] font-bold ml-0.5 cursor-pointer text-xs transition-colors"
              title="ลบตัวกรองร้านค้า"
            >
              ✕
            </button>
          </span>
        )}

        {/* แท็กตัวกรองหมวดหมู่ */}
        {selectedCategory && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-[#2B2F38] border border-stone-300 shadow-2xs animate-fadeIn">
            <span>หมวดหมู่: <strong>{activeCategoryName || selectedCategory}</strong></span>
            <button
              type="button"
              onClick={clearCategoryFilter}
              className="text-stone-400 hover:text-[#2B2F38] font-bold ml-0.5 cursor-pointer text-xs transition-colors"
              title="ลบตัวกรองหมวดหมู่"
            >
              ✕
            </button>
          </span>
        )}

        {/* วนลูปแสดงแท็กคำค้นหาแต่ละคำ */}
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-white text-[#2B2F38] border border-stone-300 shadow-2xs animate-fadeIn"
          >
            <span>&lsquo;{kw}&rsquo;</span>
            {/* ปุ่มกดลบแท็กคำนี้ออก */}
            <button
              type="button"
              onClick={() => removeKeyword(kw)}
              className="text-stone-400 hover:text-[#2B2F38] font-bold ml-0.5 cursor-pointer text-xs transition-colors"
              title={`ลบคำค้นหา '${kw}'`}
            >
              ✕
            </button>
          </span>
        ))}

        {/* ปุ่มล้างคำค้นหาทั้งหมด (แสดงเมื่อมีตัวกรองอย่างน้อย 1 อย่าง) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilter}
            className="text-[11px] text-stone-500 hover:text-black underline font-medium cursor-pointer ml-1 transition-colors"
            title="ล้างคำค้นหาและตัวกรองทั้งหมด"
          >
            ล้างทั้งหมด
          </button>
        )}
      </div>

      {/* 2. ฝั่งขวา: จำนวนสินค้าที่ค้นพบ */}
      <div className="text-[11px] sm:text-xs font-medium text-stone-500 shrink-0">
        {loading ? (
          <span className="inline-block w-20 h-4 bg-stone-200 rounded animate-pulse" />
        ) : (
          <span>
            พบทั้งหมด <strong className="text-black font-bold">{total}</strong> รายการ
          </span>
        )}
      </div>
    </div>
  );
}
