'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Heart, BarChart3, ExternalLink, Store, Flame, X } from 'lucide-react';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { cn } from '@/lib/utils';
import type { ProductCategory, AvailabilityStatus } from '@/lib/database/types';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { StoreLogo } from '@/components/ui/store-logo';
import { bestPrice as bestPriceCopy } from '@/lib/copy';
import { applyAffiliateTag } from '@/lib/transactions/affiliate-config';
import { track } from '@/lib/analytics/track';
import { recordFirstPartyInteraction } from '@/lib/analytics/interaction';
import { ProductImageFrame, PRODUCT_PLACEHOLDER_IMAGE } from '@/components/products/shared-product-card';
import { isFreshObservation, hoursSince, observedAgoLabel } from '@/lib/intelligence/evidence-engine';

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
  /**
   * QUALITY PROGRAM P1 §14.1/§14.2 (2026-08-28): when present (TPS-sourced cards via
   * `mapGroupedToProductCard`), gates the "Best Price"/"Hot Deal" badges on freshness
   * (`isFreshObservation`, the SAME `PICK_FRESHNESS_MAX_HOURS=168h` floor §12 already
   * uses for the TPS-layer cheapest claim) and renders a "last observed" label — the
   * storefront-layer twin of the defect §11/§12 fixed. OPTIONAL and backward-compatible:
   * a caller that does not supply it (legacy storefront-layer queries not yet wired to
   * `product_stores.last_checked_at` — tracked as its own follow-up, same as §13) keeps
   * today's unfiltered behavior exactly, never worse than before.
   */
  observed_at?: string | null;
  stores: {
    id: string;
    slug?: string | null;
    name_ar: string;
    name_en: string;
    logo_url: string | null;
    average_rating?: number | null;
    total_reviews?: number | null;
  };
}

/**
 * QUALITY PROGRAM P1 §14.1/§14.2 (2026-08-28): extracted from the component so the
 * freshness-gating logic is directly unit-testable (the same extraction pattern §12
 * already established for `deriveComparisonSummary`/`bestAndWorstFresh`) rather than only
 * verifiable via a full React render. Only stores carrying an `observed_at` at all can be
 * freshness-checked — a caller that supplies none (legacy storefront queries not yet
 * wired to `product_stores.last_checked_at`, tracked as its own follow-up) leaves
 * `anyObservedAt` false and every gate becomes a no-op, so a card with no freshness data
 * behaves EXACTLY as it did before this fix — never worse. The "Best Price"/"Hot Deal"
 * CLAIM may only be backed by fresh evidence when freshness data exists at all (the same
 * "cheapest claim, never the coverage" scoping as §12's TPS-layer fix): falls back to the
 * next fresh-eligible store, or to the raw cheapest when nothing is fresh (still shown,
 * just not crowned — `product_stores` itself is never filtered by this function).
 */
