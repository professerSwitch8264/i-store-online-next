// src/app/api/products/route.js
import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

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
    const includeAll = searchParams.get('include_all') === 'true';

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
        p.company_code,
        p.store_id,
        p.category_id,
        p.unit_id,
        p.location_id,
        p.status,
        loc.location_name,
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
      LEFT JOIN locations loc ON p.location_id = loc.location_id
      LEFT JOIN v_inventory inv ON p.product_id = inv.product_id
      WHERE (p.status IS NULL OR p.status IN ('Y', 'N'))
    `;

    // 4. กรองสิทธิ์ร้านค้า (Public + Private เฉพาะที่มีในตาราง customers หรือเป็นเจ้าของร้าน)
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

    // 5. ตัวกรองค้นหา (รองรับหลายคำคั่นด้วย comma เช่น "มาม่า,ต้มยำ")
    if (search) {
      const terms = search.split(',').map((t) => t.trim()).filter(Boolean);
      terms.forEach((term, index) => {
        const paramName = `searchTerm_${index}`;
        req.input(paramName, `%${term}%`);
        query += ` AND (p.product_name LIKE @${paramName} OR p.product_desc LIKE @${paramName} OR loc.location_name LIKE @${paramName} OR p.company_code LIKE @${paramName})`;
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
      ORDER BY p.product_name ASC, p.product_id ASC
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

/**
 * POST /api/products
 * เพิ่มสินค้าใหม่ลงในร้านค้า
 */
export async function POST(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const body = await request.json();
    const {
      store_id,
      product_name,
      product_desc = '',
      product_price = 0,
      product_thumbnail = null,
      company_code = '',
      category_id = null,
      unit_id = null,
      location_id = null,
      order_limit = 0,
      batch_size = 1,
      status = 'Y',
    } = body;

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ store_id' },
        { status: 400 }
      );
    }

    if (!product_name || !product_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อสินค้า' },
        { status: 400 }
      );
    }

    // ตรวจสอบสิทธิ์ (เจ้าของร้านหรือ Admin)
    const isOwner =
      currentUser.isAdmin ||
      (currentUser.ownedStoreIds || []).includes(store_id);

    const pool = await getDbPool();

    if (!isOwner) {
      const ownerCheck = await pool
        .request()
        .input('store_id', sql.VarChar(50), store_id)
        .input('username', sql.VarChar(50), currentUser.username)
        .query('SELECT 1 FROM owners WHERE store_id = @store_id AND username = @username');

      if (ownerCheck.recordset.length === 0) {
        return NextResponse.json(
          { success: false, error: 'คุณไม่มีสิทธิ์เพิ่มสินค้าในร้านนี้' },
          { status: 403 }
        );
      }
    }

    const priceVal = Math.max(0, parseFloat(product_price) || 0);
    const batchVal = Math.max(1, parseInt(batch_size, 10) || 1);
    const limitVal = order_limit === '' || order_limit === null ? 0 : Math.max(0, parseInt(order_limit, 10) || 0);
    const statusVal = status === 'N' ? 'N' : 'Y';

    const insertReq = pool.request();
    insertReq.input('store_id', sql.UniqueIdentifier, store_id);
    insertReq.input('product_name', sql.NVarChar(128), product_name.trim());
    insertReq.input('product_desc', sql.NVarChar(sql.MAX), product_desc ? product_desc.trim() : '');
    insertReq.input('product_price', sql.Float, priceVal);
    insertReq.input('product_thumbnail', sql.NVarChar(sql.MAX), product_thumbnail || null);
    insertReq.input('company_code', sql.NVarChar(64), company_code ? company_code.trim() : null);
    insertReq.input('category_id', sql.UniqueIdentifier, category_id || null);
    insertReq.input('unit_id', sql.UniqueIdentifier, unit_id || null);
    insertReq.input('location_id', sql.UniqueIdentifier, location_id || null);
    insertReq.input('order_limit', sql.Int, limitVal);
    insertReq.input('batch_size', sql.Int, batchVal);
    insertReq.input('status', sql.NVarChar(1), statusVal);
    insertReq.input('update_by', sql.NVarChar(16), currentUser.username);

    const result = await insertReq.query(`
      DECLARE @newId UNIQUEIDENTIFIER = NEWID();
      INSERT INTO products (
        product_id,
        store_id,
        product_name,
        product_desc,
        product_price,
        product_thumbnail,
        company_code,
        category_id,
        unit_id,
        location_id,
        order_limit,
        batch_size,
        status,
        update_by,
        update_date
      ) VALUES (
        @newId,
        @store_id,
        @product_name,
        @product_desc,
        @product_price,
        @product_thumbnail,
        @company_code,
        @category_id,
        @unit_id,
        @location_id,
        @order_limit,
        @batch_size,
        @status,
        @update_by,
        SYSDATETIME()
      );

      SELECT 
        p.product_id,
        p.product_name,
        p.product_desc,
        p.product_thumbnail,
        p.product_price,
        p.company_code,
        p.store_id,
        p.category_id,
        p.unit_id,
        p.location_id,
        p.status,
        p.order_limit,
        p.batch_size
      FROM products p
      WHERE p.product_id = @newId;
    `);

    const createdProduct = result.recordset?.[0];

    return NextResponse.json({
      success: true,
      message: `เพิ่มสินค้า "${product_name.trim()}" เรียบร้อยแล้ว`,
      data: createdProduct,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มสินค้า' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products
 * อัปเดตข้อมูลสินค้าแบบ Dynamic Partial Update
 * รองรับทั้งการเปลี่ยนสถานะ (status: 'Y'|'N') และการแก้ไขรายละเอียดสินค้า (product_name, product_desc, product_price, ฯลฯ)
 */
export async function PUT(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const body = await request.json();
    const {
      product_id,
      product_name,
      product_desc,
      product_price,
      product_thumbnail,
      company_code,
      category_id,
      unit_id,
      location_id,
      order_limit,
      batch_size,
      status,
    } = body;

    if (!product_id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ product_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบว่ามีสินค้านี้อยู่จริง และดึง store_id มาตรวจสอบสิทธิ์
    const productCheck = await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, product_id)
      .query(`
        SELECT product_id, product_name, store_id, status 
        FROM products 
        WHERE product_id = @product_id
      `);

    const product = productCheck.recordset?.[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลสินค้าที่ต้องการแก้ไข' },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (เจ้าของร้านหรือ Admin เท่านั้น)
    const isOwner =
      currentUser.isAdmin ||
      (currentUser.ownedStoreIds || []).includes(product.store_id);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขสินค้านี้' },
        { status: 403 }
      );
    }

    const req = pool.request();
    req.input('product_id', sql.UniqueIdentifier, product_id);
    req.input('update_by', sql.NVarChar(16), currentUser.username);

    const updateFields = ['update_by = @update_by', 'update_date = SYSDATETIME()'];
    let onlyStatusChanged = true;
    let newStatus = null;

    // 1. สถานะสินค้า (status: 'Y' หรือ 'N')
    if (status !== undefined) {
      newStatus = status === 'Y' || status === true ? 'Y' : 'N';
      req.input('status', sql.NVarChar(1), newStatus);
      updateFields.push('status = @status');
    }

    // 2. ชื่อสินค้า
    if (product_name !== undefined) {
      onlyStatusChanged = false;
      if (!product_name.trim()) {
        return NextResponse.json(
          { success: false, error: 'กรุณาระบุชื่อสินค้า' },
          { status: 400 }
        );
      }
      req.input('product_name', sql.NVarChar(128), product_name.trim());
      updateFields.push('product_name = @product_name');
    }

    // 3. รายละเอียดสินค้า
    if (product_desc !== undefined) {
      onlyStatusChanged = false;
      req.input('product_desc', sql.NVarChar(sql.MAX), product_desc ? product_desc.trim() : '');
      updateFields.push('product_desc = @product_desc');
    }

    // 4. ราคาสินค้า
    if (product_price !== undefined) {
      onlyStatusChanged = false;
      const priceVal = parseFloat(product_price);
      if (isNaN(priceVal) || priceVal < 0) {
        return NextResponse.json(
          { success: false, error: 'ราคาสินค้าต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0' },
          { status: 400 }
        );
      }
      req.input('product_price', sql.Float, priceVal);
      updateFields.push('product_price = @product_price');
    }

    // 5. รูปภาพสินค้า
    if (product_thumbnail !== undefined) {
      onlyStatusChanged = false;
      req.input('product_thumbnail', sql.NVarChar(sql.MAX), product_thumbnail || null);
      updateFields.push('product_thumbnail = @product_thumbnail');
    }

    // 5.1 รหัสสินค้าบัญชี (company_code)
    if (company_code !== undefined) {
      onlyStatusChanged = false;
      req.input('company_code', sql.NVarChar(64), company_code ? company_code.trim() : null);
      updateFields.push('company_code = @company_code');
    }

    // 6. หมวดหมู่สินค้า
    if (category_id !== undefined) {
      onlyStatusChanged = false;
      req.input('category_id', sql.UniqueIdentifier, category_id || null);
      updateFields.push('category_id = @category_id');
    }

    // 7. หน่วยนับสินค้า
    if (unit_id !== undefined) {
      onlyStatusChanged = false;
      req.input('unit_id', sql.UniqueIdentifier, unit_id || null);
      updateFields.push('unit_id = @unit_id');
    }

    // 8. สถานที่จัดเก็บ
    if (location_id !== undefined) {
      onlyStatusChanged = false;
      req.input('location_id', sql.UniqueIdentifier, location_id || null);
      updateFields.push('location_id = @location_id');
    }

    // 9. จำกัดจำนวนสั่งซื้อต่อครั้ง (order_limit)
    if (order_limit !== undefined) {
      onlyStatusChanged = false;
      const limitVal = order_limit === '' || order_limit === null ? null : parseInt(order_limit, 10);
      req.input('order_limit', sql.Int, isNaN(limitVal) ? null : limitVal);
      updateFields.push('order_limit = @order_limit');
    }

    // 10. หน่วยบรรจุ / ล็อตสั่งซื้อ (batch_size)
    if (batch_size !== undefined) {
      onlyStatusChanged = false;
      const batchVal = batch_size === '' || batch_size === null ? null : parseInt(batch_size, 10);
      req.input('batch_size', sql.Int, isNaN(batchVal) ? null : batchVal);
      updateFields.push('batch_size = @batch_size');
    }

    // ตรวจสอบว่ามีฟิลด์ที่ส่งมาอัปเดตหรือไม่
    if (updateFields.length <= 2) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' },
        { status: 400 }
      );
    }

    await req.query(`
      UPDATE products
      SET ${updateFields.join(', ')}
      WHERE product_id = @product_id
    `);

    // สร้างข้อความตอบกลับตามเงื่อนไขที่ส่งมา
    let message = 'บันทึกข้อมูลสินค้าเรียบร้อยแล้ว';
    if (onlyStatusChanged && newStatus !== null) {
      message =
        newStatus === 'Y'
          ? `เปิดจำหน่ายสินค้า "${product.product_name}" เรียบร้อยแล้ว`
          : `งดจำหน่ายสินค้า "${product.product_name}" เรียบร้อยแล้ว`;
    }

    return NextResponse.json({
      success: true,
      message,
      product_id,
      ...(newStatus !== null ? { status: newStatus } : {}),
    });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลสินค้า' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products
 * ลบสินค้า (Soft delete ปรับสถานะเป็น 'D' และลบออกจากตะกร้า)
 */
export async function DELETE(request) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const { searchParams } = new URL(request.url);
    let productId = searchParams.get('product_id');

    if (!productId) {
      try {
        const body = await request.json();
        productId = body?.product_id;
      } catch (e) {
        // body might be empty if sent via query param
      }
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ product_id' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // ตรวจสอบว่ามีสินค้านี้อยู่จริง และดึง store_id มาตรวจสอบสิทธิ์
    const productCheck = await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, productId)
      .query(`
        SELECT product_id, product_name, store_id, status 
        FROM products 
        WHERE product_id = @product_id
      `);

    const product = productCheck.recordset?.[0];
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลสินค้าที่ต้องการลบ' },
        { status: 404 }
      );
    }

    // ตรวจสอบสิทธิ์ (เจ้าของร้านเท่านั้น)
    const isOwner = (currentUser.ownedStoreIds || []).includes(product.store_id);
    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์ลบสินค้านี้' },
        { status: 403 }
      );
    }

    // ลบสินค้าออกจากตะกร้าถ้ามีค้างอยู่
    await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, productId)
      .query(`DELETE FROM cart WHERE product_id = @product_id`);

    // ทำการ Soft Delete ด้วยการปรับ status = 'D' (Deleted)
    await pool
      .request()
      .input('product_id', sql.UniqueIdentifier, productId)
      .input('update_by', sql.NVarChar(16), currentUser.username)
      .query(`
        UPDATE products
        SET status = 'D',
            update_by = @update_by,
            update_date = SYSDATETIME()
        WHERE product_id = @product_id
      `);

    return NextResponse.json({
      success: true,
      message: `ลบสินค้า "${product.product_name}" เรียบร้อยแล้ว`,
      product_id: productId,
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบสินค้า' },
      { status: 500 }
    );
  }
}