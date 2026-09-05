// src/app/api/cart/route.js
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDbPool, sql } from '@/app/lib/db';           
import { verifyApiAuth } from '@/app/lib/serverAuth';    

// ─────────────────────────────────────────────────────────────────────────
// 1. GET /api/cart
// ดึงรายการสินค้าในตะกร้าของผู้ใช้งานที่เข้าสู่ระบบ
// ─────────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    // 1. 🛡️ ตรวจสอบ Token ก่อนเสมอ
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const { searchParams } = new URL(request.url);
    const reserve_flag = searchParams.get('reserve_flag'); // 'N' หรือ 'Y' (ถ้าไม่ระบุจะดึงทั้งหมด)

    const pool = await getDbPool();
    const req = pool.request();
    req.input('username', sql.NVarChar, username);

    // 2. Query ดึงรายการใน carts พร้อม JOIN ข้อมูลสินค้า
    let query = `
      SELECT 
        c.id,
        c.username,
        c.product_id,
        c.reserve_flag,
        c.quantity,
        c.update_date,
        p.product_name,
        p.product_thumbnail,
        p.product_price,
        p.order_limit,
        p.batch_size,
        p.store_id,
        s.store_name,
        s.store_access,
        u.unit AS unit_name,
        c_cat.category_name,
        ISNULL(inv.quantity, 0) AS stock_quantity
      FROM carts c
      JOIN products p ON c.product_id = p.product_id
      LEFT JOIN stores s ON p.store_id = s.store_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      LEFT JOIN categories c_cat ON p.category_id = c_cat.category_id
      LEFT JOIN v_inventory inv ON p.product_id = inv.product_id
      WHERE c.username = @username
    `;

    // ถ้าส่ง reserve_flag มา ให้กรองเฉพาะประเภทนั้น ('N' = ปกติ, 'Y' = พรีออเดอร์)
    if (reserve_flag) {
      req.input('reserveFlag', sql.NVarChar, reserve_flag);
      query += ` AND c.reserve_flag = @reserveFlag`;
    }

    // เรียงลำดับตาม id ของรายการในตะกร้า เพื่อให้ตำแหน่งคงที่เสมอ ไม่สลับไปมาเมื่อมีการแก้ไขจำนวน
    query += ` ORDER BY c.id ASC`;

    const result = await req.query(query);

    // 3. จัดโครงสร้างข้อมูลให้มี object product แยกออกมาอย่างสวยงาม
    let totalQuantity = 0;
    let totalPrice = 0;

    const items = result.recordset.map((row) => {
      const price = row.product_price ?? 0;
      totalQuantity += row.quantity;
      totalPrice += price * row.quantity;

      return {
        id: row.id,
        username: row.username,
        product_id: row.product_id,
        reserve_flag: row.reserve_flag,
        quantity: row.quantity,
        update_date: row.update_date,
        product: {
          product_id: row.product_id,
          product_name: row.product_name,
          product_thumbnail: row.product_thumbnail,
          product_price: row.product_price,
          order_limit: row.order_limit,
          batch_size: row.batch_size,
          store_id: row.store_id,
          store_name: row.store_name,
          store_access: row.store_access,
          unit_name: row.unit_name,
          category_name: row.category_name,
          stock_quantity: row.stock_quantity,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: items,
      summary: {
        totalItems: items.length,
        totalQuantity,
        totalPrice,
      },
    });
  } catch (error) {
    console.error('GET /api/cart error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. POST /api/cart
// เพิ่มสินค้าลงในตะกร้า (ถ้ามีอยู่แล้วจะบวกจำนวนเพิ่ม)
// ─────────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const body = await request.json();
    const product_id = body.product_id?.trim();
    const quantity = Number(body.quantity);
    const reserve_flag = body.reserve_flag === 'Y' ? 'Y' : 'N';

    if (!product_id || !quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ product_id และ quantity ให้ถูกต้อง (> 0)' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1. ตรวจสอบว่ามีสินค้านี้ในระบบหรือไม่
    const checkProduct = await pool
      .request()
      .input('pid', sql.UniqueIdentifier, product_id)
      .query('SELECT product_id, product_name, order_limit FROM products WHERE product_id = @pid');

    if (checkProduct.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสินค้านี้ในระบบ' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่าในตะกร้ามีสินค้านี้อยู่แล้วหรือไม่
    const checkCart = await pool
      .request()
      .input('username', sql.NVarChar, username)
      .input('pid', sql.UniqueIdentifier, product_id)
      .input('reserveFlag', sql.NVarChar, reserve_flag)
      .query(`
        SELECT id, quantity 
        FROM carts 
        WHERE username = @username 
          AND product_id = @pid 
          AND reserve_flag = @reserveFlag
      `);

    if (checkCart.recordset.length > 0) {
      // 2.1 มีอยู่แล้ว -> UPDATE บวกจำนวนเพิ่มเข้าไป
      const existing = checkCart.recordset[0];
      const newQuantity = existing.quantity + quantity;

      await pool
        .request()
        .input('id', sql.UniqueIdentifier, existing.id)
        .input('newQty', sql.Float, newQuantity)
        .query('UPDATE carts SET quantity = @newQty, update_date = GETDATE() WHERE id = @id');
    } else {
      // 2.2 ยังไม่มี -> INSERT รายการใหม่
      const newId = crypto.randomUUID();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier, newId)
        .input('username', sql.NVarChar, username)
        .input('pid', sql.UniqueIdentifier, product_id)
        .input('reserveFlag', sql.NVarChar, reserve_flag)
        .input('qty', sql.Float, quantity)
        .query(`
          INSERT INTO carts (id, username, product_id, reserve_flag, quantity, update_date)
          VALUES (@id, @username, @pid, @reserveFlag, @qty, GETDATE())
        `);
    }

    return NextResponse.json({
      success: true,
      message: 'เพิ่มสินค้าลงในตะกร้าเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('POST /api/cart error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. DELETE /api/cart
// ล้างตะกร้าสินค้าทั้งหมดของผู้ใช้คนนี้
// ─────────────────────────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const { searchParams } = new URL(request.url);
    const reserve_flag = searchParams.get('reserve_flag');

    const pool = await getDbPool();
    const req = pool.request();
    req.input('username', sql.NVarChar, username);

    let query = 'DELETE FROM carts WHERE username = @username';
    if (reserve_flag) {
      req.input('reserveFlag', sql.NVarChar, reserve_flag);
      query += ' AND reserve_flag = @reserveFlag';
    }

    const result = await req.query(query);

    return NextResponse.json({
      success: true,
      message: `ล้างรายการในตะกร้าเรียบร้อยแล้ว (${result.rowsAffected[0]} รายการ)`,
    });
  } catch (error) {
    console.error('DELETE /api/cart error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}