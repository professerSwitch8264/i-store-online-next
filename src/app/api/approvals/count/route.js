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
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const username = currentUser.username;
    const isApprover = currentUser.isApprover;

    // หากไม่ได้มีชื่อเป็น Approver ของแผนกใดๆ เลย ให้ส่ง 0 กลับทันที
    if (!isApprover) {
      return NextResponse.json(
        {
          success: true,
          count: 0,
          data: {
            pendingCount: 0,
            count: 0,
          },
        },
        { status: 200 }
      );
    }

    const pool = await getDbPool();
    const req = pool.request();
    req.input('username', sql.NVarChar, `%${username}%`);

    const query = `
      SELECT COUNT(DISTINCT a.order_id) AS count
      FROM order_approvals a
      INNER JOIN orders o ON a.order_id = o.order_id
      WHERE a.status = 'P' 
        AND a.en = 'Y'
        AND o.status IN ('W', 'P')
        AND a.approvers LIKE @username
    `;

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
