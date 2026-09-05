// src/app/page.js
'use client';

import { useEffect } from 'react';

import { useProductStore } from '@/app/stores/useProductStore'; 
import { useCartStore } from '@/app/stores/useCartStore';

import { SearchHeader } from '@/app/components/product/SearchHeader';
import { SearchKeywords } from '@/app/components/product/SearchKeywords';
import { ProductCard, ProductGridSkeleton } from '@/app/components/product/ProductCard'; 
import { Pagination } from '@/app/components/ui/Pagination'; 

import { RiInboxLine } from 'react-icons/ri';

/**
 * Page Component: SearchPage (หน้าค้นหาและแคตตาล็อกสินค้าหลัก)
 * หน้าที่: ควบคุมการโหลดข้อมูลสินค้า และจัด Layout องค์ประกอบหลักในหน้าเว็บ
 */
export default function SearchPage() {
  // ดึง State และ Action หลักสำหรับสินค้าจาก Zustand useProductStore
  const {
    products,      // รายการสินค้าของหน้าปัจจุบันที่ดึงมาจาก API
    loading,       // สถานะกำลังโหลดข้อมูลสินค้าหรือไม่ (true/false)
    fetchProducts, // ฟังก์ชันเรียก API /api/products เพื่อดึงรายการสินค้า
  } = useProductStore();

  // fetchCart: ฟังก์ชันดึงข้อมูลตะกร้าสินค้าของผู้ใช้จาก Zustand useCartStore
  const fetchCart = useCartStore((state) => state.fetchCart);

  // โหลดรายการสินค้าและข้อมูลตะกร้าครั้งแรกเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchProducts();
    fetchCart();
  }, [fetchProducts, fetchCart]);

  return (
    <div className="flex-1 flex flex-col bg-[#f8f9fa] text-[#2B2F38]">
      {/* ─────────────────────────────────────────────────────────────
          1. Header แถบค้นหาสินค้า โลโก้ และปุ่มเปิดตะกร้า
          ───────────────────────────────────────────────────────────── */}
      <SearchHeader />

      {/* เนื้อหาหลัก */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* ─────────────────────────────────────────────────────────────
            2. แถบแสดงแท็กคำค้นหา (Keywords Tag) และจำนวนผลลัพธ์
            ───────────────────────────────────────────────────────────── */}
        <SearchKeywords />

        {/* ตารางสินค้า */}
        <section>
          {loading ? (
            <ProductGridSkeleton count={12} />
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-stone-300">
              <RiInboxLine className="w-12 h-12 mx-auto mb-2 text-stone-300" />
              <h3 className="text-base font-semibold text-[#363636]">ไม่พบข้อมูลสินค้า</h3>
              <p className="text-xs text-stone-400 mt-1">
                ลองค้นหาด้วยคำค้นหาอื่น หรือกดล้างคำค้นหา
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
              {products.map((product) => (
                <ProductCard key={product.product_id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* 📄 ปุ่มแบ่งหน้า Pagination */}
        <Pagination />
      </main>
    </div>
  );
}