// src/app/components/layout/AccountSidebar.jsx

/**
 * =========================================================================
 * Component: AccountSidebar (การ์ดบาร์เมนูด้านข้าง สไตล์ Shopee Account Management)
 * =========================================================================
 * หมวดหมู่: layout/
 * หน้าที่: แสดงการ์ดข้อมูลโปรไฟล์ย่อของผู้ใช้ พร้อมลิงก์เมนูนำทางระหว่างหน้า:
 * 1. บัญชีของฉัน / โปรไฟล์ (/profile)
 * 2. คำสั่งซื้อของฉัน (/orders)
 * 3. รายการรออนุมัติ (/approvals) พร้อม Badge แสดงจำนวนรายการที่รออนุมัติ
 * 4. ตั้งค่าระบบ (/settings) - แสดงเฉพาะเมื่อผู้ใช้มีสิทธิ์ระดับ Admin
 * =========================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useOrderStore } from '@/app/stores/useOrderStore';
import { useProfileStore } from '@/app/stores/useProfileStore';
import { getProfileUrl } from '@/lib/utils';
import {
  RiUser3Line,
  RiFileList3Line,
  RiCheckboxCircleLine,
  RiSettings3Line,
} from 'react-icons/ri';

export function AccountSidebar() {
  const pathname = usePathname();
  const { userInfo } = useAuth();
  const { pendingCount, fetchPendingCount } = useOrderStore();
  const { profileImage, fetchProfileImage, setProfileImage } = useProfileStore();
  const [imgError, setImgError] = useState(false);
  const info = userInfo?.info;

  // โหลดจำนวนคำขออนุมัติและรูปโปรไฟล์เมื่อล็อกอิน
  useEffect(() => {
    if (userInfo?.info?.image && !profileImage) {
      setProfileImage(userInfo.info.image);
    }
    if (userInfo?.securityToken) {
      fetchPendingCount(userInfo.securityToken);
      fetchProfileImage(userInfo.securityToken);
    }
  }, [userInfo?.securityToken, userInfo?.info?.image, fetchPendingCount, fetchProfileImage, setProfileImage, profileImage]);

  // รีเซ็ต error เมื่อ profileImage มีการเปลี่ยน
  useEffect(() => {
    setImgError(false);
  }, [profileImage]);

  const displayName =
    info?.fullnameTH ||
    (info?.firstname_th ? `${info.firstname_th} ${info.lastname_th || ''}` : '') ||
    info?.username ||
    'ผู้ใช้งาน';

  const departmentName = info?.department_th || info?.department || '';

  const avatarChar = (
    info?.firstname?.charAt(0) ||
    info?.username?.charAt(0) ||
    'U'
  ).toUpperCase();

  const isAdmin = userInfo?.accessLevel === 'Admin';

  // รายการเมนูทั้งหมด (ชื่อและไอคอนตรงกันกับ Navbar Dropdown)
  const menuItems = [
    {
      title: 'โปรไฟล์ผู้ใช้งาน',
      href: '/profile',
      icon: <RiUser3Line className="w-4.5 h-4.5" />,
      active: pathname === '/profile',
    },
    {
      title: 'คำสั่งซื้อของฉัน',
      href: '/orders',
      icon: <RiFileList3Line className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/orders'),
    },
    {
      title: 'รายการรออนุมัติ',
      href: '/approvals',
      icon: <RiCheckboxCircleLine className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/approvals'),
      badge: pendingCount > 0 ? pendingCount : null,
    },
  ];

  // ถ้าเป็น Admin ให้เพิ่มเมนูตั้งค่าระบบเข้าไปด้วย
  if (isAdmin) {
    menuItems.push({
      title: 'ตั้งค่าระบบ',
      href: '/settings',
      icon: <RiSettings3Line className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/settings'),
      badge: null,
    });
  }

  return (
    <aside className="w-full md:w-56 lg:w-60 shrink-0 select-none bg-white rounded-lg shadow-sm border border-stone-200 p-4 font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. ส่วนหัว Sidebar: รูปโปรไฟล์ย่อ + ชื่อ + ชื่อฝ่าย
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-3.5 mb-3 border-b border-stone-100">
        {/* รูปโปรไฟล์ Avatar ทรงกลม */}
        <div className="w-11 h-11 rounded-full bg-[#2B2F38] text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0 overflow-hidden">
          {profileImage && !imgError ? (
            <img
              src={getProfileUrl(profileImage)}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span>{avatarChar}</span>
          )}
        </div>

        {/* ชื่อและฝ่าย */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#2B2F38] truncate" title={displayName}>
            {displayName}
          </p>
          {departmentName && (
            <p className="text-[11px] text-stone-500 truncate mt-0.5 font-normal" title={departmentName}>
              {departmentName}
            </p>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. รายการเมนูนำทาง (Sidebar Navigation Menu Links)
          ───────────────────────────────────────────────────────────── */}
      <nav className="space-y-1">
        {menuItems.map((item) => (
          <div key={item.href}>
            {item.href === '/settings' && (
              <div className="border-t border-stone-200 my-1.5" />
            )}
            <Link
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-md text-xs transition-all ${
                item.active
                  ? 'bg-[#2B2F38] text-white font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-[#2B2F38] hover:bg-stone-100 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`shrink-0 ${item.active ? 'text-white' : 'text-stone-400'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.title}</span>
              </div>

              {/* แสดง Badge ตัวเลขจำนวนรายการที่รออนุมัติ (สีส้มแบรนด์ i-Store #EB6E3E) */}
              {item.badge !== null && item.badge !== undefined && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs shrink-0 bg-[#EB6E3E] text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          </div>
        ))}
      </nav>
    </aside>
  );
}
