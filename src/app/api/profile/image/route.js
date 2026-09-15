// src/app/api/profile/image/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';
import { Client } from 'minio';
import crypto from 'crypto';

// 1. ตั้งค่า MinIO Client
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || '129.0.2.226',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
});

/**
 * GET: ดึงข้อมูลรูปภาพโปรไฟล์ปัจจุบันของผู้ใช้
 */
export async function GET(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const username = authResult.user.username;
    const pool = await getDbPool();

    const result = await pool.request()
      .input('username', sql.NVarChar(16), username)
      .query('SELECT username, image, update_date FROM profile WHERE username = @username');

    const profileData = result.recordset[0] || null;

    return NextResponse.json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์' },
      { status: 500 }
    );
  }
}

/**
 * POST: อัปโหลดรูปภาพโปรไฟล์ใหม่ขึ้น MinIO (store/profile) และบันทึกลงฐานข้อมูล
 */
export async function POST(request) {
  try {
    // ตรวจสอบ Token
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }
    const username = authResult.user.username;

    // ดึงไฟล์จาก FormData
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
    }
    if (!file.type?.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'ไฟล์ที่อัปโหลดต้องเป็นรูปภาพเท่านั้น' }, { status: 400 });
    }

    const pool = await getDbPool();

    // ดึงชื่อรูปเก่าของผู้ใช้ เพื่อนำไปลบออกจาก MinIO ทีหลัง
    const oldProfileRes = await pool.request()
      .input('username', sql.NVarChar(16), username)
      .query('SELECT image FROM profile WHERE username = @username');

    const oldImageFilename = oldProfileRes.recordset[0]?.image;

    // อัปโหลดไฟล์ขึ้น MinIO Bucket "store" โฟลเดอร์ "profile"
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(buffer);
    const ext = file.name.split('.').pop() || 'png';
    const newFilename = `${crypto.randomUUID()}.${ext}`;
    const bucketName = 'store';
    const objectName = `profile/${newFilename}`;

    await minioClient.putObject(bucketName, objectName, buffer, buffer.length, {
      'Content-Type': file.type || 'image/png',
    });

    // บันทึก/อัปเดตลงตาราง profile ใน SQL Server (MERGE)
    await pool.request()
      .input('username', sql.NVarChar(16), username)
      .input('image', sql.NVarChar(sql.MAX), newFilename)
      .query(`
        MERGE profile AS target
        USING (SELECT @username AS username, @image AS image) AS source ON target.username = source.username
        WHEN MATCHED THEN
          UPDATE SET image = source.image, update_date = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (username, image, update_date) VALUES (source.username, source.image, SYSDATETIME());
      `);

    // ลบรูปภาพเก่าใน MinIO (ถ้ามี)
    if (oldImageFilename && !oldImageFilename.startsWith('http')) {
      minioClient.removeObject(bucketName, `profile/${oldImageFilename}`).catch((err) => {
        console.warn('Could not delete old profile image from MinIO:', err.message);
      });
    }

    return NextResponse.json({
      success: true,
      image: newFilename,
      message: 'อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว',
    });

  } catch (error) {
    console.error('Update profile image error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตรูปภาพโปรไฟล์' },
      { status: 500 }
    );
  }
}