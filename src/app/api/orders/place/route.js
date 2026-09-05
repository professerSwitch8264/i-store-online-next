// src/app/api/orders/place/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * ─────────────────────────────────────────────────────────────────────────
 * POST /api/orders/place
 * หน้าที่: สร้างใบสั่งซื้อ / สั่งจองสินค้า (Place Order)
 * - ตรวจสอบสต็อกสินค้าและคำนวณการตัดสต็อกแบบ FIFO (First-In, First-Out)
 * - ค้นหาสายการอนุมัติตามฝ่าย/แผนกของผู้สั่งซื้อ
 * - บันทึกข้อมูลแบบ ACID Transaction (orders, inventory_transaction, order_approvals, ลบ carts)
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function POST(request) {
  try {
    // 0. ตรวจสอบสิทธิ์การเข้าใช้งานผ่าน Token (Authentication Check)
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    // currentUser: ข้อมูลผู้ใช้งานที่ผ่านการตรวจสอบ Token
    const currentUser = authResult.user;

    // owner: ชื่อผู้ใช้งานที่สั่งซื้อ (บังคับดึงจาก Token เสมอ ป้องกันการแอบอ้างสิทธิ์)
    const owner = currentUser.username;

    // body: ข้อมูล JSON ที่ Client ส่งมา
    const body = await request.json();

    // store_id: รหัสร้านค้า (UUID)
    const store_id = body.store_id?.trim();

    // shipping_location: รหัสสถานที่จัดส่ง (UUID)
    const shipping_location = body.shipping_location?.trim() || '00000000-0000-0000-0000-000000000000';

    // reserve_flag: 'Y' = สั่งจองล่วงหน้า (Pre-order), 'N' = สั่งซื้อปกติ
    const reserve_flag = body.reserve_flag === 'Y' ? 'Y' : 'N';

    // products: รายการสินค้าที่ต้องการสั่งซื้อ [{ product_id, quantity }]
    const products = Array.isArray(body.products) ? body.products : [];

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสร้านค้า (store_id)' },
        { status: 400 }
      );
    }

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรายการสินค้าที่ต้องการสั่งซื้อ' },
        { status: 400 }
      );
    }

    // pool: Instance สำหรับเชื่อมต่อกับ MSSQL Server
    const pool = await getDbPool();

    // withdrawItems: อาร์เรย์เก็บรายการที่ต้องตัดสต็อกแต่ละ Lot (FIFO)
    const withdrawItems = [];

    // 1. ตรวจสอบข้อมูลสินค้าและคำนวณการตัดสต็อกแบบ FIFO
    for (const item of products) {
      // productReq: ตรวจสอบว่าสินค้ามีอยู่จริงและดึงชื่อกับราคา
      const productReq = await pool
        .request()
        .input('pid', sql.UniqueIdentifier, item.product_id)
        .query('SELECT product_id, product_name, product_price FROM products WHERE product_id = @pid');

      if (productReq.recordset.length === 0) {
        return NextResponse.json(
          { success: false, error: `ไม่พบข้อมูลสินค้ารหัส ${item.product_id} ในระบบ` },
          { status: 400 }
        );
      }

      const productInfo = productReq.recordset[0];

      // กรณีสั่งซื้อปกติ (ไม่ใช่การสั่งจองล่วงหน้า) -> ต้องตัดสต็อกจริงตาม FIFO
      if (reserve_flag !== 'Y') {
        const lotReq = await pool
          .request()
          .input('pid', sql.UniqueIdentifier, item.product_id)
          .query(`
            SELECT inventory_id, inventory_date, quantity, price 
            FROM inventory 
            WHERE product_id = @pid AND quantity > 0 
            ORDER BY inventory_date ASC
          `);

        const availableLots = lotReq.recordset;
        let remainingNeeded = Number(item.quantity);

        for (const lot of availableLots) {
          if (remainingNeeded <= 0) break;

          // takeQty: จำนวนชิ้นที่จะตัดออกจาก Lot นี้
          const takeQty = Math.min(lot.quantity, remainingNeeded);

          withdrawItems.push({
            inventory_id: lot.inventory_id,
            inventory_date: lot.inventory_date || new Date(),
            product_id: item.product_id,
            withdraw_quantity: takeQty,
            price: Number(lot.price || productInfo.product_price || 0),
          });

          remainingNeeded -= takeQty;
        }

        // หากสต็อกในทุก Lot รวมกันแล้วยังไม่พอ
        if (remainingNeeded > 0) {
          const totalInStock = availableLots.reduce((sum, l) => sum + Number(l.quantity), 0);
          return NextResponse.json(
            {
              success: false,
              error: `สินค้า "${productInfo.product_name}" มีสต็อกคงเหลือไม่เพียงพอ (ต้องการ ${item.quantity} ชิ้น แต่มีในคลัง ${totalInStock} ชิ้น)`,
            },
            { status: 400 }
          );
        }
      } else {
        // กรณีสั่งจองล่วงหน้า (Pre-order) -> ใช้รหัส Dummy Lot 00000000...
        withdrawItems.push({
          inventory_id: '00000000-0000-0000-0000-000000000000',
          inventory_date: new Date(),
          product_id: item.product_id,
          withdraw_quantity: Number(item.quantity),
          price: Number(productInfo.product_price || 0),
        });
      }
    }

    // 2. ค้นหาสายการอนุมัติ (Approvers) ตามแผนกของผู้สั่งซื้อ
    let departmentCode = '';
    try {
      const userReq = await pool
        .request()
        .input('username', sql.NVarChar, owner)
        .query('SELECT department FROM ref_accounts WHERE username = @username');

      if (userReq.recordset.length > 0) {
        departmentCode = userReq.recordset[0].department || '';
      }
    } catch (deptErr) {
      console.warn('Cannot fetch department from ref_accounts:', deptErr);
    }

    let approverUsernames = [];
    try {
      const approverQuery = departmentCode
        ? `SELECT username FROM order_approvers WHERE department_code = @dept`
        : `SELECT username FROM order_approvers`;

      const approverReq = pool.request();
      if (departmentCode) {
        approverReq.input('dept', sql.NVarChar, departmentCode);
      }
      const approverResult = await approverReq.query(approverQuery);
      approverUsernames = approverResult.recordset.map((a) => a.username).filter(Boolean);
    } catch (approverErr) {
      console.warn('Cannot fetch approvers:', approverErr);
    }

    // approversString: รายชื่อผู้อนุมัติคั่นด้วยเครื่องหมายจุลภาค (Comma)
    const approversString = approverUsernames.join(',');

    // orderId: รหัส UUID สุ่มใหม่สำหรับเอกสารคำสั่งซื้อนี้
    const orderId = crypto.randomUUID().toUpperCase();

    // 3. ทำการบันทึกข้อมูลแบบ ACID Transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let orderNo = orderId;

    try {
      // 3.1 บันทึกหัวเอกสารคำสั่งซื้อลงตาราง orders (Trigger ในฐานข้อมูลจะสร้าง order_no ให้)
      const insertOrderReq = new sql.Request(transaction);
      insertOrderReq.input('orderId', sql.UniqueIdentifier, orderId);
      insertOrderReq.input('storeId', sql.UniqueIdentifier, store_id);
      insertOrderReq.input('owner', sql.NVarChar, owner);
      insertOrderReq.input('shippingLocation', sql.UniqueIdentifier, shipping_location);
      insertOrderReq.input('reserveFlag', sql.NVarChar, reserve_flag);
      insertOrderReq.input('updateBy', sql.NVarChar, owner);

      await insertOrderReq.query(`
        INSERT INTO orders (order_id, store_id, owner, shipping_location, reserve_flag, status, update_by, order_date, update_date)
        VALUES (@orderId, @storeId, @owner, @shippingLocation, @reserveFlag, 'P', @updateBy, GETDATE(), GETDATE())
      `);

      // ดึง order_no ที่ Trigger ในฐานข้อมูลสร้างขึ้น
      const getOrderNoReq = new sql.Request(transaction);
      getOrderNoReq.input('orderId', sql.UniqueIdentifier, orderId);
      const orderRecord = await getOrderNoReq.query(
        'SELECT order_no FROM orders WHERE order_id = @orderId'
      );
      if (orderRecord.recordset.length > 0 && orderRecord.recordset[0].order_no) {
        orderNo = orderRecord.recordset[0].order_no;
      }

      // 3.2 บันทึกประวัติการตัดสต็อกสินค้าลงตาราง inventory_transaction
      for (const item of withdrawItems) {
        const txReq = new sql.Request(transaction);
        txReq.input('txId', sql.UniqueIdentifier, crypto.randomUUID());
        txReq.input('productId', sql.UniqueIdentifier, item.product_id);
        txReq.input('quantity', sql.Float, item.withdraw_quantity);
        txReq.input('price', sql.Float, item.price);
        txReq.input('orderId', sql.NVarChar, orderId);
        txReq.input('inventoryId', sql.UniqueIdentifier, item.inventory_id);
        txReq.input('updateBy', sql.NVarChar, owner);

        await txReq.query(`
          INSERT INTO inventory_transaction (
            transaction_id, transaction_date, product_id, operation, quantity, price, order_id, inventory_id, update_by
          )
          VALUES (
            @txId, GETDATE(), @productId, 'withdraw', @quantity, @price, @orderId, @inventoryId, @updateBy
          )
        `);
      }

      // 3.3 บันทึกสายการอนุมัติลงตาราง order_approvals
      const approvalReq = new sql.Request(transaction);
      approvalReq.input('approvalId', sql.UniqueIdentifier, crypto.randomUUID());
      approvalReq.input('orderId', sql.UniqueIdentifier, orderId);
      approvalReq.input('approvers', sql.NVarChar, approversString);

      await approvalReq.query(`
        INSERT INTO order_approvals (approval_id, request_date, order_id, status, approvers, en)
        VALUES (@approvalId, GETDATE(), @orderId, 'P', @approvers, 'Y')
      `);

      // 3.4 ลบสินค้าที่ถูกสั่งซื้อออกจากตารางตะกร้า carts
      for (const p of products) {
        const deleteCartReq = new sql.Request(transaction);
        deleteCartReq.input('username', sql.NVarChar, owner);
        deleteCartReq.input('productId', sql.UniqueIdentifier, p.product_id);
        deleteCartReq.input('reserveFlag', sql.NVarChar, reserve_flag);

        await deleteCartReq.query(`
          DELETE FROM carts 
          WHERE username = @username 
            AND product_id = @productId 
            AND reserve_flag = @reserveFlag
        `);
      }

      // ทำการ Commit บันทึกทุกอย่างลงฐานข้อมูลพร้อมกัน
      await transaction.commit();
    } catch (txErr) {
      // หากมีจุดใดล้มเหลว ทำการ Rollback คืนค่าเดิมทั้งหมด ป้องกันข้อมูลเสียหาย
      await transaction.rollback();
      throw txErr;
    }

    return NextResponse.json({
      success: true,
      message: 'สร้างคำสั่งซื้อและส่งคำขออนุมัติเรียบร้อยแล้ว',
      data: {
        order_id: orderId,
        order_no: orderNo,
        owner,
        store_id,
        reserve_flag,
        status: 'P',
        approvers: approverUsernames,
        total_items: products.length,
      },
    });
  } catch (error) {
    console.error('Fatal Error in POST /api/orders/place:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ' },
      { status: 500 }
    );
  }
}
