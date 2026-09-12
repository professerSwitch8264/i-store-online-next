// src/app/components/layout/StoreSidebar.jsx

/**
 * =========================================================================
 * Component: StoreSidebar (บาร์เมนูด้านข้าง สำหรับระบบจัดการร้านค้า)
 * =========================================================================
 * หมวดหมู่: layout/
 * เมนูทั้ง 6 เมนู:
 * 1. ข้อมูลร้านค้า (/store-management/info)
 * 2. รายการขาย (/store-management/orders)
 * 3. หมวดหมู่สินค้า (/store-management/categories)
 * 4. ตำแหน่งจัดเก็บสินค้า (/store-management/locations)
 * 5. รายการสินค้า (/store-management/products)
 * 6. ผู้ดูแลร้านค้า (/store-management/owners)
 * =========================================================================
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaShop } from 'react-icons/fa6';
import {
  RiFileList3Line,
  RiGridLine,
  RiArchiveDrawerLine,
  RiBox3Line,
  RiTeamLine,
  RiArrowLeftLine,
  RiTimeLine,
  RiListCheck2,
  RiUserFollowLine,
} from 'react-icons/ri';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useStoreOrderStore } from '@/app/stores/useStoreOrderStore';
import { useStorePreparationStore } from '@/app/stores/useStorePreparationStore';
import { getStoreLogoUrl } from '@/app/lib/utils';

export function StoreSidebar() {
  const pathname = usePathname();
  const currentStore = useStoreManagementStore((state) => state.currentStore);
  const tabCounts = useStoreOrderStore((state) => state.tabCounts);
  const prepTotal = useStorePreparationStore((state) => state.totalCount);

  // คำนวณจำนวนออเดอร์ที่อยู่ในสถานะ "กำลังเตรียมสินค้า" สำหรับแสดงแจ้งเตือน
  const preparingCount =
    prepTotal > 0
      ? prepTotal
      : tabCounts?.PREPARING > 0
        ? tabCounts.PREPARING
        : currentStore?.preparing_count || 0;

  const menuItems = [
    {
      title: 'ข้อมูลร้านค้า',
      href: '/store-management/info',
      icon: <FaShop className="w-4 h-4" />,
      active: pathname === '/store-management/info' || pathname === '/store-management',
    },
    {
      title: 'รายการขายของร้าน',
      href: '/store-management/orders',
      icon: <RiFileList3Line className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/orders'),
    },
    {
      title: 'รายการรอจัดเตรียม',
      href: '/store-management/preparation',
      icon: <RiTimeLine className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/preparation'),
      badge: preparingCount > 0 ? preparingCount : null,
      badgeTitle: `มี ${preparingCount} รายการที่ต้องจัดเตรียมสินค้า`,
    },
    {
      title: 'ตรวจนับสต๊อก',
      href: '/store-management/stock-count',
      icon: <RiListCheck2 className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/stock-count'),
    },
    {
      title: 'หมวดหมู่สินค้า',
      href: '/store-management/categories',
      icon: <RiGridLine className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/categories'),
    },
    {
      title: 'ตำแหน่งจัดเก็บสินค้า',
      href: '/store-management/locations',
      icon: <RiArchiveDrawerLine className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/locations'),
    },
    {
      title: 'รายการสินค้า',
      href: '/store-management/products',
      icon: <RiBox3Line className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/products'),
    },
    {
      title: 'ผู้ดูแลร้านค้า',
      href: '/store-management/owners',
      icon: <RiTeamLine className="w-4.5 h-4.5" />,
      active: pathname.startsWith('/store-management/owners'),
    },
    ...(currentStore?.store_access?.toLowerCase() === 'private'
      ? [
          {
            title: 'รายชื่อลูกค้า',
            href: '/store-management/customers',
            icon: <RiUserFollowLine className="w-4.5 h-4.5" />,
            active: pathname.startsWith('/store-management/customers'),
          },
        ]
      : []),
  ];

  return (
    <aside className="w-full md:w-56 lg:w-60 shrink-0 select-none bg-white rounded-lg shadow-sm border border-stone-200 p-4 font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. ส่วนหัว Sidebar: ไอคอนร้านค้า + ชื่อร้านค้า + ปุ่มเปลี่ยนร้านค้า
          ───────────────────────────────────────────────────────────── */}
      <div className="pb-3.5 mb-3 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2B2F38] text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0 overflow-hidden">
            {currentStore?.store_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getStoreLogoUrl(currentStore.store_image)}
                alt={currentStore.store_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <FaShop className="w-4.5 h-4.5 text-[#F5A82A]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#2B2F38] truncate" title={currentStore?.store_name || 'จัดการร้านค้า'}>
              {currentStore?.store_name || 'จัดการร้านค้า'}
            </p>
            <p className="text-[11px] text-stone-500 truncate mt-0.5 font-normal" title={currentStore?.store_desc || 'ระบบจัดการร้านค้า'}>
              {currentStore?.store_desc || 'ระบบจัดการร้านค้า'}
            </p>
          </div>
        </div>

        {/* ปุ่มกลับ / เปลี่ยนร้านค้า (Back to Store Hub) */}
        <div className="mt-2.5 pt-2 border-t border-stone-100/80">
          <Link
            href="/store-management"
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-[#EB6E3E] font-medium transition-colors group cursor-pointer"
            title="กลับไปเลือกและสลับร้านค้าอื่น"
          >
            <RiArrowLeftLine className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>เปลี่ยนร้านค้า</span>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. รายการเมนูนำทาง (Sidebar Navigation Menu Links)
          ───────────────────────────────────────────────────────────── */}
      <nav className="space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
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

            {item.badge != null && (
              <span
                title={item.badgeTitle}
                className="text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 bg-[#EB6E3E] text-white"
              >
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export default StoreSidebar;
