// src/app/hooks/useUnsavedChanges.js
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToastStore } from '@/app/stores/useToastStore';

/**
 * Hook: useUnsavedChanges
 * หน้าที่: ตรวจจับและแจ้งเตือนเมื่อผู้ใช้พยายามออกจากหน้าจอขณะมีข้อมูลที่ยังไม่ได้บันทึก
 * ครอบคลุม:
 * 1. การคลิกลิงก์ภายในเว็บไซต์ (เมนูนำทาง, แถบด้านข้าง, Navbar, หรือ Link ใดๆ)
 * 2. การกดปุ่มย้อนกลับ / ไปข้างหน้า ของเบราว์เซอร์ (Browser History Navigation)
 * 3. การรีเฟรชหน้าจอ (F5) หรือการปิดแท็บเบราว์เซอร์ (Browser Tab Close)
 *
 * @param {boolean} isDirty - สถานะว่ามีข้อมูลที่กำลังแก้ไขและยังไม่ได้บันทึกหรือไม่
 * @param {Object} options - ตัวเลือกการปรับแต่งข้อความและปุ่มแจ้งเตือน
 */
export function useUnsavedChanges(isDirty, options = {}) {
  const router = useRouter();
  const showConfirm = useToastStore((state) => state.showConfirm);
  const isBypassingRef = useRef(false);

  const {
    title = 'ยังไม่ได้บันทึกการเปลี่ยนแปลง',
    message = 'คุณมีข้อมูลที่กำลังแก้ไขและยังไม่ได้บันทึก หากออกจากหน้านี้ ข้อมูลที่แก้ไขไว้จะสูญหาย คุณต้องการออกจากหน้านี้หรือไม่?',
    confirmText = 'ออกจากหน้านี้',
    cancelText = 'แก้ไขต่อ',
    confirmColor = 'red',
  } = options;

  // 1. ดักจับกรณีรีเฟรชหน้า หรือปิดแท็บเบราว์เซอร์ (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isDirty || isBypassingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // 2. ดักจับการคลิกลิงก์ภายในเว็บไซต์ (Internal Navigation Links <a> / <Link>)
  useEffect(() => {
    if (!isDirty) return;

    const handleDocumentClick = (e) => {
      if (isBypassingRef.current) return;

      // ตรวจสอบเฉพาะการคลิกซ้ายปกติ (ไม่กด Ctrl/Command/Shift/Alt)
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const anchor = e.target?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // ละเว้นลิงก์ภายนอก, ลิงก์ anchor hash บนหน้าเดียวกัน, ลิงก์ที่เปิดแท็บใหม่, หรือดาวน์โหลด
      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:') ||
        href === '#'
      ) {
        return;
      }

      // แปลงเป็น full URL เพื่อเปรียบเทียบกับ URL ปัจจุบัน
      let targetUrl;
      try {
        targetUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // หากเป็นลิงก์ไปยัง domain อื่น ให้ผ่าน
      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      // หากคลิกลิงก์ที่เป็นหน้าปัจจุบันและ query/hash เดียวกัน ให้ผ่าน
      if (
        targetUrl.pathname === window.location.pathname &&
        targetUrl.search === window.location.search &&
        (targetUrl.hash === window.location.hash || !targetUrl.hash)
      ) {
        return;
      }

      // สกัดการนำทางของ Next.js และแสดง Confirmation Modal
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const destination = targetUrl.pathname + targetUrl.search + targetUrl.hash;

      showConfirm({
        title,
        message,
        confirmText,
        cancelText,
        confirmColor,
        onConfirm: () => {
          isBypassingRef.current = true;
          router.push(destination);
        },
        onCancel: () => {
          // ผู้ใช้เลือกแก้ไขต่อ อยู่ที่หน้าเดิม
        },
      });
    };

    // ใช้ capture: true เพื่อดักจับ Event ก่อนที่ตัวจัดการของ Link จะทำงาน
    document.addEventListener('click', handleDocumentClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
    };
  }, [isDirty, title, message, confirmText, cancelText, confirmColor, router, showConfirm]);

  // 3. ดักจับปุ่ม Back/Forward ของเบราว์เซอร์ (popstate)
  useEffect(() => {
    if (!isDirty) return;

    // ดัน dummy history state เพื่อให้สามารถดักจับ popstate ได้
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (isBypassingRef.current) return;

      // ดัน history กลับมาที่เดิมทันทีเพื่อป้องกันการเปลี่ยนหน้าก่อนผู้ใช้กดยืนยัน
      window.history.pushState(null, '', window.location.href);

      showConfirm({
        title,
        message,
        confirmText,
        cancelText,
        confirmColor,
        onConfirm: () => {
          isBypassingRef.current = true;
          window.history.back();
        },
        onCancel: () => {
          // อยู่หน้าเดิม
        },
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty, title, message, confirmText, cancelText, confirmColor, showConfirm]);

  // ฟังก์ชันสำหรับสั่งบายพาสการตรวจจับเมื่อกดบันทึกข้อมูลสำเร็จ
  const allowNavigation = useCallback(() => {
    isBypassingRef.current = true;
  }, []);

  return { allowNavigation };
}
