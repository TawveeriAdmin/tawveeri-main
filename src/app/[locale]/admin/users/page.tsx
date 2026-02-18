'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

// ─── Sub-components ───────────────────────────────────────

function StatsCard({
  title,
  value,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: number;
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
          {value.toLocaleString()}
        </p>
        <p className="truncate text-xs text-on-surface-variant">{title}</p>
      </div>
    </button>
  );
}

function RoleBadge({ role, t }: { role: UserRole; t: (k: string) => string }) {
  const cfg: Record<string, string> = {
    admin: 'bg-error/10 text-error',
    customer: 'bg-primary/10 text-primary',
    store: 'bg-tertiary/10 text-tertiary',
    guest: 'bg-on-surface/10 text-on-surface-variant',
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
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
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        active
          ? 'bg-success/10 text-success'
          : 'bg-on-surface/10 text-on-surface-variant'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-success' : 'bg-on-surface-variant'
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
          status: (error as any).status,
        });
        return;
      }
      setUsers((data as User[]) || []);
      setTotal(count || 0);
    } catch (e: any) {
      console.error('Error loading users:', {
        code: e?.code,
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        status: e?.status,
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

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard
          title={t('admin.users.totalUsers')}
          value={stats.total}
          icon={<Users className="h-5 w-5" />}
          active={roleFilter === 'all' && statusFilter === 'all'}
          onClick={() => { setRoleFilter('all'); setStatusFilter('all'); }}
        />
        <StatsCard
          title={t('admin.users.active')}
          value={stats.active}
          icon={<UserCheck className="h-5 w-5" />}
          active={statusFilter === 'active'}
          onClick={() => handleStatsClick('active', 'status')}
        />
        <StatsCard
          title={t('admin.users.inactive')}
          value={stats.inactive}
          icon={<UserX className="h-5 w-5" />}
          active={statusFilter === 'inactive'}
          onClick={() => handleStatsClick('inactive', 'status')}
        />
        <StatsCard
          title={t('admin.users.admin')}
          value={stats.admins}
          icon={<Shield className="h-5 w-5" />}
          active={roleFilter === 'admin'}
          onClick={() => handleStatsClick('admin', 'role')}
        />
        <StatsCard
          title={t('admin.users.store')}
          value={stats.stores}
          icon={<Store className="h-5 w-5" />}
          active={roleFilter === 'store'}
          onClick={() => handleStatsClick('store', 'role')}
        />
        <StatsCard
          title={t('admin.users.customer')}
          value={stats.customers}
          icon={<Users className="h-5 w-5" />}
          active={roleFilter === 'customer'}
          onClick={() => handleStatsClick('customer', 'role')}
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
              placeholder={t('admin.users.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            {/* Filters dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn('gap-1.5', hasActiveFilter && 'border-primary text-primary')}>
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.users.role')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Columns3 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('admin.users.columns')}</span>
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
                  <TableRow className="bg-surface-container-low hover:bg-surface-container-low">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={users.length > 0 && selected.size === users.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    {visibleCols.name && (
                      <TableHead>
                        <button onClick={() => toggleSort('full_name')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.name}
                          <SortIcon field="full_name" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.email && (
                      <TableHead>
                        <button onClick={() => toggleSort('email')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.email}
                          <SortIcon field="email" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.phone && (
                      <TableHead className="hidden lg:table-cell">
                        {colLabels.phone}
                      </TableHead>
                    )}
                    {visibleCols.role && (
                      <TableHead>
                        <button onClick={() => toggleSort('role')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.role}
                          <SortIcon field="role" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.status && (
                      <TableHead>
                        <button onClick={() => toggleSort('is_active')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.status}
                          <SortIcon field="is_active" sortField={sortField} sortDir={sortDir} />
                        </button>
                      </TableHead>
                    )}
                    {visibleCols.joinedDate && (
                      <TableHead className="hidden xl:table-cell">
                        <button onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-on-surface">
                          {colLabels.joinedDate}
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
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Object.values(visibleCols).filter(Boolean).length + 1}
                        className="py-20 text-center text-on-surface-variant"
                      >
                        {t('admin.dashboard.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow
                        key={user.id}
                        data-state={selected.has(user.id) ? 'selected' : undefined}
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
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {(user.full_name || user.email || '?').substring(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate text-sm font-medium text-on-surface">
                                {user.full_name || '-'}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {visibleCols.email && (
                          <TableCell className="text-sm text-on-surface-variant">
                            {user.email || '-'}
                          </TableCell>
                        )}
                        {visibleCols.phone && (
                          <TableCell className="hidden text-sm text-on-surface-variant lg:table-cell">
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
                          <TableCell className="hidden text-sm text-on-surface-variant xl:table-cell">
                            {new Date(user.created_at).toLocaleDateString(
                              locale === 'ar' ? 'ar-SA' : 'en-US',
                              { year: 'numeric', month: 'short', day: 'numeric' }
                            )}
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
            <div className="divide-y divide-outline-variant md:hidden">
              {users.length === 0 ? (
                <div className="py-20 text-center text-on-surface-variant">
                  {t('admin.dashboard.noData')}
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex items-start gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {(user.full_name || user.email || '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {user.full_name || '-'}
                      </p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {user.email || user.phone || '-'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RoleBadge role={user.role} t={t} />
                        <StatusBadge active={user.is_active} t={t} />
                        <span className="text-xs text-on-surface-variant">
                          {new Date(user.created_at).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US',
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
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
        <div className="flex flex-col gap-3 border-t border-outline-variant px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
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
