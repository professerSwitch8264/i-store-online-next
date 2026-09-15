// src/app/api/units/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/units
 * ดึงรายการหน่วยนับสินค้าทั้งหมดในระบบ
 */
export async function GET(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT *
      FROM units
      ORDER BY unit ASC
    `);

    const data = (result.recordset || []).map((row) => ({
      ...row,
      unit_id: row.unit_id,
      unit: row.unit || row.unit_name || row.uom || '',
      unit_name: row.unit_name || row.unit || row.uom || '',
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Fetch units error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยสินค้า' },
      { status: 500 }
    );
  }
}
