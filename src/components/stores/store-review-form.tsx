'use client';

import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import type { StoreReview } from './store-review-card';
import type { Database } from '@/lib/database';

interface StoreReviewFormProps {
  storeId: string;
  storeSlug: string;
  locale: string;
  onSuccess?: (review: StoreReview) => void;
  onClose?: () => void;
}

type RatingField = {
  value: number;
  setValue: Dispatch<SetStateAction<number>>;
  label: string;
  optional?: boolean;
};

export function StoreReviewForm({ storeId, storeSlug, locale, onSuccess, onClose }: StoreReviewFormProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = getSupabaseBrowserClient();

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [productQualityRating, setProductQualityRating] = useState(0);
  const [customerServiceRating, setCustomerServiceRating] = useState(0);
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratingFields: RatingField[] = useMemo(
    () => [
      {
        value: deliveryRating,
        setValue: setDeliveryRating,
        label: t('store.reviewForm.deliveryLabel'),
        optional: true,
      },
      {
        value: productQualityRating,
        setValue: setProductQualityRating,
        label: t('store.reviewForm.productQualityLabel'),
        optional: true,
      },
      {
        value: customerServiceRating,
        setValue: setCustomerServiceRating,
        label: t('store.reviewForm.customerServiceLabel'),
        optional: true,
      },
    ],
    [deliveryRating, productQualityRating, customerServiceRating, t],
  );

  const sanitizedRating = (value: number) => (value > 0 ? value : null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!user) {
      toast({
        title: t('store.reviewForm.loginRequired'),
        variant: 'destructive',
      });
      router.push(`/${locale}/auth/login?redirect=/${locale}/stores/${storeSlug}`);
      return;
    }

    if (rating === 0) {
      setError(t('store.reviewForm.ratingRequired'));
      return;
    }

    setSubmitting(true);

    try {
      const insertPayload: Database['public']['Tables']['store_reviews']['Insert'] = {
        store_id: storeId,
        user_id: user.id,
        rating,
        review_text: reviewText.trim() ? reviewText.trim() : null,
        delivery_rating: sanitizedRating(deliveryRating),
        product_quality_rating: sanitizedRating(productQualityRating),
        customer_service_rating: sanitizedRating(customerServiceRating),
        is_verified_purchase: isVerifiedPurchase,
      };

      const { data, error: insertError } = await supabase
        .from('store_reviews')
        .insert(insertPayload)
        .select(
          `
          id,
          rating,
          review_text,
          delivery_rating,
          product_quality_rating,
          customer_service_rating,
          is_verified_purchase,
          created_at,
          users(full_name, avatar_url)
        `,
        )
        .single<StoreReview>();

      if (insertError) {
        if ('code' in insertError && insertError.code === '23505') {
          setError(t('store.reviewForm.alreadyReviewed'));
        } else {
          setError(insertError.message);
        }
        return;
      }

      if (data) {
        toast({
          title: t('store.reviewForm.success'),
        });
        onSuccess?.(data as StoreReview);
        onClose?.();
        setRating(0);
        setReviewText('');
        setDeliveryRating(0);
        setProductQualityRating(0);
        setCustomerServiceRating(0);
        setIsVerifiedPurchase(true);
      }
    } catch (submitError) {
      console.error('Error submitting review:', submitError);
      setError(t('store.reviewForm.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderRatingButtons = (currentValue: number, onChange: (value: number) => void) => (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const value = index + 1;
        const isActive = currentValue >= value;
        const handleClick = () => {
          const nextValue = currentValue === value ? 0 : value;
          onChange(nextValue);
        };
        return (
          <button
            key={value}
            type="button"
            onClick={handleClick}
            className={`p-1 rounded-md transition-colors ${
              isActive
                ? 'text-primary'
                : 'text-outline hover:text-primary/60'
            }`}
            aria-label={`${value} ${t('store.reviewForm.stars')}`}
          >
            <Star className="w-5 h-5" fill={isActive ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label className="flex items-center justify-between">
          <span>{t('store.reviewForm.ratingLabel')}</span>
          <span className="text-xs text-outline">{t('store.reviewForm.required')}</span>
        </Label>
        {renderRatingButtons(rating, (value) => setRating(value))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reviewText">{t('store.reviewForm.reviewLabel')}</Label>
        <Textarea
          id="reviewText"
          value={reviewText}
          onChange={(event) => setReviewText(event.target.value)}
          placeholder={t('store.reviewForm.reviewPlaceholder')}
          rows={5}
        />
        <p className="text-xs text-outline">{t('store.reviewForm.reviewHelper')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ratingFields.map((field) => (
          <div key={field.label} className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>{field.label}</span>
              {field.optional && (
                <span className="text-xs text-outline">{t('store.reviewForm.optional')}</span>
              )}
            </Label>
            {renderRatingButtons(field.value, (value) => field.setValue(value))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-outline-variant px-4 py-3">
        <div>
          <p className="text-sm font-medium text-on-surface">
            {t('store.reviewForm.verifiedPurchaseLabel')}
          </p>
          <p className="text-xs text-on-surface-variant">
            {t('store.reviewForm.verifiedPurchaseHint')}
          </p>
        </div>
        <Switch checked={isVerifiedPurchase} onCheckedChange={setIsVerifiedPurchase} />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          {t('store.reviewForm.cancel')}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t('store.reviewForm.saving') : t('store.reviewForm.submit')}
        </Button>
      </div>
    </form>
  );
}


