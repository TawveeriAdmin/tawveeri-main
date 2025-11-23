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
import type { TransactionStatus } from '@/lib/database/types';

interface Transaction {
  id: string;
  amount: number;
  commission_amount: number | null;
  commission_rate: number | null;
  status: string;
  clicked_at: string | null;
  converted_at: string | null;
  created_at: string;
  product_stores?: {
    id: string;
    current_price: number;
    products?: {
      id: string;
      name_ar: string;
      name_en: string;
    };
    stores?: {
      id: string;
      name_ar: string;
      name_en: string;
    };
  };
  users?: {
    id: string;
    email: string | null;
    full_name: string | null;
  };
}

export default function AdminTransactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [locale, setLocale] = useState<string>('en');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const isRTL = locale === 'ar';

  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    loadTransactions();
  }, [page, statusFilter]);

  useEffect(() => {
    // Client-side filtering
    let filtered = transactions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (transaction) =>
          transaction.id.toLowerCase().includes(query) ||
          transaction.product_stores?.products?.name_en?.toLowerCase().includes(query) ||
          transaction.product_stores?.products?.name_ar?.toLowerCase().includes(query) ||
          transaction.users?.email?.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchQuery]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();

      let query = supabase
        .from('transactions')
        .select(
          `
          *,
          product_stores (
            id,
            current_price,
            products (
              id,
              name_ar,
              name_en
            ),
            stores (
              id,
              name_ar,
              name_en
            )
          ),
          users (
            id,
            email,
            full_name
          )
        `,
          { count: 'exact' }
        );

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as TransactionStatus);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      setTransactions((data as Transaction[]) || []);
      setFilteredTransactions((data as Transaction[]) || []);
      setTotal(count || 0);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'warning';
      case 'refunded':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const columns: Column<Transaction>[] = [
    {
      key: 'product',
      label: isRTL ? 'المنتج' : 'Product',
      render: (transaction) => {
        const product = transaction.product_stores?.products as any;
        return product ? (isRTL ? product.name_ar : product.name_en) : '-';
      },
    },
    {
      key: 'store',
      label: isRTL ? 'المتجر' : 'Store',
      render: (transaction) => {
        const store = transaction.product_stores?.stores as any;
        return store ? (isRTL ? store.name_ar : store.name_en) : '-';
      },
    },
    {
      key: 'user',
      label: isRTL ? 'المستخدم' : 'User',
      render: (transaction) => {
        const user = transaction.users as any;
        return user?.email || user?.full_name || '-';
      },
    },
    {
      key: 'amount',
      label: isRTL ? 'المبلغ' : 'Amount',
      render: (transaction) => `$${transaction.amount.toLocaleString()}`,
    },
    {
      key: 'commission_amount',
      label: isRTL ? 'العمولة' : 'Commission',
      render: (transaction) =>
        `$${(transaction.commission_amount || 0).toLocaleString()}`,
    },
    {
      key: 'commission_rate',
      label: isRTL ? 'نسبة العمولة' : 'Commission Rate',
      render: (transaction) => `${transaction.commission_rate || 0}%`,
    },
    {
      key: 'status',
      label: isRTL ? 'الحالة' : 'Status',
      render: (transaction) => (
        <Badge variant={getStatusBadgeVariant(transaction.status)}>
          {transaction.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: isRTL ? 'التاريخ' : 'Date',
      render: (transaction) => format(new Date(transaction.created_at), 'MMM dd, yyyy HH:mm'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isRTL ? 'المعاملات' : 'Transactions'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {isRTL ? 'عرض جميع المعاملات' : 'View all transactions'}
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={isRTL ? 'جميع الحالات' : 'All Statuses'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع الحالات' : 'All Statuses'}</SelectItem>
              <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Completed'}</SelectItem>
              <SelectItem value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</SelectItem>
              <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transactions Table */}
      <DataTable
        data={filteredTransactions}
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

