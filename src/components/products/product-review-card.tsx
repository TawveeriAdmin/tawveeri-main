'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ThumbsUp, Edit, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatting';
import { useTranslations } from '@/lib/simple-intl-provider';
import type { ProductReview } from '@/lib/database/types';
import { useAuth } from '@/lib/auth/auth-context';

interface ProductReviewCardProps {
  review: ProductReview & {
    users?: {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    };
  };
  onHelpful?: (reviewId: string) => void;
  onEdit?: (review: ProductReview) => void;
  onDelete?: (reviewId: string) => void;
  locale: string;
}

export function ProductReviewCard({
  review,
  onHelpful,
  onEdit,
  onDelete,
  locale,
}: ProductReviewCardProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const [helpfulClicked, setHelpfulClicked] = useState(false);
  const isRTL = locale === 'ar';
  const isOwner = user?.id === review.user_id;

  const userInitials = review.users?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleHelpful = () => {
    if (!helpfulClicked && onHelpful) {
      setHelpfulClicked(true);
      onHelpful(review.id);
    }
  };

  return (
    <div className="border-b border-outline-variant pb-4 last:border-0">
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={review.users?.avatar_url || ''} alt={review.users?.full_name || ''} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-on-surface">
                  {review.users?.full_name || t('products.review.user')}
                </p>
                {review.is_verified_purchase && (
                  <Badge variant="success-light" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-xs">{t('products.review.verifiedPurchase')}</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < review.rating
                          ? 'fill-primary text-primary'
                          : 'text-outline'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-on-surface-variant">
                  {formatDate(review.created_at, locale)}
                </span>
              </div>
            </div>

            {/* Actions */}
            {isOwner && (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(review)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(review.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Review Text */}
          {review.review_text && (
            <p className="text-on-surface-variant whitespace-pre-wrap">
              {review.review_text}
            </p>
          )}

          {/* Helpful Button */}
          {onHelpful && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleHelpful}
                disabled={helpfulClicked}
                className="h-8 text-sm"
              >
                <ThumbsUp className="h-4 w-4 mr-1" />
                {t('products.review.helpful')}
                {review.helpful_count > 0 && (
                  <span className="ml-1">({review.helpful_count})</span>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

