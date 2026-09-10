// src/app/store-management/layout.js

/**
 * =========================================================================
 * Layout: Store Management Layout (/store-management)
 * =========================================================================
 * โครงสร้างร่วมของทุกหน้าในระบบจัดการร้านค้า:
 * - บาร์เมนูด้านข้าง (StoreSidebar) อยู่ฝั่งซ้าย
 * - เนื้อหาหลัก (children) อยู่ฝั่งขวา
 * =========================================================================
 */

import { StoreManagementShell } from './StoreManagementShell';

export const metadata = {
  title: 'จัดการร้านค้า | i-Store Online',
  description: 'ระบบจัดการร้านค้า สินค้า สต็อก และคำสั่งซื้อ',
};

export default function StoreManagementLayout({ children }) {
  return (
    <div className="flex-1 bg-[#f8f9fa] text-stone-900 flex flex-col font-sans">
      <StoreManagementShell>
        {children}
      </StoreManagementShell>
    </div>
  );
}
