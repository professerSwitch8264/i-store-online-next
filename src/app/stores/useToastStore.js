// src/app/stores/useToastStore.js
import { create } from 'zustand';

/**
 * =========================================================================
 * Zustand Store: useToastStore
 * หน้าที่: จัดการ State การแจ้งเตือน Toast 2 รูปแบบ
 * 1. Success Toast: แสดงกลางจอ 1.5 วินาทีแล้วหายไปอัตโนมัติ (Monochrome Style)
 * 2. Error / Alert Modal: แสดงการ์ดสีขาวกลางจอ พร้อมปุ่มปิด [CLOSE]
 * =========================================================================
 */

// successTimer: ตัวแปรเก็บ Timer id สำหรับเคลียร์เวลานับถอยหลังของ Success Toast
let successTimer = null;

export const useToastStore = create((set) => ({
  // successVisible: สถานะการแสดงผล Toast สำเร็จ (true = กำลังแสดง, false = ซ่อน)
  successVisible: false,

  // successMessage: ข้อความที่ต้องการแสดงใน Toast สำเร็จ
  successMessage: 'ดำเนินการเรียบร้อยแล้ว',

  // errorVisible: สถานะการแสดงผล Modal ข้อผิดพลาด/แจ้งเตือน (true = กำลังแสดง, false = ซ่อน)
  errorVisible: false,

  // errorMessage: ข้อความแจ้งเตือนข้อผิดพลาด
  errorMessage: '',

  // confirmVisible: สถานะการแสดงผล Modal ยืนยันการทำรายการ (Confirmation Modal)
  confirmVisible: false,

  // confirmConfig: อ็อบเจกต์การตั้งค่า Modal ยืนยัน (หัวข้อ, ข้อความ, ปุ่ม, สีปุ่ม, Callback)
  confirmConfig: {
    title: 'ยืนยันการทำรายการ',
    message: '',
    confirmText: 'ยืนยัน',
    cancelText: 'ยกเลิก',
    confirmColor: 'red', // 'red' | 'green' | 'dark'
    onConfirm: null,
    onCancel: null,
  },

  /**
   * showSuccess: ฟังก์ชันแสดง Toast สำเร็จ 1.5 วินาที แล้วจะซ่อนไปเองอัตโนมัติ
   * @param {string} message - ข้อความแจ้งเตือน
   */
  showSuccess: (message = 'ดำเนินการเรียบร้อยแล้ว') => {
    if (successTimer) clearTimeout(successTimer);
    set({ successVisible: true, successMessage: message, errorVisible: false, confirmVisible: false });
    successTimer = setTimeout(() => {
      set({ successVisible: false });
    }, 1500);
  },

  /**
   * hideSuccess: ฟังก์ชันสั่งปิด Toast สำเร็จทันที
   */
  hideSuccess: () => {
    if (successTimer) clearTimeout(successTimer);
    set({ successVisible: false });
  },

  /**
   * showError: ฟังก์ชันแสดง Modal ข้อผิดพลาด ค้างไว้จนกว่าผู้ใช้จะกดปุ่มปิด
   * @param {string} message - ข้อความ Error หรือข้อความแจ้งเตือน
   */
  showError: (message) => {
    if (successTimer) clearTimeout(successTimer);
    set({ errorVisible: true, errorMessage: message, successVisible: false, confirmVisible: false });
  },

  /**
   * hideError: ฟังก์ชันสั่งปิด Modal ข้อผิดพลาด
   */
  hideError: () => {
    set({ errorVisible: false, errorMessage: '' });
  },

  /**
   * showConfirm: ฟังก์ชันเปิด Popup ถามยืนยันการทำรายการ (Format เดียวกับหน้า Approvals)
   */
  showConfirm: ({
    title = 'ยืนยันการทำรายการ',
    message = '',
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    confirmColor = 'red',
    onConfirm = null,
    onCancel = null,
  } = {}) => {
    if (successTimer) clearTimeout(successTimer);
    set({
      confirmVisible: true,
      confirmConfig: {
        title,
        message,
        confirmText,
        cancelText,
        confirmColor,
        onConfirm,
        onCancel,
      },
      successVisible: false,
      errorVisible: false,
    });
  },

  /**
   * hideConfirm: ฟังก์ชันสั่งปิด Modal ยืนยัน
   */
  hideConfirm: () => {
    set({ confirmVisible: false });
  },
}));
