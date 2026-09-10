// src/app/profile/page.js

/**
 * =========================================================================
 * Page: หน้าข้อมูลโปรไฟล์ผู้ใช้งาน (User Profile Page)
 * Route: /profile
 * =========================================================================
 * สถาปัตยกรรม & ดีไซน์:
 * 1. ฟอนต์ Kanit 100% ทั้งหน้า
 * 2. ขนาดความกว้าง max-w-7xl พร้อมแถบ AccountSidebar นำทางด้านข้างสไตล์ Shopee
 * 3. วงกลมรูปโปรไฟล์ Avatar ขนาดใหญ่ตรงกลาง (w-24 h-24) แสดงอักษรย่อ พร้อมชื่อเต็มด้านล่าง
 * 4. การ์ดข้อมูลผู้ใช้งาน 8 ช่องจัดคู่ 4 แถวแบบ Responsive Grid:
 *    - รหัสพนักงาน
 *    - ชื่อ - นามสกุล (ภาษาไทย)
 *    - บริษัท
 *    - ตำแหน่งงาน
 *    - ฝ่าย / สำนัก
 *    - แผนก / ส่วนงาน
 *    - เบอร์โทรศัพท์
 *    - อีเมลติดต่อ
 * =========================================================================
 */

'use client';

import { useAuth } from '@/app/components/auth/AuthProvider';
import { AccountSidebar } from '@/app/components/layout/AccountSidebar';

export default function ProfilePage() {
  // ดึงข้อมูลผู้ใช้งานที่ผ่านการยืนยันตัวตนจาก AuthProvider Context
  const { userInfo } = useAuth();
  const info = userInfo?.info;

  // 1. รหัสพนักงาน (username)
  const displayUsername = info?.username || 'WTF112030';

  // 2. ชื่อ - นามสกุลภาษาไทย
  const displayNameTH =
    info?.fullnameTH ||
    (info?.firstname_th && info?.lastname_th ? `${info.firstname_th} ${info.lastname_th}` : '') ||
    info?.firstname_th ||
    info?.fullname ||
    'เกียรติยศ หงษ์กลิ่น';

  // 3. บริษัทสังกัด
  const displayCompany = info?.company_th || info?.company || 'บริษัท วันไทยอุตสาหกรรมการอาหาร จำกัด';

  // 4. ฝ่าย / สำนัก
  const displayDepartment = info?.department_th || info?.department || 'ฝ่ายดีเอกซ์';

  // 5. แผนก / ส่วนงาน
  const displaySection = info?.section_th || info?.section || 'แผนกเทคโนโลยีสารสนเทศ';

  // 6. ตำแหน่งงาน
  const displayJob = info?.job_title || info?.job_code || 'Operation Staff 4';

  // 7. เบอร์โทรศัพท์
  const displayMobile = info?.mobile_no || '0824413559';

  // 8. อีเมลติดต่อ
  const displayEmail = info?.email || 'kiadtiyod.hongglin.w5w@asv.ajinomoto.com';

  // ตัวอักษรย่อสำหรับแสดงในวงกลม Avatar
  const avatarChar = (
    info?.firstname?.charAt(0) ||
    info?.firstname_th?.charAt(0) ||
    info?.username?.charAt(0) ||
    'ก'
  ).toUpperCase();

  return (
    <div className="flex-1 bg-[#f8f9fa] text-[#2B2F38] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-start gap-6">
        {/* บาร์เมนูด้านข้าง (Account Sidebar สไตล์ Shopee) */}
        <div className="hidden md:block shrink-0">
          <AccountSidebar />
        </div>

        {/* การ์ดรายละเอียดโปรไฟล์ ด้านขวา */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
            {/* ส่วนหัวของหน้า */}
            <div className="pt-5 sm:pt-6 px-6 sm:px-8">
              <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                โปรไฟล์ผู้ใช้งาน
              </h1>
            </div>

            {/* รายละเอียดโปรไฟล์ */}
            <div className="p-6 sm:p-8 pt-4 sm:pt-4 space-y-6">
              {/* ส่วนด้านบน: รูปโปรไฟล์ตรงกลาง และ ชื่ออยู่ตรงกลางใต้รูป */}
              <div className="flex flex-col items-center justify-center text-center pb-2">
                {/* รูปโปรไฟล์ Avatar วงกลมตรงกลาง */}
                <div className="w-24 h-24 rounded-full bg-[#2B2F38] text-white font-bold text-3xl flex items-center justify-center shadow-md border-4 border-stone-100 select-none">
                  <span>{avatarChar}</span>
                </div>

                {/* ชื่อผู้ใช้งานตรงกลางใต้รูป */}
                <h2 className="text-xl sm:text-2xl font-bold text-[#2B2F38] mt-3.5">
                  {displayNameTH}
                </h2>
              </div>

              {/* การ์ดข้อมูลผู้ใช้งานภาษาไทย (8 ช่องจับคู่พอดี 4 แถว) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm pt-2">
                {/* 1. รหัสพนักงาน */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    รหัสพนักงาน
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displayUsername}
                  </div>
                </div>

                {/* 2. ชื่อ - นามสกุล */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    ชื่อ - นามสกุล
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displayNameTH}
                  </div>
                </div>

                {/* 3. บริษัท */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    บริษัท
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displayCompany}
                  </div>
                </div>

                {/* 4. ตำแหน่งงาน */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    ตำแหน่งงาน
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displayJob}
                  </div>
                </div>

                {/* 5. ฝ่าย / สำนัก */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    ฝ่าย / สำนัก
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displayDepartment}
                  </div>
                </div>

                {/* 6. แผนก / ส่วนงาน */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    แผนก / ส่วนงาน
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displaySection}
                  </div>
                </div>

                {/* 7. เบอร์โทรศัพท์ */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    เบอร์โทรศัพท์
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                    {displayMobile}
                  </div>
                </div>

                {/* 8. อีเมลติดต่อ */}
                <div className="space-y-1.5">
                  <label className="text-stone-500 font-medium block text-xs">
                    อีเมลติดต่อ
                  </label>
                  <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38] truncate" title={displayEmail}>
                    {displayEmail}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
