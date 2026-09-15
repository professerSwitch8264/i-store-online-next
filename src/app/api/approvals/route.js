// src/app/api/approvals/route.js

/**
 * =========================================================================
 * API Route: GET /api/approvals
 * =========================================================================
 * หน้าที่: ดึงรายการคำขออนุมัติคำสั่งซื้อที่รอการพิจารณา (Pending Approvals Queue)
 * 1. ดึงเฉพาะคำขอที่ status = 'P' และ en = 'Y' และ orders.status IN ('W', 'P')
 * 2. ตรวจสอบสิทธิ์: ผู้อนุมัติ (approvers มี username ของตน) หรือ Admin
 * 3. รวมข้อมูลรายการสินค้าจาก View v_orders
 * 4. รองรับการค้นหา (search), เรียงลำดับ (sorting) และการแบ่งหน้า (pagination)
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // ─────────────────────────────────────────────────────────────
    // 1. ตรวจสอบการยืนยันตัวตน
    // ─────────────────────────────────────────────────────────────
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const username = currentUser.username;
    const isAdmin = currentUser.isAdmin;

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const orderNo = (searchParams.get('order_no') || '').trim();
    const dateFrom = (searchParams.get('date_from') || '').trim();
    const dateTo = (searchParams.get('date_to') || '').trim();
    const buyer = (searchParams.get('buyer') || '').trim();
    const reserveFlag = (searchParams.get('reserve_flag') || '').trim();
    const sortBy = (searchParams.get('sort_field') || searchParams.get('sortBy') || 'request_date').trim();
    const sortOrder = (searchParams.get('sort_order') || searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));

    const pool = await getDbPool();

    // ─────────────────────────────────────────────────────────────
    // 2. ดึงรายการคำขออนุมัติที่สถานะ 'P' และ en = 'Y'
    // ─────────────────────────────────────────────────────────────
    const appReq = pool.request();
    let appQuery = `
      SELECT 
        a.approval_id,
        a.order_id,
        a.status AS approval_status,
        a.request_date,
        a.response_date,
        a.response_by,
        a.approvers,
        a.en,
        o.order_no,
        o.order_date,
        o.owner,
        o.store_id,
        o.shipping_location AS shipping_location_id,
        o.reserve_flag,
        o.status AS order_status
      FROM order_approvals a
      INNER JOIN orders o ON a.order_id = o.order_id
      WHERE a.status = 'P'
        AND a.en = 'Y'
        AND o.status IN ('W', 'P')
    `;

    if (!isAdmin) {
      appReq.input('username', sql.NVarChar, `%${username}%`);
      appQuery += ` AND a.approvers LIKE @username`;
    }

    appQuery += ` ORDER BY a.request_date DESC`;

    const approvalRes = await appReq.query(appQuery);
    const approvalRows = approvalRes.recordset || [];

    if (approvalRows.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          pagination: {
            page: 1,
            limit,
            totalCount: 0,
            totalPages: 1,
          },
        },
        { status: 200 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. ดึงรายละเอียดสินค้าและข้อมูลผู้สั่งซื้อจาก View v_orders
    // ─────────────────────────────────────────────────────────────
    const orderIds = approvalRows.map((r) => r.order_id).filter(Boolean);
    const vOrderReq = pool.request();
    const orderIdParams = [];

    orderIds.forEach((id, idx) => {
      const pName = `orderId_${idx}`;
      vOrderReq.input(pName, sql.UniqueIdentifier, id);
      orderIdParams.push(`@${pName}`);
    });

    const vOrderQuery = `
      SELECT 
        order_id,
        order_no,
        order_date,
        store_id,
        store_name,
        owner,
        firstname,
        lastname,
        firstname_th,
        lastname_th,
        department,
        department_th,
        shipping_location,
        reserve_flag,
        status,
        item_id,
        product_id,
        product_name,
        product_thumbnail,
        quantity,
        quantity_order,
        price,
        uom
      FROM v_orders
      WHERE order_id IN (${orderIdParams.join(', ')})
      ORDER BY product_name ASC, price ASC
    `;

    const vOrderRes = await vOrderReq.query(vOrderQuery);
    const orderDetails = vOrderRes.recordset || [];

    // ─────────────────────────────────────────────────────────────
    // 4. สร้าง Map รวบรวมข้อมูลตาม order_id
    // ─────────────────────────────────────────────────────────────
    const orderMap = new Map();

    for (const row of orderDetails) {
      const oId = row.order_id;
      if (!orderMap.has(oId)) {
        orderMap.set(oId, {
          order_id: oId,
          order_no: row.order_no,
          order_date: row.order_date,
          store_id: row.store_id,
          store_name: row.store_name || 'ร้านค้าส่วนกลาง',
          owner: row.owner,
          owner_fullname: `${row.firstname || ''} ${row.lastname || ''}`.trim(),
          owner_fullname_th: `${row.firstname_th || ''} ${row.lastname_th || ''}`.trim(),
          owner_department: row.department || '',
          owner_department_th: row.department_th || '',
          shipping_location: row.shipping_location || 'ไม่ระบุสถานที่',
          reserve_flag: row.reserve_flag === 'Y' || row.reserve_flag === '1',
          order_status: row.status,
          items: [],
          total_price: 0,
          total_items: 0,
        });
      }

      const orderObj = orderMap.get(oId);
      const qty = Number(row.quantity ?? row.quantity_order ?? 0);
      const price = Number(row.price ?? 0);

      orderObj.total_price += qty * price;

      const existingItem = orderObj.items.find((it) => {
        const sameProduct = it.product_id && row.product_id
          ? String(it.product_id).toLowerCase() === String(row.product_id).toLowerCase()
          : it.product_name === row.product_name;
        return sameProduct && Math.abs(Number(it.price) - price) < 0.0001;
      });

      if (existingItem) {
        existingItem.quantity += qty;
      } else {
        orderObj.items.push({
          item_id: row.item_id || row.product_id || '',
          product_id: row.product_id || '',
          product_name: row.product_name || '',
          quantity: qty,
          price: price,
          uom: row.uom || 'ชิ้น',
          product_thumbnail: row.product_thumbnail || '',
        });
        orderObj.total_items += 1;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. รวมข้อมูลคำขออนุมัติ + ข้อมูลออเดอร์ + รายการสินค้า
    // ─────────────────────────────────────────────────────────────
    let resultList = approvalRows
      .filter((app) => orderMap.has(app.order_id))
      .map((app) => {
        const orderInfo = orderMap.get(app.order_id);
        return {
          approval_id: app.approval_id,
          order_id: app.order_id,
          order_no: orderInfo.order_no || app.order_no || '-',
          order_date: orderInfo.order_date || app.order_date || app.request_date,
          request_date: app.request_date,
          approval_status: app.approval_status || 'P',
          approvers: app.approvers || '',
          response_by: app.response_by,
          response_date: app.response_date,

          owner: orderInfo.owner || app.owner || '-',
          owner_fullname: orderInfo.owner_fullname || '-',
          owner_fullname_th: orderInfo.owner_fullname_th || orderInfo.owner || '-',
          owner_department: orderInfo.owner_department || '-',
          owner_department_th: orderInfo.owner_department_th || '-',
          store_name: orderInfo.store_name || '-',
          shipping_location: orderInfo.shipping_location || '-',
          reserve_flag: orderInfo.reserve_flag,
          order_status: orderInfo.order_status || 'W',
          total_items: orderInfo.total_items || 0,
          total_price: Number((orderInfo.total_price || 0).toFixed(2)),
          items: orderInfo.items || [],
        };
      });

    // ─────────────────────────────────────────────────────────────
    // 6. กรองคำค้นหา (Search Filtering)
    // ─────────────────────────────────────────────────────────────
    if (search) {
      const keywords = search.split(/\s+/).filter(Boolean);
      resultList = resultList.filter((item) => {
        return keywords.every((kw) => {
          const matchOrderNo = item.order_no?.toLowerCase().includes(kw);
          const matchOwner = item.owner?.toLowerCase().includes(kw);
          const matchFullName = item.owner_fullname?.toLowerCase().includes(kw);
          const matchFullNameTH = item.owner_fullname_th?.toLowerCase().includes(kw);
          const matchDept = item.owner_department?.toLowerCase().includes(kw);
          const matchDeptTH = item.owner_department_th?.toLowerCase().includes(kw);
          const matchStore = item.store_name?.toLowerCase().includes(kw);
          const matchLocation = item.shipping_location?.toLowerCase().includes(kw);
          const matchProduct = item.items?.some((it) => it.product_name?.toLowerCase().includes(kw));

          return (
            matchOrderNo ||
            matchOwner ||
            matchFullName ||
            matchFullNameTH ||
            matchDept ||
            matchDeptTH ||
            matchStore ||
            matchLocation ||
            matchProduct
          );
        });
      });
    }

    // 6.2 กรองค้นหาละเอียด (Detail Filters)
    if (orderNo) {
      const kw = orderNo.toLowerCase();
      resultList = resultList.filter((item) => (item.order_no || '').toLowerCase().includes(kw));
    }
    if (buyer) {
      const kw = buyer.toLowerCase();
      resultList = resultList.filter((item) =>
        (item.owner || '').toLowerCase().includes(kw) ||
        (item.owner_fullname || '').toLowerCase().includes(kw) ||
        (item.owner_fullname_th || '').toLowerCase().includes(kw)
      );
    }
    if (dateFrom) {
      const fromTime = new Date(`${dateFrom}T00:00:00.000`).getTime();
      resultList = resultList.filter((item) => {
        const d = item.request_date || item.order_date;
        const itemTime = d ? new Date(d).getTime() : 0;
        return itemTime >= fromTime;
      });
    }
    if (dateTo) {
      const toTime = new Date(`${dateTo}T23:59:59.997`).getTime();
      resultList = resultList.filter((item) => {
        const d = item.request_date || item.order_date;
        const itemTime = d ? new Date(d).getTime() : 0;
        return itemTime <= toTime;
      });
    }
    if (reserveFlag && reserveFlag !== 'ALL') {
      const isPreorder = reserveFlag === 'Y';
      resultList = resultList.filter((item) => {
        const flag = item.reserve_flag === 'Y' || item.reserve_flag === true || item.reserve_flag === '1';
        return flag === isPreorder;
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 7. เรียงลำดับข้อมูล (Sorting)
    // ─────────────────────────────────────────────────────────────
    resultList.sort((a, b) => {
      let valA = a.request_date ? new Date(a.request_date).getTime() : 0;
      let valB = b.request_date ? new Date(b.request_date).getTime() : 0;

      if (sortBy === 'order_no') {
        valA = (a.order_no || '').toLowerCase();
        valB = (b.order_no || '').toLowerCase();
      } else if (sortBy === 'total_price') {
        valA = a.total_price;
        valB = b.total_price;
      } else if (sortBy === 'owner') {
        valA = (a.owner_fullname_th || a.owner || '').toLowerCase();
        valB = (b.owner_fullname_th || b.owner || '').toLowerCase();
      } else if (sortBy === 'reserve_flag') {
        valA = a.reserve_flag ? 1 : 0;
        valB = b.reserve_flag ? 1 : 0;
      } else if (sortBy === 'total_items') {
        valA = a.total_items;
        valB = b.total_items;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalCount = resultList.length;

    // ─────────────────────────────────────────────────────────────
    // 8. ตัดแบ่งหน้า (Server-Side Pagination)
    // ─────────────────────────────────────────────────────────────
    const startIndex = (page - 1) * limit;
    const paginatedData = resultList.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      {
        success: true,
        data: paginatedData,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลการอนุมัติ';
    console.error('💥 [Fatal Error in GET /api/approvals]:', error);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
