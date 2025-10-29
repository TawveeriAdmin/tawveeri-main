'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Truck, ShieldCheck } from 'lucide-react';
import { useLocale } from 'next-intl';
import { formatPrice, calculateSavings } from '@/lib/utils';

interface ComparisonCardProps {
  storeName: string;
  currentPrice: number;
  originalPrice?: number;
  isBestPrice?: boolean;
  isHotDeal?: boolean;
  isFeatured?: boolean;
  rating?: number;
  delivery?: string;
  warranty?: string;
  onViewStore: () => void;
}

export function ComparisonCard({
  storeName,
  currentPrice,
  originalPrice,
  isBestPrice = false,
  isHotDeal = false,
  isFeatured = false,
  rating,
  delivery,
  warranty,
  onViewStore,
}: ComparisonCardProps) {
  const { locale, t } = useLocale();
  const savings = originalPrice ? calculateSavings(originalPrice, currentPrice) : 0;

  return (
    <Card
      className={`${
        isBestPrice
          ? 'border-2 border-success-600 bg-gradient-to-b from-success-50 to-white dark:from-success-950 dark:to-gray-900'
          : ''
      }`}
    >
      <CardHeader>
        <div className="flex flex-col gap-3">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {isBestPrice && (
              <Badge variant="success">
                ✓ {t('price.best')}
              </Badge>
            )}
            {isHotDeal && (
              <Badge variant="warning">
                🔥 {locale === 'ar' ? 'عرض ساخن' : 'Hot Deal'}
              </Badge>
            )}
            {isFeatured && (
              <Badge variant="featured">
                ⭐ {locale === 'ar' ? 'مميز' : 'Featured'}
              </Badge>
            )}
          </div>

          {/* Store Name & Rating */}
          <div className="flex items-start justify-between">
            <CardTitle>{storeName}</CardTitle>
            {rating && (
              <div className="flex items-center gap-1 text-featured-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-semibold">{rating}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price Display */}
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-extrabold tabular-nums">
            {currentPrice.toLocaleString('en-US')}
          </span>
          <div className="flex flex-col">
            <span className="text-sm text-gray-500">{t('price.sar')}</span>
            {originalPrice && (
              <span className="text-lg text-gray-400 line-through tabular-nums">
                {originalPrice.toLocaleString('en-US')}
              </span>
            )}
          </div>
        </div>

        {/* Savings Badge */}
        {savings > 0 && (
          <Badge variant="success-light">
            💰 {t('price.save')} {savings.toLocaleString('en-US')} {t('price.sar')}
          </Badge>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
          {delivery && (
            <div className="flex items-center gap-1">
              <Truck className="w-4 h-4" />
              <span>{delivery}</span>
            </div>
          )}
          {warranty && (
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{warranty}</span>
            </div>
          )}
        </div>

        {/* CTA Button */}
        <Button onClick={onViewStore} size="lg" className="w-full">
          {t('button.view')} {locale === 'ar' ? '←' : '→'}
        </Button>
      </CardContent>
    </Card>
  );
}
