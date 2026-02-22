'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Copy, Check, Ticket, Clock } from 'lucide-react';
import type { DiscountType } from '@/lib/database/types';

interface CouponData {
  id?: string;
  code: string;
  description_ar?: string | null;
  description_en?: string | null;
  discount_type?: DiscountType;
  discount_value?: number;
  min_purchase?: number | null;
  max_discount?: number | null;
  expires_at?: string | null;
  store_name_ar?: string;
  store_name_en?: string;
}

interface CouponBadgeProps {
  coupon: CouponData;
  variant?: 'compact' | 'expanded';
  locale: string;
  onCopy?: (couponId: string) => void;
}

function getDiscountLabel(
  coupon: CouponData,
  locale: string,
  t: (key: string, params?: Record<string, string>) => string
): string {
  if (!coupon.discount_type) return '';
  switch (coupon.discount_type) {
    case 'percentage':
      return t('coupons.discountPercentage', { value: String(coupon.discount_value ?? 0) });
    case 'fixed_amount':
      return t('coupons.discountFixed', { value: String(coupon.discount_value ?? 0) });
    case 'free_shipping':
      return t('coupons.freeShipping');
    default:
      return '';
  }
}

function getExpiryInfo(
  expiresAt: string | null | undefined,
  t: (key: string, params?: Record<string, string>) => string
): { label: string; isExpired: boolean; isUrgent: boolean } {
  if (!expiresAt) {
    return { label: t('coupons.noExpiry'), isExpired: false, isUrgent: false };
  }

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { label: t('coupons.expired'), isExpired: true, isUrgent: false };
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffDays <= 1) {
    return {
      label: t('coupons.expiresInHours', { hours: String(diffHours) }),
      isExpired: false,
      isUrgent: true,
    };
  }

  return {
    label: t('coupons.expiresIn', { days: String(diffDays) }),
    isExpired: false,
    isUrgent: diffDays <= 3,
  };
}

export function CouponBadge({ coupon, variant = 'compact', locale, onCopy }: CouponBadgeProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast({
        title: t('coupons.copied'),
        duration: 2000,
      });

      // Track copy via API (non-blocking)
      if (coupon.id) {
        fetch(`/api/coupons/${coupon.id}/copy`, { method: 'POST' }).catch(() => {});
      }

      onCopy?.(coupon.id ?? '');

      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = coupon.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast({ title: t('coupons.copied'), duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const discountLabel = getDiscountLabel(coupon, locale, t);
  const description =
    locale === 'ar' ? coupon.description_ar : coupon.description_en;

  if (variant === 'compact') {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleCopy();
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-tertiary-500/50 bg-tertiary-50 px-2 py-1 text-xs transition-colors hover:bg-tertiary-100 dark:bg-tertiary-950/30 dark:hover:bg-tertiary-900/40"
      >
        <Ticket className="h-3 w-3 text-tertiary-600 dark:text-tertiary-400" />
        <span className="font-mono font-semibold text-tertiary-700 dark:text-tertiary-300">
          {coupon.code}
        </span>
        {discountLabel && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 border-tertiary-300 text-tertiary-600 dark:border-tertiary-600 dark:text-tertiary-400">
            {discountLabel}
          </Badge>
        )}
        {copied ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <Copy className="h-3 w-3 text-on-surface-variant" />
        )}
      </button>
    );
  }

  // Expanded variant
  const expiryInfo = getExpiryInfo(coupon.expires_at, t);

  return (
    <div className="rounded-xl border border-dashed border-tertiary-300 bg-tertiary-50/50 p-4 dark:border-tertiary-700 dark:bg-tertiary-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Discount label */}
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="h-4 w-4 text-tertiary-600 dark:text-tertiary-400 shrink-0" />
            <span className="font-semibold text-tertiary-700 dark:text-tertiary-300">
              {discountLabel}
            </span>
          </div>

          {/* Code */}
          <div className="flex items-center gap-2 mb-2">
            <code className="rounded-lg border-2 border-dashed border-tertiary-400 bg-white px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-on-surface dark:bg-gray-900 dark:border-tertiary-600">
              {coupon.code}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-on-surface-variant mb-1">{description}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            {coupon.min_purchase && (
              <span>
                {t('coupons.minPurchase')} {coupon.min_purchase} {t('price.sar')}
              </span>
            )}
            {coupon.max_discount && coupon.discount_type === 'percentage' && (
              <span>
                ({t('coupons.maxDiscountAmount')}: {coupon.max_discount} {t('price.sar')})
              </span>
            )}
          </div>
        </div>

        {/* Expiry badge */}
        <div className="shrink-0">
          {expiryInfo.isExpired ? (
            <Badge variant="warning" className="text-xs">
              {expiryInfo.label}
            </Badge>
          ) : expiryInfo.isUrgent ? (
            <Badge variant="warning" className="text-xs gap-1">
              <Clock className="h-3 w-3" />
              {expiryInfo.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {expiryInfo.label}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
