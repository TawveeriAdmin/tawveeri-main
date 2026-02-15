'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Star, ShieldCheck } from 'lucide-react';

export interface StoreReview {
  id: string;
  rating: number;
  review_text: string | null;
  delivery_rating: number | null;
  product_quality_rating: number | null;
  customer_service_rating: number | null;
  is_verified_purchase: boolean;
  created_at: string;
  users: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface StoreReviewCardProps {
  review: StoreReview;
  locale: string;
}

export function StoreReviewCard({ review, locale }: StoreReviewCardProps) {
  const t = useTranslations();

  const formattedDate = useMemo(() => {
    try {
      return new Date(review.created_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return review.created_at;
    }
  }, [review.created_at, locale]);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-warning-500">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`w-4 h-4 ${index < review.rating ? 'fill-featured-400 text-featured-400' : 'text-gray-300 dark:text-gray-600'}`}
              />
            ))}
          </div>
          {review.is_verified_purchase && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {t('store.verifiedPurchase')}
            </Badge>
          )}
        </div>

        {review.review_text && (
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{review.review_text}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-400">
          {(review.delivery_rating || review.delivery_rating === 0) && (
            <div>
              <span className="font-medium block">{t('store.deliveryRating')}</span>
              <span>{review.delivery_rating}/5</span>
            </div>
          )}
          {(review.product_quality_rating || review.product_quality_rating === 0) && (
            <div>
              <span className="font-medium block">{t('store.productQualityRating')}</span>
              <span>{review.product_quality_rating}/5</span>
            </div>
          )}
          {(review.customer_service_rating || review.customer_service_rating === 0) && (
            <div>
              <span className="font-medium block">{t('store.customerServiceRating')}</span>
              <span>{review.customer_service_rating}/5</span>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {review.users?.full_name || t('store.anonymousUser')}
          <span className="mx-2">•</span>
          {formattedDate}
        </div>
      </CardContent>
    </Card>
  );
}


