// src/app/components/ui/OutlinedField.jsx
'use client';

import { RiArrowDownSLine } from 'react-icons/ri';

/**
 * =========================================================================
 * Component: OutlinedField (ฟิลด์กรอกข้อมูลสไตล์ Outlined Floating Label)
 * =========================================================================
 * คุณสมบัติ:
 * 1. Floating Label คาดเส้นขอบบนกล่อง
 * 2. รองรับ ReadOnly / Disabled (พื้นหลังเทา bg-stone-100 ล็อกแก้ไข)
 * 3. รองรับ Input (text, number, date ฯลฯ)
 * 4. รองรับ Select Dropdown พร้อมไอคอนลูกศรมาตรฐาน
 * 5. รองรับ Prefix (ไอคอน / ข้อความนำหน้า เช่น ABC, $, ไอคอนต่าง ๆ)
 * 6. รองรับ Suffix (หน่วยนับด้านหลัง เช่น อัน, ชิ้น, ไอคอนโหลด ฯลฯ)
 * =========================================================================
 */
export function OutlinedField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  disabled = false,
  readOnly = false,
  required = false,
  prefix,
  suffix,
  children,
  className = '',
  inputClassName = '',
  uppercase = false,
  error = false,
  height = 'h-12',
  ...rest
}) {
  const isReadOnlyOrDisabled = disabled || readOnly;
  const isSelect = type === 'select';

  return (
    <div
      className={`relative border rounded-md px-3.5 ${height} flex items-center transition-all ${
        isReadOnlyOrDisabled
          ? 'bg-stone-100 border-stone-200 cursor-not-allowed select-none'
          : error
          ? 'bg-white border-rose-400 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/20'
          : 'bg-white border-stone-300 focus-within:border-[#2B2F38] focus-within:ring-1 focus-within:ring-[#2B2F38]/20'
      } ${className}`}
    >
      {/* Floating Label */}
      {label && (
        <span
          className={`absolute -top-2.5 left-2.5 bg-white px-1.5 text-xs font-normal leading-none pointer-events-none select-none ${
            error ? 'text-rose-500' : 'text-stone-500'
          }`}
        >
          {label}
          {required && !String(label).includes('*') && <span className="text-rose-500 ml-0.5">*</span>}
        </span>
      )}

      {/* Prefix (Left Icon / Text) */}
      {prefix && <div className="mr-2 shrink-0 flex items-center text-stone-400">{prefix}</div>}

      {/* Main Content Area */}
      {isReadOnlyOrDisabled && !children ? (
        <div className={`truncate w-full text-xs sm:text-sm font-normal text-stone-700 ${inputClassName}`}>
          {value !== undefined && value !== null && value !== '' ? String(value) : '-'}
        </div>
      ) : isSelect ? (
        <div className="relative w-full flex items-center">
          <select
            value={value ?? ''}
            onChange={onChange}
            disabled={disabled}
            className={`w-full bg-transparent outline-none text-xs sm:text-sm cursor-pointer appearance-none pr-5 font-normal ${
              value !== undefined && value !== null && value !== ''
                ? 'text-stone-800'
                : 'text-stone-400'
            } ${inputClassName}`}
            {...rest}
          >
            {children}
          </select>
          <RiArrowDownSLine className="w-3.5 h-3.5 text-stone-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : children ? (
        <div className="w-full flex items-center">{children}</div>
      ) : (
        <input
          type={type}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={`w-full bg-transparent outline-none text-sm text-stone-800 font-normal ${
            uppercase ? 'uppercase' : ''
          } ${inputClassName}`}
          {...rest}
        />
      )}

      {/* Suffix (Right Icon / Unit text) */}
      {suffix && <div className="ml-2 shrink-0 flex items-center text-stone-500">{suffix}</div>}
    </div>
  );
}

export default OutlinedField;
