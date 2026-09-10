// src/app/components/ui/ToastModal.jsx
'use client';

import { useToastStore } from '@/app/stores/useToastStore';

/**
 * =========================================================================
 * Component: ToastModal
 * หมวดหมู่: ui/
 * หน้าที่: แสดงการแจ้งเตือน 2 รูปแบบ
 * 1. Success Toast: แสดงกลางจอ 1.5 วินาที (กล่องดำทึบ + ไอคอนเครื่องหมายถูกสีขาว Minimalist)
 * 2. Error / Alert Modal: การ์ดสีขาวขอบคม + ปุ่มสีดำสนิท [CLOSE]
 * =========================================================================
 */
export function ToastModal() {
  // ดึงค่า State และ Action จาก useToastStore
  const successVisible = useToastStore((state) => state.successVisible);
  const successMessage = useToastStore((state) => state.successMessage);
  const errorVisible = useToastStore((state) => state.errorVisible);
  const errorMessage = useToastStore((state) => state.errorMessage);
  const hideError = useToastStore((state) => state.hideError);

  const confirmVisible = useToastStore((state) => state.confirmVisible);
  const confirmConfig = useToastStore((state) => state.confirmConfig);
  const hideConfirm = useToastStore((state) => state.hideConfirm);

  // ฟังก์ชันกดยืนยันใน Confirm Modal
  const handleConfirmAction = () => {
    hideConfirm();
    if (confirmConfig?.onConfirm) {
      confirmConfig.onConfirm();
    }
  };

  // ฟังก์ชันกดยกเลิกใน Confirm Modal
  const handleCancelAction = () => {
    hideConfirm();
    if (confirmConfig?.onCancel) {
      confirmConfig.onCancel();
    }
  };

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. แบบสำเร็จ: Success Toast (กล่องดำทึบ + เครื่องหมายถูกสีขาว)
          ───────────────────────────────────────────────────────────── */}
      {successVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <div className="bg-black/95 text-white rounded-lg p-6 sm:p-7 shadow-2xl flex flex-col items-center gap-3.5 max-w-xs w-full animate-scale pointer-events-auto border border-white/20">
            {/* วงกลมสีขาวไอคอนเครื่องหมายถูกสีดำ */}
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-md">
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            {/* ข้อความแจ้งเตือนความสำเร็จ */}
            <p className="text-sm font-bold text-center text-white leading-snug">
              {successMessage}
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. แบบข้อผิดพลาด / แจ้งเตือน: Error Alert Modal (การ์ดขาว + ปุ่มปิดสีดำ)
          ───────────────────────────────────────────────────────────── */}
      {errorVisible && (
        <div data-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-sm w-full mx-auto flex flex-col items-center text-center gap-6 border border-stone-200 animate-scale">
            {/* ข้อความแจ้งเตือน */}
            <p className="text-sm sm:text-base font-semibold text-black leading-relaxed pt-2">
              {errorMessage}
            </p>

            {/* ปุ่มกดปิดสีดำ [CLOSE] */}
            <button
              type="button"
              onClick={hideError}
              className="bg-black hover:bg-neutral-800 active:bg-neutral-900 text-white font-bold text-xs sm:text-sm px-7 py-2.5 rounded-md flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 uppercase tracking-wide"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>CLOSE</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. แบบยืนยันการทำรายการ: Confirmation Modal (Format เดียวกับหน้า Approvals)
          ───────────────────────────────────────────────────────────── */}
      {confirmVisible && confirmConfig && (
        <div data-modal="true" className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 font-sans animate-scale">
            <div>
              <h4 className="text-sm font-bold text-stone-800">
                {confirmConfig.title || 'ยืนยันการทำรายการ'}
              </h4>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                {confirmConfig.message}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleCancelAction}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                {confirmConfig.cancelText || 'ยกเลิก'}
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-white text-xs font-medium rounded-md transition-colors shadow-xs cursor-pointer ${
                  confirmConfig.confirmColor === 'green'
                    ? 'bg-[#2e7d32] hover:bg-[#1b5e20]'
                    : confirmConfig.confirmColor === 'dark'
                    ? 'bg-[#2B2F38] hover:bg-[#1E2229]'
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                }`}
              >
                {confirmConfig.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
