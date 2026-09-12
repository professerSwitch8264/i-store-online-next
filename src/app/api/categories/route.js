// src/app/api/categories/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/categories?store_id=...
 * ดึงรายการหมวดหมู่สินค้าทั้งหมดของร้านค้านี้ (เฉพาะ status = 'Y')
 */
export async function GET(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const search = (searchParams.get('search') || '').trim();
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const pool = await getDbPool();

    // 1. คำนวณจำนวนรายการทั้งหมดที่ตรงกับเงื่อนไขการค้นหา
    const countReq = pool.request();
    let whereClause = `WHERE c.status = 'Y'`;
    if (storeId) {
      countReq.input('store_id', sql.UniqueIdentifier, storeId);
      whereClause += ` AND c.store_id = @store_id`;
    }
    if (search) {
      countReq.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ` AND (c.category_name LIKE @search OR c.category_desc LIKE @search)`;
    }

    const countResult = await countReq.query(`
      SELECT COUNT(*) AS total
      FROM categories c
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.total || 0;

    // 2. ดึงข้อมูลรายการหมวดหมู่ตามหน้าและคำค้นหา
    const dataReq = pool.request();
    if (storeId) {
      dataReq.input('store_id', sql.UniqueIdentifier, storeId);
    }
    if (search) {
      dataReq.input('search', sql.NVarChar, `%${search}%`);
    }

    let paginationClause = '';
    let page = 1;
    let limit = total;
    if (pageParam || limitParam) {
      const parsedPage = parseInt(pageParam, 10);
      page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
      const parsedLimit = parseInt(limitParam, 10);
      limit = isNaN(parsedLimit) || parsedLimit < 1 ? 10 : Math.min(100, parsedLimit);
      const skip = Math.max(0, (page - 1) * limit);

      dataReq.input('skip', sql.Int, skip);
      dataReq.input('limit', sql.Int, limit);
      paginationClause = `OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY`;
    }

    const dataResult = await dataReq.query(`
      SELECT 
        c.category_id,
        c.store_id,
        c.category_name,
        c.category_desc,
        c.status,
        c.en,
        c.update_by,
        c.update_date,
        s.store_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.category_id AND p.status = 'Y') AS product_count
      FROM categories c
      LEFT JOIN stores s ON c.store_id = s.store_id
      ${whereClause}
      ORDER BY c.update_date DESC, c.category_name ASC
      ${paginationClause}
    `);

    return NextResponse.json({
      success: true,
      data: dataResult.recordset || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / (limit || 1))),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่สินค้า' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * เพิ่มหมวดหมู่สินค้าใหม่
 */
export async function POST(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const body = await request.json();
    const { store_id, category_name, category_desc, en } = body;

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    if (!category_name || !category_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อหมวดหมู่สินค้า' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const enVal = en === false || en === 'N' ? 'N' : 'Y';

    const insertResult = await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeIdInput(store_id))
      .input('category_name', sql.NVarChar(64), category_name.trim())
      .input('category_desc', sql.NVarChar(sql.MAX), category_desc ? category_desc.trim() : '')
      .input('en', sql.NVarChar(1), enVal)
      .input('update_by', sql.NVarChar(16), username)
      .query(`
        DECLARE @newId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO categories (category_id, store_id, category_name, category_desc, status, update_by, update_date, en)
        VALUES (@newId, @store_id, @category_name, @category_desc, 'Y', @update_by, SYSDATETIME(), @en);

        SELECT 
          category_id, store_id, category_name, category_desc, status, en, update_by, update_date,
          0 AS product_count
        FROM categories
        WHERE category_id = @newId;
      `);

    const created = insertResult.recordset?.[0];

    return NextResponse.json({
      success: true,
      data: created,
      message: 'เพิ่มหมวดหมู่สินค้าสำเร็จ',
    });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่สินค้า' },
      { status: 500 }
    );
  }
}

function storeIdInput(id) {
  return id;
}

/**
 * PUT /api/categories
 * แก้ไขข้อมูลหมวดหมู่สินค้า หรือเปิด/ปิดการใช้งาน (en)
 */
export async function PUT(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const body = await request.json();
    const { category_id, category_name, category_desc, en } = body;

    if (!category_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ category_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const req = pool.request();
    req.input('category_id', sql.UniqueIdentifier, category_id);
    req.input('update_by', sql.NVarChar(16), username);

    const updateFields = ['update_by = @update_by', 'update_date = SYSDATETIME()'];

    if (category_name !== undefined) {
      if (!category_name.trim()) {
        return NextResponse.json(
          { success: false, error: 'ชื่อหมวดหมู่สินค้าต้องไม่เว้นว่าง' },
          { status: 400 }
        );
      }
      req.input('category_name', sql.NVarChar(64), category_name.trim());
      updateFields.push('category_name = @category_name');
    }

    if (category_desc !== undefined) {
      req.input('category_desc', sql.NVarChar(sql.MAX), category_desc ? category_desc.trim() : '');
      updateFields.push('category_desc = @category_desc');
    }

    if (en !== undefined) {
      const enVal = en === true || en === 'Y' ? 'Y' : 'N';
      if (enVal === 'N') {
        const countCheck = await pool
          .request()
          .input('category_id', sql.UniqueIdentifier, category_id)
          .query(`
            SELECT COUNT(*) AS product_count
            FROM products
            WHERE category_id = @category_id AND status = 'Y'
          `);
        const pCount = countCheck.recordset?.[0]?.product_count || 0;
        if (pCount > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `ไม่สามารถปิดการใช้งานได้ เนื่องจากมีสินค้าใช้งานหมวดหมู่นี้อยู่ ${pCount} รายการ`,
              product_count: pCount,
            },
            { status: 400 }
          );
        }
      }
      req.input('en', sql.NVarChar(1), enVal);
      updateFields.push('en = @en');
    }

    const query = `
      UPDATE categories
      SET ${updateFields.join(', ')}
      WHERE category_id = @category_id;

      SELECT 
        c.category_id,
        c.store_id,
        c.category_name,
        c.category_desc,
        c.status,
        c.en,
        c.update_by,
        c.update_date,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.category_id AND p.status = 'Y') AS product_count
      FROM categories c
      WHERE c.category_id = @category_id;
    `;

    const result = await req.query(query);
    const updated = result.recordset?.[0];

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'อัปเดตข้อมูลหมวดหมู่สินค้าสำเร็จ',
    });
  } catch (error) {
    console.error('Error in PUT /api/categories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่สินค้า' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories
 * ลบหมวดหมู่สินค้า (Soft delete status = 'N' หากไม่มีสินค้าใช้งาน)
 */
export async function DELETE(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const { searchParams } = new URL(request.url);
    let categoryId = searchParams.get('category_id');

    if (!categoryId) {
      try {
        const body = await request.json();
        categoryId = body?.category_id;
      } catch (e) {
        // body might be empty if sent via query param
      }
    }

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ category_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบว่ามีสินค้าใช้งานหมวดหมู่นี้อยู่หรือไม่
    const countResult = await pool
      .request()
      .input('category_id', sql.UniqueIdentifier, categoryId)
      .query(`
        SELECT COUNT(*) AS product_count
        FROM products
        WHERE category_id = @category_id AND status = 'Y'
      `);

    const productCount = countResult.recordset?.[0]?.product_count || 0;
    if (productCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `ไม่สามารถลบหมวดหมู่นี้ได้ เนื่องจากมีสินค้าใช้งานอยู่ ${productCount} รายการ (สามารถเลือกปิดสวิตช์สถานะแทนได้)`,
          product_count: productCount,
        },
        { status: 400 }
      );
    }

    // ทำการ Soft delete (status = 'N') เพื่อความปลอดภัยและไม่ทำลาย integrity
    await pool
      .request()
      .input('category_id', sql.UniqueIdentifier, categoryId)
      .input('update_by', sql.NVarChar(16), username)
      .query(`
        UPDATE categories
        SET status = 'N', update_by = @update_by, update_date = SYSDATETIME()
        WHERE category_id = @category_id
      `);

    return NextResponse.json({
      success: true,
      message: 'ลบหมวดหมู่สินค้าสำเร็จ',
      category_id: categoryId,
    });
  } catch (error) {
    console.error('Error in DELETE /api/categories:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบหมวดหมู่สินค้า' },
      { status: 500 }
    );
  }
}
