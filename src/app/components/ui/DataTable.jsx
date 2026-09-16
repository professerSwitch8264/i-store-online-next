// src/app/components/ui/DataTable.jsx
'use client';

import React from 'react';
import { RiLoader4Line, RiInboxLine, RiArrowUpSLine, RiArrowDownSLine } from 'react-icons/ri';
import { HiSelector } from 'react-icons/hi';
import TablePagination from './TablePagination';

/**
 * =========================================================================
 * Component: DataTable (ตารางมาตรฐานระบบ พร้อมล็อกความสูงคอลัมน์/แถว)
 * =========================================================================
 * คุณสมบัติ:
 * 1. ล็อกความสูงแถวและคอลัมน์คงที่ (Fixed row height เช่น h-14, h-16)
 * 2. Sticky Header ความสูงคงที่ (h-11) พร้อมเงา shadow-2xs
 * 3. จัดกึ่งกลางแนวตั้งเสมอ (align-middle / items-center)
 * 4. รองรับข้อความยาวด้วย truncate / line-clamp ป้องกันการดันตารางยืด
 * 5. รองรับ Sorting คอลัมน์ (Sortable header with indicator)
 * 6. รองรับ Loading State (Spinner ในตาราง)
 * 7. รองรับ Empty State (Custom Icon, Title, Description)
 * 8. ฝังแถบ Pagination ด้านล่างตารางในตัว
 * =========================================================================
 */
export function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  loading = false,
  loadingText = 'กำลังโหลดข้อมูล...',
  emptyState = null,
  rowHeight = 'h-14',
  headerHeight = 'h-11',
  maxHeight = 'calc(100vh - 320px)',
  minWidth = 'min-w-[35rem]',
  sortField,
  sortDirection = 'asc',
  onSort,
  onRowClick,
  pagination,
  className = '',
  containerClassName = '',
}) {
  // ฟังก์ชันหาค่า key ของแต่ละแถว
  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') {
      return rowKey(row, index);
    }
    return row[rowKey] !== undefined ? row[rowKey] : index;
  };

  // เรนเดอร์ไอคอน Sort ในหัวตาราง
  const renderSortIndicator = (col) => {
    if (!col.sortable) return null;
    const isSorted = sortField === col.key;

    if (isSorted) {
      return sortDirection === 'asc' ? (
        <RiArrowUpSLine className="w-4 h-4 text-[#2B2F38] shrink-0" />
      ) : (
        <RiArrowDownSLine className="w-4 h-4 text-[#2B2F38] shrink-0" />
      );
    }

    return <HiSelector className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 shrink-0 transition-colors" />;
  };

  // เรนเดอร์ Empty State
  const renderEmptyContent = () => {
    if (React.isValidElement(emptyState)) {
      return emptyState;
    }

    const Icon = emptyState?.icon || RiInboxLine;
    const title = emptyState?.title || 'ไม่มีข้อมูลที่จะแสดง';
    const description = emptyState?.description || null;

    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-stone-500">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-[#2B2F38]">{title}</p>
        {description && <p className="text-xs text-stone-500 max-w-sm">{description}</p>}
      </div>
    );
  };

  return (
    <div className={`w-full bg-white flex flex-col ${containerClassName}`}>
      {/* 1. ส่วนตารางที่ Scroll ได้และล็อกความสูง */}
      <div
        style={{ maxHeight }}
        className={`overflow-x-auto overflow-y-auto w-full border-t border-stone-200 ${className}`}
      >
        <table className={`w-full text-left text-xs sm:text-sm border-collapse ${minWidth}`}>
          {/* Header */}
          <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
            <tr className={headerHeight}>
              {columns.map((col) => {
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left';

                const justifyClass =
                  col.align === 'center'
                    ? 'justify-center'
                    : col.align === 'right'
                    ? 'justify-end'
                    : 'justify-start';

                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && onSort && onSort(col.key)}
                    style={{ width: col.width }}
                    className={`py-2 px-4 font-normal text-[#363636] bg-white whitespace-nowrap align-middle ${alignClass} ${
                      col.width ? col.width : ''
                    } ${col.sortable ? 'cursor-pointer hover:bg-stone-50 transition-colors group' : ''} ${
                      col.headerClassName || ''
                    }`}
                    title={col.sortable ? `คลิกเพื่อเรียงตาม ${typeof col.label === 'string' ? col.label : ''}` : undefined}
                  >
                    <div className={`inline-flex items-center gap-1 w-full ${justifyClass}`}>
                      <span>{col.label}</span>
                      {renderSortIndicator(col)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-stone-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-stone-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RiLoader4Line className="w-6 h-6 animate-spin text-stone-400" />
                    <span className="text-xs">{loadingText}</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{renderEmptyContent()}</td>
              </tr>
            ) : (
              data.map((row, rowIndex) => {
                const key = getRowKey(row, rowIndex);
                const isClickable = Boolean(onRowClick);

                return (
                  <tr
                    key={key}
                    onClick={() => isClickable && onRowClick(row, rowIndex)}
                    className={`${rowHeight} hover:bg-stone-50/70 transition-colors ${
                      isClickable ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                          ? 'text-right'
                          : 'text-left';

                      return (
                        <td
                          key={col.key}
                          style={{ width: col.width }}
                          className={`px-4 py-2 align-middle ${alignClass} ${col.width || ''} ${
                            col.className || ''
                          }`}
                        >
                          {col.render ? (
                            col.render(row, rowIndex)
                          ) : (
                            <span
                              className="truncate block"
                              title={row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : ''}
                            >
                              {row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 2. ส่วน Pagination ด้านล่าง */}
      {pagination && (
        <TablePagination
          page={pagination.page}
          totalCount={pagination.totalCount}
          rowsPerPage={pagination.rowsPerPage}
          rowsPerPageOptions={pagination.rowsPerPageOptions}
          onPageChange={pagination.onPageChange}
          onRowsPerPageChange={pagination.onRowsPerPageChange}
          loading={loading || pagination.loading}
          className={pagination.className}
        />
      )}
    </div>
  );
}

export default DataTable;
