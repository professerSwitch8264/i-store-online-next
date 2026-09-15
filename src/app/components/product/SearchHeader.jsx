import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { RiStore2Line, RiGridLine } from 'react-icons/ri';
import { useProductStore } from '@/app/stores/useProductStore';
import { CartPopover } from '@/app/components/cart/CartPopover';

/**
 * Component: SearchHeader (แถบส่วนหัว: โลโก้, ช่องค้นหาสินค้า, ปุ่ม Search Detail และปุ่มเปิดตะกร้า/พรีออเดอร์)
 * หน้าที่: 
 * 1. แสดงโลโก้ i-Store ด้านซ้าย
 * 2. ช่องกรอกค้นหาชื่อสินค้า ปุ่มกดค้นหา และปุ่ม 3 ขีด (Search Detail) รวมอยู่ในกล่องเดียวกัน
 * 3. Popover ค้นหาละเอียด แสดงอยู่ใต้ปุ่มดีเทลโดยตรง พร้อมคำนวณไม่ให้หลุดขอบจอฝั่งซ้ายเมื่อถูกบีบ
 * 4. ปุ่มไอคอนเปิด Popover สำหรับสั่งจองล่วงหน้า (Pre-order) และตะกร้าสินค้าปกติ
 */
export function SearchHeader() {
  const {
    searchInput,
    setSearchInput,
    submitSearch,
    loading,
    isDetailOpen,
    setIsDetailOpen,
    selectedStore,
    selectedCategory,
    stores,
    categories,
    fetchFilterOptions,
    applyDetailSearch,
    clearStoreFilter,
    clearCategoryFilter,
  } = useProductStore();

  // refs สำหรับตรวจจับ Click Outside และคำนวณพิกัดปุ่มดีเทล
  const popoverRef = useRef(null);
  const toggleButtonRef = useRef(null);

  // State เก็บค่าที่เลือกในแผงค้นหาละเอียด (ร่างก่อนกดยืนยันค้นหา)
  const [draftStore, setDraftStore] = useState(selectedStore || '');
  const [draftCategory, setDraftCategory] = useState(selectedCategory || '');

  // คำนวณความกว้างสูงสุดของ Popover ให้แสดงใต้ปุ่มดีเทลและไม่หลุดขอบหน้าจอฝั่งซ้ายแม้หน้าต่างถูกบีบ
  const [popoverMaxWidth, setPopoverMaxWidth] = useState(460);

  const updatePopoverWidth = useCallback(() => {
    if (toggleButtonRef.current) {
      const rect = toggleButtonRef.current.getBoundingClientRect();
      // rect.right คือพิกัดขอบขวาของปุ่มดีเทลจากขอบซ้ายสุดของหน้าจอ
      // เว้นระยะห่างปลอดภัยจากขอบซ้ายของจออย่างน้อย 12px
      const availableWidth = rect.right - 12;
      setPopoverMaxWidth(Math.max(220, Math.min(460, availableWidth)));
    }
  }, []);

  // โหลดข้อมูลร้านค้าและหมวดหมู่มาเตรียมไว้สำหรับตัวกรอง
  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // ซิงค์ค่า draft ให้ตรงกับ store เมื่อ selectedStore / selectedCategory จากภายนอกเปลี่ยนแปลง
  const [prevSelectedStore, setPrevSelectedStore] = useState(selectedStore);
  const [prevSelectedCategory, setPrevSelectedCategory] = useState(selectedCategory);

  if (selectedStore !== prevSelectedStore) {
    setPrevSelectedStore(selectedStore);
    setDraftStore(selectedStore || '');
  }

  if (selectedCategory !== prevSelectedCategory) {
    setPrevSelectedCategory(selectedCategory);
    setDraftCategory(selectedCategory || '');
  }

  // คำนวณพิกัดและขนาดเมื่อเปิด Popover หรือเมื่อหน้าต่างถูกปรับขนาด (Resize)
  useEffect(() => {
    if (isDetailOpen) {
      updatePopoverWidth();
      window.addEventListener('resize', updatePopoverWidth);
      return () => window.removeEventListener('resize', updatePopoverWidth);
    }
  }, [isDetailOpen, updatePopoverWidth]);

  // ตรวจจับการคลิกนอกพื้นที่ (Click Outside) หรือกด Escape เพื่อปิด Popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(event.target)
      ) {
        setIsDetailOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDetailOpen(false);
      }
    }

    if (isDetailOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDetailOpen, setIsDetailOpen]);

  // สลับการเปิด/ปิด Popover พร้อมคำนวณขนาดทันทีก่อนเรนเดอร์
  const handleToggle = () => {
    if (!isDetailOpen) {
      updatePopoverWidth();
    }
    setIsDetailOpen(!isDetailOpen);
  };

  // ฟังก์ชันดักจับปุ่มกด Enter ในช่องค้นหา
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      submitSearch();
    }
  };

  // กรองหมวดหมู่ตามร้านค้าที่เลือก (ถ้าเลือกร้านค้า จะแสดงเฉพาะหมวดหมู่ของร้านนั้น)
  const filteredCategories = draftStore
    ? categories.filter((c) => c.store_id === draftStore)
    : categories;

  // กดยืนยันค้นหาจากแผงค้นหาละเอียด
  const handleApplyFilters = () => {
    applyDetailSearch({
      storeId: draftStore,
      categoryId: draftCategory,
    });
    setIsDetailOpen(false);
  };

  // กดล้างตัวกรองในแผงค้นหาละเอียด
  const handleClearFilters = () => {
    setDraftStore('');
    setDraftCategory('');
    clearStoreFilter();
    clearCategoryFilter();
    setIsDetailOpen(false);
  };

  return (
    <header className="w-full bg-white border-b border-stone-200 sticky top-8 z-40 shadow-xs select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
        {/* จัดวาง โลโก้ + ช่องค้นหา & ปุ่ม Search Detail + ตะกร้าสินค้า ในแถวเดียวกัน */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-6">
          {/* 1. โลโก้ i-Store ด้านซ้าย */}
          <div className="flex items-center shrink-0 cursor-pointer">
            <Image
              src="/iStoreHome.png"
              alt="i-Store Logo"
              width={200}
              height={65}
              className="h-10 sm:h-12 w-auto object-contain"
              priority
            />
          </div>
          {/* <div className="flex flex-col items-start leading-none">
            <span className="text-xl font-extrabold tracking-wider text-[#2B2F38]">
              ISTORE
            </span>
            <span className="text-[10px] font-semibold tracking-widest text-stone-400 mt-1">
              ONLINE PLATFORM
            </span>
          </div> */}

          {/* 2. กล่องค้นหาสินค้า: รวมเป็นกล่องเดียวกัน และเป็นตัวยึด Popover ใต้ปุ่มดีเทล */}
          <div className="flex-1 min-w-0 max-w-2xl flex justify-center">
            <div className="relative w-full">
              {/* กล่องค้นหา (Input + ปุ่มค้นหา + ปุ่ม 3 ขีด) ชิ้นเดียวกัน */}
              <div className="w-full h-8.5 sm:h-9 flex items-center bg-white rounded-md border border-stone-300 overflow-hidden transition-all focus-within:border-stone-400 focus-within:ring-1 focus-within:ring-stone-400/40 shadow-2xs">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า หรือรายละเอียดสินค้า..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-w-0 h-full bg-transparent text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:outline-none px-3 sm:px-4 font-normal"
                />

                {/* ปุ่มค้นหา สี Deep Charcoal (#2B2F38) */}
                <button
                  type="button"
                  onClick={submitSearch}
                  disabled={loading}
                  className="bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white px-3 sm:px-4 h-full transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer font-medium text-xs sm:text-sm"
                  title="ค้นหา"
                >
                  <svg
                    className="w-4 h-4 text-white shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.4}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span className="hidden sm:inline">ค้นหา</span>
                </button>

                {/* ปุ่ม 3 ขีดแนวนอน (Search Detail Toggle) รวมอยู่ในกล่องเดียวกัน ติดกับปุ่มค้นหา */}
                <button
                  ref={toggleButtonRef}
                  type="button"
                  onClick={handleToggle}
                  className={`h-full px-2.5 sm:px-3 border-l border-stone-200 transition-colors shrink-0 flex items-center justify-center cursor-pointer ${
                    isDetailOpen
                      ? 'bg-stone-100 text-[#2B2F38]'
                      : 'bg-white hover:bg-stone-50 text-[#2B2F38]'
                  }`}
                  title={isDetailOpen ? 'ปิดค้นหาละเอียด' : 'ค้นหาละเอียด'}
                >
                  {isDetailOpen ? (
                    // ไอคอน X เมื่อเปิด Popover
                    <svg
                      className="w-4 h-4 text-[#2B2F38]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    >
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="6" y1="18" x2="18" y2="6" />
                    </svg>
                  ) : (
                    // ไอคอน 3 ขีดแนวนอน (☰)
                    <svg
                      className="w-4 h-4 text-[#2B2F38]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    >
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  )}
                </button>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  4. หน้าต่าง Popover ค้นหาละเอียด: แสดงใต้ปุ่มดีเทล (right-0) 
                  และคำนวณไม่ให้หลุดขอบจอฝั่งซ้ายแม้หน้าต่างถูกบีบแคบ
                  ───────────────────────────────────────────────────────────── */}
              {isDetailOpen && (
                <div
                  ref={popoverRef}
                  style={{
                    width: `${popoverMaxWidth}px`,
                    maxWidth: `${popoverMaxWidth}px`,
                  }}
                  className="absolute top-full mt-2 right-0 z-50 animate-fadeIn"
                >
                  {/* การ์ดสีขาว ขอบมนน้อยที่สุด เงา shadow-2xl สีข้อความ #2B2F38 */}
                  <div className="relative bg-white rounded-xs shadow-2xl border border-stone-200 p-4 text-[#2B2F38]">
                    {/* สามเหลี่ยมชี้ขึ้น (Arrow Pointer) ชี้ตรงกับปุ่มดีเทลด้านบน */}
                    <div className="absolute -top-1.5 right-3.5 sm:right-4 w-3.5 h-3.5 bg-white border-t border-l border-stone-200 rotate-45 z-20" />

                    {/* แถวดรอปดาวน์: ร้านค้า และ หมวดหมู่ (ปรับ 1 แถวหรือ 2 คอลัมน์ตามขนาดจอ) ดีไซน์ Outlined Input + Icon ตามแบบหน้าผู้ดูแล/ลูกค้า/หมวดหมู่ */}
                    <div className={`grid gap-4 pt-1.5 ${popoverMaxWidth < 360 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                      {/* ดรอปดาวน์ร้านค้า */}
                      <div>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                            <RiStore2Line className="w-5 h-5 text-stone-600" />
                          </div>
                          <select
                            value={draftStore}
                            onChange={(e) => {
                              const newStore = e.target.value;
                              setDraftStore(newStore);
                              // ถ้าเปลี่ยนร้านค้า และหมวดหมู่ที่เลือกไว้ไม่อยู่ในร้านใหม่ ให้รีเซ็ตหมวดหมู่
                              if (newStore && draftCategory) {
                                const cat = categories.find((c) => c.category_id === draftCategory);
                                if (cat && cat.store_id !== newStore) {
                                  setDraftCategory('');
                                }
                              }
                            }}
                            className="w-full h-11 pl-10.5 pr-8 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal cursor-pointer appearance-none truncate"
                          >
                            <option value="">-- ทั้งหมด --</option>
                            {stores.map((s) => (
                              <option key={s.store_id} value={s.store_id}>
                                {s.store_name}
                              </option>
                            ))}
                          </select>
                          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                            ร้านค้า
                          </label>
                          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* ดรอปดาวน์หมวดหมู่ */}
                      <div>
                        <div className="relative">
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center">
                            <RiGridLine className="w-5 h-5 text-stone-600" />
                          </div>
                          <select
                            value={draftCategory}
                            onChange={(e) => setDraftCategory(e.target.value)}
                            className="w-full h-11 pl-10.5 pr-8 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal cursor-pointer appearance-none truncate"
                          >
                            <option value="">-- ทั้งหมด --</option>
                            {filteredCategories.map((c) => (
                              <option key={c.category_id} value={c.category_id}>
                                {c.category_name} {c.store_name && !draftStore ? `(${c.store_name})` : ''}
                              </option>
                            ))}
                          </select>
                          <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none">
                            หมวดหมู่
                          </label>
                          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ปุ่ม Action ด้านล่าง: ค้นหา (สีหลัก #2B2F38) และ ล้าง (สีขอบ stone-300) รวมกันเท่ากล่องหมวดหมู่ */}
                    <div className={`grid gap-3 mt-3.5 pt-3 border-t border-stone-100 ${popoverMaxWidth < 360 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                      {/* คอลัมน์ซ้าย (ใต้ร้านค้า) เว้นว่างในจอ 2 คอลัมน์ */}
                      <div className={popoverMaxWidth < 360 ? 'hidden' : 'hidden sm:block'} />

                      {/* คอลัมน์ขวา (ใต้หมวดหมู่) บรรจุทั้ง 2 ปุ่ม ให้ความกว้างรวมเท่ากับกล่องหมวดหมู่พอดี */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {/* ปุ่มค้นหา สี Charcoal #2B2F38 */}
                        <button
                          type="button"
                          onClick={handleApplyFilters}
                          disabled={loading}
                          className="w-full h-8 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white text-xs font-medium rounded-md flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-white shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                          <span>ค้นหา</span>
                        </button>

                        {/* ปุ่มล้าง สีขาวขอบ stone-300 */}
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          disabled={loading}
                          className="w-full h-8 bg-white border border-stone-300 hover:bg-stone-50 active:bg-stone-100 text-[#2B2F38] text-xs font-medium rounded-md flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-stone-500 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                            />
                          </svg>
                          <span>ล้าง</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. ปุ่มสั่งล่วงหน้า (Pre-order 🔖) & ตะกร้าสินค้า (🛒) ด้านขวา - แสดงชัดเจนตลอดเวลาทุกขนาดหน้าจอ */}
          <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
            <CartPopover mode="preorder" />
            <CartPopover mode="cart" />
          </div>
        </div>
      </div>
    </header>
  );
}
