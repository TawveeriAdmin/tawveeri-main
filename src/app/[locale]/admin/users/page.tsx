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
import { UserRoleDialog } from '@/components/admin/user-role-dialog';
import { useRouter } from 'next/navigation';
import { Eye, Edit } from 'lucide-react';
import type { UserRole } from '@/lib/database/types';

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState<string>('en');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const t = useTranslations();
  const router = useRouter();
  const limit = 20;

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter]);

  useEffect(() => {
    // Client-side filtering
    let filtered = users;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.phone?.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      let query = supabase.from('users').select('*', { count: 'exact' });

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter as UserRole);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      setUsers((data as User[]) || []);
      setFilteredUsers((data as User[]) || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
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
  };

  const columns: Column<User>[] = [
    {
      key: 'full_name',
      label: locale === 'ar' ? 'الاسم' : 'Name',
      render: (user) => user.full_name || '-',
    },
    {
      key: 'email',
      label: locale === 'ar' ? 'البريد الإلكتروني' : 'Email',
      render: (user) => user.email || '-',
    },
    {
      key: 'phone',
      label: locale === 'ar' ? 'الهاتف' : 'Phone',
      render: (user) => user.phone || '-',
    },
    {
      key: 'role',
      label: locale === 'ar' ? 'الدور' : 'Role',
      render: (user) => (
        <span className="inline-flex items-center rounded-full bg-primary-100 dark:bg-primary-900 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-200">
          {user.role}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: locale === 'ar' ? 'الحالة' : 'Status',
      render: (user) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.is_active
              ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          {user.is_active ? (locale === 'ar' ? 'نشط' : 'Active') : locale === 'ar' ? 'غير نشط' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: locale === 'ar' ? 'تاريخ الانضمام' : 'Joined Date',
      render: (user) => new Date(user.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: locale === 'ar' ? 'الإجراءات' : 'Actions',
      render: (user) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditRole(user)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewDetails(user)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {locale === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {locale === 'ar' ? 'عرض وإدارة جميع المستخدمين' : 'View and manage all users'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <Input
            placeholder={locale === 'ar' ? 'بحث...' : 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={locale === 'ar' ? 'جميع الأدوار' : 'All Roles'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'ar' ? 'جميع الأدوار' : 'All Roles'}</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="customer">{locale === 'ar' ? 'عميل' : 'Customer'}</SelectItem>
              <SelectItem value="store">{locale === 'ar' ? 'متجر' : 'Store'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        data={filteredUsers}
        columns={columns}
        pagination={{
          page,
          limit,
          total,
          onPageChange: setPage,
        }}
        loading={loading}
      />

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

