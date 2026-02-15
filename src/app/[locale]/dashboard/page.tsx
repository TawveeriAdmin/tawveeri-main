'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Heart,
  BarChart3,
  Bell,
  TrendingUp,
  Package,
  AlertCircle,
  ArrowRight,
  LogIn,
  Lightbulb,
  Sparkles,
  Clock3,
} from 'lucide-react';
import type { ProductCategory } from '@/lib/database/types';

const RECENTLY_VIEWED_KEY = 'tawveeri.recentlyViewedProducts';
const COMPARE_HISTORY_KEY = 'compare_products';

interface RecentSearch {
  id: string;
  search_query: string;
  category: ProductCategory | null;
  results_count: number | null;
  created_at: string;
}

interface PriceAlert {
  id: string;
  target_price: number;
  is_active: boolean;
  products: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    product_stores: Array<{
      current_price: number;
    }>;
  };
}

interface NotificationItem {
  id: string;
  type: string;
  title_ar: string;
  title_en: string;
  message_ar: string | null;
  message_en: string | null;
  is_read: boolean;
  created_at: string;
  products: {
    id: string;
    slug: string;
  } | null;
}

interface DashboardProduct {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  category: ProductCategory;
  brand: string;
  model: string;
  image_urls: string[] | null;
  product_stores: Array<{
    id: string;
    current_price: number;
    original_price: number | null;
    availability: string;
    stores: {
      id: string;
      name_ar: string;
      name_en: string;
      logo_url: string | null;
    };
  }>;
}

interface DashboardStats {
  wishlist: number;
  priceAlerts: number;
  savedSearches: number;
  notifications: number;
  comparisons: number;
  recentlyViewed: number;
}

const DEFAULT_STATS: DashboardStats = {
  wishlist: 0,
  priceAlerts: 0,
  savedSearches: 0,
  notifications: 0,
  comparisons: 0,
  recentlyViewed: 0,
};

