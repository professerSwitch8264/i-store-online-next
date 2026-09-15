// src/app/api/products/image/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';
import { Client } from 'minio';
import crypto from 'crypto';

// ตั้งค่า MinIO Client
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || '129.0.2.226',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || '',
  secretKey: process.env.MINIO_SECRET_KEY || '',
});

/**
 * POST /api/products/image
 * อัปโหลดรูปภาพสินค้าขึ้น MinIO Bucket "store/thumbnail"
 */
export async function POST(request) {
  try {
    // 1. ตรวจสอบการยืนยันตัวตน
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }
    const currentUser = authResult.user;

    // 2. รับข้อมูล FormData
    const formData = await request.formData();
    const file = formData.get('image');
    const storeId = formData.get('store_id') || formData.get('storeId');
    const productId = formData.get('product_id');

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: 'กรุณาเลือกไฟล์รูปภาพ' },
        { status: 400 }
      );
    }

    if (!file.type?.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'ไฟล์ที่อัปโหลดต้องเป็นรูปภาพเท่านั้น' },
        { status: 400 }
      );
    }

    // 3. ตรวจสอบสิทธิ์ (เจ้าของร้านหรือ Admin)
    const isOwner =
      currentUser.isAdmin ||
      (currentUser.ownedStoreIds || []).includes(storeId);

    if (!isOwner) {
      const pool = await getDbPool();
      const ownerCheck = await pool
        .request()
        .input('store_id', sql.VarChar(50), storeId)
        .input('username', sql.VarChar(50), currentUser.username)
        .query(
          'SELECT 1 FROM owners WHERE store_id = @store_id AND username = @username'
        );

      if (ownerCheck.recordset.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'คุณไม่มีสิทธิ์อัปโหลดรูปภาพสินค้าสำหรับร้านนี้',
          },
          { status: 403 }
        );
      }
    }

    // 4. อัปโหลดรูปภาพขึ้น MinIO
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop() || 'png';
    const newFilename = `${crypto.randomUUID()}.${ext}`;
    const bucketName = 'store';
    const objectName = `thumbnail/${newFilename}`;

    await minioClient.putObject(bucketName, objectName, buffer, buffer.length, {
      'Content-Type': file.type || 'image/png',
    });

    // 5. ถ้ามี product_id ให้บันทึกลง SQL ด้วย
    if (productId) {
      const pool = await getDbPool();
      await pool
        .request()
        .input('product_id', sql.UniqueIdentifier, productId)
        .input('product_thumbnail', sql.NVarChar(sql.MAX), newFilename)
        .input('update_by', sql.NVarChar(16), currentUser.username)
        .query(`
          UPDATE products
          SET product_thumbnail = @product_thumbnail,
              update_by = @update_by,
              update_date = SYSDATETIME()
          WHERE product_id = @product_id
        `);
    }

    return NextResponse.json({
      success: true,
      product_thumbnail: newFilename,
      message: 'อัปโหลดรูปภาพสินค้าเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Upload product image error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพสินค้า',
      },
      { status: 500 }
    );
  }
}
