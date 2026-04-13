'use client';

import { ExternalLink, X, Truck, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { CouponBadge } from '@/components/ui/coupon-badge';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { ProductCardProduct } from '@/components/products/product-card';

const STORE_LOGOS: Record<string, string> = {
  amazon: '/logos/amazon.png',
  noon: '/logos/noon.png',
  jarir: '/logos/jarir.png',
  extra: '/logos/extra.png',
  almanea: '/logos/almanea.png',
  samsung_ksa: '/logos/samsung_ksa.png',
  shaker: '/logos/shaker.png',
  zagzoog: '/logos/zagzoog.png',
  alesayi: '/logos/alesayi.png',
  swsg: '/logos/swsg.png',
  alkhunaizan: '/logos/alkhunaizan.png',
  bukhamsen: '/logos/bukhamsen.png',
  alghanim: '/logos/alghanim.png',
  alsaif_gallery: '/logos/alsaif_gallery.png',
  lulu_gcc: '/logos/lulu_gcc.png',
};

interface StoreComparisonPanelProps {
  product: ProductCardProduct;
  locale: string;
  onClose: () => void;
}

export function StoreComparisonPanel({ product, locale, onClose }: StoreComparisonPanelProps) {
  const t = useTranslations();

  // Sort stores by price (cheapest first)
  const sortedStores = [...product.product_stores]
    .filter(ps => ps.current_price > 0)
    .sort((a, b) => a.current_price - b.current_price);

  const bestPriceValue = sortedStores[0]?.current_price || 0;
  const productName = locale === 'ar' ? product.name_ar : product.name_en;

  return (
    <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-300 truncate">
            {productName}
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-primary-100 dark:hover:bg-primary-800/50 transition-colors shrink-0"
        >
          <X className="w-4 h-4 text-primary-500" />
        </button>
      </div>

      {/* Store rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {sortedStores.map((ps) => {
          const storeName = locale === 'ar' ? ps.stores.name_ar : ps.stores.name_en;
          const storeInitial = storeName.charAt(0).toUpperCase();
          const isBestPrice = ps.current_price === bestPriceValue;
          const storeUrl = ps.product_url || ps.affiliate_url;
          return (
            <div
              key={ps.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                isBestPrice && 'bg-success-50/50 dark:bg-success-900/10'
              )}
            >
              {/* Store logo */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white dark:bg-gray-800 shrink-0 flex items-center justify-center">
                {STORE_LOGOS[ps.stores.id] ? (
                  <img src={STORE_LOGOS[ps.stores.id]} alt={storeName} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs font-bold text-gray-500">{storeInitial}</span>
                )}
              </div>

              {/* Store info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-on-surface truncate">
                    {storeName}
                  </span>
                  {isBestPrice && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">
                      {t('products.bestPriceLabel')}
                    </Badge>
                  )}
                </div>

                {/* Delivery + deal info */}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {ps.is_free_delivery && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-success-600 dark:text-success-400">
                      <Truck className="w-3 h-3" />
                      {t('search.freeDelivery')}
                    </span>
                  )}
                  {ps.delivery_time_days && (
                    <span className="text-[11px] text-on-surface-variant">
                      {ps.delivery_time_days}d
                    </span>
                  )}
                  {ps.coupon_code && (
                    <CouponBadge
                      coupon={{ code: ps.coupon_code }}
                      variant="compact"
                      locale={locale}
                    />
                  )}
                </div>
              </div>

              {/* Price + action */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-end">
                  <Price
                    amount={ps.current_price}
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      isBestPrice ? 'text-success-600 dark:text-success-400' : 'text-on-surface'
                    )}
                    symbolClassName="w-4 h-4"
                  />
                  {ps.original_price && ps.original_price > ps.current_price && (
                    <Price
                      amount={ps.original_price}
                      className="text-[11px] text-outline line-through tabular-nums"
                      symbolClassName="w-3 h-3"
                    />
                  )}
                </div>

                {storeUrl && (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-8"
                    >
                      {t('products.viewAtStore')}
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
