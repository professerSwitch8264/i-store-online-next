// =========================================================================
// Component: TopNavbar (Navbar บนสุด - แสดงทุกหน้าของเว็บไซต์)
// หน้าที่: แสดงเมนูหลัก (เบิกสินค้า | จัดการร้านค้า), ข้อมูลโปรไฟล์พนักงาน และปุ่มออกจากระบบ
// ธีม: ขาว-ดำ สไตล์ Nike Minimalist (High-Contrast Monochrome)
// =========================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useOrderStore } from '@/app/stores/useOrderStore';
import {
  RiUser3Line,
  RiFileList3Line,
  RiCheckboxCircleLine,
  RiSettings3Line,
  RiLogoutBoxRLine,
} from 'react-icons/ri';

export default function Navbar() {
  const { userInfo, logout } = useAuth();

  const { pendingCount, fetchPendingCount } = useOrderStore();
  const pathname = usePathname();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // โหลดจำนวนคำขออนุมัติเมื่อล็อกอิน
  useEffect(() => {
    if (userInfo?.securityToken) {
      fetchPendingCount(userInfo.securityToken);
    }
  }, [userInfo?.securityToken, fetchPendingCount]);

  // ตรวจสอบแท็บที่กำลังเปิดอยู่ตาม URL Pathname
  const isRequisition =
    pathname === '/' ||
    pathname.startsWith('/requisition') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/cart-checkout');
  const isStoreManagement = pathname.startsWith('/store-management') || pathname.startsWith('/admin');

  // ปิดเมนูเมื่อคลิกนอกพื้นที่ (Click Outside) ทั้งการคลิกเมาส์และการสัมผัสบนมือถือ
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <nav className="w-full bg-white border-b border-stone-200 text-xs select-none sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-8 flex items-center justify-between">
        {/* เมนูหลักด้านซ้าย: เบิกสินค้า | จัดการร้านค้า */}
        <div className="flex items-center gap-2.5 sm:gap-4 text-stone-900 font-medium text-[11px] sm:text-xs shrink-0">
          <Link
            href="/"
            className={`transition-colors py-0.5 cursor-pointer ${isRequisition ? 'font-bold text-[#2B2F38] border-b-2 border-[#EB6E3E]' : 'text-stone-500 hover:text-[#2B2F38]'
              }`}
          >
            เบิกสินค้า
          </Link>

          <span className="text-stone-300">|</span>

          <Link
            href="/store-management"
            className={`transition-colors py-0.5 cursor-pointer ${isStoreManagement ? 'font-bold text-[#2B2F38] border-b-2 border-[#EB6E3E]' : 'text-stone-500 hover:text-[#2B2F38]'
              }`}
          >
            จัดการร้านค้า
          </Link>
        </div>

        {/* ข้อมูลโปรไฟล์พนักงานและปุ่มออกจากระบบ ด้านขวา */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs shrink-0">
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 text-stone-700 hover:text-[#2B2F38] transition-colors cursor-pointer text-left py-0.5"
            >
              <div className="w-5.5 h-5.5 rounded-full bg-[#2B2F38] text-white flex items-center justify-center text-[10px] font-bold uppercase shadow-2xs shrink-0">
                <span>
                  {(userInfo?.info?.firstname?.charAt(0) || userInfo?.info?.username?.charAt(0) || 'U').toUpperCase()}
                </span>
              </div>
              <span className="font-medium text-xs text-stone-900 hidden sm:inline max-w-[130px] lg:max-w-none truncate">
                {userInfo?.info?.fullnameTH ||
                  (userInfo?.info?.firstname_th
                    ? `${userInfo.info.firstname_th} ${userInfo.info.lastname_th || ''}`
                    : userInfo?.info?.username || 'ผู้ใช้งาน')}
              </span>
              <svg
                className={`w-3 h-3 text-stone-500 transition-transform shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full pt-1.5 w-60 z-50 animate-fadeIn">
                <div className="bg-white rounded-lg shadow-xl border border-stone-200 p-2 text-xs text-stone-800">
                  <div className="px-2.5 py-2 border-b border-stone-100 mb-1 flex items-center gap-2.5">
                    {/* วงกลมโปรไฟล์ Avatar ด้านหน้า */}
                    <div className="w-8 h-8 rounded-full bg-[#2B2F38] text-white flex items-center justify-center text-xs font-bold uppercase shadow-2xs shrink-0">
                      <span>
                        {(userInfo?.info?.firstname?.charAt(0) || userInfo?.info?.username?.charAt(0) || 'U').toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-black truncate leading-tight">
                        {userInfo?.info?.fullnameTH ||
                          (userInfo?.info?.firstname_th
                            ? `${userInfo.info.firstname_th} ${userInfo.info.lastname_th || ''}`
                            : userInfo?.info?.username)}
                      </p>
                      {(userInfo?.info?.department_th || userInfo?.info?.department) && (
                        <p className="text-[10px] text-stone-500 truncate mt-0.5 font-normal leading-tight">
                          {userInfo.info.department_th || userInfo.info.department}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    {/* 1. โปรไฟล์ผู้ใช้งาน  */}
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-stone-700 hover:text-black hover:bg-stone-100 font-medium rounded-md transition-colors"
                    >
                      <RiUser3Line className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>โปรไฟล์ผู้ใช้งาน</span>
                    </Link>

                    {/* 2. คำสั่งซื้อของฉัน */}
                    <Link
                      href="/orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-stone-700 hover:text-black hover:bg-stone-100 font-medium rounded-md transition-colors"
                    >
                      <RiFileList3Line className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>คำสั่งซื้อของฉัน</span>
                    </Link>

                    {/* 3. รายการรออนุมัติ */}
                    <Link
                      href="/approvals"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-2 text-stone-700 hover:text-black hover:bg-stone-100 font-medium rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <RiCheckboxCircleLine className="w-4 h-4 text-stone-500 shrink-0" />
                        <span>รายการรออนุมัติ</span>
                      </div>
                      {pendingCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EB6E3E] text-white shadow-2xs shrink-0">
                          {pendingCount}
                        </span>
                      )}
                    </Link>

                    {/* 4. ตั้งค่าระบบ ( เฉพาะแอดมิน ) */}
                    {userInfo?.accessLevel === 'Admin' && (
                      <>
                        <div className="border-t border-stone-100 my-1" />
                        <Link
                          href="/settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-stone-700 hover:text-black hover:bg-stone-100 font-medium rounded-md transition-colors"
                        >
                          <RiSettings3Line className="w-4 h-4 text-stone-500 shrink-0" />
                          <span>ตั้งค่าระบบ</span>
                        </Link>
                      </>
                    )}
                  </div>

                  {/* 5. ออกจากระบบ */}
                  <div className="border-t border-stone-100 pt-1 mt-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-700 hover:text-black hover:bg-stone-100 font-semibold rounded-md transition-colors cursor-pointer"
                    >
                      <RiLogoutBoxRLine className="w-4 h-4 text-stone-500 shrink-0" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

