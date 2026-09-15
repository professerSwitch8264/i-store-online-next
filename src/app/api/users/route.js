// src/app/api/users/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * ดึงรายชื่อพนักงานทั้งหมดที่อยู่ใน "แผนก/ฝ่ายเดียวกับผู้ใช้งานปัจจุบัน" (หรือตามแผนกที่ระบุ)
 * เพื่อใช้เป็น Dropdown ให้เลือกใน Popup จัดการร้านค้า (เพิ่มผู้ดูแล / เพิ่มลูกค้า)
 */
export async function GET(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUsername = (authResult.user.username || '').toUpperCase();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const customDept = (searchParams.get('department') || searchParams.get('department_th') || '').trim();

    const pool = await getDbPool();

    // 1. ค้นหาแผนก/ฝ่ายของผู้ใช้งานปัจจุบันจาก _accounts (หรือใช้ customDept ถ้ามีการส่งมา)
    let targetDept = customDept;
    let targetDeptTh = customDept;

    if (!targetDept) {
      const userRes = await pool
        .request()
        .input('username', sql.NVarChar(16), currentUsername)
        .query(`
          SELECT TOP 1 department, department_th, section, section_th
          FROM _accounts
          WHERE username = @username AND status = 'Y'
        `);

      if (userRes.recordset.length > 0) {
        targetDept = userRes.recordset[0].department || '';
        targetDeptTh = userRes.recordset[0].department_th || '';
      } else {
        // Fallback ตรวจสอบจาก ref_accounts
        const refRes = await pool
          .request()
          .input('username', sql.NVarChar(16), currentUsername)
          .query(`
            SELECT TOP 1 department
            FROM ref_accounts
            WHERE username = @username
          `);
        if (refRes.recordset.length > 0) {
          targetDept = refRes.recordset[0].department || '';
          targetDeptTh = refRes.recordset[0].department || '';
        }
      }
    }

    // 2. ดึงรายชื่อพนักงานทั้งหมดในแผนก/ฝ่ายนั้นๆ
    const req = pool.request();
    let whereClause = "WHERE status = 'Y'";

    if (targetDeptTh || targetDept) {
      req.input('deptTh', sql.NVarChar(100), targetDeptTh || targetDept);
      req.input('dept', sql.NVarChar(100), targetDept || targetDeptTh);
      whereClause += ` AND (
        (department_th = @deptTh AND department_th IS NOT NULL AND department_th <> '')
        OR (department = @dept AND department IS NOT NULL AND department <> '')
      )`;
    }

    if (search) {
      req.input('search', sql.NVarChar(100), `%${search}%`);
      whereClause += ` AND (
        username LIKE @search OR
        firstname LIKE @search OR
        firstname_th LIKE @search OR
        lastname LIKE @search OR
        lastname_th LIKE @search
      )`;
    }

    const query = `
      SELECT username, firstname, firstname_th, lastname, lastname_th, 
             department, department_th, section, section_th, company, company_th, email
      FROM _accounts
      ${whereClause}
      ORDER BY 
        CASE WHEN firstname_th IS NOT NULL AND firstname_th <> '' THEN 0 ELSE 1 END,
        firstname_th, 
        firstname, 
        username
    `;

    const result = await req.query(query);

    return NextResponse.json({
      success: true,
      data: result.recordset || [],
      departmentInfo: {
        department: targetDept,
        department_th: targetDeptTh,
      },
    });
  } catch (error) {
    console.error('Error fetching department users:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลพนักงานในแผนก' },
      { status: 500 }
    );
  }
}