export default function DashboardPage() {
  const supabase = useMemo(
    () => (typeof window !== 'undefined' ? getSupabaseBrowserClient() : null),
    []
  );
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();

  const [wishlistCount, setWishlistCount] = useState<number>(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favorites, setFavorites] = useState<DashboardProduct[]>([]);
  const [recommendations, setRecommendations] = useState<DashboardProduct[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<DashboardProduct[]>([]);
  const [comparisonHistory, setComparisonHistory] = useState<DashboardProduct[]>([]);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [insights, setInsights] = useState<string[]>([]);
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(true);

  const isGuest = !user;

  const formatPrice = (value: number) =>
    value.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const fetchProductsByIds = async (ids: string[]): Promise<DashboardProduct[]> => {
    if (!supabase || !ids.length) return [];
    const { data, error } = await supabase
      .from('products')
      .select(
        `
        id,
        name_ar,
        name_en,
        slug,
        category,
        brand,
        model,
        image_urls,
        product_stores(
          id,
          current_price,
          original_price,
          availability,
          stores(
            id,
            name_ar,
            name_en,
            logo_url
          )
        )
      `
      )
      .in('id', ids);

    if (error) {
      console.error('Error fetching products by IDs:', error);
      return [];
    }

    const map = new Map<string, DashboardProduct>();
    (data as DashboardProduct[] | null)?.forEach((product) => {
      map.set(product.id, product);
    });

    return ids
      .map((id) => map.get(id))
      .filter((product): product is DashboardProduct => Boolean(product));
  };

  const loadLocalCollections = async () => {
    if (typeof window === 'undefined') return;

    try {
      const recentRaw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
      const compareRaw = window.localStorage.getItem(COMPARE_HISTORY_KEY);

      const recentIds: string[] = recentRaw ? JSON.parse(recentRaw) : [];
      const compareIds: string[] = compareRaw ? JSON.parse(compareRaw) : [];

      const uniqueRecent = Array.from(new Set(recentIds)).slice(-8).reverse();
      const uniqueCompare = Array.from(new Set(compareIds)).slice(-6).reverse();

      const [recentProducts, compareProducts] = await Promise.all([
        fetchProductsByIds(uniqueRecent),
        fetchProductsByIds(uniqueCompare),
      ]);

      setRecentlyViewed(recentProducts);
      setComparisonHistory(compareProducts);
    } catch (error) {
      console.error('Failed to load local collections:', error);
      setRecentlyViewed([]);
      setComparisonHistory([]);
    }
  };

  useEffect(() => {
    if (!supabase || authLoading) return;

    const client = supabase;

    async function fetchDashboardData() {
      if (!userId) {
        setWishlistCount(0);
        setRecentSearches([]);
        setPriceAlerts([]);
        setNotifications([]);
        setFavorites([]);
        setRecommendations([]);
        setRecentlyViewed([]);
        setComparisonHistory([]);
        setStats(DEFAULT_STATS);
        setInsights([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [wishlistRes, searchesRes, alertsRes, notificationsRes, favoritesRes] =
          await Promise.all([
            client
              .from('user_wishlists')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId),
            client
              .from('search_history')
              .select('id, search_query, category, results_count, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(10),
            client
              .from('price_alerts')
              .select(
                `
                id,
                target_price,
                is_active,
                products!inner(
                  id,
                  name_ar,
                  name_en,
                  slug,
                  product_stores(
                    current_price
                  )
                )
              `
              )
              .eq('user_id', userId)
              .eq('is_active', true)
              .limit(6),
            client
              .from('notifications')
              .select(
                `
                id,
                type,
                title_ar,
                title_en,
                message_ar,
                message_en,
                is_read,
                created_at,
                products(
                  id,
                  slug
                )
              `
              )
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(6),
            client
              .from('user_wishlists')
              .select(
                `
                products!inner(
                  id,
                  name_ar,
                  name_en,
                  slug,
                  category,
                  brand,
                  model,
                  image_urls,
                  product_stores(
                    id,
                    current_price,
                    original_price,
                    availability,
                    stores(
                      id,
                      name_ar,
                      name_en,
                      logo_url
                    )
                  )
                )
              `
              )
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(6),
          ]);

        setWishlistCount(wishlistRes.count || 0);
        setRecentSearches((searchesRes.data as RecentSearch[] | null) ?? []);
        setPriceAlerts((alertsRes.data as PriceAlert[] | null) ?? []);
        setNotifications((notificationsRes.data as NotificationItem[] | null) ?? []);

        const favoritesPayload = (favoritesRes.data as { products: DashboardProduct }[] | null) ?? [];
        setFavorites(
          favoritesPayload
            .map((entry) => entry.products)
            .filter((product): product is DashboardProduct => Boolean(product))
        );

        const primaryCategory = ((searchesRes.data as RecentSearch[] | null) || []).find(
          (search) => search.category
        )?.category;

        let recommended: DashboardProduct[] = [];

        if (primaryCategory) {
          const { data } = await client
            .from('products')
            .select(
              `
              id,
              name_ar,
              name_en,
              slug,
              category,
              brand,
              model,
              image_urls,
              product_stores(
                id,
                current_price,
                original_price,
                availability,
                stores(
                  id,
                  name_ar,
                  name_en,
                  logo_url
                )
              )
            `
            )
            .eq('category', primaryCategory)
            .eq('is_active', true)
            .order('view_count', { ascending: false })
            .limit(6);

          recommended = (data as DashboardProduct[] | null) ?? [];
        }

        if (!recommended.length) {
          const { data } = await client
            .from('products')
            .select(
              `
              id,
              name_ar,
              name_en,
              slug,
              category,
              brand,
              model,
              image_urls,
              product_stores(
                id,
                current_price,
                original_price,
                availability,
                stores(
                  id,
                  name_ar,
                  name_en,
                  logo_url
                )
              )
            `
            )
            .eq('is_active', true)
            .order('view_count', { ascending: false })
            .limit(6);
          recommended = (data as DashboardProduct[] | null) ?? [];
        }

        setRecommendations(recommended);

        await loadLocalCollections();
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [supabase, authLoading, userId, locale]);

  useEffect(() => {
    if (isGuest) {
      setStats(DEFAULT_STATS);
      return;
    }

    setStats({
      wishlist: wishlistCount,
      priceAlerts: priceAlerts.length,
      savedSearches: recentSearches.length,
      notifications: notifications.filter((notification) => !notification.is_read).length,
      comparisons: comparisonHistory.length,
      recentlyViewed: recentlyViewed.length,
    });
  }, [
    isGuest,
    wishlistCount,
    priceAlerts,
    recentSearches,
    notifications,
    comparisonHistory,
    recentlyViewed,
  ]);

  useEffect(() => {
    if (isGuest) {
      setInsights([]);
      return;
    }

    const suggestions: string[] = [];

    if (priceAlerts.length > 0) {
      suggestions.push(
        locale === 'ar'
          ? `لديك ${priceAlerts.length} ${priceAlerts.length === 1 ? 'تنبيه سعر نشط' : 'تنبيهات أسعار نشطة'}. سنخبرك فور انخفاض الأسعار.`
          : `You have ${priceAlerts.length} active price alert${priceAlerts.length === 1 ? '' : 's'}. We’ll notify you as soon as prices drop.`
      );
    }

    if (recentSearches[0]) {
      const lastSearch = recentSearches[0];
      suggestions.push(
        locale === 'ar'
          ? `بحثك الأخير عن "${lastSearch.search_query}" جاهز للاستكمال — جرب إضافة مرشحات السعر أو الماركات.`
          : `Your recent search for "${lastSearch.search_query}" is ready to continue — try refining it with filters or brand selections.`
      );
    }

    if (recommendations.length > 0) {
      const topReco = recommendations[0];
      const name = locale === 'ar' ? topReco.name_ar : topReco.name_en;
      suggestions.push(
        locale === 'ar'
          ? `لقد اخترنا ${name} بناءً على نشاطك — اطلع على السعر الأفضل أو أضفه للمقارنة.`
          : `${name} looks like a great fit based on your activity — check its best price or add it to your comparison list.`
      );
    }

    if (favorites.length > 2) {
      suggestions.push(
        locale === 'ar'
          ? 'يبدو أنك تحفظ العديد من العناصر في قائمة الأمنيات — يمكنك تشغيل تنبيهات الأسعار لهذه العناصر المهمة.'
          : 'You’re saving quite a few items — consider enabling price alerts on your favorites to catch discounts instantly.'
      );
    }

    if (comparisonHistory.length > 0) {
      suggestions.push(
        locale === 'ar'
          ? 'استخدم سجل المقارنات للعودة إلى المنتجات التي قارنتها مؤخرًا ومتابعة قرار الشراء.'
          : 'Jump back into your comparison history whenever you’re ready to decide between similar products.'
      );
    }

    setInsights(suggestions);
  }, [locale, isGuest, priceAlerts, recentSearches, recommendations, favorites, comparisonHistory]);

  const statsCards = useMemo(() => {
    if (isGuest) return [];

    return [
      {
        label: t('dashboard.wishlistItems'),
        value: stats.wishlist,
        icon: Heart,
      },
      {
        label: t('dashboard.activeAlerts'),
        value: stats.priceAlerts,
        icon: Bell,
      },
      {
        label: t('dashboard.savedSearches'),
        value: stats.savedSearches,
        icon: Search,
      },
      {
        label: t('dashboard.recentlyViewed'),
        value: stats.recentlyViewed,
        icon: Package,
      },
    ];
  }, [isGuest, stats, locale]);

  if (authLoading || !supabase || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const userName = user?.full_name || user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/${locale}`}>{t('common.home')}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('dashboard.title')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {isGuest ? t('dashboard.welcomeGuest') : `${t('dashboard.welcome')}, ${userName}!`}
          </h1>
          {isGuest && (
            <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg">
              <p className="text-primary-900 dark:text-primary-100 mb-3">
                {t('dashboard.guestMessage')}
              </p>
              <Button asChild>
                <Link href={`/${locale}/auth/login`}>
                  <LogIn className="w-4 h-4 mr-2" />
                  {t('dashboard.signInToUnlock')}
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.quickActions')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-auto py-4 justify-start">
              <Link href={`/${locale}/search`}>
                <Search className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">{t('dashboard.searchProducts')}</div>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start" disabled={isGuest}>
              <Link href={isGuest ? '#' : `/${locale}/wishlist`}>
                <Heart className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">{t('dashboard.viewWishlist')}</div>
                  {!isGuest && wishlistCount > 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {wishlistCount}{' '}
                      {locale === 'ar'
                        ? wishlistCount === 1
                          ? 'عنصر'
                          : 'عناصر'
                        : wishlistCount === 1
                        ? 'item'
                        : 'items'}
                    </div>
                  )}
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start" disabled={isGuest}>
              <Link href={isGuest ? '#' : `/${locale}/compare`}>
                <BarChart3 className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">{t('dashboard.compareProducts')}</div>
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 justify-start" disabled={isGuest}>
              <Link href={isGuest ? '#' : `/${locale}/settings`}>
                <Bell className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">
                    {t('dashboard.manageSettings')}
                  </div>
                </div>
              </Link>
            </Button>
          </div>
        </div>

        {isGuest ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.wishlistCount')}</CardTitle>
                <CardDescription>{t('dashboard.signInToUnlock')}</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={<Heart className="h-12 w-12" />}
                  title={t('dashboard.signInToUnlock')}
                  action={{
                    label: t('common.login'),
                    onClick: () => router.push(`/${locale}/auth/login`),
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recentSearches')}</CardTitle>
                <CardDescription>{t('dashboard.signInToUnlock')}</CardDescription>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={<Search className="h-12 w-12" />}
                  title={t('dashboard.signInToUnlock')}
                  action={{
                    label: t('common.login'),
                    onClick: () => router.push(`/${locale}/auth/login`),
                  }}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {statsCards.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map(({ label, value, icon: Icon }) => (
                  <Card key={label}>
                    <CardContent className="flex items-center justify-between py-6">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                      </div>
                      <span className="rounded-full p-2 bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300">
                        <Icon className="w-5 h-5" />
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {insights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                    {t('dashboard.smartInsights')}
                  </CardTitle>
                  <CardDescription>
                    {locale === 'ar'
                      ? 'نصائح مخصصة بناءً على نشاطك الأخير.'
                      : 'Personalized tips based on your recent activity.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.map((insight, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <Lightbulb className="w-4 h-4 text-primary-500 mt-1" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('dashboard.recommendedForYou')}
                </h2>
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('dashboard.basedOnActivity')}
                </Badge>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={`recommend-skeleton-${i}`} className="h-64 w-full" />
                  ))}
                </div>
              ) : recommendations.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="h-10 w-10" />}
                  title={t('dashboard.noRecommendations')}
                  description={
                    locale === 'ar'
                      ? 'تابع البحث وحفظ المنتجات لتحصل على اقتراحات مخصصة.'
                      : 'Keep exploring and saving products to unlock smarter suggestions.'
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendations.slice(0, 6).map((product) => (
                    <Card key={`recommend-${product.id}`} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <Link href={`/${locale}/products/${product.slug}`} className="block">
                          <p className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {locale === 'ar' ? product.name_ar : product.name_en}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {product.brand} · {product.model}
                          </p>
                        </Link>
                        {product.image_urls?.[0] ? (
                          <img
                            src={product.image_urls[0]}
                            alt={locale === 'ar' ? product.name_ar : product.name_en}
                            className="w-full h-40 object-cover rounded-lg border border-gray-100 dark:border-gray-800"
                          />
                        ) : (
                          <div className="w-full h-40 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-500">
                            {t('dashboard.noImage')}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-primary-600 dark:text-primary-300">
                            {product.product_stores?.length
                              ? `${formatPrice(product.product_stores[0].current_price)} ر.س`
                              : locale === 'ar'
                              ? 'السعر غير متاح'
                              : 'Price unavailable'}
                          </span>
                          <Link
                            href={`/${locale}/products/${product.slug}`}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-300 hover:underline"
                          >
                            {t('dashboard.viewDetails')}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Favorites */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('dashboard.favorites')}
                </h2>
                <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/wishlist`)}>
                  {t('dashboard.openWishlist')}
                </Button>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={`favorite-skeleton-${i}`} className="h-56 w-full" />
                  ))}
                </div>
              ) : favorites.length === 0 ? (
                <EmptyState
                  icon={<Heart className="h-10 w-10" />}
                  title={t('dashboard.nothingSaved')}
                  description={
                    locale === 'ar'
                      ? 'احفظ المنتجات للمقارنة السريعة أو للحصول على تنبيهات الأسعار.'
                      : 'Save products you love to compare them quickly and receive alerts.'
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.slice(0, 6).map((product) => (
                    <Card key={`favorite-${product.id}`} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <Link href={`/${locale}/products/${product.slug}`} className="block">
                          <p className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {locale === 'ar' ? product.name_ar : product.name_en}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {product.brand} · {product.model}
                          </p>
                        </Link>
                        {product.image_urls?.[0] ? (
                          <img
                            src={product.image_urls[0]}
                            alt={locale === 'ar' ? product.name_ar : product.name_en}
                            className="w-full h-36 object-cover rounded-lg border border-gray-100 dark:border-gray-800"
                          />
                        ) : (
                          <div className="w-full h-36 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-500">
                            {t('dashboard.noImage')}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-primary-600 dark:text-primary-300">
                            {product.product_stores?.length
                              ? `${formatPrice(product.product_stores[0].current_price)} ر.س`
                              : locale === 'ar'
                              ? 'السعر غير متاح'
                              : 'Price unavailable'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {locale === 'ar'
                              ? `${product.product_stores?.length || 0} متاجر`
                              : `${product.product_stores?.length || 0} stores`}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Recently Viewed */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('dashboard.recentlyViewed')}
                </h2>
              </div>
              {loading ? (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={`recent-skeleton-${i}`} className="h-44 w-64 flex-shrink-0" />
                  ))}
                </div>
              ) : recentlyViewed.length === 0 ? (
                <EmptyState
                  icon={<Clock3 className="h-10 w-10" />}
                  title={t('dashboard.startExploring')}
                  description={t('dashboard.startExploringDescription')}
                />
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {recentlyViewed.map((product) => (
                    <Card key={`recent-${product.id}`} className="min-w-[260px] flex-shrink-0 hover:shadow-lg transition-shadow">
                      <CardContent className="p-4 space-y-2">
                        <Link href={`/${locale}/products/${product.slug}`} className="block text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                          {locale === 'ar' ? product.name_ar : product.name_en}
                        </Link>
                        {product.image_urls?.[0] ? (
                          <img
                            src={product.image_urls[0]}
                            alt={locale === 'ar' ? product.name_ar : product.name_en}
                            className="w-full h-32 object-cover rounded-lg border border-gray-100 dark:border-gray-800"
                          />
                        ) : (
                          <div className="w-full h-32 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500">
                            {t('dashboard.noImage')}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-primary-600 dark:text-primary-300 font-semibold">
                            {product.product_stores?.length
                              ? `${formatPrice(product.product_stores[0].current_price)} ر.س`
                              : locale === 'ar'
                              ? 'السعر غير متاح'
                              : 'N/A'}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Saved searches & comparison history */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('dashboard.recentSearches')}</CardTitle>
                    <Search className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={`search-skeleton-${i}`} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : recentSearches.length === 0 ? (
                    <EmptyState
                      icon={<Search className="h-8 w-8" />}
                      title={t('dashboard.noRecentSearches')}
                    />
                  ) : (
                    <div className="space-y-2">
                      {recentSearches.slice(0, 6).map((search) => (
                        <Link
                          key={search.id}
                          href={`/${locale}/search?q=${encodeURIComponent(search.search_query)}`}
                          className="block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {search.search_query}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(search.created_at).toLocaleDateString(locale, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {t('dashboard.comparisonHistory')}
                    </CardTitle>
                    <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <CardDescription>
                    {t('dashboard.comparisonHistoryDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={`compare-skeleton-${i}`} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : comparisonHistory.length === 0 ? (
                    <EmptyState
                      icon={<BarChart3 className="h-8 w-8" />}
                      title={t('dashboard.noComparisons')}
                      description={t('dashboard.noComparisonsDescription')}
                    />
                  ) : (
                    <div className="space-y-2">
                      {comparisonHistory.map((product) => (
                        <Link
                          key={`history-${product.id}`}
                          href={`/${locale}/products/${product.slug}`}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                            {locale === 'ar' ? product.name_ar : product.name_en}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alerts and notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('dashboard.activeAlerts')}</CardTitle>
                    <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={`alert-skeleton-${i}`} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : priceAlerts.length === 0 ? (
                    <EmptyState
                      icon={<AlertCircle className="h-8 w-8" />}
                      title={t('dashboard.noAlerts')}
                    />
                  ) : (
                    <div className="space-y-3">
                      {priceAlerts.map((alert) => {
                        const productName =
                          locale === 'ar'
                            ? alert.products.name_ar
                            : alert.products.name_en;
                        const currentPrice = alert.products.product_stores?.[0]?.current_price || 0;
                        const triggered = currentPrice <= alert.target_price;

                        return (
                          <Link
                            key={alert.id}
                            href={`/${locale}/products/${alert.products.slug}`}
                            className="block p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                                  {productName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('dashboard.targetPrice')}: {alert.target_price} ر.س
                                  </span>
                                  {triggered && (
                                    <Badge variant="success" className="text-xs">
                                      {t('dashboard.alertTriggered')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('dashboard.recentNotifications')}</CardTitle>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/${locale}/notifications`}>
                        {t('dashboard.viewAllNotifications')} <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={`notif-skeleton-${i}`} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : notifications.length === 0 ? (
                    <EmptyState
                      icon={<Bell className="h-8 w-8" />}
                      title={t('dashboard.noNotifications')}
                    />
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notification) => {
                        const title =
                          locale === 'ar' ? notification.title_ar : notification.title_en;
                        const message =
                          locale === 'ar' ? notification.message_ar : notification.message_en;
                        const productLink = notification.products
                          ? `/${locale}/products/${notification.products.slug}`
                          : `/${locale}/notifications`;

                        return (
                          <Link
                            key={notification.id}
                            href={productLink}
                            className={`block p-3 rounded-lg border transition-colors ${
                              notification.is_read
                                ? 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                : 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950 hover:bg-primary-100 dark:hover:bg-primary-900'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {!notification.is_read && (
                                <div className="w-2 h-2 rounded-full bg-primary-600 mt-2 flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {title}
                                </p>
                                {message && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                    {message}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(notification.created_at).toLocaleDateString(locale, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-2" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
