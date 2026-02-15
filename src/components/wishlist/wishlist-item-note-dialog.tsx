'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getSupabaseBrowserClient } from '@/lib/database';

interface WishlistItemNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  productId: string;
  productName: string;
  currentNote?: string | null;
  locale: string;
  onNoteUpdated?: () => void;
}

export function WishlistItemNoteDialog({
  open,
  onOpenChange,
  userId,
  productId,
  productName,
  currentNote,
  locale,
  onNoteUpdated,
}: WishlistItemNoteDialogProps) {
  const t = useTranslations();
  const [note, setNote] = useState(currentNote || '');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const supabase = getSupabaseBrowserClient();
  const isRTL = locale === 'ar';

  useEffect(() => {
    if (open) {
      setNote(currentNote || '');
    }
  }, [open, currentNote]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_wishlists')
        .update({ notes: note.trim() || null })
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;

      toast({
        title: t('common.saved'),
        description: t('wishlist.noteSavedSuccess'),
      });

      onOpenChange(false);
      onNoteUpdated?.();
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: t('common.error'),
        description: t('wishlist.noteSaveError'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('wishlist.noteForProduct')}
          </DialogTitle>
          <DialogDescription>
            {productName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note">
              {t('wishlist.note')}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('wishlist.notePlaceholder')}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

