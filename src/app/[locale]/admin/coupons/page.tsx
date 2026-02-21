'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CouponFormDialog } from '@/components/admin/coupon-form-dialog';
import { cn } from '@/lib/utils';
import {
  Ticket,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

export interface CouponRow {
  id: string;
  store_id: string;
  code: string;
  description_ar: string | null;
  description_en: string | null;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number | null;
  min_purchase: number | null;
  max_discount: number | null;
  is_active: boolean;
  usage_count: number;
  expires_at: string | null;
  created_at: string;
  store?: {
    id: string;
    name_ar: string;
    name_en: string;
  };
}

interface StoreOption {
  id: string;
  name_ar: string;
  name_en: string;
}

type CouponStatus = 'active' | 'inactive' | 'expired';

// ─── Helpers ──────────────────────────────────────────────

function getCouponStatus(coupon: CouponRow): CouponStatus {
  if (!coupon.is_active) return 'inactive';
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) return 'expired';
  return 'active';
}

function formatDiscount(
  coupon: CouponRow,
  t: (key: string) => string
): string {
  if (coupon.discount_type === 'free_shipping') {
    return t('coupons.freeShipping');
  }
  if (coupon.discount_type === 'percentage') {
    return `${coupon.discount_value ?? 0}%`;
  }
  // fixed_amount
  return `${coupon.discount_value ?? 0} SAR`;
}

// ─── Sub-components ───────────────────────────────────────

function StatsCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <p className="tabular-nums text-xl font-bold text-on-surface">
              {value.toLocaleString()}
            </p>
          )}
          <p className="truncate text-xs text-on-surface-variant">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: CouponStatus;
  t: (key: string) => string;
}) {
  const cfg: Record<CouponStatus, string> = {
    active: 'bg-success/10 text-success',
    expired: 'bg-warning/10 text-warning',
    inactive: 'bg-on-surface/10 text-on-surface-variant',
  };
  const dotCfg: Record<CouponStatus, string> = {
    active: 'bg-success',
    expired: 'bg-warning',
    inactive: 'bg-on-surface-variant',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg[status]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotCfg[status])} />
      {t(`coupons.status.${status}`)}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function AdminCouponsPage() {
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations();
  const { toast } = useToast();
  const isRTL = locale === 'ar';

  // Data
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>('all');

  // Dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Data loading ───────────────────────────────────────

  const loadStores = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons?stores_only=true');
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (e) {
      console.error('Error loading stores:', e);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (storeFilter !== 'all') params.set('store_id', storeFilter);

      const res = await fetch(`/api/admin/coupons?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch coupons');

      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (e) {
      console.error('Error loading coupons:', e);
      toast({
        title: t('common.error'),
        description: t('coupons.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, storeFilter, t, toast]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  // ─── Stats ──────────────────────────────────────────────

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => getCouponStatus(c) === 'active').length;
  const expiredCoupons = coupons.filter((c) => getCouponStatus(c) === 'expired').length;

  // ─── Handlers ───────────────────────────────────────────

  const handleAdd = () => {
    setEditingCoupon(null);
    setFormOpen(true);
  };

  const handleEdit = (coupon: CouponRow) => {
    setEditingCoupon(coupon);
    setFormOpen(true);
  };

  const handleToggleActive = async (coupon: CouponRow) => {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update coupon');
      }

      toast({
        title: t('coupons.updated'),
        description: coupon.is_active
          ? t('coupons.deactivated')
          : t('coupons.activated'),
      });

      loadCoupons();
    } catch (error) {
      console.error('Error toggling coupon:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error ? error.message : t('coupons.updateError'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete coupon');
      }

      toast({
        title: t('coupons.deleted'),
        description: t('coupons.deleteSuccess'),
      });

      setDeletingId(null);
      loadCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast({
        title: t('common.error'),
        description:
          error instanceof Error ? error.message : t('coupons.deleteError'),
        variant: 'destructive',
      });
    }
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingCoupon(null);
    loadCoupons();
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">
            {t('coupons.title')}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t('coupons.subtitle')}
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('coupons.addCoupon')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatsCard
          title={t('coupons.totalCoupons')}
          value={totalCoupons}
          icon={<Ticket className="h-5 w-5" />}
          loading={loading}
        />
        <StatsCard
          title={t('coupons.activeCoupons')}
          value={activeCoupons}
          icon={<CheckCircle className="h-5 w-5" />}
          loading={loading}
        />
        <StatsCard
          title={t('coupons.expiredCoupons')}
          value={expiredCoupons}
          icon={<Clock className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* DataTable Card */}
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder={t('coupons.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          {/* Store filter */}
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('coupons.allStores')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('coupons.allStores')}</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {isRTL ? store.name_ar : store.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-px">
            <div className="h-11 bg-surface-container-low" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-t border-outline-variant px-4 py-3"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="hidden h-4 w-24 lg:block" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <EmptyState
            icon={<Ticket className="h-12 w-12" />}
            title={t('coupons.noCoupons')}
            description={t('coupons.noCouponsDescription')}
            action={{
              label: t('coupons.addCoupon'),
              onClick: handleAdd,
            }}
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                    <TableHead>{t('coupons.code')}</TableHead>
                    <TableHead>{t('coupons.store')}</TableHead>
                    <TableHead>{t('coupons.discount')}</TableHead>
                    <TableHead>{t('coupons.statusLabel')}</TableHead>
                    <TableHead>{t('coupons.usageCount')}</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      {t('coupons.expires')}
                    </TableHead>
                    <TableHead className="w-16 text-center">
                      {t('coupons.actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => {
                    const status = getCouponStatus(coupon);
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium text-on-surface">
                            {coupon.code}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-on-surface-variant">
                          {coupon.store
                            ? isRTL
                              ? coupon.store.name_ar
                              : coupon.store.name_en
                            : '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums text-on-surface-variant">
                          {formatDiscount(coupon, t)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={status} t={t} />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums text-on-surface-variant">
                          {coupon.usage_count}
                        </TableCell>
                        <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
                          {coupon.expires_at
                            ? new Date(coupon.expires_at).toLocaleDateString(
                                isRTL ? 'ar-SA' : 'en-US',
                                {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                }
                              )
                            : t('coupons.noExpiry')}
                        </TableCell>
                        <TableCell className="w-16 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEdit(coupon)}
                              >
                                <Pencil className="me-2 h-4 w-4" />
                                {t('coupons.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(coupon)}
                              >
                                <Power className="me-2 h-4 w-4" />
                                {coupon.is_active
                                  ? t('coupons.deactivate')
                                  : t('coupons.activate')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-error focus:text-error"
                                onClick={() => {
                                  if (deletingId === coupon.id) {
                                    handleDelete(coupon.id);
                                  } else {
                                    setDeletingId(coupon.id);
                                    // Reset confirmation after 3 seconds
                                    setTimeout(
                                      () => setDeletingId(null),
                                      3000
                                    );
                                  }
                                }}
                              >
                                <Trash2 className="me-2 h-4 w-4" />
                                {deletingId === coupon.id
                                  ? t('coupons.confirmDelete')
                                  : t('coupons.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-outline-variant md:hidden">
              {coupons.map((coupon) => {
                const status = getCouponStatus(coupon);
                return (
                  <div
                    key={coupon.id}
                    className="flex items-start gap-3 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-medium text-on-surface">
                        {coupon.code}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                        {coupon.store
                          ? isRTL
                            ? coupon.store.name_ar
                            : coupon.store.name_en
                          : '-'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={status} t={t} />
                        <span className="text-xs tabular-nums text-on-surface-variant">
                          {formatDiscount(coupon, t)}
                        </span>
                        <span className="text-xs tabular-nums text-on-surface-variant">
                          {t('coupons.used')}: {coupon.usage_count}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEdit(coupon)}
                        >
                          <Pencil className="me-2 h-4 w-4" />
                          {t('coupons.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(coupon)}
                        >
                          <Power className="me-2 h-4 w-4" />
                          {coupon.is_active
                            ? t('coupons.deactivate')
                            : t('coupons.activate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-error focus:text-error"
                          onClick={() => {
                            if (deletingId === coupon.id) {
                              handleDelete(coupon.id);
                            } else {
                              setDeletingId(coupon.id);
                              setTimeout(() => setDeletingId(null), 3000);
                            }
                          }}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          {deletingId === coupon.id
                            ? t('coupons.confirmDelete')
                            : t('coupons.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Coupon Form Dialog */}
      <CouponFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingCoupon(null);
        }}
        coupon={editingCoupon}
        stores={stores}
        locale={locale}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
