// src/app/store-management/StoreManagementShell.jsx
'use client';

import { usePathname } from 'next/navigation';
import { StoreSidebar } from '@/app/components/layout/StoreSidebar';

/**
 * Component: StoreManagementShell
 * ควบคุม Layout ของระบบจัดการร้านค้า:
 * - หากอยู่ที่หน้า Hub (/store-management): ซ่อน Sidebar และแสดงเนื้อหาแบบเต็มความกว้าง (Full-width Grid)
 * - หากอยู่ที่หน้าร้านค้า (/store-management/orders ฯลฯ): แสดง StoreSidebar ทางซ้าย และเนื้อหาทางขวา
 */
export function StoreManagementShell({ children }) {
  const pathname = usePathname();
  const isHub = pathname === '/store-management';

  if (isHub) {
    return (
      <div className="flex-1 flex flex-col w-full">
        {children}
      </div>
    );
  }

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start gap-6">
      {/* บาร์เมนูด้านข้าง (StoreSidebar) */}
      <div className="hidden md:block shrink-0">
        <StoreSidebar />
      </div>

      {/* พื้นที่แสดงผลเนื้อหาหลัก */}
      <div className="flex-1 min-w-0 w-full">
        {children}
      </div>
    </main>
  );
}
