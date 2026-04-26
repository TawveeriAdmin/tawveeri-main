'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { formatDate, formatNumber } from '@/lib/formatting';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { getSupabaseBrowserClient } from '@/lib/database';
import { UserRoleDialog } from '@/components/admin/user-role-dialog';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Edit,
  Users,
  UserCheck,
  UserX,
  Shield,
  Store,
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
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/database/types';

// ─── Types ────────────────────────────────────────────────
interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  stores: number;
  customers: number;
}

type SortField = 'full_name' | 'email' | 'role' | 'is_active' | 'created_at';
type SortDir = 'asc' | 'desc';
type ColumnKey = 'name' | 'email' | 'phone' | 'role' | 'status' | 'joinedDate' | 'actions';

function getErrorField(error: unknown, field: 'code' | 'message' | 'details' | 'hint' | 'status') {
  if (typeof error === 'object' && error !== null && field in error) {
    return (error as Record<string, unknown>)[field];
  }
  return undefined;
}

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
        'group flex min-h-[104px] items-center gap-3 rounded-2xl border p-4 text-start transition-all duration-200 active:scale-[0.99]',
        active
          ? 'border-[#55b295] bg-[#eaf7f2] ring-1 ring-[#55b295]/25 dark:border-[#55b295] dark:bg-[#17382e] dark:ring-[#55b295]/20'
          : 'border-[#d7ece5] bg-white hover:border-[#9fd9c9] dark:border-[#263b33] dark:bg-[#141c18] dark:hover:border-[#3f6657]'
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
          active
            ? 'bg-[#55b295] text-white'
            : 'bg-[#eaf7f2] text-[#1f6f59] dark:bg-[#1d2a23] dark:text-[#9fe4d0]'
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-black tabular-nums text-on-surface dark:text-white">
          {value}
        </p>
        <p className="truncate text-xs font-bold text-on-surface-variant dark:text-white/55">{title}</p>
      </div>
    </button>
  );
}

function RoleBadge({ role, t }: { role: UserRole; t: (k: string) => string }) {
  const cfg: Record<string, string> = {
    admin: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    customer: 'bg-[#eaf7f2] text-[#1f6f59] dark:bg-[#17382e] dark:text-[#9fe4d0]',
    store: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    guest: 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-white/60',
  };
  const labels: Record<string, string> = {
    admin: t('admin.users.admin'),
    customer: t('admin.users.customer'),
    store: t('admin.users.store'),
    guest: t('admin.users.guest'),
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black',
        cfg[role] || cfg.guest
      )}
    >
      {labels[role] || role}
    </span>
  );
}

function StatusBadge({ active, t }: { active: boolean; t: (k: string) => string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black',
        active
          ? 'bg-[#eaf7f2] text-[#1f6f59] dark:bg-[#17382e] dark:text-[#9fe4d0]'
          : 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-white/60'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-[#55b295]' : 'bg-slate-400'
        )}
      />
      {active ? t('admin.users.active') : t('admin.users.inactive')}
    </span>
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

