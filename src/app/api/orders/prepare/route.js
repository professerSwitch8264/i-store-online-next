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
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

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

    // ตรวจสอบสิทธิ์: ผู้ใช้ต้องเป็นเจ้าของร้านค้า (Store Owner)
    const isStoreOwner = targetStoreId && currentUser.ownedStoreIds
      ? currentUser.ownedStoreIds.includes(targetStoreId)
      : false;

    if (!isStoreOwner) {
      return NextResponse.json(
        {
          success: false,
          error: 'คุณไม่มีสิทธิ์จัดการจัดเตรียมสินค้าของร้านค้านี้ (เฉพาะเจ้าของร้านค้าเท่านั้น)',
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
      SELECT i.item_id, i.order_id, i.product_id, i.inventory_id, i.quantity_order, i.quantity, i.price, i.quantity_sent, i.remark,
             p.product_name
      FROM items i
      LEFT JOIN products p ON i.product_id = p.product_id
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

      // หากเป็นคำสั่งซื้อแบบพรีออเดอร์ (isPreorder): ตรวจสอบจำนวนคงเหลือจริงจาก View v_inventory_preorder
      if (isPreorder) {
        const preCheckReq = new sql.Request(transaction);
        const preCheckRes = await preCheckReq.query(`
          SELECT product_id, quantity 
          FROM v_inventory_preorder
        `);
        const preorderStockMap = {};
        (preCheckRes.recordset || []).forEach((row) => {
          preorderStockMap[String(row.product_id).toLowerCase()] = Number(row.quantity || 0);
        });

        for (const prepItem of prepared_items) {
          const pId = String(prepItem.product_id || '').toLowerCase();
          const isCancelled = prepItem.action === 'CANCELLED' || Number(prepItem.quantity_sent) === 0;
          const sentQty = isCancelled ? 0 : Math.max(0, Number(prepItem.quantity_sent || 0));
          const availableStock = preorderStockMap[pId] || 0;

          if (sentQty > availableStock) {
            const matchedLot = (itemsByProduct[pId] || [])[0];
            const pName = matchedLot?.product_name || `รหัส ${prepItem.product_id}`;
            await transaction.rollback();
            return NextResponse.json(
              {
                success: false,
                error: `สินค้า "${pName}" เกินจำนวนจริงในคลังพรีออเดอร์ (ในคลังมี ${availableStock} ชิ้น แต่ระบุส่ง ${sentQty} ชิ้น)`,
              },
              { status: 400 }
            );
          }
        }
      }

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
          // สำหรับพรีออเดอร์ หากมียอดส่งมอบ (lotSentQty > 0) ให้สร้าง assignedInvId ไว้ผูกกับล๊อตพรีออเดอร์ใหม่
          const assignedInvId = isPreorder && lotSentQty > 0 ? crypto.randomUUID() : lot.inventory_id;

          const upItemReq = new sql.Request(transaction);
          upItemReq.input('itemId', sql.UniqueIdentifier, lot.item_id);
          upItemReq.input('qtySent', sql.Float, lotSentQty);
          upItemReq.input('remark', sql.NVarChar, itemSummaryRemark);
          upItemReq.input('invId', sql.UniqueIdentifier, assignedInvId);
          upItemReq.input('user', sql.NVarChar, currentUser.username);

          await upItemReq.query(`
            UPDATE items
            SET quantity_sent = @qtySent,
                inventory_id = @invId,
                remark = @remark,
                update_by = @user,
                update_date = GETDATE()
            WHERE item_id = @itemId
          `);

          // 5.3 บันทึก Transaction สำหรับสินค้าพรีออเดอร์ที่จัดส่งจริง (operation: 'deposit', inventory_type: 'preorder')
          if (isPreorder && lotSentQty > 0) {
            const prepTxRemark = `จัดเตรียมสินค้าพรีออเดอร์ (${targetOrderNo})${itemSummaryRemark ? `: ${itemSummaryRemark}` : ''}`;

            const txPreReq = new sql.Request(transaction);
            txPreReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
            txPreReq.input('productId', sql.UniqueIdentifier, lot.product_id);
            txPreReq.input('operation', sql.NVarChar, 'deposit');
            txPreReq.input('inventoryType', sql.NVarChar, 'preorder');
            txPreReq.input('quantity', sql.Float, lotSentQty);
            txPreReq.input('price', sql.Float, Number(lot.price || 0));
            txPreReq.input('remark', sql.NVarChar, prepTxRemark);
            txPreReq.input('orderId', sql.NVarChar, targetOrderId);
            txPreReq.input('invId', sql.UniqueIdentifier, assignedInvId);
            txPreReq.input('user', sql.NVarChar, currentUser.username);

            await txPreReq.query(`
              INSERT INTO inventory_transaction (
                transaction_id,
                transaction_date,
                product_id,
                operation,
                inventory_type,
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
                @inventoryType,
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

          // 5.4 ทำรายการคืนสต็อกเข้าคลังปกติ (operation: 'return', inventory_type: 'normal')
          if (lotReturnQty > 0) {
            let returnInvId;

            if (isPreorder) {
              // สินค้าพรีออเดอร์เดิมไม่มีล๊อตในคลังปกติ -> ค้นหาล๊อตปกติของสินค้านี้เพื่อคืนเข้า
              const normalLotReq = new sql.Request(transaction);
              normalLotReq.input('productId', sql.UniqueIdentifier, lot.product_id);
              const normalLotRes = await normalLotReq.query(`
                SELECT TOP 1 inventory_id 
                FROM inventory 
                WHERE product_id = @productId 
                  AND (inventory_type = 'normal' OR inventory_type IS NULL)
                ORDER BY quantity DESC
              `);

              if (normalLotRes.recordset.length > 0) {
                returnInvId = normalLotRes.recordset[0].inventory_id;
              } else {
                // หากยังไม่เคยมีล๊อตปกติ ให้สร้างล๊อตปกติใหม่รองรับ
                returnInvId = crypto.randomUUID();
                const createLotReq = new sql.Request(transaction);
                createLotReq.input('newInvId', sql.UniqueIdentifier, returnInvId);
                createLotReq.input('productId', sql.UniqueIdentifier, lot.product_id);
                createLotReq.input('price', sql.Float, Number(lot.price || 0));
                await createLotReq.query(`
                  INSERT INTO inventory (
                    inventory_id, inventory_date, product_id, quantity, price, update_date, inventory_type
                  ) VALUES (
                    @newInvId, GETDATE(), @productId, 0, @price, GETDATE(), 'normal'
                  )
                `);
              }
            } else {
              returnInvId = lot.inventory_id || '00000000-0000-0000-0000-000000000000';
            }

            const txRemark = isPreorder
              ? `คืนสต็อกสินค้าพรีออเดอร์เข้าคลังปกติ (${targetOrderNo})${returnRemark ? `: ${returnRemark}` : ''}`
              : `คืนสต็อกคำสั่งซื้อ (${targetOrderNo})${returnRemark ? `: ${returnRemark}` : ''}`;

            const txRetReq = new sql.Request(transaction);
            txRetReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
            txRetReq.input('productId', sql.UniqueIdentifier, lot.product_id);
            txRetReq.input('operation', sql.NVarChar, 'return');
            txRetReq.input('inventoryType', sql.NVarChar, 'normal');
            txRetReq.input('quantity', sql.Float, lotReturnQty);
            txRetReq.input('price', sql.Float, Number(lot.price || 0));
            txRetReq.input('remark', sql.NVarChar, txRemark);
            txRetReq.input('orderId', sql.NVarChar, targetOrderId);
            txRetReq.input('invId', sql.UniqueIdentifier, returnInvId);
            txRetReq.input('user', sql.NVarChar, currentUser.username);

            await txRetReq.query(`
              INSERT INTO inventory_transaction (
                transaction_id,
                transaction_date,
                product_id,
                operation,
                inventory_type,
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
                @inventoryType,
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

          // 5.5 ทำรายการตัดของชำรุดเข้าคลังปกติ (operation: 'deposit-waste', inventory_type: 'normal') -> Trigger ลงตาราง inventory_waste
          if (lotWasteQty > 0) {
            const wasteTxRemark = wasteCustomRemark
              ? `สินค้าชำรุด (${targetOrderNo}): ${wasteCustomRemark}`
              : `สินค้าชำรุด (${targetOrderNo})`;

            const txWstReq = new sql.Request(transaction);
            txWstReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
            txWstReq.input('productId', sql.UniqueIdentifier, lot.product_id);
            txWstReq.input('operation', sql.NVarChar, 'deposit-waste');
            txWstReq.input('inventoryType', sql.NVarChar, 'normal');
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
                inventory_type,
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
                @inventoryType,
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

          // 5.6 ทำรายการตัดของสูญหายเข้าคลังปกติ (operation: 'deposit-lost', inventory_type: 'normal') -> Trigger ลงตาราง inventory_lost
          if (lotLostQty > 0) {
            const lostTxRemark = lostCustomRemark
              ? `สินค้าสูญหาย (${targetOrderNo}): ${lostCustomRemark}`
              : `สินค้าสูญหาย (${targetOrderNo})`;

            const txLostReq = new sql.Request(transaction);
            txLostReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
            txLostReq.input('productId', sql.UniqueIdentifier, lot.product_id);
            txLostReq.input('operation', sql.NVarChar, 'deposit-lost');
            txLostReq.input('inventoryType', sql.NVarChar, 'normal');
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
                inventory_type,
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
                @inventoryType,
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

      // ไม่เขียนทับ order_approvals เมื่อร้านค้าปฏิเสธคำสั่งซื้อในขั้นตอนจัดเตรียม
      // เพื่อคงประวัติและสถานะการอนุมัติเดิมของหัวหน้าไว้

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
