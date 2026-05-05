'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useTranslations } from '@/lib/simple-intl-provider';
import { SARSymbol } from '@/components/ui/price';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { createNotification } from '@/lib/auth/notifications';
import { ProductPicker, type PickedProduct } from '@/components/products/product-picker';
import type { Database } from '@/lib/database/types';

type PriceAlertRow = Database['public']['Tables']['price_alerts']['Row'];

interface PriceAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted the dialog opens a picker first and resolves productId/productName/currentPrice from the chosen product. */
  productId?: string;
  productName?: string;
  locale: string;
  currentPrice?: number | null;
  onSaved?: () => void;
}

export function PriceAlertDialog({
  open,
  onOpenChange,
  productId: productIdProp,
  productName: productNameProp,
  locale,
  currentPrice: currentPriceProp,
  onSaved,
}: PriceAlertDialogProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  // Picker-selected product (only used when productIdProp is absent).
  const [pickedProduct, setPickedProduct] = useState<PickedProduct | null>(null);
  const productId = productIdProp ?? pickedProduct?.id ?? null;
  const productName =
    productNameProp ?? (pickedProduct ? (locale === 'ar' ? pickedProduct.name_ar : pickedProduct.name_en) : '');
  const currentPrice = currentPriceProp ?? pickedProduct?.lowestPrice ?? null;

  const formattedCurrentPrice = useMemo(() => {
    if (typeof currentPrice !== 'number') return null;
    return Math.round(currentPrice).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US');
  }, [currentPrice, locale]);

  const [targetPrice, setTargetPrice] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existingAlert, setExistingAlert] = useState<PriceAlertRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset picker when the dialog closes so the next open is clean.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!open) {
      setPickedProduct(null);
      setError(null);
    }
  }, [open]);

  // Load existing alert when dialog opens AND we have a resolved productId.
  useEffect(() => {
    if (!open || !user || !productId) {
      return;
    }

    let mounted = true;

    const loadAlert = async () => {
      const { data, error: queryError } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle<PriceAlertRow>();

      if (!mounted) return;

      if (queryError && queryError.code !== 'PGRST116') {
        console.error('Failed to load price alert', queryError);
      }

      if (data) {
        setExistingAlert(data);
        setTargetPrice(String(data.target_price));
        setIsActive(Boolean(data.is_active));
      } else {
        setExistingAlert(null);
        setTargetPrice(currentPrice ? String(currentPrice) : '');
        setIsActive(true);
      }
    };

    loadAlert();

    return () => {
      mounted = false;
    };
  }, [open, user, productId, currentPrice]);

  const handleClose = () => {
    setError(null);
    setLoading(false);
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      handleClose();
      return;
    }
    if (!productId) {
      setError(locale === 'ar' ? 'اختر منتجاً أولاً.' : 'Pick a product first.');
      return;
    }

    const parsedTarget = Number.parseFloat(targetPrice);
    if (Number.isNaN(parsedTarget) || parsedTarget <= 0) {
      setError(t('product.priceAlertInvalid'));
      return;
    }

    if (typeof currentPrice === 'number' && parsedTarget > currentPrice) {
      setError(t('product.priceAlertInvalid'));
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Database['public']['Tables']['price_alerts']['Insert'] = {
      user_id: user.id,
      product_id: productId,
      target_price: parsedTarget,
      is_active: isActive,
      notified_at: null,
    };

    const { error: upsertError } = await supabase
      .from('price_alerts')
      .upsert(payload, { onConflict: 'user_id,product_id' });

    setLoading(false);

    if (upsertError) {
      console.error('Failed to save price alert', upsertError);
      setError(upsertError.message);
      return;
    }

    // In-app notification
    createNotification({
      user_id: user.id,
      type: 'system',
      title_ar: existingAlert ? 'تم تحديث تنبيه السعر' : 'تم إنشاء تنبيه السعر',
      title_en: existingAlert ? 'Price Alert Updated' : 'Price Alert Created',
      message_ar: `تنبيه السعر لـ "${productName}" عند ${parsedTarget} ر.س`,
      message_en: `Price alert for "${productName}" at ${parsedTarget} SAR`,
      product_id: productId,
    }).catch(() => {});

    // Audit log (fire-and-forget)
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: existingAlert ? 'price_alert_created' : 'price_alert_created',
        entity_type: 'price_alert',
        entity_id: productId,
        details: { target_price: parsedTarget, product_name: productName },
      }),
    }).catch(() => {});

    const successMessage = existingAlert
      ? t('product.priceAlertUpdated')
      : t('product.priceAlertSaved');

    toast({
      title: successMessage,
      variant: 'default',
    });

    onSaved?.();
    handleClose();
  };

  const needsPicker = !productId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {needsPicker ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('product.priceAlertTitle')}</DialogTitle>
              <DialogDescription>
                {locale === 'ar'
                  ? 'ابحث عن المنتج الذي تريد تعيين تنبيه سعر له.'
                  : 'Search for the product you want to set a price alert on.'}
              </DialogDescription>
            </DialogHeader>
            <ProductPicker locale={locale} onPick={setPickedProduct} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('product.priceAlertCancel')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{t('product.priceAlertTitle')}</DialogTitle>
            <DialogDescription>
              {t('product.priceAlertDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-sm text-on-surface-variant">
                {productName}
              </Label>
              {formattedCurrentPrice && (
                <p className="text-sm text-on-surface-variant inline-flex items-center gap-1">
                  {t('product.priceAlertCurrentPrice')}: {formattedCurrentPrice} <SARSymbol className="w-2.5 h-2.5 fill-current" />
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPrice">{t('product.priceAlertTargetLabel')}</Label>
              <Input
                id="targetPrice"
                type="number"
                min={0}
                step="0.01"
                value={targetPrice}
                onChange={(event) => setTargetPrice(event.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-outline-variant px-4 py-3">
              <div>
                <p className="font-medium text-on-surface">
                  {t('product.priceAlertActiveLabel')}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {error && (
              <p className="text-sm text-error">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              {t('product.priceAlertCancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('settings.saving') || 'Saving...' : t('product.priceAlertSubmit')}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
