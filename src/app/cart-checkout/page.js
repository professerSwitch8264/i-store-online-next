// src/app/cart-checkout/page.js
'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useCartStore } from '@/app/stores/useCartStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { QuantityStepper } from '@/app/components/ui/QuantityStepper';
import { shippingLocationService } from '@/app/services/shippingLocationService';
import { useOrderStore } from '@/app/stores/useOrderStore';
import { getThumbnailUrl, formatPrice } from '@/lib/utils';
import { RiDeleteBin6Line, RiShoppingCart2Line, RiBookmarkLine, RiImageLine, RiAlertLine } from 'react-icons/ri';
import { FaShop, FaShopLock } from 'react-icons/fa6';

/**
 * Component: CheckoutItemThumbnail (แสดงภาพขนาดย่อ หรือสลับเป็นไอคอน RiImageLine เมื่อรูปเสียหรือไม่มีรูป)
 */
function CheckoutItemThumbnail({ src, alt }) {
  const [hasError, setHasError] = useState(false);

  // หากไม่มี URL รูปภาพ หรือเบราว์เซอร์โหลดรูปไม่ขึ้น (onError) ให้สลับเป็นไอคอนสำรองทันที
  if (!src || hasError) {
    return <RiImageLine className="w-6 h-6 text-stone-300" />;
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
 * =========================================================================
 * Component: CartCheckoutContent (เนื้อหาหลักของหน้าตรวจสอบและยืนยันการสั่งซื้อ)
 * =========================================================================
 * หน้าที่ & สถาปัตยกรรมการทำงาน:
 * 1. ตรวจสอบโหมดผ่าน URL Query String (?reserve_flag=Y คือโหมดพรีออเดอร์, อื่นๆ คือโหมดปกติ)
 * 2. สวิตช์โหมดแคปซูล (Segmented Control) สลับระหว่าง ตะกร้าปกติ และ สั่งล่วงหน้า
 * 3. แสดงข้อมูลผู้สั่งซื้ออัตโนมัติจากระบบ SSO (ชื่อ-นามสกุล, แผนก)
 * 4. ดึงและเลือกสถานที่จัดส่ง (Shipping Location) จากฐานข้อมูล
 * 5. จัดกลุ่มสินค้าแยกตามร้านค้า (Group by Store) แบบตาราง
 * 6. ปรับจำนวนสินค้าสดๆ ผ่าน QuantityStepper (จำกัดตาม Stock จริง และ Order Limit)
 * 7. ลบสินค้าออกจากตะกร้าเป็นรายชิ้น (Single Delete) หรือล้างทั้งหมด (Clear All)
 * 8. แถบสรุปยอดและยืนยันคำสั่งซื้อแบบ Sticky Bar ติดขอบล่างจอ
 * 9. ส่งคำสั่งซื้อแยกตามร้านค้าผ่าน API /api/orders/place (ตัดสต็อก FIFO + บันทึกสายอนุมัติ)
 * =========================================================================
 */
function CartCheckoutContent() {
  // router: ตัวควบคุมการเปลี่ยนหน้าและ URL ใน Next.js
  const router = useRouter();

  // searchParams: ตัวอ่านค่า Query Parameters จาก URL เช่น ?reserve_flag=Y
  const searchParams = useSearchParams();

  // reserveFlagParam: ค่าพารามิเตอร์ประเภทคำสั่งซื้อ ('Y' = สั่งล่วงหน้า, 'N' = เบิกปกติ)
  const reserveFlagParam = searchParams.get('reserve_flag') === 'Y' ? 'Y' : 'N';

  // isPreorder: ตัวแปร Boolean สำหรับตรวจสอบว่าหน้านี้กำลังทำงานในโหมดสั่งจองล่วงหน้าหรือไม่
  const isPreorder = reserveFlagParam === 'Y';

  // userInfo: ข้อมูลผู้ใช้งานที่ล็อกอินเข้ามา (ดึงมาจาก Keycloak SSO AuthContext)
  const { userInfo } = useAuth();

  // items: อาร์เรย์เก็บรายการสินค้าทั้งหมดในตะกร้า
  // fetchCart: ฟังก์ชันดึงข้อมูลตะกร้าล่าสุดจากเซิร์ฟเวอร์
  // updateQuantity: ฟังก์ชันปรับปรุงจำนวนชิ้นของสินค้าในตะกร้า
  // setLocalQuantity: ฟังก์ชันปรับจำนวนเฉพาะใน UI ทันที (ยังไม่ยิง API)
  // removeItem: ฟังก์ชันลบสินค้าชิ้นนั้นออกจากตะกร้า
  const { items, fetchCart, updateQuantity, setLocalQuantity, removeItem } = useCartStore();

  // showSuccess: ฟังก์ชันแสดง Toast แจ้งเตือนเมื่อทำงานสำเร็จ (แสดง 1.5 วินาที)
  // showError: ฟังก์ชันแสดง Modal หน้าต่างแจ้งเตือนเมื่อเกิดข้อผิดพลาด
  // showConfirm: ฟังก์ชันเปิด Modal ถามยืนยันการทำรายการ
  const { showSuccess, showError, showConfirm } = useToastStore();

  // shippingLocations: อาร์เรย์เก็บรายชื่อสถานที่จัดส่งทั้งหมดที่ดึงมาจากฐานข้อมูล (เช่น โรงงาน 1, 2, 3)
  const [shippingLocations, setShippingLocations] = useState([]);

  // selectedLocationId: รหัส UUID ของสถานที่จัดส่งที่ผู้ใช้เลือกใน Dropdown
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // isConfirmChecked: สถานะการติ๊กกล่อง Checkbox ยืนยันความถูกต้องของรายการและสถานที่จัดส่ง (true/false)
  const [isConfirmChecked, setIsConfirmChecked] = useState(false);

  // isSubmitting: สถานะกำลังส่งข้อมูลคำสั่งซื้อไปยังเซิร์ฟเวอร์ (ใช้สำหรับหมุน Loading Spinner ในปุ่ม)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // loadingLocations: สถานะกำลังโหลดรายชื่อสถานที่จัดส่งจาก API (true = กำลังโหลด, false = โหลดเสร็จ)
  const [loadingLocations, setLoadingLocations] = useState(true);

  // updatingItemIds: อ็อบเจกต์เก็บสถานะการอัปเดตหรือลบของแต่ละแถว { [cartId]: boolean } เพื่อแสดง Spinner และล็อคปุ่มขณะยิง API
  const [updatingItemIds, setUpdatingItemIds] = useState({});

  // debounceTimers: useRef สำหรับเก็บตัวจับเวลา Debounce ของแต่ละสินค้า { [itemId]: timerId }
  const debounceTimers = useRef({});

  // stepperResetKeys: บังคับรีเซ็ตตัวเลข Stepper กลับเป็นค่าเดิมเมื่อกดยกเลิก
  const [stepperResetKeys, setStepperResetKeys] = useState({});

  // เคลียร์ Timer ทั้งหมดทิ้งอัตโนมัติเมื่อผู้ใช้ออกจากหน้านี้ (Cleanup ป้องกัน Memory Leak)
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // 1. ดึงรายการสินค้าในตะกร้าของผู้ใช้เมื่อเปิดหน้านี้ขึ้นมา
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // 2. ดึงรายการสถานที่จัดส่งจาก API /api/shipping-locations
  useEffect(() => {
    async function loadShippingLocations() {
      setLoadingLocations(true);
      try {
        const json = await shippingLocationService.getShippingLocations(userInfo?.securityToken);
        if (json.success && Array.isArray(json.data)) {
          setShippingLocations(json.data);
          // หากมีข้อมูล ให้เลือกสถานที่แรกเป็นค่าเริ่มต้นโดยอัตโนมัติ
          if (json.data.length > 0) {
            setSelectedLocationId(json.data[0].location_id);
          }
        }
      } catch (err) {
        console.error('Failed to load shipping locations:', err);
      } finally {
        setLoadingLocations(false);
      }
    }
    loadShippingLocations();
  }, [userInfo?.securityToken]);

  // normalCount: จำนวนรายการสินค้าในหมวดตะกร้าปกติ (reserve_flag !== 'Y')
  const normalCount = useMemo(
    () => items.filter((item) => item.reserve_flag !== 'Y').length,
    [items]
  );

  // preorderCount: จำนวนรายการสินค้าในหมวดสั่งจองล่วงหน้า (reserve_flag === 'Y')
  const preorderCount = useMemo(
    () => items.filter((item) => item.reserve_flag === 'Y').length,
    [items]
  );

  // filteredItems: กรองรายการสินค้าให้ตรงกับโหมดปัจจุบันที่กำลังเปิดดูอยู่
  // พร้อมเรียงลำดับตาม ID ของรายการในตะกร้า (item.id) เพื่อให้ลำดับแถวในตารางคงที่ ไม่สลับตำแหน่งเมื่อแก้ไขจำนวน
  const filteredItems = useMemo(() => {
    return items
      .filter((item) =>
        isPreorder ? item.reserve_flag === 'Y' : item.reserve_flag !== 'Y'
      )
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }, [items, isPreorder]);

  // storeGroups: นำรายการสินค้ามากรุ๊ปแยกตามร้านค้า (Group by Store) เพื่อแสดงเป็นตารางแยกแต่ละร้าน
  const storeGroups = useMemo(() => {
    // groups: อ็อบเจกต์เก็บกลุ่มตาม store_id
    const groups = {};

    filteredItems.forEach((item) => {
      // storeId: รหัสประจำตัวของร้านค้า
      const storeId = item.product?.store_id || 'general';
      // storeName: ชื่อร้านค้า
      const storeName = item.product?.store_name || 'ร้านค้าทั่วไป';
      // storeAccess: ระดับการเข้าถึงของร้าน ('public' หรือ 'private')
      const storeAccess = item.product?.store_access || 'public';

      if (!groups[storeId]) {
        groups[storeId] = {
          store_id: storeId,
          store_name: storeName,
          store_access: storeAccess,
          items: [],
          totalPrice: 0,
        };
      }

      groups[storeId].items.push(item);

      // price: ราคาต่อหน่วยของสินค้านั้น
      const price = item.product?.product_price || 0;
      // totalPrice: ยอดเงินรวมของเฉพาะร้านค้านี้
      groups[storeId].totalPrice += price * item.quantity;
    });

    return Object.values(groups);
  }, [filteredItems]);

  // grandTotal: ยอดเงินรวมสุทธิของสินค้าทุกรายการจากทุกร้านค้าในโหมดนี้
  const grandTotal = useMemo(() => {
    return filteredItems.reduce(
      (sum, item) => sum + (item.product?.product_price || 0) * item.quantity,
      0
    );
  }, [filteredItems]);

  // handleLimitReached: ฟังก์ชันแจ้งเตือนเมื่อผู้ใช้กดปุ่มเพิ่มจำนวนจนเกินข้อจำกัด
  const handleLimitReached = (item, type) => {
    if (type === 'max') {
      // ถ้าเป็นโหมดสั่งจองล่วงหน้า ไม่จำกัดจำนวนสูงสุด
      if (item.reserve_flag === 'Y') return;

      const p = item.product;
      const realStock = typeof p?.stock_quantity === 'number' ? p.stock_quantity : 0;
      const hasLimit = typeof p?.order_limit === 'number' && p.order_limit > 0;

      if (hasLimit && item.quantity >= p.order_limit) {
        showError(`สินค้าจำกัดการซื้อไม่เกิน ${p.order_limit} ${p.unit_name || 'ชิ้น'} ต่อครั้ง`);
      } else if (item.quantity >= realStock) {
        showError('สินค้าคงเหลือในคลังไม่เพียงพอ');
      }
    }
  };

  // handleUpdateQuantity (แบบ Debounce 500ms):
  // 1. อัปเดตตัวเลขหน้าจอทันทีเมื่อกด (+) หรือ (-)
  // 2. หากยังกดรัวๆ จะยกเลิกตัวจับเวลาเดิม แล้วเริ่มนับใหม่ 500ms เสมอ
  // 3. เมื่อผู้ใช้หยุดกดครบ 500ms ค่อยขึ้นไอคอนหมุนๆ และยิง API ไปบันทึกค่าสุดท้ายครั้งเดียว
  const handleUpdateQuantity = (itemId, newQty) => {
    // 🛡️ หากจำนวนลดลงถึง 0 หรือติดลบ ให้หยุด Debounce และเปิด Popup ถามยืนยันการลบผ่าน useToastStore
    if (newQty <= 0) {
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
        delete debounceTimers.current[itemId];
      }
      const targetItem = items.find((i) => i.id === itemId);
      if (targetItem) {
        const pName = targetItem.product?.product_name || 'สินค้านี้';
        const sName = targetItem.product?.store_name || '-';
        showConfirm({
          title: 'คุณต้องการลบสินค้านี้ออกจากตะกร้าหรือไม่?',
          message: `ชื่อสินค้า : ${pName}\nร้านค้า : ${sName}`,
          confirmText: 'ยืนยัน',
          cancelText: 'ยกเลิก',
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

    // ขั้นที่ 2: ถ้ามี Timer เดิมที่กำลังนับถอยหลังของสินค้านี้อยู่ ให้ยกเลิกทิ้งทันที
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    // ขั้นที่ 3: เริ่มนับถอยหลังใหม่ 500 มิลลิวินาที (0.5 วินาที)
    debounceTimers.current[itemId] = setTimeout(async () => {
      // 3.1 เมื่อหยุดกดครบเวลา ให้แสดงไอคอนหมุนๆ และล็อคปุ่มใน Stepper
      setUpdatingItemIds((prev) => ({ ...prev, [itemId]: true }));

      try {
        // 3.2 ยิง API PUT /api/cart/[id] ไปบันทึกค่าสุดท้ายลงฐานข้อมูลจริง
        await updateQuantity(itemId, newQty);
      } catch (err) {
        showError(err.message || 'เกิดข้อผิดพลาดในการบันทึกจำนวนสินค้า');
      } finally {
        // 3.3 บันทึกเสร็จแล้ว ปิดไอคอนหมุนๆ และปลดล็อคปุ่มกลับมาเป็นปกติ
        setUpdatingItemIds((prev) => ({ ...prev, [itemId]: false }));
        delete debounceTimers.current[itemId];
      }
    }, 500);
  };

  // handleRemoveItem: ฟังก์ชันลบรายการสินค้าทีละชิ้น พร้อมแสดงไอคอนหมุนๆ
  const handleRemoveItem = async (itemId) => {
    setUpdatingItemIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await removeItem(itemId);
      showSuccess('ลบรายการออกจากตะกร้าเรียบร้อยแล้ว');
    } catch (err) {
      showError(err.message || 'เกิดข้อผิดพลาดในการลบรายการสินค้า');
    } finally {
      setUpdatingItemIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // handlePlaceOrder: ฟังก์ชันส่งคำสั่งซื้อและสร้างเอกสารคำขออนุมัติ
  const handlePlaceOrder = async () => {
    if (filteredItems.length === 0) {
      showError('ไม่มีรายการสินค้าในตะกร้า');
      return;
    }

    // 🛡️ ตรวจสอบว่ามีสินค้างดจำหน่ายในตะกร้าหรือไม่
    const hasNotForSale = filteredItems.some(
      (item) => String(item.product?.status || 'Y').trim().toUpperCase() === 'N'
    );
    if (hasNotForSale) {
      showError('มีสินค้างดจำหน่ายอยู่ในตะกร้า กรุณาลบออกก่อนดำเนินการ');
      return;
    }

    // 🛡️ ตรวจสอบความถูกต้องของสินค้าทุกรายการก่อนสั่ง
    for (const item of filteredItems) {
      const qty = Number(item.quantity);
      const realStock = typeof item.product?.stock_quantity === 'number' ? item.product.stock_quantity : 0;
      if (isNaN(qty) || qty <= 0) {
        showError(`สินค้า "${item.product?.product_name || 'ไม่ทราบชื่อ'}" มีจำนวน 0 ชิ้น กรุณาลบออกจากตะกร้า`);
        return;
      }
      if (!isPreorder && qty > realStock) {
        showError(`สินค้า "${item.product?.product_name || 'ไม่ทราบชื่อ'}" สต็อกคงเหลือไม่เพียงพอ (คงเหลือ ${realStock} ${item.product?.unit_name || 'ชิ้น'})`);
        return;
      }
    }

    if (!selectedLocationId) {
      showError('กรุณาเลือกสถานที่จัดส่งสินค้า');
      return;
    }

    if (!isConfirmChecked) {
      showError('กรุณากดยืนยันรายการสั่งซื้อและที่อยู่จัดส่งสินค้า');
      return;
    }

    // username: รหัสพนักงานหรือ Username ของผู้สั่ง
    const username = userInfo?.info?.username || 'WTF112030';
    setIsSubmitting(true);

    try {
      // targetReserveFlag: ประเภทการสั่ง ('Y' หรือ 'N')
      const targetReserveFlag = isPreorder ? 'Y' : 'N';

      // วนลูปส่งคำสั่งซื้อแยกเอกสารตามแต่ละร้านค้า
      for (const group of storeGroups) {
        // payload: โครงสร้างข้อมูลคำสั่งซื้อที่ส่งไปยัง Backend API
        const payload = {
          store_id: group.store_id,
          owner: username,
          shipping_location: selectedLocationId,
          reserve_flag: targetReserveFlag,
          products: group.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        };

        await useOrderStore.getState().placeOrder(payload, userInfo?.securityToken);
      }
      // 🧹 เคลียร์สินค้าที่ถูกสั่งซื้อแล้วออกจาก Local State ในเครื่องทันที
      const orderedProductIds = storeGroups.flatMap((g) => g.items.map((i) => i.product_id));
      useCartStore.setState((state) => {
        const remaining = state.items.filter((i) => !orderedProductIds.includes(i.product_id));
        return {
          items: remaining,
          summary: {
            totalItems: remaining.length,
            totalQuantity: remaining.reduce((sum, i) => sum + i.quantity, 0),
            totalPrice: remaining.reduce((sum, i) => sum + (i.product?.product_price || 0) * i.quantity, 0),
          },
        };
      });
      // รีเฟรชข้อมูลตะกร้าใหม่จาก Server
      await fetchCart();
      // แสดง Toast แจ้งเตือนความสำเร็จ
      showSuccess(
        isPreorder
          ? 'บันทึกการสั่งล่วงหน้าและส่งคำขออนุมัติเรียบร้อยแล้ว'
          : 'บันทึกการสั่งซื้อและส่งคำขออนุมัติเรียบร้อยแล้ว'
      );

      // เคลียร์ Checkbox
      setIsConfirmChecked(false);

      // นำทางไปยังหน้ารายการประวัติคำสั่งซื้อ
      router.push('/orders');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสั่งซื้อ';
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // displayName: ชื่อผู้สั่งซื้อที่นำมาแสดงบนหน้าจอ
  const displayName =
    userInfo?.info?.fullnameTH ||
    userInfo?.info?.fullname ||
    userInfo?.info?.username ||
    'คุณเกียรติยศ หงษ์กลิ่น';

  // displayDepartment: ฝ่าย/แผนกของผู้สั่งซื้อที่นำมาแสดงบนหน้าจอ
  const displayDepartment =
    userInfo?.info?.department_th ||
    userInfo?.info?.department ||
    'ฝ่ายเทคโนโลยีสารสนเทศ';

  return (
    <div className="flex-1 bg-[#f8f9fa] text-[#363636] flex flex-col font-sans">
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
        {/* ─────────────────────────────────────────────────────────────
            ส่วนที่ 1: การ์ดข้อมูลผู้สั่งซื้อ + สวิตช์สลับโหมด + Dropdown สถานที่จัดส่ง
            ───────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg p-5 sm:p-6 shadow-sm border border-[#D3D3D3]/80 space-y-4">
          {/* Header Bar: หัวข้อหน้า และ สวิตช์โหมดแคปซูล */}
          <div className="border-b border-[#D3D3D3]/50 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* หัวข้อหน้า: เปลี่ยนตามโหมดที่เลือก */}
            <h1 className="text-base sm:text-lg font-medium text-[#363636]">
              {isPreorder ? 'ตรวจสอบและยืนยันการสั่งล่วงหน้า' : 'ตรวจสอบและยืนยันการสั่งซื้อ'}
            </h1>

            {/* สวิตช์สลับโหมดแคปซูล (Segmented Control แบบไอคอนคู่ [🔖] | [🛒]) */}
            <div className="inline-flex items-center p-1 bg-stone-100 rounded-lg border border-stone-300 self-start sm:self-auto">
              {/* ฝั่งซ้าย: รายการสั่งล่วงหน้า [ 🔖 ] */}
              <button
                type="button"
                onClick={() => router.replace('/cart-checkout?reserve_flag=Y')}
                className={`relative flex items-center justify-center px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                  isPreorder
                    ? 'bg-[#2B2F38] text-white shadow-xs'
                    : 'text-stone-600 hover:text-[#2B2F38] hover:bg-stone-200/60'
                }`}
                title="รายการสั่งล่วงหน้า"
              >
                <RiBookmarkLine className="w-4 h-4 sm:w-5 sm:h-5" />
                {preorderCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 text-[9px] sm:text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-2xs leading-none ${
                      isPreorder ? 'bg-[#EB6E3E] text-white' : 'bg-stone-400 text-white'
                    }`}
                  >
                    {preorderCount}
                  </span>
                )}
              </button>

              {/* เส้นคั่นตรงกลางระหว่างสองโหมด */}
              <div className="w-[1px] h-4 bg-stone-300 mx-1" />

              {/* ฝั่งขวา: ตะกร้าสินค้าปกติ [ 🛒 ] */}
              <button
                type="button"
                onClick={() => router.replace('/cart-checkout')}
                className={`relative flex items-center justify-center px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                  !isPreorder
                    ? 'bg-[#2B2F38] text-white shadow-xs'
                    : 'text-stone-600 hover:text-[#2B2F38] hover:bg-stone-200/60'
                }`}
                title="รายการสินค้าปกติ"
              >
                <RiShoppingCart2Line className="w-4 h-4 sm:w-5 sm:h-5" />
                {normalCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 text-[9px] sm:text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-2xs leading-none ${
                      !isPreorder ? 'bg-[#EB6E3E] text-white' : 'bg-stone-400 text-white'
                    }`}
                  >
                    {normalCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* แถวล่าง: ข้อมูลผู้สั่งซื้อ และ Dropdown สถานที่จัดส่ง */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 items-center pt-1">
            {/* ด้านซ้าย: ข้อมูลผู้สั่งซื้อ (ชื่อ และ ฝ่าย/แผนก) */}
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="font-normal text-[#363636]/70 min-w-[90px]">ชื่อผู้สั่งซื้อ :</span>
                <span className="font-normal text-[#363636]">{displayName}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-normal text-[#363636]/70 min-w-[90px]">ฝ่าย / แผนก :</span>
                <span className="font-normal text-[#363636]">{displayDepartment}</span>
              </div>
            </div>

            {/* ด้านขวา: Dropdown สถานที่จัดส่งสินค้า (กรอบเรียบหรูพร้อมป้ายลอย) */}
            <div className="relative">
              <div className="relative border border-stone-300 rounded-md px-3.5 pt-2.5 pb-2.5 bg-white flex items-center gap-2.5 transition-all focus-within:border-stone-500 focus-within:ring-1 focus-within:ring-stone-400">
                {/* ป้ายชื่อสถานที่จัดส่งลอยตรงมุมบนซ้าย */}
                <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-[11px] font-normal text-stone-600">
                  สถานที่จัดส่ง <span className="text-rose-500">*</span>
                </label>

                {/* ไอคอนรูปรถบรรทุกขนส่งสินค้า */}
                <div className="shrink-0 text-stone-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                  </svg>
                </div>

                {/* Select Dropdown รายชื่อสถานที่จัดส่ง */}
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  disabled={loadingLocations || shippingLocations.length === 0}
                  className="w-full bg-transparent text-xs sm:text-sm font-normal text-[#363636] focus:outline-none cursor-pointer pr-4 appearance-none"
                >
                  {loadingLocations ? (
                    <option value="">กำลังโหลดสถานที่จัดส่ง...</option>
                  ) : shippingLocations.length === 0 ? (
                    <option value="">ไม่พบข้อมูลสถานที่จัดส่ง</option>
                  ) : (
                    shippingLocations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.location_name} {loc.location_desc ? `(${loc.location_desc})` : ''}
                      </option>
                    ))
                  )}
                </select>

                {/* ไอคอนลูกศรชี้ลง Dropdown ทางขวา */}
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ส่วนที่ 2: ตารางรายการสินค้าในตะกร้า แยกตามร้านค้า (Group by Store)
            ───────────────────────────────────────────────────────────── */}
        {filteredItems.length === 0 ? (
          // กล่องแจ้งเตือนกรณีไม่มีสินค้าในตะกร้า
          <div className="bg-white rounded-lg p-12 text-center border border-[#D3D3D3]/80 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-base font-normal text-[#363636]">
              {isPreorder ? 'ไม่มีรายการสั่งล่วงหน้า' : 'ไม่มีสินค้าในตะกร้า'}
            </h3>
            <p className="text-xs text-[#363636]/60 font-normal">
              กรุณากลับไปเลือกสินค้าและกดเพิ่มลงตะกร้าก่อนดำเนินการ
            </p>
            <Link
              href="/"
              className="inline-block mt-2 bg-[#363636] text-white text-xs font-normal px-5 py-2.5 rounded-md hover:bg-black transition-colors"
            >
              ไปเลือกสินค้า
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* แสดงการ์ดรายการสินค้าแยกตามแต่ละร้านค้า */}
            {storeGroups.map((group) => (
              <div
                key={group.store_id}
                className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 overflow-hidden"
              >
                {/* แถบหัวร้านค้า (Store Header): ชื่อร้านค้าด้านซ้าย และ ราคารวมร้านนี้ด้านขวา */}
                <div className="bg-[#f3f4f6] px-4 sm:px-6 py-3 border-b border-[#D3D3D3]/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {group.store_access === 'private' ? (
                      <FaShopLock className="w-4 h-4 text-[#363636] shrink-0" />
                    ) : (
                      <FaShop className="w-4 h-4 text-[#363636] shrink-0" />
                    )}
                    <h2 className="font-medium text-sm sm:text-base text-[#363636]">
                      {group.store_name}
                    </h2>
                    <span className="text-[11px] font-normal text-[#363636]/60 bg-white px-2 py-0.5 rounded-md border border-[#D3D3D3]">
                      {group.items.length} รายการ
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-normal text-[#363636]">
                    ราคารวมร้านนี้ :{' '}
                    <span className="text-sm sm:text-base font-normal text-[#363636]">
                      ฿{formatPrice(group.totalPrice)}
                    </span>
                  </div>
                </div>

                {/* ตารางรายการสินค้าในร้านค้านี้ */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm table-fixed">
                    {/* Header Columns: รูปภาพ | ชื่อสินค้า | ราคาต่อหน่วย | จำนวน | หน่วย | จำนวนเงิน (บาท) | แอคชั่น */}
                    <thead className="bg-stone-50/70 border-b border-[#D3D3D3]/80 text-[11px] sm:text-xs font-normal text-[#363636]/80">
                      <tr>
                        <th className="w-[4.5rem] py-3 px-3 text-center font-normal">รูปภาพ</th>
                        <th className="py-3 px-3 font-normal">ชื่อสินค้า</th>
                        <th className="w-[6.875rem] py-3 px-3 text-center font-normal">ราคาต่อหน่วย</th>
                        <th className="w-[9.375rem] py-3 px-3 text-center font-normal">จำนวน</th>
                        <th className="w-[5.3125rem] py-3 px-3 text-center font-normal">หน่วย</th>
                        <th className="w-[8.125rem] py-3 px-3 text-right font-normal">จำนวนเงิน (บาท)</th>
                        <th className="w-[4.375rem] py-3 px-3 text-center font-normal">แอคชั่น</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#D3D3D3]/40 text-xs sm:text-sm font-normal">
                      {group.items.map((item) => {
                        // product: ข้อมูลรายละเอียดของสินค้าชิ้นนั้น
                        const product = item.product;

                        // thumb: แปลง Path รูปภาพให้เป็น URL ที่สมบูรณ์
                        const thumb = getThumbnailUrl(
                          product?.product_thumbnail || product?.product_images
                        );

                        // price: ราคาต่อหน่วยของสินค้า
                        const price = product?.product_price ?? 0;

                        // itemTotal: ราคารวมของแถวนี้ (ราคาต่อหน่วย x จำนวนชิ้น)
                        const itemTotal = price * item.quantity;

                        // batchSize: ขนาดชุดขั้นต่ำในการสั่ง
                        const batchSize =
                          product?.batch_size && product.batch_size > 0 ? product.batch_size : 1;

                        // realStock: จำนวนสต็อกสินค้าคงเหลือจริงในคลัง
                        const realStock =
                          typeof product?.stock_quantity === 'number'
                            ? product.stock_quantity
                            : 0;

                        // hasOrderLimit: สินค้านี้มีกำหนดเพดานการสั่งซื้อสูงสุดต่อครั้งหรือไม่
                        const hasOrderLimit =
                          typeof product?.order_limit === 'number' && product.order_limit > 0;

                        // orderLimit: เพดานการสั่งซื้อสูงสุดต่อครั้ง
                        const orderLimit = hasOrderLimit ? product.order_limit : 9999;

                        // isItemPreorder: ตรวจสอบว่าเป็นสินค้ารายการพรีออเดอร์หรือไม่
                        const isItemPreorder = item.reserve_flag === 'Y';

                        // maxLimit: คำนวณขีดจำกัดสูงสุดจริงที่อนุญาตให้ผู้ใช้ปรับจำนวนได้
                        let maxLimit = 999999;
                        if (!isItemPreorder) {
                          const rawMaxLimit = hasOrderLimit
                            ? Math.min(realStock, orderLimit)
                            : realStock;
                          const maxMultiple = Math.floor(rawMaxLimit / batchSize) * batchSize;
                          maxLimit = maxMultiple >= batchSize ? maxMultiple : rawMaxLimit;
                        }

                        return (
                          <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                            {/* 1. รูปภาพขนาดย่อ (สลับเป็นไอคอนสำรองอัตโนมัติหากรูปเสีย) */}
                            <td className="py-3 px-3 text-center">
                              <div className="w-12 h-12 rounded-md bg-white border border-[#D3D3D3] p-1 mx-auto flex items-center justify-center overflow-hidden">
                                <CheckoutItemThumbnail src={thumb} alt={product?.product_name} />
                              </div>
                            </td>

                            {/* 2. ชื่อสินค้า */}
                            <td className="py-3 px-3 pr-4">
                              <p className="font-normal text-xs sm:text-sm text-[#363636] leading-snug line-clamp-2">
                                {product?.product_name || 'ไม่มีชื่อสินค้า'}
                              </p>
                              {String(product?.status || 'Y').trim().toUpperCase() === 'N' && (
                                <div className="mt-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-600 border border-red-200">
                                    <RiAlertLine className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    <span>งดจำหน่าย</span>
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* 3. ราคาต่อหน่วย */}
                            <td className="py-3 px-3 text-center font-normal text-[#363636] whitespace-nowrap">
                              ฿{formatPrice(price)}
                            </td>

                            {/* 4. จำนวน (ปุ่ม Stepper และช่องกรอกจำนวนชิ้น) */}
                            <td className="py-3 px-3">
                              <div className="flex justify-center">
                                <QuantityStepper
                                  key={`${item.id}-${stepperResetKeys[item.id] || 0}`}
                                  value={item.quantity}
                                  step={batchSize}
                                  min={0}
                                  max={maxLimit}
                                  loading={Boolean(updatingItemIds[item.id])}
                                  disabled={Boolean(updatingItemIds[item.id])}
                                  onLimitReached={(type) => handleLimitReached(item, type)}
                                  onChange={(newVal) => handleUpdateQuantity(item.id, newVal)}
                                />
                              </div>
                            </td>

                            {/* 5. หน่วยนับ */}
                            <td className="py-3 px-3 text-center font-normal text-[#363636]/80 whitespace-nowrap">
                              {product?.unit_name || 'ชิ้น'}
                            </td>

                            {/* 6. จำนวนเงินรวมแถวนี้ (บาท) */}
                            <td className="py-3 px-3 text-right font-normal text-[#363636] whitespace-nowrap">
                              ฿{formatPrice(itemTotal)}
                            </td>

                            {/* 7. แอคชั่น: ปุ่มลบถังขยะ (แสดง Spinner หมุนๆ เมื่อกำลังลบ) */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                disabled={Boolean(updatingItemIds[item.id])}
                                onClick={() => {
                                  const pName = product?.product_name || 'สินค้านี้';
                                  const sName = product?.store_name || '-';
                                  showConfirm({
                                    title: 'คุณต้องการลบสินค้านี้ออกจากตะกร้าหรือไม่?',
                                    message: `ชื่อสินค้า : ${pName}\nร้านค้า : ${sName}`,
                                    confirmText: 'ยืนยัน',
                                    cancelText: 'ยกเลิก',
                                    confirmColor: 'red',
                                    onConfirm: () => handleRemoveItem(item.id),
                                  });
                                }}
                                className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                                title={updatingItemIds[item.id] ? 'กำลังลบรายการ...' : 'ลบรายการนี้'}
                              >
                                {updatingItemIds[item.id] ? (
                                  <svg className="w-4 h-4 animate-spin text-[#2B2F38]" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                ) : (
                                  <RiDeleteBin6Line className="w-5 h-5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* ─────────────────────────────────────────────────────────────
                ส่วนที่ 3: Checkbox ยืนยัน + สรุปยอดรวม และปุ่มสั่งซื้อ (Sticky ติดขอบล่างจอ)
                ───────────────────────────────────────────────────────────── */}
            <div className="sticky bottom-0 z-30 bg-white rounded-lg p-4 sm:p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border border-stone-200 space-y-3.5">
              {/* Checkbox ยืนยันรายการสินค้าและสถานที่จัดส่ง */}
              <div className="pt-0.5 pb-0.5">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={isConfirmChecked}
                    onChange={(e) => setIsConfirmChecked(e.target.checked)}
                    className="w-5 h-5 rounded-[3px] border border-stone-400 text-[#2B2F38] focus:ring-0 cursor-pointer accent-[#2B2F38]"
                  />
                  <span className="text-xs sm:text-sm font-medium text-stone-800 group-hover:text-[#2B2F38] transition-colors">
                    {isPreorder
                      ? 'ยืนยันรายการสั่งล่วงหน้าและที่อยู่จัดส่งสินค้า'
                      : 'ยืนยันรายการสั่งซื้อและที่อยู่จัดส่งสินค้า'}
                  </span>
                </label>
              </div>

              {/* ยอดรวมสุทธิทุกร้านค้า และปุ่มยืนยันการสั่งซื้อ */}
              <div className="border-t border-stone-200 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* ยอดเงินรวมทั้งสิ้น */}
                <div className="text-left">
                  <span className="text-xs text-stone-500 block font-normal">ยอดรวมทั้งสิ้น</span>
                  <div className="text-base sm:text-lg font-medium text-stone-900">
                    ราคารวมทุกร้าน :{' '}
                    <span className="text-lg sm:text-xl font-bold text-[#2B2F38]">
                      ฿{formatPrice(grandTotal)}
                    </span>
                  </div>
                </div>

                {/* กลุ่มปุ่มกด: เลือกสินค้าเพิ่มเติม และ ยืนยันการสั่งซื้อ */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* ปุ่มกลับหน้าแรกไปเลือกสินค้าเพิ่ม */}
                  <Link
                    href="/"
                    className="flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-md border border-stone-300 hover:border-[#2B2F38] text-xs font-medium text-[#2B2F38] hover:bg-stone-50 transition-colors"
                  >
                    เลือกสินค้าเพิ่มเติม
                  </Link>

                  {/* ปุ่มส่งคำสั่งซื้อ */}
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={
                      !isConfirmChecked ||
                      !selectedLocationId ||
                      isSubmitting ||
                      filteredItems.length === 0
                    }
                    className="flex-1 sm:flex-initial px-8 py-2.5 rounded-md bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin text-white shrink-0"
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
                        <span>
                          {isPreorder
                            ? 'กำลังยืนยันการสั่งล่วงหน้า...'
                            : 'กำลังยืนยันคำสั่งซื้อ...'}
                        </span>
                      </>
                    ) : (
                      <span>{isPreorder ? 'ยืนยันการสั่งล่วงหน้า' : 'ยืนยันการสั่งซื้อ'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * =========================================================================
 * Export Default: CartCheckoutPage
 * ครอบด้วย Suspense เพื่อรองรับ Client Side Rendering ของ useSearchParams() ใน Next.js
 * =========================================================================
 */
export default function CartCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-[#f8f9fa] p-8 text-center text-sm text-stone-500 font-sans">
          กำลังโหลดหน้าตรวจสอบรายการ...
        </div>
      }
    >
      <CartCheckoutContent />
    </Suspense>
  );
}
