'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Copy, Check, Ticket, Clock } from 'lucide-react';
import { SARSymbol } from '@/components/ui/price';
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
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-[var(--brand-gold)] bg-[var(--brand-gold)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--brand-gold-dark)] transition-colors hover:bg-[var(--brand-gold)]/20"
      >
        <Ticket className="h-3 w-3 text-[var(--brand-gold-dark)]" />
        <span className="font-mono font-bold text-[var(--brand-gold-dark)]">
          {coupon.code}
        </span>
        {discountLabel && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 border-[var(--brand-gold)]/60 text-[var(--brand-gold-dark)]">
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
    <div className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/8 px-3 py-2">
      {/* Discount + expiry row */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Ticket className="h-3.5 w-3.5 text-[var(--brand-gold-dark)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--brand-gold-dark)]">
            {discountLabel}
          </span>
        </div>
        {expiryInfo.isExpired ? (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
            {expiryInfo.label}
          </Badge>
        ) : expiryInfo.isUrgent ? (
          <Badge variant="warning" className="text-[10px] px-1.5 py-0 gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {expiryInfo.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {expiryInfo.label}
          </Badge>
        )}
      </div>

      {/* Code + copy */}
      <div className="flex items-center gap-1.5 mb-1">
        <code className="rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--brand-gold)] bg-[color:var(--color-surface)] px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-on-surface">
          {coupon.code}
        </code>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-on-surface-variant">{description}</p>
      )}

      {/* Meta info */}
      {(coupon.min_purchase || (coupon.max_discount && coupon.discount_type === 'percentage')) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-on-surface-variant">
          {coupon.min_purchase && (
            <span className="inline-flex items-center gap-0.5">
              {t('coupons.minPurchase')} {coupon.min_purchase} <SARSymbol className="w-2 h-2 fill-current" />
            </span>
          )}
          {coupon.max_discount && coupon.discount_type === 'percentage' && (
            <span className="inline-flex items-center gap-0.5">
              ({t('coupons.maxDiscountAmount')}: {coupon.max_discount} <SARSymbol className="w-2 h-2 fill-current" />)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
