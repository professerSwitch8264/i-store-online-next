// src/app/components/ui/ProductThumbnail.jsx
'use client';

import { useState } from 'react';
import { RiImageLine } from 'react-icons/ri';
import { getThumbnailUrl } from '@/lib/utils';

/**
 * =========================================================================
 * Component: ProductThumbnail (แสดงรูปภาพสินค้าขนาดย่อ พร้อม Broken Image Fallback)
 * =========================================================================
 */
export function ProductThumbnail({
  thumbnail,
  productName = '',
  size = 'w-10 h-10',
  className = '',
}) {
  const [imageError, setImageError] = useState(false);
  const thumbUrl = getThumbnailUrl(thumbnail);

  if (!thumbUrl || imageError) {
    return (
      <div
        className={`${size} rounded bg-stone-100 border border-stone-200 flex items-center justify-center p-1 shrink-0 text-stone-300 mx-auto ${className}`}
      >
        <RiImageLine className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div
      className={`${size} rounded bg-stone-50 border border-stone-200 flex items-center justify-center p-1 overflow-hidden shrink-0 mx-auto ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl}
        alt={productName || ''}
        onError={() => setImageError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export const OrderItemThumbnail = ProductThumbnail;
export default ProductThumbnail;
