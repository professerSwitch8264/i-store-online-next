// src/app/components/cart/CartPopover.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/app/stores/useCartStore';     // 👈 @/app/stores
import { useToastStore } from '@/app/stores/useToastStore';   // 👈 @/app/stores
import { QuantityStepper } from '@/app/components/ui/QuantityStepper'; // 👈 @/app/components
import { formatPrice, getThumbnailUrl } from '@/app/lib/utils'; // 👈 @/app/lib
import { RiBookmarkLine, RiImageLine, RiDeleteBin6Line } from 'react-icons/ri';

/**
 * Component: CartItemThumbnail (แสดงภาพขนาดย่อ หรือสลับไปแสดงไอคอน RiImageLine เมื่อรูปเสียหรือไม่มีรูป)
 */
function CartItemThumbnail({ src, alt }) {
  const [hasError, setHasError] = useState(false);

  // หากไม่มี URL รูปภาพ หรือเบราว์เซอร์โหลดรูปไม่ขึ้น (onError) ให้สลับเป็นไอคอนสำรองทันที
  if (!src || hasError) {
    return <RiImageLine className="w-5 h-5 text-stone-300" />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt || 'product'}
      className="w-full h-full object-contain"
      onError={() => setHasError(true)}
    />
  );
}

/**
 * Component: CartPopover (ปุ่มไอคอนพร้อมหน้าต่าง Popover แสดงตะกร้าสินค้าหรือรายการสั่งจองล่วงหน้า)
 * หน้าที่:
 * 1. แสดงปุ่มไอคอนพร้อม Badge จำนวนรายการ, เมื่อกดจะเปิด Dropdown แสดงรายการสินค้าและยอดเงินรวม
 * 2. มีปุ่ม QuantityStepper ให้กดเพิ่ม-ลดจำนวน หรือพิมพ์ตัวเลขได้ทันที พร้อม Debounce 500ms
 *
 * @param {string} mode - โหมดการแสดงผล: 'cart' (ตะกร้าปกติ) หรือ 'preorder' (สั่งจองล่วงหน้า)
 */
