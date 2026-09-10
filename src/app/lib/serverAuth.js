// src/lib/serverAuth.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';

// 1. ฟังก์ชันตรวจโครงสร้างและวันหมดอายุของ JWT Token
function validateJwt(token) {
  try {
    if (!token || typeof token !== 'string') return { valid: false, error: 'ไม่พบ Token' };

    const parts = token.trim().split('.');
    if (parts.length !== 3) return { valid: false, error: 'โครงสร้าง Token ไม่ถูกต้อง' };

    // ถอดรหัสส่วน Payload
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);

    // ตรวจสอบวันหมดอายุ (exp)
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return { valid: false, error: 'Token หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่' };
      }
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบ Token' };
  }
}

// 2. ฟังก์ชัน Guard สำหรับเรียกใช้ในทุกๆ API
export async function verifyApiAuth(request) {
  // 2.1 ดึง Token จาก Header Authorization: Bearer <token>
  let token = null;
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2.2 ถ้าใน Header ไม่มี ให้ดึงจาก Cookie
  if (!token) {
    token =
      request.cookies.get('security_token')?.value ||
      request.cookies.get('kc_token')?.value;
  }

  // ❌ ถ้าไม่มี Token เลย ปฏิเสธทันที (401 Unauthorized)
  if (!token) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' },
        { status: 401 }
      ),
    };
  }

  // 2.3 ตรวจสอบความถูกต้องและวันหมดอายุของ Token
  const validation = validateJwt(token);
  if (!validation.valid || !validation.payload) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: validation.error || 'Token ไม่ถูกต้องหรือหมดอายุ' },
        { status: 401 }
      ),
    };
  }

  const payload = validation.payload;
  const username = String(payload.preferred_username || payload.username || '').toUpperCase();

  if (!username) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, error: 'Token ไม่ระบุข้อมูลผู้ใช้งาน' },
        { status: 401 }
      ),
    };
  }

  // 2.4 ดึงข้อมูลสิทธิ์และร้านค้าที่เข้าถึงได้จาก SQL Server
  try {
    const pool = await getDbPool();

    // เช็คสิทธิ์ Admin
    const adminRes = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT username FROM admins WHERE username = @username');
    const isAdmin = adminRes.recordset.length > 0;

    // เช็คร้านค้าส่วนตัวที่คนนี้มีสิทธิ์เข้าถึง (ตาราง customers)
    const customerRes = await pool.request()
      .input('custUser', sql.NVarChar, username)
      .query('SELECT store_id FROM customers WHERE username = @custUser');
    const allowedPrivateStoreIds = customerRes.recordset.map((r) => r.store_id);

    // เช็คร้านค้าที่คนนี้เป็นเจ้าของ (ตาราง owners)
    const ownerRes = await pool.request()
      .input('ownerUser', sql.NVarChar, username)
      .query('SELECT store_id FROM owners WHERE username = @ownerUser');
    const ownedStoreIds = ownerRes.recordset.map((r) => r.store_id);

    // เช็คสิทธิ์ Approver (ตาราง order_approvers)
    const approverRes = await pool.request()
      .input('approverUser', sql.NVarChar, username)
      .query('SELECT department_code FROM order_approvers WHERE username = @approverUser');
    const approverDepartmentCodes = approverRes.recordset.map((r) => r.department_code).filter(Boolean);
    const isApprover = approverDepartmentCodes.length > 0;

    return {
      authenticated: true,
      user: {
        username,
        ...payload,
        isAdmin,
        isApprover,
        approverDepartmentCodes,
        allowedPrivateStoreIds,
        ownedStoreIds,
      },
    };
  } catch (dbError) {
    console.error('VerifyAuth Database Error:', dbError);
    // ถ้าต่อ DB ไม่ติด ก็ยังให้ผ่านในฐานะ User ธรรมดา
    return {
      authenticated: true,
      user: {
        username,
        name: payload.name || username,
        email: payload.email || '',
        isAdmin: false,
        isApprover: false,
        approverDepartmentCodes: [],
        allowedPrivateStoreIds: [],
        ownedStoreIds: [],
      },
    };
  }
}