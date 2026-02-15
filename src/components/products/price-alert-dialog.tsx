'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import type { Database } from '@/lib/database/types';

type PriceAlertRow = Database['public']['Tables']['price_alerts']['Row'];

interface PriceAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  locale: string;
  currentPrice?: number | null;
  onSaved?: () => void;
}

export function PriceAlertDialog({
  open,
  onOpenChange,
  productId,
  productName,
  locale,
  currentPrice,
  onSaved,
}: PriceAlertDialogProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const formattedCurrentPrice = useMemo(() => {
    if (typeof currentPrice !== 'number') return null;
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 2,
    }).format(currentPrice);
  }, [currentPrice, locale]);

  const [targetPrice, setTargetPrice] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existingAlert, setExistingAlert] = useState<PriceAlertRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing alert when dialog opens
  useEffect(() => {
    if (!open || !user) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{t('product.priceAlertTitle')}</DialogTitle>
            <DialogDescription>
              {t('product.priceAlertDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-sm text-gray-600 dark:text-gray-300">
                {productName}
              </Label>
              {formattedCurrentPrice && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('product.priceAlertCurrentPrice')}: {formattedCurrentPrice}
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

            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {t('product.priceAlertActiveLabel')}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {error && (
              <p className="text-sm text-destructive-600 dark:text-destructive-500">
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
      </DialogContent>
    </Dialog>
  );
}

