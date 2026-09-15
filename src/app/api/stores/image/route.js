// src/app/api/stores/image/route.js
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

export async function POST(request) {
  try {
    // -------------------------------------------------------------
    // ขั้นตอนที่ 1: ตรวจสอบ Token ผู้ใช้งาน
    // -------------------------------------------------------------
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response; // 401 Unauthorized
    }
    const currentUser = authResult.user;

    // -------------------------------------------------------------
    // ขั้นตอนที่ 2: ดึงข้อมูลจาก FormData (ไฟล์รูป + store_id)
    // -------------------------------------------------------------
    const formData = await request.formData();
    const file = formData.get('image');
    const storeId = formData.get('store_id') || formData.get('storeId');

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ store_id' }, { status: 400 });
    }
    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' }, { status: 400 });
    }
    if (!file.type?.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'ไฟล์ที่อัปโหลดต้องเป็นรูปภาพเท่านั้น' }, { status: 400 });
    }

    const pool = await getDbPool();

    // -------------------------------------------------------------
    // ขั้นตอนที่ 3: ตรวจสอบสิทธิ์ (ต้องเป็น Owner ของร้านนี้)
    // -------------------------------------------------------------
    const ownerCheck = await pool.request()
      .input('store_id', sql.VarChar(50), storeId)
      .input('username', sql.VarChar(50), currentUser.username)
      .query('SELECT 1 FROM owners WHERE store_id = @store_id AND username = @username');

    if (ownerCheck.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลร้านค้านี้ (เฉพาะเจ้าของร้านค้าเท่านั้น)' }, { status: 403 });
    }

    // -------------------------------------------------------------
    // ขั้นตอนที่ 4: ดึงชื่อรูปภาพเก่าในฐานข้อมูล (เพื่อนำไปลบออกจาก MinIO)
    // -------------------------------------------------------------
    const oldStoreRes = await pool.request()
      .input('store_id', sql.VarChar(50), storeId)
      .query('SELECT store_image FROM stores WHERE store_id = @store_id');

    if (oldStoreRes.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'ไม่พบร้านค้านี้ในระบบ' }, { status: 404 });
    }
    const oldImageFilename = oldStoreRes.recordset[0]?.store_image;

    // -------------------------------------------------------------
    // ขั้นตอนที่ 5: อัปโหลดรูปภาพใหม่ขึ้น MinIO Bucket "store/logo"
    // -------------------------------------------------------------
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || 'png';
    const newFilename = `${crypto.randomUUID()}.${ext}`;
    const bucketName = 'store';
    const objectName = `logo/${newFilename}`;

    await minioClient.putObject(bucketName, objectName, buffer, buffer.length, {
      'Content-Type': file.type || 'image/png',
    });

    // -------------------------------------------------------------
    // ขั้นตอนที่ 6: อัปเดตชื่อรูปภาพลงตาราง stores ใน SQL Server
    // -------------------------------------------------------------
    await pool.request()
      .input('store_id', sql.VarChar(50), storeId)
      .input('store_image', sql.NVarChar(sql.MAX), newFilename)
      .input('update_by', sql.VarChar(50), currentUser.username)
      .query(`
        UPDATE stores 
        SET store_image = @store_image,
            update_by = @update_by,
            update_date = SYSDATETIME()
        WHERE store_id = @store_id
      `);

    // -------------------------------------------------------------
    // ขั้นตอนที่ 7: ลบรูปภาพเก่าออกจาก MinIO (ถ้ามีรูปเดิมและไม่ใช่ URL ภายนอก)
    // -------------------------------------------------------------
    if (oldImageFilename && !oldImageFilename.startsWith('http')) {
      minioClient.removeObject(bucketName, `logo/${oldImageFilename}`).catch((err) => {
        console.warn('Could not delete old image from MinIO:', err.message);
      });
    }

    // ส่งผลลัพธ์สำเร็จกลับไปให้หน้าบ้าน
    return NextResponse.json({
      success: true,
      store_image: newFilename,
      message: 'อัปเดตรูปภาพร้านค้าเรียบร้อยแล้ว',
    });

  } catch (error) {
    console.error('Update store image error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตรูปภาพร้านค้า' },
      { status: 500 }
    );
  }
}