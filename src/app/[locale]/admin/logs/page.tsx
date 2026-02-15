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
import { getSupabaseBrowserClient } from '@/lib/database';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  user_id: string | null;
  users?: {
    email: string | null;
    full_name: string | null;
    role: string;
  };
}

export default function AdminLogsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState<string>('en');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const isRTL = locale === 'ar';

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, entityTypeFilter]);

  useEffect(() => {
    // Client-side filtering
    let filtered = logs;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(query) ||
          log.entity_type?.toLowerCase().includes(query) ||
          log.users?.email?.toLowerCase().includes(query) ||
          log.users?.full_name?.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchQuery]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      let query = supabase
        .from('admin_logs')
        .select(
          `
          *,
          users (
            email,
            full_name,
            role
          )
        `,
          { count: 'exact' }
        );

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (entityTypeFilter !== 'all') {
        query = query.eq('entity_type', entityTypeFilter);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      setLogs((data as AuditLog[]) || []);
      setFilteredLogs((data as AuditLog[]) || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique actions and entity types for filters
  const actions = Array.from(new Set(logs.map((log) => log.action)));
  const entityTypes = Array.from(
    new Set(logs.map((log) => log.entity_type).filter(Boolean))
  );

  const columns: Column<AuditLog>[] = [
    {
      key: 'created_at',
      label: isRTL ? 'التاريخ' : 'Date',
      render: (log) => format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss'),
    },
    {
      key: 'action',
      label: isRTL ? 'الإجراء' : 'Action',
      render: (log) => (
        <span className="font-medium text-primary-600 dark:text-primary-400">
          {log.action}
        </span>
      ),
    },
    {
      key: 'entity_type',
      label: isRTL ? 'النوع' : 'Entity Type',
      render: (log) => log.entity_type || '-',
    },
    {
      key: 'user',
      label: isRTL ? 'المستخدم' : 'User',
      render: (log) => {
        const user = log.users as any;
        return user?.email || user?.full_name || (isRTL ? 'النظام' : 'System');
      },
    },
    {
      key: 'details',
      label: isRTL ? 'التفاصيل' : 'Details',
      render: (log) => {
        if (!log.details) return '-';
        return (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {JSON.stringify(log.details).substring(0, 50)}...
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isRTL ? 'سجلات النظام' : 'System Logs'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {isRTL ? 'عرض جميع سجلات النظام والأنشطة' : 'View all system logs and activities'}
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
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={isRTL ? 'جميع الإجراءات' : 'All Actions'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع الإجراءات' : 'All Actions'}</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={isRTL ? 'جميع الأنواع' : 'All Types'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع الأنواع' : 'All Types'}</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type || ''} value={type || ''}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <DataTable
        data={filteredLogs}
        columns={columns}
        pagination={{
          page,
          limit,
          total,
          onPageChange: setPage,
        }}
        loading={loading}
      />
    </div>
  );
}

