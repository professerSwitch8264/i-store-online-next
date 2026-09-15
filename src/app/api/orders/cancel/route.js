// src/app/api/orders/cancel/route.js

/**
 * =========================================================================
 * API Route: POST /api/orders/cancel
 * =========================================================================
 * หน้าที่: ยกเลิกคำสั่งซื้อ (Order Cancellation)
 * ตรวจสอบเงื่อนไขสถานะ (ต้องเป็นสถานะ 'W' หรือ 'P' - กำลังรออนุมัติ)
 * และคืนสต็อกเข้าคลังอัตโนมัติ (operation: 'return') สำหรับคำสั่งซื้อมาตรฐาน
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // 1. ตรวจสอบการยืนยันตัวตน
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }
    const currentUser = authResult.user;

    // 2. รับและตรวจสอบข้อมูล Payload
    const body = await request.json();
    const { order_no, order_id, remark = 'ยกเลิกโดยผู้สั่งซื้อ' } = body;

    if (!order_no && !order_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ order_no หรือ order_id ที่ต้องการยกเลิก' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 3. ค้นหาคำสั่งซื้อจากฐานข้อมูล
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
    const targetStoreId = orderHeader.store_id;
    const isPreorder = orderHeader.reserve_flag === 'Y';
    const orderOwner = (orderHeader.owner || '').toUpperCase();

    // 4. ตรวจสอบสิทธิ์ (ผู้สั่งซื้อ, เจ้าของร้านค้า หรือ Admin เท่านั้น)
    const isOwner = currentUser.username.toUpperCase() === orderOwner;
    const isAdmin = currentUser.isAdmin;
    const isStoreOwner = targetStoreId && currentUser.ownedStoreIds
      ? currentUser.ownedStoreIds.includes(targetStoreId)
      : false;

    if (!isOwner && !isAdmin && !isStoreOwner) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้' },
        { status: 403 }
      );
    }

    // 5. ตรวจสอบเงื่อนไขสถานะ (ต้องเป็นสถานะ 'W', 'P' หรือ 'X' เท่านั้น)
    if (currentStatus !== 'W' && currentStatus !== 'P' && currentStatus !== 'X') {
      return NextResponse.json(
        {
          success: false,
          error: `ไม่สามารถยกเลิกคำสั่งซื้อ ${targetOrderNo} ได้ เนื่องจากสถานะปัจจุบันไม่ใช่รายการที่สามารถยกเลิกได้ (สถานะ: ${currentStatus})`,
        },
        { status: 400 }
      );
    }

    // 6. ดึงรายการสินค้าที่ต้องคืนสต็อก (คืนเข้าล๊อตเดิมผ่าน Trigger update_inventory)
    const itemsReq = pool.request();
    itemsReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
    const itemsRes = await itemsReq.query(`
      SELECT product_id, quantity, price, inventory_id
      FROM items
      WHERE order_id = @orderId
    `);
    let itemsToReturn = itemsRes.recordset || [];

    if (itemsToReturn.length === 0) {
      const fallbackReq = pool.request();
      fallbackReq.input('orderId', sql.NVarChar, targetOrderId);
      const fallbackRes = await fallbackReq.query(`
        SELECT product_id, quantity, price, inventory_id
        FROM inventory_transaction
        WHERE order_id = @orderId AND operation = 'withdraw'
      `);
      itemsToReturn = fallbackRes.recordset || [];
    }

    // 7. ดำเนินการ ACID Transaction (คืนสต็อก + อัปเดตสถานะเป็น 'C')
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 7.1 บันทึกรายการคืนสต็อกลงตาราง inventory_transaction
      for (const item of itemsToReturn) {
        if (item.product_id && item.quantity && item.quantity > 0) {
          let cleanInvId = item.inventory_id || '00000000-0000-0000-0000-000000000000';
          if (orderHeader.reserve_flag !== 'Y' && cleanInvId === '00000000-0000-0000-0000-000000000000') {
            const findLot = await new sql.Request(transaction)
              .input('pid', sql.UniqueIdentifier, item.product_id)
              .query('SELECT TOP 1 inventory_id FROM inventory WHERE product_id = @pid ORDER BY inventory_date DESC');
            if (findLot.recordset.length > 0) {
              cleanInvId = findLot.recordset[0].inventory_id;
            }
          }
          const itemPrice = item.price || 0;

          const txReq = new sql.Request(transaction);
          txReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
          txReq.input('productId', sql.UniqueIdentifier, item.product_id);
          txReq.input('quantity', sql.Float, item.quantity);
          txReq.input('price', sql.Float, itemPrice);
          txReq.input('remark', sql.NVarChar, `คืนสต็อกจากการยกเลิกคำสั่งซื้อ ${targetOrderNo} (${remark})`);
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

      // 7.2 อัปเดตสถานะคำสั่งซื้อในตาราง orders เป็น 'C'
      const updateOrderReq = new sql.Request(transaction);
      updateOrderReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
      updateOrderReq.input('remark', sql.NVarChar, remark);
      updateOrderReq.input('user', sql.NVarChar, currentUser.username);

      await updateOrderReq.query(`
        UPDATE orders
        SET status = 'C',
            remark = @remark,
            update_by = @user,
            update_date = GETDATE()
        WHERE order_id = @orderId
      `);

      // 7.3 อัปเดตสถานะในตาราง order_approvals เป็น 'C' เฉพาะกรณีที่ยังไม่ได้อนุมัติ (W หรือ P)
      // หากผ่านการอนุมัติแล้ว (X) ให้คงสถานะและประวัติการอนุมัติของหัวหน้าไว้ใน order_approvals
      if (currentStatus === 'W' || currentStatus === 'P') {
        const updateApprovReq = new sql.Request(transaction);
        updateApprovReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
        updateApprovReq.input('user', sql.NVarChar, currentUser.username);

        await updateApprovReq.query(`
          UPDATE order_approvals
          SET status = 'C',
              response_by = @user,
              response_date = GETDATE()
          WHERE order_id = @orderId
        `);
      }

      await transaction.commit();
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }

    return NextResponse.json(
      {
        success: true,
        message: `ยกเลิกคำสั่งซื้อ "${targetOrderNo}" เรียบร้อยแล้ว`,
        data: {
          order_id: targetOrderId,
          order_no: targetOrderNo,
          status: 'C',
          stock_returned: itemsToReturn.length > 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/orders/cancel error:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
