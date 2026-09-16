// src/app/components/ui/ToggleSwitch.jsx
'use client';

import React from 'react';

/**
 * =========================================================================
 * Component: ToggleSwitch (สวิตช์เปิด/ปิดสถานะมาตรฐาน)
 * =========================================================================
 * Props:
 * - checked: boolean (สถานะเปิด/ปิด)
 * - onChange: (newChecked: boolean) => void (ฟังก์ชันเมื่อคลิกสลับสถานะ)
 * - disabled: boolean (ปิดการใช้งานระหว่าง loading หรือไม่มีสิทธิ์)
 * - title: string (ข้อความ tooltip)
 * - size: 'sm' | 'md' (ขนาดสวิตช์ ค่าเริ่มต้น 'md' คือ h-5 w-9)
 * - activeColor: string (สีพื้นหลังเมื่อเปิด ค่าเริ่มต้น 'bg-[#2B2F38]')
 * - inactiveColor: string (สีพื้นหลังเมื่อปิด ค่าเริ่มต้น 'bg-stone-300')
 * =========================================================================
 */
export function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  title,
  size = 'md',
  activeColor = 'bg-[#2B2F38]',
  inactiveColor = 'bg-stone-300',
  className = '',
}) {
  const isSm = size === 'sm';

  const trackSize = isSm ? 'h-4 w-7' : 'h-5 w-9';
  const thumbSize = isSm ? 'h-3 w-3' : 'h-4 w-4';
  const translateActive = isSm ? 'translate-x-3' : 'translate-x-4';

  const defaultTitle = title || (checked ? 'คลิกเพื่อปิดการใช้งาน' : 'คลิกเพื่อเปิดการใช้งาน');

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      title={defaultTitle}
      className={`relative inline-flex ${trackSize} shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#EB6E3E] disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? activeColor : inactiveColor
      } ${className}`}
    >
      <span
        className={`pointer-events-none inline-block ${thumbSize} transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? translateActive : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
