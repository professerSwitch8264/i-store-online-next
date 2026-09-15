// src/app/store-management/products/page.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { useStoreManagementStore } from '@/app/stores/useStoreManagementStore';
import { useToastStore } from '@/app/stores/useToastStore';
import { productService } from '@/app/services/productService';
import { categoryService } from '@/app/services/categoryService';
import { locationService } from '@/app/services/locationService';
import { unitService } from '@/app/services/unitService';
import { getThumbnailUrl } from '@/lib/utils';
import TablePagination from '@/app/components/ui/TablePagination';
import OutlinedField from '@/app/components/ui/OutlinedField';
import ProductThumbnail from '@/app/components/ui/ProductThumbnail';
import {
  RiBox3Line,
  RiStore2Line,
  RiArrowLeftLine,
  RiLoader4Line,
  RiCloseLine,
  RiRefreshLine,
  RiImageLine,
  RiImageAddLine,
  RiPlayListAddLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiAddLine,
  RiGridLine,
  RiFileTextLine,
  RiArchiveDrawerLine,
  RiChat1Line,
  RiCheckLine,
  RiDeleteBin7Line,
} from 'react-icons/ri';

export default function StoreProductsPage() {
  const { userInfo } = useAuth();
  const token = userInfo?.securityToken;
  const currentStore = useStoreManagementStore((state) => state.currentStore);
  const showError = useToastStore((state) => state.showError);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showConfirm = useToastStore((state) => state.showConfirm);

  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dropdown Master Data Lists
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);

  // Add / Edit Product Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState('create'); // 'create' | 'edit'
  const [productForm, setProductForm] = useState({
    product_id: null,
    product_name: '',
    product_desc: '',
    company_code: '',
    category_id: '',
    location_id: '',
    unit_id: '',
    product_price: 0,
    batch_size: 1,
    order_limit: 0,
    product_thumbnail: '',
    status: 'Y',
  });
  const [productImageFile, setProductImageFile] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const fileInputRef = useRef(null);

  // ดึงชื่อหน่วยที่เลือกเพื่อแสดงเป็น suffix ในฟิลด์จำนวน
  const selectedUnitObj = units.find((u) => String(u.unit_id) === String(productForm.unit_id));
  const selectedUnitName = selectedUnitObj?.unit_name || selectedUnitObj?.unit || '';

  // Receive Stock Modal States
  const [selectedProductForReceive, setSelectedProductForReceive] = useState(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    item_type: 'normal',
    quantity: 0,
    price: '',
    remark: '',
  });
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Search States
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const storeId = currentStore?.store_id;

  // โหลด Master Data สำหรับ Dropdowns (หมวดหมู่, ตำแหน่งจัดเก็บ, หน่วยนับ)
  const loadMasterData = useCallback(async () => {
    if (!storeId) return;
    try {
      const [catRes, locRes, unitList] = await Promise.all([
        categoryService.getCategories({ store_id: storeId, limit: 200 }, token).catch(() => ({ data: [] })),
        locationService.getLocations({ store_id: storeId, limit: 200 }, token).catch(() => ({ data: [] })),
        unitService.getUnits(token).catch(() => []),
      ]);
      setCategories(catRes.data || []);
      setLocations(locRes.data || []);
      setUnits(unitList || []);
    } catch (err) {
      console.warn('Failed to load dropdown master data:', err);
    }
  }, [storeId, token]);

  // โหลดรายการสินค้าจาก Backend API
  const loadProducts = useCallback(
    async (targetPage = page, targetSearch = appliedSearch, targetLimit = rowsPerPage) => {
      if (!storeId) {
        setProducts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await productService.getProducts(
          {
            store_id: storeId,
            search: targetSearch,
            page: targetPage,
            limit: targetLimit,
            include_all: true,
          },
          token
        );
        setProducts(res.data || []);
        setTotalCount(res.pagination?.total ?? (res.data || []).length);
      } catch (err) {
        console.error('Failed to load products:', err);
        showError(err.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้');
      } finally {
        setLoading(false);
      }
    },
    [storeId, token, showError, page, appliedSearch, rowsPerPage]
  );

  useEffect(() => {
    if (storeId) {
      loadProducts(1, '', rowsPerPage);
      loadMasterData();
    }
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────
  // การจัดการ Modal เพิ่ม/แก้ไขสินค้า (Product Modal)
  // ─────────────────────────────────────────────────────────────
  const handleOpenCreateModal = () => {
    setProductForm({
      product_id: null,
      product_name: '',
      product_desc: '',
      company_code: '',
      category_id: '',
      location_id: '',
      unit_id: '',
      product_price: 0,
      batch_size: 1,
      order_limit: 0,
      product_thumbnail: '',
      status: 'Y',
    });
    setProductImageFile(null);
    setProductImagePreview(null);
    setProductModalMode('create');
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setProductForm({
      product_id: product.product_id,
      product_name: product.product_name || '',
      product_desc: product.product_desc || '',
      company_code: product.company_code || '',
      category_id: product.category_id || '',
      location_id: product.location_id || '',
      unit_id: product.unit_id || '',
      product_price: product.product_price !== undefined && product.product_price !== null ? product.product_price : 0,
      batch_size: product.batch_size !== undefined && product.batch_size !== null ? product.batch_size : 1,
      order_limit: product.order_limit !== undefined && product.order_limit !== null ? product.order_limit : 0,
      product_thumbnail: product.product_thumbnail || '',
      status: product.status || 'Y',
    });
    setProductImageFile(null);
    setProductImagePreview(product.product_thumbnail ? getThumbnailUrl(product.product_thumbnail) : null);
    setProductModalMode('edit');
    setIsProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    if (isSubmittingProduct) return;
    setIsProductModalOpen(false);
    setProductImageFile(null);
    setProductImagePreview(null);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    setProductImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setProductImagePreview(objectUrl);
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setProductImageFile(null);
    setProductImagePreview(null);
    setProductForm((prev) => ({ ...prev, product_thumbnail: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ตรวจสอบความถูกต้องของฟอร์ม (ต้องกรอกฟิลด์ * ครบทั้งหมด)
  const isProductFormValid =
    Boolean(productForm.product_name?.trim()) &&
    Boolean(productForm.category_id) &&
    Boolean(productForm.product_desc?.trim()) &&
    Boolean(productForm.location_id) &&
    Boolean(productForm.company_code?.trim()) &&
    Boolean(productForm.unit_id) &&
    productForm.product_price !== '' &&
    productForm.product_price !== null &&
    !isNaN(parseFloat(productForm.product_price)) &&
    parseFloat(productForm.product_price) >= 0 &&
    productForm.batch_size !== '' &&
    productForm.batch_size !== null &&
    !isNaN(parseInt(productForm.batch_size, 10)) &&
    parseInt(productForm.batch_size, 10) >= 1 &&
    productForm.order_limit !== '' &&
    productForm.order_limit !== null &&
    !isNaN(parseInt(productForm.order_limit, 10)) &&
    parseInt(productForm.order_limit, 10) >= 0;

  const handleProductSubmit = async (e) => {
    e?.preventDefault();

    if (!isProductFormValid) {
      showError('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน');
      return;
    }

    const price = parseFloat(productForm.product_price);
    const batch = parseInt(productForm.batch_size, 10);
    const limit = parseInt(productForm.order_limit, 10);

    setIsSubmittingProduct(true);
    try {
      let finalThumbnail = productForm.product_thumbnail;

      // 1. ถ้ามีไฟล์รูปภาพใหม่ ให้อัปโหลดขึ้น MinIO ก่อน
      if (productImageFile) {
        const uploadRes = await productService.uploadProductThumbnail(
          productImageFile,
          storeId,
          productForm.product_id,
          token
        );
        finalThumbnail = uploadRes.product_thumbnail;
      }

      // 2. จัดเตรียม Payload
      const payload = {
        store_id: storeId,
        product_name: productForm.product_name.trim(),
        product_desc: productForm.product_desc.trim(),
        company_code: productForm.company_code.trim(),
        category_id: productForm.category_id || null,
        location_id: productForm.location_id || null,
        unit_id: productForm.unit_id || null,
        product_price: price,
        batch_size: batch,
        order_limit: limit,
        product_thumbnail: finalThumbnail || null,
        status: productForm.status || 'Y',
      };

      if (productModalMode === 'create') {
        // เพิ่มสินค้าใหม่
        const res = await productService.createProduct(payload, token);
        showSuccess(res.message || 'เพิ่มสินค้าเรียบร้อยแล้ว');
      } else {
        // แก้ไขสินค้าเดิม
        payload.product_id = productForm.product_id;
        const res = await productService.updateProduct(payload, token);
        showSuccess(res.message || 'บันทึกข้อมูลสินค้าเรียบร้อยแล้ว');
      }

      handleCloseProductModal();
      loadProducts(productModalMode === 'create' ? 1 : page, appliedSearch, rowsPerPage);
    } catch (err) {
      console.error('Failed to submit product:', err);
      showError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // การจัดการ Modal รับสินค้าเข้า (Receive Modal)
  // ─────────────────────────────────────────────────────────────
  const handleOpenReceiveModal = (product) => {
    setSelectedProductForReceive(product);
    setReceiveForm({
      item_type: 'normal',
      quantity: 0,
      price: product.product_price !== undefined && product.product_price !== null ? product.product_price : '',
      remark: '',
    });
    setIsReceiveModalOpen(true);
  };

  const handleCloseReceiveModal = () => {
    if (isSubmittingReceive) return;
    setIsReceiveModalOpen(false);
    setSelectedProductForReceive(null);
  };

  const handleReceiveSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedProductForReceive) return;

    const qty = parseFloat(receiveForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      showError('กรุณาระบุจำนวนสินค้าที่ถูกต้องและมากกว่า 0');
      return;
    }

    setIsSubmittingReceive(true);
    try {
      const payload = {
        product_id: selectedProductForReceive.product_id,
        item_type: receiveForm.item_type,
        quantity: qty,
        price: receiveForm.price !== '' ? parseFloat(receiveForm.price) : selectedProductForReceive.product_price,
        remark: receiveForm.remark.trim(),
      };

      const res = await productService.receiveStock(payload, token);
      showSuccess(res.message || 'รับสินค้าเข้าคลังเรียบร้อยแล้ว');
      handleCloseReceiveModal();
      loadProducts(page, appliedSearch, rowsPerPage);
    } catch (err) {
      console.error('Failed to receive stock:', err);
      showError(err.message || 'เกิดข้อผิดพลาดในการรับสินค้าเข้าคลัง');
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  // สลับสถานะเปิดจำหน่าย / งดจำหน่าย (Toggle Switch)
  const handleToggleStatus = async (product) => {
    const currentStatus = product.status || 'Y';
    const newStatus = currentStatus === 'Y' ? 'N' : 'Y';
    const prevProducts = [...products];

    // Optimistic Update
    setProducts((prev) =>
      prev.map((item) =>
        item.product_id === product.product_id ? { ...item, status: newStatus } : item
      )
    );
    setTogglingId(product.product_id);

    try {
      await productService.updateProductStatus(product.product_id, newStatus, token);
      showSuccess(
        newStatus === 'Y'
          ? `เปิดจำหน่ายสินค้า "${product.product_name}" แล้ว`
          : `งดจำหน่ายสินค้า "${product.product_name}" แล้ว`
      );
    } catch (err) {
      console.error('Toggle status error:', err);
      showError(err.message || 'ไม่สามารถเปลี่ยนสถานะสินค้าได้');
      // Revert on error
      setProducts(prevProducts);
    } finally {
      setTogglingId(null);
    }
  };

  // ยืนยันการลบสินค้า
  const handleOpenDeleteModal = (product) => {
    showConfirm({
      title: 'คุณต้องการลบสินค้านี้ออกหรือไม่?',
      message: `ชื่อสินค้า : ${product.product_name}\nรายละเอียดสินค้า : ${product.product_desc || '-'}`,
      confirmText: 'ยืนยัน',
      cancelText: 'ยกเลิก',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          await productService.deleteProduct(product.product_id, token);
          showSuccess(`ลบสินค้า "${product.product_name}" เรียบร้อยแล้ว`);
          const targetPage = products.length === 1 && page > 1 ? page - 1 : page;
          if (targetPage !== page) setPage(targetPage);
          loadProducts(targetPage, appliedSearch, rowsPerPage);
        } catch (err) {
          console.error('Failed to delete product:', err);
          showError(err.message || 'เกิดข้อผิดพลาดในการลบสินค้า');
        }
      },
    });
  };

  // การค้นหา
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const q = searchInput.trim();
    setAppliedSearch(q);
    setPage(1);
    loadProducts(1, q, rowsPerPage);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setPage(1);
    loadProducts(1, '', rowsPerPage);
  };

  // การแบ่งหน้า
  const handlePageChange = (newPage) => {
    if (newPage !== page) {
      setPage(newPage);
      loadProducts(newPage, appliedSearch, rowsPerPage);
    }
  };

  const handleRowsPerPageChange = (newRowsPerPage) => {
    setRowsPerPage(newRowsPerPage);
    setPage(1);
    loadProducts(1, appliedSearch, newRowsPerPage);
  };

  // จัดรูปแบบราคา
  const formatPrice = (price) => {
    return Number(price || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // กรณียังไม่ได้เลือกร้านค้า
  if (!currentStore) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-3">
          <RiStore2Line className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-[#2B2F38]">ยังไม่ได้เลือกร้านค้า</h2>
        <p className="text-xs text-stone-500 mt-1 max-w-sm mb-5">
          กรุณาเลือกร้านค้าที่คุณต้องการดูข้อมูลหรือจัดการจากหน้ารวมร้านค้า
        </p>
        <Link
          href="/store-management"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2B2F38] hover:bg-[#1E2229] text-white rounded-md text-xs font-medium transition-colors shadow-xs"
        >
          <RiArrowLeftLine className="w-4 h-4" />
          <span>ไปหน้ารวมร้านค้า</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[#D3D3D3]/80 flex flex-col overflow-hidden font-sans">
      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 1: หัวข้อหน้า และปุ่มแอ็กชัน (Header Bar)
          ───────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-[#D3D3D3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-[#2B2F38]">
              รายการสินค้า
            </h1>
          </div>
          <p className="text-xs text-[#363636]/70 mt-0.5 font-normal">
            รายการสินค้าทั้งหมดในร้านค้า
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* ปุ่มเพิ่มสินค้าใหม่ */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#2B2F38] hover:bg-[#1E2229] text-white rounded-md text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            title="เพิ่มสินค้าใหม่"
          >
            <RiAddLine className="w-4 h-4" />
            <span>เพิ่มสินค้า</span>
          </button>

          {/* ปุ่มรีเฟรช */}
          <button
            type="button"
            onClick={() => {
              loadProducts(page, appliedSearch, rowsPerPage);
              loadMasterData();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 border border-stone-300 hover:border-[#2B2F38] text-[#2B2F38] hover:bg-stone-50 text-xs font-normal px-3 py-2 rounded-md transition-colors cursor-pointer shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RiRefreshLine className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 2: ช่องค้นหา (Single Search Bar)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-[#D3D3D3] bg-stone-50/50 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex w-full">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาชื่อ หรือรายละเอียดสินค้า..."
              className="w-full pl-3.5 pr-9 py-2 bg-white border border-r-0 border-stone-300 rounded-l-md text-xs sm:text-sm text-[#2B2F38] placeholder-stone-400 focus:border-[#2B2F38] focus:ring-1 focus:ring-[#EB6E3E]/40 focus:outline-none transition-colors"
            />

            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#2B2F38] cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-5 sm:px-6 py-2 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-80 text-white text-xs sm:text-sm font-medium rounded-r-md transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border border-[#2B2F38]"
            title="ค้นหา"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.4}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>ค้นหา</span>
          </button>
        </form>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 3: ตารางรายการสินค้า
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white">
        <div
          style={{ maxHeight: 'calc(100vh - 320px)' }}
          className="overflow-x-auto overflow-y-auto"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[50rem]">
            <thead className="bg-white border-b border-stone-200 text-xs font-normal text-[#363636]/80 select-none sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 font-normal text-[#363636] text-center w-16 bg-white">
                  รูป
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] bg-white">
                  ชื่อสินค้า
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] bg-white">
                  ตำแหน่งจัดเก็บ
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-28 bg-white whitespace-nowrap">
                  จำนวนคงเหลือ
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-24 bg-white whitespace-nowrap">
                  หน่วย
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-right w-28 bg-white whitespace-nowrap">
                  ราคา
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-24 sm:w-28 bg-white whitespace-nowrap">
                  สถานะ
                </th>
                <th className="py-2.5 px-4 font-normal text-[#363636] text-center w-32 bg-white whitespace-nowrap">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RiLoader4Line className="w-6 h-6 animate-spin text-stone-400" />
                      <span className="text-xs">กำลังโหลดข้อมูลรายการสินค้า...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-stone-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
                        <RiBox3Line className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-[#2B2F38]">
                        {appliedSearch ? `ไม่พบสินค้าที่ตรงกับ "${appliedSearch}"` : 'ยังไม่มีรายการสินค้าในร้านนี้'}
                      </p>
                      <p className="text-xs text-stone-500 max-w-xs">
                        {appliedSearch ? 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง' : 'คลิกปุ่ม "+ เพิ่มสินค้า" เพื่อเพิ่มสินค้าใหม่'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product, idx) => {
                  const stock = Number(product.stock_quantity || 0);

                  return (
                    <tr
                      key={product.product_id || idx}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      {/* รูปภาพ */}
                      <td className="py-3 px-3 text-center">
                        <ProductThumbnail
                          thumbnail={product.product_thumbnail}
                          productName={product.product_name}
                        />
                      </td>

                      {/* ชื่อ และ รายละเอียดใต้ชื่อ */}
                      <td className="py-3 px-4 text-[#2B2F38] text-xs sm:text-sm">
                        <p className="font-medium text-[#2B2F38]">{product.product_name}</p>
                        {product.product_desc ? (
                          <p className="text-xs text-stone-500 font-normal mt-0.5 line-clamp-1">
                            {product.product_desc}
                          </p>
                        ) : (
                          <p className="text-xs text-stone-400 font-normal mt-0.5">-</p>
                        )}
                      </td>

                      {/* ตำแหน่งจัดเก็บ (Location) */}
                      <td className="py-3 px-4 text-xs sm:text-sm text-[#2B2F38] whitespace-nowrap">
                        {product.location_name ? (
                          <span className="font-normal text-stone-700">{product.location_name}</span>
                        ) : (
                          <span className="text-stone-400 font-normal">-</span>
                        )}
                      </td>

                      {/* จำนวน (คงเหลือในคลัง) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-xs sm:text-sm">
                        <span
                          className={`font-medium ${
                            stock > 0 ? 'text-[#2B2F38]' : 'text-stone-400'
                          }`}
                        >
                          {stock.toLocaleString()}
                        </span>
                      </td>

                      {/* หน่วย */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-xs text-stone-600">
                        {product.unit_name || product.uom || '-'}
                      </td>

                      {/* ราคา */}
                      <td className="py-3 px-4 text-right whitespace-nowrap text-xs sm:text-sm font-medium text-[#2B2F38]">
                        ฿{formatPrice(product.product_price)}
                      </td>

                      {/* สถานะเปิดจำหน่าย/งดจำหน่าย (Toggle Switch) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(product)}
                            disabled={togglingId === product.product_id}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#EB6E3E] ${
                              (product.status || 'Y') === 'Y' ? 'bg-[#2B2F38]' : 'bg-stone-300'
                            }`}
                            title={
                              (product.status || 'Y') === 'Y'
                                ? 'คลิกเพื่องดจำหน่าย'
                                : 'คลิกเพื่อเปิดจำหน่าย'
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                (product.status || 'Y') === 'Y' ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* จัดการ (ปุ่มรับสินค้าเข้าคลัง + ปุ่มแก้ไข + ปุ่มลบสินค้า) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* ปุ่มรับสินค้าเข้าคลัง */}
                          <button
                            type="button"
                            onClick={() => handleOpenReceiveModal(product)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#D97706] hover:bg-amber-50/80 active:bg-amber-100 transition-colors cursor-pointer"
                            title="รับสินค้าเข้าคลัง"
                          >
                            <RiPlayListAddLine className="w-5 h-5" />
                          </button>

                          {/* ปุ่มแก้ไขสินค้า */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(product)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#2563EB] hover:bg-blue-50 active:bg-blue-100 transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลสินค้า"
                          >
                            <RiEdit2Line className="w-4.5 h-4.5" />
                          </button>

                          {/* ปุ่มลบสินค้า */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(product)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#2B2F38] hover:text-[#DC2626] hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer"
                            title="ลบสินค้า"
                          >
                            <RiDeleteBinLine className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ส่วนที่ 4: แถบ Pagination ด้านล่าง
          ───────────────────────────────────────────────────────────── */}
      <TablePagination
        page={page}
        totalCount={totalCount}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        loading={loading}
      />

      {/* ─────────────────────────────────────────────────────────────
          Modal เพิ่ม / แก้ไขสินค้า (ตาม UI ต้นแบบภาพดีไซน์)
          ───────────────────────────────────────────────────────────── */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn font-sans">
          {/* Backdrop พื้นหลังมืดโปร่งแสง */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleCloseProductModal}
          />

          {/* Modal Container */}
          <div
            className="relative bg-white rounded-lg shadow-2xl max-w-4xl w-full p-6 sm:p-7 z-10 border border-stone-200 overflow-y-auto max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5 border-b border-stone-100 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                {productModalMode === 'create' ? 'เพิ่มสินค้าใหม่' : 'แก้ไขข้อมูลสินค้า'}
              </h3>
              <button
                type="button"
                onClick={handleCloseProductModal}
                disabled={isSubmittingProduct}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            {/* Content: ซ้าย (อัปโหลดรูปภาพ) | ขวา (แบบฟอร์มข้อมูลสินค้า) */}
            <div className="flex flex-col md:flex-row gap-5 items-stretch">
              {/* ซ้าย: กล่องอัปโหลดรูปภาพสินค้าในกรอบเส้นประ สี่เหลี่ยมจัตุรัส */}
              <div className="w-full md:w-[260px] flex flex-col items-center shrink-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative w-full h-[260px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 transition-all cursor-pointer overflow-hidden ${
                    productImagePreview
                      ? 'border-stone-300 bg-white hover:border-[#2B2F38]'
                      : 'border-stone-300 bg-stone-50/50 hover:border-[#2B2F38] hover:bg-stone-50'
                  }`}
                  title="คลิกเพื่อเลือกรูปภาพสินค้า"
                >
                  {productImagePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={productImagePreview}
                        alt="Product Preview"
                        className="max-w-full max-h-full object-contain"
                      />
                      {/* Overlay เปลี่ยน / ลบรูป */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 text-white transition-opacity">
                        <span className="text-xs font-medium bg-black/50 px-2.5 py-1 rounded-md">
                          คลิกเพื่อเปลี่ยนรูป
                        </span>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-600/90 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                        >
                          <RiDeleteBin7Line className="w-3.5 h-3.5" />
                          <span>ลบรูปภาพ</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-stone-400 group-hover:text-[#2B2F38] transition-colors">
                      <RiImageAddLine className="w-12 h-12 stroke-[1.5] mb-2" />
                      <span className="text-xs font-medium text-stone-500 group-hover:text-[#2B2F38]">
                        รูปภาพสินค้า
                      </span>
                      <span className="text-[10px] text-stone-400 mt-1">คลิกเพื่ออัปโหลด</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ขวา: ช่องกรอกข้อมูลสไตล์ Outlined Floating Label */}
              <div className="flex-1 flex flex-col justify-between gap-3.5">
                {/* แถวที่ 1: ชื่อสินค้า * | หมวดหมู่สินค้า * */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <OutlinedField
                    label="ชื่อสินค้า *"
                    prefix={<span className="text-xs font-bold text-stone-400 font-mono tracking-tighter select-none">ABC</span>}
                    value={productForm.product_name}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, product_name: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  />

                  <OutlinedField
                    label="หมวดหมู่สินค้า *"
                    type="select"
                    prefix={<RiGridLine className="w-5 h-5 text-stone-400 shrink-0" />}
                    value={productForm.category_id}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, category_id: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  >
                    <option value="" disabled hidden className="text-stone-400">เลือกหมวดหมู่สินค้า</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id} className="text-stone-800">
                        {c.category_name}
                      </option>
                    ))}
                  </OutlinedField>
                </div>

                {/* แถวที่ 2: คำอธิบายสินค้า * (เต็มความกว้าง) */}
                <OutlinedField
                  label="คำอธิบายสินค้า *"
                  prefix={<RiFileTextLine className="w-5 h-5 text-stone-400 shrink-0" />}
                  value={productForm.product_desc}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, product_desc: e.target.value }))}
                  disabled={isSubmittingProduct}
                  required
                />

                {/* แถวที่ 3: ตำแหน่งจัดเก็บสินค้า * | รหัสสินค้า (บัญชี) * */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <OutlinedField
                    label="ตำแหน่งจัดเก็บสินค้า *"
                    type="select"
                    prefix={<RiArchiveDrawerLine className="w-5 h-5 text-stone-400 shrink-0" />}
                    value={productForm.location_id}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, location_id: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  >
                    <option value="" disabled hidden className="text-stone-400">เลือกตำแหน่งจัดเก็บสินค้า</option>
                    {locations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id} className="text-stone-800">
                        {loc.location_name}
                      </option>
                    ))}
                  </OutlinedField>

                  <OutlinedField
                    label="รหัสสินค้า (บัญชี) *"
                    prefix={<span className="text-stone-400 font-bold font-mono text-base select-none">#</span>}
                    value={productForm.company_code}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, company_code: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  />
                </div>

                {/* แถวที่ 4: หน่วย * | ราคาสินค้า * | จำนวนในชุด * | จำกัดการขาย * */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {/* หน่วย * */}
                  <OutlinedField
                    label="หน่วย *"
                    type="select"
                    prefix={<RiBox3Line className="w-5 h-5 text-stone-400 shrink-0" />}
                    value={productForm.unit_id}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, unit_id: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  >
                    <option value="" disabled hidden className="text-stone-400">เลือกหน่วย</option>
                    {units.map((u) => (
                      <option key={u.unit_id} value={u.unit_id} className="text-stone-800">
                        {u.unit_name || u.unit}
                      </option>
                    ))}
                  </OutlinedField>

                  {/* ราคาสินค้า * */}
                  <OutlinedField
                    label="ราคาสินค้า *"
                    type="number"
                    step="any"
                    min="0"
                    suffix={<span className="text-stone-500 text-xs shrink-0 pl-1 select-none">บาท</span>}
                    value={productForm.product_price}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, product_price: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  />

                  {/* จำนวนในชุด * (batch_size) */}
                  <OutlinedField
                    label="จำนวนในชุด *"
                    type="number"
                    step="1"
                    min="1"
                    suffix={
                      selectedUnitName ? (
                        <span className="text-stone-500 text-xs shrink-0 pl-1 select-none">
                          {selectedUnitName}
                        </span>
                      ) : null
                    }
                    value={productForm.batch_size}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, batch_size: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  />

                  {/* จำกัดการขาย * (order_limit) */}
                  <OutlinedField
                    label="จำกัดการขาย *"
                    type="number"
                    step="1"
                    min="0"
                    suffix={
                      selectedUnitName ? (
                        <span className="text-stone-500 text-xs shrink-0 pl-1 select-none">
                          {selectedUnitName}
                        </span>
                      ) : null
                    }
                    value={productForm.order_limit}
                    onChange={(e) => setProductForm((prev) => ({ ...prev, order_limit: e.target.value }))}
                    disabled={isSubmittingProduct}
                    required
                  />
                </div>
              </div>
            </div>

            {/* แถบปุ่ม Action มุมขวาล่าง */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={handleProductSubmit}
                disabled={isSubmittingProduct || !isProductFormValid}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                {isSubmittingProduct ? (
                  <>
                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <RiCheckLine className="w-4 h-4" />
                    <span>{productModalMode === 'create' ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCloseProductModal}
                disabled={isSubmittingProduct}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#D32F2F] hover:bg-[#C62828] active:bg-[#B71C1C] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                <RiCloseLine className="w-4 h-4" />
                <span>ยกเลิก</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal รับสินค้าเข้า (Receive Modal)
          ───────────────────────────────────────────────────────────── */}
      {isReceiveModalOpen && selectedProductForReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleCloseReceiveModal}
          />

          {/* Modal Container */}
          <div
            className="relative bg-white rounded-lg shadow-2xl max-w-3xl w-full p-6 sm:p-7 z-10 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5">
              <h3 className="text-base sm:text-lg font-bold text-[#2B2F38]">
                รับสินค้าเข้า
              </h3>
            </div>

            {/* Content: ซ้าย (รูปภาพ) | ขวา (แบบฟอร์ม) */}
            <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch">
              {/* ซ้าย: รูปภาพสินค้าในกรอบเส้นประ */}
              <div className="w-full md:w-[260px] h-[260px] border-2 border-dashed border-stone-300 rounded-lg flex items-center justify-center p-4 bg-white shrink-0">
                {selectedProductForReceive.product_thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={getThumbnailUrl(selectedProductForReceive.product_thumbnail)}
                    alt={selectedProductForReceive.product_name || ''}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-stone-300">
                    <RiImageLine className="w-12 h-12 stroke-[1.5]" />
                  </div>
                )}
              </div>

              {/* ขวา: ช่องกรอกข้อมูลสไตล์ Outlined Label */}
              <div className="flex-1 flex flex-col justify-between gap-3 sm:gap-3.5">
                {/* แถวที่ 1: ชื่อสินค้า | หมวดหมู่สินค้า */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <OutlinedField
                    label="ชื่อสินค้า"
                    readOnly
                    prefix={<span className="text-xs font-bold text-stone-400 font-mono tracking-tighter">ABC</span>}
                    value={selectedProductForReceive.product_name}
                  />

                  <OutlinedField
                    label="หมวดหมู่สินค้า"
                    readOnly
                    prefix={<RiGridLine className="w-5 h-5 text-stone-400 shrink-0" />}
                    value={selectedProductForReceive.category_name || '-'}
                  />
                </div>

                {/* แถวที่ 2: คำอธิบายสินค้า */}
                <OutlinedField
                  label="คำอธิบายสินค้า"
                  readOnly
                  prefix={<RiFileTextLine className="w-5 h-5 text-stone-400 shrink-0" />}
                  value={selectedProductForReceive.product_desc || selectedProductForReceive.product_name}
                />

                {/* แถวที่ 3: ประเภทสินค้า * | ราคาสินค้า (บาท) * | จำนวนสินค้า * */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <OutlinedField
                    label="ประเภทสินค้า *"
                    type="select"
                    value={receiveForm.item_type}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, item_type: e.target.value }))}
                  >
                    <option value="normal">สินค้าใหม่</option>
                    <option value="preorder">สินค้าจองล่วงหน้า</option>
                    <option value="waste">สินค้าชำรุด</option>
                    <option value="lost">สินค้าหาย</option>
                  </OutlinedField>

                  <OutlinedField
                    label="ราคาสินค้า (บาท) *"
                    type="number"
                    step="any"
                    min="0"
                    prefix={<span className="text-stone-500 font-semibold text-base select-none">$</span>}
                    value={receiveForm.price}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, price: e.target.value }))}
                  />

                  <OutlinedField
                    label="จำนวนสินค้า *"
                    type="number"
                    min="1"
                    step="1"
                    value={receiveForm.quantity}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    suffix={
                      <span className="text-stone-500 text-sm shrink-0 pl-1 select-none">
                        {selectedProductForReceive.unit_name || selectedProductForReceive.uom || 'อัน'}
                      </span>
                    }
                  />
                </div>

                {/* แถวที่ 4: คำอธิบายเพิ่มเติม */}
                <OutlinedField
                  label="คำอธิบายเพิ่มเติม"
                  type="text"
                  prefix={<RiChat1Line className="w-5 h-5 text-stone-400 shrink-0" />}
                  value={receiveForm.remark}
                  onChange={(e) => setReceiveForm((prev) => ({ ...prev, remark: e.target.value }))}
                />
              </div>
            </div>

            {/* แถบปุ่ม Action มุมขวาล่าง */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleReceiveSubmit}
                disabled={isSubmittingReceive}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#2B2F38] hover:bg-[#1E2229] active:bg-black disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                <RiPlayListAddLine className="w-4 h-4" />
                <span>{isSubmittingReceive ? 'กำลังบันทึก...' : 'รับสินค้าเข้า'}</span>
              </button>

              <button
                type="button"
                onClick={handleCloseReceiveModal}
                disabled={isSubmittingReceive}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#D32F2F] hover:bg-[#C62828] active:bg-[#B71C1C] disabled:opacity-60 text-white rounded-md text-sm font-medium transition-colors cursor-pointer shadow-xs"
              >
                <RiCloseLine className="w-4 h-4" />
                <span>ยกเลิก</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
