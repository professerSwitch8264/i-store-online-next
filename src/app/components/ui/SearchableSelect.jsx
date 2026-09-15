// src/app/components/ui/SearchableSelect.jsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  RiArrowDownSLine,
  RiSearchLine,
  RiCloseLine,
  RiCheckLine,
} from 'react-icons/ri';

/**
 * =========================================================================
 * Component: SearchableSelect
 * =========================================================================
 * คุณสมบัติ:
 * 1. สไตล์ Outlined Floating Label ตามมาตรฐานของระบบ
 * 2. เมนูดรอปดาวน์สีขาว มนสวยงาม (rounded-lg) พร้อมเงา (shadow-2xl)
 * 3. ใช้ React Portal (createPortal) ลอยอยู่เหนือการ์ด/Modal ทุกชนิด (Zero clipping)
 * 4. ช่องค้นหา (Sticky Search) ที่ด้านบนสุดของดรอปดาวน์ พร้อมไอคอนแว่นขยาย
 * 5. จำกัดความสูง (max-h-56) และมี Scrollbar ไม่ดีดล้นหน้าจอ
 * 6. ปิดอัตโนมัติเมื่อคลิกนอกพื้นที่ (Click Outside) หรือกดปุ่ม Escape
 * 7. รองรับทั้ง props `options={[{ value, label, ... }]}` หรือ `<option>` children
 * 8. ปรับทิศทางการเปิดอัตโนมัติ (เปิดขึ้นบนเมื่อติดขอบล่างของหน้าจอ)
 * =========================================================================
 */
