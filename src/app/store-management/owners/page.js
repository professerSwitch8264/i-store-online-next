// src/app/store-management/owners/page.js
'use client';

import { RiTeamLine } from 'react-icons/ri';

export default function StoreOwnersPage() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden min-h-[420px]">
      {/* ส่วนหัวหน้า */}
      <div className="p-5 sm:p-6 border-b border-[#D3D3D3] bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-stone-100 flex items-center justify-center text-[#2B2F38]">
            <RiTeamLine className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#2B2F38]">
              ผู้ดูแลร้านค้า
            </h1>
            <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
              จัดการรายชื่อเจ้าของและผู้มีสิทธิ์ดูแลร้านค้าในการเบิกจ่ายและจัดการสต็อก
            </p>
          </div>
        </div>
      </div>

      {/* พื้นที่เนื้อหา (หน้าโล่งสำหรับเตรียมพัฒนา) */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiTeamLine className="w-7 h-7" />
        </div>
        <p className="text-sm font-medium text-[#2B2F38]">หน้าผู้ดูแลร้านค้า</p>
        <p className="text-xs text-stone-500 mt-1 max-w-sm">
          หน้านี้ถูกสร้างขึ้นเพื่อเตรียมพร้อมสำหรับการจัดการผู้ดูแลร้านค้าและการกำหนดสิทธิ์
        </p>
      </div>
    </div>
  );
}
