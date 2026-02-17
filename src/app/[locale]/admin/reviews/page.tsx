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
 const t = useTranslations();
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
 title: t('admin.reviews.error'),
 description: t('admin.reviews.loadError'),
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
 title: t('common.deleted'),
 description: t('admin.reviews.deleteSuccess'),
 });

 setDeleteDialogOpen(false);
 setReviewToDelete(null);
 loadReviews();
 } catch (error) {
 console.error('Error deleting review:', error);
 toast({
 title: t('admin.reviews.error'),
 description: t('admin.reviews.deleteError'),
 variant: 'destructive',
 });
 }
 };

 const columns: Column<Review>[] = [
 {
 key: 'product',
 label: t('admin.reviews.product'),
 render: (review) => {
 const product = review.products as any;
 return product ? (isRTL ? product.name_ar : product.name_en) : '-';
 },
 },
 {
 key: 'user',
 label: t('admin.reviews.user'),
 render: (review) => {
 const user = review.users as any;
 return user?.full_name || user?.email || '-';
 },
 },
 {
 key: 'rating',
 label: t('admin.reviews.rating'),
 render: (review) => (
 <div className="flex items-center gap-1">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`h-4 w-4 ${
 i < review.rating
 ? 'fill-primary text-primary'
 : 'text-outline'
 }`}
 />
 ))}
 <span className="ml-1 text-sm">{review.rating}/5</span>
 </div>
 ),
 },
 {
 key: 'review_text',
 label: t('admin.reviews.review'),
 render: (review) => (
 <div className="max-w-md">
 <p className="text-sm truncate">{review.review_text || '-'}</p>
 </div>
 ),
 },
 {
 key: 'status',
 label: t('admin.reviews.status'),
 render: (review) => (
 <div className="flex items-center gap-2">
 {review.is_verified_purchase && (
 <Badge variant="success-light" className="gap-1">
 <CheckCircle className="h-3 w-3" />
 <span className="text-body-sm">{t('admin.reviews.verified')}</span>
 </Badge>
 )}
 </div>
 ),
 },
 {
 key: 'created_at',
 label: t('admin.reviews.date'),
 render: (review) => format(new Date(review.created_at), 'MMM dd, yyyy HH:mm'),
 },
 {
 key: 'actions',
 label: t('admin.reviews.actions'),
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
 <h1 className="text-headline-lg text-on-surface">
 {t('admin.reviews.title')}
 </h1>
 <p className="mt-2 text-sm text-on-surface-variant">
 {t('admin.reviews.subtitle')}
 </p>
 </div>

 {/* Filters */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 items-center gap-4">
 <Input
 placeholder={t('admin.reviews.searchPlaceholder')}
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="max-w-sm"
 />
 <Select value={ratingFilter} onValueChange={setRatingFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder={t('admin.reviews.allRatings')} />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">{t('admin.reviews.allRatings')}</SelectItem>
 <SelectItem value="5">5 {t('admin.reviews.stars')}</SelectItem>
 <SelectItem value="4">4 {t('admin.reviews.stars')}</SelectItem>
 <SelectItem value="3">3 {t('admin.reviews.stars')}</SelectItem>
 <SelectItem value="2">2 {t('admin.reviews.stars')}</SelectItem>
 <SelectItem value="1">1 {t('admin.reviews.star')}</SelectItem>
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
 {t('admin.reviews.confirmDelete')}
 </AlertDialogTitle>
 <AlertDialogDescription>
 {t('admin.reviews.confirmDeleteDesc')}
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>{t('admin.reviews.cancel')}</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
 {t('admin.reviews.delete')}
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}

