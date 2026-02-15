import { notFound } from 'next/navigation';
import { createClient } from '@/lib/auth/server';
import { getUserAnalytics } from '@/lib/admin/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/admin/data-table';
import { format } from 'date-fns';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isRTL = locale === 'ar';
  const supabase = await createClient();

  // Fetch user data
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (userError || !user) {
    notFound();
  }

  // Fetch user analytics
  const analyticsResult = await getUserAnalytics(id);
  const analytics = analyticsResult.data;

  // Fetch user wishlists
  const { data: wishlists } = await supabase
    .from('user_wishlists')
    .select(
      `
      *,
      products (
        id,
        name_ar,
        name_en,
        image_urls
      )
    `
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch user search history
  const { data: searchHistory } = await supabase
    .from('search_history')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch user price alerts
  const { data: priceAlerts } = await supabase
    .from('price_alerts')
    .select(
      `
      *,
      products (
        id,
        name_ar,
        name_en
      )
    `
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch user reviews
  const { data: productReviews } = await supabase
    .from('product_reviews')
    .select(
      `
      *,
      products (
        id,
        name_ar,
        name_en
      )
    `
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  const userInitials = user.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isRTL ? 'تفاصيل المستخدم' : 'User Details'}
        </h1>
      </div>

      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || ''} alt={user.full_name || ''} />
              <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {user.full_name || 'No Name'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{user.email || user.phone || '-'}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? (isRTL ? 'نشط' : 'Active') : isRTL ? 'غير نشط' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </p>
              <p className="mt-1 text-gray-900 dark:text-white">{user.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'الهاتف' : 'Phone'}
              </p>
              <p className="mt-1 text-gray-900 dark:text-white">{user.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'تاريخ الانضمام' : 'Joined Date'}
              </p>
              <p className="mt-1 text-gray-900 dark:text-white">
                {format(new Date(user.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isRTL ? 'آخر تسجيل دخول' : 'Last Login'}
              </p>
              <p className="mt-1 text-gray-900 dark:text-white">
                {user.last_login_at
                  ? format(new Date(user.last_login_at), 'MMM dd, yyyy HH:mm')
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Statistics */}
      {analytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'قوائم الأمنيات' : 'Wishlists'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.total_wishlists}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'عمليات البحث' : 'Searches'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.total_searches}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'تنبيهات الأسعار' : 'Price Alerts'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.total_price_alerts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {isRTL ? 'المقارنات' : 'Comparisons'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.total_comparisons}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Data Tabs */}
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
          <DataTable
            data={wishlists || []}
            columns={wishlistColumns}
          />
        </TabsContent>

        <TabsContent value="searches">
          <DataTable
            data={searchHistory || []}
            columns={searchColumns}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {isRTL ? 'لا توجد تنبيهات أسعار' : 'No price alerts'}
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {isRTL ? 'لا توجد تقييمات' : 'No reviews'}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

