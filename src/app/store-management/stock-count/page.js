// src/app/store-management/stock-count/page.js

/**
 * =========================================================================
 * Page: หน้านับสต๊อกสินค้า (Stock Count Placeholder Page)
 * Route: /store-management/stock-count
 * =========================================================================
 * หน้ารอการพัฒนา (Placeholder) สำหรับระบบตรวจนับและกระทบยอดสต๊อกสินค้า
 * วางไว้ด้านล่างเมนู "รายการขาย" ในแถบข้างจัดการร้านค้า
 * =========================================================================
 */

'use client';

import Link from 'next/link';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { RiStore2Line, RiArrowLeftLine, RiListCheck2 } from 'react-icons/ri';

export default function StockCountPage() {
  const currentStore = useStoreManagementStore((state) => state.currentStore);

  // กรณีผู้ใช้เข้ามาโดยยังไม่ได้เลือกร้านค้า
  if (!currentStore) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiStore2Line className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#2B2F38]">ยังไม่ได้เลือกร้านค้าที่ต้องการจัดการ</h3>
        <p className="text-xs text-[#363636]/70 mt-1 mb-5 max-w-sm">
          กรุณาเลือกร้านค้าจากหน้ารวมร้านค้าเพื่อใช้งานระบบนับสต๊อกสินค้า
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
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden">
      {/* ส่วนหัวหน้า */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              นับสต๊อกสินค้า
            </h1>
            <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium border border-stone-200">
              {currentStore.store_name}
            </span>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            ระบบตรวจนับและกระทบยอดสินค้าคงคลังของร้านค้า
          </p>
        </div>
      </div>

      {/* เนื้อหาว่างเปล่า รอการพัฒนา */}
      <div className="flex flex-col items-center justify-center p-16 sm:p-24 text-center">
        <div className="w-16 h-16 rounded-2xl  flex items-center justify-center  mb-4 shadow-2xs">
          <RiListCheck2 className="w-8 h-8" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-[#2B2F38]">
          ระบบนับสต๊อกสินค้า อยู่ระหว่างการพัฒนา
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 mt-1.5 max-w-md leading-relaxed">
          ฟังก์ชันการตรวจนับสต๊อก บันทึกยอดจริง และเปรียบเทียบส่วนต่างสินค้าคงคลัง 
        </p>

      </div>
    </div>
  );
}
