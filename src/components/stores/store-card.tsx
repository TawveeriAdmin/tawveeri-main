'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { getSearchStoreLogoPath, getStoreInitials } from '@/lib/logos';

interface StoreCardProps {
  store: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    logo_url: string | null;
    website_url: string | null;
    average_rating: number | null;
    total_reviews: number | null;
    total_products: number | null;
    is_featured: boolean;
    is_premium: boolean;
  };
  locale: string;
}

export function StoreCard({ store, locale }: StoreCardProps) {
  const t = useTranslations();
  const params = useParams();
  const currentLocale = locale || (params?.locale as string) || 'ar';

  const storeName = currentLocale === 'ar' ? store.name_ar : store.name_en;
  // Preferred logo chain: DB-managed URL (e.g. remote CDN) → local
  // /logos/{slug}.png → brand-tinted initials. Many DB rows currently have
  // no logo_url, so the local bundled PNGs in public/logos/ carry the day.
  const localLogoPath = store.slug ? getSearchStoreLogoPath(store.slug) : null;
  const [logoSrc, setLogoSrc] = useState<string | null>(
    store.logo_url || localLogoPath,
  );
  const [triedLocalFallback, setTriedLocalFallback] = useState(false);
  const handleLogoError = () => {
    if (!triedLocalFallback && store.logo_url && localLogoPath) {
      setLogoSrc(localLogoPath);
      setTriedLocalFallback(true);
      return;
    }
    setLogoSrc(null);
  };

  return (
    <Card className="group transition-all duration-300 h-full flex flex-col hover:elevation-2">
      <CardContent className="p-6 flex flex-col h-full">
        {/* Store Logo */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-white dark:bg-gray-50 border-2 border-outline-variant group-hover:border-primary transition-colors">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={storeName}
                className="w-full h-full object-contain p-3"
                onError={handleLogoError}
              />
            ) : getStoreInitials(store.slug || storeName) ? (
              <span
                aria-label={storeName}
                role="img"
                className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--brand-green-dark)] bg-[var(--brand-bg-green)]"
              >
                {getStoreInitials(store.slug || storeName)}
              </span>
            ) : (
              // No Latin initials to abbreviate — a plain tinted tile, with the store's name
              // carrying the identification directly below it.
              <span aria-hidden className="block h-full w-full bg-[var(--brand-bg-green)]" />
            )}
          </div>
        </div>

        {/* Store Name */}
        <h3 className="text-title-lg font-semibold text-on-surface mb-2 text-center group-hover:text-primary transition-colors">
          {storeName}
        </h3>

        {/* Badges */}
        <div className="flex justify-center gap-2 mb-4">
          {store.is_featured && (
            <Badge variant="warning" className="text-xs">
              {currentLocale === 'ar' ? 'مميز' : 'Featured'}
            </Badge>
          )}
          {store.is_premium && (
            <Badge variant="success" className="text-xs">
              {currentLocale === 'ar' ? 'مميز' : 'Premium'}
            </Badge>
          )}
        </div>

        {/* Rating */}
        {store.average_rating !== null && (
          <div className="flex items-center justify-center gap-1 mb-2">
            <Star className="w-4 h-4 fill-primary text-primary" />
            <span className="text-sm font-semibold text-on-surface">
              {store.average_rating.toFixed(1)}
            </span>
            {store.total_reviews !== null && store.total_reviews > 0 && (
              <span className="text-xs text-on-surface-variant">
                ({store.total_reviews})
              </span>
            )}
          </div>
        )}

        {/* Products Count */}
        {store.total_products !== null && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm text-on-surface-variant">
            <Package className="w-4 h-4" />
            <span>
              {store.total_products} {t('stores.productsCount')}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto">
          <Button asChild variant="default" className="w-full">
            <Link href={`/${currentLocale}/stores/${store.slug}`}>
              {t('stores.viewStore')}
            </Link>
          </Button>
          {store.website_url && (
            <Button asChild variant="outline" className="w-full" size="sm">
              <a href={store.website_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 me-2" />
                {t('stores.visitWebsite')}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

