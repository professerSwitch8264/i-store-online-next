// src/app/api/shipping-locations/route.js
import { NextResponse } from 'next/server';
import { getDbPool } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

/**
 * ─────────────────────────────────────────────────────────────────────────
 * GET /api/shipping-locations
 * หน้าที่: ดึงรายการสถานที่จัดส่งสินค้าทั้งหมดที่เปิดใช้งานในระบบ (en = 'Y' และ status = 'Y')
 * เช่น โรงงาน 1, โรงงาน 2, โรงงาน 3
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function GET(request) {
  try {
    // searchParams: พารามิเตอร์จาก URL เช่น ?all=true
    const { searchParams } = new URL(request.url);

    // all: ถ้าส่ง all=true จะดึงข้อมูลทั้งสถานะ Y และ N (สำหรับหน้า Admin จัดการสถานที่)
    const all = searchParams.get('all') === 'true';

    // pool: ตัวเชื่อมต่อฐานข้อมูล MSSQL
    const pool = await getDbPool();

    // query: คำสั่ง SQL ดึงข้อมูลสถานที่จัดส่ง
    let query = `
      SELECT 
        loc.location_id, 
        loc.location_name, 
        loc.location_desc, 
        loc.status, 
        loc.en
      FROM shipping_locations loc
      WHERE loc.en = 'Y'
    `;

    if (!all) {
      query += ` AND loc.status = 'Y'`;
    }

    query += ` ORDER BY loc.location_name ASC`;

    // result: ผลลัพธ์จากการ Query
    const result = await pool.request().query(query);

    // locations: รายการสถานที่จัดส่งในรูปแบบ Array
    const locations = result.recordset || [];

    return NextResponse.json({
      success: true,
      data: locations,
      total: locations.length,
    });
  } catch (error) {
    console.error('Error in GET /api/shipping-locations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานที่จัดส่ง' },
      { status: 500 }
    );
  }
}
