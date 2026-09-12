// src/app/api/stores/[id]/customers/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stores/[id]/customers
 * ดึงรายการลูกค้าทั้งหมดของร้านค้าเฉพาะกลุ่ม (Private Store) พร้อมค้นหาและแบ่งหน้า
 */
export async function GET(request, { params }) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const { id: storeId } = await params;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const pool = await getDbPool();

    // 1. นับจำนวนรายการทั้งหมดตามเงื่อนไขการค้นหา
    const countReq = pool.request();
    countReq.input('store_id', sql.UniqueIdentifier, storeId);
    let whereClause = `WHERE c.store_id = @store_id`;

    if (search) {
      countReq.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ` AND (
        c.username LIKE @search OR
        a.firstname LIKE @search OR
        a.firstname_th LIKE @search OR
        a.lastname LIKE @search OR
        a.lastname_th LIKE @search OR
        a.department LIKE @search OR
        a.department_th LIKE @search
      )`;
    }

    const countResult = await countReq.query(`
      SELECT COUNT(*) AS total
      FROM customers c
      LEFT JOIN _accounts a ON c.username = a.username
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.total || 0;

    // 2. ดึงข้อมูลรายการลูกค้า
    const dataReq = pool.request();
    dataReq.input('store_id', sql.UniqueIdentifier, storeId);
    if (search) {
      dataReq.input('search', sql.NVarChar, `%${search}%`);
    }

    let paginationClause = '';
    let page = 1;
    let limit = total;
    if (pageParam || limitParam) {
      page = Math.max(1, parseInt(pageParam, 10) || 1);
      limit = Math.max(1, parseInt(limitParam, 10) || 10);
      const skip = (page - 1) * limit;

      dataReq.input('skip', sql.Int, skip);
      dataReq.input('limit', sql.Int, limit);
      paginationClause = 'OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY';
    }

    const query = `
      SELECT c.store_id, c.username, c.update_by, c.update_date,
             a.firstname, a.firstname_th, a.lastname, a.lastname_th,
             a.department, a.department_th, a.email, a.company_th, a.section_th
      FROM customers c
      LEFT JOIN _accounts a ON c.username = a.username
      ${whereClause}
      ORDER BY a.firstname_th, c.username
      ${paginationClause}
    `;

    const dataResult = await dataReq.query(query);

    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

    return NextResponse.json({
      success: true,
      data: dataResult.recordset || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching store customers:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลลูกค้าของร้านค้า' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/customers
 * เพิ่มลูกค้ารายใหม่ลงในร้านค้าเฉพาะกลุ่ม
 */
export async function POST(request, { params }) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const { id: storeId } = await params;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสพนักงานของลูกค้า' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toUpperCase();
    const updaterUsername = authResult.user.username;

    const pool = await getDbPool();

    // 1. ตรวจสอบว่าพนักงานมีตัวตนในตาราง _accounts และสถานะเปิดใช้งาน
    const userCheck = await pool
      .request()
      .input('username', sql.NVarChar(16), cleanUsername)
      .query(`
        SELECT TOP 1 username, firstname_th, lastname_th
        FROM _accounts
        WHERE username = @username AND status = 'Y'
      `);

    if (userCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลพนักงานในระบบ หรือสถานะไม่ได้เปิดใช้งาน' },
        { status: 404 }
      );
    }

    // 2. ตรวจสอบว่าพนักงานท่านนี้อยู่ในรายชื่อลูกค้าของร้านค้านี้อยู่แล้วหรือไม่
    const duplicateCheck = await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeId)
      .input('username', sql.NVarChar(16), cleanUsername)
      .query(`
        SELECT COUNT(*) AS count
        FROM customers
        WHERE store_id = @store_id AND username = @username
      `);

    if ((duplicateCheck.recordset[0]?.count || 0) > 0) {
      return NextResponse.json(
        { success: false, error: 'พนักงานท่านนี้อยู่ในรายชื่อลูกค้าของร้านค้านี้อยู่แล้ว' },
        { status: 400 }
      );
    }

    // 3. บันทึกเพิ่มลูกค้าลงในตาราง customers
    await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeId)
      .input('username', sql.NVarChar(16), cleanUsername)
      .input('update_by', sql.NVarChar(16), updaterUsername)
      .query(`
        INSERT INTO customers (store_id, username, update_by, update_date)
        VALUES (@store_id, @username, @update_by, SYSDATETIME())
      `);

    return NextResponse.json({
      success: true,
      message: 'เพิ่มลูกค้าในร้านค้าเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error adding store customer:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มลูกค้า' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/customers
 * ลบสิทธิ์ลูกค้ารายนี้ออกจากร้านค้าเฉพาะกลุ่ม
 */
export async function DELETE(request, { params }) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const { id: storeId } = await params;
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    // ดึง username จาก query search params หรือ request body
    const { searchParams } = new URL(request.url);
    let targetUsername = searchParams.get('username');

    if (!targetUsername) {
      try {
        const body = await request.json();
        targetUsername = body?.username;
      } catch {
        // body might be empty
      }
    }

    if (!targetUsername || typeof targetUsername !== 'string' || !targetUsername.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสพนักงานที่ต้องการลบ' },
        { status: 400 }
      );
    }

    const cleanTargetUsername = targetUsername.trim().toUpperCase();
    const pool = await getDbPool();

    // ลบรายการลูกค้าออกจากตาราง customers
    const deleteResult = await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeId)
      .input('username', sql.NVarChar(16), cleanTargetUsername)
      .query(`
        DELETE FROM customers
        WHERE store_id = @store_id AND username = @username
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบลูกค้าที่ต้องการลบในร้านค้านี้' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบลูกค้ารายนี้เรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error deleting store customer:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบลูกค้า' },
      { status: 500 }
    );
  }
}
