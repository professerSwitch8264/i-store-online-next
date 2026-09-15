'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RiFileList3Line,
  RiUserLine,
  RiCalendarLine,
  RiShoppingBag3Line,
  RiCloseLine,
} from 'react-icons/ri';
import { SearchableSelect } from '@/app/components/ui/SearchableSelect';

/**
 * Component: OrderSearchBox (ช่องค้นหาคำสั่งซื้อ พร้อมปุ่ม Search Detail และ Popover ค้นหาละเอียด)
 * 
 * ฟิลด์ใน Popover:
 * 1. หมายเลขใบสั่ง (Order No)
 * 2. ผู้สั่งซื้อ (Buyer)
 * 3. วันที่ ตั้งแต่ (Date From)
 * 4. ถึงวันที่ (Date To)
 * 5. รูปแบบการสั่งซื้อ (Order Type: ทั้งหมด / มาตรฐาน / สั่งล่วงหน้า)
 */
export function OrderSearchBox({
  searchInput = '',
  onSearchInputChange,
  onSearchSubmit,
  onSearchClear,
  placeholder = 'ค้นหาหมายเลขใบสั่งซื้อ...',
  isDetailOpen = false,
  setIsDetailOpen,
  appliedDetailFilters = {
    orderNo: '',
    dateFrom: '',
    dateTo: '',
    buyer: '',
    reserveFlag: 'ALL',
  },
  onApplyDetail,
  onClearDetail,
  loading = false,
}) {
  const popoverRef = useRef(null);
  const toggleButtonRef = useRef(null);

  // ค่าแบบร่าง (Draft) สำหรับฟอร์มใน Popover
  const [draftOrderNo, setDraftOrderNo] = useState(appliedDetailFilters.orderNo || '');
  const [draftDateFrom, setDraftDateFrom] = useState(appliedDetailFilters.dateFrom || '');
  const [draftDateTo, setDraftDateTo] = useState(appliedDetailFilters.dateTo || '');
  const [draftBuyer, setDraftBuyer] = useState(appliedDetailFilters.buyer || '');
  const [draftReserveFlag, setDraftReserveFlag] = useState(appliedDetailFilters.reserveFlag || 'ALL');

  // ซิงค์ค่า draft ให้ตรงกับ appliedDetailFilters จากภายนอก
  const [prevFilters, setPrevFilters] = useState(appliedDetailFilters);

  if (
    appliedDetailFilters.orderNo !== prevFilters.orderNo ||
    appliedDetailFilters.dateFrom !== prevFilters.dateFrom ||
    appliedDetailFilters.dateTo !== prevFilters.dateTo ||
    appliedDetailFilters.buyer !== prevFilters.buyer ||
    appliedDetailFilters.reserveFlag !== prevFilters.reserveFlag
  ) {
    setPrevFilters(appliedDetailFilters);
    setDraftOrderNo(appliedDetailFilters.orderNo || '');
    setDraftDateFrom(appliedDetailFilters.dateFrom || '');
    setDraftDateTo(appliedDetailFilters.dateTo || '');
    setDraftBuyer(appliedDetailFilters.buyer || '');
    setDraftReserveFlag(appliedDetailFilters.reserveFlag || 'ALL');
  }

  // ตรวจสอบว่ามีตัวกรองละเอียดเปิดใช้งานอยู่หรือไม่
  const hasActiveFilters = Boolean(
    appliedDetailFilters.orderNo ||
    appliedDetailFilters.dateFrom ||
    appliedDetailFilters.dateTo ||
    appliedDetailFilters.buyer ||
    (appliedDetailFilters.reserveFlag && appliedDetailFilters.reserveFlag !== 'ALL')
  );

  // คำนวณความกว้างสูงสุดของ Popover ให้แสดงใต้ปุ่มดีเทลและไม่หลุดขอบหน้าจอฝั่งซ้าย
  const [popoverMaxWidth, setPopoverMaxWidth] = useState(480);

  const updatePopoverWidth = useCallback(() => {
    if (toggleButtonRef.current) {
      const rect = toggleButtonRef.current.getBoundingClientRect();
      const availableWidth = rect.right - 12;
      setPopoverMaxWidth(Math.max(260, Math.min(480, availableWidth)));
    }
  }, []);

  useEffect(() => {
    if (isDetailOpen) {
      updatePopoverWidth();
      window.addEventListener('resize', updatePopoverWidth);
      return () => window.removeEventListener('resize', updatePopoverWidth);
    }
  }, [isDetailOpen, updatePopoverWidth]);

  // ตรวจจับการคลิกนอกพื้นที่ (Click Outside) หรือกดปุ่ม Escape เพื่อปิด Popover
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

  const handleToggle = () => {
    if (!isDetailOpen) {
      // เมื่อเปิด ให้รีเซ็ตค่า draft ให้ตรงกับ appliedDetailFilters
      setDraftOrderNo(appliedDetailFilters.orderNo || '');
      setDraftDateFrom(appliedDetailFilters.dateFrom || '');
      setDraftDateTo(appliedDetailFilters.dateTo || '');
      setDraftBuyer(appliedDetailFilters.buyer || '');
      setDraftReserveFlag(appliedDetailFilters.reserveFlag || 'ALL');
      updatePopoverWidth();
    }
    setIsDetailOpen(!isDetailOpen);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (onSearchSubmit) onSearchSubmit();
  };

  const handleApply = (e) => {
    if (e) e.preventDefault();
    if (onApplyDetail) {
      onApplyDetail({
        orderNo: draftOrderNo.trim(),
        dateFrom: draftDateFrom,
        dateTo: draftDateTo,
        buyer: draftBuyer.trim(),
        reserveFlag: draftReserveFlag,
      });
    }
  };

  const handleClear = () => {
    setDraftOrderNo('');
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftBuyer('');
    setDraftReserveFlag('ALL');
    if (onClearDetail) {
      onClearDetail();
    }
  };

  return (
    <div className="relative w-full">
      {/* กล่องค้นหาหลัก: ช่องกรอก + ปุ่มค้นหา + ปุ่ม 3 ขีด เป็นชิ้นเดียวกัน */}
      <form
        onSubmit={handleFormSubmit}
        className="w-full h-9 sm:h-9.5 flex items-center bg-white rounded-md border border-stone-300 overflow-hidden transition-all focus-within:border-stone-400 focus-within:ring-1 focus-within:ring-stone-400/40 shadow-2xs"
      >
        {/* ช่องกรอกค้นหา */}
        <div className="relative flex-1 h-full flex items-center min-w-0">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchInputChange && onSearchInputChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0 h-full bg-transparent text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:outline-none pl-3 sm:pl-3.5 pr-8 font-normal"
          />

          {/* ปุ่มล้างคำค้นหาเมื่อมีข้อความ */}
          {searchInput && (
            <button
              type="button"
              onClick={onSearchClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#2B2F38] p-1 cursor-pointer transition-colors"
              title="ล้างคำค้นหา"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ปุ่มค้นหา สี Deep Charcoal (#2B2F38) */}
        <button
          type="submit"
          disabled={loading}
          className="bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white px-3 sm:px-4 h-full transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer font-medium text-xs sm:text-sm border-l border-[#2B2F38]"
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
          className={`relative h-full px-2.5 sm:px-3 border-l border-stone-200 transition-colors shrink-0 flex items-center justify-center cursor-pointer ${
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

          {/* จุดส้มแจ้งเตือนเมื่อมีตัวกรองทำงานอยู่ */}
          {hasActiveFilters && !isDetailOpen && (
            <span className="absolute top-2 right-1.5 w-2 h-2 rounded-full bg-[#EB6E3E] ring-2 ring-white" />
          )}
        </button>
      </form>

      {/* ─────────────────────────────────────────────────────────────
          หน้าต่าง Popover ค้นหาละเอียด: แสดงใต้ปุ่มดีเทล (right-0)
          การ์ดสีขาว ขอบมนน้อยที่สุด (rounded-xs) เงา shadow-2xl สีข้อความ #2B2F38
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
          <div className="relative bg-white rounded-xs shadow-2xl border border-stone-200 p-4 text-[#2B2F38]">
            {/* สามเหลี่ยมชี้ขึ้น (Arrow Pointer) ชี้ตรงกับปุ่มดีเทลด้านบน */}
            <div className="absolute -top-1.5 right-3.5 sm:right-4 w-3.5 h-3.5 bg-white border-t border-l border-stone-200 rotate-45 z-20" />

            {/* แถวฟิลด์ค้นหาละเอียด: Outlined Input + Icon */}
            <div className={`grid gap-3.5 pt-1.5 ${popoverMaxWidth < 380 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {/* 1. หมายเลขใบสั่ง (Order No) */}
              <div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center z-10">
                    <RiFileList3Line className="w-5 h-5 text-stone-600" />
                  </div>
                  <input
                    type="text"
                    value={draftOrderNo}
                    onChange={(e) => setDraftOrderNo(e.target.value)}
                    placeholder=""
                    className="w-full h-10 pl-10.5 pr-3 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                  />
                  <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none z-10">
                    หมายเลขใบสั่ง
                  </label>
                </div>
              </div>

              {/* 2. ผู้สั่งซื้อ (Buyer) */}
              <div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center z-10">
                    <RiUserLine className="w-5 h-5 text-stone-600" />
                  </div>
                  <input
                    type="text"
                    value={draftBuyer}
                    onChange={(e) => setDraftBuyer(e.target.value)}
                    placeholder=""
                    className="w-full h-10 pl-10.5 pr-3 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal"
                  />
                  <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none z-10">
                    ผู้สั่งซื้อ
                  </label>
                </div>
              </div>

              {/* 3. วันที่ ตั้งแต่ (Date From) */}
              <div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center z-20">
                    <RiCalendarLine className="w-5 h-5 text-stone-600" />
                  </div>

                  {/* ข้อความแสดงผลในรูปแบบ yyyy/mm/dd (เมื่อมีการเลือกวัน) เริ่มต้นหลังไอคอนปฏิทิน ไม่บังไอคอน */}
                  {draftDateFrom && (
                    <div
                      style={{ left: '2.625rem', right: '1.75rem' }}
                      className="absolute top-[1px] bottom-[1px] flex items-center text-xs sm:text-sm text-[#2B2F38] pointer-events-none z-10 bg-white select-none"
                    >
                      {draftDateFrom.replace(/-/g, '/')}
                    </div>
                  )}

                  <input
                    type="date"
                    value={draftDateFrom}
                    max={draftDateTo || undefined}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (_) {}
                    }}
                    onChange={(e) => {
                      const newFrom = e.target.value;
                      setDraftDateFrom(newFrom);
                      // หากวันที่เริ่มต้นที่เลือกใหม่มากกว่าวันที่สิ้นสุดเดิม ให้ปรับวันที่สิ้นสุดให้เท่ากัน
                      if (newFrom && draftDateTo && newFrom > draftDateTo) {
                        setDraftDateTo(newFrom);
                      }
                    }}
                    className={`date-input-clickable ${!draftDateFrom ? 'date-input-empty' : ''} w-full h-10 pl-10.5 pr-8 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal cursor-pointer select-none`}
                  />

                  {/* ปุ่มล้างวันที่ เมื่อมีการเลือกวัน */}
                  {draftDateFrom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftDateFrom('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-[#2B2F38] rounded cursor-pointer z-20 transition-colors"
                      title="ล้างวันที่"
                    >
                      <RiCloseLine className="w-4 h-4" />
                    </button>
                  )}

                  <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none z-20">
                    วันที่ ตั้งแต่
                  </label>
                </div>
              </div>

              {/* 4. ถึงวันที่ (Date To) */}
              <div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none flex items-center justify-center z-20">
                    <RiCalendarLine className="w-5 h-5 text-stone-600" />
                  </div>

                  {/* ข้อความแสดงผลในรูปแบบ yyyy/mm/dd (เมื่อมีการเลือกวัน) เริ่มต้นหลังไอคอนปฏิทิน ไม่บังไอคอน */}
                  {draftDateTo && (
                    <div
                      style={{ left: '2.625rem', right: '1.75rem' }}
                      className="absolute top-[1px] bottom-[1px] flex items-center text-xs sm:text-sm text-[#2B2F38] pointer-events-none z-10 bg-white select-none"
                    >
                      {draftDateTo.replace(/-/g, '/')}
                    </div>
                  )}

                  <input
                    type="date"
                    value={draftDateTo}
                    min={draftDateFrom || undefined}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (_) {}
                    }}
                    onChange={(e) => {
                      const newTo = e.target.value;
                      // ป้องกันไม่ให้เลือกวันที่สิ้นสุดน้อยกว่าวันที่เริ่มต้น
                      if (newTo && draftDateFrom && newTo < draftDateFrom) {
                        setDraftDateTo(draftDateFrom);
                      } else {
                        setDraftDateTo(newTo);
                      }
                    }}
                    className={`date-input-clickable ${!draftDateTo ? 'date-input-empty' : ''} w-full h-10 pl-10.5 pr-8 bg-white border border-stone-300 rounded-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38] focus:outline-none transition-colors font-normal cursor-pointer select-none`}
                  />

                  {/* ปุ่มล้างวันที่ เมื่อมีการเลือกวัน */}
                  {draftDateTo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftDateTo('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-[#2B2F38] rounded cursor-pointer z-20 transition-colors"
                      title="ล้างวันที่"
                    >
                      <RiCloseLine className="w-4 h-4" />
                    </button>
                  )}

                  <label className="absolute -top-2.5 left-3 bg-white px-1.5 text-xs text-stone-600 font-normal pointer-events-none z-20">
                    ถึงวันที่
                  </label>
                </div>
              </div>

              {/* 5. รูปแบบการสั่งซื้อ (Order Type) */}
              <div className={popoverMaxWidth < 380 ? 'col-span-1' : 'col-span-1 sm:col-span-2'}>
                <SearchableSelect
                  label="รูปแบบการสั่งซื้อ"
                  value={draftReserveFlag}
                  onChange={(e) => setDraftReserveFlag(e.target.value)}
                  prefix={<RiShoppingBag3Line className="w-5 h-5 text-stone-600" />}
                  height="h-10"
                  searchable={false}
                >
                  <option value="ALL">-- ทั้งหมด --</option>
                  <option value="N">มาตรฐาน</option>
                  <option value="Y">สั่งล่วงหน้า</option>
                </SearchableSelect>
              </div>
            </div>

            {/* ปุ่ม Action ด้านล่าง: ค้นหา (สีหลัก #2B2F38) และ ล้าง (สีขอบ stone-300) */}
            <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-stone-100">
              {/* คอลัมน์ซ้าย เว้นว่างในจอ 2 คอลัมน์ */}
              <div className={popoverMaxWidth < 380 ? 'hidden' : 'hidden sm:block'} />

              {/* คอลัมน์ขวา บรรจุทั้ง 2 ปุ่ม */}
              <div className={`grid grid-cols-2 gap-2 w-full ${popoverMaxWidth < 380 ? 'col-span-2' : 'col-span-2 sm:col-span-1'}`}>
                {/* ปุ่มค้นหา สี Charcoal #2B2F38 */}
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={loading}
                  className="w-full h-8.5 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white text-xs font-medium rounded-md flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
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
                      strokeWidth={2.4}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <span>ค้นหา</span>
                </button>

                {/* ปุ่มล้างตัวกรอง สีขาวขอบ stone-300 */}
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full h-8.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                      d="M6 18L18 6M6 6l12 12"
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
  );
}
