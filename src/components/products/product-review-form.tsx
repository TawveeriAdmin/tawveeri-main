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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createProductReview, updateProductReview } from '@/lib/reviews/product-reviews';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import type { ProductReview } from '@/lib/database/types';

interface ProductReviewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  existingReview?: ProductReview;
  locale: string;
  onSuccess: () => void;
}

export function ProductReviewForm({
  open,
  onOpenChange,
  productId,
  productName,
  existingReview,
  locale,
  onSuccess,
}: ProductReviewFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>(existingReview?.review_text || '');
  const [isVerified, setIsVerified] = useState<boolean>(existingReview?.is_verified_purchase || false);
  const [loading, setLoading] = useState(false);
  const [canVerifyPurchase, setCanVerifyPurchase] = useState(false);
  const { toast } = useToast();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  useEffect(() => {
    checkVerifiedPurchase();
  }, [user, productId]);

  const checkVerifiedPurchase = async () => {
    if (!user?.id) {
      setCanVerifyPurchase(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      // Check if user has a completed transaction for this product
      const { data: productStores } = await supabase
        .from('product_stores')
        .select('id')
        .eq('product_id', productId);

      if (!productStores || productStores.length === 0) {
        setCanVerifyPurchase(false);
        return;
      }

      const productStoreIds = productStores.map((ps) => ps.id);

      const { data: transactions } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .in('product_store_id', productStoreIds)
        .limit(1);

      setCanVerifyPurchase((transactions?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking verified purchase:', error);
      setCanVerifyPurchase(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast({
        title: t('products.review.error'),
        description: t('products.review.loginRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: t('products.review.error'),
        description: t('products.review.selectRating'),
        variant: 'destructive',
      });
      return;
    }

    if (reviewText.length < 10) {
      toast({
        title: t('products.review.error'),
        description: t('products.review.minLength'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      if (existingReview) {
        // Update existing review
        const result = await updateProductReview({
          reviewId: existingReview.id,
          userId: user.id,
          rating,
          reviewText,
        });

        if (result.error) throw result.error;
      } else {
        // Create new review
        const result = await createProductReview({
          productId,
          userId: user.id,
          rating,
          reviewText,
          isVerified: canVerifyPurchase && isVerified,
        });

        if (result.error) throw result.error;
      }

      toast({
        title: t('products.review.success'),
        description: existingReview
          ? t('products.review.reviewUpdated')
          : t('products.review.reviewAdded'),
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      if (!existingReview) {
        setRating(0);
        setReviewText('');
        setIsVerified(false);
      }
    } catch (error: any) {
      console.error('Error saving review:', error);
      toast({
        title: t('products.review.error'),
        description: error.message || t('products.review.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existingReview
              ? isRTL
                ? 'تعديل التقييم'
                : 'Edit Review'
              : isRTL
              ? 'كتابة تقييم'
              : 'Write a Review'}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? `تقييم ${productName}` : `Review for ${productName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating */}
          <div className="space-y-2">
            <Label>{isRTL ? 'التقييم' : 'Rating'} *</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none"
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      star <= (hoverRating || rating)
                        ? 'fill-primary text-primary'
                        : 'text-outline'
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-on-surface-variant">
                  {rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label htmlFor="reviewText">
              {isRTL ? 'التعليق' : 'Review'} * ({reviewText.length}/10 min)
            </Label>
            <Textarea
              id="reviewText"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={
                isRTL
                  ? 'شاركنا بتجربتك مع هذا المنتج...'
                  : 'Share your experience with this product...'
              }
              rows={6}
              minLength={10}
              className={cn(reviewText.length > 0 && reviewText.length < 10 && 'border-error')}
            />
            {reviewText.length > 0 && reviewText.length < 10 && (
              <p className="text-xs text-error">
                {isRTL
                  ? 'يجب أن يكون النص 10 أحرف على الأقل'
                  : 'Review must be at least 10 characters'}
              </p>
            )}
          </div>

          {/* Verified Purchase */}
          {canVerifyPurchase && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="verified"
                checked={isVerified}
                onCheckedChange={(checked) => setIsVerified(checked as boolean)}
              />
              <Label htmlFor="verified" className="cursor-pointer">
                {isRTL ? 'هذا شراء موثق' : 'This is a verified purchase'}
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || rating === 0 || reviewText.length < 10}>
            {loading
              ? isRTL
                ? 'جاري الحفظ...'
                : 'Saving...'
              : existingReview
              ? isRTL
                ? 'حفظ التغييرات'
                : 'Save Changes'
              : isRTL
              ? 'إضافة التقييم'
              : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

