'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price, SavingsLabel } from '@/components/ui/price';
import { StoreLogo } from '@/components/ui/store-logo';
import { useTranslations } from '@/lib/simple-intl-provider';
import { cn } from '@/lib/utils';
import { calculateSavings } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Truck,
  Package,
} from 'lucide-react';
import type { ProductCardProduct } from '@/components/products/product-card';
import { recordFirstPartyInteraction } from '@/lib/analytics/interaction';

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

interface ProductDetailSheetProps {
  product: ProductCardProduct | null;
  open: boolean;
  onClose: () => void;
  locale: string;
}

export function ProductDetailSheet({
  product,
  open,
  onClose,
  locale,
}: ProductDetailSheetProps) {
  const t = useTranslations();
  const isRTL = locale === 'ar';

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  // Reset carousel when product changes
  useEffect(() => {
    setActiveImageIndex(0);
    setImageError(false);
  }, [product?.id]);

  if (!product) return null;

  const productName = isRTL ? product.name_ar : product.name_en;
  const description = isRTL ? product.description_ar : product.description_en;
  const images = product.image_urls?.filter(Boolean) || [];
  const hasMultipleImages = images.length > 1;
  const currentImageSrc = imageError || images.length === 0 ? PLACEHOLDER_IMAGE : images[activeImageIndex] || PLACEHOLDER_IMAGE;

  const specs = product.specifications;
  const hasSpecs = specs && typeof specs === 'object' && Object.keys(specs).length > 0;

  // Stores sorted cheapest first (already done in adapter, but ensure)
  const stores = [...product.product_stores].sort((a, b) => (a.current_price || Infinity) - (b.current_price || Infinity));

  const bestStore = stores[0];
  const savings = bestStore?.original_price
    ? calculateSavings(bestStore.original_price, bestStore.current_price)
    : 0;

  const availabilityLabel = (status: string) => {
    if (status === 'out_of_stock') return isRTL ? 'غير متوفر' : 'Out of stock';
    if (status === 'limited_stock') return isRTL ? 'كمية محدودة' : 'Limited stock';
    if (status === 'pre_order') return isRTL ? 'طلب مسبق' : 'Pre-order';
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">{productName}</DialogTitle>

        {/* ── Image Carousel ── */}
        <div className="relative aspect-video w-full bg-[color:var(--color-surface-container-low)] overflow-hidden rounded-t-[var(--radius-lg)]">
          <Image
            src={currentImageSrc}
            alt={productName}
            fill
            className="object-contain p-6"
            unoptimized
            onError={() => setImageError(true)}
          />

          {/* Prev arrow */}
          {hasMultipleImages && activeImageIndex > 0 && (
            <button
              type="button"
              onClick={() => setActiveImageIndex(i => i - 1)}
              className="absolute start-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-surface)]/90 shadow-[var(--elevation-2)] text-on-surface transition-colors hover:bg-[color:var(--color-surface-container-high)]"
              aria-label={isRTL ? 'الصورة السابقة' : 'Previous image'}
            >
              {isRTL ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          )}

          {/* Next arrow */}
          {hasMultipleImages && activeImageIndex < images.length - 1 && (
            <button
              type="button"
              onClick={() => setActiveImageIndex(i => i + 1)}
              className="absolute end-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-surface)]/90 shadow-[var(--elevation-2)] text-on-surface transition-colors hover:bg-[color:var(--color-surface-container-high)]"
              aria-label={isRTL ? 'الصورة التالية' : 'Next image'}
            >
              {isRTL ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          )}

          {/* Dot indicators */}
          {hasMultipleImages && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImageIndex(i)}
                  className={cn(
                    'rounded-full transition-all',
                    i === activeImageIndex
                      ? 'w-5 h-2 bg-primary'
                      : 'w-2 h-2 bg-on-surface/30 hover:bg-on-surface/50',
                  )}
                  aria-label={`${isRTL ? 'الصورة' : 'Image'} ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex flex-col gap-5 p-6">

          {/* Header: category + name + brand */}
          <div className="flex flex-col gap-2 pe-8">
            <Badge variant="outline" className="self-start capitalize">
              {t(`products.categories.${product.category}`) || product.category}
            </Badge>
            <h2 className="text-xl font-bold leading-snug text-on-surface">
              {productName}
            </h2>
            {(product.brand || product.model) && (
              <p className="t-small text-on-surface-variant">
                {[product.brand, product.model].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <hr className="border-[color:var(--color-outline-variant)]" />

          {/* ── Store pricing list ── */}
          <div className="flex flex-col gap-1">
            <h3 className="t-body-strong text-on-surface mb-2">
              {isRTL ? 'الأسعار في المتاجر' : 'Store Prices'}
            </h3>

            <div className="flex flex-col divide-y divide-[color:var(--color-outline-variant)]/50">
              {stores.map((ps, idx) => {
                const storeName = isRTL ? ps.stores.name_ar : ps.stores.name_en;
                const externalUrl = ps.product_url || ps.affiliate_url;
                const storeSavings = ps.original_price ? calculateSavings(ps.original_price, ps.current_price) : 0;
                const availLabel = availabilityLabel(ps.availability);

                return (
                  <div key={ps.id} className="flex items-center justify-between gap-3 py-3">
                    {/* Store identity */}
                    <div className="flex items-center gap-2 min-w-0">
                      <StoreLogo
                        slug={ps.stores.slug ?? ps.stores.id}
                        size="sm"
                        alt={storeName}
                        locale={locale as 'ar' | 'en'}
                        className="shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="t-small font-semibold text-on-surface truncate">{storeName}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ps.is_free_delivery && (
                            <span className="inline-flex items-center gap-0.5 t-caption text-[var(--brand-green-dark)]">
                              <Truck className="h-3 w-3" />
                              {isRTL ? 'شحن مجاني' : 'Free delivery'}
                            </span>
                          )}
                          {availLabel && (
                            <span className="t-caption text-on-surface-variant">{availLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      {ps.current_price > 0 ? (
                        <>
                          <Price
                            amount={ps.current_price}
                            className={cn(
                              'text-base font-bold',
                              idx === 0 ? 'text-on-surface' : 'text-on-surface',
                            )}
                            symbolClassName="w-3.5 h-3.5"
                          />
                          {ps.original_price && ps.original_price > ps.current_price && (
                            <Price
                              amount={ps.original_price}
                              className="text-xs text-on-surface-variant line-through"
                              symbolClassName="w-2.5 h-2.5"
                            />
                          )}
                          {/* Savings label temporarily hidden — restore when copy is finalized.
                          {storeSavings > 0 && (
                            <span className="t-caption text-[var(--brand-gold-dark)] font-semibold">
                              <SavingsLabel amount={storeSavings} locale={isRTL ? 'ar' : 'en'} />
                            </span>
                          )}
                          */}
                        </>
                      ) : (
                        <span className="t-small text-on-surface-variant">
                          {t('products.priceNotAvailable')}
                        </span>
                      )}
                    </div>

                    {/* View at store CTA */}
                    {externalUrl && ps.availability !== 'out_of_stock' ? (
                      <a
                        href={externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          // ADR-286 — Option A: no /go hop for this exit (direct product_url/
                          // affiliate_url), so the interaction record stands alone as evidence.
                          recordFirstPartyInteraction({ goId: null, canonicalId: product?.id ?? null, surface: 'product_detail_sheet' });
                        }}
                      >
                        <Button variant="default" size="sm" className="text-xs gap-1.5 shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t('products.viewAtStore')}
                        </Button>
                      </a>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs shrink-0" disabled>
                        <Package className="h-3.5 w-3.5" />
                        {isRTL ? 'غير متوفر' : 'Unavailable'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Description ── */}
          {description && description.trim().length > 0 && (
            <>
              <hr className="border-[color:var(--color-outline-variant)]" />
              <div className="flex flex-col gap-2">
                <h3 className="t-body-strong text-on-surface">
                  {isRTL ? 'الوصف' : 'Description'}
                </h3>
                <p className="t-small text-on-surface-variant leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              </div>
            </>
          )}

          {/* ── Specifications ── */}
          {hasSpecs && (
            <>
              <hr className="border-[color:var(--color-outline-variant)]" />
              <div className="flex flex-col gap-3">
                <h3 className="t-body-strong text-on-surface">
                  {isRTL ? 'المواصفات' : 'Specifications'}
                </h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {Object.entries(specs!).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="t-small text-on-surface-variant capitalize">{key.replace(/_/g, ' ')}</dt>
                      <dd className="t-small font-medium text-on-surface">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
