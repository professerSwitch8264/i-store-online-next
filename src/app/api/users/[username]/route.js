// src/app/api/users/[username]/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[username]
 * ดึงข้อมูลพนักงานรายบุคคลจากตาราง _accounts ด้วยรหัสพนักงาน (username)
 */
export async function GET(request, { params }) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const { username } = await params;
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสพนักงาน' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toUpperCase();
    const pool = await getDbPool();

    const result = await pool
      .request()
      .input('username', sql.NVarChar(16), cleanUsername)
      .query(`
        SELECT TOP 1 username, firstname, firstname_th, lastname, lastname_th, 
               department, department_th, section, section_th, company, company_th, email
        FROM _accounts
        WHERE username = @username AND status = 'Y'
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลพนักงานในระบบ หรือสถานะไม่ได้เปิดใช้งาน' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Error fetching user by username:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน' },
      { status: 500 }
    );
  }
}
