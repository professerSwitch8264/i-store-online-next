// src/app/cart/page.js
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * =========================================================================
 * Page: /cart (Redirector to /cart-checkout)
 * หน้าที่: นำทาง Redirect จากเส้นทางเดิม /cart ไปยังหน้าใหม่ /cart-checkout พร้อมส่งต่อ Query Params
 * =========================================================================
 */
function CartRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const reserveFlag = searchParams.get('reserve_flag');
    const targetUrl = reserveFlag === 'Y' ? '/cart-checkout?reserve_flag=Y' : '/cart-checkout';
    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div className="flex-1 bg-[#f8f9fa] p-8 text-center text-sm text-stone-500 font-sans">
      กำลังนำทางไปยังหน้าตรวจสอบรายการ...
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-[#f8f9fa] p-8 text-center text-sm text-stone-500 font-sans">
          กำลังโหลด...
        </div>
      }
    >
      <CartRedirect />
    </Suspense>
  );
}
