'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Heart, BarChart3, ExternalLink, Store, Flame } from 'lucide-react';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { calculateSavings } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { StoreLogo } from '@/components/ui/store-logo';
import { bestPrice as bestPriceCopy, savings as savingsCopy } from '@/lib/copy';

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
    description_ar?: string | null;
    description_en?: string | null;
    specifications?: Record<string, unknown> | null;
  };
  locale: string;
  onCompare?: (productId: string) => void;
  onSave?: (productId: string) => void;
  isSaved?: boolean;
  isInCompare?: boolean;
  onAddToCart?: (product: ProductCardProps['product']) => void;
  onCardClick?: (product: ProductCardProps['product']) => void;
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
  onCardClick,
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

  // Always route to OUR internal product detail page — no jumping to external stores.
  const productLink = `/${currentLocale}/products/${product.slug}`;

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

  // If onCardClick is provided open the detail sheet; otherwise navigate internally.
  const LinkWrapper = ({ children }: { children: React.ReactNode }) =>
    onCardClick ? (
      <button
        type="button"
        onClick={() => onCardClick(product)}
        className="flex flex-col h-full w-full text-start"
      >
        {children}
      </button>
    ) : (
      <Link href={productLink} className="flex flex-col h-full">
        {children}
      </Link>
    );

  // Get unique store initials for display
  const storeInitials = product.product_stores
    .filter(ps => ps.stores)
    .map(ps => ({
      id: ps.stores.id,
      initial: (currentLocale === 'ar' ? ps.stores.name_ar : ps.stores.name_en || '?').charAt(0).toUpperCase(),
      name: currentLocale === 'ar' ? ps.stores.name_ar : ps.stores.name_en,
    }))
    .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

  const isWinner = isMultiStore && bestPrice && storesWithPrices.length > 1;

  return (
    <Card className="group relative transition-all duration-[var(--dur-med)] h-full flex flex-col overflow-hidden hover:border-[var(--brand-green)]/50">
      {/* Wishlist heart — absolute, outside link wrapper for clickability */}
      {showActions && onSave && (
        <div className="absolute end-2 top-2 z-10">
          <IconButton
            variant={isSaved ? 'accent' : 'tonal'}
            size="sm"
            aria-label={t('product.saveToWishlist')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave(product.id);
            }}
            className={cn(
              'shadow-[var(--elevation-1)]',
              isSaved && 'text-[var(--brand-dark-text)]',
            )}
          >
            <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} />
          </IconButton>
        </div>
      )}

      <LinkWrapper>
        {/* Product Image */}
        <div className="relative w-full aspect-square overflow-hidden rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface-container-low)]">
          {/* Loading skeleton */}
          {imageLoading && !imageError && (
            <div className="absolute inset-0 bg-[var(--brand-bg-green)] animate-pulse" />
          )}

          {/* Product Image */}
          <Image
            src={imageSrc}
            alt={productName}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className={`object-contain p-3 group-hover:scale-105 transition-transform duration-[var(--dur-med)] ease-[var(--ease-out-brand)] ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onError={handleImageError}
            onLoad={handleImageLoad}
            loading="lazy"
            unoptimized={isExternalLink || imageSrc.includes('jarir.com')}
            priority={false}
          />
          {/* Badges overlay (start-side) */}
          <div className="absolute top-2 start-2 flex flex-col gap-1.5">
            {isWinner && (
              <Badge variant="best" className="shadow-[var(--elevation-1)]">
                {bestPriceCopy(currentLocale as 'ar' | 'en')}
              </Badge>
            )}
            {hasDeal && !isWinner && (
              <Badge
                variant="best"
                className="shadow-[var(--elevation-1)] gap-1 bg-[var(--brand-gold)] text-[var(--brand-dark-text)]"
              >
                <Flame
                  className="h-3.5 w-3.5"
                  style={{ fill: '#FF6B35', color: '#C4361A' }}
                  strokeWidth={2}
                />
                {t('products.hotDeal')}
              </Badge>
            )}
            {isOutOfStock && (
              <Badge variant="outline" className="bg-[color:var(--color-surface)]/90 backdrop-blur-sm">
                {t('products.outOfStock')}
              </Badge>
            )}
          </div>

          {/* Multi-store count chip (end-side, below heart) */}
          {isMultiStore && (
            <div className="absolute bottom-2 end-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface)]/95 backdrop-blur-sm px-2 py-1 text-[11px] font-semibold text-[var(--brand-green-dark)] shadow-[var(--elevation-1)] border border-[color:var(--color-outline-variant)]/40">
                <Store className="w-3 h-3" />
                {storeCount}
              </span>
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Product Info */}
          <div className="flex-1 mb-3">
            <h3 className="t-body-strong text-on-surface mb-1 line-clamp-2 min-h-[3rem] leading-tight">
              {productName}
            </h3>
            {(product.brand || product.model) && (
              <p className="t-small text-on-surface-variant mb-3 line-clamp-1">
                {[product.brand, product.model].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Price + Store row */}
            <div className="flex items-end justify-between gap-2 mb-1">
              {/* Price */}
              <div className="min-w-0 flex-1">
                {bestPriceValue > 0 ? (
                  <div className="flex flex-col gap-1">
                    {isMultiStore && (
                      <span className="t-caption text-[var(--brand-green-dark)]">
                        {t('products.from')}
                      </span>
                    )}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Price
                        amount={bestPriceValue}
                        className="text-xl font-extrabold text-on-surface"
                        symbolClassName="w-5 h-5"
                      />
                      {originalPrice && originalPrice > bestPriceValue && (
                        <Price
                          amount={originalPrice}
                          className="text-xs text-on-surface-variant line-through"
                          symbolClassName="w-3 h-3"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="t-small text-on-surface-variant">
                    {t('products.priceNotAvailable')}
                  </p>
                )}
              </div>

              {/* Store */}
              {isMultiStore ? (
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex -space-x-1 rtl:space-x-reverse">
                    {storeInitials.map((s) => (
                      <StoreLogo
                        key={s.id}
                        slug={s.id}
                        size="xs"
                        alt={s.name}
                        locale={currentLocale as 'ar' | 'en'}
                        className="border-2 border-[color:var(--color-surface)] bg-[color:var(--color-surface)]"
                      />
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
                      <StoreLogo
                        slug={storeId}
                        size="xs"
                        alt={storeName || storeId}
                        locale={currentLocale as 'ar' | 'en'}
                      />
                      <span className="text-[11px] text-on-surface-variant">
                        {storeName}
                      </span>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Savings chip (gold) + Coupon */}
            {savings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-gold)]/12 text-[var(--brand-gold-dark)] px-2 py-0.5 t-small font-semibold mt-2">
                {savingsCopy(savings, currentLocale as 'ar' | 'en')}
              </span>
            )}
            {bestPrice?.coupon_code && (
              <div className="mt-2">
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

      {/* Action Row — outside LinkWrapper so clicks work */}
      {showActions && (
        <div className="px-4 pb-4 pt-0 flex items-center gap-2">
          {/* Primary CTA */}
          {isMultiStore ? (
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs"
              asChild
            >
              <Link href={productLink}>
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                {t('products.comparePrices', { count: String(storeCount) })}
              </Link>
            </Button>
          ) : externalProductUrl ? (
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs"
              asChild
            >
              <a
                href={externalProductUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                {t('products.viewAtStore')}
              </a>
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="flex-1 text-xs"
              disabled
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              {t('products.viewAtStore')}
            </Button>
          )}
          {/* Compare (heart is now an overlay above) */}
          {onCompare && (
            <IconButton
              variant={isInCompare ? 'accent' : 'outline'}
              size="sm"
              aria-label={t('product.addToCompare')}
              onClick={() => onCompare(product.id)}
            >
              <BarChart3 className={cn('w-4 h-4', isInCompare && 'fill-current')} />
            </IconButton>
          )}
        </div>
      )}
    </Card>
  );
}
