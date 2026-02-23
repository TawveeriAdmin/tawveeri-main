'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Heart,
  BarChart3,
  Bell,
  Settings,
  TrendingUp,
  Package,
  AlertCircle,
  ArrowRight,
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
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();

  const [wishlistCount, setWishlistCount] = useState<number>(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favorites, setFavorites] = useState<DashboardProduct[]>([]);
  const [recommendations, setRecommendations] = useState<DashboardProduct[]>([]);
  const [recSource, setRecSource] = useState<string | null>(null);
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning');
    if (hour < 18) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  };

  const fetchProductsByIds = async (ids: string[]): Promise<DashboardProduct[]> => {
    if (!supabase || !ids.length) return [];
    // Filter to valid UUIDs only — localStorage may contain scraped product IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = ids.filter(id => uuidRegex.test(id));
    if (!validIds.length) return [];
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
      .in('id', validIds);

    if (error) {
      console.error('Error fetching products by IDs:', error);
      return [];
    }

    const map = new Map<string, DashboardProduct>();
    (data as unknown as DashboardProduct[] | null)?.forEach((product) => {
      map.set(product.id, product);
    });

    return validIds
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

  // ── Secondary: AI recommendations (non-blocking) ──────────────
  async function fetchRecommendations(
    client: ReturnType<typeof getSupabaseBrowserClient>
  ) {
    try {
      // Call the unified get_recommendations PG function via .rpc()
      const { data, error: rpcError } = await client.rpc('get_recommendations', {
        p_user_id: userId ?? undefined,
        p_product_id: undefined,
        p_type: 'auto',
        p_limit: 6,
      });

      if (rpcError) throw rpcError;

      // The RPC returns basic product fields — enrich with product_stores for pricing
      const recProducts = (data ?? []) as Array<{
        id: string;
        name_ar: string;
        name_en: string;
        slug: string;
        category: string;
        brand: string;
        model: string;
        image_urls: string[] | null;
        score: number;
        source: string;
      }>;

      if (!recProducts.length) {
        setRecommendations([]);
        setRecSource(null);
        return;
      }

      // Fetch product_stores for the recommended products
      const productIds = recProducts.map((p) => p.id);
      const { data: enriched } = await client
        .from('products')
        .select(
          `id, name_ar, name_en, slug, category, brand, model, image_urls,
          product_stores(id, current_price, original_price, availability,
            stores(id, name_ar, name_en, logo_url))`
        )
        .in('id', productIds)
        .eq('is_active', true);

      // Preserve the recommendation order
      const enrichedMap = new Map((enriched as unknown as DashboardProduct[] ?? []).map((p) => [p.id, p]));
      const ordered = recProducts
        .map((rp) => enrichedMap.get(rp.id))
        .filter((p): p is DashboardProduct => Boolean(p));

      setRecommendations(ordered);
      setRecSource(recProducts[0]?.source ?? null);
    } catch (err) {
      console.error('Error fetching AI recommendations:', err);
      // Fallback to popularity-based
      try {
        const { data } = await client
          .from('products')
          .select(
            `id, name_ar, name_en, slug, category, brand, model, image_urls,
            product_stores(id, current_price, original_price, availability,
              stores(id, name_ar, name_en, logo_url))`
          )
          .eq('is_active', true)
          .order('view_count', { ascending: false })
          .limit(6);
        setRecommendations((data as DashboardProduct[] | null) ?? []);
        setRecSource('popularity');
      } catch {
        setRecommendations([]);
        setRecSource(null);
      }
    }
  }

  // ── Primary data: loads fast, unblocks the page ──────────────
  useEffect(() => {
    if (!supabase || authLoading) return;

    const client = supabase;

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

    Promise.all([
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
          `id, target_price, is_active,
          products!inner(id, name_ar, name_en, slug, product_stores(current_price))`
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(6),
      client
        .from('notifications')
        .select(
          `id, type, title_ar, title_en, message_ar, message_en, is_read, created_at,
          products(id, slug)`
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6),
      client
        .from('user_wishlists')
        .select(
          `products!inner(
            id, name_ar, name_en, slug, category, brand, model, image_urls,
            product_stores(id, current_price, original_price, availability,
              stores(id, name_ar, name_en, logo_url)))`
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6),
    ])
      .then(([wishlistRes, searchesRes, alertsRes, notificationsRes, favoritesRes]) => {
        setWishlistCount(wishlistRes.count || 0);
        setRecentSearches((searchesRes.data as RecentSearch[] | null) ?? []);
        setPriceAlerts((alertsRes.data as PriceAlert[] | null) ?? []);
        setNotifications((notificationsRes.data as NotificationItem[] | null) ?? []);

        const favoritesPayload =
          (favoritesRes.data as { products: DashboardProduct }[] | null) ?? [];
        setFavorites(
          favoritesPayload
            .map((entry) => entry.products)
            .filter((product): product is DashboardProduct => Boolean(product))
        );

        // Kick off AI recommendations (non-blocking)
        fetchRecommendations(client);
      })
      .catch((err) => console.error('Error fetching dashboard data:', err))
      .finally(() => setLoading(false));
  }, [supabase, authLoading, userId]);

  // ── Secondary: localStorage collections (non-blocking) ─────
  useEffect(() => {
    if (!supabase || authLoading) return;
    void loadLocalCollections();
  }, [supabase, authLoading]);

  useEffect(() => {
    if (isGuest) {
      setStats(DEFAULT_STATS);
      return;
    }

    setStats({
      wishlist: wishlistCount,
      priceAlerts: priceAlerts.length,
      savedSearches: recentSearches.length,
      notifications: notifications.filter((n) => !n.is_read).length,
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
          : `You have ${priceAlerts.length} active price alert${priceAlerts.length === 1 ? '' : 's'}. We'll notify you as soon as prices drop.`
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
          : "You're saving quite a few items — consider enabling price alerts on your favorites to catch discounts instantly."
      );
    }

    if (comparisonHistory.length > 0) {
      suggestions.push(
        locale === 'ar'
          ? 'استخدم سجل المقارنات للعودة إلى المنتجات التي قارنتها مؤخرًا ومتابعة قرار الشراء.'
          : "Jump back into your comparison history whenever you're ready to decide between similar products."
      );
    }

    setInsights(suggestions);
  }, [locale, isGuest, priceAlerts, recentSearches, recommendations, favorites, comparisonHistory]);

  const renderProductCard = (product: DashboardProduct, keyPrefix: string) => {
    const productName = locale === 'ar' ? product.name_ar : product.name_en;
    return (
      <Link
        key={`${keyPrefix}-${product.id}`}
        href={`/${locale}/products/${product.slug}`}
        className="group block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5"
      >
        <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800 overflow-hidden">
          {product.image_urls?.[0] ? (
            <img
              src={product.image_urls[0]}
              alt={productName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
              {t('dashboard.noImage')}
            </div>
          )}
        </div>
        <div className="p-3.5 space-y-1.5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 text-sm">
            {productName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {product.brand} &middot; {product.model}
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-primary-600 dark:text-primary-400 tabular-nums text-sm">
              {product.product_stores?.length
                ? `${formatPrice(product.product_stores[0].current_price)} ر.س`
                : locale === 'ar'
                  ? 'السعر غير متاح'
                  : 'Price unavailable'}
            </span>
            <span className="text-xs text-primary-600 dark:text-primary-400 inline-flex items-center gap-0.5 group-hover:underline">
              {t('dashboard.viewDetails')}
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </Link>
    );
  };

  /* ------------------------------------------------------------------ */
  /*  LOADING STATE                                                      */
  /* ------------------------------------------------------------------ */
  if (authLoading || !supabase) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  AUTHENTICATED STATE                                                */
  /* ------------------------------------------------------------------ */

  const userName = user?.full_name || user?.email?.split('@')[0] || '';

  const statsConfig = [
    {
      label: t('dashboard.wishlistItems'),
      value: stats.wishlist,
      icon: Heart,
      bg: 'bg-rose-100 dark:bg-rose-500/20',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: t('dashboard.activeAlerts'),
      value: stats.priceAlerts,
      icon: Bell,
      bg: 'bg-amber-100 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: t('dashboard.savedSearches'),
      value: stats.savedSearches,
      icon: Search,
      bg: 'bg-blue-100 dark:bg-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: t('dashboard.recentlyViewed'),
      value: stats.recentlyViewed,
      icon: Package,
      bg: 'bg-emerald-100 dark:bg-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
  ];

  const heroTitle = isGuest
    ? t('dashboard.welcomeGuest')
    : `${t('dashboard.welcome')}, ${userName}!`;

  const heroSubtitle = isGuest
    ? t('dashboard.guest.subtitle')
    : `${getGreeting()} · ${t('dashboard.greeting.subtitle')}`;

  const quickActions = [
    {
      href: `/${locale}/search`,
      label: t('dashboard.quickAction.search'),
      icon: Search,
      tone: 'from-blue-500/15 to-primary-500/5 dark:from-blue-400/20 dark:to-primary-400/10',
    },
    {
      href: `/${locale}/wishlist`,
      label: t('dashboard.quickAction.wishlist'),
      icon: Heart,
      tone: 'from-rose-500/15 to-pink-500/5 dark:from-rose-400/20 dark:to-pink-400/10',
    },
    {
      href: `/${locale}/compare`,
      label: t('dashboard.quickAction.compare'),
      icon: BarChart3,
      tone: 'from-violet-500/15 to-indigo-500/5 dark:from-violet-400/20 dark:to-indigo-400/10',
    },
    {
      href: `/${locale}/price-alerts`,
      label: t('dashboard.quickAction.alerts'),
      icon: Bell,
      tone: 'from-amber-500/18 to-orange-500/8 dark:from-amber-400/24 dark:to-orange-400/12',
    },
    {
      href: `/${locale}/settings`,
      label: t('dashboard.quickAction.settings'),
      icon: Settings,
      tone: 'from-emerald-500/15 to-teal-500/8 dark:from-emerald-400/20 dark:to-teal-400/10',
    },
  ];

  return (
    <div className="space-y-8">
      <section className="animate-fadeInUp relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-primary-500/10 via-white to-secondary-500/10 p-5 shadow-sm dark:border-gray-800 dark:from-primary-500/20 dark:via-gray-900 dark:to-secondary-500/20 md:p-7">
        <div className="pointer-events-none absolute -end-12 -top-12 h-44 w-44 rounded-full bg-primary-500/15 blur-3xl dark:bg-primary-400/25" />
        <div className="pointer-events-none absolute -bottom-16 start-1/3 h-44 w-44 rounded-full bg-secondary-500/15 blur-3xl dark:bg-secondary-400/25" />
        <div className="relative z-10 space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
              {t('dashboard.quickActions')}
            </p>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 md:text-3xl">
              {heroTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {heroSubtitle}
            </p>

            {isGuest ? (
              <Link
                href={`/${locale}/auth/login`}
                className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                {t('dashboard.guest.cta')}
              </Link>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {statsConfig.slice(0, 4).map((stat) => (
                  <Badge
                    key={`hero-${stat.label}`}
                    variant="outline"
                    className="border-gray-200 bg-white/80 text-gray-700 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200"
                  >
                    {stat.label}: {stat.value}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`group rounded-2xl border border-gray-200 bg-gradient-to-br px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 inline-flex items-center gap-2 ${action.tone}`}
              >
                <action.icon className="h-4 w-4 text-gray-700 transition-transform duration-200 group-hover:scale-110 dark:text-gray-200 shrink-0" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="animate-fadeInUp">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statsConfig.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <div
                className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}
              >
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <section className="animate-fadeInUp" style={{ animationDelay: '80ms' }}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 border-s-4 border-s-primary-500">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.smartInsights')}
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t('dashboard.insightsSubtitle')}
            </p>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300"
                >
                  <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Favorites + Price Alerts */}
      <section className="animate-fadeInUp" style={{ animationDelay: '160ms' }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Favorites */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.section.favorites')}
              </h2>
              <Link
                href={`/${locale}/wishlist`}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                {t('dashboard.openWishlist')}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : favorites.length === 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <EmptyState
                  icon={<Heart className="h-10 w-10" />}
                  title={t('dashboard.nothingSaved')}
                  description={
                    locale === 'ar'
                      ? 'احفظ المنتجات للمقارنة السريعة أو للحصول على تنبيهات الأسعار.'
                      : 'Save products you love to compare them quickly and receive alerts.'
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favorites.slice(0, 4).map((product) => renderProductCard(product, 'fav'))}
              </div>
            )}
          </div>

          {/* Price Alerts */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.section.priceAlerts')}
              </h2>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : priceAlerts.length === 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
                <EmptyState
                  icon={<AlertCircle className="h-8 w-8" />}
                  title={t('dashboard.noAlerts')}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {priceAlerts.map((alert) => {
                  const productName =
                    locale === 'ar' ? alert.products.name_ar : alert.products.name_en;
                  const currentPrice =
                    alert.products.product_stores?.[0]?.current_price || 0;
                  const triggered = currentPrice > 0 && currentPrice <= alert.target_price;
                  const progress =
                    currentPrice > 0
                      ? Math.min(100, Math.round((alert.target_price / currentPrice) * 100))
                      : 0;

                  return (
                    <Link
                      key={alert.id}
                      href={`/${locale}/products/${alert.products.slug}`}
                      className={`block rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
                        triggered
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 hover:shadow-emerald-500/10 hover:shadow-md'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 mb-2">
                        {productName}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>
                          {t('dashboard.targetPrice')}: {formatPrice(alert.target_price)} ر.س
                        </span>
                        {currentPrice > 0 && (
                          <span>
                            {t('dashboard.currentPrice')}: {formatPrice(currentPrice)} ر.س
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            triggered ? 'bg-emerald-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {progress}% {t('dashboard.priceProgress')}
                        </span>
                        {triggered && (
                          <Badge className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0 px-1.5 py-0">
                            {t('dashboard.alertTriggered')}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Recommendations */}
      <section className="animate-fadeInUp" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard.section.recommendations')}
          </h2>
          <Badge
            variant="outline"
            className="text-xs border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
          >
            <Sparkles className="w-3 h-3 me-1" />
            {recSource && recSource !== 'popularity'
              ? (locale === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : 'AI-Powered')
              : t('dashboard.basedOnActivity')}
          </Badge>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <EmptyState
              icon={<TrendingUp className="h-10 w-10" />}
              title={t('dashboard.noRecommendations')}
              description={
                locale === 'ar'
                  ? 'تابع البحث وحفظ المنتجات لتحصل على اقتراحات مخصصة.'
                  : 'Keep exploring and saving products to unlock smarter suggestions.'
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 6).map((product) => renderProductCard(product, 'rec'))}
          </div>
        )}
      </section>

      {/* Recently Viewed */}
      <section className="animate-fadeInUp" style={{ animationDelay: '320ms' }}>
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {t('dashboard.section.recentlyViewed')}
        </h2>
        {recentlyViewed.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
            <EmptyState
              icon={<Clock3 className="h-10 w-10" />}
              title={t('dashboard.startExploring')}
              description={t('dashboard.startExploringDescription')}
            />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyViewed.map((product) => {
              const productName = locale === 'ar' ? product.name_ar : product.name_en;
              return (
                <Link
                  key={`recent-${product.id}`}
                  href={`/${locale}/products/${product.slug}`}
                  className="group min-w-[200px] max-w-[200px] shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="aspect-[3/2] bg-gray-50 dark:bg-gray-800 overflow-hidden">
                    {product.image_urls?.[0] ? (
                      <img
                        src={product.image_urls[0]}
                        alt={productName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-600">
                        {t('dashboard.noImage')}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                      {productName}
                    </p>
                    <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold mt-1 tabular-nums">
                      {product.product_stores?.length
                        ? `${formatPrice(product.product_stores[0].current_price)} ر.س`
                        : locale === 'ar'
                          ? 'السعر غير متاح'
                          : 'N/A'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Searches + Notifications */}
      <section className="animate-fadeInUp" style={{ animationDelay: '400ms' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Searches */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.section.recentSearches')}
              </h3>
              <Search className="w-4 h-4 text-blue-500" />
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : recentSearches.length === 0 ? (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title={t('dashboard.noRecentSearches')}
              />
            ) : (
              <div className="space-y-1">
                {recentSearches.slice(0, 6).map((search) => (
                  <Link
                    key={search.id}
                    href={`/${locale}/search?q=${encodeURIComponent(search.search_query)}`}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Search className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {search.search_query}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(search.created_at).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.section.notifications')}
              </h3>
              <Link
                href={`/${locale}/notifications`}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                {t('dashboard.viewAllNotifications')}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-8 w-8" />}
                title={t('dashboard.noNotifications')}
              />
            ) : (
              <div className="space-y-1">
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
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                      )}
                      <div
                        className={`flex-1 min-w-0 ${notification.is_read ? 'ps-5' : ''}`}
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                          {title}
                        </p>
                        {message && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                            {message}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Comparison History */}
      {comparisonHistory.length > 0 && (
        <section className="animate-fadeInUp" style={{ animationDelay: '480ms' }}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.section.comparisonHistory')}
              </h3>
              <BarChart3 className="w-4 h-4 text-primary-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('dashboard.comparisonHistoryDescription')}
            </p>
            <div className="flex flex-wrap gap-2">
              {comparisonHistory.map((product) => (
                <Link
                  key={`history-${product.id}`}
                  href={`/${locale}/products/${product.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {locale === 'ar' ? product.name_ar : product.name_en}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fadeInUp {
            animation: none !important;
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
