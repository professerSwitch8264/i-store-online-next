// src/app/components/product/PreorderModal.jsx
'use client';

import { useState } from 'react';
import { QuantityStepper } from '@/app/components/ui/QuantityStepper'; // 👈 @/app/components
import { getThumbnailUrl, formatPrice } from '@/lib/utils';
import { FaShop, FaShopLock } from 'react-icons/fa6';
import { RiBookmarkLine, RiImageLine } from 'react-icons/ri';

/**
 * Component: PreorderModal (หน้าต่าง Popup สำหรับสั่งจองสินค้าล่วงหน้า)
 * หน้าที่: แสดงรายละเอียดสินค้า, ให้ผู้ใช้เลือกจำนวนที่ต้องการสั่งจอง (ตาม Batch Size),
 * คำนวณราคารวมสดๆ แบบ Real-time และส่งคำสั่งสั่งจอง (reserve_flag = 'Y')
 *
 * @param {boolean} isOpen - สถานะเปิด (true) หรือปิด (false) หน้าต่าง Popup
 * @param {function} onClose - ฟังก์ชันสำหรับสั่งปิดหน้าต่าง
 * @param {object} product - อ็อบเจกต์ข้อมูลสินค้าชิ้นที่เลือก
 * @param {function} onConfirm - ฟังก์ชัน Callback บันทึกการสั่งจองส่งกลับไปให้ component แม่
 */
