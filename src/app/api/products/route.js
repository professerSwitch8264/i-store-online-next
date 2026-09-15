// src/app/api/products/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. ตรวจสอบ Token
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const allowedPrivateStoreIds = currentUser.allowedPrivateStoreIds || [];

    // 2. รับ Query Parameters (เพิ่ม page และ limit ทีละ 12)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category_id') || '';
    const storeId = searchParams.get('store_id') || '';
    const includeAll = searchParams.get('include_all') === 'true';

    // 📄 คำนวณหน้าและจำนวนที่จะดึง
    const parsedPage = parseInt(searchParams.get('page'), 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedLimit = parseInt(searchParams.get('limit'), 10);
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 12 : Math.min(100, parsedLimit);
    const skip = Math.max(0, (page - 1) * limit);

    const pool = await getDbPool();
    const req = pool.request();

    // 3. เขียน SQL 
    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_desc,
        p.product_thumbnail,
        p.product_price,
        p.store_id,
        p.category_id,
        p.unit_id,
        p.location_id,
        p.status,
        loc.location_name,
        p.order_limit,
        p.batch_size,
        c.category_name,
        s.store_name,
        s.store_access,
        s.restock_day,
        u.unit AS unit_name,
        ISNULL(inv.quantity, 0) AS stock_quantity,
        COUNT(*) OVER() AS total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN stores s ON p.store_id = s.store_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      LEFT JOIN locations loc ON p.location_id = loc.location_id
      LEFT JOIN v_inventory inv ON p.product_id = inv.product_id
      WHERE (p.status IS NULL OR p.status IN ('Y', 'N'))
    `;

    // 4. กรองสิทธิ์ร้านค้า (Public + Private เฉพาะที่มีในตาราง customers หรือเป็นเจ้าของร้าน/Admin)
    if (!currentUser.isAdmin) {
      const accessibleStoreIds = Array.from(
        new Set([...allowedPrivateStoreIds, ...(currentUser.ownedStoreIds || [])])
      );

      if (accessibleStoreIds.length > 0) {
        const storePlaceholders = accessibleStoreIds.map((id, index) => {
          const paramName = `store_${index}`;
          req.input(paramName, id);
          return `@${paramName}`;
        });

        query += ` AND (
          s.store_access = 'public' 
          OR s.store_access IS NULL 
          OR p.store_id IN (${storePlaceholders.join(', ')})
        )`;
      } else {
        query += ` AND (s.store_access = 'public' OR s.store_access IS NULL)`;
      }
    }

    // 5. ตัวกรองค้นหา (รองรับหลายคำคั่นด้วย comma เช่น "มาม่า,ต้มยำ")
    if (search) {
      const terms = search.split(',').map((t) => t.trim()).filter(Boolean);
      terms.forEach((term, index) => {
        const paramName = `searchTerm_${index}`;
        req.input(paramName, `%${term}%`);
        query += ` AND (p.product_name LIKE @${paramName} OR p.product_desc LIKE @${paramName} OR loc.location_name LIKE @${paramName})`;
      });
    }

    if (categoryId) {
      req.input('categoryId', categoryId);
      query += ` AND p.category_id = @categoryId`;
    }

    if (storeId) {
      req.input('filterStoreId', storeId);
      query += ` AND p.store_id = @filterStoreId`;
    }

    // 6. 📄 ใส่ Pagination: OFFSET และ FETCH NEXT (ต้องอยู่หลัง ORDER BY)
    req.input('skip', sql.Int, skip);
    req.input('limit', sql.Int, limit);

    query += ` 
      ORDER BY p.product_name ASC, p.product_id ASC
      OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
    `;

    // 7. รัน Query และคำนวณสรุปหน้า
    const result = await req.query(query);
    const rows = result.recordset;

    // หาจำนวนทั้งหมดจากแถวแรก (ถ้าไม่มีผลลัพธ์เลย ให้ total เป็น 0)
    const total = rows.length > 0 ? rows[0].total_count : 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products
 * อัปเดตสถานะการใช้งานของสินค้า (เปิดจำหน่าย = 'Y', งดจำหน่าย = 'N')
 */
export async function PUT(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const body = await request.json();
    const { product_id, status } = body;

    if (!product_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ product_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบว่ามีสินค้านี้อยู่จริง และดึง store_id มาตรวจสอบสิทธิ์
    const productCheck = await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, product_id)
      .query(`
        SELECT product_id, product_name, store_id, status 
        FROM products 
        WHERE product_id = @product_id
      `);

    const product = productCheck.recordset?.[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลสินค้าที่ต้องการแก้ไข' },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (Admin หรือเจ้าของร้าน)
    const isOwner = (currentUser.ownedStoreIds || []).includes(product.store_id);
    if (!currentUser.isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขสถานะสินค้านี้' },
        { status: 403 }
      );
    }

    // ค่าสถานะ: 'Y' (เปิดจำหน่าย) หรือ 'N' (งดจำหน่าย)
    const newStatus = status === 'Y' || status === true ? 'Y' : 'N';

    const req = pool.request();
    req.input('product_id', sql.UniqueIdentifier, product_id);
    req.input('status', sql.NVarChar(1), newStatus);
    req.input('update_by', sql.NVarChar(16), currentUser.username);

    await req.query(`
      UPDATE products
      SET status = @status,
          update_by = @update_by,
          update_date = SYSDATETIME()
      WHERE product_id = @product_id
    `);

    return NextResponse.json({
      success: true,
      message:
        newStatus === 'Y'
          ? `เปิดจำหน่ายสินค้า "${product.product_name}" เรียบร้อยแล้ว`
          : `งดจำหน่ายสินค้า "${product.product_name}" เรียบร้อยแล้ว`,
      status: newStatus,
    });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products
 * ลบสินค้า (Soft delete ปรับสถานะเป็น 'D' และลบออกจากตะกร้า)
 */
export async function DELETE(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const { searchParams } = new URL(request.url);
    let productId = searchParams.get('product_id');

    if (!productId) {
      try {
        const body = await request.json();
        productId = body?.product_id;
      } catch (e) {
        // body might be empty if sent via query param
      }
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ product_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบว่ามีสินค้านี้อยู่จริง และดึง store_id มาตรวจสอบสิทธิ์
    const productCheck = await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, productId)
      .query(`
        SELECT product_id, product_name, store_id, status 
        FROM products 
        WHERE product_id = @product_id
      `);

    const product = productCheck.recordset?.[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลสินค้าที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (Admin หรือเจ้าของร้าน)
    const isOwner = (currentUser.ownedStoreIds || []).includes(product.store_id);
    if (!currentUser.isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์ลบสินค้านี้' },
        { status: 403 }
      );
    }

    // ลบสินค้าออกจากตะกร้าถ้ามีค้างอยู่
    await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, productId)
      .query(`DELETE FROM cart WHERE product_id = @product_id`);

    // ทำการ Soft Delete ด้วยการปรับ status = 'D' (Deleted)
    await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, productId)
      .input('update_by', sql.NVarChar(16), currentUser.username)
      .query(`
        UPDATE products
        SET status = 'D',
            update_by = @update_by,
            update_date = SYSDATETIME()
        WHERE product_id = @product_id
      `);

    return NextResponse.json({
      success: true,
      message: `ลบสินค้า "${product.product_name}" เรียบร้อยแล้ว`,
      product_id: productId,
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบสินค้า' },
      { status: 500 }
    );
  }
}