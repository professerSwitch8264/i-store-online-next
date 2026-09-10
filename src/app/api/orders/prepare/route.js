// src/app/api/orders/prepare/route.js

/**
 * =========================================================================
 * API Route: POST /api/orders/prepare
 * =========================================================================
 * หน้าที่: ยืนยันการจัดเตรียมสินค้าของร้านค้า (Store Goods Preparation)
 * 1. ตรวจสอบสิทธิ์ผู้ใช้งาน (เจ้าของร้านค้า หรือ Admin)
 * 2. ตรวจสอบสถานะคำสั่งซื้อต้องเป็น 'X' (กำลังเตรียมสินค้า)
 * 3. บันทึก quantity_sent และ remark รายแถวลงในตาราง items
 * 4. คืนสต็อก/ตัดจ่ายส่วนต่างที่ไม่ได้จัดส่ง (quantity_order - quantity_sent):
 *    - สินค้าชำรุด (DAMAGED) หรือ สูญหาย (LOST) -> operation: 'deposit-waste' เข้า inventory_waste
 *    - สินค้าสภาพดี / คืนสต็อกปกติ (RETURN) -> operation: 'return' บวกคืนเข้า inventory
 * 5. ปรับสถานะคำสั่งซื้อ:
 *    - หากมีสินค้าจัดส่งได้อย่างน้อย 1 ชิ้น -> orders.status = 'S' (รอยืนยันการรับสินค้า)
 *    - หากสินค้ายกเลิกทั้งหมด (ส่ง 0 ชิ้น) -> orders.status = 'R' (ถูกปฏิเสธ)
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // ─────────────────────────────────────────────────────────────
    // 1. ตรวจสอบการยืนยันตัวตน (Authentication)
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
    const { order_id, order_no, prepared_items = [] } = body;

    if (!order_id && !order_no) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสคำสั่งซื้อ (order_id หรือ order_no)' },
        { status: 400 }
      );
    }

    if (!Array.isArray(prepared_items) || prepared_items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสินค้าที่ต้องการบันทึกการจัดเตรียม' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ─────────────────────────────────────────────────────────────
    // 3. ดึงข้อมูลคำสั่งซื้อและตรวจสอบสิทธิ์
    // ─────────────────────────────────────────────────────────────
    const orderReq = pool.request();
    if (order_id) {
      orderReq.input('orderId', sql.UniqueIdentifier, order_id);
    } else {
      orderReq.input('orderNo', sql.NVarChar, order_no.trim());
    }

    const orderQuery = order_id
      ? 'SELECT TOP 1 order_id, order_no, store_id, owner, status, reserve_flag FROM orders WHERE order_id = @orderId'
      : 'SELECT TOP 1 order_id, order_no, store_id, owner, status, reserve_flag FROM orders WHERE order_no = @orderNo';

    const orderRes = await orderReq.query(orderQuery);
    const orderHeader = orderRes.recordset[0];

    if (!orderHeader) {
      return NextResponse.json(
        { success: false, error: `ไม่พบคำสั่งซื้อ "${order_id || order_no}" ในระบบ` },
        { status: 404 }
      );
    }

    const targetOrderId = orderHeader.order_id;
    const targetOrderNo = orderHeader.order_no;
    const targetStoreId = orderHeader.store_id;
    const currentStatus = (orderHeader.status || '').toUpperCase();
    const isPreorder = (orderHeader.reserve_flag || '').toUpperCase() === 'Y';

    // ตรวจสอบสถานะคำสั่งซื้อ: ต้องอยู่ในสถานะ 'X' (กำลังเตรียมสินค้า)
    if (currentStatus !== 'X') {
      return NextResponse.json(
        {
          success: false,
          error: `คำสั่งซื้อนี้ไม่ได้อยู่ในสถานะรอจัดเตรียมสินค้า (สถานะปัจจุบัน: "${currentStatus}")`,
        },
        { status: 400 }
      );
    }

    // ตรวจสอบสิทธิ์: ผู้ใช้ต้องเป็นเจ้าของร้านค้า หรือผู้ดูแลระบบ (Admin)
    const isStoreOwner = targetStoreId && currentUser.ownedStoreIds
      ? currentUser.ownedStoreIds.includes(targetStoreId)
      : false;

    if (!isAdmin && !isStoreOwner) {
      return NextResponse.json(
        {
          success: false,
          error: 'คุณไม่มีสิทธิ์จัดการจัดเตรียมสินค้าของร้านค้านี้ (เฉพาะเจ้าของร้านหรือผู้ดูแลระบบเท่านั้น)',
        },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 4. ดึงแถวรายการสินค้าจริงจากตาราง items (เรียงตามลำดับ FIFO เข้าก่อน-ออกก่อน)
    // ─────────────────────────────────────────────────────────────
    const itemsReq = pool.request();
    itemsReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
    const dbItemsRes = await itemsReq.query(`
      SELECT i.item_id, i.order_id, i.product_id, i.inventory_id, i.quantity_order, i.quantity, i.price, i.quantity_sent, i.remark
      FROM items i
      LEFT JOIN inventory inv ON i.inventory_id = inv.inventory_id
      WHERE i.order_id = @orderId
      ORDER BY COALESCE(inv.inventory_date, '1970-01-01') ASC, i.item_id ASC
    `);
    const dbItems = dbItemsRes.recordset || [];

    if (dbItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสินค้าในคำสั่งซื้อนี้' },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 5. ดำเนินการ Transaction ในฐานข้อมูล (ACID Safe)
    // ─────────────────────────────────────────────────────────────
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // จัดกลุ่ม dbItems ตาม product_id เพื่อรองรับ multi-lot allocation
      const itemsByProduct = {};
      dbItems.forEach((it) => {
        const pId = String(it.product_id).toLowerCase();
        if (!itemsByProduct[pId]) itemsByProduct[pId] = [];
        itemsByProduct[pId].push(it);
      });

      let totalPreparedQuantity = 0;

      // วนลูปตามที่ Client ส่งมา
      for (const prepItem of prepared_items) {
        const pId = String(prepItem.product_id || '').toLowerCase();
        const matchedLots = itemsByProduct[pId] || [];

        if (matchedLots.length === 0) continue;

        const isCancelled = prepItem.action === 'CANCELLED' || Number(prepItem.quantity_sent) === 0;
        let remainingToSend = isCancelled ? 0 : Math.max(0, Number(prepItem.quantity_sent || 0));

        // คำนวณยอดสั่งรวมทั้งหมดสำหรับสินค้านี้
        const totalProductOrderQty = matchedLots.reduce(
          (sum, l) => sum + Number(l.quantity_order ?? l.quantity ?? 0),
          0
        );
        const unfulfilledTotal = Math.max(0, totalProductOrderQty - remainingToSend);

        let remainingToReturn = Number(prepItem.quantity_return || 0);
        let remainingToWaste = Number(prepItem.quantity_waste || 0);
        let remainingToLost = Number(prepItem.quantity_lost || 0);

        // รองรับกรณีระบุไม่ครบ ให้ยอดที่ขาดไปลงคลังปกติเป็นค่าเริ่มต้น
        if (remainingToReturn === 0 && remainingToWaste === 0 && remainingToLost === 0 && unfulfilledTotal > 0) {
          const legacyCancelType = prepItem.cancel_type || 'RETURN';
          if (legacyCancelType === 'DAMAGED') {
            remainingToWaste = unfulfilledTotal;
          } else if (legacyCancelType === 'LOST') {
            remainingToLost = unfulfilledTotal;
          } else {
            remainingToReturn = unfulfilledTotal;
          }
        }

        const wasteReason = prepItem.waste_reason || prepItem.cancel_reason || 'DAMAGED';
        const wasteCustomRemark = prepItem.waste_custom_remark?.trim() || '';
        const lostCustomRemark = prepItem.lost_custom_remark?.trim() || '';
        const returnRemark = prepItem.return_remark?.trim() || '';

        const wasteLabelMap = {
          DAMAGED: 'ชำรุดเสียหาย',
          LOST: 'สูญหาย',
          EXPIRED: 'หมดอายุ',
          OTHER: 'อื่นๆ',
        };
        const wasteLabel = wasteLabelMap[wasteReason] || 'ชำรุดเสียหาย';

        totalPreparedQuantity += remainingToSend;

        // กระจายจำนวนที่ส่ง (quantity_sent), คืนคลัง (quantity_return), ของชำรุด (quantity_waste), และของสูญหาย (quantity_lost) ให้แต่ละล๊อต (FIFO)
        for (const lot of matchedLots) {
          const lotOrderQty = Number(lot.quantity_order ?? lot.quantity ?? 0);

          // 1. ส่งมอบให้ลูกค้าก่อน (ล๊อตเก่าออกก่อน FIFO)
          let lotSentQty = 0;
          if (!isCancelled && remainingToSend > 0) {
            lotSentQty = Math.min(lotOrderQty, remainingToSend);
            remainingToSend -= lotSentQty;
          }

          let remainingInLot = lotOrderQty - lotSentQty;

          // 2. จัดสรรส่วนต่างในล๊อตนี้: คืนคลังปกติก่อน
          let lotReturnQty = 0;
          if (remainingInLot > 0 && remainingToReturn > 0) {
            lotReturnQty = Math.min(remainingInLot, remainingToReturn);
            remainingToReturn -= lotReturnQty;
            remainingInLot -= lotReturnQty;
          }

          // 3. จัดสรรส่วนต่างในล๊อตนี้: ตัดเป็นของชำรุด (deposit-waste)
          let lotWasteQty = 0;
          if (remainingInLot > 0 && remainingToWaste > 0) {
            lotWasteQty = Math.min(remainingInLot, remainingToWaste);
            remainingToWaste -= lotWasteQty;
            remainingInLot -= lotWasteQty;
          }

          // 4. จัดสรรส่วนต่างในล๊อตนี้: ตัดเป็นของสูญหาย (deposit-lost)
          let lotLostQty = 0;
          if (remainingInLot > 0 && remainingToLost > 0) {
            lotLostQty = Math.min(remainingInLot, remainingToLost);
            remainingToLost -= lotLostQty;
            remainingInLot -= lotLostQty;
          }

          // 5.1 หมายเหตุสำหรับแถวในตาราง items (บันทึกเฉพาะถ้าผู้ใช้ระบุมา)
          const itemSummaryRemark = prepItem.remark?.trim() || null;

          // 5.2 อัปเดตตาราง items
          const upItemReq = new sql.Request(transaction);
          upItemReq.input('itemId', sql.UniqueIdentifier, lot.item_id);
          upItemReq.input('qtySent', sql.Float, lotSentQty);
          upItemReq.input('remark', sql.NVarChar, itemSummaryRemark);
          upItemReq.input('user', sql.NVarChar, currentUser.username);

          await upItemReq.query(`
            UPDATE items
            SET quantity_sent = @qtySent,
                remark = @remark,
                update_by = @user,
                update_date = GETDATE()
            WHERE item_id = @itemId
          `);

          // 5.3 บันทึก Transaction สำหรับคำสั่งซื้อมาตรฐาน (!isPreorder)
          if (!isPreorder) {
            // ก. ทำรายการคืนสต็อกเข้าคลังปกติ (operation: 'return')
            if (lotReturnQty > 0) {
              const cleanInvId = lot.inventory_id || '00000000-0000-0000-0000-000000000000';
              const txRemark = `คืนสต็อกคำสั่งซื้อ (${targetOrderNo})${returnRemark ? `: ${returnRemark}` : ''}`;

              const txRetReq = new sql.Request(transaction);
              txRetReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
              txRetReq.input('productId', sql.UniqueIdentifier, lot.product_id);
              txRetReq.input('operation', sql.NVarChar, 'return');
              txRetReq.input('quantity', sql.Float, lotReturnQty);
              txRetReq.input('price', sql.Float, Number(lot.price || 0));
              txRetReq.input('remark', sql.NVarChar, txRemark);
              txRetReq.input('orderId', sql.NVarChar, targetOrderId);
              txRetReq.input('invId', sql.UniqueIdentifier, cleanInvId);
              txRetReq.input('user', sql.NVarChar, currentUser.username);

              await txRetReq.query(`
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
                  @operation,
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

            // ข. ทำรายการตัดของชำรุด (operation: 'deposit-waste') -> Trigger ลงตาราง inventory_waste
            if (lotWasteQty > 0) {
              const wasteTxRemark = wasteCustomRemark
                ? `สินค้าชำรุด (${targetOrderNo}): ${wasteCustomRemark}`
                : `สินค้าชำรุด (${targetOrderNo})`;

              const txWstReq = new sql.Request(transaction);
              txWstReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
              txWstReq.input('productId', sql.UniqueIdentifier, lot.product_id);
              txWstReq.input('operation', sql.NVarChar, 'deposit-waste');
              txWstReq.input('quantity', sql.Float, lotWasteQty);
              txWstReq.input('price', sql.Float, Number(lot.price || 0));
              txWstReq.input('remark', sql.NVarChar, wasteTxRemark);
              txWstReq.input('orderId', sql.NVarChar, targetOrderId);
              txWstReq.input('invId', sql.UniqueIdentifier, crypto.randomUUID());
              txWstReq.input('user', sql.NVarChar, currentUser.username);

              await txWstReq.query(`
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
                  @operation,
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

            // ค. ทำรายการตัดของสูญหาย (operation: 'deposit-lost') -> Trigger ลงตาราง inventory_lost
            if (lotLostQty > 0) {
              const lostTxRemark = lostCustomRemark
                ? `สินค้าสูญหาย (${targetOrderNo}): ${lostCustomRemark}`
                : `สินค้าสูญหาย (${targetOrderNo})`;

              const txLostReq = new sql.Request(transaction);
              txLostReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
              txLostReq.input('productId', sql.UniqueIdentifier, lot.product_id);
              txLostReq.input('operation', sql.NVarChar, 'deposit-lost');
              txLostReq.input('quantity', sql.Float, lotLostQty);
              txLostReq.input('price', sql.Float, Number(lot.price || 0));
              txLostReq.input('remark', sql.NVarChar, lostTxRemark);
              txLostReq.input('orderId', sql.NVarChar, targetOrderId);
              txLostReq.input('invId', sql.UniqueIdentifier, crypto.randomUUID());
              txLostReq.input('user', sql.NVarChar, currentUser.username);

              await txLostReq.query(`
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
                  @operation,
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
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 5.3 อัปเดตสถานะของคำสั่งซื้อในตาราง orders
      // ─────────────────────────────────────────────────────────────
      // หากมียอดส่งสินค้า > 0 -> เปลี่ยนเป็น 'S' (รอยืนยันการรับสินค้า)
      // หากยกเลิกทั้งหมด (ส่ง 0 ชิ้น) -> เปลี่ยนเป็น 'R' (ถูกปฏิเสธ)
      const nextStatus = totalPreparedQuantity > 0 ? 'S' : 'R';
      const orderRemark = totalPreparedQuantity > 0
        ? (body.remark?.trim() || null)
        : (body.remark?.trim() || 'ร้านค้ายกเลิกรายการสินค้าทั้งหมด');

      const upOrdReq = new sql.Request(transaction);
      upOrdReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
      upOrdReq.input('status', sql.NVarChar, nextStatus);
      upOrdReq.input('remark', sql.NVarChar, orderRemark);
      upOrdReq.input('user', sql.NVarChar, currentUser.username);

      await upOrdReq.query(`
        UPDATE orders
        SET status = @status,
            remark = @remark,
            update_by = @user,
            update_date = GETDATE()
        WHERE order_id = @orderId
      `);

      // อัปเดตตาราง order_approvals ด้วยถ้าหากถูกปฏิเสธทั้งหมด
      if (nextStatus === 'R') {
        const upAppReq = new sql.Request(transaction);
        upAppReq.input('orderId', sql.UniqueIdentifier, targetOrderId);
        upAppReq.input('status', sql.NVarChar, 'R');
        upAppReq.input('user', sql.NVarChar, currentUser.username);
        await upAppReq.query(`
          UPDATE order_approvals
          SET status = @status,
              response_by = @user,
              response_date = GETDATE()
          WHERE order_id = @orderId
        `);
      }

      await transaction.commit();

      const successMsg = nextStatus === 'S'
        ? `ยืนยันการจัดเตรียมสินค้าใบสั่งซื้อ "${targetOrderNo}" เรียบร้อยแล้ว (ส่งต่อให้ผู้รับสินค้า)`
        : `ยกเลิกรายการสินค้าคำสั่งซื้อ "${targetOrderNo}" และปรับสถานะเรียบร้อยแล้ว`;

      return NextResponse.json(
        {
          success: true,
          message: successMsg,
          data: {
            order_id: targetOrderId,
            order_no: targetOrderNo,
            status: nextStatus,
            total_prepared_quantity: totalPreparedQuantity,
          },
        },
        { status: 200 }
      );
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error('💥 [POST /api/orders/prepare error]:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกการจัดเตรียมสินค้า';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
