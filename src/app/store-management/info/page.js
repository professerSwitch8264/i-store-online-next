// src/app/store-management/info/page.js
'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { useUnsavedChanges } from '@/app/hooks/useUnsavedChanges';
import { getStoreLogoUrl } from '@/lib/utils';
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
  RiLoader4Line,
} from 'react-icons/ri';
import { SearchableSelect } from '@/app/components/ui/SearchableSelect';

export default function StoreInfoPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;

  const currentStore = useStoreManagementStore((state) => state.currentStore);
  const updateStoreInfo = useStoreManagementStore((state) => state.updateStoreInfo);

  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  // สถานะเปิด/ปิด Modal แก้ไขข้อมูลร้านค้า
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [modalImgError, setModalImgError] = useState(false);

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
      // สร้าง URL จำลองเพื่อให้เบราว์เซอร์แสดงพรีวิวได้ทันทีโดยไม่ต้องอัปโหลดขึ้นเซิร์ฟเวอร์
      setPreviewUrl(URL.createObjectURL(file));
      setModalImgError(false);
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
    setIsModalOpen(false);
    setImgError(false);
  }

  // เริ่มต้นโหมดแก้ไข (เปิด Modal)
  const handleOpenEditModal = () => {
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
    setSelectedFile(null);
    setPreviewUrl(null);
    setModalImgError(false);
    setIsModalOpen(true);
  };

  // ปิด Modal แก้ไข
  const handleCloseEditModal = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // ป้องกันการพิมพ์เครื่องหมายที่ไม่ใช่ตัวเลข เช่น -, +, e, E, .
  const handleNumberKeyDown = (e) => {
    if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  // จัดการพิมพ์ช่องวันที่เติมของ: บล็อกให้อยู่ในช่วง 0 - 31 เท่านั้น
  const handleRestockDayChange = (e) => {
    const text = e.target.value.replace(/\D/g, '');
    if (text === '') {
      setFormData((prev) => ({ ...prev, restock_day: '' }));
      return;
    }
    const num = parseInt(text, 10);
    const clamped = Math.min(31, Math.max(0, num));
    setFormData((prev) => ({ ...prev, restock_day: clamped }));
  };

  const handleRestockDayBlur = () => {
    const num = parseInt(formData.restock_day, 10);
    setFormData((prev) => ({
      ...prev,
      restock_day: isNaN(num) || num < 0 ? 0 : Math.min(31, num),
    }));
  };

  // จัดการพิมพ์ช่องลิมิตวันที่รายการตกค้าง: บล็อกให้ >= 0 (ไม่จำกัดเพดานบน)
  const handleLimitOrderDayChange = (e) => {
    const text = e.target.value.replace(/\D/g, '');
    if (text === '') {
      setFormData((prev) => ({ ...prev, limit_order_day: '' }));
      return;
    }
    const num = parseInt(text, 10);
    const clamped = Math.max(0, num);
    setFormData((prev) => ({ ...prev, limit_order_day: clamped }));
  };

  const handleLimitOrderDayBlur = () => {
    const num = parseInt(formData.limit_order_day, 10);
    setFormData((prev) => ({
      ...prev,
      limit_order_day: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  // ตรวจสอบว่าฟอร์มมีข้อมูลที่ถูกแก้ไขและยังไม่ได้บันทึกหรือไม่ (Dirty state)
  const isDirty = useMemo(() => {
    if (!isModalOpen || !currentStore) return false;
    if (selectedFile) return true;
    if ((formData.store_name || '').trim() !== (currentStore.store_name || '').trim()) return true;
    if ((formData.store_desc || '').trim() !== (currentStore.store_desc || '').trim()) return true;
    if (formData.store_access !== (currentStore.store_access || 'public')) return true;
    if (Number(formData.restock_day || 0) !== Number(currentStore.restock_day ?? 0)) return true;
    if (Number(formData.limit_order_day || 0) !== Number(currentStore.limit_order_day ?? 0)) return true;
    return false;
  }, [isModalOpen, currentStore, selectedFile, formData]);

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
        restock_day: Math.max(0, Math.min(31, parseInt(formData.restock_day, 10) || 0)),
        limit_order_day: Math.max(0, parseInt(formData.limit_order_day, 10) || 0),
      });

      showSuccess('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว');
      
      // 4. บายพาสการแจ้งเตือนและล้างสถานะแก้ไข
      allowNavigation();
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsModalOpen(false);
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

  const displayLogoUrl = getStoreLogoUrl(currentStore.store_image);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มแก้ไขข้อมูล
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
            ข้อมูลร้านค้า
          </h1>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            จัดการข้อมูลพื้นฐาน รายละเอียดร้านค้า และการตั้งค่าทั่วไป
          </p>
        </div>

        {/* ปุ่มแก้ไขข้อมูล */}
        <button
          type="button"
          onClick={handleOpenEditModal}
          className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3.5 py-2 rounded-md transition-colors cursor-pointer shadow-2xs"
          title="แก้ไขข้อมูลร้านค้า"
        >
          <RiEdit2Line className="w-4 h-4 text-[#2B2F38]" />
          <span>แก้ไขข้อมูล</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: เนื้อหาข้อมูลร้านค้า (แสดงแบบ Label ทั้งหมด ไม่ใช่กล่อง)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8">
        {/* แถวหลักส่วนบน: ซ้ายรูปภาพ / ขวาข้อมูลร้านค้า */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch">
          {/* ฝั่งซ้าย: รูปภาพร้านค้า */}
          <div className="col-span-1 flex flex-col space-y-2">
            <span className="text-xs font-medium text-stone-500 flex items-center gap-1.5 select-none">
              <RiCameraLine className="w-4 h-4 text-stone-400" />
              <span>รูปภาพร้านค้า</span>
            </span>

            {/* กรอบแสดงรูปภาพร้านค้า สะอาดตา */}
            <div className="w-full aspect-square max-w-[240px] mx-auto md:mx-0 bg-stone-50 border border-stone-200 rounded-lg flex items-center justify-center p-3 overflow-hidden shadow-2xs">
              {displayLogoUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayLogoUrl}
                  alt={currentStore.store_name}
                  className="w-full h-full object-contain select-none"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="text-stone-300 flex flex-col items-center justify-center gap-2 p-4">
                  <FaShop className="w-12 h-12 text-stone-300" />
                  <span className="text-xs text-stone-400 font-medium">ไม่มีรูปภาพร้านค้า</span>
                </div>
              )}
            </div>
          </div>

          {/* ฝั่งขวา: ข้อมูลร้านค้า (ใส่กล่องทึบครอบพอดีกับรูปภาพฝั่งซ้าย) */}
          <div className="col-span-1 md:col-span-2 flex flex-col space-y-2">
            <span className="text-xs font-medium text-stone-500 flex items-center gap-1.5 select-none">
              <RiStore2Line className="w-4 h-4 text-stone-400" />
              <span>ข้อมูลทั่วไปของร้านค้า</span>
            </span>

            {/* กรอบกล่องทึบครอบข้อมูลร้านค้า ขนาดและสไตล์เข้าคู่กับฝั่งซ้าย */}
            <div className="w-full bg-stone-50 border border-stone-200 rounded-lg p-4 sm:p-5 flex-1 flex flex-col justify-between shadow-2xs min-h-[240px]">
              {/* ส่วนบน: ชื่อร้านค้า และ รายละเอียดร้านค้า */}
              <div className="space-y-3">
                {/* ชื่อร้านค้า */}
                <div>
                  <span className="text-xs font-medium text-stone-500 flex items-center gap-1.5 mb-0.5">
                    <RiStore2Line className="w-3.5 h-3.5 text-stone-400" />
                    <span>ชื่อร้านค้า</span>
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-[#2B2F38]">
                    {currentStore.store_name || '-'}
                  </h2>
                </div>

                {/* รายละเอียดร้านค้า */}
                <div>
                  <span className="text-xs font-medium text-stone-500 flex items-center gap-1.5 mb-0.5">
                    <RiInformationLine className="w-3.5 h-3.5 text-stone-400" />
                    <span>รายละเอียดร้านค้า</span>
                  </span>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-normal whitespace-pre-wrap">
                    {currentStore.store_desc || '-'}
                  </p>
                </div>
              </div>

              {/* ส่วนล่าง: แถวการตั้งค่าร้านค้า (3 คอลัมน์) มีเส้นคั่นบางๆ ด้านบน */}
              <div className="pt-3 border-t border-stone-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3">
                {/* การเข้าถึงร้านค้า */}
                <div>
                  <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
                    <RiGlobalLine className="w-3.5 h-3.5 text-stone-400" />
                    <span>การเข้าถึงร้านค้า</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#2B2F38]">
                    {currentStore.store_access === 'private' ? (
                      <>
                        <RiLockLine className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>เฉพาะกลุ่ม (Private)</span>
                      </>
                    ) : (
                      <>
                        <RiGlobalLine className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>สาธารณะ (Public)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* วันที่เติมของ */}
                <div>
                  <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
                    <RiCalendarEventLine className="w-3.5 h-3.5 text-stone-400" />
                    <span>วันที่เติมของ (วัน)</span>
                  </span>
                  <div className="text-xs sm:text-sm font-medium text-[#2B2F38]">
                    {Number(currentStore.restock_day) > 0
                      ? `ทุกวันที่ ${currentStore.restock_day} ของเดือน`
                      : 'ยังไม่ได้กำหนดรอบวัน'}
                  </div>
                </div>

                {/* กำหนดวันค้างสูงสุด */}
                <div>
                  <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1 mb-1">
                    <RiTimerLine className="w-3.5 h-3.5 text-stone-400" />
                    <span>กำหนดวันค้างสูงสุด (วัน)</span>
                  </span>
                  <div className="text-xs sm:text-sm font-medium text-[#2B2F38]">
                    {Number(currentStore.limit_order_day) > 0
                      ? `ไม่เกิน ${currentStore.limit_order_day} วัน`
                      : 'ไม่จำกัดจำนวนวัน'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Modal: แก้ไขข้อมูลร้านค้า (สไตล์ Outlined Input + Floating Label เหมือนหน้าอื่นๆ)
          ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-xs shadow-2xl border border-stone-200 w-full max-w-lg max-h-[92vh] overflow-y-auto font-sans animate-scale p-6 sm:p-7">
            {/* Input file ซ่อนไว้สำหรับเลือกรูปภาพ */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* หัวข้อ Modal */}
            <h3 className="text-lg sm:text-xl font-bold text-[#2B2F38] mb-6">
              แก้ไขข้อมูลร้านค้า
            </h3>

            <form onSubmit={handleSave}>
              <div className="space-y-5">
                {/* 1. ส่วนรูปภาพร้านค้า */}
                <div className="flex items-center gap-4 p-3 bg-stone-50/80 rounded-md border border-stone-200">
                  <div className="w-16 h-16 rounded-md bg-white border border-stone-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {previewUrl || (formData.store_image && !modalImgError) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl || getStoreLogoUrl(formData.store_image)}
                        alt={formData.store_name}
                        className="w-full h-full object-contain"
                        onError={() => setModalImgError(true)}
                      />
                    ) : (
                      <FaShop className="w-7 h-7 text-stone-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[#2B2F38]">รูปภาพร้านค้า</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      รองรับไฟล์รูปภาพ PNG, JPG, JPEG, WEBP
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] rounded text-xs font-normal transition-colors cursor-pointer shadow-2xs"
                    >
                      <RiCameraLine className="w-3.5 h-3.5" />
                      <span>{selectedFile || formData.store_image ? 'เปลี่ยนรูปภาพ' : 'อัปโหลดรูปภาพ'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. ช่องชื่อร้านค้า */}
                <div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                      <RiStore2Line className="w-5 h-5 text-stone-600" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={64}
                      placeholder=""
                      value={formData.store_name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, store_name: e.target.value }))
                      }
                      className="w-full h-12 pl-10 pr-4 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                      ชื่อร้านค้า <span className="text-stone-500">*</span>
                    </label>
                  </div>
                </div>

                {/* 3. ช่องรายละเอียดร้านค้า */}
                <div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 text-stone-500 pointer-events-none flex items-center justify-center">
                      <RiInformationLine className="w-5 h-5 text-stone-600" />
                    </div>
                    <textarea
                      rows={3}
                      placeholder=""
                      value={formData.store_desc}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, store_desc: e.target.value }))
                      }
                      className="w-full pl-10 pr-4 pt-3 pb-3 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal resize-none"
                    />
                    <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                      รายละเอียดร้านค้า
                    </label>
                  </div>
                </div>

                {/* 4. ช่องการเข้าถึงร้านค้า */}
                <div>
                  <SearchableSelect
                    label="การเข้าถึงร้านค้า *"
                    value={formData.store_access}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, store_access: e.target.value }))
                    }
                    prefix={<RiGlobalLine className="w-5 h-5 text-stone-600" />}
                    height="h-12"
                    searchable={false}
                  >
                    <option value="public">สาธารณะ (Public) - ทุกคนสั่งได้</option>
                    <option value="private">เฉพาะกลุ่ม (Private) - จำกัดสิทธิ์</option>
                  </SearchableSelect>
                </div>

                {/* 5. แถววันที่เติมของ & ลิมิตวันที่รายการตกค้าง (2 คอลัมน์) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* วันที่เติมของ */}
                  <div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                        <RiCalendarEventLine className="w-5 h-5 text-stone-600" />
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="31"
                        placeholder="0"
                        value={formData.restock_day}
                        onKeyDown={handleNumberKeyDown}
                        onChange={handleRestockDayChange}
                        onBlur={handleRestockDayBlur}
                        className="w-full h-12 pl-10 pr-16 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">
                        ของเดือน
                      </span>
                      <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                        วันที่เติมของ
                      </label>
                    </div>
                  </div>

                  {/* ลิมิตวันที่รายการตกค้าง */}
                  <div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                        <RiTimerLine className="w-5 h-5 text-stone-600" />
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.limit_order_day}
                        onKeyDown={handleNumberKeyDown}
                        onChange={handleLimitOrderDayChange}
                        onBlur={handleLimitOrderDayBlur}
                        className="w-full h-12 pl-10 pr-12 bg-white border border-stone-300 rounded-md text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">
                        วัน
                      </span>
                      <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                        ลิมิตวันที่รายการตกค้าง
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* ปุ่มควบคุมด้านล่างขวา (ปุ่มบันทึก, ปุ่มยกเลิกสีแดง) */}
              <div className="flex items-center justify-end gap-3 mt-7">
                <button
                  type="submit"
                  disabled={!formData.store_name.trim() || isSaving}
                  className={`px-5 py-2 rounded text-sm font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                    formData.store_name.trim() && !isSaving
                      ? 'bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white cursor-pointer'
                      : 'bg-[#E0E0E0] text-stone-500 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                  ) : (
                    <RiCheckLine className="w-4 h-4" />
                  )}
                  <span>บันทึก</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#D32F2F] hover:bg-[#C62828] active:bg-[#B71C1C] text-white rounded text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RiCloseLine className="w-4 h-4" />
                  <span>ยกเลิก</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

