// src/app/profile/page.js

/**
 * =========================================================================
 * Page: หน้าข้อมูลโปรไฟล์ผู้ใช้งาน (User Profile Page)
 * Route: /profile
 * =========================================================================
 * สถาปัตยกรรม & ดีไซน์:
 * 1. ฟอนต์ Kanit 100% ทั้งหน้า
 * 2. ขนาดความกว้าง max-w-7xl พร้อมแถบ AccountSidebar นำทางด้านข้างสไตล์ Shopee
 * 3. วงกลมรูปโปรไฟล์ Avatar ขนาดใหญ่ตรงกลาง พร้อมปุ่มกล้องสำหรับเปลี่ยนรูปภาพขึ้น MinIO
 * 4. การ์ดข้อมูลผู้ใช้งาน 8 ช่องจัดคู่ 4 แถวแบบ Responsive Grid
 * =========================================================================
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useToastStore } from '@/app/stores/useToastStore';
import { useProfileStore } from '@/app/stores/useProfileStore';
import { useUnsavedChanges } from '@/app/hooks/useUnsavedChanges';
import { AccountSidebar } from '@/app/components/layout/AccountSidebar';
import { getProfileUrl } from '@/lib/utils';
import {
  RiCameraLine,
  RiLoader4Line,
  RiCheckLine,
  RiCloseLine,
} from 'react-icons/ri';

export default function ProfilePage() {
  // ดึงข้อมูลผู้ใช้งานที่ผ่านการยืนยันตัวตนจาก AuthProvider Context
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const info = userInfo?.info;

  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  // เชื่อมต่อ State รูปโปรไฟล์จาก useProfileStore
  const { profileImage, setProfileImage, fetchProfileImage } = useProfileStore();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef(null);

  // ดึงรูปโปรไฟล์ปัจจุบันเมื่อโหลดหน้า
  useEffect(() => {
    if (userInfo?.info?.image && !profileImage) {
      setProfileImage(userInfo.info.image);
    }
    if (token) {
      fetchProfileImage(token);
    }
  }, [token, userInfo?.info?.image, fetchProfileImage, setProfileImage, profileImage]);

  // คืนหน่วยความจำของ Object URL เมื่อเปลี่ยนหรือปิดหน้า
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // รีเซ็ต error เมื่อรูปเปลี่ยน
  useEffect(() => {
    setImgError(false);
  }, [profileImage]);

  // ตรวจสอบว่ามีรูปภาพใหม่ที่เลือกไว้และยังไม่ได้กดบันทึกหรือไม่
  const isDirty = Boolean(selectedFile);

  // เชื่อมต่อระบบแจ้งเตือนก่อนออกจากหน้า
  const { allowNavigation } = useUnsavedChanges(isDirty, {
    title: 'ยังไม่ได้บันทึกรูปโปรไฟล์',
    message:
      'คุณได้เลือกรูปโปรไฟล์ใหม่ไว้แต่ยังไม่ได้กดบันทึก หากออกจากหน้านี้ รูปภาพที่เลือกไว้จะไม่ถูกบันทึก คุณต้องการออกจากหน้านี้หรือไม่?',
    confirmText: 'ออกจากหน้านี้',
    cancelText: 'แก้ไขต่อ',
  });

  // 1. ฟังก์ชันเมื่อผู้ใช้เลือกไฟล์รูปภาพใหม่ (แสดงพรีวิวก่อน ยังไม่บันทึก)
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('กรุณาเลือกไฟล์ที่เป็นรูปภาพเท่านั้น');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('ขนาดไฟล์ต้องไม่เกิน 5 MB');
      return;
    }

    // ล้าง Object URL เดิมถ้ามี
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setImgError(false);
  };

  // 2. ฟังก์ชันกดยืนยันบันทึกรูปโปรไฟล์ใหม่ (เมื่อกดปุ่มติ๊กถูก)
  const handleSaveAvatar = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('image', selectedFile);

      const res = await fetch('/api/profile/image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadData,
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ');
      }

      allowNavigation();
      setProfileImage(result.image);
      setImgError(false);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      showSuccess('อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว');
    } catch (err) {
      showError(err.message || 'เกิดข้อผิดพลาดในการอัปเดตรูปโปรไฟล์');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. ฟังก์ชันกดยกเลิกการเปลี่ยนรูปโปรไฟล์ (เมื่อกดปุ่มกากบาท)
  const handleCancelAvatar = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setImgError(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  // ตัวอักษรย่อสำหรับแสดงในวงกลม Avatar (กรณีไม่มีรูปภาพ)
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
          <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 overflow-hidden">
            {/* ส่วนหัวของหน้า */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                  โปรไฟล์ผู้ใช้งาน
                </h1>
                <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
                  ข้อมูลบัญชีผู้ใช้งาน สังกัดฝ่าย และรายละเอียดการติดต่อ
                </p>
              </div>

              {/* ปุ่มบันทึกข้อมูลมุมบนขวา (แสดงเฉพาะเมื่อมีการเลือกรูปใหม่) */}
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelAvatar}
                    disabled={isUploading}
                    className="inline-flex items-center justify-center gap-1 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-normal px-3.5 py-2 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RiCloseLine className="w-4 h-4" />
                    <span>ยกเลิก</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAvatar}
                    disabled={isUploading}
                    className="inline-flex items-center justify-center gap-1.5 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white text-xs font-medium px-4 py-2 rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    title="บันทึกข้อมูลรูปโปรไฟล์"
                  >
                    {isUploading ? (
                      <>
                        <RiLoader4Line className="w-4 h-4 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <RiCheckLine className="w-4 h-4" />
                        <span>บันทึกข้อมูล</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* รายละเอียดโปรไฟล์ */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* ส่วนด้านบน: รูปโปรไฟล์ตรงกลาง พร้อมปุ่มอัปโหลดรูปภาพ */}
              <div className="flex flex-col items-center justify-center text-center pb-2">
                {/* วงกลมรูปโปรไฟล์ Avatar + กล้องสำหรับอัปโหลด */}
                <div className="relative group select-none">
                  {/* input file ซ่อนไว้หลังบ้าน */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelect}
                    disabled={isUploading}
                  />

                  {/* ตัววงกลม Avatar */}
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#2B2F38] text-white font-bold text-3xl flex items-center justify-center shadow-md border-4 border-stone-100 overflow-hidden cursor-pointer relative transition-transform group-hover:scale-105"
                    title={previewUrl ? 'คลิกเพื่อเลือกรูปภาพอื่น' : 'คลิกเพื่อเปลี่ยนรูปโปรไฟล์'}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="พรีวิวรูปโปรไฟล์"
                        className="w-full h-full object-cover"
                      />
                    ) : profileImage && !imgError ? (
                      <img
                        src={getProfileUrl(profileImage)}
                        alt={displayNameTH}
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <span>{avatarChar}</span>
                    )}

                    {/* Overlay มืดจางๆ เมื่อเอาเมาส์ชี้ */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <RiCameraLine className="w-7 h-7 text-white drop-shadow-md" />
                    </div>

                    {/* Spinner ขณะกำลังอัปโหลด */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                        <RiLoader4Line className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* ปุ่มไอคอนกล้องมุมขวาล่าง */}
                  <button
                    type="button"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute bottom-0 right-0 p-2 bg-[#2B2F38] hover:bg-black text-white rounded-full shadow-md border-2 border-white transition-colors cursor-pointer"
                    title={previewUrl ? 'คลิกเพื่อเปลี่ยนรูปภาพใหม่' : 'เปลี่ยนรูปโปรไฟล์'}
                  >
                    <RiCameraLine className="w-3.5 h-3.5" />
                  </button>
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