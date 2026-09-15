// src/app/components/ui/TablePagination.jsx
'use client';

/**
 * =========================================================================
 * Component: TablePagination (แถบแบ่งหน้าสำหรับตารางสไตล์มาตรฐานระบบ)
 * =========================================================================
 * คุณสมบัติ:
 * 1. Rows per page selector ([5, 10, 25, 50, 100])
 * 2. Range indicator text (เช่น "1–10 of 16" หรือ "0 of 0")
 * 3. ปุ่ม Navigation ควบคุมหน้า: [ |< หน้าแรก ] [ < ก่อนหน้า ] [ > ถัดไป ] [ >| หน้าสุดท้าย ]
 * 4. รองรับ disabled อัตโนมัติตามสถานะ loading และขอบเขตหน้าแรก/หน้าสุดท้าย
 * =========================================================================
 */
export function TablePagination({
  page = 1,
  totalCount = 0,
  rowsPerPage = 10,
  rowsPerPageOptions = [5, 10, 25, 50, 100],
  onPageChange,
  onRowsPerPageChange,
  loading = false,
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endIndex = Math.min(page * rowsPerPage, totalCount);

  const handleFirst = () => {
    if (page > 1 && !loading && onPageChange) {
      onPageChange(1);
    }
  };

  const handlePrev = () => {
    if (page > 1 && !loading && onPageChange) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages && !loading && onPageChange) {
      onPageChange(page + 1);
    }
  };

  const handleLast = () => {
    if (page < totalPages && !loading && onPageChange) {
      onPageChange(totalPages);
    }
  };

  return (
    <div
      className={`border-t border-[#D3D3D3] px-3 sm:px-4 py-2.5 flex items-center justify-between sm:justify-end gap-2 sm:gap-6 text-xs text-[#363636]/80 select-none bg-white shrink-0 flex-wrap sm:flex-nowrap ${className}`}
    >
      {/* 1. Rows per page Selector */}
      <div className="flex items-center gap-2">
        <span className="font-normal text-[#363636]/70">Rows per page:</span>
        <div className="relative">
          <select
            value={rowsPerPage}
            disabled={loading}
            onChange={(e) => onRowsPerPageChange && onRowsPerPageChange(Number(e.target.value))}
            className="bg-transparent text-xs font-normal text-[#363636] py-1 pl-2 pr-6 border-b border-stone-300 focus:outline-none cursor-pointer appearance-none disabled:opacity-50"
          >
            {rowsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <svg
            className="w-3 h-3 text-stone-600 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 2. ข้อมูลช่วง Range เช่น 1–10 of 16 */}
      <div className="font-normal text-[#363636]/90 min-w-[4.5rem] text-center sm:text-left">
        {totalCount === 0 ? '0 of 0' : `${startIndex}–${endIndex} of ${totalCount}`}
      </div>

      {/* 3. ปุ่ม Navigation |<  <  >  >| */}
      <div className="flex items-center gap-1">
        {/* หน้าแรกสุด |< */}
        <button
          type="button"
          onClick={handleFirst}
          disabled={page <= 1 || loading}
          className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
          title="หน้าแรกสุด"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* หน้าก่อนหน้า < */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={page <= 1 || loading}
          className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
          title="หน้าก่อนหน้า"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* หน้าถัดไป > */}
        <button
          type="button"
          onClick={handleNext}
          disabled={page >= totalPages || loading}
          className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
          title="หน้าถัดไป"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* หน้าสุดท้าย >| */}
        <button
          type="button"
          onClick={handleLast}
          disabled={page >= totalPages || loading}
          className="w-7 h-7 flex items-center justify-center border border-stone-300 bg-white text-[#2B2F38] hover:bg-stone-50 hover:border-[#2B2F38] disabled:opacity-25 disabled:pointer-events-none rounded-none transition-all cursor-pointer"
          title="หน้าสุดท้าย"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