export function selectBestPriceStore(stores: ProductStore[]): {
  bestPrice: ProductStore | undefined;
  hasDeal: boolean;
  storesWithPrices: ProductStore[];
} {
  const anyObservedAt = stores.some((ps) => ps.observed_at != null);
  const isFreshStore = (ps: ProductStore) => !anyObservedAt || isFreshObservation(ps.observed_at);

  const storesWithPrices = stores
    .filter((ps) => ps.availability !== 'out_of_stock')
    .sort((a, b) => a.current_price - b.current_price);

  const freshStoresWithPrices = storesWithPrices.filter(isFreshStore);
  const bestPrice = freshStoresWithPrices[0] ?? storesWithPrices[0];
  const hasDeal = stores.some((ps) => ps.original_price && ps.original_price > ps.current_price && isFreshStore(ps));

  return { bestPrice, hasDeal, storesWithPrices };
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
    // TPS Enrichment
    tps_compare_url?: string | null;
    tps_identity_key?: string | null;
    has_tps_comparison?: boolean;
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
  onCardClick,
  showActions = true,
}: ProductCardProps) {
  const t = useTranslations();

  const params = useParams();
  const currentLocale = locale || (params?.locale as string) || 'ar';

  const productName = currentLocale === 'ar' ? product.name_ar : product.name_en;
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const isMultiStore = product.product_stores.length > 1;
  const isDbProduct = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id);

  const primaryStore = product.product_stores[0]?.stores;
  const primaryStoreSlug = primaryStore?.slug || primaryStore?.id || null;
  const rawExternalUrl = !isMultiStore
    ? (product.product_stores[0]?.product_url || product.product_stores[0]?.affiliate_url)
    : null;
  const externalProductUrl = rawExternalUrl
    ? (applyAffiliateTag(rawExternalUrl, primaryStoreSlug) ?? rawExternalUrl)
    : null;
  const isExternalLink = externalProductUrl && (externalProductUrl.startsWith('http://') || externalProductUrl.startsWith('https://'));

  // TPS أولاً، ثم رابط المتجر مباشرة، وأخيراً صفحات العالم القديم
  const productLink = product.tps_compare_url
    ? product.tps_compare_url
    : (externalProductUrl || `/${currentLocale}/products/${product.slug}`);

  const availableImages = product.image_urls?.filter(Boolean) || [];

  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
    setCurrentImageIndex(0);
  }, [product.id]);

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

  const { bestPrice, hasDeal, storesWithPrices } = selectBestPriceStore(product.product_stores);
  const bestPriceValue = bestPrice?.current_price || 0;
  const originalPrice = bestPrice?.original_price || null;
  const storeCount = product.product_stores.length;
  const isOutOfStock = product.product_stores.every((ps) => ps.availability === 'out_of_stock');
  const bestPriceAgeHours = hoursSince(bestPrice?.observed_at ?? null);

  const currentImageUrl = availableImages[currentImageIndex] || null;
  const imageSrc = imageError || !currentImageUrl ? PRODUCT_PLACEHOLDER_IMAGE : currentImageUrl;

  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const handleEnsureAndNavigate = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (navigating) return;
    // TPS أو المتجر مباشرة — لا نمر بمسار ensure القديم إلا اضطراراً
    if (product.tps_compare_url) { router.push(product.tps_compare_url); return; }
    if (externalProductUrl) {
      // ADR-244: this retailer exit was unmeasured (no event, no ledger row).
      track('go_click', { canonical_id: product.id, store: String(primaryStoreSlug ?? ''), category: product.category ?? null, source: 'search_card', meta: { measured: false } });
      // ADR-286 — Option A (direct navigation + explicit interaction evidence only): this
      // exit bypasses /go entirely (no product_stores row to route through), so there is no
      // server-confirmed-navigation ledger row to correlate against — the interaction record
      // itself is the evidence here, standing alone.
      recordFirstPartyInteraction({ goId: null, canonicalId: product.id, surface: 'search_card' });
      window.open(externalProductUrl, '_blank', 'noopener');
      return;
    }
    setNavigating(true);
    try {
      const res = await fetch('/api/products/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_en: product.name_en,
          name_ar: product.name_ar,
          slug: product.slug,
          category: product.category,
          brand: product.brand,
          model: product.model,
          image_urls: product.image_urls,
          product_stores: (product.product_stores || []).map((ps) => ({
            store_slug: ps.stores?.id,
            current_price: ps.current_price,
            original_price: ps.original_price,
            product_url: ps.product_url,
            availability: ps.availability,
            is_deal: ps.is_deal,
            is_free_delivery: ps.is_free_delivery,
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      const dbSlug = json?.product?.slug || product.slug;
      router.push(`/${currentLocale}/products/${dbSlug}`);
    } catch {
      router.push(productLink);
    } finally {
      setNavigating(false);
    }
  };

  // A card with NO destination: no TPS comparison, and no retailer exit because the offer's
  // observation id is missing. Such a card must not look clickable — a result list is a list of
  // actions, and a card that cannot complete the journey is a dead end disguised as a choice.
  //
  // WHY NOT OMIT IT (founder decision 2026-07-31, on the measurement). Omission was approved
  // only if the rate stayed near the then-known 1.6–4%. It does in aggregate — 17/914 AR
  // (1.86%), 28/837 EN (3.35%) across 40 queries — but it CONCENTRATES: the English query
  // "air conditioner" returns 14 cards of which 13 are unroutable, so omitting would render
  // ONE result where fourteen exist. At catalogue level 2,321 of 7,162 canonicals with prices
  // (32.4%) are fully unroutable. Silently dropping them shrinks the visible catalogue.
  //
  // So: keep the card, remove the navigation, say plainly what we hold. The price and retailer
  // are real and observed; only the destination is missing. The result count then still matches
  // what renders, which is the inconsistency that omission would have created.
  const hasDestination = Boolean(product.tps_compare_url) || Boolean(externalProductUrl);

  // eslint-disable-next-line react-hooks/static-components -- closes over product, isDbProduct,
  // productLink, handleEnsureAndNavigate, navigating and onCardClick; hoisting to module scope
  // would require threading all of these through as props, a disproportionate refactor for this
  // upgrade. No remount-identity risk in practice: `product`/`onCardClick` are stable per render
  // pass and this wrapper only ever wraps its own card's children.
  const LinkWrapper = ({ children }: { children: React.ReactNode }) =>
    !hasDestination && !onCardClick ? (
      <div className="flex flex-col h-full">{children}</div>
    ) : onCardClick ? (
      <button
        type="button"
        onClick={() => onCardClick(product)}
        className="flex flex-col h-full w-full text-start"
      >
        {children}
      </button>
    ) : isDbProduct ? (
      productLink.startsWith('http') ? (
        <a
          href={productLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col h-full"
          onClick={() => {
            // ADR-244: previously a completely unmeasured retailer exit. No
            // product_stores ledger row exists for scraped externals, so the
            // affiliate-tagged direct link stays; the event is the measurement.
            track('go_click', { canonical_id: product.id, store: String(primaryStoreSlug ?? ''), category: product.category ?? null, source: 'search_card', meta: { measured: false } });
            // ADR-286 — Option A: no /go hop exists for this exit; the interaction record
            // stands alone as evidence (no server-confirmed-navigation row to join against).
            recordFirstPartyInteraction({ goId: null, canonicalId: product.id, surface: 'search_card' });
          }}
        >
          {children}
        </a>
      ) : (
        <Link href={productLink} className="flex flex-col h-full">
          {children}
        </Link>
      )
    ) : (
      <button
        type="button"
        onClick={handleEnsureAndNavigate}
        disabled={navigating}
        className="flex flex-col h-full w-full text-start disabled:opacity-80"
      >
        {children}
      </button>
    );

  const storeInitials = product.product_stores
    .filter(ps => ps.stores)
    .map(ps => ({
      id: ps.stores.id,
      slug: ps.stores.slug ?? ps.stores.id,
      initial: (currentLocale === 'ar' ? ps.stores.name_ar : ps.stores.name_en || '?').charAt(0).toUpperCase(),
      name: currentLocale === 'ar' ? ps.stores.name_ar : ps.stores.name_en,
      rating: ps.stores.average_rating ?? null,
    }))
    .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);

  const isWinner = isMultiStore && bestPrice && storesWithPrices.length > 1;

  // The store whose price the card actually shows. A multi-store card used to render only
  // two-letter avatar stubs ("اك" "أم" "جر"), so "من 840" named no store at all.
  const bestPriceStore = bestPrice?.stores;
  const bestPriceStoreName = (currentLocale === 'ar' ? bestPriceStore?.name_ar : bestPriceStore?.name_en)
    || bestPriceStore?.name_ar || bestPriceStore?.name_en || null;

  return (
    <Card
      // ADR-136 — the card's claim, machine-readable. The UI-journey harness used to infer the
      // store count with a regex over collapsed page text and read the Smart Pick's PRICE as a
      // store count ("card claims 900 stores"). A claim that is measured must be published by
      // the surface that makes it, not guessed by the instrument.
      data-testid="product-card"
      data-store-count={storeCount}
      data-best-price={bestPriceValue}
      data-compare-url={product.tps_compare_url ?? ''}
      className={cn(
        'group relative transition-all duration-[var(--dur-med)] h-full flex flex-col overflow-hidden hover:border-[var(--brand-green)]/50',
        isInCompare &&
          'border-[var(--brand-green)] ring-2 ring-[var(--brand-green)]/30',
      )}
    >
      {/* P2-7 (2.4.3 / 4.1.2). The card's action buttons are rendered BEFORE its link in
          the DOM — deliberately, so they do not intercept the card click — so keyboard
          focus reaches "Save to Wishlist" before the product is ever announced. In a
          20-card grid that is 20 identically-named buttons with no way to tell them
          apart. Naming each one with its product removes the ambiguity WITHOUT reordering
          the DOM and reintroducing the interception bug the layout exists to avoid.
          The DOM order itself is recorded as deferred, not changed under this ticket. */}
      {showActions && onSave && (
        <div className="absolute end-2 top-2 z-10">
          <IconButton
            variant={isSaved ? 'accent' : 'tonal'}
            size="sm"
            aria-label={`${t('product.saveToWishlist')}: ${productName}`}
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

      {/* eslint-disable-next-line react-hooks/static-components -- see justification above LinkWrapper's definition */}
      <LinkWrapper>
        <div className="relative w-full aspect-square overflow-hidden rounded-t-[var(--radius-lg)] bg-[color:var(--color-surface-container-low)]">
          <ProductImageFrame
            src={imageSrc}
            alt={productName}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
            className="h-full w-full rounded-none bg-transparent"
            imageClassName={`p-3 group-hover:scale-105 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onImageError={handleImageError}
            onImageLoad={handleImageLoad}
            loadingOverlay={imageLoading && !imageError}
            unoptimized={isExternalLink || imageSrc.includes('jarir.com')}
            priority={false}
          />

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
          <div className="flex-1 mb-3">
            <h3
              dir="auto"
              title={productName}
              className="t-body-strong text-on-surface mb-1 leading-tight"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                wordBreak: 'break-word',
                minHeight: 'calc(1.4em * 2)',
              }}
            >
              {productName}
            </h3>
            {(product.brand || product.model) && (
              <p className="t-small text-on-surface-variant mb-3 line-clamp-1">
                {[product.brand, product.model].filter(Boolean).join(' · ')}
              </p>
            )}

            <div className="flex items-end justify-between gap-2 mb-1">
              <div className="min-w-0 flex-1">
                {bestPriceValue > 0 ? (
                  <div className="flex flex-col gap-1">
                    {isMultiStore && (
                      <span className="t-caption text-[var(--brand-green-dark)]">
                        {/* Name the store the price belongs to. "من 840" alone tells the
                            customer nothing about WHERE 840 is. */}
                        {bestPriceStoreName
                          ? `${t('products.from')} ${bestPriceStoreName}`
                          : t('products.from')}
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
                    {/* QUALITY PROGRAM P1 §14.1 (2026-08-28): the search-results grid showed
                        freshness on exactly one card (the Smart Pick) — every other card had
                        zero temporal context even though the data existed upstream. Never
                        invented (ADR-193): a card with no `observed_at` (storefront-layer,
                        not yet wired) renders no line, same as before this fix. */}
                    {bestPriceAgeHours != null && (
                      <span className="t-caption text-on-surface-variant/80">
                        {observedAgoLabel(bestPriceAgeHours, currentLocale as 'ar' | 'en')}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="t-small text-on-surface-variant">
                    {t('products.priceNotAvailable')}
                  </p>
                )}
              </div>

              {isMultiStore ? (
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex -space-x-1 rtl:space-x-reverse">
                    {storeInitials.map((s) => {
                      const showStar = typeof s.rating === 'number' && s.rating >= 4;
                      const ratingTitle = showStar
                        ? currentLocale === 'ar'
                          ? `${s.name} · تقييم ${s.rating!.toFixed(1)}`
                          : `${s.name} · ${s.rating!.toFixed(1)}★ rating`
                        : s.name;
                      return (
                        <span key={s.id} className="relative inline-flex" title={ratingTitle}>
                          <StoreLogo
                            slug={s.slug}
                            size="xs"
                            alt={ratingTitle}
                            locale={currentLocale as 'ar' | 'en'}
                            className="border-2 border-[color:var(--color-surface)] bg-[color:var(--color-surface)]"
                          />
                          {showStar && (
                            <span
                              aria-hidden="true"
                              className="absolute -top-1 -end-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[8px] text-[var(--brand-dark-text)] shadow-[var(--elevation-1)]"
                            >
                              ★
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                storeCount > 0 && (() => {
                  const firstStore = product.product_stores[0]?.stores;
                  const storeId = firstStore?.id || '';
                  const storeSlug = firstStore?.slug ?? storeId;
                  const storeName = currentLocale === 'ar'
                    ? firstStore?.name_ar
                    : firstStore?.name_en;
                  const rating = firstStore?.average_rating ?? null;
                  const showStar = typeof rating === 'number' && rating >= 4;
                  const ratingTitle = showStar
                    ? currentLocale === 'ar'
                      ? `${storeName || storeSlug} · تقييم ${rating!.toFixed(1)}`
                      : `${storeName || storeSlug} · ${rating!.toFixed(1)}★ rating`
                    : (storeName || storeSlug);
                  return (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="relative inline-flex" title={ratingTitle}>
                        <StoreLogo
                          slug={storeSlug}
                          size="xs"
                          alt={storeName || storeSlug}
                          locale={currentLocale as 'ar' | 'en'}
                        />
                        {showStar && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1 -end-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-[var(--brand-gold)] text-[8px] text-[var(--brand-dark-text)] shadow-[var(--elevation-1)]"
                          >
                            ★
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {storeName}
                      </span>
                    </div>
                  );
                })()
              )}
            </div>

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
        <div className="px-4 pb-4 pt-0 flex flex-col gap-2">

          {/* TPS Compare Button */}
          {product.tps_compare_url && (
            <Link
              href={product.tps_compare_url}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] text-[11px] font-bold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]"
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              {currentLocale === 'ar' ? 'قارن الأسعار' : 'Compare Prices'}
            </Link>
          )}

          {/* Primary CTA */}
          {externalProductUrl ? (
            <Button variant="default" size="sm" className="w-full text-xs" asChild>
              <a href={externalProductUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('products.viewAtStore')}</span>
              </a>
            </Button>
          ) : (
            /* No destination for this offer. A disabled "View at store" button states nothing
               and is the disabled-control pattern REDESIGN_BRIEF §7.3 rules out; it also reads
               as a temporary outage rather than what is true. Say what we actually hold: the
               price and the retailer are observed, the link is not available. Same wording the
               compare page already ships (compare/[key]/page.tsx:254), so the two surfaces
               explain the same gap the same way. */
            <p className="w-full rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container)] px-3 py-2 text-center text-[11px] font-medium leading-snug text-on-surface-variant">
              {currentLocale === 'ar'
                ? 'رابط المتجر غير متاح لهذا العرض'
                : 'No store link available for this offer'}
            </p>
          )}

          {onCompare && (
            <button
              type="button"
              onClick={() => onCompare(product.id)}
              aria-label={
                isInCompare
                  ? `${currentLocale === 'ar' ? 'إزالة من المقارنة' : 'Remove from compare'}: ${productName}`
                  : `${t('product.addToCompare')}: ${productName}`
              }
              aria-pressed={isInCompare}
              className={cn(
                'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border-2 text-[11px] font-semibold transition-colors',
                isInCompare
                  ? 'border-red-300 bg-red-50 text-red-600 hover:border-red-400 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50'
                  : 'border-[color:var(--brand-green)] bg-transparent text-[var(--brand-green-dark)] shadow-[inset_0_0_0_1px_var(--brand-green)] hover:bg-[var(--brand-bg-green)]',
              )}
            >
              {isInCompare
                ? <X className="h-3.5 w-3.5 shrink-0" />
                : <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              }
              <span className="truncate">
                {isInCompare
                  ? currentLocale === 'ar' ? 'إزالة من المقارنة' : 'Remove from compare'
                  : currentLocale === 'ar' ? 'إضافة للمقارنة' : 'Add to compare'}
              </span>
            </button>
          )}
        </div>
      )}
    </Card>
  );
}