'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getProductReviews, deleteProductReview } from '@/lib/reviews/product-reviews';
import { ProductReviewCard } from './product-review-card';
import { ProductReviewForm } from './product-review-form';
import { ProductRatingDisplay } from './product-rating-display';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { markReviewHelpful } from '@/lib/reviews/product-reviews';
import { Plus } from 'lucide-react';
import type { ProductReview } from '@/lib/database/types';
import { useTranslations } from '@/lib/simple-intl-provider';

interface ProductReviewsProps {
  productId: string;
  productName: string;
  averageRating: number;
  totalReviews: number;
  locale: string;
}

export function ProductReviews({
  productId,
  productName,
  averageRating,
  totalReviews,
  locale,
}: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Array<ProductReview & { users?: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating'>('newest');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(totalReviews);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | undefined>();
  const [userHasReview, setUserHasReview] = useState(false);
  const limit = 10;
  const { toast } = useToast();
  const t = useTranslations();
  const isRTL = locale === 'ar';

  useEffect(() => {
    loadReviews();
  }, [productId, sortBy, page, user]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const result = await getProductReviews(productId, {
        limit,
        offset: (page - 1) * limit,
        sortBy,
      });

      if (result.error) throw result.error;

      setReviews(result.data || []);
      setTotalCount(result.count || 0);

      // Check if user has reviewed
      if (user?.id) {
        const hasReview = (result.data || []).some((r) => r.user_id === user.id);
        setUserHasReview(hasReview);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    if (!user?.id) return;

    try {
      const result = await markReviewHelpful(reviewId, user.id);
      if (result.error) throw result.error;

      // Update local state
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpful_count: (r.helpful_count || 0) + 1 } : r
        )
      );
    } catch (error) {
      console.error('Error marking review helpful:', error);
    }
  };

  const handleEdit = (review: ProductReview) => {
    setEditingReview(review);
    setReviewDialogOpen(true);
  };

  const handleDelete = async (reviewId: string) => {
    if (!user?.id) return;

    if (!confirm(isRTL ? 'هل أنت متأكد من حذف هذا التقييم؟' : 'Are you sure you want to delete this review?')) {
      return;
    }

    try {
      const result = await deleteProductReview(reviewId, user.id);
      if (result.error) throw result.error;

      toast({
        title: t('common.deleted'),
        description: t('products.review.reviewDeleted'),
      });

      loadReviews();
    } catch (error: any) {
      console.error('Error deleting review:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('products.review.deleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleReviewSuccess = () => {
    loadReviews();
    setEditingReview(undefined);
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('products.review.reviewsTitle')}
          </h3>
          <ProductRatingDisplay
            rating={averageRating}
            totalReviews={totalCount}
            size="lg"
          />
        </div>

        {user && !userHasReview && (
          <Button onClick={() => setReviewDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('products.review.writeReview')}
          </Button>
        )}
      </div>

      {/* Sort */}
      {reviews.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={(value: 'newest' | 'oldest' | 'rating') => {
            setSortBy(value);
            setPage(1);
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('products.review.sortNewest')}</SelectItem>
              <SelectItem value="oldest">{t('products.review.sortOldest')}</SelectItem>
              <SelectItem value="rating">{t('products.review.sortHighestRating')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
              <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('products.review.noReviews')}
          </p>
          {user && !userHasReview && (
            <Button onClick={() => setReviewDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('products.review.beFirstToReview')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ProductReviewCard
              key={review.id}
              review={review}
              onHelpful={handleHelpful}
              onEdit={user?.id === review.user_id ? handleEdit : undefined}
              onDelete={user?.id === review.user_id ? handleDelete : undefined}
              locale={locale}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {t('products.review.previous')}
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('products.review.page')} {page} {t('products.review.of')} {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            {t('products.review.next')}
          </Button>
        </div>
      )}

      {/* Review Form Dialog */}
      <ProductReviewForm
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        productId={productId}
        productName={productName}
        existingReview={editingReview}
        locale={locale}
        onSuccess={handleReviewSuccess}
      />
    </div>
  );
}

