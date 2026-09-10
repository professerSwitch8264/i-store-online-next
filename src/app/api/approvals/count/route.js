// src/app/api/approvals/count/route.js

/**
 * =========================================================================
 * API Route: GET /api/approvals/count
 * =========================================================================
 * หน้าที่: ดึงจำนวนคำขออนุมัติที่รอการพิจารณา (Pending Approval Count)
 * สำหรับแสดง Badge ตัวเลขสีส้มบน AccountSidebar และ TopNavbar
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const username = currentUser.username;
    const isAdmin = currentUser.isAdmin;

    const pool = await getDbPool();
    const req = pool.request();

    let query = `
      SELECT COUNT(DISTINCT a.order_id) AS count
      FROM order_approvals a
      INNER JOIN orders o ON a.order_id = o.order_id
      WHERE a.status = 'P' 
        AND a.en = 'Y'
        AND o.status IN ('W', 'P')
    `;

    if (!isAdmin) {
      req.input('username', sql.NVarChar, `%${username}%`);
      query += ` AND a.approvers LIKE @username`;
    }

    const result = await req.query(query);
    const count = Number(result.recordset[0]?.count || 0);

    return NextResponse.json(
      {
        success: true,
        count,
        data: {
          pendingCount: count,
          count,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการนับจำนวนการอนุมัติ';
    console.error('💥 [Fatal Error in GET /api/approvals/count]:', error);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        count: 0,
      },
      { status: 500 }
    );
  }
}
