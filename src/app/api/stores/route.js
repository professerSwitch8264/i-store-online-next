// src/app/api/stores/route.js

/**
 * =========================================================================
 * API Route: GET /api/stores
 * =========================================================================
 * หน้าที่: ดึงรายการร้านค้าที่ผู้ใช้งานปัจจุบันมีสิทธิ์ดูแล (Store Management Hub)
 * 1. ตรวจสอบสิทธิ์ Token ผู้ใช้งาน
 * 2. หากเป็น Admin -> ดึงข้อมูลร้านค้าทั้งหมดในระบบ
 * 3. หากเป็นพนักงานทั่วไป -> ดึงเฉพาะร้านค้าที่ username อยู่ในตาราง owners
 * 4. แนบจำนวนสินค้า (product_count) ในแต่ละร้านมาด้วย
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. ตรวจสอบการยืนยันตัวตน (Authentication Check)
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const username = currentUser.username;
    const isAdmin = currentUser.isAdmin;

    // 2. รับ Query Parameters (รองรับ page, limit=6 และ search แบบเดียวกับ /api/products)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const storeId = searchParams.get('storeId') || '';
    const hasPagination = searchParams.has('page') || searchParams.has('limit');
    const isAll = searchParams.get('all') === 'true' || (!hasPagination && !storeId);
    const parsedPage = parseInt(searchParams.get('page'), 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedLimit = parseInt(searchParams.get('limit'), 10);
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 6 : Math.min(100, parsedLimit);
    const skip = Math.max(0, (page - 1) * limit);

    const pool = await getDbPool();
    const req = pool.request();

    let query = `
      SELECT 
        s.store_id,
        s.store_name,
        s.store_desc,
        s.store_access,
        s.status,
        s.update_by,
        s.update_date,
        s.store_image,
        s.restock_day,
        s.limit_order_day,
        (SELECT COUNT(*) FROM products p WHERE p.store_id = s.store_id) AS product_count,
        (SELECT COUNT(DISTINCT ow.username) FROM owners ow WHERE ow.store_id = s.store_id) AS employee_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status = 'X') AS preparing_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status IN ('W', 'P')) AS pending_count,
        COUNT(*) OVER() AS total_count
      FROM stores s
    `;

    const whereClauses = [];

    if (storeId.trim()) {
      req.input('storeId', sql.UniqueIdentifier, storeId.trim());
      whereClauses.push('s.store_id = @storeId');
    }

    const mode = searchParams.get('mode') || '';

    if (mode === 'shop') {
      whereClauses.push("s.status = 'Y'");
      if (!isAdmin) {
        const allowedPrivateStoreIds = currentUser.allowedPrivateStoreIds || [];
        const accessibleStoreIds = Array.from(
          new Set([...allowedPrivateStoreIds, ...(currentUser.ownedStoreIds || [])])
        );

        if (accessibleStoreIds.length > 0) {
          const storePlaceholders = accessibleStoreIds.map((id, index) => {
            const paramName = `acc_store_${index}`;
            req.input(paramName, id);
            return `@${paramName}`;
          });

          whereClauses.push(`(
            s.store_access = 'public' 
            OR s.store_access IS NULL 
            OR s.store_id IN (${storePlaceholders.join(', ')})
          )`);
        } else {
          whereClauses.push(`(s.store_access = 'public' OR s.store_access IS NULL)`);
        }
      }
    } else {
      if (!isAdmin) {
        req.input('username', sql.NVarChar, username);
        whereClauses.push(`s.store_id IN (
          SELECT store_id FROM owners WHERE username = @username
        )`);
      }
    }

    if (search.trim()) {
      const terms = search.split(',').map((t) => t.trim()).filter(Boolean);
      terms.forEach((term, index) => {
        const paramName = `searchTerm_${index}`;
        req.input(paramName, sql.NVarChar, `%${term}%`);
        whereClauses.push(`(s.store_name LIKE @${paramName} OR s.store_desc LIKE @${paramName})`);
      });
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY s.store_name ASC`;

    if (!isAll) {
      req.input('skip', sql.Int, skip);
      req.input('limit', sql.Int, limit);
      query += ` OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY`;
    }

    const result = await req.query(query);
    const rows = result.recordset || [];

    const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;
    const totalPages = isAll ? 1 : Math.max(1, Math.ceil(total / limit));

    const stores = rows.map((row) => ({
      store_id: row.store_id,
      store_name: row.store_name,
      store_desc: row.store_desc,
      store_access: row.store_access,
      status: row.status,
      update_by: row.update_by,
      update_date: row.update_date,
      store_image: row.store_image,
      restock_day: row.restock_day !== null && row.restock_day !== undefined ? Number(row.restock_day) : 0,
      limit_order_day: row.limit_order_day !== null && row.limit_order_day !== undefined ? Number(row.limit_order_day) : 0,
      product_count: Number(row.product_count || 0),
      employee_count: Number(row.employee_count || 0),
      preparing_count: Number(row.preparing_count || 0),
      pending_count: Number(row.pending_count || 0),
    }));

    return NextResponse.json(
      {
        success: true,
        data: stores,
        pagination: {
          page: isAll ? 1 : page,
          limit: isAll ? total : limit,
          total,
          totalPages,
          hasNextPage: isAll ? false : page < totalPages,
          hasPrevPage: isAll ? false : page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('💥 [GET /api/stores error]:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านค้า';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * =========================================================================
 * API Route: PUT /api/stores
 * =========================================================================
 * หน้าที่: บันทึกแก้ไขข้อมูลร้านค้า (Store Information)
 * ฟิลด์ที่แก้ไขได้: store_name, store_desc, store_access, store_image, restock_day, limit_order_day
 * =========================================================================
 */
