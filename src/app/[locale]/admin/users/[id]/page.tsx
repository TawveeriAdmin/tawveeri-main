import { notFound } from 'next/navigation';
import { createClient } from '@/lib/auth/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { UserDetailTabs } from './user-detail-tabs';

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

  // Fetch user analytics from actual tables
  const [wishlistCount, searchCount, alertCount, reviewCount] = await Promise.all([
    supabase.from('user_wishlists').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('search_history').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('price_alerts').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('product_reviews').select('id', { count: 'exact', head: true }).eq('user_id', id),
  ]);
  const analytics = {
    total_wishlists: wishlistCount.count || 0,
    total_searches: searchCount.count || 0,
    total_price_alerts: alertCount.count || 0,
    total_reviews: reviewCount.count || 0,
  };

  // Fetch tab data
  const [wishlistsRes, searchHistoryRes, priceAlertsRes, productReviewsRes] = await Promise.all([
    supabase
      .from('user_wishlists')
      .select('*, products (id, name_ar, name_en, image_urls)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('search_history')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('price_alerts')
      .select('*, products (id, name_ar, name_en)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('product_reviews')
      .select('*, products (id, name_ar, name_en)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const userInitials = user.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || ''} alt={user.full_name || ''} />
              <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-headline-md text-on-surface">
                {user.full_name || 'No Name'}
              </h2>
              <p className="text-on-surface-variant">{user.email || user.phone || '-'}</p>
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
              <p className="text-label-lg text-on-surface-variant">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </p>
              <p className="mt-1 text-on-surface">{user.email || '-'}</p>
            </div>
            <div>
              <p className="text-label-lg text-on-surface-variant">
                {isRTL ? 'الهاتف' : 'Phone'}
              </p>
              <p className="mt-1 text-on-surface">{user.phone || '-'}</p>
            </div>
            <div>
              <p className="text-label-lg text-on-surface-variant">
                {isRTL ? 'تاريخ الانضمام' : 'Joined Date'}
              </p>
              <p className="mt-1 text-on-surface">
                {format(new Date(user.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-label-lg text-on-surface-variant">
                {isRTL ? 'آخر تسجيل دخول' : 'Last Login'}
              </p>
              <p className="mt-1 text-on-surface">
                {user.last_login_at
                  ? format(new Date(user.last_login_at), 'MMM dd, yyyy HH:mm')
                  : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Statistics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-label-lg">
              {isRTL ? 'قوائم الأمنيات' : 'Wishlists'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-headline-md">{analytics.total_wishlists}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-label-lg">
              {isRTL ? 'عمليات البحث' : 'Searches'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-headline-md">{analytics.total_searches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-label-lg">
              {isRTL ? 'تنبيهات الأسعار' : 'Price Alerts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-headline-md">{analytics.total_price_alerts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-label-lg">
              {isRTL ? 'التقييمات' : 'Reviews'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-headline-md">{analytics.total_reviews}</p>
          </CardContent>
        </Card>
      </div>

      {/* User Data Tabs (client component) */}
      <UserDetailTabs
        locale={locale}
        wishlists={wishlistsRes.data || []}
        searchHistory={searchHistoryRes.data || []}
        priceAlerts={priceAlertsRes.data || []}
        productReviews={productReviewsRes.data || []}
      />
    </div>
  );
}
