// src/app/api/locations/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/locations?store_id=...
 * ดึงรายการตำแหน่งจัดเก็บสินค้าทั้งหมดของร้านค้านี้ (เฉพาะ status = 'Y')
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

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1. คำนวณจำนวนรายการทั้งหมดที่ตรงกับเงื่อนไขการค้นหา
    const countReq = pool.request();
    countReq.input('store_id', sql.UniqueIdentifier, storeId);
    let whereClause = `WHERE loc.store_id = @store_id AND loc.status = 'Y'`;
    if (search) {
      countReq.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ` AND (loc.location_name LIKE @search OR loc.location_desc LIKE @search)`;
    }

    const countResult = await countReq.query(`
      SELECT COUNT(*) AS total
      FROM locations loc
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.total || 0;

    // 2. ดึงข้อมูลรายการตำแหน่งจัดเก็บตามหน้าและคำค้นหา
    const dataReq = pool.request();
    dataReq.input('store_id', sql.UniqueIdentifier, storeId);
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
        loc.location_id,
        loc.store_id,
        loc.location_name,
        loc.location_desc,
        loc.status,
        loc.en,
        loc.update_by,
        loc.update_date,
        (SELECT COUNT(*) FROM products p WHERE p.location_id = loc.location_id AND p.status = 'Y') AS product_count
      FROM locations loc
      ${whereClause}
      ORDER BY loc.location_id DESC, loc.location_name ASC
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
    console.error('Error in GET /api/locations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่งจัดเก็บสินค้า' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations
 * เพิ่มตำแหน่งจัดเก็บสินค้าใหม่
 */
export async function POST(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const body = await request.json();
    const { store_id, location_name, location_desc, en } = body;

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    if (!location_name || !location_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อตำแหน่งจัดเก็บสินค้า' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const enVal = en === false || en === 'N' ? 'N' : 'Y';

    const insertResult = await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, store_id)
      .input('location_name', sql.NVarChar(32), location_name.trim())
      .input('location_desc', sql.NVarChar(sql.MAX), location_desc ? location_desc.trim() : '')
      .input('en', sql.NVarChar(1), enVal)
      .input('update_by', sql.NVarChar(16), username)
      .query(`
        DECLARE @newId UNIQUEIDENTIFIER = NEWID();
        INSERT INTO locations (location_id, store_id, location_name, location_desc, status, update_by, update_date, en)
        VALUES (@newId, @store_id, @location_name, @location_desc, 'Y', @update_by, SYSDATETIME(), @en);

        SELECT 
          location_id, store_id, location_name, location_desc, status, en, update_by, update_date,
          0 AS product_count
        FROM locations
        WHERE location_id = @newId;
      `);

    const created = insertResult.recordset?.[0];

    return NextResponse.json({
      success: true,
      data: created,
      message: 'เพิ่มตำแหน่งจัดเก็บสินค้าสำเร็จ',
    });
  } catch (error) {
    console.error('Error in POST /api/locations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มตำแหน่งจัดเก็บสินค้า' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/locations
 * แก้ไขข้อมูลตำแหน่งจัดเก็บสินค้า หรือเปิด/ปิดการใช้งาน (en)
 */
export async function PUT(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const body = await request.json();
    const { location_id, location_name, location_desc, en } = body;

    if (!location_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ location_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();
    const req = pool.request();
    req.input('location_id', sql.UniqueIdentifier, location_id);
    req.input('update_by', sql.NVarChar(16), username);

    const updateFields = ['update_by = @update_by', 'update_date = SYSDATETIME()'];

    if (location_name !== undefined) {
      if (!location_name.trim()) {
        return NextResponse.json(
          { success: false, error: 'ชื่อตำแหน่งจัดเก็บสินค้าต้องไม่เว้นว่าง' },
          { status: 400 }
        );
      }
      req.input('location_name', sql.NVarChar(32), location_name.trim());
      updateFields.push('location_name = @location_name');
    }

    if (location_desc !== undefined) {
      req.input('location_desc', sql.NVarChar(sql.MAX), location_desc ? location_desc.trim() : '');
      updateFields.push('location_desc = @location_desc');
    }

    if (en !== undefined) {
      const enVal = en === true || en === 'Y' ? 'Y' : 'N';
      if (enVal === 'N') {
        const countCheck = await pool
          .request()
          .input('location_id', sql.UniqueIdentifier, location_id)
          .query(`
            SELECT COUNT(*) AS product_count
            FROM products
            WHERE location_id = @location_id AND status = 'Y'
          `);
        const pCount = countCheck.recordset?.[0]?.product_count || 0;
        if (pCount > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `ไม่สามารถปิดการใช้งานได้ เนื่องจากมีสินค้าใช้งานตำแหน่งนี้อยู่ ${pCount} รายการ`,
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
      UPDATE locations
      SET ${updateFields.join(', ')}
      WHERE location_id = @location_id;

      SELECT 
        loc.location_id,
        loc.store_id,
        loc.location_name,
        loc.location_desc,
        loc.status,
        loc.en,
        loc.update_by,
        loc.update_date,
        (SELECT COUNT(*) FROM products p WHERE p.location_id = loc.location_id AND p.status = 'Y') AS product_count
      FROM locations loc
      WHERE loc.location_id = @location_id;
    `;

    const result = await req.query(query);
    const updated = result.recordset?.[0];

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'อัปเดตข้อมูลตำแหน่งจัดเก็บสินค้าสำเร็จ',
    });
  } catch (error) {
    console.error('Error in PUT /api/locations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขตำแหน่งจัดเก็บสินค้า' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/locations
 * ลบตำแหน่งจัดเก็บสินค้า (Soft delete status = 'N' หากไม่มีสินค้าใช้งาน)
 */
export async function DELETE(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const { searchParams } = new URL(request.url);
    let locationId = searchParams.get('location_id');

    if (!locationId) {
      try {
        const body = await request.json();
        locationId = body?.location_id;
      } catch (e) {
        // body might be empty if sent via query param
      }
    }

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ location_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบว่ามีสินค้าใช้งานตำแหน่งจัดเก็บนี้อยู่หรือไม่
    const countResult = await pool
      .request()
      .input('location_id', sql.UniqueIdentifier, locationId)
      .query(`
        SELECT COUNT(*) AS product_count
        FROM products
        WHERE location_id = @location_id AND status = 'Y'
      `);

    const productCount = countResult.recordset?.[0]?.product_count || 0;
    if (productCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `ไม่สามารถลบตำแหน่งจัดเก็บนี้ได้ เนื่องจากมีสินค้าใช้งานอยู่ ${productCount} รายการ (สามารถเลือกปิดสวิตช์สถานะแทนได้)`,
          product_count: productCount,
        },
        { status: 400 }
      );
    }

    // ทำการ Soft delete (status = 'N') เพื่อความปลอดภัย
    await pool
      .request()
      .input('location_id', sql.UniqueIdentifier, locationId)
      .input('update_by', sql.NVarChar(16), username)
      .query(`
        UPDATE locations
        SET status = 'N', update_by = @update_by, update_date = SYSDATETIME()
        WHERE location_id = @location_id
      `);

    return NextResponse.json({
      success: true,
      message: 'ลบตำแหน่งจัดเก็บสินค้าสำเร็จ',
      location_id: locationId,
    });
  } catch (error) {
    console.error('Error in DELETE /api/locations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบตำแหน่งจัดเก็บสินค้า' },
      { status: 500 }
    );
  }
}
