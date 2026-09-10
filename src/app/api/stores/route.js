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
    const hasPagination = searchParams.has('page') || searchParams.has('limit');
    const isAll = searchParams.get('all') === 'true' || !hasPagination;
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
        (SELECT COUNT(*) FROM products p WHERE p.store_id = s.store_id) AS product_count,
        (SELECT COUNT(DISTINCT ow.username) FROM owners ow WHERE ow.store_id = s.store_id) AS employee_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status = 'X') AS preparing_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.store_id AND o.status IN ('W', 'P')) AS pending_count,
        COUNT(*) OVER() AS total_count
      FROM stores s
    `;

    const whereClauses = [];

    if (!isAdmin) {
      req.input('username', sql.NVarChar, username);
      whereClauses.push(`s.store_id IN (
        SELECT store_id FROM owners WHERE username = @username
      )`);
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
      restock_day: row.restock_day,
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
