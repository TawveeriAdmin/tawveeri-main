'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { GuestPrompt } from '@/components/auth/guest-prompt';
import {
  Search,
  Heart,
  Bell,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock3,
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  Eye,
  ShieldCheck,
  Zap,
  Target,
  BarChart3,
  ShoppingBag,
  Smartphone,
  Laptop,
  Tv,
  Headphones,
  Watch,
  Camera,
  Gamepad2,
  Package,
} from 'lucide-react';
import type { ProductCategory } from '@/lib/database/types';

const RECENTLY_VIEWED_KEY = 'tawveeri.recentlyViewedProducts';

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
    image_urls: string[] | null;
    product_stores: Array<{ current_price: number }>;
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
  products: { id: string; slug: string } | null;
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
    stores: { id: string; name_ar: string; name_en: string; logo_url: string | null };
  }>;
}

export default function DashboardPage() {
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? getSupabaseBrowserClient() : null
  );
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const isRTL = locale === 'ar';
  const ArrowNav = isRTL ? ArrowLeft : ArrowRight;
  const ChevronNav = isRTL ? ChevronLeft : ChevronRight;

  const [wishlistCount, setWishlistCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favorites, setFavorites] = useState<DashboardProduct[]>([]);
  const [recommendations, setRecommendations] = useState<DashboardProduct[]>([]);
  const [recSource, setRecSource] = useState<string | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<DashboardProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id ?? null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning');
    if (hour < 18) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  };

  const fetchProductsByIds = async (ids: string[]): Promise<DashboardProduct[]> => {
    if (!supabase || !ids.length) return [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validIds = ids.filter(id => uuidRegex.test(id));
    if (!validIds.length) return [];
    const { data } = await supabase
      .from('products')
      .select(`id, name_ar, name_en, slug, category, brand, model, image_urls,
        product_stores(id, current_price, original_price, availability,
          stores(id, name_ar, name_en, logo_url))`)
      .in('id', validIds);
    const map = new Map<string, DashboardProduct>();
    (data as unknown as DashboardProduct[] | null)?.forEach(p => map.set(p.id, p));
    return validIds.map(id => map.get(id)).filter((p): p is DashboardProduct => Boolean(p));
  };

  async function fetchRecommendations(client: ReturnType<typeof getSupabaseBrowserClient>) {
    try {
      const { data, error } = await client.rpc('get_recommendations', {
        p_user_id: userId ?? undefined,
        p_product_id: undefined,
        p_type: 'auto',
        p_limit: 8,
      });
      if (error) throw error;
      const recs = (data ?? []) as Array<{ id: string; source: string }>;
      if (!recs.length) return;
      const { data: enriched } = await client
        .from('products')
        .select(`id, name_ar, name_en, slug, category, brand, model, image_urls,
          product_stores(id, current_price, original_price, availability,
            stores(id, name_ar, name_en, logo_url))`)
        .in('id', recs.map(r => r.id))
        .eq('is_active', true);
      const enrichedMap = new Map((enriched as unknown as DashboardProduct[] ?? []).map(p => [p.id, p]));
      setRecommendations(recs.map(r => enrichedMap.get(r.id)).filter((p): p is DashboardProduct => Boolean(p)));
      setRecSource(recs[0]?.source ?? null);
    } catch {
      try {
        const { data } = await client
          .from('products')
          .select(`id, name_ar, name_en, slug, category, brand, model, image_urls,
            product_stores(id, current_price, original_price, availability,
              stores(id, name_ar, name_en, logo_url))`)
          .eq('is_active', true)
          .order('view_count', { ascending: false })
          .limit(8);
        setRecommendations((data as DashboardProduct[] | null) ?? []);
        setRecSource('popularity');
      } catch {
        setRecommendations([]);
      }
    }
  }

  useEffect(() => {
    if (!supabase || authLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      supabase.from('user_wishlists').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('search_history').select('id, search_query, category, results_count, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('price_alerts')
        .select(`id, target_price, is_active,
          products!inner(id, name_ar, name_en, slug, image_urls, product_stores(current_price))`)
        .eq('user_id', userId).eq('is_active', true).limit(5),
      supabase.from('notifications')
        .select(`id, type, title_ar, title_en, message_ar, message_en, is_read, created_at, products(id, slug)`)
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('user_wishlists')
        .select(`products!inner(id, name_ar, name_en, slug, category, brand, model, image_urls,
          product_stores(id, current_price, original_price, availability,
            stores(id, name_ar, name_en, logo_url)))`)
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
    ])
      .then(([wishlistRes, searchesRes, alertsRes, notificationsRes, favoritesRes]) => {
        setWishlistCount(wishlistRes.count || 0);
        const alerts = (alertsRes.data as PriceAlert[] | null) ?? [];
        setPriceAlerts(alerts);
        setAlertsCount(alerts.length);
        const notifs = (notificationsRes.data as NotificationItem[] | null) ?? [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
        setRecentSearches((searchesRes.data as RecentSearch[] | null) ?? []);
        const favsPayload = (favoritesRes.data as { products: DashboardProduct }[] | null) ?? [];
        setFavorites(favsPayload.map(e => e.products).filter((p): p is DashboardProduct => Boolean(p)));
        fetchRecommendations(supabase!);
      })
      .catch(err => console.error('Error fetching dashboard:', err))
      .finally(() => setLoading(false));
  }, [supabase, authLoading, userId]);

  // Recently viewed from localStorage
  useEffect(() => {
    if (!supabase || authLoading || typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const unique = Array.from(new Set(ids)).slice(-8).reverse();
    fetchProductsByIds(unique).then(setRecentlyViewed);
  }, [supabase, authLoading]);

  /* ── Loading ── */
  if (authLoading || !supabase) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  /* ── Guest state ── */
  if (!user) {
    return (
      <div className="space-y-8">
        <GuestPrompt
          locale={locale}
          title={t('dashboard.guest.title')}
          description={t('dashboard.guest.subtitle')}
          ctaLabel={t('dashboard.guest.cta')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingDown, title: t('dashboard.guest.feature1Title'), desc: t('dashboard.guest.feature1Desc'), color: 'text-emerald-500' },
            { icon: Heart, title: t('dashboard.guest.feature2Title'), desc: t('dashboard.guest.feature2Desc'), color: 'text-rose-500' },
            { icon: ShieldCheck, title: t('dashboard.guest.feature3Title'), desc: t('dashboard.guest.feature3Desc'), color: 'text-blue-500' },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <f.icon className={`w-6 h-6 ${f.color} mb-3`} />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const userName = user.full_name || user.email?.split('@')[0] || '';

  /* ── Computed KPIs ── */
  const totalSavings = favorites.reduce((sum, p) => {
    const store = p.product_stores?.[0];
    if (store?.original_price && store.original_price > store.current_price) {
      return sum + (store.original_price - store.current_price);
    }
    return sum;
  }, 0);

  const priceDropsCount = notifications.filter(n => n.type === 'price_drop').length;

  const triggeredAlertsCount = priceAlerts.filter(alert => {
    const currentPrice = alert.products.product_stores?.[0]?.current_price || 0;
    return currentPrice > 0 && currentPrice <= alert.target_price;
  }).length;

  const productsTracked = wishlistCount + alertsCount;

  /* ── Category icon fallback for missing images ── */
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'smartphones': return Smartphone;
      case 'laptops': return Laptop;
      case 'tvs': return Tv;
      case 'audio': return Headphones;
      case 'wearables': return Watch;
      case 'cameras': return Camera;
      case 'gaming': return Gamepad2;
      default: return Package;
    }
  };

  /* ── Horizontal scroll product card ── */
  const ProductScrollCard = ({ product, size = 'md' }: { product: DashboardProduct; size?: 'sm' | 'md' }) => {
    const name = locale === 'ar' ? product.name_ar : product.name_en;
    const price = product.product_stores?.[0]?.current_price;
    const originalPrice = product.product_stores?.[0]?.original_price;
    const isSm = size === 'sm';
    const FallbackIcon = getCategoryIcon(product.category);

    return (
      <Link
        href={`/${locale}/products/${product.slug}`}
        className={`group shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5 ${
          isSm ? 'w-[160px]' : 'w-[200px]'
        }`}
      >
        <div className={`bg-gray-50 dark:bg-gray-800 overflow-hidden ${isSm ? 'aspect-square' : 'aspect-[4/3]'}`}>
          {product.image_urls?.[0] ? (
            <img
              src={product.image_urls[0]}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
              <FallbackIcon className={`text-gray-300 dark:text-gray-600 ${isSm ? 'w-8 h-8' : 'w-10 h-10'}`} />
            </div>
          )}
        </div>
        <div className={isSm ? 'p-2.5' : 'p-3'}>
          <p className={`font-medium text-gray-900 dark:text-gray-100 line-clamp-2 ${isSm ? 'text-xs' : 'text-sm'}`}>
            {name}
          </p>
          {price ? (
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <Price amount={price} className={`font-bold text-primary-600 dark:text-primary-400 ${isSm ? 'text-xs' : 'text-sm'}`} symbolClassName={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              {originalPrice && originalPrice > price && (
                <Price amount={originalPrice} className="text-[10px] text-gray-400 line-through" symbolClassName="w-2.5 h-2.5" />
              )}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 mt-1">{t('products.priceNotAvailable')}</p>
          )}
        </div>
      </Link>
    );
  };

  /* ── Section header ── */
  const SectionHeader = ({ title, href, badge }: { title: string; href?: string; badge?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {badge}
      </div>
      {href && (
        <Link href={href} className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1">
          {t('dashboard.viewAll')}
          <ChevronNav className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );

  /* ── Notification type icon color ── */
  const getNotifColor = (type: string) => {
    if (type === 'price_drop') return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    if (type === 'back_in_stock') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400';
    if (type === 'deal') return 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
  };

  const getNotifIcon = (type: string) => {
    if (type === 'price_drop') return TrendingDown;
    if (type === 'back_in_stock') return TrendingUp;
    if (type === 'deal') return Sparkles;
    return Bell;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return locale === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return locale === 'ar' ? `منذ ${hours} س` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return locale === 'ar' ? `منذ ${days} ي` : `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {getGreeting()}، {userName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('dashboard.greeting.subtitle')}
          </p>
        </div>
        <Link
          href={`/${locale}/search`}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          <Search className="w-4 h-4" />
          {t('dashboard.quickAction.search')}
        </Link>
      </div>

      {/* ── KPIs ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {/* Total Savings */}
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
              <TrendingDown className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalSavings > 0 ? (
                <Price amount={totalSavings} className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 inline" symbolClassName="w-4 h-4" />
              ) : '0'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.kpi.totalSavings')}</p>
          </div>

          {/* Products Tracked */}
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{productsTracked}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.kpi.productsTracked')}</p>
          </div>

          {/* Price Drops Caught */}
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
              <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{priceDropsCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.kpi.priceDrops')}</p>
          </div>

          {/* Alerts Triggered */}
          <div className="text-center">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mx-auto mb-2">
              <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{triggeredAlertsCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.kpi.alertsTriggered')}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Nav ── */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href={`/${locale}/wishlist`}
          className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{wishlistCount}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('dashboard.wishlistItems')}</p>
          </div>
        </Link>
        <Link
          href={`/${locale}/price-alerts`}
          className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{alertsCount}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('dashboard.activeAlerts')}</p>
          </div>
        </Link>
        <Link
          href={`/${locale}/notifications`}
          className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 relative">
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{notifications.length}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{t('dashboard.section.notifications')}</p>
          </div>
        </Link>
      </div>

      {/* ── Price Alerts + Notifications Bento ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Price Alerts — wider */}
        <div className="lg:col-span-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <SectionHeader title={t('dashboard.section.priceAlerts')} href={`/${locale}/price-alerts`} />
          {loading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : priceAlerts.length === 0 ? (
            <EmptyState icon={<TrendingDown className="h-8 w-8" />} title={t('dashboard.noAlerts')} />
          ) : (
            <div className="space-y-2.5">
              {priceAlerts.slice(0, 4).map(alert => {
                const name = locale === 'ar' ? alert.products.name_ar : alert.products.name_en;
                const currentPrice = alert.products.product_stores?.[0]?.current_price || 0;
                const triggered = currentPrice > 0 && currentPrice <= alert.target_price;
                const progress = currentPrice > 0 ? Math.min(100, Math.round((alert.target_price / currentPrice) * 100)) : 0;

                return (
                  <Link
                    key={alert.id}
                    href={`/${locale}/products/${alert.products.slug}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5 ${
                      triggered
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                        : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {/* Product image */}
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                      {alert.products.image_urls?.[0] ? (
                        <img src={alert.products.image_urls[0]} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Eye className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1">
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${triggered ? 'bg-emerald-500' : 'bg-primary-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{progress}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>{t('dashboard.targetPrice')}: <Price amount={alert.target_price} className="text-[11px] font-medium inline" symbolClassName="w-2.5 h-2.5" /></span>
                        {currentPrice > 0 && (
                          <>
                            <span className="text-gray-300 dark:text-gray-600">·</span>
                            <span>{t('dashboard.currentPrice')}: <Price amount={currentPrice} className="text-[11px] font-medium inline" symbolClassName="w-2.5 h-2.5" /></span>
                          </>
                        )}
                      </div>
                    </div>
                    {triggered && (
                      <Badge className="shrink-0 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0">
                        {t('dashboard.alertTriggered')}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications — narrower */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <SectionHeader title={t('dashboard.section.notifications')} href={`/${locale}/notifications`} />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={<Bell className="h-8 w-8" />} title={t('dashboard.noNotifications')} />
          ) : (
            <div className="space-y-1">
              {notifications.slice(0, 5).map(notif => {
                const title = locale === 'ar' ? notif.title_ar : notif.title_en;
                const message = locale === 'ar' ? notif.message_ar : notif.message_en;
                const link = notif.products ? `/${locale}/products/${notif.products.slug}` : `/${locale}/notifications`;
                const Icon = getNotifIcon(notif.type);

                return (
                  <Link
                    key={notif.id}
                    href={link}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getNotifColor(notif.type)}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm line-clamp-1 ${notif.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
                          {title}
                        </p>
                        {!notif.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />}
                      </div>
                      {message && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{message}</p>}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(notif.created_at)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Wishlist Favorites ── */}
      {(loading || favorites.length > 0) && (
        <div>
          <SectionHeader title={t('dashboard.section.favorites')} href={`/${locale}/wishlist`} />
          {loading ? (
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-[200px] h-[220px] rounded-xl shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {favorites.map(p => <ProductScrollCard key={`fav-${p.id}`} product={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Recommendations ── */}
      {(loading || recommendations.length > 0) && (
        <div>
          <SectionHeader
            title={t('dashboard.section.recommendations')}
            badge={
              <Badge variant="outline" className="text-[10px] border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                <Sparkles className="w-3 h-3 me-1" />
                {recSource && recSource !== 'popularity'
                  ? (locale === 'ar' ? 'ذكاء اصطناعي' : 'AI')
                  : (locale === 'ar' ? 'رائج' : 'Trending')}
              </Badge>
            }
          />
          {loading ? (
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="w-[200px] h-[220px] rounded-xl shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {recommendations.map(p => <ProductScrollCard key={`rec-${p.id}`} product={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Recently Viewed ── */}
      {recentlyViewed.length > 0 && (
        <div>
          <SectionHeader title={t('dashboard.section.recentlyViewed')} />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyViewed.map(p => <ProductScrollCard key={`rv-${p.id}`} product={p} size="sm" />)}
          </div>
        </div>
      )}

      {/* ── Recent Searches ── */}
      {recentSearches.length > 0 && (
        <div>
          <SectionHeader title={t('dashboard.section.recentSearches')} />
          <div className="flex flex-wrap gap-2">
            {recentSearches.map(s => (
              <Link
                key={s.id}
                href={`/${locale}/search?q=${encodeURIComponent(s.search_query)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate max-w-[180px]">{s.search_query}</span>
                <ArrowNav className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state for new users ── */}
      {!loading && favorites.length === 0 && recommendations.length === 0 && recentlyViewed.length === 0 && recentSearches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 text-center">
          <Search className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {t('dashboard.startExploring')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
            {t('dashboard.startExploringDescription')}
          </p>
          <Link
            href={`/${locale}/search`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <Search className="w-4 h-4" />
            {t('dashboard.quickAction.search')}
          </Link>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
