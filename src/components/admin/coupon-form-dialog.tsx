'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { useTranslations } from '@/lib/simple-intl-provider';
import { SARSymbol } from '@/components/ui/price';
import type { CouponRow } from '@/app/[locale]/admin/coupons/page';

interface CouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: CouponRow | null;
  stores: Array<{ id: string; name_ar: string; name_en: string }>;
  locale: string;
  onSuccess: () => void;
  apiEndpoint?: string;
}

export function CouponFormDialog({
  open,
  onOpenChange,
  coupon,
  stores,
  locale,
  onSuccess,
  apiEndpoint = '/api/admin/coupons',
}: CouponFormDialogProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const isRTL = locale === 'ar';
  const isEdit = !!coupon;

  // Form state
  const [storeId, setStoreId] = useState('');
  const [code, setCode] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [discountType, setDiscountType] = useState<
    'percentage' | 'fixed_amount' | 'free_shipping'
  >('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minPurchase, setMinPurchase] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens / coupon changes
  useEffect(() => {
    if (open) {
      if (coupon) {
        setStoreId(coupon.store_id);
        setCode(coupon.code);
        setDescriptionAr(coupon.description_ar || '');
        setDescriptionEn(coupon.description_en || '');
        setDiscountType(coupon.discount_type);
        setDiscountValue(
          coupon.discount_value != null ? String(coupon.discount_value) : ''
        );
        setMinPurchase(
          coupon.min_purchase != null ? String(coupon.min_purchase) : ''
        );
        setMaxDiscount(
          coupon.max_discount != null ? String(coupon.max_discount) : ''
        );
        setExpiresAt(coupon.expires_at || '');
      } else {
        setStoreId('');
        setCode('');
        setDescriptionAr('');
        setDescriptionEn('');
        setDiscountType('percentage');
        setDiscountValue('');
        setMinPurchase('');
        setMaxDiscount('');
        setExpiresAt('');
      }
    }
  }, [open, coupon]);

  const handleSubmit = async () => {
    // Validation
    if (!storeId) {
      toast({
        title: t('common.error'),
        description: t('coupons.form.storeRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (!code.trim()) {
      toast({
        title: t('common.error'),
        description: t('coupons.form.codeRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (!discountType) {
      toast({
        title: t('common.error'),
        description: t('coupons.form.discountTypeRequired'),
        variant: 'destructive',
      });
      return;
    }
    if (
      discountType !== 'free_shipping' &&
      (!discountValue || Number(discountValue) <= 0)
    ) {
      toast({
        title: t('common.error'),
        description: t('coupons.form.discountValueRequired'),
        variant: 'destructive',
      });
      return;
    }

    const payload: Record<string, unknown> = {
      store_id: storeId,
      code: code.trim().toUpperCase(),
      description_ar: descriptionAr.trim() || null,
      description_en: descriptionEn.trim() || null,
      discount_type: discountType,
      discount_value:
        discountType === 'free_shipping' ? null : Number(discountValue),
      min_purchase: minPurchase ? Number(minPurchase) : null,
      max_discount:
        discountType === 'percentage' && maxDiscount
          ? Number(maxDiscount)
          : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    try {
      setLoading(true);

      const url = isEdit
        ? `${apiEndpoint}/${coupon!.id}`
        : apiEndpoint;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save coupon');
      }

      toast({
        title: isEdit ? t('coupons.updated') : t('coupons.created'),
        description: isEdit
          ? t('coupons.updateSuccess')
          : t('coupons.createSuccess'),
      });

      onSuccess();
    } catch (error) {
      console.error('Error saving coupon:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error ? error.message : t('coupons.saveError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('coupons.editCoupon') : t('coupons.addCoupon')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('coupons.editCouponDescription')
              : t('coupons.addCouponDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
          {/* ── Left Column ── */}

          {/* Store */}
          <div className="space-y-2">
            <Label htmlFor="coupon-store">{t('coupons.form.store')} *</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger id="coupon-store">
                <SelectValue
                  placeholder={t('coupons.form.selectStore')}
                />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {isRTL ? store.name_ar : store.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description AR */}
          <div className="space-y-2">
            <Label htmlFor="coupon-desc-ar">
              {t('coupons.form.descriptionAr')}
            </Label>
            <Input
              id="coupon-desc-ar"
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              placeholder={t('coupons.form.descriptionArPlaceholder')}
            />
          </div>

          {/* Code */}
          <div className="space-y-2">
            <Label htmlFor="coupon-code">{t('coupons.form.code')} *</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('coupons.form.codePlaceholder')}
              className="font-mono uppercase"
            />
          </div>

          {/* Description EN */}
          <div className="space-y-2">
            <Label htmlFor="coupon-desc-en">
              {t('coupons.form.descriptionEn')}
            </Label>
            <Input
              id="coupon-desc-en"
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder={t('coupons.form.descriptionEnPlaceholder')}
            />
          </div>

          {/* Discount Type */}
          <div className="space-y-2">
            <Label htmlFor="coupon-discount-type">
              {t('coupons.form.discountType')} *
            </Label>
            <Select
              value={discountType}
              onValueChange={(v) =>
                setDiscountType(
                  v as 'percentage' | 'fixed_amount' | 'free_shipping'
                )
              }
            >
              <SelectTrigger id="coupon-discount-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  {t('coupons.form.percentage')}
                </SelectItem>
                <SelectItem value="fixed_amount">
                  {t('coupons.form.fixedAmount')}
                </SelectItem>
                <SelectItem value="free_shipping">
                  {t('coupons.form.freeShipping')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Purchase */}
          <div className="space-y-2">
            <Label htmlFor="coupon-min-purchase">
              {t('coupons.form.minPurchase')} (<SARSymbol className="w-2.5 h-2.5 fill-current inline" />)
            </Label>
            <Input
              id="coupon-min-purchase"
              type="number"
              min="0"
              step="0.01"
              value={minPurchase}
              onChange={(e) => setMinPurchase(e.target.value)}
              placeholder={t('coupons.form.optional')}
              className="tabular-nums"
            />
          </div>

          {/* Discount Value (hidden for free_shipping) */}
          {discountType !== 'free_shipping' && (
            <div className="space-y-2">
              <Label htmlFor="coupon-discount-value">
                {t('coupons.form.discountValue')} *
                {discountType === 'percentage' ? ' (%)' : <> (<SARSymbol className="w-2.5 h-2.5 fill-current inline" />)</>}
              </Label>
              <Input
                id="coupon-discount-value"
                type="number"
                min="0"
                step={discountType === 'percentage' ? '1' : '0.01'}
                max={discountType === 'percentage' ? '100' : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
                className="tabular-nums"
              />
            </div>
          )}

          {/* Max Discount (only for percentage) */}
          {discountType === 'percentage' && (
            <div className="space-y-2">
              <Label htmlFor="coupon-max-discount">
                {t('coupons.form.maxDiscount')} (<SARSymbol className="w-2.5 h-2.5 fill-current inline" />)
              </Label>
              <Input
                id="coupon-max-discount"
                type="number"
                min="0"
                step="0.01"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder={t('coupons.form.optional')}
                className="tabular-nums"
              />
            </div>
          )}

          {/* Expires At */}
          <div className="space-y-2">
            <Label>{t('coupons.form.expiresAt')}</Label>
            <DateTimePicker
              value={expiresAt}
              onChange={setExpiresAt}
              placeholder={t('coupons.form.optional')}
              locale={locale}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? t('common.saving')
              : isEdit
                ? t('common.save')
                : t('coupons.addCoupon')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
