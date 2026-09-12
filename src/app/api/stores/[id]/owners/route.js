// src/app/api/stores/[id]/owners/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stores/[id]/owners
 * ดึงรายการผู้ดูแลร้านค้าทั้งหมดของร้านค้านี้ พร้อมค้นหาและแบ่งหน้า
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
    let whereClause = `WHERE o.store_id = @store_id`;

    if (search) {
      countReq.input('search', sql.NVarChar, `%${search}%`);
      whereClause += ` AND (
        o.username LIKE @search OR
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
      FROM owners o
      LEFT JOIN _accounts a ON o.username = a.username
      ${whereClause}
    `);
    const total = countResult.recordset[0]?.total || 0;

    // 2. ดึงข้อมูลรายการผู้ดูแล
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
      SELECT o.store_id, o.username, o.update_by, o.update_date,
             a.firstname, a.firstname_th, a.lastname, a.lastname_th,
             a.department, a.department_th, a.section, a.section_th,
             a.company_th, a.email
      FROM owners o
      LEFT JOIN _accounts a ON o.username = a.username
      ${whereClause}
      ORDER BY a.firstname_th, o.username
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
    console.error('Error fetching store owners:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ดูแลร้านค้า' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores/[id]/owners
 * เพิ่มผู้ดูแลร้านค้าคนใหม่
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
        { success: false, error: 'กรุณาระบุรหัสพนักงานของผู้ดูแล' },
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

    // 2. ตรวจสอบว่าพนักงานท่านนี้เป็นผู้ดูแลร้านค้านี้อยู่แล้วหรือไม่
    const duplicateCheck = await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeId)
      .input('username', sql.NVarChar(16), cleanUsername)
      .query(`
        SELECT COUNT(*) AS count
        FROM owners
        WHERE store_id = @store_id AND username = @username
      `);

    if ((duplicateCheck.recordset[0]?.count || 0) > 0) {
      return NextResponse.json(
        { success: false, error: 'พนักงานท่านนี้เป็นผู้ดูแลของร้านค้านี้อยู่แล้ว' },
        { status: 400 }
      );
    }

    // 3. บันทึกเพิ่มผู้ดูแลลงในตาราง owners
    await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeId)
      .input('username', sql.NVarChar(16), cleanUsername)
      .input('update_by', sql.NVarChar(16), updaterUsername)
      .query(`
        INSERT INTO owners (store_id, username, update_by, update_date)
        VALUES (@store_id, @username, @update_by, SYSDATETIME())
      `);

    return NextResponse.json({
      success: true,
      message: 'เพิ่มผู้ดูแลร้านค้าเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error adding store owner:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มผู้ดูแลร้านค้า' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/owners
 * ลบสิทธิ์ผู้ดูแลร้านค้า (มีเงื่อนไขสำคัญ: ห้ามลบตัวเอง)
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
    const currentUsername = (authResult.user.username || '').trim().toUpperCase();

    // ❌ กฎสำคัญ: ห้ามลบตนเองออกจากรายชื่อผู้ดูแลร้าน
    if (cleanTargetUsername === currentUsername) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถลบสิทธิ์ผู้ดูแลของตนเองได้' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ลบรายการผู้ดูแลออกจากตาราง owners
    const deleteResult = await pool
      .request()
      .input('store_id', sql.UniqueIdentifier, storeId)
      .input('username', sql.NVarChar(16), cleanTargetUsername)
      .query(`
        DELETE FROM owners
        WHERE store_id = @store_id AND username = @username
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ดูแลที่ต้องการลบในร้านค้านี้' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบผู้ดูแลร้านค้าเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Error deleting store owner:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบผู้ดูแลร้านค้า' },
      { status: 500 }
    );
  }
}
