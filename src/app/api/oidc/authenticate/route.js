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

    // 3. เชื่อมต่อฐานข้อมูล SQL Server
    const pool = await getDbPool();
    const cleanUsername = String(info.username || username).trim();

    // 3.0 เสริมข้อมูลชื่อไทย แผนก บริษัท และตำแหน่งจากฐานข้อมูลภายใน (กรณี Central Auth ส่งมาไม่ครบ)
    if (!info.firstname_th || !info.department_th || !info.company_th || !info.section_th) {
      try {
        const accReq = pool.request();
        accReq.input('u', sql.NVarChar, cleanUsername);
        const accRes = await accReq.query('SELECT TOP 1 * FROM _accounts WHERE username = @u');
        const dbAccount = accRes.recordset[0];

        if (dbAccount) {
          if (!info.firstname_th && dbAccount.firstname_th) info.firstname_th = dbAccount.firstname_th;
          if (!info.lastname_th && dbAccount.lastname_th) info.lastname_th = dbAccount.lastname_th;
          if (!info.department && dbAccount.department) info.department = dbAccount.department;
          if (!info.department_th && dbAccount.department_th) info.department_th = dbAccount.department_th;
          if (!info.section && dbAccount.section) info.section = dbAccount.section;
          if (!info.section_th && dbAccount.section_th) info.section_th = dbAccount.section_th;
          if (!info.company && dbAccount.company) info.company = dbAccount.company;
          if (!info.company_th && dbAccount.company_th) info.company_th = dbAccount.company_th;
          if (!info.job_code && dbAccount.job_code) info.job_code = dbAccount.job_code;
          if (!info.email && dbAccount.email) info.email = dbAccount.email;
        } else {
          const refReq = pool.request();
          refReq.input('u', sql.NVarChar, cleanUsername);
          const refRes = await refReq.query('SELECT TOP 1 * FROM ref_accounts WHERE username = @u');
          const refAcc = refRes.recordset[0];

          if (refAcc) {
            if (!info.firstname_th && refAcc.firstname) info.firstname_th = refAcc.firstname;
            if (!info.lastname_th && refAcc.lastname) info.lastname_th = refAcc.lastname;
            if (!info.department && refAcc.department) info.department = refAcc.department;
            if (!info.department_th && refAcc.department) info.department_th = refAcc.department;
            if (!info.email && refAcc.email) info.email = refAcc.email;
          }
        }
      } catch (dbErr) {
        console.warn('Cannot query _accounts/ref_accounts fallback:', dbErr);
      }
    }

    info.fullname = `${info.firstname || ''} ${info.lastname || ''}`.trim() || username;
    info.fullnameTH = `${info.firstname_th || ''} ${info.lastname_th || ''}`.trim() || info.fullname;

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