export async function PUT(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const username = currentUser.username;
    const isAdmin = currentUser.isAdmin;

    const body = await request.json();
    const {
      store_id,
      store_name,
      store_desc,
      store_access,
      store_image,
      restock_day,
      limit_order_day,
    } = body;

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสร้านค้า (store_id)' },
        { status: 400 }
      );
    }

    if (!store_name || !store_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อร้านค้า' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบสิทธิ์: ต้องเป็น Admin หรือเป็นผู้ดูแลร้านในตาราง owners
    if (!isAdmin) {
      const ownerCheck = await pool
        .request()
        .input('store_id', sql.UniqueIdentifier, store_id)
        .input('username', sql.NVarChar, username)
        .query('SELECT 1 FROM owners WHERE store_id = @store_id AND username = @username');

      if (!ownerCheck.recordset || ownerCheck.recordset.length === 0) {
        return NextResponse.json(
          { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลร้านค้านี้' },
          { status: 403 }
        );
      }
    }

    const parsedRestockDay =
      restock_day !== undefined && restock_day !== null && restock_day !== ''
        ? Math.max(0, Math.min(31, parseInt(restock_day, 10) || 0))
        : 0;

    const parsedLimitOrderDay =
      limit_order_day !== undefined && limit_order_day !== null && limit_order_day !== ''
        ? Math.max(0, parseInt(limit_order_day, 10) || 0)
        : 0;

    const accessVal = store_access === 'private' ? 'private' : 'public';

    const updateReq = pool.request();
    updateReq.input('store_id', sql.UniqueIdentifier, store_id);
    updateReq.input('store_name', sql.NVarChar(64), store_name.trim());
    updateReq.input('store_desc', sql.NVarChar(sql.MAX), store_desc ? store_desc.trim() : null);
    updateReq.input('store_access', sql.NVarChar(16), accessVal);
    updateReq.input('store_image', sql.NVarChar(sql.MAX), store_image ? store_image.trim() : null);
    updateReq.input('restock_day', sql.Int, parsedRestockDay);
    updateReq.input('limit_order_day', sql.Int, parsedLimitOrderDay);
    updateReq.input('update_by', sql.NVarChar(16), username);

    await updateReq.query(`
      UPDATE stores
      SET
        store_name = @store_name,
        store_desc = @store_desc,
        store_access = @store_access,
        store_image = @store_image,
        restock_day = @restock_day,
        limit_order_day = @limit_order_day,
        update_by = @update_by,
        update_date = SYSDATETIME()
      WHERE store_id = @store_id
    `);

    // ดึงข้อมูลร้านค้าหลังอัปเดตเพื่อส่งกลับให้ Client
    const fetchReq = pool.request();
    fetchReq.input('store_id', sql.UniqueIdentifier, store_id);
    const fetchRes = await fetchReq.query(`
      SELECT 
        s.store_id,
        s.store_name,
        s.store_desc,
        s.store_access,
        s.status,
        s.update_by,
        s.update_date,
        s.store_image,
        s.restock_day,
        s.limit_order_day,
        (SELECT COUNT(*) FROM products p WHERE p.store_id = s.store_id) AS product_count,
        (SELECT COUNT(DISTINCT ow.username) FROM owners ow WHERE ow.store_id = s.store_id) AS employee_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status = 'X') AS preparing_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status IN ('W', 'P')) AS pending_count
      FROM stores s
      WHERE s.store_id = @store_id
    `);

    const updated = fetchRes.recordset?.[0];

    return NextResponse.json({
      success: true,
      data: {
        store_id: updated.store_id,
        store_name: updated.store_name,
        store_desc: updated.store_desc,
        store_access: updated.store_access,
        status: updated.status,
        update_by: updated.update_by,
        update_date: updated.update_date,
        store_image: updated.store_image,
        restock_day: updated.restock_day !== null && updated.restock_day !== undefined ? Number(updated.restock_day) : 0,
        limit_order_day: updated.limit_order_day !== null && updated.limit_order_day !== undefined ? Number(updated.limit_order_day) : 0,
        product_count: Number(updated.product_count || 0),
        employee_count: Number(updated.employee_count || 0),
        preparing_count: Number(updated.preparing_count || 0),
        pending_count: Number(updated.pending_count || 0),
      },
      message: 'บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('💥 [PUT /api/stores error]:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลร้านค้า';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
