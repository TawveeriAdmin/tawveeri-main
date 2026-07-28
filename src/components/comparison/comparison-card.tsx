'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriceDisplay, Price } from '@/components/ui/price';
import { Check, Flame, Star, Truck, ShieldCheck, PiggyBank } from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useParams } from 'next/navigation';
import { calculateSavings } from '@/lib/utils';

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
  locale?: string;
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
  locale: propLocale,
}: ComparisonCardProps) {
  const t = useTranslations();
  const params = useParams();
  const locale = propLocale || (params?.locale as string) || 'ar';
  // ADR-129 SAVINGS_GATE (default on): show a savings figure ONLY where we observed the drop.
  // The merchant "was" (originalPrice) is not a drop we verified → suppress unless gate is off.
  const savingsGateOn = process.env.NEXT_PUBLIC_SAVINGS_GATE !== 'off';
  const savings = (!savingsGateOn && originalPrice) ? calculateSavings(originalPrice, currentPrice) : 0;

  return (
    <Card
      className={`${
        isBestPrice
          ? 'border-2 border-success bg-gradient-to-b from-success-container to-surface-container-lowest'
          : ''
      }`}
    >
      <CardHeader>
        <div className="flex flex-col gap-3">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {isBestPrice && (
              <Badge variant="success">
                <Check className="w-3 h-3" /> {t('price.best')}
              </Badge>
            )}
            {isHotDeal && (
              <Badge variant="warning">
                <Flame className="w-3 h-3" /> {locale === 'ar' ? 'عرض ساخن' : 'Hot Deal'}
              </Badge>
            )}
            {isFeatured && (
              <Badge variant="featured">
                <Star className="w-3 h-3 fill-current" /> {locale === 'ar' ? 'مميز' : 'Featured'}
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
        <PriceDisplay
          currentPrice={currentPrice}
          originalPrice={originalPrice}
        />

        {/* Savings Badge */}
        {savings > 0 && (
          <Badge variant="success-light">
            <PiggyBank className="w-3 h-3" /> {t('price.save')} <Price amount={savings} className="text-sm font-semibold" symbolClassName="w-3 h-3" />
          </Badge>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-sm text-on-surface-variant">
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
