'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';

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
  const logoUrl = store.logo_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5TdG9yZTwvdGV4dD48L3N2Zz4=';

  return (
    <Card className="group transition-all duration-300 h-full flex flex-col hover:elevation-2">
      <CardContent className="p-6 flex flex-col h-full">
        {/* Store Logo */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-surface-container-highest border-2 border-outline-variant group-hover:border-primary transition-colors">
            <img
              src={logoUrl}
              alt={storeName}
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5TdG9yZTwvdGV4dD48L3N2Zz4=') {
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjOTk5Ij5TdG9yZTwvdGV4dD48L3N2Zz4=';
                }
              }}
            />
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
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('stores.visitWebsite')}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

