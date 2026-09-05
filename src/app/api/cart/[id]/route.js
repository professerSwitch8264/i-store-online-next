// src/app/api/cart/[id]/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * ─────────────────────────────────────────────────────────────────────────
 * 1. PUT /api/cart/[id]
 * หน้าที่: ปรับปรุงจำนวนสินค้า (Quantity) ในตะกร้าเฉพาะของเจ้าของตะกร้าเท่านั้น
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function PUT(request, { params }) {
  try {
    // 1. ตรวจสอบการยืนยันตัวตน (Authentication Token)
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    // username: ชื่อผู้ใช้งานที่ล็อกอิน ดึงจาก Token ที่ผ่านการตรวจสอบแล้ว
    const username = authResult.user.username;

    // id: รหัสรายการสินค้าในตะกร้า (UUID ในตาราง carts)
    const { id } = await params;

    // body: ข้อมูล JSON ที่ Client ส่งมา
    const body = await request.json();

    // rawQuantity: จำนวนสินค้าชิ้นใหม่ที่ผู้ใช้ต้องการปรับ
    const rawQuantity = Number(body.quantity);

    if (isNaN(rawQuantity)) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ quantity ที่ต้องการอัปเดตเป็นตัวเลข' },
        { status: 400 }
      );
    }

    // pool: Instance เชื่อมต่อฐานข้อมูล MSSQL
    const pool = await getDbPool();

    // 2. ตรวจสอบว่ามีรายการนี้ในตะกร้าหรือไม่ และเป็นของผู้ใช้นี้จริงหรือไม่
    const cartCheck = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query(`
        SELECT id, username, product_id, reserve_flag, quantity 
        FROM carts 
        WHERE id = @id
      `);

    if (cartCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: `ไม่พบรายการในตะกร้า ID: ${id}` },
        { status: 404 }
      );
    }

    // cartItem: ข้อมูลรายการสินค้าในตะกร้าแถวที่ค้นพบ
    const cartItem = cartCheck.recordset[0];

    // ป้องกันการแอบอ้างสิทธิ์ (IDOR Prevention): ตรวจสอบว่าผู้ใช้เป็นเจ้าของตะกร้าจริง
    if (cartItem.username.toUpperCase() !== username.toUpperCase()) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขรายการในตะกร้าของผู้อื่น' },
        { status: 403 }
      );
    }

    // 3. หากปรับจำนวนเป็น 0 หรือติดลบ ให้ทำการลบรายการออกจากตะกร้าทันที
    if (rawQuantity <= 0) {
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, id)
        .query('DELETE FROM carts WHERE id = @id');

      return NextResponse.json(
        {
          success: true,
          message: 'ลบรายการออกจากตะกร้าเรียบร้อยแล้ว',
          data: null,
        },
        { status: 200 }
      );
    }

    // 4. ตรวจสอบข้อมูลสินค้าเพื่อคำนวณ batch_size, order_limit และสต็อกจริง
    const productCheck = await pool
      .request()
      .input('pid', sql.UniqueIdentifier, cartItem.product_id)
      .query(`
        SELECT 
          p.product_id, 
          p.product_name, 
          p.order_limit, 
          p.batch_size,
          ISNULL(inv.quantity, 0) AS stock_quantity
        FROM products p
        LEFT JOIN v_inventory inv ON p.product_id = inv.product_id
        WHERE p.product_id = @pid
      `);

    let validQuantity = rawQuantity;

    if (productCheck.recordset.length > 0) {
      const product = productCheck.recordset[0];

      // batchSize: ขนาดขั้นการสั่งซื้อ เช่น สั่งทีละ 1 หรือ ทีละ 10 (ถ้าไม่มีให้เป็น 1)
      const batchSize = product.batch_size && product.batch_size > 0 ? product.batch_size : 1;

      // maxLimit: เพดานจำนวนสูงสุดที่สั่งได้ (สำหรับกรณีไม่ใช่การจองล่วงหน้า)
      let maxLimit = 999999;
      if (cartItem.reserve_flag !== 'Y') {
        const realStock = typeof product.stock_quantity === 'number' ? product.stock_quantity : 0;
        let stockOrLimit = realStock;

        // ถ้ามีกำหนด order_limit ไว้ ให้ใช้ค่าน้อยกว่าระหว่าง สต็อกจริง กับ order_limit
        if (typeof product.order_limit === 'number' && product.order_limit > 0) {
          stockOrLimit = Math.min(realStock, product.order_limit);
        }
        maxLimit = stockOrLimit;
      }

      // ปรับให้ตรงกับพหุคูณของ batch_size
      const maxMultiple = Math.floor(maxLimit / batchSize) * batchSize;
      const maxAllowed = maxMultiple >= batchSize ? maxMultiple : maxLimit;

      validQuantity = Math.floor(validQuantity / batchSize) * batchSize;
      if (validQuantity < batchSize) {
        validQuantity = batchSize;
      }
      if (validQuantity > maxAllowed) {
        validQuantity = maxAllowed;
      }
    }

    // 5. บันทึกจำนวนสินค้าใหม่ลงในตาราง carts
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('quantity', sql.Float, validQuantity)
      .query(`
        UPDATE carts 
        SET quantity = @quantity, update_date = GETDATE() 
        WHERE id = @id
      `);

    return NextResponse.json(
      {
        success: true,
        message: 'อัปเดตจำนวนสินค้าในตะกร้าเรียบร้อยแล้ว',
        data: {
          id,
          quantity: validQuantity,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PUT /api/cart/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถอัปเดตจำนวนสินค้าได้' },
      { status: 500 }
    );
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * 2. DELETE /api/cart/[id]
 * หน้าที่: ลบสินค้าชิ้นนั้นออกจากตะกร้าเฉพาะของเจ้าของตะกร้าเท่านั้น
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function DELETE(request, { params }) {
  try {
    // 1. ตรวจสอบการยืนยันตัวตน
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    // username: ชื่อผู้ใช้งานจาก Token
    const username = authResult.user.username;

    // id: รหัสรายการสินค้าในตะกร้า
    const { id } = await params;

    // pool: เชื่อมต่อฐานข้อมูล MSSQL
    const pool = await getDbPool();

    // 2. ตรวจสอบการมีอยู่และความเป็นเจ้าของ
    const cartCheck = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query('SELECT id, username FROM carts WHERE id = @id');

    if (cartCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: true, message: 'รายการนี้ไม่อยู่ในตะกร้าแล้ว' },
        { status: 200 }
      );
    }

    const cartItem = cartCheck.recordset[0];

    // ป้องกันการแอบลบตะกร้าของผู้อื่น
    if (cartItem.username.toUpperCase() !== username.toUpperCase()) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์ลบรายการในตะกร้าของผู้อื่น' },
        { status: 403 }
      );
    }

    // 3. ลบรายการออกจากตาราง carts
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query('DELETE FROM carts WHERE id = @id');

    return NextResponse.json(
      {
        success: true,
        message: `ลบรายการ ID: ${id} ออกจากตะกร้าเรียบร้อยแล้ว`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/cart/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'ไม่สามารถลบรายการได้' },
      { status: 500 }
    );
  }
}
