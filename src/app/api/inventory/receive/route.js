// src/app/api/inventory/receive/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inventory/receive
 * รับสินค้าเข้าคลัง รองรับ 4 ประเภท:
 * 1. สินค้าใหม่ (item_type: 'normal') -> operation = 'return', inventory_type = 'normal'
 * 2. สินค้าจองล่วงหน้า (item_type: 'preorder') -> operation = 'return', inventory_type = 'preorder'
 * 3. สินค้าชำรุด (item_type: 'waste') -> operation = 'deposit-waste'
 * 4. สินค้าหาย (item_type: 'lost') -> operation = 'deposit-lost'
 */
export async function POST(request) {
  try {
    // 1. ตรวจสอบสิทธิ์การเข้าใช้งาน
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }
    const currentUser = authResult.user;

    // 2. รับ Payload
    const body = await request.json();
    const { product_id, item_type = 'normal', quantity, price, remark = '' } = body;

    if (!product_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสสินค้า (product_id)' },
        { status: 400 }
      );
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุจำนวนสินค้าที่ถูกต้องและมากกว่า 0' },
        { status: 400 }
      );
    }

    const validTypes = ['normal', 'preorder', 'waste', 'lost'];
    if (!validTypes.includes(item_type)) {
      return NextResponse.json(
        { success: false, error: `ประเภทสินค้าไม่ถูกต้อง (${item_type})` },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 3. ตรวจสอบข้อมูลสินค้าและสิทธิ์ร้านค้า
    const productReq = pool.request();
    productReq.input('productId', sql.UniqueIdentifier, product_id);
    const productRes = await productReq.query(`
      SELECT product_id, product_name, store_id, product_price
      FROM products
      WHERE product_id = @productId
    `);

    const product = productRes.recordset[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลสินค้าที่ระบุในระบบ' },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (Admin หรือ เจ้าของร้านค้านี้)
    const isAdmin = currentUser.isAdmin;
    const isStoreOwner =
      product.store_id && currentUser.ownedStoreIds
        ? currentUser.ownedStoreIds.includes(product.store_id)
        : false;

    if (!isAdmin && !isStoreOwner) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์จัดการสต็อกสินค้าของร้านค้านี้' },
        { status: 403 }
      );
    }

    const numPrice =
      price !== undefined && price !== null && price !== ''
        ? parseFloat(price)
        : product.product_price || 0;

    // 4. บันทึกข้อมูลแบบ ACID Transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let invId = crypto.randomUUID();
      let operation = 'return';
      let inventoryType = 'normal';

      if (item_type === 'normal') {
        operation = 'return';
        inventoryType = 'normal';

        // ค้นหา Lot สินค้าปกติล่าสุด
        const findLotReq = new sql.Request(transaction);
        findLotReq.input('pid', sql.UniqueIdentifier, product_id);
        const findLot = await findLotReq.query(`
          SELECT TOP 1 inventory_id 
          FROM inventory 
          WHERE product_id = @pid AND (inventory_type = 'normal' OR inventory_type IS NULL) 
          ORDER BY inventory_date DESC
        `);

        if (findLot.recordset.length > 0) {
          invId = findLot.recordset[0].inventory_id;
        } else {
          // หากไม่มี Lot ใน inventory ให้สร้าง Record เริ่มต้นด้วย quantity = 0 ไว้เพื่อให้ trigger return บวกเข้าได้
          const createLotReq = new sql.Request(transaction);
          createLotReq.input('invId', sql.UniqueIdentifier, invId);
          createLotReq.input('pid', sql.UniqueIdentifier, product_id);
          createLotReq.input('price', sql.Float, numPrice);
          await createLotReq.query(`
            INSERT INTO inventory (inventory_id, inventory_date, product_id, quantity, price, inventory_type)
            VALUES (@invId, GETDATE(), @pid, 0, @price, 'normal')
          `);
        }
      } else if (item_type === 'preorder') {
        operation = 'return';
        inventoryType = 'preorder';

        // ค้นหา Lot สินค้าจองล่วงหน้าล่าสุด
        const findLotReq = new sql.Request(transaction);
        findLotReq.input('pid', sql.UniqueIdentifier, product_id);
        const findLot = await findLotReq.query(`
          SELECT TOP 1 inventory_id 
          FROM inventory 
          WHERE product_id = @pid AND inventory_type = 'preorder' 
          ORDER BY inventory_date DESC
        `);

        if (findLot.recordset.length > 0) {
          invId = findLot.recordset[0].inventory_id;
        } else {
          // สร้าง Lot พรีออเดอร์เริ่มต้น
          const createLotReq = new sql.Request(transaction);
          createLotReq.input('invId', sql.UniqueIdentifier, invId);
          createLotReq.input('pid', sql.UniqueIdentifier, product_id);
          createLotReq.input('price', sql.Float, numPrice);
          await createLotReq.query(`
            INSERT INTO inventory (inventory_id, inventory_date, product_id, quantity, price, inventory_type)
            VALUES (@invId, GETDATE(), @pid, 0, @price, 'preorder')
          `);
        }
      } else if (item_type === 'waste') {
        operation = 'deposit-waste';
        inventoryType = 'normal';
      } else if (item_type === 'lost') {
        operation = 'deposit-lost';
        inventoryType = 'normal';
      }

      const txId = crypto.randomUUID();
      const updateBy = (currentUser.username || 'SYSTEM').substring(0, 16);

      const txReq = new sql.Request(transaction);
      txReq.input('txId', sql.UniqueIdentifier, txId);
      txReq.input('pid', sql.UniqueIdentifier, product_id);
      txReq.input('operation', sql.NVarChar, operation);
      txReq.input('quantity', sql.Float, numQty);
      txReq.input('price', sql.Float, numPrice);
      txReq.input('remark', sql.NVarChar, remark || null);
      txReq.input('invId', sql.UniqueIdentifier, invId);
      txReq.input('updateBy', sql.NVarChar, updateBy);
      txReq.input('invType', sql.NVarChar, inventoryType);

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
          update_by,
          inventory_type
        ) VALUES (
          @txId,
          GETDATE(),
          @pid,
          @operation,
          @quantity,
          @price,
          NULL,
          @remark,
          NULL,
          @invId,
          @updateBy,
          @invType
        )
      `);

      await transaction.commit();

      const typeLabels = {
        normal: 'สินค้าใหม่',
        preorder: 'สินค้าจองล่วงหน้า',
        waste: 'สินค้าชำรุด',
        lost: 'สินค้าหาย',
      };

      return NextResponse.json({
        success: true,
        message: `รับสินค้าเข้าคลัง (${typeLabels[item_type]}) เรียบร้อยแล้ว`,
        data: {
          product_id,
          operation,
          inventory_type: inventoryType,
          quantity: numQty,
          price: numPrice,
          inventory_id: invId,
          transaction_id: txId,
        },
      });
    } catch (txErr) {
      await transaction.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error('POST /api/inventory/receive error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการรับสินค้าเข้าคลัง',
      },
      { status: 500 }
    );
  }
}
