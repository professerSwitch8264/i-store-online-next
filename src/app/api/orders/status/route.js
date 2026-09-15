// src/app/api/orders/status/route.js

/**
 * =========================================================================
 * API Route: POST /api/orders/status
 * =========================================================================
 * หน้าที่: ระบบรวมศูนย์สำหรับจัดการและเปลี่ยนสถานะคำสั่งซื้อ
 * รองรับ Actions:
 * 1. APPROVE: หัวหน้าแผนกกดอนุมัติคำขอ (W/P -> X) ส่งต่อให้ร้านค้าจัดเตรียมสินค้า
 * 2. REJECT: หัวหน้าแผนกกดไม่อนุมัติ (W/P -> R) พร้อมคืนสต็อกสินค้าเข้าคลัง
 * 3. CANCEL: ผู้สั่งซื้อหรือ Admin ขอยกเลิกคำสั่งซื้อ (W/P -> C) พร้อมคืนสต็อกเข้าคลัง
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // ─────────────────────────────────────────────────────────────
    // 1. ตรวจสอบการยืนยันตัวตน
    // ─────────────────────────────────────────────────────────────
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const currentUsername = currentUser.username.toUpperCase();
    const isAdmin = currentUser.isAdmin;

    // ─────────────────────────────────────────────────────────────
    // 2. รับและตรวจสอบข้อมูล Payload
    // ─────────────────────────────────────────────────────────────
    const body = await request.json();
    const { order_no, order_id, action, remark = '' } = body;

    if (!order_no && !order_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุหมายเลขคำสั่งซื้อ (order_no) หรือรหัสคำสั่งซื้อ (order_id)' },
        { status: 400 }
      );
    }

    const VALID_ACTIONS = ['APPROVE', 'REJECT', 'CANCEL'];
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `Action "${action}" ไม่ถูกต้อง (รองรับ APPROVE, REJECT หรือ CANCEL)`,
        },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ─────────────────────────────────────────────────────────────
    // 3. ดึงข้อมูลคำสั่งซื้อจากฐานข้อมูล
    // ─────────────────────────────────────────────────────────────
    const orderReq = pool.request();
    if (order_no) {
      orderReq.input('orderNo', sql.NVarChar, order_no.trim());
    } else {
      orderReq.input('orderId', sql.UniqueIdentifier, order_id.trim());
    }

    const orderQuery = order_no
      ? 'SELECT TOP 1 order_id, order_no, owner, store_id, status, reserve_flag FROM orders WHERE order_no = @orderNo'
      : 'SELECT TOP 1 order_id, order_no, owner, store_id, status, reserve_flag FROM orders WHERE order_id = @orderId';

    const orderRes = await orderReq.query(orderQuery);
    const orderHeader = orderRes.recordset[0];

    if (!orderHeader) {
      return NextResponse.json(
        { success: false, error: `ไม่พบคำสั่งซื้อ "${order_no || order_id}" ในระบบ` },
        { status: 404 }
      );
    }

    const currentStatus = (orderHeader.status || 'W').toUpperCase();
    const targetOrderNo = orderHeader.order_no;
    const targetOrderId = orderHeader.order_id;
    const orderOwner = (orderHeader.owner || '').toUpperCase();
    const isPreorder = orderHeader.reserve_flag === 'Y';

    // ดึงข้อมูลการอนุมัติ (order_approvals)
    const appReq = pool.request();
    appReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
    const appRes = await appReq.query(`
      SELECT TOP 1 approval_id, order_id, status, approvers, en
      FROM order_approvals
      WHERE order_id = @orderId
    `);
    const orderApproval = appRes.recordset[0];

    const approversList = (orderApproval?.approvers || '')
      .toUpperCase()
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    const isApprover = approversList.includes(currentUsername);
    const isOrderOwner = currentUsername === orderOwner;

    // ─────────────────────────────────────────────────────────────
    // 4. ตรวจสอบเงื่อนไขสถานะและสิทธิ์ตาม Action
    // ─────────────────────────────────────────────────────────────
    if (action === 'APPROVE' || action === 'REJECT') {
      if (currentStatus !== 'W' && currentStatus !== 'P') {
        return NextResponse.json(
          {
            success: false,
            error: `ไม่สามารถดำเนินการได้ เนื่องจากคำสั่งซื้อไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: "${currentStatus}")`,
          },
          { status: 400 }
        );
      }

      if (!isApprover) {
        return NextResponse.json(
          {
            success: false,
            error: 'คุณไม่มีสิทธิ์พิจารณาอนุมัติคำสั่งซื้อนี้ (เฉพาะผู้อนุมัติที่ได้รับมอบหมายเท่านั้น)',
          },
          { status: 403 }
        );
      }
    } else if (action === 'CANCEL') {
      if (currentStatus !== 'W' && currentStatus !== 'P') {
        return NextResponse.json(
          {
            success: false,
            error: `ไม่สามารถยกเลิกคำสั่งซื้อได้ เนื่องจากคำสั่งซื้อไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: "${currentStatus}")`,
          },
          { status: 400 }
        );
      }

      if (!isOrderOwner) {
        return NextResponse.json(
          {
            success: false,
            error: 'คุณไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้ (เฉพาะผู้สั่งซื้อเท่านั้น)',
          },
          { status: 403 }
        );
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. ดำเนินการ Transaction ในฐานข้อมูล (ACID Safe)
    // ─────────────────────────────────────────────────────────────
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // ───────────────────────────────────────────
      // กรณี 1: APPROVE (อนุมัติคำสั่งซื้อ -> X)
      // ───────────────────────────────────────────
      if (action === 'APPROVE') {
        // 5.1 อัปเดตตาราง order_approvals เป็น 'A'
        const upAppReq = new sql.Request(transaction);
        upAppReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
        upAppReq.input('user', sql.NVarChar, currentUser.username);
        await upAppReq.query(`
          UPDATE order_approvals
          SET status = 'A',
              response_by = @user,
              response_date = GETDATE()
          WHERE order_id = @orderId
        `);

        // 5.2 อัปเดตตาราง orders เป็น 'X' (กำลังเตรียมสินค้า)
        const upOrdReq = new sql.Request(transaction);
        upOrdReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
        upOrdReq.input('remark', sql.NVarChar, remark || null);
        upOrdReq.input('user', sql.NVarChar, currentUser.username);
        await upOrdReq.query(`
          UPDATE orders
          SET status = 'X',
              remark = @remark,
              update_by = @user,
              update_date = GETDATE()
          WHERE order_id = @orderId
        `);

        await transaction.commit();

        return NextResponse.json(
          {
            success: true,
            message: `อนุมัติคำสั่งซื้อ "${targetOrderNo}" เรียบร้อยแล้ว (ส่งต่อให้ร้านค้าจัดเตรียมสินค้า)`,
            data: { order_no: targetOrderNo, status: 'X' },
          },
          { status: 200 }
        );
      }

      // ───────────────────────────────────────────
      // กรณี 2 & 3: REJECT หรือ CANCEL (คืนสต็อก + เปลี่ยนสถานะ)
      // ───────────────────────────────────────────
      const newStatus = action === 'REJECT' ? 'R' : 'C';
      const defaultRemark = action === 'REJECT' ? 'ปฏิเสธโดยผู้อนุมัติ' : 'ยกเลิกโดยผู้สั่งซื้อ';
      const finalRemark = remark?.trim() ? remark.trim() : defaultRemark;

      // คืนสต็อกสินค้าลงในตาราง inventory_transaction (คืนเข้าล๊อตเดิมผ่าน Trigger update_inventory)
      const itemsReq = new sql.Request(transaction);
      itemsReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
      const itemsRes = await itemsReq.query(`
        SELECT product_id, quantity, price, inventory_id
        FROM items
        WHERE order_id = @orderId
      `);
      let itemsToReturn = itemsRes.recordset || [];

      // กรณีในตาราง items ยังไม่มีข้อมูล ให้ดึงจาก inventory_transaction ที่เคย withdraw ไว้
      if (itemsToReturn.length === 0) {
        const txReq = new sql.Request(transaction);
        txReq.input('orderId', sql.NVarChar, targetOrderId);
        const txRes = await txReq.query(`
          SELECT product_id, quantity, price, inventory_id
          FROM inventory_transaction
          WHERE order_id = @orderId AND operation = 'withdraw'
        `);
        itemsToReturn = txRes.recordset || [];
      }

      for (const item of itemsToReturn) {
        if (item.product_id && item.quantity && item.quantity > 0) {
          const cleanInvId = item.inventory_id || '00000000-0000-0000-0000-000000000000';
          const itemPrice = item.price || 0;

          const txReq = new sql.Request(transaction);
          txReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
          txReq.input('productId', sql.UniqueIdentifier, item.product_id);
          txReq.input('quantity', sql.Float, item.quantity);
          txReq.input('price', sql.Float, itemPrice);
          txReq.input('remark', sql.NVarChar, `${finalRemark} (${targetOrderNo})`);
          txReq.input('orderId', sql.NVarChar, targetOrderId);
          txReq.input('invId', sql.UniqueIdentifier, cleanInvId);
          txReq.input('user', sql.NVarChar, currentUser.username);

          await txReq.query(`
            INSERT INTO inventory_transaction (
              transaction_id,
              transaction_date,
              product_id,
              operation,
              quantity,
              price,
              sn,
              remark,
              order_id,
              inventory_id,
              update_by
            ) VALUES (
              @txId,
              GETDATE(),
              @productId,
              'return',
              @quantity,
              @price,
              NULL,
              @remark,
              @orderId,
              @invId,
              @user
            )
          `);
        }
      }

      // อัปเดตตาราง order_approvals
      const upAppReq = new sql.Request(transaction);
      upAppReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
      upAppReq.input('status', sql.NVarChar, newStatus);
      upAppReq.input('en', sql.NVarChar, action === 'CANCEL' ? 'N' : 'Y');
      upAppReq.input('user', sql.NVarChar, currentUser.username);
      await upAppReq.query(`
        UPDATE order_approvals
        SET status = @status,
            en = @en,
            response_by = @user,
            response_date = GETDATE()
        WHERE order_id = @orderId
      `);

      // อัปเดตตาราง orders
      const upOrdReq = new sql.Request(transaction);
      upOrdReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
      upOrdReq.input('status', sql.NVarChar, newStatus);
      upOrdReq.input('remark', sql.NVarChar, finalRemark);
      upOrdReq.input('user', sql.NVarChar, currentUser.username);
      await upOrdReq.query(`
        UPDATE orders
        SET status = @status,
            remark = @remark,
            update_by = @user,
            update_date = GETDATE()
        WHERE order_id = @orderId
      `);

      await transaction.commit();

      const actionText = action === 'REJECT' ? 'ปฏิเสธ' : 'ยกเลิก';
      return NextResponse.json(
        {
          success: true,
          message: `${actionText}คำสั่งซื้อ "${targetOrderNo}" และคืนสต็อกสินค้าเรียบร้อยแล้ว`,
          data: { order_no: targetOrderNo, status: newStatus },
        },
        { status: 200 }
      );
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error('💥 [POST /api/orders/status error]:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะคำสั่งซื้อ';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
