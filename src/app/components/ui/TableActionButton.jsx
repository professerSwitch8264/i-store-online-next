// src/app/components/ui/TableActionButton.jsx
'use client';

import React from 'react';
import { RiEdit2Line, RiDeleteBinLine, RiEyeLine, RiPlayListAddLine } from 'react-icons/ri';
import { MdViewKanban } from 'react-icons/md';

/**
 * =========================================================================
 * Component: TableActionButton (ปุ่มจัดการในตารางมาตรฐาน)
 * =========================================================================
 * Props:
 * - icon: 'edit' | 'delete' | 'view' | 'kanban' | 'receive' | React.ReactNode (ไอคอน)
 * - variant: 'default' | 'amber' | 'blue' | 'rose' | 'disabled' (ชุดสี)
 * - onClick: (e: MouseEvent) => void (ฟังก์ชันเมื่อกดปุ่ม)
 * - disabled: boolean
 * - title: string (ข้อความ tooltip)
 * - size: string (ขนาดปุ่ม ค่าเริ่มต้น 'w-8 h-8')
 * =========================================================================
 */
export function TableActionButton({
  icon = 'edit',
  variant = 'default',
  onClick,
  disabled = false,
  title = '',
  size = 'w-8 h-8',
  className = '',
}) {
  const getIcon = () => {
    if (typeof icon !== 'string') return icon;

    switch (icon) {
      case 'edit':
        return <RiEdit2Line className="w-4.5 h-4.5" />;
      case 'delete':
        return <RiDeleteBinLine className="w-4.5 h-4.5" />;
      case 'view':
        return <RiEyeLine className="w-4.5 h-4.5" />;
      case 'kanban':
        return <MdViewKanban className="w-5.5 h-5.5" />;
      case 'receive':
        return <RiPlayListAddLine className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getVariantClasses = () => {
    if (disabled) {
      return 'text-stone-300 cursor-not-allowed';
    }

    switch (variant) {
      case 'blue':
        return 'text-[#2B2F38] hover:text-[#2563EB] hover:bg-blue-50 active:bg-blue-100 cursor-pointer';
      case 'rose':
        return 'text-[#2B2F38] hover:text-[#DC2626] hover:bg-rose-50 active:bg-rose-100 cursor-pointer';
      case 'amber':
        return 'text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 cursor-pointer';
      case 'default':
      default:
        // Auto select by icon type if default variant
        if (icon === 'delete') {
          return 'text-[#2B2F38] hover:text-[#DC2626] hover:bg-rose-50 active:bg-rose-100 cursor-pointer';
        }
        if (icon === 'edit') {
          return 'text-[#2B2F38] hover:text-[#2563EB] hover:bg-blue-50 active:bg-blue-100 cursor-pointer';
        }
        return 'text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 cursor-pointer';
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title={title}
      className={`${size} inline-flex items-center justify-center rounded-md transition-colors ${getVariantClasses()} ${className}`}
    >
      {getIcon()}
    </button>
  );
}

export default TableActionButton;
