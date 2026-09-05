// src/app/components/product/ProductCard.jsx
'use client';

import { useState } from 'react';
import { getThumbnailUrl, formatPrice } from '@/app/lib/utils';      
import { useCartStore } from '@/app/stores/useCartStore';             
import { QuantityStepper } from '@/app/components/ui/QuantityStepper'; 
import { PreorderModal } from '@/app/components/product/PreorderModal'; 
import { FaShop, FaShopLock } from 'react-icons/fa6';
import { RiImageLine, RiBookmarkLine } from 'react-icons/ri';

/**
 * Component: ProductCard (การ์ดแสดงข้อมูลสินค้า 1 ชิ้น)
 * หน้าที่: แสดงรูปภาพ, ชื่อ, หมวดหมู่, ร้านค้า, ราคา, สต็อกคงเหลือ
 * พร้อมตัวปรับจำนวน QuantityStepper, ปุ่มสั่งจองล่วงหน้า 🔖, และปุ่มใส่ตะกร้า 🛒
 *
 * @param {object} product - ข้อมูลสินค้า 1 ชิ้นที่ส่งเข้ามาแสดงผล
 */
export function ProductCard({ product }) {
  // imgError: State ตรวจจับว่ารูปภาพของสินค้านี้เสียหรือไม่ (ถ้าเสียจะสลับไปโชว์ไอคอน RiImageLine แทน)
  const [imgError, setImgError] = useState(false);

  // isAdding: State ควบคุมสถานะตอนกดปุ่มใส่ตะกร้า (ใช้ปิดปุ่มชั่วคราวเพื่อป้องกันการกดย้ำๆ)
  const [isAdding, setIsAdding] = useState(false);

  // preorderOpen: State เปิด/ปิดหน้าต่าง Popup สั่งจองล่วงหน้า (PreorderModal)
  const [preorderOpen, setPreorderOpen] = useState(false);

  // addItem: ฟังก์ชันสั่งเพิ่มสินค้าลงตะกร้า ดึงมาจาก Zustand useCartStore
  const addItem = useCartStore((state) => state.addItem);

  // batchSize: ขนาดชุดการสั่งซื้อขั้นต่ำ (เช่น 1 ชิ้น, 6 ชิ้น/แพ็ค, 12 ชิ้น/กล่อง)
  const batchSize = product.batch_size && product.batch_size > 0 ? product.batch_size : 1;

  // quantity: State เก็บจำนวนชิ้นที่ผู้ใช้กำลังเลือกบนการ์ดใบนี้ (เริ่มต้นเท่ากับ batchSize)
  const [quantity, setQuantity] = useState(batchSize);

  // imageUrl: ดึง URL รูปภาพเต็มของสินค้าจากเซิร์ฟเวอร์
  const imageUrl = getThumbnailUrl(product.product_thumbnail);

  // stock: จำนวนสต็อกคงเหลือจริงในคลังสินค้า (ดึงมาจาก view: v_inventory)
  const stock = product.stock_quantity ?? 0;

  // isAvailable: ตรวจว่าสต็อกมีพอสำหรับการสั่งซื้อขั้นต่ำ 1 ชุดหรือไม่ (stock >= batchSize)
  const isAvailable = stock >= batchSize;

  // 🛒 ฟังก์ชันเมื่อกดปุ่ม "ใส่ตะกร้าปกติ"
  const handleAddToCart = async () => {
    if (!isAvailable) {
      // ถ้าสินค้าหมดสต็อก ให้เปิดหน้าต่าง Pre-order สั่งจองล่วงหน้าแทนอัตโนมัติ
      setPreorderOpen(true);
      return;
    }

    setIsAdding(true);
    try {
      // ส่งคำสั่งเพิ่มสินค้าลงตะกร้าแบบปกติ (reserve_flag = 'N')
      await addItem(product.product_id, quantity, 'N');
    } catch (err) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเพิ่มสินค้าลงตะกร้า');
    } finally {
      setIsAdding(false);
    }
  };

  // 🔖 ฟังก์ชันเมื่อกดยืนยันจากหน้าต่าง PreorderModal
  const handleConfirmPreorder = async (customQty) => {
    // ส่งคำสั่งสั่งจองล่วงหน้า (reserve_flag = 'Y')
    await addItem(product.product_id, customQty, 'Y');
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-[#EB6E3E]/70 transition-all duration-200 flex flex-col justify-between group">
        {/* ─────────────────────────────────────────────────────────────
            1. พื้นที่รูปภาพสินค้า
            ───────────────────────────────────────────────────────────── */}
        <div className="relative w-full h-32 bg-white flex items-center justify-center overflow-hidden border-b border-stone-100">
          {/* แสตมป์ Sold Out (แสดงเมื่อสต็อกไม่พอสั่งซื้อขั้นต่ำ) */}
          {!isAvailable && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-3 bg-white/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/soldout.png"
                alt="Sold Out"
                className="w-20 h-auto object-contain select-none opacity-90 drop-shadow-md"
              />
            </div>
          )}

          {imageUrl && !imgError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={product.product_name}
              className={`w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300 ${
                !isAvailable ? 'opacity-40 grayscale' : ''
              }`}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="text-stone-300 flex flex-col items-center justify-center w-full h-full">
              <RiImageLine className="w-8 h-8 text-stone-300" />
              <span className="text-[10px] mt-1 text-stone-400 font-medium">ไม่มีรูปภาพ</span>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. ข้อมูลรายละเอียดสินค้า (ชื่อ, หมวดหมู่, ร้านค้า, ราคา)
            ───────────────────────────────────────────────────────────── */}
        <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
          <div>
            {/* หมวดหมู่สินค้า */}
            <div className="mb-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200/80 truncate">
                {product.category_name || 'ทั่วไป'}
              </span>
            </div>

            {/* ชื่อสินค้า */}
            <h3
              className="text-xs font-semibold text-[#2B2F38] line-clamp-2 leading-snug group-hover:text-[#EB6E3E] transition-colors"
              title={product.product_name}
            >
              {product.product_name}
            </h3>

            {/* ชื่อร้านค้า (พร้อมไอคอน FaShop หรือ FaShopLock) */}
            {product.store_name && (
              <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1 truncate">
                {product.store_access === 'private' ? (
                  <FaShopLock className="w-3 h-3 text-stone-400 shrink-0" />
                ) : (
                  <FaShop className="w-3 h-3 text-stone-400 shrink-0" />
                )}
                <span className="truncate">{product.store_name}</span>
              </p>
            )}
          </div>

          {/* ราคา & คงเหลือ */}
          <div className="flex items-baseline justify-between gap-1 pt-1.5 mt-1.5 border-t border-stone-100">
            <div className="flex items-baseline gap-0.5">
              <span className="text-sm sm:text-base font-black text-[#2B2F38]">
                ฿{formatPrice(product.product_price)}
              </span>
              <span className="text-[10px] text-stone-400">/{product.unit_name || 'ชิ้น'}</span>
            </div>

            <div className="text-[10px] text-stone-500">
              คงเหลือ{' '}
              <span className={`font-bold ${isAvailable ? 'text-[#2B2F38]' : 'text-stone-400'}`}>
                {stock}
              </span>{' '}
              <span className="text-stone-400">{product.unit_name || 'ชิ้น'}</span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. แถบปุ่มควบคุม: Stepper + ปุ่มพรีออเดอร์ (🔖) + ปุ่มใส่ตะกร้า (🛒)
              ───────────────────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between gap-1.5">
              {/* ตัวปรับจำนวน QuantityStepper */}
              <QuantityStepper
                value={quantity}
                step={batchSize}
                min={batchSize}
                max={isAvailable ? stock : 999999}
                loading={isAdding}
                disabled={!isAvailable || isAdding}
                onChange={(val) => setQuantity(val)}
              />

              <div className="flex items-center gap-1 shrink-0">
                {/* ปุ่มสั่งจองล่วงหน้า (Pre-order 🔖) */}
                <button
                  type="button"
                  onClick={() => setPreorderOpen(true)}
                  disabled={isAdding}
                  className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 hover:border-[#EB6E3E] hover:text-[#EB6E3E] text-[#2B2F38] flex items-center justify-center transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="สั่งจองสินค้าล่วงหน้า (Pre-order)"
                >
                  <RiBookmarkLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* ปุ่มใส่ตะกร้าปกติ (🛒) */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg flex items-center justify-center transition-all shadow-2xs active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isAvailable
                      ? 'bg-[#2B2F38] hover:bg-[#1E2229] text-white cursor-pointer'
                      : 'bg-stone-200 text-stone-400 cursor-pointer'
                  }`}
                  title={
                    isAdding
                      ? 'กำลังเพิ่มลงตะกร้า...'
                      : isAvailable
                      ? 'เพิ่มลงตะกร้า'
                      : 'สินค้าหมด (กดสั่งจองล่วงหน้า)'
                  }
                >
                  {isAdding ? (
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
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. หน้าต่าง Popup สั่งจองล่วงหน้า (PreorderModal)
          ───────────────────────────────────────────────────────────── */}
      <PreorderModal
        isOpen={preorderOpen}
        onClose={() => setPreorderOpen(false)}
        product={product}
        onConfirm={handleConfirmPreorder}
      />
    </>
  );
}

/**
 * Component: ProductGridSkeleton (โครงร่างจำลองตอนโหลดสินค้า)
 * @param {number} count - จำนวนการ์ด Skeleton ที่จะแสดงระหว่างรอโหลดข้อมูล
 */
export function ProductGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-stone-200 overflow-hidden p-3 animate-pulse space-y-2">
          <div className="w-full h-28 bg-stone-100 rounded-lg" />
          <div className="h-3 bg-stone-200 rounded w-3/4" />
          <div className="h-3 bg-stone-100 rounded w-1/2" />
          <div className="h-4 bg-stone-200 rounded w-1/3 pt-2" />
        </div>
      ))}
    </div>
  );
}