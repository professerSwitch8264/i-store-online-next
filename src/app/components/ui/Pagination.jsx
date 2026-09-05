// src/app/components/ui/Pagination.jsx
'use client';

import { useProductStore } from '@/app/stores/useProductStore'; // 👈 ใช้ @/app/stores

/**
 * Component: Pagination (แถบปุ่มแบ่งหน้าสินค้า)
 * หน้าที่: แสดงปุ่มตัวเลขหน้า, ปุ่มย้อนกลับ (<), ปุ่มถัดไป (>), ปุ่มหน้าแรก (<<), ปุ่มหน้าสุดท้าย (>>)
 * พร้อมตัดย่อหน้าด้วยจุดไข่ปลา (...) เมื่อมีหน้าจำนวนมาก
 */
export function Pagination() {
  // ดึง State และ Action จาก Zustand useProductStore
  const {
    pagination, // ข้อมูลหน้าปัจจุบันและจำนวนหน้าทั้งหมด { page, limit, total, totalPages }
    setPage,    // ฟังก์ชันสำหรับเปลี่ยนหน้า (เช่น setPage(2))
    loading,    // สถานะกำลังโหลดข้อมูลสินค้า (ใช้เพื่อปิดการกดปุ่มชั่วคราว)
  } = useProductStore();

  // ถ้าไม่มีข้อมูล pagination หรือมีแค่หน้าเดียว (totalPages <= 1) ไม่ต้องแสดงแถบแบ่งหน้า
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  // page: หมายเลขหน้าปัจจุบัน, totalPages: จำนวนหน้าทั้งหมด
  const { page, totalPages } = pagination;

  // getPageNumbers: ฟังก์ชันคำนวณและจัดรูปแบบอาร์เรย์ตัวเลขหน้าที่จะแสดง (รวมจุดไข่ปลา '...')
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      // ถ้ามีหน้าไม่เกิน 7 หน้า แสดงตัวเลขทั้งหมดรวดเดียว
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // ถ้ามีมากกว่า 7 หน้า จะแสดงจุดไข่ปลา '...' ตามตำแหน่งของหน้าปัจจุบัน
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5 pt-4 pb-6 select-none">
      {/* ปุ่ม << ไปหน้าแรกสุด */}
      {totalPages > 3 && (
        <button
          type="button"
          onClick={() => setPage(1)}
          disabled={page <= 1 || loading}
          className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer"
          title="หน้าแรกสุด"
        >
          «
        </button>
      )}

      {/* ปุ่ม < ย้อนกลับ */}
      <button
        type="button"
        onClick={() => setPage(page - 1)}
        disabled={page <= 1 || loading}
        className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer"
        title="หน้าก่อนหน้า"
      >
        ‹
      </button>

      {/* ปุ่มตัวเลขหน้า */}
      {getPageNumbers().map((item, idx) => {
        if (item === '...') {
          return (
            <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-stone-400 text-xs font-bold">
              ...
            </span>
          );
        }

        const isCurrent = item === page;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setPage(Number(item))}
            disabled={loading}
            className={`min-w-[32px] h-8 px-2 flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
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
        onClick={() => setPage(page + 1)}
        disabled={page >= totalPages || loading}
        className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer"
        title="หน้าถัดไป"
      >
        ›
      </button>

      {/* ปุ่ม >> ไปหน้าสุดท้าย */}
      {totalPages > 3 && (
        <button
          type="button"
          onClick={() => setPage(totalPages)}
          disabled={page >= totalPages || loading}
          className="w-8 h-8 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 disabled:opacity-25 transition-all cursor-pointer"
          title="หน้าสุดท้าย"
        >
          »
        </button>
      )}
    </div>
  );
}