// src/app/components/product/ProductCard.jsx
'use client';

import { useState, useEffect } from 'react';
import { getThumbnailUrl, formatPrice } from '@/app/lib/utils';      
import { useCartStore } from '@/app/stores/useCartStore';             
import { useToastStore } from '@/app/stores/useToastStore';
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

  // showSuccess, showError: ฟังก์ชันแสดง Toast สำเร็จ และ Alert Modal จาก useToastStore
  const { showSuccess, showError } = useToastStore();

  // batchSize: ขนาดชุดการสั่งซื้อขั้นต่ำ (เช่น 1 ชิ้น, 6 ชิ้น/แพ็ค, 12 ชิ้น/กล่อง)
  const batchSize = product.batch_size && product.batch_size > 0 ? product.batch_size : 1;

  // quantity: State เก็บจำนวนชิ้นที่ผู้ใช้กำลังเลือกบนการ์ดใบนี้ (เริ่มต้นเท่ากับ batchSize)
  const [quantity, setQuantity] = useState(batchSize);

  // ซิงค์ค่าตัวเลขเริ่มต้นให้ตรงกับ batchSize ทันทีเมื่อข้อมูลสินค้าถูกโหลดเข้ามา
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantity(batchSize);
  }, [batchSize]);

  // imageUrl: ดึง URL รูปภาพเต็มของสินค้าจากเซิร์ฟเวอร์
  const imageUrl = getThumbnailUrl(product.product_thumbnail);

  // จำนวนสต็อกคงเหลือจริงในคลังสินค้า (ดึงมาจาก v_inventory)
  const stock = product.stock_quantity ?? 0;

  // เอาไว้เช็คว่ากดเพิ่มสินค้าได้ไหม
  const isAvailable = stock >= batchSize;

  // คำนวณเพดานสูงสุดในการสั่งซื้อ (อิงตาม Order Limit และตัดเศษให้ลงตัวกับ Batch Size)
  const hasOrderLimit = typeof product.order_limit === 'number' && product.order_limit > 0;
  const orderLimit = hasOrderLimit ? product.order_limit : 999999;
  const rawMaxLimit = hasOrderLimit ? Math.min(stock, orderLimit) : stock;
  const maxMultiple = Math.floor(rawMaxLimit / batchSize) * batchSize;
  const maxLimit = maxMultiple >= batchSize ? maxMultiple : rawMaxLimit;

  // items: รายการสินค้าทั้งหมดในตะกร้าของผู้ใช้ ดึงมาจาก Zustand useCartStore
  const items = useCartStore((state) => state.items);

  // inCartNormal: ค้นหารายการสินค้านี้ที่มีอยู่ในตะกร้าปกติ (reserve_flag !== 'Y') แล้ว
  const inCartNormal = items.find(
    (item) =>
      item.product_id?.toLowerCase() === product.product_id?.toLowerCase() &&
      item.reserve_flag !== 'Y'
  );

  // currentInCart: จำนวนสินค้านี้ที่อยู่ในตะกร้าแล้ว
  const currentInCart = inCartNormal?.quantity ?? 0;

  // handleLimitReached: แจ้งเตือนเมื่อผู้ใช้กดเพิ่มจนชนเพดานสต็อกหรือ Order Limit (เช็คเฉพาะจำนวนปัจจุบันบนการ์ด ไม่บวกตะกร้า ตามแบบฉบับ Easy Store)
  const handleLimitReached = (type) => {
    if (type === 'max') {
      if (isAvailable) {
        if (hasOrderLimit && quantity >= orderLimit) {
          showError(`สินค้าจำกัดการซื้อไม่เกิน ${product.order_limit} ${product.unit_name || 'ชิ้น'} ต่อรายการ`);
        } else if (quantity >= stock) {
          showError(`สินค้าคงเหลือในคลังไม่เพียงพอ (คงเหลือ ${stock} ${product.unit_name || 'ชิ้น'})`);
        }
      }
    }
  };

  // 🛒 ฟังก์ชันเมื่อกดปุ่ม "ใส่ตะกร้าปกติ"
  const handleAddToCart = async () => {
    if (!isAvailable || isAdding) {
      if (!isAvailable) {
        // ถ้าสินค้าหมดสต็อก ให้เปิดหน้าต่าง Pre-order สั่งจองล่วงหน้าแทนอัตโนมัติ
        setPreorderOpen(true);
      }
      return;
    }

    // ตรวจสอบว่าในตะกร้ามีสินค้านี้ครบเพดานสูงสุด หรือยอดที่จะเพิ่มใหม่เกินขีดจำกัดหรือไม่
    // ตาม Easy Store: แสดง Toast "สินค้าในตะกร้ามีครบจำนวนจำกัดสูงสุดแล้ว" และ return ทันที ไม่ยิง API ไป Server
    if (currentInCart >= maxLimit || currentInCart + quantity > maxLimit) {
      showError(`สินค้าจำกัดการซื้อไม่เกิน ${product.order_limit} ${product.unit_name || 'ชิ้น'} ต่อรายการ`);
      return;
    }

    setIsAdding(true);
    try {
      // ส่งคำสั่งเพิ่มสินค้าลงตะกร้าแบบปกติ (reserve_flag = 'N')
      await addItem(product.product_id, quantity, 'N');
      // แสดง Toast แจ้งเตือนความสำเร็จสีดำทึบ Minimalist กลางจอ 1.5 วินาที
      showSuccess('คุณได้ทำการเพิ่มสินค้าลงในรถเข็นแล้ว');
    } catch (err) {
      showError(err.message || 'ไม่สามารถเพิ่มสินค้าลงในตะกร้าได้');
    } finally {
      setIsAdding(false);
    }
  };

  // 🔖 ฟังก์ชันเมื่อกดยืนยันจากหน้าต่าง PreorderModal
  const handleConfirmPreorder = async (customQty) => {
    try {
      // ส่งคำสั่งสั่งจองล่วงหน้า (reserve_flag = 'Y')
      await addItem(product.product_id, customQty, 'Y');
      // แสดง Toast แจ้งเตือนความสำเร็จสีดำทึบ Minimalist กลางจอ 1.5 วินาที
      showSuccess('เพิ่มรายการสั่งล่วงหน้าในตะกร้าเรียบร้อยแล้ว');
    } catch (err) {
      showError(err.message || 'เกิดข้อผิดพลาดในการสั่งล่วงหน้า');
      throw err;
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md hover:border-[#EB6E3E]/70 transition-all duration-200 flex flex-col justify-between group">
        {/* ─────────────────────────────────────────────────────────────
            1. พื้นที่รูปภาพสินค้า
            ───────────────────────────────────────────────────────────── */}
        <div className="relative w-full h-22 sm:h-24 bg-white flex items-center justify-center overflow-hidden border-b border-stone-100">
          {/* แสตมป์ Sold Out (แสดงเมื่อสต็อกไม่พอสั่งซื้อขั้นต่ำ) */}
          {!isAvailable && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-2 bg-white/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/soldout.png"
                alt="Sold Out"
                className="w-16 h-auto object-contain select-none opacity-90 drop-shadow-md"
              />
            </div>
          )}

          {imageUrl && !imgError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={product.product_name}
              className={`w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300 ${
                !isAvailable ? 'opacity-40 grayscale' : ''
              }`}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="text-stone-300 flex flex-col items-center justify-center w-full h-full">
              <RiImageLine className="w-7 h-7 text-stone-300" />
              <span className="text-[9px] mt-0.5 text-stone-400 font-medium">ไม่มีรูปภาพ</span>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. ข้อมูลรายละเอียดสินค้า (ชื่อ, หมวดหมู่, ร้านค้า, ราคา)
            ───────────────────────────────────────────────────────────── */}
        <div className="p-1.5 sm:p-2 flex-1 flex flex-col justify-between">
          <div>
            {/* หมวดหมู่สินค้า */}
            <div className="mb-0.5">
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200/80 truncate">
                {product.category_name || 'ทั่วไป'}
              </span>
            </div>

            {/* ชื่อสินค้า */}
            <h3
              className="text-xs font-semibold text-[#2B2F38] line-clamp-2 leading-tight group-hover:text-[#EB6E3E] transition-colors"
              title={product.product_name}
            >
              {product.product_name}
            </h3>

            {/* ชื่อร้านค้า */}
            {product.store_name && (
              <p className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1 truncate">
                {product.store_access === 'private' ? (
                  <FaShopLock className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                ) : (
                  <FaShop className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                )}
                <span className="truncate">{product.store_name}</span>
              </p>
            )}
          </div>

          {/* ราคา & คงเหลือ */}
          <div className="flex items-baseline justify-between gap-1 pt-1 mt-1 border-t border-stone-100">
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs sm:text-sm font-black text-[#2B2F38]">
                ฿{formatPrice(product.product_price)}
              </span>
              <span className="text-[9px] text-stone-400">/{product.unit_name || 'ชิ้น'}</span>
            </div>

            <div className="text-[9px] text-stone-500">
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
          <div className="pt-1.5 border-t border-stone-100">
            <div className="flex items-center justify-between gap-1">
              {/* ตัวปรับจำนวน QuantityStepper (เปิดใช้งานตลอดที่สินค้ามีสต็อก ไม่ disable ตามของในตะกร้า ตามแบบฉบับ Easy Store) */}
              <QuantityStepper
                value={quantity}
                step={batchSize}
                min={batchSize}
                max={isAvailable ? maxLimit : 9999}
                loading={isAdding}
                disabled={!isAvailable}
                onLimitReached={handleLimitReached}
                onChange={(val) => setQuantity(val)}
              />

              <div className="flex items-center gap-1 shrink-0">
                {/* ปุ่มสั่งจองล่วงหน้า (Pre-order 🔖) */}
                <button
                  type="button"
                  onClick={() => setPreorderOpen(true)}
                  disabled={isAdding}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg border border-stone-300 bg-white hover:bg-stone-50 hover:border-[#EB6E3E] hover:text-[#EB6E3E] text-[#2B2F38] flex items-center justify-center transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="สั่งจองสินค้าล่วงหน้า (Pre-order)"
                >
                  <RiBookmarkLine className="w-3.5 h-3.5" />
                </button>

                {/* ปุ่มใส่ตะกร้าปกติ (🛒) - ไม่ disable ตามตะกร้า แต่จะแจ้งเตือน Toast เมื่อกด ตามแบบฉบับ Easy Store */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!isAvailable || isAdding}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center transition-all shadow-2xs active:scale-95 shrink-0 ${
                    isAvailable && !isAdding
                      ? 'bg-[#2B2F38] hover:bg-[#1E2229] hover:ring-2 hover:ring-[#EB6E3E]/40 text-white cursor-pointer'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                  title={
                    isAvailable
                      ? 'เพิ่มลงตะกร้า'
                      : stock > 0
                      ? `สินค้าคงเหลือไม่พอต่อขั้นต่ำ (${batchSize} ${product.unit_name || 'ชิ้น'}) สามารถสั่งจองล่วงหน้าได้`
                      : 'สินค้าหมด (กดสั่งจองล่วงหน้าได้)'
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
 * Component: ProductGridSkeleton (โครงร่างจำลองตอนโหลดสินค้า - ขนาดและสัดส่วนตรงกับ ProductCard 100%)
 * @param {number} count - จำนวนการ์ด Skeleton ที่จะแสดงระหว่างรอโหลดข้อมูล
 */
export function ProductGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs flex flex-col justify-between animate-pulse select-none"
        >
          {/* 1. พื้นที่รูปภาพสินค้า Skeleton (ความสูง h-22 sm:h-24 เท่ากับ ProductCard จริง) */}
          <div className="w-full h-22 sm:h-24 bg-stone-100/80 border-b border-stone-100 flex items-center justify-center">
            <RiImageLine className="w-7 h-7 text-stone-200" />
          </div>

          {/* 2. ข้อมูลรายละเอียดสินค้า Skeleton (padding และ layout เท่ากับการ์ดจริง) */}
          <div className="p-1.5 sm:p-2 flex-1 flex flex-col justify-between">
            <div>
              {/* หมวดหมู่สินค้า Skeleton badge */}
              <div className="mb-0.5">
                <div className="h-3.5 w-14 bg-stone-100 rounded" />
              </div>

              {/* ชื่อสินค้า 2 บรรทัด Skeleton */}
              <div className="space-y-1 mb-1">
                <div className="h-3 bg-stone-200 rounded w-5/6" />
                <div className="h-3 bg-stone-100 rounded w-3/5" />
              </div>

              {/* ชื่อร้านค้า Skeleton */}
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-2.5 h-2.5 rounded bg-stone-200/70 shrink-0" />
                <div className="h-2 bg-stone-100 rounded w-12" />
              </div>
            </div>

            {/* ราคา & คงเหลือ Skeleton */}
            <div className="flex items-baseline justify-between gap-1 pt-1 mt-1 border-t border-stone-100">
              <div className="h-3.5 bg-stone-200 rounded w-12" />
              <div className="h-2.5 bg-stone-100 rounded w-10" />
            </div>

            {/* 3. แถบปุ่มควบคุม Stepper + ปุ่มพรีออเดอร์ + ปุ่มใส่ตะกร้า Skeleton */}
            <div className="pt-1.5 border-t border-stone-100">
              <div className="flex items-center justify-between gap-1">
                {/* Stepper Skeleton */}
                <div className="h-6 sm:h-7 w-14 sm:w-18 bg-stone-100 rounded-md sm:rounded-lg border border-stone-200/60" />

                {/* ปุ่มพรีออเดอร์ + ปุ่มใส่ตะกร้า Skeleton */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-stone-100 border border-stone-200/60" />
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-stone-200/80" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}