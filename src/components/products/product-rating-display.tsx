'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductRatingDisplayProps {
  rating: number;
  totalReviews: number;
  showBreakdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProductRatingDisplay({
  rating,
  totalReviews,
  showBreakdown = false,
  size = 'md',
}: ProductRatingDisplayProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star
            key={i}
            className={cn('fill-primary text-primary', sizeClasses[size])}
          />
        ))}
        {hasHalfStar && (
          <div className="relative">
            <Star
              className={cn('text-outline', sizeClasses[size])}
            />
            <Star
              className={cn(
                'absolute inset-0 fill-primary text-primary overflow-hidden',
                sizeClasses[size]
              )}
              style={{ clipPath: 'inset(0 50% 0 0)' }}
            />
          </div>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star
            key={i}
            className={cn('text-outline', sizeClasses[size])}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className={cn('font-semibold text-on-surface', size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base')}>
          {rating.toFixed(1)}
        </span>
        <span className={cn('text-on-surface-variant', size === 'sm' ? 'text-xs' : 'text-sm')}>
          ({totalReviews})
        </span>
      </div>
    </div>
  );
}

