'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/admin/data-table';
import { format } from 'date-fns';

interface UserDetailTabsProps {
  locale: string;
  wishlists: any[];
  searchHistory: any[];
  priceAlerts: any[];
  productReviews: any[];
}

export function UserDetailTabs({
  locale,
  wishlists,
  searchHistory,
  priceAlerts,
  productReviews,
}: UserDetailTabsProps) {
  const isRTL = locale === 'ar';

  const wishlistColumns: Column<any>[] = [
    {
      key: 'product',
      label: isRTL ? 'المنتج' : 'Product',
      render: (row) => {
        const product = row.products as any;
        return product ? (isRTL ? product.name_ar : product.name_en) : '-';
      },
    },
    {
      key: 'created_at',
      label: isRTL ? 'تاريخ الإضافة' : 'Added Date',
      render: (row) => format(new Date(row.created_at), 'MMM dd, yyyy'),
    },
  ];

  const searchColumns: Column<any>[] = [
    {
      key: 'search_query',
      label: isRTL ? 'البحث' : 'Search Query',
    },
    {
      key: 'results_count',
      label: isRTL ? 'عدد النتائج' : 'Results',
    },
    {
      key: 'created_at',
      label: isRTL ? 'التاريخ' : 'Date',
      render: (row) => format(new Date(row.created_at), 'MMM dd, yyyy HH:mm'),
    },
  ];

  const alertColumns: Column<any>[] = [
    {
      key: 'product',
      label: isRTL ? 'المنتج' : 'Product',
      render: (row) => {
        const product = row.products as any;
        return product ? (isRTL ? product.name_ar : product.name_en) : '-';
      },
    },
    {
      key: 'target_price',
      label: isRTL ? 'السعر المستهدف' : 'Target Price',
    },
    {
      key: 'is_active',
      label: isRTL ? 'الحالة' : 'Status',
      render: (row) => (
        <span className={row.is_active ? 'text-success' : 'text-on-surface-variant'}>
          {row.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
        </span>
      ),
    },
  ];

  const reviewColumns: Column<any>[] = [
    {
      key: 'product',
      label: isRTL ? 'المنتج' : 'Product',
      render: (row) => {
        const product = row.products as any;
        return product ? (isRTL ? product.name_ar : product.name_en) : '-';
      },
    },
    {
      key: 'rating',
      label: isRTL ? 'التقييم' : 'Rating',
      render: (row) => `${row.rating}/5`,
    },
    {
      key: 'created_at',
      label: isRTL ? 'التاريخ' : 'Date',
      render: (row) => format(new Date(row.created_at), 'MMM dd, yyyy'),
    },
  ];

  const emptyMsg = isRTL ? 'لا توجد بيانات' : 'No data available';

  return (
    <Tabs defaultValue="wishlists" className="space-y-4">
      <TabsList>
        <TabsTrigger value="wishlists">
          {isRTL ? 'قوائم الأمنيات' : 'Wishlists'}
        </TabsTrigger>
        <TabsTrigger value="searches">
          {isRTL ? 'عمليات البحث' : 'Search History'}
        </TabsTrigger>
        <TabsTrigger value="alerts">
          {isRTL ? 'تنبيهات الأسعار' : 'Price Alerts'}
        </TabsTrigger>
        <TabsTrigger value="reviews">
          {isRTL ? 'التقييمات' : 'Reviews'}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="wishlists">
        {wishlists.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">{emptyMsg}</div>
        ) : (
          <DataTable data={wishlists} columns={wishlistColumns} />
        )}
      </TabsContent>

      <TabsContent value="searches">
        {searchHistory.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">{emptyMsg}</div>
        ) : (
          <DataTable data={searchHistory} columns={searchColumns} />
        )}
      </TabsContent>

      <TabsContent value="alerts">
        {priceAlerts.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">{emptyMsg}</div>
        ) : (
          <DataTable data={priceAlerts} columns={alertColumns} />
        )}
      </TabsContent>

      <TabsContent value="reviews">
        {productReviews.length === 0 ? (
          <div className="py-8 text-center text-on-surface-variant">{emptyMsg}</div>
        ) : (
          <DataTable data={productReviews} columns={reviewColumns} />
        )}
      </TabsContent>
    </Tabs>
  );
}
