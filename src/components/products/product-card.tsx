'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { Heart, BarChart3, ExternalLink, Store } from 'lucide-react';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { calculateSavings } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

/** Store logo paths */
const STORE_LOGOS: Record<string, string> = {
  amazon: '/logos/amazon.png',
  noon: '/logos/noon.png',
  jarir: '/logos/jarir.png',
  extra: '/logos/extra.png',
  almanea: '/logos/almanea.png',
};

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
  isSaved?: boolean;
  isInCompare?: boolean;
  onAddToCart?: (product: ProductCardProps['product']) => void;
  showActions?: boolean;
}

export type ProductCardProduct = ProductCardProps['product'];

export function ProductCard({
  product,
  locale,
  onCompare,
  onSave,
  isSaved = false,
  isInCompare = false,
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
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isMultiStore = product.product_stores.length > 1;
  const isDbProduct = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id);

  // Get external product URL if available (for scraped products not in DB)
  const externalProductUrl = !isMultiStore
    ? (product.product_stores[0]?.product_url || product.product_stores[0]?.affiliate_url)
    : null;
  const isExternalLink = externalProductUrl && (externalProductUrl.startsWith('http://') || externalProductUrl.startsWith('https://'));

  // DB products go to detail page; scraped-only products link externally
  const productLink = isDbProduct
    ? `/${currentLocale}/products/${product.slug}`
    : (isExternalLink ? externalProductUrl : `/${currentLocale}/products/${product.slug}`);

  // Get available images
  const availableImages = product.image_urls?.filter(Boolean) || [];

  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
    setCurrentImageIndex(0);
  }, [product.id]);

  // Try next image if current one fails
  const handleImageError = () => {
    if (currentImageIndex < availableImages.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
      setImageLoading(true);
    } else {
      setImageError(true);
      setImageLoading(false);
    }
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

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

  // Get current image or placeholder
  const currentImageUrl = availableImages[currentImageIndex] || null;
  let imageSrc = imageError || !currentImageUrl ? PLACEHOLDER_IMAGE : currentImageUrl;

  // DB products use internal Link; scraped-only products open external store
  const LinkWrapper = ({ children }: { children: React.ReactNode }) => {
    if (!isDbProduct && isExternalLink) {
      return (
        <a href={productLink} target="_blank" rel="noopener noreferrer" className="flex flex-col h-full">
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

  // Get unique store initials for display
  const storeInitials = product.product_stores
    .filter(ps => ps.stores)
    .map(ps => ({
      id: ps.stores.id,
      initial: (currentLocale === 'ar' ? ps.stores.name_ar : ps.stores.name_en || '?').charAt(0).toUpperCase(),
      name: currentLocale === 'ar' ? ps.stores.name_ar : ps.stores.name_en,
    }))
    .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

  return (
    <Card className="group transition-all duration-300 h-full flex flex-col">
      <LinkWrapper>
        {/* Product Image */}
        <div className="relative w-full aspect-square overflow-hidden rounded-t-xl bg-surface-container-highest">
          {/* Loading skeleton */}
          {imageLoading && !imageError && (
            <div className="absolute inset-0 bg-surface-container-highest animate-pulse" />
          )}

          {/* Product Image */}
          <Image
            src={imageSrc}
            alt={productName}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className={`object-cover group-hover:scale-110 transition-transform duration-300 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
            unoptimized={isExternalLink || imageSrc.includes('jarir.com')}
            priority={false}
          />
          {/* Badges Overlay */}
          <div className="absolute top-2 start-2 flex flex-col gap-2">
            {isMultiStore && bestPrice && storesWithPrices.length > 1 && (
              <Badge variant="success" className="text-xs">
                {t('price.best')}
              </Badge>
            )}
            {hasDeal && (
              <Badge variant="warning" className="text-xs animate-pulse">
                {t('products.hotDeal')}
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="secondary" className="text-xs">
                {t('products.outOfStock')}
              </Badge>
            )}
          </div>

          {/* Multi-store badge (top-right) */}
          {isMultiStore && (
            <div className="absolute top-2 end-2">
              <Badge variant="default" className="text-xs font-medium gap-1">
                <Store className="w-3 h-3" />
                {storeCount}
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Product Info */}
          <div className="flex-1 mb-3">
            <h3 className="text-sm font-medium text-on-surface mb-1 line-clamp-2 min-h-[2.25rem]">
              {productName}
            </h3>
            <p className="text-sm text-on-surface-variant mb-2">
              {product.brand} {product.model}
            </p>

            {/* Price + Store row */}
            <div className="flex items-center justify-between gap-2 mb-1">
              {/* Price */}
              <div className="min-w-0">
                {bestPriceValue > 0 ? (
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {isMultiStore && (
                      <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                        {t('products.from')}
                      </span>
                    )}
                    <Price
                      amount={bestPriceValue}
                      className="text-base font-bold text-on-surface"
                      symbolClassName="w-4 h-4"
                    />
                    {originalPrice && originalPrice > bestPriceValue && (
                      <Price
                        amount={originalPrice}
                        className="text-xs text-outline line-through"
                        symbolClassName="w-3 h-3"
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    {t('products.priceNotAvailable')}
                  </p>
                )}
              </div>

              {/* Store */}
              {isMultiStore ? (
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex -space-x-1 rtl:space-x-reverse">
                    {storeInitials.map((s) => (
                      <div
                        key={s.id}
                        className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 overflow-hidden bg-white dark:bg-gray-800"
                        title={s.name}
                      >
                        {STORE_LOGOS[s.id] ? (
                          <img src={STORE_LOGOS[s.id]} alt={s.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-gray-500">{s.initial}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                storeCount > 0 && (() => {
                  const storeId = product.product_stores[0]?.stores.id || '';
                  const storeName = currentLocale === 'ar'
                    ? product.product_stores[0]?.stores.name_ar
                    : product.product_stores[0]?.stores.name_en;
                  return (
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-white dark:bg-gray-800">
                        {STORE_LOGOS[storeId] ? (
                          <img src={STORE_LOGOS[storeId]} alt={storeName || ''} className="w-full h-full object-contain" />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-gray-500">{(storeName || '?')[0].toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        {storeName}
                      </span>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Savings + Coupon */}
            {savings > 0 && (
              <Badge variant="success-light" className="text-[10px] mb-1">
                {t('price.save')} <Price amount={savings} className="text-[10px] font-semibold" symbolClassName="w-2.5 h-2.5" />
              </Badge>
            )}
            {bestPrice?.coupon_code && (
              <div className="mb-1">
                <CouponBadge
                  coupon={{ code: bestPrice.coupon_code }}
                  variant="compact"
                  locale={currentLocale}
                />
              </div>
            )}
          </div>

        </CardContent>
      </LinkWrapper>

      {/* Action Buttons — outside LinkWrapper so clicks work */}
      {showActions && (
        <div className="px-4 pb-4 pt-0 flex items-center gap-2">
          {/* Primary CTA */}
          {isMultiStore ? (
            <Button
              variant="default"
              size="sm"
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs"
              asChild
            >
              <Link href={productLink}>
                <BarChart3 className="w-3 h-3 shrink-0" />
                {t('products.comparePrices', { count: String(storeCount) })}
              </Link>
            </Button>
          ) : externalProductUrl ? (
            <Button
              variant="default"
              size="sm"
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs"
              asChild
            >
              <a
                href={externalProductUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                {t('products.viewAtStore')}
              </a>
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs"
              disabled
            >
              <ExternalLink className="w-3 h-3 shrink-0" />
              {t('products.viewAtStore')}
            </Button>
          )}
          {/* Wishlist */}
          {onSave && (
            <Button
              variant="outline"
              size="sm"
              className={cn('shrink-0 px-2', isSaved && 'text-red-500 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20')}
              aria-label={t('product.saveToWishlist')}
              onClick={() => onSave(product.id)}
            >
              <Heart className={cn('w-4 h-4', isSaved && 'fill-current')} />
            </Button>
          )}
          {/* Compare */}
          {onCompare && (
            <Button
              variant="outline"
              size="sm"
              className={cn('shrink-0 px-2', isInCompare && 'text-primary-600 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20')}
              aria-label={t('product.addToCompare')}
              onClick={() => onCompare(product.id)}
            >
              <BarChart3 className={cn('w-4 h-4', isInCompare && 'fill-current')} />
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