export function PreorderModal({ isOpen, onClose, product, onConfirm }) {
  // batchSize: ขนาดชุดการสั่งซื้อขั้นต่ำ (ถ้าไม่มีหรือ <= 0 ให้ใช้ค่าเริ่มต้นคือ 1)
  const batchSize = product?.batch_size && product.batch_size > 0 ? product.batch_size : 1;

  // quantity: State เก็บจำนวนชิ้นที่ผู้ใช้กำลังเลือกอยู่ (เริ่มต้นเท่ากับขนาดชุด batchSize)
  const [quantity, setQuantity] = useState(batchSize);

  // loading: State ควบคุมสถานะกำลังส่งข้อมูลบันทึกลงฐานข้อมูล (ปิดปุ่มกันกดย้ำ)
  const [loading, setLoading] = useState(false);

  // imgError: State ตรวจจับรูปภาพเสีย (ถ้าโหลดรูปไม่ขึ้น จะสลับไปโชว์ไอคอนแทน)
  const [imgError, setImgError] = useState(false);

  // prevProduct: เก็บประวัติสินค้าชิ้นก่อนหน้า เพื่อรีเซ็ตค่าเริ่มต้นเมื่อสลับไปเปิดดูสินค้าชิ้นใหม่
  const [prevProduct, setPrevProduct] = useState(product);
  if (product !== prevProduct) {
    setPrevProduct(product);
    setQuantity(batchSize);
    setImgError(false);
    setLoading(false);
  }

  // ถ้าสั่งปิด หรือไม่มีข้อมูลสินค้า ให้คืนค่า null (ไม่วาด UI ออกมา)
  if (!isOpen || !product) return null;

  // imageUrl: ดึง URL รูปภาพเต็มของสินค้า
  const imageUrl = getThumbnailUrl(product.product_thumbnail);

  // restockDay: วันปิดรอบออเดอร์ของร้านค้า (ค่าเริ่มต้นคือวันที่ 5 ตาม Easy Store)
  const restockDay = product.restock_day || 5;

  // validQty: จำนวนชิ้นที่การันตีว่าถูกต้อง (ไม่เป็น 0 และไม่ต่ำกว่า batchSize)
  const validQty = quantity > 0 ? quantity : batchSize;

  // totalPrice: ราคารวมคำนวณสด (ราคาต่อหน่วย x จำนวนที่เลือก)
  const totalPrice = (product.product_price || 0) * validQty;

  // ฟังก์ชันกดยืนยันการสั่งจองล่วงหน้า
  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // ส่งจำนวนชิ้นที่ถูกต้องกลับไปบันทึกลงตะกร้า (reserve_flag = 'Y')
      await onConfirm(validQty);
      onClose(); // ปิดหน้าต่าง Popup เมื่อบันทึกสำเร็จ
    } catch (err) {
      console.error('Confirm preorder error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* 1. Backdrop พื้นหลังมืดโปร่งแสง (คลิกที่ว่างข้างนอกเพื่อปิด) */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      {/* 2. การ์ดหน้าต่าง Modal สีขาว ขอบมนน้อยที่สุด */}
      <div className="relative w-full max-w-[380px] sm:max-w-[400px] bg-white rounded-xs shadow-2xl overflow-hidden z-10 flex flex-col border border-stone-200">
        {/* หัวข้อหน้าต่าง */}
        <div className="px-5 py-3 border-b border-stone-100 bg-white">
          <h2 className="text-sm sm:text-base font-bold text-[#2B2F38]">สั่งสินค้าล่วงหน้า</h2>
        </div>

        {/* แบนเนอร์รูปสินค้า */}
        <div className="relative w-full h-48 bg-stone-50 border-b border-stone-100 flex items-center justify-center p-4 overflow-hidden">
          {imageUrl && !imgError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={product.product_name}
              className="max-h-full max-w-full object-contain drop-shadow-xs"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="text-stone-300 flex flex-col items-center">
              <RiImageLine className="w-10 h-10" />
              <span className="text-[10px] mt-1 text-stone-400">ไม่มีรูปภาพสินค้า</span>
            </div>
          )}
        </div>

        {/* ข้อมูลสินค้าและคำนวณราคา */}
        <div className="p-5 space-y-3">
          <div className="space-y-1">
            {/* หมวดหมู่สินค้า */}
            <div>
              <span className="inline-block px-2 py-0.5 rounded-xs text-[10px] sm:text-[11px]  bg-stone-100 text-stone-600 border border-stone-200/80">
                {product.category_name || 'ทั่วไป'}
              </span>
            </div>

            {/* ชื่อสินค้า */}
            <h3 className="text-base font-bold text-[#2B2F38] leading-snug line-clamp-2" title={product.product_name}>
              {product.product_name}
            </h3>

            {/* ชื่อร้านค้า (พร้อมไอคอน FaShop สำหรับร้าน Public หรือ FaShopLock สำหรับร้าน Private) */}
            {product.store_name && (
              <p className="text-xs text-stone-500 font-normal truncate flex items-center gap-1.5">
                {product.store_access === 'private' ? (
                  <FaShopLock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                ) : (
                  <FaShop className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                )}
                <span className="truncate">{product.store_name}</span>
              </p>
            )}
          </div>

          {/* แถวราคาต่อหน่วย และ Stepper ปรับจำนวน */}
          <div className="border-t border-stone-100 pt-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600">
              <span>ราคาต่อหน่วย</span>
              <span className="font-bold text-[#2B2F38]">
                <span className="text-base font-black text-[#2B2F38]">{formatPrice(product.product_price)}</span>
                <span className="text-xs text-stone-400 font-normal"> บาท / {product.unit_name || 'ชิ้น'}</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600">
              <span>จำนวนที่ต้องการ</span>
              {/* Stepper ปรับจำนวน ยึดตาม batchSize ขั้นต่ำ และสั่งได้ไม่จำกัดเพดาน */}
              <QuantityStepper
                value={quantity}
                step={batchSize}
                min={batchSize}
                max={999999}
                loading={loading}
                disabled={loading}
                onChange={(newVal) => setQuantity(newVal)}
              />
            </div>
          </div>

          {/* แถวคำนวณราคารวม (คั่นด้วยเส้นประ) */}
          <div className="border-t border-dashed border-stone-200 pt-2.5 flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-[#2B2F38]">ราคารวม</span>
            <span className="text-base sm:text-lg font-black text-[#2B2F38]">
              {formatPrice(totalPrice)}{' '}
              <span className="text-xs sm:text-sm font-medium text-stone-500">บาท</span>
            </span>
          </div>

          {/* ข้อความเงื่อนไขระยะเวลาและรอบเติมของ (Easy Store style: อยู่เหนือปุ่มยกเลิกและสั่งล่วงหน้า) */}
          <div className="pt-0.5 text-[11px] text-[#DC2626] font-medium leading-relaxed">
            *ระยะเวลาการดำเนินการประมาณ 1 เดือน **ปิดรับออเดอร์ วันที่ {restockDay} ของทุกๆ เดือน
          </div>

          {/* ปุ่มคู่ Actions: ยกเลิก / ยืนยันสั่งล่วงหน้า */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full py-2 px-4 rounded-md border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-2 px-4 rounded-md bg-[#2B2F38] hover:bg-[#1E2229] text-white font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 animate-spin text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>กำลังสั่ง...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <RiBookmarkLine className="w-4 h-4" />
                  <span>สั่งล่วงหน้า</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}