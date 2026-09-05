// src/app/api/oidc/authenticate/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ฟังก์ชันช่วยถอดรหัส Token (กรณีเซิร์ฟเวอร์กลางล่ม เรายังดึงชื่อผู้ใช้จาก Token ได้)
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

export async function POST(request) {
  try {
    // 1. แกะข้อมูล JSON ที่หน้าบ้านส่งมา
    const body = await request.json();
    const { username, sessionTimeout, token } = body;

    if (!username || !token) {
      return NextResponse.json(
        { result: 'Error', message: 'username and token are required' },
        { status: 400 }
      );
    }

    let info = {};
    let securityToken = token;
    let expireAt = Date.now() + 3600000; // 1 ชั่วโมง

    // 2. ยิงไปขอข้อมูลชื่อและแผนกจากระบบกลาง Wan Thai
    const centralAuthUrl = process.env.CENTRAL_AUTH_API_URL || '';
    if (centralAuthUrl) {
      try {
        const authRes = await fetch(centralAuthUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username, sessionTimeout: sessionTimeout || '60m' }),
          cache: 'no-store',
        });

        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.info) info = { ...authData.info };
          if (authData.securityToken) securityToken = authData.securityToken;
        }
      } catch (err) {
        console.warn('Central Auth fetch failed, fallback to token claims');
      }
    }

    // ถ้าดึงจาก Central Auth ไม่ได้ ให้ดึงจาก Token ตรงๆ
    if (!info.username) {
      const claims = decodeJwt(token);
      info = {
        username: claims.preferred_username || username,
        firstname: claims.given_name || claims.name || username,
        lastname: claims.family_name || '',
        email: claims.email || '',
        department: claims.department || '',
      };
    }

    info.fullname = `${info.firstname || ''} ${info.lastname || ''}`.trim() || username;
    info.fullnameTH = `${info.firstname_th || ''} ${info.lastname_th || ''}`.trim() || info.fullname;

        // 3. เชื่อมต่อฐานข้อมูล SQL Server
    const pool = await getDbPool();
    const cleanUsername = String(info.username || username).trim();

    // 3.1 เช็คสิทธิ์ Admin (ตาราง admins)
    let accessLevel = 'User';
    const adminCheck = await pool.request()
      .input('username', sql.NVarChar, cleanUsername)
      .query('SELECT username FROM admins WHERE username = @username');

    if (adminCheck.recordset.length > 0) {
      accessLevel = 'Admin';
    }

    // 3.2 เช็คร้านค้าที่คนนี้เป็นเจ้าของ (ตาราง owners เชื่อมกับ stores)
    const storeCheck = await pool.request()
      .input('ownerUsername', sql.NVarChar, cleanUsername)
      .query(`
        SELECT s.store_id, s.store_name, s.store_access, s.status
        FROM owners o
        JOIN stores s ON o.store_id = s.store_id
        WHERE o.username = @ownerUsername
      `);

    const ownedStores = storeCheck.recordset || [];

    // 4. ส่งข้อมูลทั้งหมดกลับไปให้ AuthProvider
    return NextResponse.json({
      result: 'OK',
      info,
      securityToken,
      expireAt,
      accessLevel,
      ownedStores,
    }, { status: 200 });

  } catch (error) {
    console.error('OIDC Authenticate Error:', error);
    return NextResponse.json(
      { result: 'Error', message: error.message },
      { status: 500 }
    );
  }
}