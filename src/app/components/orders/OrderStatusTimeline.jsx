'use client';

import { formatThaiDateTime } from '@/lib/utils';
import {
  RiCheckLine,
  RiCloseLine,
  RiTimeLine,
  RiBox3Line,
  RiTruckLine,
  RiCheckboxCircleLine,
  RiChat1Line,
  RiRouteLine,
} from 'react-icons/ri';

/**
 * OrderStatusTimeline
 * คอมโพเนนต์ไทม์ไลน์แสดงสเต็ปและประวัติสถานะคำสั่งซื้อแบบ Vertical Stepper
 * พร้อมไอคอนสถานะ (อนุมัติ, จัดเตรียม, จัดส่ง, สำเร็จ, ปฏิเสธ/ยกเลิก)
 */
export function OrderStatusTimeline({ order, className = '' }) {

  if (!order) return null;

  const status = (order.status || 'W').toUpperCase();
  const isRejected = status === 'R';
  const isCancelled = status === 'C';
  const hasApproved = Boolean(
    order.approved_by ||
    order.approved_by_name ||
    ['X', 'S', 'D'].includes(status)
  );
  const hasPrepared = Boolean(
    order.prepared_by ||
    order.prepared_by_name ||
    ['S', 'D'].includes(status)
  );

  // สร้างรายการ Steps ตามเงื่อนไขของคำสั่งซื้อ
  const steps = [];

  // 1. สเต็ป: ส่งคำสั่งซื้อสำเร็จ (มีเสมอในทุกออเดอร์)
  steps.push({
    key: 'placed',
    title: 'ส่งคำสั่งซื้อสำเร็จ',
    state: 'completed',
    actor: order.fullname_th || order.owner || 'ผู้สั่งซื้อ',
    date: order.order_date,
    iconType: 'check',
  });

  // 2. สเต็ป: การอนุมัติคำสั่งซื้อ (หรือ ปฏิเสธ/ยกเลิก ถ้าเกิดขึ้นในขั้นตอนนี้)
  if (isRejected && !hasApproved) {
    steps.push({
      key: 'rejected',
      title: 'คำขอถูกปฏิเสธ',
      state: 'rejected',
      actor: order.response_by_name || order.response_by || 'ผู้มีอำนาจอนุมัติ',
      date: order.response_date,
      remark: order.remark,
      iconType: 'close',
    });
  } else if (isCancelled && !hasApproved) {
    steps.push({
      key: 'cancelled',
      title: 'ยกเลิกคำสั่งซื้อ',
      state: 'cancelled',
      actor: order.response_by_name || order.response_by || order.fullname_th || order.owner || 'ผู้ดำเนินการ',
      date: order.response_date || order.order_date,
      remark: order.remark,
      iconType: 'close',
    });
  } else {
    // ผ่านการอนุมัติ หรือ กำลังรออนุมัติ
    const isApprovalDone = hasApproved;
    const isApprovalActive = !hasApproved && (status === 'W' || status === 'P');

    steps.push({
      key: 'approval',
      title: isApprovalDone ? 'อนุมัติคำสั่งซื้อแล้ว' : 'กำลังรออนุมัติ',
      state: isApprovalDone ? 'completed' : isApprovalActive ? 'active' : 'pending',
      actor: isApprovalDone ? (order.approved_by_name || order.approved_by || 'ผู้อนุมัติ') : null,
      date: isApprovalDone ? order.approved_date : null,
      iconType: isApprovalDone ? 'check' : 'time',
    });

    // ถ้าผ่านการอนุมัติแล้ว แต่ถูกยกเลิกในภายหลัง
    if (isCancelled) {
      steps.push({
        key: 'cancelled_after_approval',
        title: 'ยกเลิกคำสั่งซื้อ',
        state: 'cancelled',
        actor: order.response_by_name || order.response_by || 'ผู้ดำเนินการ',
        date: order.response_date,
        remark: order.remark,
        iconType: 'close',
      });
    } else if (isRejected) {
      steps.push({
        key: 'rejected_after_approval',
        title: 'คำขอถูกปฏิเสธ',
        state: 'rejected',
        actor: order.response_by_name || order.response_by || 'ผู้ดำเนินการ',
        date: order.response_date,
        remark: order.remark,
        iconType: 'close',
      });
    } else {
      // 3. สเต็ป: จัดเตรียมสินค้า
      const isPrepDone = hasPrepared;
      const isPrepActive = !isPrepDone && status === 'X';

      steps.push({
        key: 'preparation',
        title: isPrepDone ? 'จัดเตรียมสินค้าเสร็จสิ้น' : isPrepActive ? 'กำลังจัดเตรียมสินค้า' : 'จัดเตรียมสินค้า',
        state: isPrepDone ? 'completed' : isPrepActive ? 'active' : 'pending',
        actor: isPrepDone ? (order.prepared_by_name || order.prepared_by || 'ผู้จัดเตรียม') : null,
        date: isPrepDone ? order.prepared_date : null,
        iconType: isPrepDone ? 'check' : isPrepActive ? 'box' : 'dot',
      });

      // 4. สเต็ป: จัดส่ง / รอยืนยันการรับสินค้า
      const isReceiveDone = status === 'D';
      const isReceiveActive = status === 'S';

      steps.push({
        key: 'shipping',
        title: isReceiveDone
          ? 'รับสินค้าเรียบร้อยแล้ว'
          : isReceiveActive
            ? 'รอยืนยันการรับสินค้า'
            : 'รอยืนยันการรับสินค้า',
        state: isReceiveDone ? 'completed' : isReceiveActive ? 'active' : 'pending',
        actor: null,
        date: null,
        iconType: isReceiveDone ? 'check' : isReceiveActive ? 'truck' : 'dot',
      });

      // 5. สเต็ป: ดำเนินการเสร็จสิ้น
      const isCompleted = status === 'D';
      steps.push({
        key: 'completed',
        title: 'ดำเนินการเสร็จสิ้น',
        state: isCompleted ? 'completed' : 'pending',
        actor: null,
        date: null,
        iconType: isCompleted ? 'done' : 'dot',
      });
    }
  }

  // เรนเดอร์โหนดไอคอน
  const renderNodeIcon = (step) => {
    switch (step.state) {
      case 'completed':
        return (
          <div className="w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center shadow-2xs shrink-0 z-10">
            {step.iconType === 'done' ? (
              <RiCheckboxCircleLine className="w-3 h-3" />
            ) : (
              <RiCheckLine className="w-3 h-3 stroke-[1.5]" />
            )}
          </div>
        );

      case 'active':
        if (step.iconType === 'truck') {
          return (
            <div className="w-5 h-5 rounded-full bg-white border-2 border-sky-500 text-sky-600 flex items-center justify-center shadow-2xs shrink-0 z-10">
              <RiTruckLine className="w-3 h-3" />
            </div>
          );
        }
        if (step.iconType === 'box') {
          return (
            <div className="w-5 h-5 rounded-full bg-white border-2 border-amber-500 text-amber-600 flex items-center justify-center shadow-2xs shrink-0 z-10">
              <RiBox3Line className="w-3 h-3" />
            </div>
          );
        }
        return (
          <div className="w-5 h-5 rounded-full bg-white border-2 border-[#1976d2] text-[#1976d2] flex items-center justify-center shadow-2xs shrink-0 z-10">
            <RiTimeLine className="w-3 h-3" />
          </div>
        );

      case 'rejected':
        return (
          <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-2xs shrink-0 z-10">
            <RiCloseLine className="w-3 h-3 stroke-[1.5]" />
          </div>
        );

      case 'cancelled':
        return (
          <div className="w-5 h-5 rounded-full bg-stone-500 text-white flex items-center justify-center shadow-2xs shrink-0 z-10">
            <RiCloseLine className="w-3 h-3 stroke-[1.5]" />
          </div>
        );

      case 'pending':
      default:
        return (
          <div className="w-5 h-5 rounded-full border-2 border-stone-300 bg-white flex items-center justify-center shrink-0 shadow-2xs">
            <div className="w-1.5 h-1.5 rounded-full bg-stone-400" />
          </div>
        );
    }
  };

  return (
    <div className={`p-2.5 bg-stone-50 rounded-xs border border-stone-200 text-xs font-sans flex flex-col transition-all ${className || 'mt-1.5 shrink-0'}`}>
      {/* ส่วนหัวของไทม์ไลน์ */}
      <div className="flex items-center justify-between py-0.5 shrink-0 select-none">
        <div className="flex items-center gap-1.5 text-[#363636]">
          <RiRouteLine className="w-3.5 h-3.5 text-stone-500" />
          <h4 className="font-semibold text-xs uppercase tracking-wide">
            ประวัติและสถานะคำสั่งซื้อ
          </h4>
        </div>
      </div>

      {/* ไทม์ไลน์แนวตั้ง (มี Scrollbar ภายในกล่องสถานะโดยตรง) */}
      <div className="relative mt-1.5 pt-1.5 border-t border-stone-200/60 animate-fadeIn overflow-y-auto pr-1 flex-1 min-h-0">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const nextStep = !isLast ? steps[idx + 1] : null;
          const prevStep = idx > 0 ? steps[idx - 1] : null;

          return (
            <div
              key={step.key}
              className={`relative flex items-center gap-2.5 px-2 py-1 rounded transition-colors ${idx % 2 === 1 ? 'bg-stone-200/50' : 'bg-transparent'
                }`}
            >
              {/* คอลัมน์โหนดและเส้นเชื่อม (Timeline Track Column: ล็อกให้เส้นและวงกลมอยู่กึ่งกลางเดียวกัน 100%) */}
              <div className="relative flex items-center justify-center shrink-0 w-5 self-stretch">
                {/* เส้นท่อนบน: ลากจากขอบบนลงมากึ่งกลาง (สำหรับสเต็ปที่ไม่ใช่สเต็ปแรก) */}
                {idx > 0 && (
                  <div
                    className={`absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-[2px] z-0 ${prevStep?.state === 'completed' && (step.state === 'completed' || step.state === 'active')
                        ? 'bg-[#10b981]'
                        : 'bg-stone-300'
                      }`}
                  />
                )}

                {/* เส้นท่อนล่าง: ลากจากกึ่งกลางลงไปขอบล่าง (สำหรับสเต็ปที่ไม่ใช่สเต็ปสุดท้าย) */}
                {!isLast && (
                  <div
                    className={`absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-[2px] z-0 ${step.state === 'completed' && (nextStep?.state === 'completed' || nextStep?.state === 'active')
                        ? 'bg-[#10b981]'
                        : 'bg-stone-300'
                      }`}
                  />
                )}

                {/* วงกลมไอคอนโหนด (อยู่กึ่งกลาง w-5 แน่นอน) */}
                <div className="relative z-10 flex items-center justify-center">
                  {renderNodeIcon(step)}
                </div>
              </div>

              {/* ข้อความรายละเอียดของสเต็ป */}
              <div className="flex-1 min-w-0">
                {step.remark ? (
                  /* กรณีมีคอมเมนต์/หมายเหตุ: แสดง 2 บรรทัด (ซ้าย: หัวข้อ + คอมเมนต์, ขวา: โดยใคร + วันที่) */
                  <div className="flex items-center justify-between gap-2">
                    {/* ฝั่งซ้าย: ชื่อขั้นตอน (แถว 1) และ คอมเมนต์/หมายเหตุ (แถว 2) */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-semibold leading-tight ${step.state === 'rejected'
                            ? 'text-rose-700'
                            : step.state === 'cancelled'
                              ? 'text-stone-700'
                              : 'text-[#2B2F38]'
                          }`}
                      >
                        {step.title}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-stone-500 font-normal leading-tight mt-0.5">
                        <RiChat1Line className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                        <span className="break-words">
                          {(step.remark || '').replace(/^(Rejected|Cancelled):\s*/i, '')}
                        </span>
                      </div>
                    </div>

                    {/* ฝั่งขวา: โดยใคร (แถว 1) และ วันที่และเวลา (แถว 2) */}
                    {(step.actor || step.date) && (
                      <div className="flex flex-col items-end justify-center text-right shrink-0 leading-tight">
                        {step.actor && (
                          <span className="text-[11px] text-stone-500 font-normal">
                            โดย: <span className="font-medium text-stone-700">{step.actor}</span>
                          </span>
                        )}
                        {step.date && (
                          <span className="text-stone-400 text-[10.5px] font-normal mt-0.5">
                            {formatThaiDateTime(step.date)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* กรณีไม่มีคอมเมนต์: สถานะอยู่กึ่งกลางแนวตั้ง (ฝั่งซ้าย) vs โดยใคร+วันที่ (ฝั่งขวา) */
                  <div className="flex items-center justify-between gap-2 min-h-[26px]">
                    {/* ฝั่งซ้าย: สถานะอยู่กึ่งกลางแนวตั้ง */}
                    <span
                      className={`text-xs font-semibold leading-tight ${step.state === 'completed'
                          ? 'text-[#2B2F38]'
                          : step.state === 'active'
                            ? 'text-[#1976d2]'
                            : 'text-stone-400 font-normal'
                        }`}
                    >
                      {step.title}
                    </span>

                    {/* ฝั่งขวา: โดยใคร (แถว 1) และ วันที่และเวลา (แถว 2) */}
                    {(step.actor || step.date) && (
                      <div className="flex flex-col items-end justify-center text-right shrink-0 leading-tight">
                        {step.actor && (
                          <span className="text-[11px] text-stone-500 font-normal">
                            โดย: <span className="font-medium text-stone-700">{step.actor}</span>
                          </span>
                        )}
                        {step.date && (
                          <span className="text-stone-400 text-[10.5px] font-normal mt-0.5">
                            {formatThaiDateTime(step.date)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
