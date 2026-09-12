// src/app/store-management/info/page.js
'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { useUnsavedChanges } from '@/app/hooks/useUnsavedChanges';
import { getStoreLogoUrl } from '@/app/lib/utils';
import { FaShop } from 'react-icons/fa6';
import {
  RiStore2Line,
  RiArrowLeftLine,
  RiEdit2Line,
  RiCheckLine,
  RiCloseLine,
  RiGlobalLine,
  RiLockLine,
  RiCalendarEventLine,
  RiTimerLine,
  RiInformationLine,
  RiArrowDownSLine,
  RiCameraLine,
} from 'react-icons/ri';

export default function StoreInfoPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;

  const currentStore = useStoreManagementStore((state) => state.currentStore);
  const updateStoreInfo = useStoreManagementStore((state) => state.updateStoreInfo);

  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  // สถานะโหมดแก้ไข (Edit Mode)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  // 1. Ref สำหรับอ้างอิงไปยังแท็ก input file ที่เราซ่อนไว้
  const fileInputRef = useRef(null);
  // 2. เก็บตัว Object ไฟล์จริงที่เพิ่งเลือกมาจากเครื่อง
  const [selectedFile, setSelectedFile] = useState(null);
  // 3. เก็บ Blob URL สำหรับนำไปแสดงพรีวิวบนแท็ก <img>
  const [previewUrl, setPreviewUrl] = useState(null);

  // ฟังก์ชันเมื่อผู้ใช้เลือกรูปภาพจากเครื่อง
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // เช็คว่าเป็นไฟล์รูปภาพจริงหรือไม่
      if (!file.type.startsWith('image/')) {
        showError('กรุณาเลือกไฟล์ที่เป็นรูปภาพเท่านั้น');
        return;
      }
      setSelectedFile(file);
      console.log(selectedFile);
      // สร้าง URL จำลองเพื่อให้เบราว์เซอร์แสดงพรีวิวได้ทันทีโดยไม่ต้องอัปโหลดขึ้นเซิร์ฟเวอร์
      setPreviewUrl(URL.createObjectURL(file));
      setImgError(false);
    }
  };

  // ข้อมูลในฟอร์มแก้ไข
  const [formData, setFormData] = useState({
    store_id: currentStore?.store_id || '',
    store_name: currentStore?.store_name || '',
    store_desc: currentStore?.store_desc || '',
    store_access: currentStore?.store_access || 'public',
    store_image: currentStore?.store_image || '',
    restock_day: currentStore?.restock_day ?? 0,
    limit_order_day: currentStore?.limit_order_day ?? 0,
  });

  // ติดตามการสลับร้านค้าเพื่อรีเซ็ตโหมดแก้ไขและสถานะรูปภาพ
  const [prevStoreId, setPrevStoreId] = useState(currentStore?.store_id);
  if (currentStore?.store_id !== prevStoreId) {
    setPrevStoreId(currentStore?.store_id);
    setIsEditing(false);
    setImgError(false);
  }

  // เริ่มต้นโหมดแก้ไข
  const handleStartEdit = () => {
    if (!currentStore) return;
    setFormData({
      store_id: currentStore.store_id || '',
      store_name: currentStore.store_name || '',
      store_desc: currentStore.store_desc || '',
      store_access: currentStore.store_access || 'public',
      store_image: currentStore.store_image || '',
      restock_day: currentStore.restock_day ?? 0,
      limit_order_day: currentStore.limit_order_day ?? 0,
    });
    setImgError(false);
    setIsEditing(true);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // ยกเลิกการแก้ไข
  const handleCancelEdit = () => {
    if (currentStore) {
      setFormData({
        store_id: currentStore.store_id || '',
        store_name: currentStore.store_name || '',
        store_desc: currentStore.store_desc || '',
        store_access: currentStore.store_access || 'public',
        store_image: currentStore.store_image || '',
        restock_day: currentStore.restock_day ?? 0,
        limit_order_day: currentStore.limit_order_day ?? 0,
      });
      setImgError(false);
    }
    setIsEditing(false);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // ตรวจสอบว่าฟอร์มมีข้อมูลที่ถูกแก้ไขและยังไม่ได้บันทึกหรือไม่ (Dirty state)
  const isDirty = useMemo(() => {
    if (!isEditing || !currentStore) return false;
    if (selectedFile) return true;
    if ((formData.store_name || '').trim() !== (currentStore.store_name || '').trim()) return true;
    if ((formData.store_desc || '').trim() !== (currentStore.store_desc || '').trim()) return true;
    if (formData.store_access !== (currentStore.store_access || 'public')) return true;
    if (Number(formData.restock_day || 0) !== Number(currentStore.restock_day ?? 0)) return true;
    if (Number(formData.limit_order_day || 0) !== Number(currentStore.limit_order_day ?? 0)) return true;
    return false;
  }, [isEditing, currentStore, selectedFile, formData]);

  // เชื่อมต่อระบบแจ้งเตือนก่อนออกจากหน้า
  const { allowNavigation } = useUnsavedChanges(isDirty, {
    title: 'ยังไม่ได้บันทึกข้อมูลร้านค้า',
    message:
      'คุณมีข้อมูลร้านค้าที่กำลังแก้ไขและยังไม่ได้บันทึก หากออกจากหน้านี้ ข้อมูลที่แก้ไขไว้จะสูญหาย คุณต้องการออกจากหน้านี้หรือไม่?',
    confirmText: 'ออกจากหน้านี้',
    cancelText: 'แก้ไขต่อ',
  });

  // บันทึกข้อมูล
  const handleSave = async (e) => {
    e?.preventDefault();

    if (!formData.store_name.trim()) {
      showError('กรุณาระบุชื่อร้านค้า');
      return;
    }

    setIsSaving(true);
    try {
      // 1. ตั้งต้นชื่อรูปภาพด้วยชื่อเดิม
      let finalStoreImage = formData.store_image;

      // 2. ถ้ามีการเลือกรูปใหม่ ให้อัปโหลดขึ้น MinIO ก่อน
      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('store_id', formData.store_id); 
        uploadData.append('image', selectedFile);        

        const response = await fetch('/api/stores/image', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,          
          },
          body: uploadData,
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
        }

        finalStoreImage = result.store_image; // ได้ชื่อไฟล์ใหม่จาก MinIO
      }

      // 3. บันทึกข้อมูลร้านค้า (พร้อมชื่อรูปใหม่) ลงฐานข้อมูลและ Zustand Store
      await updateStoreInfo(token, {
        store_id: formData.store_id,
        store_name: formData.store_name.trim(),
        store_desc: formData.store_desc.trim(),
        store_access: formData.store_access,
        store_image: finalStoreImage,
        restock_day: parseInt(formData.restock_day, 10) || 0,
        limit_order_day: parseInt(formData.limit_order_day, 10) || 0,
      });

      showSuccess('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว');
      
      // 4. บายพาสการแจ้งเตือนและล้างสถานะแก้ไข
      allowNavigation();
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsEditing(false);
    } catch (err) {
      showError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลร้านค้า');
    } finally {
      setIsSaving(false);
    }
  };

  // กรณีผู้ใช้ยังไม่ได้เลือกร้านค้า
  if (!currentStore) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiStore2Line className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-[#2B2F38]">ยังไม่ได้เลือกร้านค้า</h2>
        <p className="text-xs text-stone-500 mt-1 max-w-sm mb-5">
          กรุณาเลือกร้านค้าที่คุณต้องการดูข้อมูลหรือจัดการจากหน้ารวมร้านค้า
        </p>
        <Link
          href="/store-management"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2B2F38] hover:bg-[#1E2229] text-white rounded-md text-xs font-medium transition-colors shadow-xs"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          <span>ไปหน้ารวมร้านค้า</span>
        </Link>
      </div>
    );
  }

  const restockDayVal = isEditing ? formData.restock_day : currentStore.restock_day;
  const limitOrderDayVal = isEditing ? formData.limit_order_day : currentStore.limit_order_day;

  // คำนวณ URL รูปภาพที่จะแสดง
  const activeLogo = isEditing ? formData.store_image : currentStore.store_image;
  const logoUrl = getStoreLogoUrl(activeLogo);
  const displayImage = previewUrl || logoUrl;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มแก้ไข (Standardized Header)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              ข้อมูลร้านค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            จัดการข้อมูลพื้นฐาน รายละเอียดร้านค้า และการตั้งค่าทั่วไป
          </p>
        </div>

        {/* ปุ่มแอ็กชันมุมบนขวา */}
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3.5 py-2 rounded-md transition-colors cursor-pointer shadow-2xs"
              title="แก้ไขข้อมูลร้านค้า"
            >
              <RiEdit2Line className="w-4 h-4 text-[#2B2F38]" />
              <span>แก้ไขข้อมูล</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-1 text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-normal px-3.5 py-2 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <RiCloseLine className="w-4 h-4" />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-1.5 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white text-xs font-medium px-4 py-2 rounded-md transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: เนื้อหาข้อมูลร้านค้า
          ───────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: เนื้อหาข้อมูลร้านค้า (เลย์เอาต์ใหม่: ซ้ายรูปภาพ / ขวาข้อมูลร้านค้า)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 space-y-6">
        {/* แท็ก input file ซ่อนไว้หลังบ้าน */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* แถวหลักส่วนบน: ซ้ายรูปภาพ (กว้าง 1 คอลัมน์ เท่ากับ การเข้าถึงร้านค้า ด้านล่าง) / ขวาข้อมูลร้านค้า (กว้าง 2 คอลัมน์) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-stretch">
          {/* ══════════════════════════════════════════════
              ฝั่งซ้าย: รูปภาพร้านค้า พร้อม Label (ความกว้างเท่ากับ คอลัมน์การเข้าถึงร้านค้า)
              ══════════════════════════════════════════════ */}
          <div className="col-span-1 flex flex-col space-y-1.5">
            <label className="text-stone-500 font-medium flex items-center gap-1 text-xs shrink-0">
              <RiCameraLine className="w-3.5 h-3.5 text-stone-400" />
              <span>รูปภาพร้านค้า</span>
            </label>

            {/* กล่องกรอบรูปภาพ (ยืดเต็มความสูงให้เท่ากับข้อมูลฝั่งขวา) */}
            <div
              onClick={() => {
                if (isEditing) {
                  fileInputRef.current?.click();
                }
              }}
              className={`relative w-full flex-1 min-h-[220px] bg-stone-50 border border-stone-200 flex items-center justify-center p-0 overflow-hidden shadow-2xs rounded-lg ${
                isEditing ? 'cursor-pointer group border-2 border-dashed transition-colors' : ''
              }`}
            >
              {displayImage && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayImage}
                  alt={formData.store_name || currentStore.store_name}
                  className="w-full h-full object-contain select-none"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="text-stone-300 flex flex-col items-center justify-center gap-1.5 p-4">
                  <FaShop className="w-12 h-12 text-stone-300" />
                  <span className="text-[11px] text-stone-400 font-medium">ไม่มีรูปภาพร้านค้า</span>
                </div>
              )}

              {/* Overlay แสดงตอนชี้เมาส์ในโหมดแก้ไข */}
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 select-none">
                  <RiCameraLine className="w-6 h-6" />
                  <span className="text-xs font-medium">คลิกเพื่อเปลี่ยนรูปภาพ</span>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              ฝั่งขวา: ข้อมูลร้านค้า (กว้าง 2 คอลัมน์: ชื่อร้าน ด้านบน + รายละเอียดร้าน ยืดเต็มความสูงเท่ารูปภาพ)
              ══════════════════════════════════════════════ */}
          <div className="col-span-1 md:col-span-2 flex flex-col min-w-0">
            {/* ชื่อร้านค้า (store_name) */}
            <div className="shrink-0 space-y-1.5 mb-4">
              <label className="text-stone-500 font-medium flex items-center gap-1 text-xs">
                <RiStore2Line className="w-3.5 h-3.5 text-stone-400" />
                <span>ชื่อร้านค้า</span>
                <span className="text-rose-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.store_name}
                  onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                  maxLength={64}
                  placeholder="ระบุชื่อร้านค้า..."
                  className="w-full p-2.5 sm:p-3 bg-white rounded-lg border border-stone-300 font-medium text-[#2B2F38] text-xs sm:text-sm focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-all shadow-2xs"
                />
              ) : (
                <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                  {currentStore.store_name || '-'}
                </div>
              )}
            </div>

            {/* รายละเอียดร้านค้า (store_desc) - ยืดความยาวลงมาให้เท่ากับรูปภาพ */}
            <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
              <label className="text-stone-500 font-medium flex items-center gap-1 text-xs shrink-0">
                <RiInformationLine className="w-3.5 h-3.5 text-stone-400" />
                <span>รายละเอียดร้านค้า</span>
              </label>
              {isEditing ? (
                <textarea
                  value={formData.store_desc}
                  onChange={(e) => setFormData({ ...formData, store_desc: e.target.value })}
                  placeholder="ระบุข้อมูลเพิ่มเติม หรือรายละเอียดเกี่ยวกับร้านค้า..."
                  className="w-full flex-1 min-h-[120px] p-2.5 sm:p-3 bg-white rounded-lg border border-stone-300 font-normal text-[#2B2F38] text-xs sm:text-sm focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-all shadow-2xs resize-none"
                />
              ) : (
                <div className="w-full flex-1 min-h-[120px] p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-normal text-[#2B2F38] whitespace-pre-wrap overflow-y-auto">
                  {currentStore.store_desc || '-'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* เส้นคั่นบางๆ */}
        <hr className="border-stone-100" />

        {/* แถวล่าง: การเข้าถึงร้านค้า, วันที่เติมของ, ลิมิตวันที่รายการตกค้าง (3 คอลัมน์) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
          {/* 1. การเข้าถึงร้านค้า (store_access) */}
          <div className="space-y-1.5">
            <label className="text-stone-500 font-medium flex items-center gap-1 text-xs">
              <RiInformationLine className="w-3.5 h-3.5 text-stone-400" />
              <span>การเข้าถึงร้านค้า</span>
              <span className="text-rose-500">*</span>
            </label>
            {isEditing ? (
              <div>
                <div className="relative">
                  <select
                    value={formData.store_access}
                    onChange={(e) => setFormData({ ...formData, store_access: e.target.value })}
                    className="w-full p-2.5 sm:p-3 pr-9 bg-white rounded-lg border border-stone-300 font-medium text-[#2B2F38] text-xs sm:text-sm focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-all shadow-2xs appearance-none cursor-pointer"
                  >
                    <option value="public">สาธารณะ (Public) - ทุกคนสั่งได้</option>
                    <option value="private">เฉพาะกลุ่ม (Private) - จำกัดสิทธิ์</option>
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <RiArrowDownSLine className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-stone-400 mt-1 font-normal">
                  กำหนดสิทธิ์การมองเห็นและสั่งซื้อสินค้าภายในร้าน
                </p>
              </div>
            ) : (
              <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38] flex items-center justify-between">
                <span>
                  {currentStore.store_access === 'private'
                    ? 'เฉพาะกลุ่ม (Private)'
                    : 'สาธารณะ (Public)'}
                </span>
                {currentStore.store_access === 'private' ? (
                  <RiLockLine className="w-4 h-4 text-amber-600 shrink-0 ml-2" />
                ) : (
                  <RiGlobalLine className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                )}
              </div>
            )}
          </div>

          {/* 2. วันที่เติมของ (restock_day) */}
          <div className="space-y-1.5">
            <label className="text-stone-500 font-medium flex items-center gap-1 text-xs">
              <RiCalendarEventLine className="w-3.5 h-3.5 text-stone-400" />
              <span>วันที่เติมของ</span>
            </label>
            {isEditing ? (
              <div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={formData.restock_day}
                    onChange={(e) => setFormData({ ...formData, restock_day: e.target.value })}
                    placeholder="เช่น 15 (ทุกวันที่ 15 ของเดือน)"
                    className="w-full p-2.5 sm:p-3 bg-white rounded-lg border border-stone-300 font-medium text-[#2B2F38] text-xs sm:text-sm focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-all shadow-2xs pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">
                    ของเดือน
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1 font-normal">
                  กำหนดวันที่เติมสินค้าเข้าคลังในแต่ละเดือน (1-31 หรือ 0 หากไม่ระบุ)
                </p>
              </div>
            ) : (
              <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                {Number(restockDayVal) > 0
                  ? `ทุกวันที่ ${restockDayVal} ของเดือน`
                  : 'ยังไม่ได้กำหนดรอบวันเติมของ'}
              </div>
            )}
          </div>

          {/* 3. ลิมิตวันที่รายการตกค้าง (limit_order_day) */}
          <div className="space-y-1.5">
            <label className="text-stone-500 font-medium flex items-center gap-1 text-xs">
              <RiTimerLine className="w-3.5 h-3.5 text-stone-400" />
              <span>ลิมิตวันที่รายการตกค้าง</span>
            </label>
            {isEditing ? (
              <div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={formData.limit_order_day}
                    onChange={(e) => setFormData({ ...formData, limit_order_day: e.target.value })}
                    placeholder="เช่น 7 (ไม่เกิน 7 วัน)"
                    className="w-full p-2.5 sm:p-3 bg-white rounded-lg border border-stone-300 font-medium text-[#2B2F38] text-xs sm:text-sm focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-all shadow-2xs pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">
                    วัน
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1 font-normal">
                  จำนวนวันสูงสุดที่ยอมให้ออเดอร์ค้างในระบบก่อนแจ้งเตือน (0 หากไม่จำกัด)
                </p>
              </div>
            ) : (
              <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200 font-medium text-[#2B2F38]">
                {Number(limitOrderDayVal) > 0
                  ? `ไม่เกิน ${limitOrderDayVal} วัน`
                  : 'ไม่จำกัดจำนวนวัน'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