export function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  children,
  placeholder = 'เลือกรายการ...',
  disabled = false,
  readOnly = false,
  required = false,
  error = false,
  prefix,
  suffix,
  className = '',
  popoverClassName = '',
  height = 'h-12',
  searchable = true,
  searchPlaceholder = 'ค้นหา...',
  name,
  id,
  uppercase = false,
  ...rest
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    width: 0,
    openUpward: false,
    maxHeight: 240,
  });

  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const isInteractive = !disabled && !readOnly;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. รวมตัวเลือกจาก props.options และ children (<option>)
  const normalizedOptions = useMemo(() => {
    let list = [];

    if (Array.isArray(options) && options.length > 0) {
      list = options.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return {
            value: item.value !== undefined ? String(item.value) : '',
            rawValue: item.value,
            label: item.label !== undefined ? String(item.label) : String(item.value ?? ''),
            sublabel: item.sublabel,
            disabled: Boolean(item.disabled),
            hidden: Boolean(item.hidden),
            icon: item.icon,
          };
        }
        return {
          value: String(item),
          rawValue: item,
          label: String(item),
          disabled: false,
          hidden: false,
        };
      });
    } else if (children) {
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
          const optValue = child.props.value !== undefined ? String(child.props.value) : '';
          const optLabel = child.props.children
            ? (typeof child.props.children === 'string'
                ? child.props.children
                : String(child.props.children))
            : optValue;

          list.push({
            value: optValue,
            rawValue: child.props.value,
            label: optLabel,
            disabled: Boolean(child.props.disabled),
            hidden: Boolean(child.props.hidden),
          });
        }
      });
    }

    return list;
  }, [options, children]);

  // หา Option ที่กำลังเลือกอยู่
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return null;
    const strVal = String(value);
    return normalizedOptions.find((opt) => opt.value === strVal) || null;
  }, [value, normalizedOptions]);

  // ข้อความ Placeholder เมื่อยังไม่ได้เลือก
  const displayPlaceholder = useMemo(() => {
    if (placeholder && placeholder !== 'เลือกรายการ...') return placeholder;
    const hiddenOpt = normalizedOptions.find((opt) => opt.hidden && opt.value === '');
    if (hiddenOpt) return hiddenOpt.label;
    if (placeholder) return placeholder;
    if (typeof label === 'string') return `เลือก${label.replace('*', '').trim()}...`;
    return 'เลือกรายการ...';
  }, [placeholder, normalizedOptions, label]);

  // ตัวเลือกที่แสดงหลังการค้นหา (Filter)
  const filteredOptions = useMemo(() => {
    const activeList = normalizedOptions.filter((opt) => !opt.hidden);
    if (!searchQuery.trim()) return activeList;

    const query = searchQuery.trim().toLowerCase();
    return activeList.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSub = opt.sublabel ? opt.sublabel.toLowerCase().includes(query) : false;
      const matchVal = opt.value.toLowerCase().includes(query);
      return matchLabel || matchSub || matchVal;
    });
  }, [normalizedOptions, searchQuery]);

  // คำนวณพิกัดและทิศทางการเปิด (Floating Coordinates)
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // ถ้าข้างล่างเหลือน้อยกว่า 250px และข้างบนมีที่มากกว่า ให้เปิดขึ้นบน
    const shouldOpenUpward = spaceBelow < 250 && spaceAbove > spaceBelow;
    const availableHeight = shouldOpenUpward
      ? Math.max(120, Math.min(240, spaceAbove - 16))
      : Math.max(120, Math.min(240, spaceBelow - 16));

    setCoords({
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
      width: rect.width,
      openUpward: shouldOpenUpward,
      maxHeight: availableHeight,
    });
  }, []);

  // เปิด/ปิด Dropdown
  const handleToggle = () => {
    if (!isInteractive) return;

    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
      setSearchQuery('');
      // โฟกัสไปที่ช่องค้นหา
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setIsOpen(false);
    }
  };

  // อัปเดตพิกัดเมื่อมีการเลื่อนหน้าจอ (Scroll) หรือย่อขยายหน้าต่าง (Resize)
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // ดักจับการคลิกนอกพื้นที่ (Click Outside) และปุ่ม Escape
  useEffect(() => {
    function handleClickOutside(e) {
      const isInsideContainer = containerRef.current && containerRef.current.contains(e.target);
      const isInsidePopover = popoverRef.current && popoverRef.current.contains(e.target);

      if (!isInsideContainer && !isInsidePopover) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
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

  // ฟังก์ชันเลือกรายการ
  const handleSelectOption = (opt) => {
    if (opt.disabled) return;

    if (onChange) {
      // สร้าง Synthetic Event ให้เหมือน native onChange
      const syntheticEvent = {
        target: {
          name: name || id || '',
          value: opt.rawValue !== undefined ? opt.rawValue : opt.value,
        },
      };
      onChange(syntheticEvent);
    }

    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      {...rest}
    >
      {/* ─────────────────────────────────────────────────────────────
          กล่องหลัก (Trigger Box สไตล์ Outlined Floating Label)
          ───────────────────────────────────────────────────────────── */}
      <div
        onClick={handleToggle}
        className={`w-full ${height} px-3.5 border rounded-md flex items-center justify-between transition-all cursor-pointer ${
          !isInteractive
            ? 'bg-stone-100 border-stone-200 cursor-not-allowed text-stone-400'
            : error
            ? 'bg-white border-rose-400 ring-1 ring-rose-400/30'
            : isOpen
            ? 'bg-white border-[#2B2F38] ring-2 ring-[#2B2F38]/10'
            : 'bg-white border-stone-300 hover:border-stone-400'
        }`}
      >
        {/* Floating Label คาดขอบบน */}
        {label && (
          <span
            className={`absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs font-normal leading-none pointer-events-none transition-colors ${
              error
                ? 'text-rose-500'
                : isOpen
                ? 'text-[#2B2F38] font-medium'
                : 'text-stone-500'
            }`}
          >
            {label}
            {required && !String(label).includes('*') && (
              <span className="text-rose-500 ml-0.5">*</span>
            )}
          </span>
        )}

        {/* เนื้อหาด้านซ้าย: Prefix + ข้อความที่เลือก */}
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {prefix && (
            <div className="shrink-0 flex items-center text-stone-400">
              {prefix}
            </div>
          )}

          <div className="truncate text-xs sm:text-sm font-normal">
            {selectedOption && !selectedOption.hidden ? (
              <span className={`text-stone-800 ${uppercase ? 'uppercase' : ''}`}>
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-stone-400">{displayPlaceholder}</span>
            )}
          </div>
        </div>

        {/* ด้านขวา: Suffix + ลูกศร Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          {suffix && <div className="text-stone-500 text-xs">{suffix}</div>}

          <RiArrowDownSLine
            className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180 text-[#2B2F38]' : ''
            }`}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          หน้าต่าง Dropdown Popover เมนูตัวเลือก (Portal ลอยเหนือการ์ด/Modal)
          ───────────────────────────────────────────────────────────── */}
      {isOpen && isInteractive && mounted && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              ...(coords.openUpward
                ? { bottom: `${coords.bottom}px` }
                : { top: `${coords.top}px` }),
              zIndex: 99999,
            }}
            className={`bg-white border border-stone-200 rounded-lg shadow-2xl overflow-hidden animate-fadeIn text-[#2B2F38] ${popoverClassName}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ส่วนบนสุด: ช่องค้นหา (Sticky Search) */}
            {searchable && normalizedOptions.length > 3 && (
              <div className="p-1.5 border-b border-stone-100 bg-stone-50/70 sticky top-0 z-10">
                <div className="relative flex items-center">
                  <RiSearchLine className="w-3.5 h-3.5 text-stone-400 absolute left-2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-white border border-stone-200 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#2B2F38]/20 rounded-md pl-7 pr-6 py-1 text-xs text-[#2B2F38] placeholder-stone-400 outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-1.5 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                    >
                      <RiCloseLine className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* รายการตัวเลือก (Scrollable Options List) */}
            <div
              ref={listRef}
              style={{ maxHeight: `${coords.maxHeight}px` }}
              className="overflow-y-auto divide-y divide-stone-50 py-1"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-4 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-1.5">
                  <RiSearchLine className="w-5 h-5 text-stone-300" />
                  <span>ไม่พบข้อมูลที่ตรงกับ &quot;{searchQuery}&quot;</span>
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selectedOption?.value === opt.value;

                  return (
                    <div
                      key={opt.value || opt.label}
                      onClick={() => handleSelectOption(opt)}
                      className={`px-3 py-2.5 text-xs sm:text-sm flex items-center justify-between transition-colors ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed bg-stone-50'
                          : isSelected
                          ? 'bg-stone-100/90 text-[#2B2F38] font-medium cursor-pointer'
                          : 'text-stone-700 hover:bg-stone-50 hover:text-[#2B2F38] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {opt.icon && (
                          <span className="shrink-0 text-stone-400">{opt.icon}</span>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className={`truncate ${opt.value === '' ? 'text-stone-500 font-normal' : ''}`}>
                            {opt.label}
                          </span>
                          {opt.sublabel && (
                            <span className="text-[11px] text-stone-400 truncate">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && opt.value !== '' && (
                        <RiCheckLine className="w-4 h-4 text-[#2B2F38] shrink-0 ml-2 font-bold" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}

export default SearchableSelect;
