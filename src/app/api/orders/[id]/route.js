// src/app/api/orders/[id]/route.js

/**
 * =========================================================================
 * API Route: /api/orders/[id]
 * =========================================================================
 * หน้าที่:
 * 1. GET /api/orders/[id]: ดึงข้อมูลรายละเอียดคำสั่งซื้อรายฉบับ (ค้นหาได้ทั้ง order_id และ order_no)
 * =========================================================================
 */

import { NextResponse } from 'next/server';
import { getDbPool, sql } from '@/lib/db';
import { verifyApiAuth } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// 1. GET /api/orders/[id]
// ─────────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const authResult = await verifyApiAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return authResult.response;
    }

    const currentUser = authResult.user;
    const resolvedParams = await params;
    const cleanId = resolvedParams?.id?.trim();

    if (!cleanId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสคำสั่งซื้อ (order_id หรือ order_no)' },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    // 1. ค้นหาแถวข้อมูลจาก View v_orders
    const orderReq = pool.request();
    orderReq.input('searchId', sql.NVarChar, cleanId);

    const orderRowsResult = await orderReq.query(`
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
      WHERE CAST(vo.order_id AS NVARCHAR(50)) = @searchId OR vo.order_no = @searchId
      ORDER BY vo.order_date DESC, vo.product_name ASC, vo.price ASC
    `);

    const orderRows = orderRowsResult.recordset || [];

    if (orderRows.length === 0) {
      return NextResponse.json(
        { success: false, error: `ไม่พบข้อมูลคำสั่งซื้อ "${cleanId}" ในระบบ` },
        { status: 404 }
      );
    }

    const firstRow = orderRows[0];

    // 2. ตรวจสอบสิทธิ์การเข้าถึง (Owner / Approver / Store Owner)
    const isOwner = (firstRow.owner || '').toUpperCase() === currentUser.username.toUpperCase();
    const isStoreOwner = firstRow.store_id && currentUser.ownedStoreIds ? currentUser.ownedStoreIds.includes(firstRow.store_id) : false;
    const isDeptApprover = currentUser.isApprover;

    if (!isOwner && !isStoreOwner && !isDeptApprover) {
      return NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลคำสั่งซื้อฉบับนี้' },
        { status: 403 }
      );
    }

    // 3. ดึงรายชื่อผู้อนุมัติจากตาราง order_approvals
    const approvalReq = pool.request();
    approvalReq.input('orderId', sql.UniqueIdentifier, firstRow.order_id);
    const approvalRecord = await approvalReq.query(`
      SELECT TOP 1 approvers, status, response_date, response_by
      FROM order_approvals
      WHERE order_id = @orderId
    `);

    const approverRow = approvalRecord.recordset[0];
    const approvers = approverRow?.approvers
      ? approverRow.approvers.split(',').map((u) => u.trim()).filter(Boolean)
      : [];

    // 3.0 ดึงข้อมูล update_by, update_date, remark เพิ่มเติมจากตาราง orders
    const ordReq = pool.request();
    ordReq.input('orderId', sql.UniqueIdentifier, firstRow.order_id);
    const ordRecord = await ordReq.query(`
      SELECT TOP 1 update_by, update_date, remark, status
      FROM orders
      WHERE order_id = @orderId
    `);
    const ordHeader = ordRecord.recordset[0] || {};

    // 3.0.1 ดึงชื่อ-นามสกุลภาษาไทยของผู้เกี่ยวข้อง (ผู้อนุมัติ และ ผู้จัดเตรียม) จาก _accounts
    const userFullnameMap = {};
    const usersToFetch = Array.from(
      new Set(
        [approverRow?.response_by, ordHeader?.update_by]
          .map((u) => (u || '').trim())
          .filter(Boolean)
      )
    );

    if (usersToFetch.length > 0) {
      try {
        const uReq = pool.request();
        const uParams = [];
        usersToFetch.forEach((u, idx) => {
          const pName = `u_${idx}`;
          uReq.input(pName, sql.NVarChar, u);
          uParams.push(`@${pName}`);
        });
        const uRes = await uReq.query(`
          SELECT username, firstname_th, lastname_th, firstname, lastname
          FROM _accounts
          WHERE username IN (${uParams.join(', ')})
        `);
        (uRes.recordset || []).forEach((acc) => {
          const th = `${acc.firstname_th || ''} ${acc.lastname_th || ''}`.trim();
          const en = `${acc.firstname || ''} ${acc.lastname || ''}`.trim();
          const name = th || en || acc.username;
          userFullnameMap[acc.username] = name;
          userFullnameMap[acc.username.toUpperCase()] = name;
          userFullnameMap[acc.username.toLowerCase()] = name;
        });
      } catch (uErr) {
        console.warn('Cannot fetch user names in /api/orders/[id]:', uErr);
      }
    }

    // 3.1 ดึงรายการคืนสต็อกและของเสียจาก inventory_transaction
    const txReq = pool.request();
    txReq.input('orderId', sql.NVarChar, String(firstRow.order_id));
    const txRes = await txReq.query(`
      SELECT 
        it.order_id,
        it.product_id,
        it.price,
        it.operation,
        SUM(it.quantity) AS total_qty
      FROM inventory_transaction it
      WHERE it.order_id = @orderId
        AND it.operation IN ('return', 'deposit-waste', 'deposit-lost')
      GROUP BY it.order_id, it.product_id, it.price, it.operation
    `);

    const txSummaryMap = {};
    const txProductFallbackMap = {};

    (txRes.recordset || []).forEach((tx) => {
      const pId = String(tx.product_id).toLowerCase();
      const price = Number(tx.price || 0);
      const key = `${pId}_${price}`;
      const prodKey = pId;

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

    // 4. ประกอบข้อมูลสินค้ารายการย่อย (รวมกลุ่มสินค้าชิ้นเดียวกันที่มีราคาเท่ากัน)
    let totalItems = 0;
    let totalQuantity = 0;
    let totalPrice = 0;
    let originalTotalPrice = 0;

    const items = [];
    for (const r of orderRows) {
      if (!r.product_id) continue;
      const qtyOrder = Number(r.quantity_order ?? r.quantity ?? 1);
      const qty = Number(r.quantity ?? 1);
      const qtySent = r.quantity_sent != null ? Number(r.quantity_sent) : null;
      const unitPrice = Number(r.price ?? 0);

      const activeQty = qtySent != null ? qtySent : qty;
      const itemTotal = Number((activeQty * unitPrice).toFixed(2));
      const originalItemTotal = Number((qtyOrder * unitPrice).toFixed(2));

      const pId = String(r.product_id).toLowerCase();
      const itemKey = `${pId}_${unitPrice}`;
      const prodKey = pId;

      let returnQty = 0;
      let wasteQty = 0;
      let lostQty = 0;

      if (txSummaryMap[itemKey]) {
        returnQty = txSummaryMap[itemKey].return_qty;
        wasteQty = txSummaryMap[itemKey].waste_qty;
        lostQty = txSummaryMap[itemKey].lost_qty;
      } else if (txProductFallbackMap[prodKey]) {
        const sameProductItems = orderRows.filter(
          (li) => String(li.product_id).toLowerCase() === pId
        );
        if (sameProductItems.length <= 1) {
          returnQty = txProductFallbackMap[prodKey].return_qty;
          wasteQty = txProductFallbackMap[prodKey].waste_qty;
          lostQty = txProductFallbackMap[prodKey].lost_qty;
        }
      }

      const existingItem = items.find((it) => {
        const sameProduct = it.product_id && r.product_id
          ? String(it.product_id).toLowerCase() === String(r.product_id).toLowerCase()
          : it.product_name === r.product_name;
        return sameProduct && Math.abs(Number(it.price) - unitPrice) < 0.0001;
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

        if (r.item_remark && r.item_remark !== existingItem.remark) {
          existingItem.remark = existingItem.remark
            ? `${existingItem.remark}, ${r.item_remark}`
            : r.item_remark;
        }
        if ((!existingItem.location_name || existingItem.location_name === '-') && r.location_name && r.location_name !== '-') {
          existingItem.location_name = r.location_name;
        }
      } else {
        items.push({
          item_id: r.item_id,
          product_id: r.product_id || '',
          product_name: r.product_name || '-',
          product_desc: r.product_desc || null,
          product_thumbnail: r.product_thumbnail || null,
          quantity_order: qtyOrder,
          quantity: qty,
          quantity_sent: qtySent,
          quantity_return: returnQty,
          quantity_waste: wasteQty,
          quantity_lost: lostQty,
          remark: r.item_remark || null,
          price: unitPrice,
          unit_id: r.unit_id || null,
          uom: r.uom || 'ชิ้น',
          location_name: r.location_name || '-',
          item_total: itemTotal,
          original_item_total: originalItemTotal,
          stock_quantity: Number(r.stock_quantity ?? 0),
          order_limit: r.order_limit != null ? Number(r.order_limit) : null,
          batch_size: Number(r.batch_size ?? 1),
        });
      }

      totalQuantity += activeQty;
      totalPrice += itemTotal;
      originalTotalPrice += originalItemTotal;
    }

    totalItems = items.length;

    const currentStatus = (firstRow.status || 'W').toUpperCase();
    const isApprovedOrder = (approverRow?.status || '').toUpperCase() === 'A' || ['X', 'S', 'D'].includes(currentStatus);
    const approvedBy = isApprovedOrder ? (approverRow?.response_by || '').trim() || null : null;
    const approvedByName = approvedBy
      ? (userFullnameMap[approvedBy] || userFullnameMap[approvedBy.toUpperCase()] || userFullnameMap[approvedBy.toLowerCase()] || approvedBy)
      : null;
    const approvedDate = isApprovedOrder ? (approverRow?.response_date || null) : null;

    const isPreparedOrder = ['S', 'D'].includes(currentStatus);
    const preparedBy = isPreparedOrder ? (ordHeader?.update_by || '').trim() || null : null;
    const preparedByName = preparedBy
      ? (userFullnameMap[preparedBy] || userFullnameMap[preparedBy.toUpperCase()] || userFullnameMap[preparedBy.toLowerCase()] || preparedBy)
      : null;
    const preparedDate = isPreparedOrder ? (ordHeader?.update_date || null) : null;

    const data = {
      order_id: firstRow.order_id,
      order_no: firstRow.order_no,
      order_date: firstRow.order_date,
      store_id: firstRow.store_id,
      store_name: firstRow.store_name || '-',
      owner: firstRow.owner,
      fullname: `${firstRow.firstname || ''} ${firstRow.lastname || ''}`.trim() || firstRow.owner,
      fullname_th: `${firstRow.firstname_th || ''} ${firstRow.lastname_th || ''}`.trim() || firstRow.owner,
      department: firstRow.department || '-',
      department_th: firstRow.department_th || firstRow.department || '-',
      shipping_location_id: firstRow.shipping_location_id,
      shipping_location: firstRow.shipping_location || '-',
      reserve_flag: firstRow.reserve_flag || 'N',
      status: firstRow.status || 'W',
      remark: ordHeader?.remark || null,
      approved_by: approvedBy,
      approved_by_name: approvedByName,
      approved_date: approvedDate,
      prepared_by: preparedBy,
      prepared_by_name: preparedByName,
      response_by: ['C', 'R'].includes(currentStatus)
        ? (ordHeader?.update_by || approverRow?.response_by || null)
        : (approverRow?.response_by || ordHeader?.update_by || null),
      response_by_name: ['C', 'R'].includes(currentStatus)
        ? (userFullnameMap[ordHeader?.update_by] || userFullnameMap[approverRow?.response_by] || ordHeader?.update_by || null)
        : (approvedByName || preparedByName || null),
      response_date: ['C', 'R'].includes(currentStatus)
        ? (ordHeader?.update_date || approverRow?.response_date || null)
        : (approverRow?.response_date || ordHeader?.update_date || null),
      update_date: ordHeader?.update_date || firstRow.update_date,
      approvers,
      total_items: totalItems,
      total_quantity: totalQuantity,
      total_price: Number(totalPrice.toFixed(2)),
      original_total_price: Number(originalTotalPrice.toFixed(2)),
      items,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ';
    console.error('Error in GET /api/orders/[id]:', error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

