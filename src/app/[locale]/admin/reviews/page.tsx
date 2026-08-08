'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getSupabaseBrowserClient } from '@/lib/database';
import { useToast } from '@/components/ui/use-toast';
import {
  Star,
  Trash2,
  CheckCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  SlidersHorizontal,
  Columns3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatNumber } from '@/lib/formatting';

// ─── Types ────────────────────────────────────────────────
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

interface ReviewStats {
  total: number;
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
}

type SortField = 'rating' | 'helpful_count' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'product' | 'user' | 'rating' | 'review' | 'verified' | 'helpful' | 'date' | 'actions';

// ─── Sub-components ───────────────────────────────────────

function StatsCard({
  title,
  value,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-start transition-all',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-outline-variant bg-surface-container-lowest hover:border-primary/40'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-primary/15 text-primary' : 'bg-primary/10 text-primary'
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="tabular-nums text-xl font-bold text-on-surface">
          {value}
        </p>
        <p className="truncate text-xs text-on-surface-variant">{title}</p>
      </div>
    </button>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= rating ? 'fill-warning text-warning' : 'text-outline-variant'
          )}
        />
      ))}
      <span className="ms-1 text-sm tabular-nums text-on-surface">{rating}/5</span>
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field)
    return <ArrowUpDown className="ms-1 inline h-3.5 w-3.5 text-on-surface-variant/50" />;
  return sortDir === 'asc' ? (
    <ArrowUp className="ms-1 inline h-3.5 w-3.5 text-primary" />
  ) : (
    <ArrowDown className="ms-1 inline h-3.5 w-3.5 text-primary" />
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function AdminReviewsPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = use(props.params);
  const [locale, setLocale] = useState('en');
  const t = useTranslations();
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  // Data
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats>({
    total: 0, fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    product: true,
    user: true,
    rating: true,
    review: true,
    verified: true,
    helpful: true,
    date: true,
    actions: true,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  useEffect(() => {
    setLocale(params.locale);
  }, [params]);

  // ─── Data loading ───────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [tot, s5, s4, s3, s2, s1] = await Promise.all([
        sb.from('product_reviews').select('id', { count: 'exact', head: true }),
        sb.from('product_reviews').select('id', { count: 'exact', head: true }).eq('rating', 5),
        sb.from('product_reviews').select('id', { count: 'exact', head: true }).eq('rating', 4),
        sb.from('product_reviews').select('id', { count: 'exact', head: true }).eq('rating', 3),
        sb.from('product_reviews').select('id', { count: 'exact', head: true }).eq('rating', 2),
        sb.from('product_reviews').select('id', { count: 'exact', head: true }).eq('rating', 1),
      ]);
      setStats({
        total: tot.count || 0,
        fiveStar: s5.count || 0,
        fourStar: s4.count || 0,
        threeStar: s3.count || 0,
        twoStar: s2.count || 0,
        oneStar: s1.count || 0,
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const sb = getSupabaseBrowserClient();

      let q = sb
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

      if (ratingFilter !== 'all') q = q.eq('rating', parseInt(ratingFilter));

      const { data, error, count } = await q
        .order(sortField, { ascending: sortDir === 'asc' })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1);

      if (error) throw error;
      setReviews((data as Review[]) || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('Error loading reviews:', e);
      toast({
        title: t('admin.reviews.error'),
        description: t('admin.reviews.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, ratingFilter, sortField, sortDir, t, toast]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadReviews(); }, [loadReviews]);
  useEffect(() => { setPage(1); }, [ratingFilter, searchQuery, rowsPerPage]);

  // ─── Client-side search on loaded data ──────────────────
  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter(
      (r) =>
        r.products?.name_en?.toLowerCase().includes(q) ||
        r.products?.name_ar?.toLowerCase().includes(q) ||
        r.users?.full_name?.toLowerCase().includes(q) ||
        r.users?.email?.toLowerCase().includes(q) ||
        r.review_text?.toLowerCase().includes(q)
    );
  }, [reviews, searchQuery]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleStatsClick = (rating: string) => {
    setRatingFilter((p) => (p === rating ? 'all' : rating));
  };

  const handleDelete = async () => {
    if (!reviewToDelete) return;
    try {
      const sb = getSupabaseBrowserClient();
      const { error } = await sb
        .from('product_reviews')
        .delete()
        .eq('id', reviewToDelete.id);

      if (error) throw error;

      toast({
        title: t('admin.reviews.deleteSuccess'),
      });

      setDeleteDialogOpen(false);
      setReviewToDelete(null);
      loadReviews();
      loadStats();
    } catch (error) {
      console.error('Error deleting review:', error);
      toast({
        title: t('admin.reviews.error'),
        description: t('admin.reviews.deleteError'),
        variant: 'destructive',
      });
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredReviews.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredReviews.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const showFrom = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const showTo = Math.min(page * rowsPerPage, total);

  const colLabels: Record<ColumnKey, string> = useMemo(
    () => ({
      product: t('admin.reviews.product'),
      user: t('admin.reviews.user'),
      rating: t('admin.reviews.rating'),
      review: t('admin.reviews.review'),
      verified: t('admin.reviews.verified'),
      helpful: t('admin.reviews.helpful'),
      date: t('admin.reviews.date'),
      actions: t('admin.reviews.actions'),
    }),
    [t]
  );

  const hasActiveFilter = ratingFilter !== 'all' || searchQuery.trim() !== '';

  const starLabel = (n: number) =>
    `${n} ${n === 1 ? t('admin.reviews.star') : t('admin.reviews.stars')}`;

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard
          title={t('admin.reviews.totalReviews')}
          value={formatNumber(stats.total, locale)}
          icon={<MessageSquare className="h-5 w-5" />}
          active={ratingFilter === 'all'}
          onClick={() => setRatingFilter('all')}
        />
        <StatsCard
          title={starLabel(5)}
          value={formatNumber(stats.fiveStar, locale)}
          icon={<Star className="h-5 w-5 fill-warning text-warning" />}
          active={ratingFilter === '5'}
          onClick={() => handleStatsClick('5')}
        />
        <StatsCard
          title={starLabel(4)}
          value={formatNumber(stats.fourStar, locale)}
          icon={<Star className="h-5 w-5 fill-warning text-warning" />}
          active={ratingFilter === '4'}
          onClick={() => handleStatsClick('4')}
        />
        <StatsCard
          title={starLabel(3)}
          value={formatNumber(stats.threeStar, locale)}
          icon={<Star className="h-5 w-5 fill-warning text-warning" />}
          active={ratingFilter === '3'}
          onClick={() => handleStatsClick('3')}
        />
        <StatsCard
          title={starLabel(2)}
          value={formatNumber(stats.twoStar, locale)}
          icon={<Star className="h-5 w-5 fill-warning text-warning" />}
          active={ratingFilter === '2'}
          onClick={() => handleStatsClick('2')}
        />
        <StatsCard
          title={starLabel(1)}
          value={formatNumber(stats.oneStar, locale)}
          icon={<Star className="h-5 w-5 fill-warning text-warning" />}
          active={ratingFilter === '1'}
          onClick={() => handleStatsClick('1')}
        />
      </div>

      {/* ── DataTable Card ── */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder={t('admin.reviews.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            {/* Rating filter dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn('gap-1.5', hasActiveFilter && 'border-primary text-primary')}>
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.reviews.rating')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('admin.reviews.rating')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={ratingFilter === 'all'}
                  onCheckedChange={() => setRatingFilter('all')}
                >
                  {t('admin.reviews.allRatings')}
                </DropdownMenuCheckboxItem>
                {[5, 4, 3, 2, 1].map((n) => (
                  <DropdownMenuCheckboxItem
                    key={n}
                    checked={ratingFilter === String(n)}
                    onCheckedChange={() => setRatingFilter(String(n))}
                  >
                    {starLabel(n)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.reviews.columns')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.keys(visibleCols) as ColumnKey[]).map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col}
                    checked={visibleCols[col]}
                    onCheckedChange={(checked) =>
                      setVisibleCols((prev) => ({ ...prev, [col]: !!checked }))
                    }
                  >
                    {colLabels[col]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="space-y-px">
            <div className="h-11 bg-surface-container-low" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-outline-variant px-4 py-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="hidden h-4 w-48 lg:block" />
                <Skeleton className="hidden h-5 w-14 rounded-full lg:block" />
                <Skeleton className="hidden h-4 w-20 xl:block" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredReviews.length > 0 && selected.size === filteredReviews.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.product && (
                      <TableHead>{colLabels.product}</TableHead>
                    )}
                    {visibleCols.user && (
                      <TableHead className="hidden lg:table-cell">{colLabels.user}</TableHead>
                    )}
                    {visibleCols.rating && (
                      <TableHead>
                        <button onClick={() => toggleSort('rating')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.rating}
                          <SortIcon field="rating" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.review && (
                      <TableHead className="hidden lg:table-cell">{colLabels.review}</TableHead>
                    )}
                    {visibleCols.verified && (
                      <TableHead className="hidden xl:table-cell">{colLabels.verified}</TableHead>
                    )}
                    {visibleCols.helpful && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('helpful_count')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.helpful}
                          <SortIcon field="helpful_count" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.date && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.date}
                          <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.actions && (
                      <TableHead className="w-16 text-center">
                        {colLabels.actions}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReviews.map((review) => {
                      const product = review.products;
                      const user = review.users;
                      return (
                        <TableRow
                          key={review.id}
                          data-state={selected.has(review.id) ? 'selected' : undefined}
                        >
                          <TableCell className="w-12">
                            <Checkbox
                              checked={selected.has(review.id)}
                              onCheckedChange={() => toggleSelect(review.id)}
                              aria-label="Select review"
                            />
                          </TableCell>
                          {visibleCols.product && (
                            <TableCell>
                              <span className="truncate text-sm font-medium text-on-surface">
                                {product ? (isRTL ? product.name_ar : product.name_en) : '-'}
                              </span>
                            </TableCell>
                          )}
                          {visibleCols.user && (
                            <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
                              {user?.full_name || user?.email || '-'}
                            </TableCell>
                          )}
                          {visibleCols.rating && (
                            <TableCell>
                              <StarRating rating={review.rating} />
                            </TableCell>
                          )}
                          {visibleCols.review && (
                            <TableCell className="hidden max-w-xs lg:table-cell">
                              <p className="truncate text-sm text-on-surface-variant">
                                {review.review_text || '-'}
                              </p>
                            </TableCell>
                          )}
                          {visibleCols.verified && (
                            <TableCell className="hidden xl:table-cell">
                              {review.is_verified_purchase ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                  <CheckCircle className="h-3 w-3" />
                                  {t('admin.reviews.verified')}
                                </span>
                              ) : (
                                <span className="text-sm text-on-surface-variant">-</span>
                              )}
                            </TableCell>
                          )}
                          {visibleCols.helpful && (
                            <TableCell className="hidden text-sm tabular-nums text-on-surface-variant xl:table-cell">
                              {review.helpful_count}
                            </TableCell>
                          )}
                          {visibleCols.date && (
                            <TableCell className="hidden text-sm text-on-surface-variant xl:table-cell">
                              {formatDate(review.created_at, locale)}
                            </TableCell>
                          )}
                          {visibleCols.actions && (
                            <TableCell className="w-16 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setReviewToDelete(review);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="me-2 h-4 w-4" />
                                    {t('admin.reviews.delete')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-outline-variant md:hidden">
              {filteredReviews.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                filteredReviews.map((review) => {
                  const product = review.products;
                  const user = review.users;
                  return (
                    <div key={review.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {product ? (isRTL ? product.name_ar : product.name_en) : '-'}
                          </p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {user?.full_name || user?.email || '-'}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setReviewToDelete(review);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="me-2 h-4 w-4" />
                              {t('admin.reviews.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StarRating rating={review.rating} />
                        {review.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                            <CheckCircle className="h-3 w-3" />
                            {t('admin.reviews.verified')}
                          </span>
                        )}
                      </div>
                      {review.review_text && (
                        <p className="line-clamp-2 text-sm text-on-surface-variant">
                          {review.review_text}
                        </p>
                      )}
                      <p className="text-xs text-on-surface-variant">
                        {formatDate(review.created_at, locale)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── Footer: Rows per page + Pagination ── */}
        <div className="flex flex-col gap-3 border-t border-outline-variant px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span>{t('admin.reviews.rowsPerPage')}</span>
            <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info + controls */}
          <div className="flex items-center gap-4">
            <span className="text-sm tabular-nums text-on-surface-variant">
              {total === 0
                ? t('admin.dashboard.noData')
                : `${showFrom}-${showTo} / ${total}`}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
                title="First"
              >
                <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <span className="min-w-[4rem] text-center text-sm tabular-nums text-on-surface-variant">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0"
                title="Last"
              >
                <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      </div>

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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin.reviews.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
