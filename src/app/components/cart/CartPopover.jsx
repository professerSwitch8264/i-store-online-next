// src/app/components/cart/CartPopover.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/app/stores/useCartStore';     // 👈 @/app/stores
import { formatPrice, getThumbnailUrl } from '@/app/lib/utils'; // 👈 @/app/lib
import { RiBookmarkLine, RiImageLine } from 'react-icons/ri';

/**
 * Component: CartPopover (ปุ่มไอคอนพร้อมหน้าต่าง Popover แสดงตะกร้าสินค้าหรือรายการสั่งจองล่วงหน้า)
 * หน้าที่: แสดงปุ่มไอคอนพร้อม Badge จำนวนรายการ, เมื่อกดจะเปิด Dropdown แสดงรายการสินค้าและยอดเงินรวม
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

  // items: รายการสินค้าทั้งหมดในตะกร้าของผู้ใช้ (ดึงมาจาก Zustand useCartStore)
  const items = useCartStore((state) => state.items);

  // isPreorder: ตรวจสอบว่าเป็นโหมดพรีออเดอร์หรือไม่ (true = สั่งล่วงหน้า, false = ตะกร้าปกติ)
  const isPreorder = mode === 'preorder';

  // label / title: ข้อความหัวเรื่องที่แสดงบน UI และ Tooltip
  const label = isPreorder ? 'สั่งล่วงหน้า' : 'ตะกร้าสินค้า';
  const title = isPreorder ? 'สั่งล่วงหน้า' : 'ตะกร้าสินค้า';

  // emptyText: ข้อความแจ้งเตือนเมื่อยังไม่มีรายการใดๆ ในตะกร้าหรือรายการพรีออเดอร์
  const emptyText = isPreorder ? 'ไม่มีรายการสั่งล่วงหน้า' : 'ไม่มีสินค้าในตะกร้า';

  // checkoutText: ข้อความบนปุ่มยืนยันด้านล่าง
  const checkoutText = isPreorder ? 'ยืนยันการสั่งล่วงหน้า' : 'ยืนยันการสั่งซื้อสินค้า';

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

  // useEffect สำหรับตรวจจับการคลิกนอกพื้นที่ (Click Outside Listener)
  useEffect(() => {
    // ฟังก์ชันตรวจสอบตำแหน่งที่คลิก
    function handleClickOutside(event) {
      // ถ้ามี containerRef และตำแหน่งที่คลิกไม่ได้อยู่ข้างใน ให้ปิดหน้าต่าง Popover
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    // ลงทะเบียนดักจับการคลิกเมาส์ทั่วทั้งหน้าเว็บเมื่อหน้าต่างเปิดอยู่
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // คืนค่าฟังก์ชัน Cleanup ถอด Event Listener ออกเมื่อหน้าต่างปิดหรือ Component ถูกทำลาย
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* 1. ปุ่มไอคอนกดเปิด-ปิด (พร้อม Badge สีส้ม) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center p-2 group cursor-pointer relative transition-transform hover:scale-105 active:scale-95"
        title={label}
      >
        <div className="relative flex items-center justify-center">
          {isPreorder ? (
            // ไอคอนพรีออเดอร์ (RiBookmarkLine)
            <RiBookmarkLine className="w-7 h-7 sm:w-8 sm:h-8 text-stone-800 group-hover:text-black transition-colors" />
          ) : (
            // ไอคอนตะกร้าสินค้า (Cart SVG)
            <svg
              className="w-7 h-7 sm:w-8 sm:h-8 text-stone-800 group-hover:text-black transition-colors"
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
            <span className="absolute -top-1.5 -right-2 bg-[#EB6E3E] text-white text-[10px] sm:text-[11px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-2xs animate-scale leading-none select-none">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </div>
      </button>

      {/* 2. หน้าต่าง Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full pt-2 z-50 w-[360px] sm:w-[400px] animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-200 p-4 text-[#2B2F38]">
            {/* หัวข้อและราคารวม */}
            <div className="flex items-baseline justify-between pb-2.5 border-b border-stone-100">
              <h3 className="font-bold text-base text-[#2B2F38]">{title}</h3>
              <span className="text-xs sm:text-sm font-medium text-stone-500">
                จำนวนเงิน :{' '}
                <strong className="font-black text-[#2B2F38]">
                  ฿{formatPrice(totalPrice)}
                </strong>
              </span>
            </div>

            {/* รายการสินค้าในตะกร้า */}
            <div className="py-2 max-h-60 overflow-y-auto space-y-3 pr-1">
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

                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      {/* รูปภาพสินค้า */}
                      <div className="w-11 h-11 rounded-md bg-white border border-stone-200 p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                        {thumb ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={thumb}
                            alt={item.product?.product_name || 'product'}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <RiImageLine className="w-5 h-5 text-stone-300" />
                        )}
                      </div>

                      {/* ชื่อสินค้าและราคา */}
                      <div className="flex-1 min-w-0 pr-1">
                        <p
                          className="text-xs font-semibold text-black leading-snug truncate"
                          title={item.product?.product_name}
                        >
                          {item.product?.product_name || 'สินค้า'}
                        </p>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                          ฿{formatPrice(itemTotal)}
                        </p>
                      </div>

                      {/* จำนวนชิ้น */}
                      <div className="text-xs font-bold text-stone-700 shrink-0">
                        x{item.quantity} {item.product?.unit_name || 'ชิ้น'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ปุ่มยืนยันด้านล่าง */}
            <div className="pt-3 border-t border-stone-100">
              <button
                type="button"
                disabled={filteredItems.length === 0}
                onClick={() => {
                  setIsOpen(false);
                  const targetUrl = isPreorder ? '/cart-checkout?reserve_flag=Y' : '/cart-checkout';
                  router.push(targetUrl);
                }}
                className="w-full bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-md shadow-xs transition-all text-xs sm:text-sm cursor-pointer flex items-center justify-center"
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