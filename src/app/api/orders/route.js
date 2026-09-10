// src/app/api/orders/route.js

/**
 * =========================================================================
 * API Route: GET /api/orders (ดึงรายการคำสั่งซื้อแบบ Server-Side Pagination 100%)
 * =========================================================================
 * สถาปัตยกรรม & การทำงาน:
 * 1. รับ Query Parameters: page, limit, status, search, store_id, reserve_flag, sort_field, sort_order
 * 2. ป้องกัน IDOR ด้วย Auth Guard (verifyApiAuth)
 * 3. กำหนดขอบเขตสิทธิ์ (Role & Department Scoping):
 *    - ผู้อนุมัติ (Approver): ดูคำสั่งซื้อของพนักงานในแผนกที่ตนเองดูแลได้
 *    - ผู้ดูแลระบบ (Admin): ดูของตนเอง หรือระบุ requestedOwner เพื่อดูของพนักงานคนอื่น
 *    - พนักงานทั่วไป (User): ดูได้เฉพาะคำสั่งซื้อของตนเองเท่านั้น (owner = currentUser.username)
 * 4. คำนวณยอดรวมในแต่ละแท็บสถานะทั้ง 7 แท็บ (ALL, PENDING, PREPARING, AWAITING_RECEIPT, COMPLETED, REJECTED, CANCELLED)
 *    ด้วยคำสั่ง SQL Aggregation เพียงครั้งเดียว เพื่อประสิทธิภาพสูงสุด
 * 5. ดึงรายการคำสั่งซื้อแบบ Server-Side Pagination (OFFSET...FETCH NEXT)
 * 6. ดึงข้อมูลสินค้าย่อยและผู้อนุมัติเฉพาะของคำสั่งซื้อในหน้านั้น (Scoped Line Items Fetch) ผ่าน View v_orders และ order_approvals
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/app/lib/db';
import { verifyApiAuth } from '@/app/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // ─────────────────────────────────────────────────────────────
    // 🛡️ [ขั้นตอนที่ 1]: ตรวจสอบการยืนยันตัวตน (Authentication Check)
    // ─────────────────────────────────────────────────────────────
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 2]: รับค่า Filter & Pagination Parameters จาก URL Query
    // ─────────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const requestedOwner = (searchParams.get('owner') || '').trim();
    const statusParam = (searchParams.get('status') || '').trim();
    const search = (searchParams.get('search') || '').trim();
    const storeId = (searchParams.get('store_id') || '').trim();
    const reserveFlag = (searchParams.get('reserve_flag') || '').trim();
    const isStoreView = searchParams.get('is_store_view') === 'true' && Boolean(storeId);

    // คำนวณหน้าและการแบ่งหน้า (Pagination)
    const parsedPage = parseInt(searchParams.get('page'), 10);
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedLimit = parseInt(searchParams.get('limit'), 10);
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 10 : Math.min(100, parsedLimit);
    const skip = Math.max(0, (page - 1) * limit);

    // การจัดเรียงลำดับ (Sorting)
    const sortBy = searchParams.get('sort_field') || searchParams.get('sortBy') || 'order_date';
    const sortOrder = (searchParams.get('sort_order') || searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const pool = await getDbPool();

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 3]: กำหนดขอบเขตสิทธิ์การเข้าถึงข้อมูล (Role & Scoping)
    // ─────────────────────────────────────────────────────────────
    let allowedOwners = [currentUser.username];

    if (isStoreView) {
      // โหมดผู้ดูแลร้านค้า (Store Management View)
      if (!currentUser.isAdmin) {
        const checkOwnerReq = pool.request();
        checkOwnerReq.input('storeId', sql.UniqueIdentifier, storeId);
        checkOwnerReq.input('username', sql.NVarChar, currentUser.username);
        const ownerCheck = await checkOwnerReq.query(
          'SELECT 1 FROM owners WHERE store_id = @storeId AND username = @username'
        );
        if (ownerCheck.recordset.length === 0) {
          return NextResponse.json(
            { success: false, error: 'คุณไม่มีสิทธิ์จัดการร้านค้านี้' },
            { status: 403 }
          );
        }
      }
    } else if (
      currentUser.isApprover &&
      currentUser.approverDepartmentCodes &&
      currentUser.approverDepartmentCodes.length > 0
    ) {
      // ค้นหารายชื่อพนักงานทุกคนที่อยู่ในแผนกที่ตนเองเป็นผู้อนุมัติ
      const deptReq = pool.request();
      const deptParams = [];
      currentUser.approverDepartmentCodes.forEach((d, idx) => {
        const paramName = `dept_${idx}`;
        deptReq.input(paramName, sql.NVarChar, d);
        deptParams.push(`@${paramName}`);
      });

      const deptSql = `
        SELECT DISTINCT username FROM (
          SELECT username FROM _accounts WHERE department_code IN (${deptParams.join(', ')})
          UNION
          SELECT username FROM ref_accounts WHERE department IN (${deptParams.join(', ')})
        ) AS dept_users
      `;

      try {
        const deptResult = await deptReq.query(deptSql);
        const deptUsernames = Array.from(
          new Set([
            ...deptResult.recordset.map((r) => r.username),
            currentUser.username,
          ])
        );

        if (requestedOwner && deptUsernames.includes(requestedOwner)) {
          allowedOwners = [requestedOwner];
        } else {
          allowedOwners = deptUsernames;
        }
      } catch (err) {
        console.warn('Approver department fetch fallback:', err);
        allowedOwners = [currentUser.username];
      }
    } else if (currentUser.isAdmin && requestedOwner) {
      // ผู้ดูแลระบบ (Admin) เจาะจงดูของพนักงานรายบุคคล
      allowedOwners = [requestedOwner];
    } else {
      // พนักงานทั่วไป -> ดูเฉพาะออเดอร์ของตนเอง
      allowedOwners = [currentUser.username];
    }

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 4]: สร้างเงื่อนไข Where Clause สำหรับ Query
    // ─────────────────────────────────────────────────────────────
    const whereConditions = [];
    const countRequest = pool.request();
    const dataRequest = pool.request();
    const ownerParams = [];

    if (isStoreView) {
      // ในโหมดร้านค้า กรองตาม store_id โดยไม่จำกัด owner (เห็นลูกค้าทุกคนที่สั่งซื้อเข้าร้านนี้)
      countRequest.input('store_id', sql.UniqueIdentifier, storeId);
      dataRequest.input('store_id', sql.UniqueIdentifier, storeId);
      whereConditions.push('o.store_id = @store_id');
    } else {
      // 4.1 กำหนด Owner เงื่อนไขสำหรับโหมดติดตามสถานะส่วนตัว
      allowedOwners.forEach((own, idx) => {
        const pName = `owner_${idx}`;
        countRequest.input(pName, sql.NVarChar, own);
        dataRequest.input(pName, sql.NVarChar, own);
        ownerParams.push(`@${pName}`);
      });
      if (ownerParams.length > 0) {
        whereConditions.push(`o.owner IN (${ownerParams.join(', ')})`);
      }

      if (storeId) {
        countRequest.input('store_id', sql.UniqueIdentifier, storeId);
        dataRequest.input('store_id', sql.UniqueIdentifier, storeId);
        whereConditions.push(`o.store_id = @store_id`);
      }
    }

    // 4.2 กรองตามสถานะคำสั่งซื้อ (status)
    if (statusParam && statusParam !== 'ALL') {
      const statusList = statusParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (statusList.length > 0) {
        const statusParams = [];
        statusList.forEach((st, idx) => {
          const pName = `status_${idx}`;
          dataRequest.input(pName, sql.NVarChar, st);
          statusParams.push(`@${pName}`);
        });
        whereConditions.push(`o.status IN (${statusParams.join(', ')})`);
      }
    }

    // 4.4 กรองตามประเภทการเบิก (reserve_flag: 'Y' = สั่งจองล่วงหน้า, 'N' = เบิกปกติ)
    if (reserveFlag) {
      countRequest.input('reserve_flag', sql.NVarChar, reserveFlag);
      dataRequest.input('reserve_flag', sql.NVarChar, reserveFlag);
      whereConditions.push(`o.reserve_flag = @reserve_flag`);
    }

    // 4.5 กรองตามคำค้นหา (ค้นหาตามหมายเลขคำสั่งซื้อ, หมายเหตุ, หรือชื่อสินค้า)
    if (search) {
      const keywords = search.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean);
      keywords.forEach((kw, idx) => {
        const pName = `kw_${idx}`;
        const searchPattern = `%${kw}%`;
        countRequest.input(pName, sql.NVarChar, searchPattern);
        dataRequest.input(pName, sql.NVarChar, searchPattern);

        whereConditions.push(`(
          o.order_no LIKE @${pName}
          OR o.remark LIKE @${pName}
          OR o.order_id IN (
            SELECT DISTINCT order_id FROM v_orders WHERE product_name LIKE @${pName}
          )
        )`);
      });
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 5]: คำนวณยอดนับแท็บทั้ง 7 แท็บ (Tab Counts)
    // ─────────────────────────────────────────────────────────────
    // นับยอดรวมตามขอบเขต (ไม่นำ statusParam มาตัดออก เพื่อให้ตัวเลขในทุกแท็บแสดงครบเสมอ)
    const countWhereConditions = [];
    if (isStoreView) {
      countWhereConditions.push('o.store_id = @store_id');
    } else {
      if (ownerParams.length > 0) {
        countWhereConditions.push(`o.owner IN (${ownerParams.join(', ')})`);
      }
      if (storeId) countWhereConditions.push('o.store_id = @store_id');
    }
    if (reserveFlag) countWhereConditions.push('o.reserve_flag = @reserve_flag');

    const countWhereSql = countWhereConditions.length > 0 ? `WHERE ${countWhereConditions.join(' AND ')}` : '';

    const tabCountQuery = `
      SELECT
        COUNT(*) AS total_all,
        SUM(CASE WHEN o.status IN ('W', 'P') THEN 1 ELSE 0 END) AS total_pending,
        SUM(CASE WHEN o.status = 'X' THEN 1 ELSE 0 END) AS total_preparing,
        SUM(CASE WHEN o.status = 'S' THEN 1 ELSE 0 END) AS total_awaiting,
        SUM(CASE WHEN o.status = 'D' THEN 1 ELSE 0 END) AS total_completed,
        SUM(CASE WHEN o.status = 'R' THEN 1 ELSE 0 END) AS total_rejected,
        SUM(CASE WHEN o.status = 'C' THEN 1 ELSE 0 END) AS total_cancelled
      FROM orders o
      ${countWhereSql}
    `;

    const tabCountResult = await countRequest.query(tabCountQuery);
    const countRow = tabCountResult.recordset[0] || {};

    const tabCountsResult = {
      ALL: Number(countRow.total_all || 0),
      PENDING: Number(countRow.total_pending || 0),
      PREPARING: Number(countRow.total_preparing || 0),
      AWAITING_RECEIPT: Number(countRow.total_awaiting || 0),
      COMPLETED: Number(countRow.total_completed || 0),
      REJECTED: Number(countRow.total_rejected || 0),
      CANCELLED: Number(countRow.total_cancelled || 0),
    };

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 6]: กำหนดการจัดเรียงลำดับ (Sorting Clause)
    // ─────────────────────────────────────────────────────────────
    let orderBySql = 'ORDER BY o.order_date DESC';

    if (sortBy === 'order_no') {
      orderBySql = `ORDER BY o.order_no ${sortOrder}, o.order_date DESC`;
    } else if (sortBy === 'reserve_flag') {
      orderBySql = `ORDER BY o.reserve_flag ${sortOrder}, o.order_date DESC`;
    } else if (sortBy === 'status') {
      // จัดลำดับสถานะตาม Workflow:
      // 1: W/P (รออนุมัติ) -> 2: X (เตรียมสินค้า) -> 3: S (รอยืนยันรับ) -> 4: D (เสร็จสิ้น) -> 5: R (ปฏิเสธ) -> 6: C (ยกเลิก)
      orderBySql = `
        ORDER BY 
          CASE o.status
            WHEN 'W' THEN 1
            WHEN 'P' THEN 1
            WHEN 'X' THEN 2
            WHEN 'S' THEN 3
            WHEN 'D' THEN 4
            WHEN 'R' THEN 5
            WHEN 'C' THEN 6
            ELSE 99
          END ${sortOrder},
          o.order_date DESC
      `;
    } else if (sortBy === 'total_price') {
      // เรียงลำดับตามยอดเงินรวมของคำสั่งซื้อ
      orderBySql = `
        ORDER BY (
          SELECT ISNULL(SUM(it.quantity * it.price), 0)
          FROM items it
          WHERE it.order_id = o.order_id
        ) ${sortOrder}, o.order_date DESC
      `;
    } else {
      orderBySql = `ORDER BY o.order_date ${sortOrder}`;
    }

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 7]: ยิง Query ดึงข้อมูลหลักแบบ Pagination
    // ─────────────────────────────────────────────────────────────
    dataRequest.input('skip', sql.Int, skip);
    dataRequest.input('limit', sql.Int, limit);

    const paginatedOrdersQuery = `
      SELECT 
        o.order_id,
        o.order_no,
        o.order_date,
        o.store_id,
        o.owner,
        o.shipping_location,
        o.reserve_flag,
        o.status,
        o.update_by,
        o.update_date,
        o.remark,
        COUNT(*) OVER() AS full_count
      FROM orders o
      ${whereSql}
      ${orderBySql}
      OFFSET @skip ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const ordersResult = await dataRequest.query(paginatedOrdersQuery);
    const paginatedOrderHeaders = ordersResult.recordset || [];
    const totalCount = paginatedOrderHeaders.length > 0 ? Number(paginatedOrderHeaders[0].full_count) : 0;

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 8]: ดึงรายละเอียดสินค้าจาก View v_orders และ order_approvals
    // ─────────────────────────────────────────────────────────────
    const targetOrderIds = paginatedOrderHeaders.map((o) => o.order_id);
    let lineItems = [];
    const approverMap = {};
    const appInfoMap = {};
    const userFullnameMap = {};
    const txSummaryMap = {};
    const txProductFallbackMap = {};

    if (targetOrderIds.length > 0) {
      // สร้าง SQL Parameter List สำหรับ Order IDs
      const itemRequest = pool.request();
      const orderIdParams = [];

      targetOrderIds.forEach((id, idx) => {
        const pName = `ord_id_${idx}`;
        itemRequest.input(pName, sql.UniqueIdentifier, id);
        orderIdParams.push(`@${pName}`);
      });

      const approvalRequest = pool.request();
      targetOrderIds.forEach((id, idx) => {
        approvalRequest.input(`ord_id_${idx}`, sql.UniqueIdentifier, id);
      });

      const txRequest = pool.request();
      const txOrderParams = [];
      targetOrderIds.forEach((id, idx) => {
        const pName = `tx_ord_${idx}`;
        txRequest.input(pName, sql.NVarChar, String(id));
        txOrderParams.push(`@${pName}`);
      });

      const [itemsResult, approvalsResult, txResult] = await Promise.all([
        itemRequest.query(`
          SELECT 
            vo.order_id,
            vo.order_no,
            vo.order_date,
            vo.reserve_flag,
            vo.store_id,
            vo.store_name,
            vo.owner,
            vo.firstname,
            vo.firstname_th,
            vo.lastname,
            vo.lastname_th,
            vo.department,
            vo.department_th,
            vo.shipping_location_id,
            vo.shipping_location,
            vo.status,
            vo.item_id,
            vo.product_id,
            vo.product_name,
            vo.product_desc,
            vo.product_thumbnail,
            vo.quantity_order,
            vo.quantity,
            vo.price,
            vo.unit_id,
            vo.uom,
            vo.update_date,
            vo.quantity_sent,
            vo.item_remark,
            ISNULL(inv.quantity, 0) AS stock_quantity,
            p.order_limit,
            p.batch_size,
            loc.location_name AS location_name
          FROM v_orders vo
          LEFT JOIN v_inventory inv ON vo.product_id = inv.product_id
          LEFT JOIN products p ON vo.product_id = p.product_id
          LEFT JOIN locations loc ON p.location_id = loc.location_id
          WHERE vo.order_id IN (${orderIdParams.join(', ')})
          ORDER BY vo.order_date DESC, vo.product_name ASC, vo.price ASC
        `),
        approvalRequest.query(`
          SELECT order_id, approvers, response_by, response_date
          FROM order_approvals
          WHERE order_id IN (${orderIdParams.join(', ')})
        `),
        txRequest.query(`
          SELECT 
            it.order_id,
            it.product_id,
            it.price,
            it.operation,
            SUM(it.quantity) AS total_qty
          FROM inventory_transaction it
          WHERE it.order_id IN (${txOrderParams.join(', ')})
            AND it.operation IN ('return', 'deposit-waste', 'deposit-lost')
          GROUP BY it.order_id, it.product_id, it.price, it.operation
        `),
      ]);

      lineItems = itemsResult.recordset || [];

      // จัดทำ Map สรุปยอดคืนคลัง (return), ชำรุด (deposit-waste), และ สูญหาย (deposit-lost)
      (txResult.recordset || []).forEach((tx) => {
        const oId = String(tx.order_id).toLowerCase();
        const pId = String(tx.product_id).toLowerCase();
        const price = Number(tx.price || 0);
        const key = `${oId}_${pId}_${price}`;
        const prodKey = `${oId}_${pId}`;

        if (!txSummaryMap[key]) {
          txSummaryMap[key] = { return_qty: 0, waste_qty: 0, lost_qty: 0 };
        }
        if (!txProductFallbackMap[prodKey]) {
          txProductFallbackMap[prodKey] = { return_qty: 0, waste_qty: 0, lost_qty: 0 };
        }

        const qty = Number(tx.total_qty || 0);
        if (tx.operation === 'return') {
          txSummaryMap[key].return_qty += qty;
          txProductFallbackMap[prodKey].return_qty += qty;
        } else if (tx.operation === 'deposit-waste') {
          txSummaryMap[key].waste_qty += qty;
          txProductFallbackMap[prodKey].waste_qty += qty;
        } else if (tx.operation === 'deposit-lost') {
          txSummaryMap[key].lost_qty += qty;
          txProductFallbackMap[prodKey].lost_qty += qty;
        }
      });

      (approvalsResult.recordset || []).forEach((app) => {
        const idStr = String(app.order_id);
        appInfoMap[idStr] = app;
        appInfoMap[idStr.toUpperCase()] = app;
        appInfoMap[idStr.toLowerCase()] = app;
        if (app.approvers) {
          approverMap[app.order_id] = app.approvers
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean);
        }
      });

      // ดึงรายชื่อผู้ดำเนินการเพื่อค้นหาชื่อ-นามสกุลภาษาไทยจาก _accounts
      const responseUsernames = Array.from(
        new Set(
          paginatedOrderHeaders
            .map((ord) => {
              const idStr = String(ord.order_id);
              const app = appInfoMap[idStr] || appInfoMap[idStr.toUpperCase()] || appInfoMap[idStr.toLowerCase()];
              return (app?.response_by || ord.update_by || '').trim();
            })
            .filter(Boolean)
        )
      );

      if (responseUsernames.length > 0) {
        try {
          const userRequest = pool.request();
          const uParams = [];
          responseUsernames.forEach((u, idx) => {
            const pName = `resp_user_${idx}`;
            userRequest.input(pName, sql.NVarChar, u);
            uParams.push(`@${pName}`);
          });

          const userResult = await userRequest.query(`
            SELECT username, firstname_th, lastname_th, firstname, lastname
            FROM _accounts
            WHERE username IN (${uParams.join(', ')})
          `);

          (userResult.recordset || []).forEach((acc) => {
            const th = `${acc.firstname_th || ''} ${acc.lastname_th || ''}`.trim();
            const en = `${acc.firstname || ''} ${acc.lastname || ''}`.trim();
            const name = th || en || acc.username;
            userFullnameMap[acc.username] = name;
            userFullnameMap[acc.username.toUpperCase()] = name;
            userFullnameMap[acc.username.toLowerCase()] = name;
          });
        } catch (uErr) {
          console.warn('Cannot fetch user names for response_by:', uErr);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 9]: รวมกลุ่มข้อมูล Order พร้อมรายการสินค้า (Data Grouping)
    // ─────────────────────────────────────────────────────────────
    const orderMap = {};

    // 9.1 สร้าง Order Header ตามลำดับที่ได้จากตาราง orders
    for (const ord of paginatedOrderHeaders) {
      const idStr = String(ord.order_id);
      const appInfo = appInfoMap[idStr] || appInfoMap[idStr.toUpperCase()] || appInfoMap[idStr.toLowerCase()] || null;
      const respBy = (appInfo?.response_by || ord.update_by || '').trim() || null;
      const respDate = appInfo?.response_date || ord.update_date || null;
      const respByName = respBy ? (userFullnameMap[respBy] || userFullnameMap[respBy.toUpperCase()] || userFullnameMap[respBy.toLowerCase()] || null) : null;

      orderMap[ord.order_id] = {
        order_id: ord.order_id,
        order_no: ord.order_no,
        order_date: ord.order_date || new Date(),
        store_id: ord.store_id,
        store_name: 'ร้านค้าส่วนกลาง',
        owner: ord.owner,
        fullname: '',
        fullname_th: '',
        department: '',
        department_th: '',
        shipping_location_id: ord.shipping_location,
        shipping_location: 'ไม่ระบุสถานที่',
        reserve_flag: ord.reserve_flag || 'N',
        status: ord.status || 'W',
        remark: ord.remark || null,
        response_by: respBy,
        response_by_name: respByName,
        response_date: respDate,
        update_date: ord.update_date,
        approvers: approverMap[ord.order_id] || [],
        total_items: 0,
        total_quantity: 0,
        total_price: 0,
        original_total_price: 0,
        items: [],
      };
    }

    // 9.2 เติมข้อมูลสินค้าย่อยและข้อมูลผู้ใช้จาก View v_orders
    for (const item of lineItems) {
      const order = orderMap[item.order_id];
      if (!order) continue;

      if (item.store_name) order.store_name = item.store_name;
      if (item.firstname || item.lastname) {
        order.fullname = `${item.firstname || ''} ${item.lastname || ''}`.trim();
      }
      if (item.firstname_th || item.lastname_th) {
        order.fullname_th = `${item.firstname_th || ''} ${item.lastname_th || ''}`.trim();
      }
      if (item.department) order.department = item.department;
      if (item.department_th) order.department_th = item.department_th;
      if (item.shipping_location) order.shipping_location = item.shipping_location;

      if (item.item_id || item.product_id) {
        const qtyOrder = Number(item.quantity_order ?? item.quantity ?? 1);
        const qty = Number(item.quantity ?? 1);
        const qtySent = item.quantity_sent != null ? Number(item.quantity_sent) : null;
        const price = Number(item.price ?? 0);
        const locName = item.location_name || '-';

        // ยอดสินค้าที่ใช้งานจริง: ถ้ามีการจัดเตรียมแล้ว (qtySent != null) ให้ใช้ qtySent
        const activeQty = qtySent != null ? qtySent : qty;
        const itemTotal = Number((activeQty * price).toFixed(2));
        const originalItemTotal = Number((qtyOrder * price).toFixed(2));

        const oId = String(item.order_id).toLowerCase();
        const pId = String(item.product_id).toLowerCase();
        const itemPrice = Number(item.price ?? 0);
        const itemKey = `${oId}_${pId}_${itemPrice}`;
        const prodKey = `${oId}_${pId}`;

        let returnQty = 0;
        let wasteQty = 0;
        let lostQty = 0;

        if (txSummaryMap[itemKey]) {
          returnQty = txSummaryMap[itemKey].return_qty;
          wasteQty = txSummaryMap[itemKey].waste_qty;
          lostQty = txSummaryMap[itemKey].lost_qty;
        } else if (txProductFallbackMap[prodKey]) {
          const sameProductItems = lineItems.filter(
            (li) => String(li.order_id).toLowerCase() === oId && String(li.product_id).toLowerCase() === pId
          );
          if (sameProductItems.length <= 1) {
            returnQty = txProductFallbackMap[prodKey].return_qty;
            wasteQty = txProductFallbackMap[prodKey].waste_qty;
            lostQty = txProductFallbackMap[prodKey].lost_qty;
          }
        }

        const existingItem = order.items.find((it) => {
          const sameProduct = it.product_id && item.product_id
            ? String(it.product_id).toLowerCase() === String(item.product_id).toLowerCase()
            : it.product_name === item.product_name;
          return sameProduct && Math.abs(Number(it.price) - price) < 0.0001;
        });

        if (existingItem) {
          existingItem.quantity_order += qtyOrder;
          existingItem.quantity += qty;
          if (qtySent != null) {
            existingItem.quantity_sent = (existingItem.quantity_sent != null ? existingItem.quantity_sent : 0) + qtySent;
          }
          existingItem.quantity_return = Math.max(existingItem.quantity_return || 0, returnQty);
          existingItem.quantity_waste = Math.max(existingItem.quantity_waste || 0, wasteQty);
          existingItem.quantity_lost = Math.max(existingItem.quantity_lost || 0, lostQty);
          existingItem.item_total = Number((existingItem.item_total + itemTotal).toFixed(2));
          existingItem.original_item_total = Number((existingItem.original_item_total + originalItemTotal).toFixed(2));

          if (item.item_remark && item.item_remark !== existingItem.remark) {
            existingItem.remark = existingItem.remark
              ? `${existingItem.remark}, ${item.item_remark}`
              : item.item_remark;
          }
          if ((!existingItem.location_name || existingItem.location_name === '-') && locName !== '-') {
            existingItem.location_name = locName;
          }
        } else {
          order.items.push({
            item_id: item.item_id || item.product_id || '',
            product_id: item.product_id || '',
            product_name: item.product_name || 'ไม่มีชื่อสินค้า',
            product_desc: item.product_desc || null,
            product_thumbnail: item.product_thumbnail || null,
            quantity_order: qtyOrder,
            quantity: qty,
            quantity_sent: qtySent,
            quantity_return: returnQty,
            quantity_waste: wasteQty,
            quantity_lost: lostQty,
            remark: item.item_remark || null,
            price: price,
            unit_id: item.unit_id || null,
            uom: item.uom || 'ชิ้น',
            location_name: locName,
            item_total: itemTotal,
            original_item_total: originalItemTotal,
            stock_quantity: Number(item.stock_quantity ?? 0),
            order_limit: item.order_limit != null ? Number(item.order_limit) : null,
            batch_size: Number(item.batch_size ?? 1),
          });

          order.total_items += 1;
        }

        order.total_quantity += activeQty;
        order.total_price = Number((order.total_price + itemTotal).toFixed(2));
        order.original_total_price = Number(((order.original_total_price || 0) + originalItemTotal).toFixed(2));
      }
    }

    const orderList = Object.values(orderMap);

    // ─────────────────────────────────────────────────────────────
    // 🟢 [ขั้นตอนที่ 10]: ส่งผลลัพธ์ Server-Side Pagination กลับไปยัง Client
    // ─────────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        data: orderList,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
        counts: tabCountsResult,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ';
    console.error('💥 [Fatal Error in GET /api/orders]:', error);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
