// src/app/components/ui/QuantityStepper.jsx
'use client';

import { useState } from 'react';

/**
 * Component: QuantityStepper (ปุ่มปรับและช่องกรอกตัวเลขจำนวนสินค้า)
 * หน้าที่: ปรับเพิ่ม-ลดจำนวนตาม Batch Size, ตรวจสอบขอบเขต Min/Max,
 * ปัดเศษตัวเลขที่พิมพ์ด้วยมือให้ลงตัวกับขนาดชุดสินค้า
 *
 * @param {number} value - ค่าตัวเลขปัจจุบันที่ส่งมาจากภายนอก
 * @param {number} step - จำนวนการเพิ่ม-ลดต่อครั้ง (เช่น ขายทีละกล่อง กล่องละ 12 ชิ้น -> step = 12)
 * @param {number} min - จำนวนขั้นต่ำที่ยอมให้กดได้
 * @param {number} max - จำนวนสูงสุดที่ยอมให้กดได้ (อิงตามสต็อกคงเหลือ หรือ order_limit)
 * @param {boolean} disabled - ปิดการใช้งานปุ่ม (เมื่อสินค้าหมด)
 * @param {boolean} loading - สถานะกำลังยิง API (แสดงไอคอนหมุนๆ แทนตัวเลข และล็อคปุ่มทั้งหมด)
 * @param {function} onChange - ฟังก์ชัน Callback ส่งค่าตัวเลขใหม่กลับไปอัปเดตภายนอก
 * @param {function} onLimitReached - ฟังก์ชัน Callback เตือนเมื่อชนเพดาน ('min' หรือ 'max')
 * @param {string} className - คลาส CSS เพิ่มเติม
 */
