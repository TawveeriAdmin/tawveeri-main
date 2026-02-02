'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { Heart, BarChart3, ShoppingCart } from 'lucide-react';
import { calculateSavings } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

interface ProductStore {
  id: string;
  current_price: number;
  original_price: number | null;
  availability: AvailabilityStatus;
  currency?: string;
  stock_quantity?: number | null;
  product_url?: string | null;
  affiliate_url?: string | null;
  delivery_time_days?: number | null;
  delivery_cost?: number | null;
  is_free_delivery?: boolean;
  is_deal?: boolean;
  deal_expires_at?: string | null;
  coupon_code?: string | null;
  stores: {
    id: string;
    name_ar: string;
    name_en: string;
    logo_url: string | null;
  };
}

interface ProductCardProps {
  product: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    category: ProductCategory;
    brand: string;
    model: string;
    image_urls: string[] | null;
    product_stores: ProductStore[];
  };
  locale: string;
  onCompare?: (productId: string) => void;
  onSave?: (productId: string) => void;
  onAddToCart?: (product: ProductCardProps['product']) => void;
  showActions?: boolean;
}

export type ProductCardProduct = ProductCardProps['product'];

export function ProductCard({
  product,
  locale,
  onCompare,
  onSave,
  onAddToCart,
  showActions = true,
}: ProductCardProps) {
  const t = useTranslations();
  
  // Get locale from params if not provided
  const params = useParams();
  const currentLocale = locale || (params?.locale as string) || 'ar';

  // Get product name based on locale
  const productName = currentLocale === 'ar' ? product.name_ar : product.name_en;
  const [imageError, setImageError] = useState(false);
  
  // Get external product URL if available (for scraped products)
  const externalProductUrl = product.product_stores[0]?.product_url || product.product_stores[0]?.affiliate_url;
  const isExternalLink = externalProductUrl && (externalProductUrl.startsWith('http://') || externalProductUrl.startsWith('https://'));
  
  // Determine the link destination
  const productLink = isExternalLink 
    ? externalProductUrl 
    : `/${currentLocale}/products/${product.slug}`;

  useEffect(() => {
    setImageError(false);
  }, [product.id]);

  // Get best price from all stores
  const storesWithPrices = product.product_stores
    .filter((ps) => ps.availability !== 'out_of_stock')
    .sort((a, b) => a.current_price - b.current_price);

  const bestPrice = storesWithPrices[0];
  const bestPriceValue = bestPrice?.current_price || 0;
  const originalPrice = bestPrice?.original_price || null;
  const storeCount = product.product_stores.length;
  const hasDeal = product.product_stores.some((ps) => ps.original_price && ps.original_price > ps.current_price);
  const isOutOfStock = product.product_stores.every((ps) => ps.availability === 'out_of_stock');
  const savings = originalPrice ? calculateSavings(originalPrice, bestPriceValue) : 0;

  // Get first image or placeholder SVG
  const imageUrl = product.image_urls?.[0] || null;
  const imageSrc = imageError || !imageUrl ? PLACEHOLDER_IMAGE : imageUrl;

  // Render link wrapper - external link for scraped products, internal for database products
  const LinkWrapper = ({ children }: { children: React.ReactNode }) => {
    if (isExternalLink) {
      return (
        <a 
          href={productLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex flex-col h-full"
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={productLink} className="flex flex-col h-full">
        {children}
      </Link>
    );
  };

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <LinkWrapper>
        {/* Product Image */}
        <div className="relative w-full aspect-square overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-800">
          <Image
            src={imageSrc}
            alt={productName}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className="object-cover group-hover:scale-110 transition-transform duration-300"
            onError={() => setImageError(true)}
            loading="lazy"
          />
          {/* Badges Overlay */}
          <div className="absolute top-2 start-2 flex flex-col gap-2">
            {bestPrice && storesWithPrices.length > 0 && (
              <Badge variant="success" className="text-xs">
                {t('price.best')}
              </Badge>
            )}
            {hasDeal && (
              <Badge variant="warning" className="text-xs animate-pulse">
                🔥 {t('products.hotDeal')}
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="secondary" className="text-xs">
                {t('products.outOfStock')}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Product Info */}
          <div className="flex-1 mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 min-h-[2.5rem]">
              {productName}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {product.brand} {product.model}
            </p>

            {/* Price */}
            <div className="mb-2">
              {bestPriceValue > 0 ? (
                <div className="flex items-baseline gap-2">
                  <Price
                    amount={bestPriceValue}
                    className="text-2xl font-bold text-gray-900 dark:text-gray-100"
                    symbolClassName="w-6 h-6"
                  />
                  {originalPrice && originalPrice > bestPriceValue && (
                    <Price
                      amount={originalPrice}
                      className="text-sm text-gray-400 dark:text-gray-500 line-through"
                      symbolClassName="w-4 h-4"
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('products.priceNotAvailable')}
                </p>
              )}
              {savings > 0 && (
                <Badge variant="success-light" className="mt-1 text-xs">
                  💰 {t('price.save')} <Price amount={savings} className="text-xs font-semibold" symbolClassName="w-3 h-3" />
                </Badge>
              )}
            </div>

            {/* Store Count */}
            {storeCount > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {storeCount} {storeCount === 1 ? t('products.store') : t('products.stores')}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          {showActions && (
            <div className="mt-auto space-y-2">
              {onAddToCart && (
                <Button
                  variant="default"
                  className="w-full"
                  disabled={!bestPrice}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onAddToCart(product);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('product.addToCart')}
                </Button>
              )}
              <div className="flex gap-2">
                {onSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    aria-label={t('product.saveToWishlist')}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSave(product.id);
                    }}
                  >
                    <Heart className="w-4 h-4" />
                  </Button>
                )}
                {onCompare && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    aria-label={t('product.addToCompare')}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCompare(product.id);
                    }}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </LinkWrapper>
    </Card>
  );
}

