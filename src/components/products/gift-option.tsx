'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useToast } from '@/components/ui/use-toast';

interface GiftOptionProps {
  productName: string;
  shareUrl: string;
}

export function GiftOption({ productName, shareUrl }: GiftOptionProps) {
  const t = useTranslations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [includeWrapping, setIncludeWrapping] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t('product.giftShareSuccess'),
        variant: 'default',
      });
    } catch (error) {
      console.error('Failed to copy gift link:', error);
      toast({
        title: t('product.giftShareError'),
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: giftMessage || t('product.giftDialogDescription'),
          url: shareUrl,
        });
        setOpen(false);
        return;
      } catch (error) {
        console.error('Gift share error:', error);
      }
    }

    await handleCopyLink();
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t('product.giftOption')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('product.giftDialogTitle')}</DialogTitle>
            <DialogDescription>{t('product.giftDialogDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{productName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('product.priceAlertCurrentPrice')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {t('product.giftWrapping')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('product.giftWrappingHint')}
                </p>
              </div>
              <Switch checked={includeWrapping} onCheckedChange={setIncludeWrapping} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gift-message">{t('product.giftMessage')}</Label>
              <Textarea
                id="gift-message"
                value={giftMessage}
                onChange={(event) => setGiftMessage(event.target.value)}
                placeholder={t('product.giftMessagePlaceholder')}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCopyLink}>
              {t('product.giftShareLink')}
            </Button>
            <Button onClick={handleShare}>{t('product.giftShare')}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('product.giftClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

