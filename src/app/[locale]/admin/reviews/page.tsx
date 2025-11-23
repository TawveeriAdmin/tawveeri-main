'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Badge } from '@/components/ui/badge';
import { Star, Trash2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  products?: {
    id: string;
    name_ar: string;
    name_en: string;
  };
  users?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export default function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState<string>('en');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);
  const { toast } = useToast();
  const limit = 20;
  const isRTL = locale === 'ar';

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    loadReviews();
  }, [page, ratingFilter]);

  useEffect(() => {
    // Client-side filtering
    let filtered = reviews;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (review) =>
          review.products?.name_ar?.toLowerCase().includes(query) ||
          review.products?.name_en?.toLowerCase().includes(query) ||
          review.users?.full_name?.toLowerCase().includes(query) ||
          review.users?.email?.toLowerCase().includes(query) ||
          review.review_text?.toLowerCase().includes(query)
      );
    }

    setFilteredReviews(filtered);
  }, [reviews, searchQuery]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      let query = supabase
        .from('product_reviews')
        .select(
          `
          *,
          products (
            id,
            name_ar,
            name_en
          ),
          users (
            id,
            full_name,
            email
          )
        `,
          { count: 'exact' }
        );

      if (ratingFilter !== 'all') {
        query = query.eq('rating', parseInt(ratingFilter));
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      setReviews((data as Review[]) || []);
      setFilteredReviews((data as Review[]) || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل تحميل التقييمات' : 'Failed to load reviews',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reviewToDelete) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', reviewToDelete.id);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف التقييم بنجاح' : 'Review deleted successfully',
      });

      setDeleteDialogOpen(false);
      setReviewToDelete(null);
      loadReviews();
    } catch (error) {
      console.error('Error deleting review:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل حذف التقييم' : 'Failed to delete review',
        variant: 'destructive',
      });
    }
  };

  const columns: Column<Review>[] = [
    {
      key: 'product',
      label: isRTL ? 'المنتج' : 'Product',
      render: (review) => {
        const product = review.products as any;
        return product ? (isRTL ? product.name_ar : product.name_en) : '-';
      },
    },
    {
      key: 'user',
      label: isRTL ? 'المستخدم' : 'User',
      render: (review) => {
        const user = review.users as any;
        return user?.full_name || user?.email || '-';
      },
    },
    {
      key: 'rating',
      label: isRTL ? 'التقييم' : 'Rating',
      render: (review) => (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < review.rating
                  ? 'fill-primary-500 text-primary-500'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
          ))}
          <span className="ml-1 text-sm">{review.rating}/5</span>
        </div>
      ),
    },
    {
      key: 'review_text',
      label: isRTL ? 'التعليق' : 'Review',
      render: (review) => (
        <div className="max-w-md">
          <p className="text-sm truncate">{review.review_text || '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: isRTL ? 'الحالة' : 'Status',
      render: (review) => (
        <div className="flex items-center gap-2">
          {review.is_verified_purchase && (
            <Badge variant="success-light" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              <span className="text-xs">{isRTL ? 'موثق' : 'Verified'}</span>
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: isRTL ? 'التاريخ' : 'Date',
      render: (review) => format(new Date(review.created_at), 'MMM dd, yyyy HH:mm'),
    },
    {
      key: 'actions',
      label: isRTL ? 'الإجراءات' : 'Actions',
      render: (review) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setReviewToDelete(review);
            setDeleteDialogOpen(true);
          }}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isRTL ? 'إدارة التقييمات' : 'Review Management'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {isRTL ? 'عرض وإدارة تقييمات المنتجات' : 'View and manage product reviews'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <Input
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={isRTL ? 'جميع التقييمات' : 'All Ratings'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع التقييمات' : 'All Ratings'}</SelectItem>
              <SelectItem value="5">5 {isRTL ? 'نجوم' : 'Stars'}</SelectItem>
              <SelectItem value="4">4 {isRTL ? 'نجوم' : 'Stars'}</SelectItem>
              <SelectItem value="3">3 {isRTL ? 'نجوم' : 'Stars'}</SelectItem>
              <SelectItem value="2">2 {isRTL ? 'نجوم' : 'Stars'}</SelectItem>
              <SelectItem value="1">1 {isRTL ? 'نجم' : 'Star'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reviews Table */}
      <DataTable
        data={filteredReviews}
        columns={columns}
        pagination={{
          page,
          limit,
          total,
          onPageChange: setPage,
        }}
        loading={loading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'تأكيد الحذف' : 'Confirm Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this review? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