export function QuantityStepper({
  value,
  step = 1,
  min,
  max = 999999,
  disabled = false,
  loading = false,
  onChange,
  onLimitReached,
  className = '',
}) {
  // stepVal: การันตีว่าการเพิ่ม-ลดต้องมีค่าอย่างน้อย 1 เสมอ ป้องกันการบวก/ลบ 0
  const stepVal = Math.max(1, step || 1);

  // minVal: ค่าต่ำสุดที่อนุญาต (ถ้าไม่ระบุ min จะใช้ค่าเท่ากับ stepVal เป็นขั้นต่ำ)
  const minVal = min !== undefined ? min : stepVal;

  // maxMultiple: คำนวณเพดานสูงสุดจริงที่ "หารด้วย Batch Size ลงตัว" (เศษสต็อกไม่พอชุดจะไม่ให้สั่ง)
  const maxMultiple = Math.floor(max / stepVal) * stepVal;

  // maxAllowed: เพดานสูงสุดจริงที่ระบบยอมให้กดได้
  const maxAllowed = maxMultiple >= minVal ? maxMultiple : max;

  // prevValue: บันทึกค่า props value ล่าสุดจากภายนอก เพื่อตรวจว่าภายนอกสั่งเปลี่ยนค่าจริงหรือไม่
  const [prevValue, setPrevValue] = useState(value);

  // localVal: State เก็บตัวเลขที่กำลังพิมพ์หรือแสดงในช่อง Input ชั่วคราว
  const [localVal, setLocalVal] = useState(value);

  // ซิงค์ค่าตัวเลขในช่อง Input เมื่อค่า props value "จากภายนอก" มีการเปลี่ยนแปลงเท่านั้น
  // (จะไม่รีเซ็ตระหว่างที่ผู้ใช้กำลังใช้มือพิมพ์ตัวเลขข้างใน)
  if (prevValue !== value) {
    setPrevValue(value);
    setLocalVal(value);
  }

  // 1. ฟังก์ชันลดจำนวน (-)
  const handleDecrease = () => {
    if (disabled) return;
    // cur: แปลงค่าปัจจุบันเป็นตัวเลข
    const cur = typeof localVal === 'number' ? localVal : parseInt(localVal, 10) || minVal;

    // ถ้าแตะค่าต่ำสุดแล้ว ไม่ให้ลดต่อ พร้อมส่งสัญญาณ 'min' เตือน component แม่
    if (cur <= minVal) {
      if (onLimitReached) onLimitReached('min');
      return;
    }

    // newVal: ค่าใหม่หลังลดลงทีละ stepVal
    const newVal = Math.max(cur - stepVal, minVal);
    setLocalVal(newVal);
    if (onChange) onChange(newVal);
  };

  // 2. ฟังก์ชันเพิ่มจำนวน (+)
  const handleIncrease = () => {
    if (disabled) return;
    // cur: แปลงค่าปัจจุบันเป็นตัวเลข
    const cur = typeof localVal === 'number' ? localVal : parseInt(localVal, 10) || minVal;

    // ถ้าแตะเพดานสูงสุดแล้ว ไม่ให้เพิ่มต่อ พร้อมส่งสัญญาณ 'max' เตือน component แม่
    if (cur >= maxAllowed) {
      if (onLimitReached) onLimitReached('max');
      return;
    }

    // newVal: ค่าใหม่หลังเพิ่มขึ้นทีละ stepVal (ไม่เกิน maxAllowed)
    const newVal = Math.min(cur + stepVal, maxAllowed);
    setLocalVal(newVal);
    if (onChange) onChange(newVal);
  };

  // 3. ฟังก์ชันเมื่อผู้ใช้ใช้มือพิมพ์ตัวเลขลงในช่อง Input
  const handleInputChange = (e) => {
    const text = e.target.value;
    // ถ้าลบตัวเลขจนว่าง ให้เคลียร์ช่องไว้ก่อนเพื่อรอพิมพ์ตัวใหม่
    if (text === '') {
      setLocalVal('');
      return;
    }
    const val = parseInt(text, 10);
    if (isNaN(val)) return;

    // ถ้าพิมพ์เกินเพดานสูงสุด ให้ดึงกลับมาที่ค่า maxAllowed ทันที
    if (val > maxAllowed) {
      setLocalVal(maxAllowed);
      if (onLimitReached) onLimitReached('max');
    } else {
      setLocalVal(val);
    }
  };

  // 4. ฟังก์ชันเมื่อผู้ใช้คลิกออกนอกช่อง (Blur) หรือกด Enter
  // ทำการปัดเศษตัวเลขลง (Math.floor) เสมอให้ลงล็อกกับ Batch Size
  const handleBlur = () => {
    let raw = typeof localVal === 'number' ? localVal : parseInt(localVal, 10);
    if (isNaN(raw) || raw < minVal) {
      raw = minVal;
    }

    // finalVal: ปัดเศษตัวเลขลงให้ลงตัวกับ stepVal เช่น พิมพ์ 15 ในของที่ขายทีละ 12 จะปัดเป็น 12
    let finalVal = Math.floor(raw / stepVal) * stepVal;
    if (finalVal < minVal) finalVal = minVal;
    if (finalVal > maxAllowed) finalVal = maxAllowed;

    setLocalVal(finalVal);
    if (finalVal !== value && onChange) {
      onChange(finalVal);
    }
  };

  // 5. ฟังก์ชันเมื่อผู้ใช้กดปุ่ม Enter ในช่อง Input ให้ยืนยันค่าและนำโฟกัสออกจากช่อง
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
      e.currentTarget.blur();
    }
  };

  // isMin, isMax: ตรวจสถานะว่าแตะขอบเขตแล้วหรือยัง เพื่อปิดการคลิกปุ่ม (disabled)
  const isMin = Number(localVal) <= minVal;
  const isMax = Number(localVal) >= maxAllowed;

  return (
    <div
      className={`flex items-center border border-stone-300 rounded-md overflow-hidden bg-white shadow-2xs shrink-0 ${
        disabled || loading ? 'opacity-80' : ''
      } ${className}`}
    >
      {/* ปุ่มลด (-) */}
      <button
        type="button"
        disabled={disabled || loading}
        aria-disabled={isMin}
        onClick={handleDecrease}
        className={`w-6 sm:w-7 h-6.5 sm:h-7 flex items-center justify-center text-xs font-bold transition-colors border-r border-stone-200 ${
          disabled || loading || isMin
            ? 'opacity-30 cursor-not-allowed text-stone-400 bg-stone-50'
            : 'text-black hover:bg-stone-100 active:bg-stone-200 cursor-pointer'
        }`}
        title={loading ? 'กำลังอัปเดต...' : isMin ? `จำนวนต่ำสุดคือ ${minVal}` : 'ลดจำนวน'}
      >
        <span>&minus;</span>
      </button>

      {/* ช่องกรอกตัวเลข หรือ ไอคอนหมุนๆ ตอนกำลังยิง API */}
      {loading ? (
        <div
          className="w-7 sm:w-10 h-6.5 sm:h-7 flex items-center justify-center bg-stone-50 text-stone-600 select-none cursor-wait"
          title="กำลังอัปเดตจำนวน..."
        >
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin text-[#2B2F38]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <input
          type="number"
          min={minVal}
          max={max}
          step={stepVal}
          value={localVal}
          disabled={disabled || loading}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-7 sm:w-10 h-6.5 sm:h-7 text-center text-[11px] sm:text-xs font-bold text-black bg-transparent focus:outline-none focus:bg-stone-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0.5"
        />
      )}

      {/* ปุ่มเพิ่ม (+) */}
      <button
        type="button"
        disabled={disabled || loading}
        aria-disabled={isMax}
        onClick={handleIncrease}
        className={`w-6 sm:w-7 h-6.5 sm:h-7 flex items-center justify-center text-xs font-bold transition-colors border-l border-stone-200 ${
          disabled || loading || isMax
            ? 'opacity-30 cursor-not-allowed text-stone-400 bg-stone-50'
            : 'text-black hover:bg-stone-100 active:bg-stone-200 cursor-pointer'
        }`}
        title={loading ? 'กำลังอัปเดต...' : isMax ? `จำนวนสูงสุดคือ ${maxAllowed}` : 'เพิ่มจำนวน'}
      >
        <span>+</span>
      </button>
    </div>
  );
}