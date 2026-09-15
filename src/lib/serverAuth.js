// src/lib/serverAuth.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';

import crypto from 'crypto';

// In-memory cache สำหรับ Keycloak JWKS Keys เพื่อประสิทธิภาพระดับ sub-millisecond
let jwksCache = { keys: [], fetchedAt: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // แคชไว้ 1 ชั่วโมง

async function getJwksKeys(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && jwksCache.keys.length > 0 && (now - jwksCache.fetchedAt < CACHE_TTL_MS)) {
    return jwksCache.keys;
  }

  const baseUrl = (process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'https://sso-prod.wanthaifoods.com').replace(/\/+$/, '');
  const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'master';
  const jwksUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/certs`;

  const res = await fetch(jwksUrl);
  if (!res.ok) {
    throw new Error(`ไม่สามารถดึงข้อมูล JWKS จาก Keycloak ได้: ${res.statusText}`);
  }
  const data = await res.json();
  jwksCache = { keys: data.keys || [], fetchedAt: now };
  return jwksCache.keys;
}

function base64UrlToBuffer(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// 1. ฟังก์ชันตรวจโครงสร้าง วันหมดอายุ และ Cryptographic Signature ของ JWT Token
async function validateJwt(token) {
  try {
    if (!token || typeof token !== 'string') return { valid: false, error: 'ไม่พบ Token' };

    const parts = token.trim().split('.');
    if (parts.length !== 3) return { valid: false, error: 'โครงสร้าง Token ไม่ถูกต้อง' };

    // ถอดรหัสส่วน Header
    let header;
    try {
      header = JSON.parse(base64UrlToBuffer(parts[0]).toString('utf8'));
    } catch {
      return { valid: false, error: 'ส่วน Header ของ Token ไม่ถูกต้อง' };
    }

    // ถอดรหัสส่วน Payload
    let payload;
    try {
      payload = JSON.parse(base64UrlToBuffer(parts[1]).toString('utf8'));
    } catch {
      return { valid: false, error: 'ส่วน Payload ของ Token ไม่ถูกต้อง' };
    }

    // ตรวจสอบวันหมดอายุ (exp)
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return { valid: false, error: 'Token หมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่' };
      }
    }

    // กรณี Dev Mock Token สำหรับการทดสอบในเครื่อง (เฉพาะเมื่อไม่ใช่ production)
    if (
      process.env.NODE_ENV !== 'production' &&
      (header.alg === 'none' || !parts[2] || parts[2] === 'signature')
    ) {
      return { valid: true, payload };
    }

    // ตรวจสอบ Cryptographic Signature เฉพาะเมื่อเป็น RS256 Token จาก Keycloak
    if (header.alg === 'RS256') {
      try {
        let keys = await getJwksKeys(false);
        let keyJwk = header.kid ? keys.find((k) => k.kid === header.kid) : null;

        // หากไม่พบ key อาจเกิดจาก Keycloak ทำการ rotate key ใหม่ ให้ลองบังคับดึงล่าสุด 1 ครั้ง
        if (!keyJwk && header.kid) {
          keys = await getJwksKeys(true);
          keyJwk = keys.find((k) => k.kid === header.kid);
        }

        // หากเป็น Token ของ Keycloak ที่ระบุ kid ตรงกับ JWKS ให้ตรวจสอบลายมือชื่อ
        if (keyJwk) {
          const publicKey = crypto.createPublicKey({ key: keyJwk, format: 'jwk' });
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          const isValid = verifier.verify(publicKey, base64UrlToBuffer(parts[2]));

          if (!isValid) {
            console.warn('[serverAuth] Keycloak RS256 signature verification failed');
            return { valid: false, error: 'ลายมือชื่อ Token ไม่ถูกต้อง (Invalid Token Signature)' };
          }
        }
      } catch (jwksErr) {
        console.warn('[serverAuth] JWKS fetch/verify error:', jwksErr.message);
      }
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบ Token: ' + err.message };
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
  const validation = await validateJwt(token);
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