export function CartPopover({ mode = 'cart' }) {
  // router: อ็อบเจกต์นำทางของ Next.js สำหรับเปลี่ยนหน้า
  const router = useRouter();

  // isOpen: ควบคุมสถานะเปิด (true) หรือปิด (false) หน้าต่าง Popover Dropdown
  const [isOpen, setIsOpen] = useState(false);

  // containerRef: ใช้อ้างอิง DOM ของตัวครอบ เพื่อตรวจจับว่าผู้ใช้คลิกนอกกล่องหรือไม่ (Click Outside)
  const containerRef = useRef(null);

  // ดึง State และ Action จาก useCartStore
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const setLocalQuantity = useCartStore((state) => state.setLocalQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  // showSuccess, showError, showConfirm: ฟังก์ชันแจ้งเตือนและเปิด Modal ยืนยันจาก useToastStore
  const { showSuccess, showError, showConfirm } = useToastStore();

  // updatingItemIds: อ็อบเจกต์เก็บสถานะการอัปเดตหรือลบของแต่ละรายการ { [cartId]: boolean } เพื่อแสดง Spinner และล็อคปุ่มขณะยิง API
  const [updatingItemIds, setUpdatingItemIds] = useState({});

  // debounceTimers: useRef เก็บตัวจับเวลา Debounce ของแต่ละสินค้า { [itemId]: timerId }
  const debounceTimers = useRef({});

  // เคลียร์ Timer ทั้งหมดทิ้งอัตโนมัติเมื่อ Component ถูกทำลาย (Cleanup ป้องกัน Memory Leak)
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // isPreorder: ตรวจสอบว่าเป็นโหมดพรีออเดอร์หรือไม่ (true = สั่งล่วงหน้า, false = ตะกร้าปกติ)
  const isPreorder = mode === 'preorder';

  // label / title: ข้อความหัวเรื่องที่แสดงบน UI และ Tooltip
  const label = isPreorder ? 'ตะกร้าสั่งล่วงหน้า' : 'ตะกร้าสั่งสินค้า';
  const title = isPreorder ? 'ตะกร้าสั่งล่วงหน้า' : 'ตะกร้าสั่งสินค้า';

  // emptyText: ข้อความแจ้งเตือนเมื่อยังไม่มีรายการใดๆ ในตะกร้าหรือรายการพรีออเดอร์
  const emptyText = isPreorder ? 'ไม่มีรายการสั่งล่วงหน้า' : 'ไม่มีสินค้าในตะกร้า';

  // checkoutText: ข้อความบนปุ่มตรวจสอบตะกร้าด้านล่าง
  const checkoutText = isPreorder ? 'ตรวจสอบตะกร้าสั่งล่วงหน้า' : 'ตรวจสอบตะกร้าสั่งซื้อ';

  // filteredItems: กรองเฉพาะรายการที่ตรงกับโหมดนี้ พร้อมเรียงลำดับตาม ID เพื่อให้ตำแหน่งรายการไม่กระโดด
  const filteredItems = items
    .filter((item) =>
      isPreorder ? item.reserve_flag === 'Y' : item.reserve_flag !== 'Y'
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // totalCount: จำนวนประเภทรายการสินค้าที่อยู่ในโหมดนี้ (ใช้แสดงตัวเลขบน Badge สีส้ม)
  const totalCount = filteredItems.length;

  // totalPrice: ยอดเงินรวมคำนวณสดจาก (ราคาต่อหน่วย x จำนวนชิ้น) ของสินค้าทุกรายการ
  const totalPrice = filteredItems.reduce(
    (sum, item) => sum + (item.product?.product_price || 0) * item.quantity,
    0
  );

  // handleLimitReached: แจ้งเตือนเมื่อแตะเพดานสต็อกหรือ Order Limit
  const handleLimitReached = (item, type) => {
    if (type === 'max') {
      if (isPreorder) return; // สั่งจองล่วงหน้าได้ไม่จำกัดจำนวน
      const p = item.product || {};
      const hasLimit = typeof p.order_limit === 'number' && p.order_limit > 0;
      const realStock = typeof p.stock_quantity === 'number' ? p.stock_quantity : 0;

      if (hasLimit && item.quantity >= p.order_limit) {
        showError(`สินค้าจำกัดการซื้อไม่เกิน ${p.order_limit} ${p.unit_name || 'ชิ้น'} ต่อครั้ง`);
      } else if (item.quantity >= realStock) {
        showError('สินค้าคงเหลือในคลังไม่เพียงพอ');
      }
    }
  };

  // stepperResetKeys: บังคับรีเซ็ตตัวเลข Stepper กลับเป็นค่าเดิมเมื่อกดยกเลิก
  const [stepperResetKeys, setStepperResetKeys] = useState({});

  // handleUpdateQuantity (แบบ Debounce 500ms):
  // 1. อัปเดตตัวเลขหน้าจอทันที เพื่อให้พิมพ์หรือกดแล้วไม่สะดุด
  // 2. ยกเลิก Timer เดิมถ้านับยังไม่เสร็จ
  // 3. เมื่อผู้ใช้หยุดกดครบ 500ms ค่อยขึ้นไอคอนหมุนๆ และยิง API บันทึกลงฐานข้อมูลจริง
  const handleUpdateQuantity = (itemId, newQty) => {
    // 🛡️ หากจำนวนลดลงถึง 0 หรือติดลบ ให้หยุด Debounce และเปิด Popup ถามยืนยันการลบผ่าน useToastStore
    if (newQty <= 0) {
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
        delete debounceTimers.current[itemId];
      }
      const targetItem = items.find((i) => i.id === itemId);
      if (targetItem) {
        showConfirm({
          title: 'ยืนยันการลบสินค้า',
          message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายการ "${targetItem.product?.product_name || 'สินค้านี้'}" ออกจากตะกร้า?`,
          confirmText: 'ยืนยันการลบ',
          confirmColor: 'red',
          onConfirm: () => handleRemoveItem(itemId),
          onCancel: () => {
            setStepperResetKeys((prev) => ({
              ...prev,
              [itemId]: (prev[itemId] || 0) + 1,
            }));
          },
        });
      }
      return;
    }

    // ขั้นที่ 1: อัปเดตตัวเลขและราคารวมบนหน้าจอทันที เพื่อให้หน้าจอไม่กระตุกตามมือ
    setLocalQuantity(itemId, newQty);

    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    debounceTimers.current[itemId] = setTimeout(async () => {
      setUpdatingItemIds((prev) => ({ ...prev, [itemId]: true }));
      try {
        await updateQuantity(itemId, newQty);
      } catch (err) {
        showError(err.message || 'เกิดข้อผิดพลาดในการบันทึกจำนวนสินค้า');
      } finally {
        setUpdatingItemIds((prev) => ({ ...prev, [itemId]: false }));
        delete debounceTimers.current[itemId];
      }
    }, 500);
  };

  // handleRemoveItem: ฟังก์ชันลบรายการสินค้าทีละชิ้น
  const handleRemoveItem = async (itemId) => {
    setUpdatingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await removeItem(itemId);
      showSuccess('ลบรายการออกจากตะกร้าเรียบร้อยแล้ว');
    } catch (err) {
      showError(err.message || 'เกิดข้อผิดพลาดในการลบรายการ');
    } finally {
      setUpdatingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // useEffect สำหรับตรวจจับการคลิกนอกพื้นที่ (Click Outside Listener) หรือกด Escape เพื่อปิดหน้าต่าง
  useEffect(() => {
    function handleClickOutside(event) {
      // 🛡️ หากมี Modal/Popup แจ้งเตือนเปิดอยู่ หรือคลิกภายในตัว Modal ให้เพิกเฉย ไม่ต้องปิดตะกร้า
      if (useToastStore.getState().confirmVisible || useToastStore.getState().errorVisible) {
        return;
      }
      if (event.target?.closest && event.target.closest('[data-modal]')) {
        return;
      }

      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (useToastStore.getState().confirmVisible || useToastStore.getState().errorVisible) {
          return;
        }
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* 1. ปุ่มไอคอนกดเปิด-ปิด (พร้อม Badge สีส้ม) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center p-1 sm:p-2 group cursor-pointer relative transition-transform hover:scale-105 active:scale-95"
        title={label}
      >
        <div className="relative flex items-center justify-center">
          {isPreorder ? (
            // ไอคอนพรีออเดอร์ (RiBookmarkLine)
            <RiBookmarkLine className="w-6.5 h-6.5 sm:w-8 sm:h-8 text-stone-800 group-hover:text-black transition-colors" />
          ) : (
            // ไอคอนตะกร้าสินค้า (Cart SVG)
            <svg
              className="w-6.5 h-6.5 sm:w-8 sm:h-8 text-stone-800 group-hover:text-black transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          )}

          {/* ป้ายแสดงจำนวนชิ้น Badge สีส้ม Terracotta #EB6E3E */}
          {totalCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#EB6E3E] text-white text-[10px] sm:text-[11px] font-bold min-w-[17px] h-[17px] sm:min-w-[18px] sm:h-[18px] px-1 rounded-full flex items-center justify-center shadow-2xs animate-scale leading-none select-none">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </div>
      </button>

      {/* 2. หน้าต่าง Popover Dropdown ใต้ปุ่มไอคอน (ไม่ใช้ Modal กลางจอ) พร้อมสามเหลี่ยมชี้ระบุตะกร้า */}
      {isOpen && (
        <div
          className={`absolute top-full pt-1.5 z-50 animate-fadeIn ${
            isPreorder ? 'right-[-42px] sm:right-0' : 'right-0'
          } w-[calc(100vw-20px)] max-w-[380px] sm:w-[420px]`}
        >
          {/* การ์ดสีขาว ขอบมนน้อยที่สุด เงา shadow-2xl */}
          <div className="relative bg-white rounded-xs shadow-2xl border border-stone-200 p-4 text-[#2B2F38]">
            {/* สามเหลี่ยมชี้ขึ้น (Arrow Pointer) ชี้ไปยังปุ่มไอคอนด้านบน */}
            <div
              className={`absolute -top-1.5 w-3.5 h-3.5 bg-white border-t border-l border-stone-200 rotate-45 z-20 ${
                isPreorder ? 'right-[52px] sm:right-4' : 'right-2.5 sm:right-4'
              }`}
            />

            {/* หัวข้อและราคารวม */}
            <div className="flex items-baseline justify-between pb-2.5 border-b border-stone-100">
              <h3 className="font-bold text-base text-[#2B2F38]">{title}</h3>
              <span className="text-xs sm:text-sm font-medium text-stone-500">
                จำนวนเงิน (บาท) :{' '}
                <strong className="font-black text-[#2B2F38]">
                  ฿{formatPrice(totalPrice)}
                </strong>
              </span>
            </div>

            {/* รายการสินค้าในตะกร้า */}
            <div className="py-2 max-h-60 sm:max-h-72 overflow-y-auto space-y-3 pr-1">
              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400 font-medium">
                  {emptyText}
                </div>
              ) : (
                filteredItems.map((item) => {
                  // thumb: แปลง path รูปภาพขนาดย่อให้เป็น URL เต็มสำหรับแสดงผล
                  const thumb = getThumbnailUrl(item.product?.product_thumbnail);

                  // price: ราคาต่อหน่วยของสินค้านั้นๆ (ถ้าไม่มีให้เป็น 0)
                  const price = item.product?.product_price ?? 0;

                  // itemTotal: ราคารวมเฉพาะรายการนี้ (ราคา x จำนวน)
                  const itemTotal = price * item.quantity;

                  // p: ข้อมูลสินค้า
                  const p = item.product || {};

                  // batchSize: ขนาดแพ็ค / สเต็ปการเพิ่มลด
                  const batchSize = p.batch_size && p.batch_size > 0 ? p.batch_size : 1;

                  // คำนวณขีดจำกัดสต็อกและโควตาการสั่งซื้อ
                  const realStock = typeof p.stock_quantity === 'number' ? p.stock_quantity : 0;
                  const hasOrderLimit = typeof p.order_limit === 'number' && p.order_limit > 0;
                  const orderLimit = hasOrderLimit ? p.order_limit : 999999;

                  let maxLimit = 999999;
                  if (!isPreorder) {
                    const rawMaxLimit = hasOrderLimit ? Math.min(realStock, orderLimit) : realStock;
                    const maxMultiple = Math.floor(rawMaxLimit / batchSize) * batchSize;
                    maxLimit = maxMultiple >= batchSize ? maxMultiple : rawMaxLimit;
                  }

                  const isUpdating = Boolean(updatingItemIds[item.id]);

                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2.5 py-1">
                      {/* รูปภาพสินค้า (สลับเป็นไอคอนอัตโนมัติหากรูปเสีย) */}
                      <div className="w-10 h-10 rounded-md bg-white border border-stone-200 p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                        <CartItemThumbnail src={thumb} alt={p.product_name} />
                      </div>

                      {/* ชื่อสินค้าและราคา */}
                      <div className="flex-1 min-w-0 pr-1">
                        <p
                          className="text-xs font-semibold text-black leading-snug truncate"
                          title={p.product_name}
                        >
                          {p.product_name || 'สินค้า'}
                        </p>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                          ฿{formatPrice(itemTotal)}
                        </p>
                      </div>

                      {/* ปุ่ม Stepper เพิ่ม-ลดจำนวน และ ปุ่มถังขยะลบรายการ */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <QuantityStepper
                          key={`${item.id}-${stepperResetKeys[item.id] || 0}`}
                          value={item.quantity}
                          step={batchSize}
                          min={0}
                          max={maxLimit}
                          loading={isUpdating}
                          disabled={isUpdating}
                          onLimitReached={(type) => handleLimitReached(item, type)}
                          onChange={(newVal) => handleUpdateQuantity(item.id, newVal)}
                        />

                        {/* ปุ่มถังขยะลบรายการ พร้อม Spinner หมุนๆ สีเดียวกัน (#2B2F38) */}
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => {
                            showConfirm({
                              title: 'ยืนยันการลบสินค้า',
                              message: `คุณแน่ใจหรือไม่ว่าต้องการลบรายการ "${p.product_name || 'สินค้านี้'}" ออกจากตะกร้า?`,
                              confirmText: 'ยืนยันการลบ',
                              confirmColor: 'red',
                              onConfirm: () => handleRemoveItem(item.id),
                            });
                          }}
                          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isUpdating ? 'กำลังลบรายการ...' : 'ลบรายการนี้'}
                        >
                          {isUpdating ? (
                            <svg className="w-3.5 h-3.5 animate-spin text-[#2B2F38]" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            <RiDeleteBin6Line className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ปุ่มตรวจสอบตะกร้าด้านล่าง */}
            <div className="pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  const targetUrl = isPreorder ? '/cart-checkout?reserve_flag=Y' : '/cart-checkout';
                  router.push(targetUrl);
                }}
                className="w-full bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black text-white font-medium py-2.5 px-4 rounded-md shadow-xs transition-all active:scale-[0.99] text-xs sm:text-sm cursor-pointer flex items-center justify-center"
              >
                <span>{checkoutText}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}