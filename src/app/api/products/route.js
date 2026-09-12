// src/app/api/products/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export async function GET(request) {
  try {
    // 1. ตรวจสอบ Token
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const allowedPrivateStoreIds = currentUser.allowedPrivateStoreIds || [];

    // 2. รับ Query Parameters (เพิ่ม page และ limit ทีละ 12)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category_id') || '';
    const storeId = searchParams.get('store_id') || '';

    // 📄 คำนวณหน้าและจำนวนที่จะดึง
    const parsedPage = parseInt(searchParams.get('page'), 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedLimit = parseInt(searchParams.get('limit'), 10);
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 12 : Math.min(100, parsedLimit);
    const skip = Math.max(0, (page - 1) * limit);

    const pool = await getDbPool();
    const req = pool.request();

    // 3. เขียน SQL 
    let query = `
      SELECT 
        p.product_id,
        p.product_name,
        p.product_desc,
        p.product_thumbnail,
        p.product_price,
        p.store_id,
        p.category_id,
        p.unit_id,
        p.order_limit,
        p.batch_size,
        c.category_name,
        s.store_name,
        s.store_access,
        s.restock_day,
        u.unit AS unit_name,
        ISNULL(inv.quantity, 0) AS stock_quantity,
        COUNT(*) OVER() AS total_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN stores s ON p.store_id = s.store_id
      LEFT JOIN units u ON p.unit_id = u.unit_id
      LEFT JOIN v_inventory inv ON p.product_id = inv.product_id
      WHERE p.status = 'Y'
    `;

    // 4. กรองสิทธิ์ร้านค้า (Public + Private เฉพาะที่มีในตาราง customers หรือเป็นเจ้าของร้าน/Admin)
    if (!currentUser.isAdmin) {
      const accessibleStoreIds = Array.from(
        new Set([...allowedPrivateStoreIds, ...(currentUser.ownedStoreIds || [])])
      );

      if (accessibleStoreIds.length > 0) {
        const storePlaceholders = accessibleStoreIds.map((id, index) => {
          const paramName = `store_${index}`;
          req.input(paramName, id);
          return `@${paramName}`;
        });

        query += ` AND (
          s.store_access = 'public' 
          OR s.store_access IS NULL 
          OR p.store_id IN (${storePlaceholders.join(', ')})
        )`;
      } else {
        query += ` AND (s.store_access = 'public' OR s.store_access IS NULL)`;
      }
    }

    // 5. ตัวกรองค้นหา (รองรับหลายคำคั่นด้วย comma เช่น "มาม่า,ต้มยำ")
    if (search) {
      const terms = search.split(',').map((t) => t.trim()).filter(Boolean);
      terms.forEach((term, index) => {
        const paramName = `searchTerm_${index}`;
        req.input(paramName, `%${term}%`);
        query += ` AND (p.product_name LIKE @${paramName} OR p.product_desc LIKE @${paramName})`;
      });
    }

    if (categoryId) {
      req.input('categoryId', categoryId);
      query += ` AND p.category_id = @categoryId`;
    }

    if (storeId) {
      req.input('filterStoreId', storeId);
      query += ` AND p.store_id = @filterStoreId`;
    }

    // 6. 📄 ใส่ Pagination: OFFSET และ FETCH NEXT (ต้องอยู่หลัง ORDER BY)
    req.input('skip', sql.Int, skip);
    req.input('limit', sql.Int, limit);

    query += ` 
      ORDER BY p.product_name ASC
      OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
    `;

    // 7. รัน Query และคำนวณสรุปหน้า
    const result = await req.query(query);
    const rows = result.recordset;

    // หาจำนวนทั้งหมดจากแถวแรก (ถ้าไม่มีผลลัพธ์เลย ให้ total เป็น 0)
    const total = rows.length > 0 ? rows[0].total_count : 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}