export default function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState('en');
  const t = useTranslations();
  const router = useRouter();

  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    total: 0, active: 0, inactive: 0, admins: 0, stores: 0, customers: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    joinedDate: true,
    actions: true,
  });

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  // ─── Data loading ───────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const sb = getSupabaseBrowserClient();
      const [tot, act, ina, adm, sto, cus] = await Promise.all([
        sb.from('users').select('id', { count: 'exact', head: true }),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('is_active', false),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('role', 'store'),
        sb.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      ]);
      setStats({
        total: tot.count || 0,
        active: act.count || 0,
        inactive: ina.count || 0,
        admins: adm.count || 0,
        stores: sto.count || 0,
        customers: cus.count || 0,
      });
    } catch (e) {
      console.error('Error loading stats:', e);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const sb = getSupabaseBrowserClient();
      let q = sb.from('users').select('*', { count: 'exact' });

      if (roleFilter !== 'all') q = q.eq('role', roleFilter as UserRole);
      if (statusFilter === 'active') q = q.eq('is_active', true);
      else if (statusFilter === 'inactive') q = q.eq('is_active', false);
      if (searchQuery.trim()) {
        q = q.or(
          `full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
        );
      }

      const { data, error, count } = await q
        .order(sortField, { ascending: sortDir === 'asc' })
        .range((page - 1) * rowsPerPage, page * rowsPerPage - 1);

      if (error) {
        console.error('Error loading users:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          status: getErrorField(error, 'status'),
        });
        return;
      }
      setUsers((data as User[]) || []);
      setTotal(count || 0);
    } catch (e: unknown) {
      console.error('Error loading users:', {
        code: getErrorField(e, 'code'),
        message: getErrorField(e, 'message'),
        details: getErrorField(e, 'details'),
        hint: getErrorField(e, 'hint'),
        status: getErrorField(e, 'status'),
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, roleFilter, statusFilter, searchQuery, sortField, sortDir]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { setPage(1); }, [roleFilter, statusFilter, searchQuery, rowsPerPage]);

  // ─── Handlers ───────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setRoleDialogOpen(true);
  };

  const handleViewDetails = (user: User) => {
    router.push(`/${locale}/admin/users/${user.id}`);
  };

  const handleRoleUpdated = () => {
    setRoleDialogOpen(false);
    setSelectedUser(null);
    loadUsers();
    loadStats();
  };

  const handleStatsClick = (filter: string, type: 'role' | 'status') => {
    if (type === 'role') {
      setRoleFilter((p) => (p === filter ? 'all' : filter));
      setStatusFilter('all');
    } else {
      setStatusFilter((p) => (p === filter ? 'all' : filter));
      setRoleFilter('all');
    }
  };

  const toggleSelectAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
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
      name: t('admin.users.name'),
      email: t('admin.users.email'),
      phone: t('admin.users.phone'),
      role: t('admin.users.role'),
      status: t('admin.users.status'),
      joinedDate: t('admin.users.joinedDate'),
      actions: t('admin.users.actions'),
    }),
    [t]
  );

  const hasActiveFilter = roleFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '';
  const isRTL = locale === 'ar';
  const activeFilterLabel = roleFilter !== 'all'
    ? t(`admin.users.${roleFilter}`)
    : statusFilter !== 'all'
      ? t(`admin.users.${statusFilter}`)
      : t('admin.users.allRoles');

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-[#d7ece5] bg-white p-5 dark:border-[#263b33] dark:bg-[#141c18]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1f6f59] dark:text-[#9fe4d0]">
              {isRTL ? 'إدارة الحسابات' : 'Account operations'}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-on-surface md:text-3xl dark:text-white">
              {t('admin.users.title')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant dark:text-white/60">
              {isRTL
                ? 'راجع المستخدمين، غيّر الأدوار، وتابع حالة الحسابات من جدول واحد منظم.'
                : 'Review users, adjust roles, and track account status from one organized table.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#d7ece5] bg-[#f8fcfa] px-3 py-1.5 text-xs font-black text-on-surface-variant dark:border-[#263b33] dark:bg-[#101713] dark:text-white/60">
              {formatNumber(total, locale)} {isRTL ? 'نتيجة' : 'results'}
            </span>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe7dc] bg-[#eaf7f2] px-3 py-1.5 text-xs font-black text-[#1f6f59] transition-colors hover:border-[#55b295] dark:border-[#315145] dark:bg-[#17382e] dark:text-[#9fe4d0]"
              >
                <X className="h-3.5 w-3.5" />
                <span>{activeFilterLabel}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard
          title={t('admin.users.totalUsers')}
          value={formatNumber(stats.total, locale)}
          icon={<Users className="h-5 w-5" />}
          active={roleFilter === 'all' && statusFilter === 'all'}
          onClick={() => { setRoleFilter('all'); setStatusFilter('all'); }}
        />
        <StatsCard
          title={t('admin.users.active')}
          value={formatNumber(stats.active, locale)}
          icon={<UserCheck className="h-5 w-5" />}
          active={statusFilter === 'active'}
          onClick={() => handleStatsClick('active', 'status')}
        />
        <StatsCard
          title={t('admin.users.inactive')}
          value={formatNumber(stats.inactive, locale)}
          icon={<UserX className="h-5 w-5" />}
          active={statusFilter === 'inactive'}
          onClick={() => handleStatsClick('inactive', 'status')}
        />
        <StatsCard
          title={t('admin.users.admin')}
          value={formatNumber(stats.admins, locale)}
          icon={<Shield className="h-5 w-5" />}
          active={roleFilter === 'admin'}
          onClick={() => handleStatsClick('admin', 'role')}
        />
        <StatsCard
          title={t('admin.users.store')}
          value={formatNumber(stats.stores, locale)}
          icon={<Store className="h-5 w-5" />}
          active={roleFilter === 'store'}
          onClick={() => handleStatsClick('store', 'role')}
        />
        <StatsCard
          title={t('admin.users.customer')}
          value={formatNumber(stats.customers, locale)}
          icon={<Users className="h-5 w-5" />}
          active={roleFilter === 'customer'}
          onClick={() => handleStatsClick('customer', 'role')}
        />
      </div>

      {/* ── DataTable Card ── */}
      <div className="overflow-hidden rounded-[1.35rem] border border-[#d7ece5] bg-white dark:border-[#263b33] dark:bg-[#141c18]">

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 border-b border-[#e1f0eb] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#263b33]">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-white/45" />
            <Input
              placeholder={t('admin.users.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-2xl border-[#d7ece5] bg-[#f8fcfa] ps-9 font-semibold dark:border-[#263b33] dark:bg-[#101713] dark:text-white dark:placeholder:text-white/35"
            />
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            {/* Filters dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-11 gap-1.5 rounded-2xl border-[#d7ece5] bg-white px-4 font-black dark:border-[#263b33] dark:bg-[#101713] dark:text-white',
                    hasActiveFilter && 'border-[#55b295] text-[#1f6f59] dark:border-[#55b295] dark:text-[#9fe4d0]'
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.users.role')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('admin.users.role')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'admin', 'customer', 'store', 'guest'] as const).map((r) => (
                  <DropdownMenuCheckboxItem
                    key={r}
                    checked={roleFilter === r}
                    onCheckedChange={() => { setRoleFilter(r); setStatusFilter('all'); }}
                  >
                    {r === 'all' ? t('admin.users.allRoles') : t(`admin.users.${r}`)}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('admin.users.status')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(['all', 'active', 'inactive'] as const).map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter === s}
                    onCheckedChange={() => { setStatusFilter(s); setRoleFilter('all'); }}
                  >
                    {s === 'all' ? t('admin.users.status') : t(`admin.users.${s}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Columns dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-11 gap-1.5 rounded-2xl border-[#d7ece5] bg-white px-4 font-black dark:border-[#263b33] dark:bg-[#101713] dark:text-white">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.users.columns')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
            <div className="h-11 bg-[#f8fcfa] dark:bg-[#101713]" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-t border-[#e1f0eb] px-4 py-3 dark:border-[#263b33]">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
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
                  <TableRow className="border-[#e1f0eb] bg-[#f8fcfa] hover:bg-[#f8fcfa] dark:border-[#263b33] dark:bg-[#101713] dark:hover:bg-[#101713]">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={users.length > 0 && selected.size === users.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.name && (
                      <TableHead>
                        <button onClick={() => toggleSort('full_name')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.name}
                          <SortIcon field="full_name" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.email && (
                      <TableHead>
                        <button onClick={() => toggleSort('email')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.email}
                          <SortIcon field="email" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.phone && (
                      <TableHead className="hidden font-black text-on-surface-variant dark:text-white/60 lg:table-cell">
                        {colLabels.phone}
                      </TableHead>
                    )}
                    {visibleCols.role && (
                      <TableHead>
                        <button onClick={() => toggleSort('role')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.role}
                          <SortIcon field="role" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.status && (
                      <TableHead>
                        <button onClick={() => toggleSort('is_active')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.status}
                          <SortIcon field="is_active" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.joinedDate && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 font-black text-on-surface-variant hover:text-on-surface dark:text-white/60 dark:hover:text-white">
                          {colLabels.joinedDate}
                          <SortIcon field="created_at" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.actions && (
                      <TableHead className="w-16 text-center font-black text-on-surface-variant dark:text-white/60">
                        {colLabels.actions}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant dark:text-white/60"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow
                        key={user.id}
                        data-state={selected.has(user.id) ? 'selected' : undefined}
                        className="border-[#e1f0eb] transition-colors hover:bg-[#f8fcfa] data-[state=selected]:bg-[#eaf7f2] dark:border-[#263b33] dark:hover:bg-[#101713] dark:data-[state=selected]:bg-[#17382e]"
                      >
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selected.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={`Select ${user.full_name}`}
                          />
                        </TableCell>
                        {visibleCols.name && (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf7f2] text-xs font-black text-[#1f6f59] dark:bg-[#17382e] dark:text-[#9fe4d0]">
                                {(user.full_name || user.email || '?').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-black text-on-surface dark:text-white">
                                  {user.full_name || '-'}
                                </span>
                                <span className="block truncate font-mono text-[11px] text-on-surface-variant dark:text-white/45">
                                  {user.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        )}
                        {visibleCols.email && (
                          <TableCell className="text-sm font-semibold text-on-surface-variant dark:text-white/60" dir="ltr">
                            {user.email || '-'}
                          </TableCell>
                        )}
                        {visibleCols.phone && (
                          <TableCell className="hidden text-sm text-on-surface-variant dark:text-white/55 lg:table-cell" dir="ltr">
                            {user.phone || '-'}
                          </TableCell>
                        )}
                        {visibleCols.role && (
                          <TableCell>
                            <RoleBadge role={user.role} t={t} />
                          </TableCell>
                        )}
                        {visibleCols.status && (
                          <TableCell>
                            <StatusBadge active={user.is_active} t={t} />
                          </TableCell>
                        )}
                        {visibleCols.joinedDate && (
                          <TableCell className="hidden text-sm font-semibold text-on-surface-variant dark:text-white/55 xl:table-cell">
                            {formatDate(user.created_at, locale)}
                          </TableCell>
                        )}
                        {visibleCols.actions && (
                          <TableCell className="w-16 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl p-0 dark:text-white/70 dark:hover:bg-white/8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                                  <Eye className="me-2 h-4 w-4" />
                                  {t('admin.users.viewDetails')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditRole(user)}>
                                  <Edit className="me-2 h-4 w-4" />
                                  {t('admin.users.editRole')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-[#e1f0eb] dark:divide-[#263b33] md:hidden">
              {users.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant dark:text-white/60">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex items-start gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf7f2] text-xs font-black text-[#1f6f59] dark:bg-[#17382e] dark:text-[#9fe4d0]">
                      {(user.full_name || user.email || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-on-surface dark:text-white">
                        {user.full_name || '-'}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant dark:text-white/55" dir="ltr">
                        {user.email || user.phone || '-'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RoleBadge role={user.role} t={t} />
                        <StatusBadge active={user.is_active} t={t} />
                        <span className="text-xs font-semibold text-on-surface-variant dark:text-white/50">
                          {new Date(user.created_at).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US',
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 rounded-xl p-0 dark:text-white/70 dark:hover:bg-white/8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                          <Eye className="me-2 h-4 w-4" />
                          {t('admin.users.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditRole(user)}>
                          <Edit className="me-2 h-4 w-4" />
                          {t('admin.users.editRole')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Footer: Rows per page + Pagination ── */}
        <div className="flex flex-col gap-3 border-t border-[#e1f0eb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#263b33]">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant dark:text-white/60">
            <span>{t('admin.users.rowsPerPage')}</span>
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
            <span className="font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60">
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
              <span className="min-w-[4rem] text-center font-mono text-sm tabular-nums text-on-surface-variant dark:text-white/60">
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

      {/* Role Dialog */}
      {selectedUser && (
        <UserRoleDialog
          open={roleDialogOpen}
          onOpenChange={setRoleDialogOpen}
          user={selectedUser}
          onSuccess={handleRoleUpdated}
          locale={locale}
        />
      )}
    </div>
  );
}
