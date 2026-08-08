'use client';

import { createElement, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';
import { getSupabaseBrowserClient } from '@/lib/database';
import { Price } from '@/components/ui/price';
import { SharedProductRailCard, ProductIdentity } from '@/components/products/shared-product-card';
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

type TFn = ReturnType<typeof useTranslations>;

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

/* ── Category icon fallback for missing images ── */
function getCategoryIcon(category: string) {
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
}

/* ── Horizontal scroll product card ── */
function ProductScrollCard({
  product,
  size = 'md',
  locale,
  t,
}: {
  product: DashboardProduct;
  size?: 'sm' | 'md';
  locale: string;
  t: TFn;
}) {
  const FallbackIcon = getCategoryIcon(product.category);

  return (
    <SharedProductRailCard
      product={product}
      locale={locale}
      href={`/${locale}/products/${product.slug}`}
      size={size}
      priceUnavailableLabel={t('products.priceNotAvailable')}
      fallbackIcon={createElement(FallbackIcon, { className: size === 'sm' ? 'h-8 w-8' : 'h-10 w-10' })}
    />
  );
}

/* ── Section header ── */
function SectionHeader({
  title,
  href,
  badge,
  t,
  isRTL,
}: {
  title: string;
  href?: string;
  badge?: React.ReactNode;
  t: TFn;
  isRTL: boolean;
}) {
  const ChevronNav = isRTL ? ChevronLeft : ChevronRight;
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-lg font-black tracking-tight text-on-surface">{title}</h2>
          {badge}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--brand-green-dark)] transition-colors hover:bg-[var(--brand-bg-green)]"
        >
          {t('dashboard.viewAll')}
          <ChevronNav className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
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
      {/* Hero + primary metrics */}
      <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] shadow-[var(--elevation-1)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="relative p-5 md:p-7">
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_20%_0%,rgba(85,178,149,0.18),transparent_65%)]" />
            <div className="relative">
              <Badge variant="outline" className="mb-4 rounded-full border-[var(--brand-green)]/30 bg-[var(--brand-bg-green)] px-3 text-[var(--brand-green-dark)]">
                {t('dashboard.title')}
              </Badge>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-on-surface md:text-4xl">
                    {getGreeting()}، {userName}
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
                    {t('dashboard.greeting.subtitle')}
                  </p>
                </div>
                <Link
                  href={`/${locale}/search`}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-on-primary transition-all hover:bg-primary-600 active:scale-[0.98]"
                >
                  <Search className="h-4 w-4" />
                  {t('dashboard.quickAction.search')}
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Link href={`/${locale}/wishlist`} className="group rounded-2xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface-container-low)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-green)]/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                      <Heart className="h-5 w-5" />
                    </span>
                    <ArrowNav className="h-4 w-4 text-on-surface-variant transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-on-surface">{wishlistCount}</p>
                  <p className="text-xs font-medium text-on-surface-variant">{t('dashboard.wishlistItems')}</p>
                </Link>
                <Link href={`/${locale}/price-alerts`} className="group rounded-2xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface-container-low)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-green)]/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30">
                      <TrendingDown className="h-5 w-5" />
                    </span>
                    <ArrowNav className="h-4 w-4 text-on-surface-variant transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-on-surface">{alertsCount}</p>
                  <p className="text-xs font-medium text-on-surface-variant">{t('dashboard.activeAlerts')}</p>
                </Link>
                <Link href={`/${locale}/notifications`} className="group rounded-2xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface-container-low)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-green)]/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                    <ArrowNav className="h-4 w-4 text-on-surface-variant transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-on-surface">{notifications.length}</p>
                  <p className="text-xs font-medium text-on-surface-variant">{t('dashboard.section.notifications')}</p>
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] p-4 lg:border-s lg:border-t-0 md:p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[color:var(--color-surface)] p-4">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-bg-green)] text-[var(--brand-green-dark)]">
                  <TrendingDown className="h-5 w-5" />
                </span>
                <div className="text-2xl font-black tabular-nums text-[var(--brand-green-dark)]">
                  {totalSavings > 0 ? (
                    <Price amount={totalSavings} className="text-2xl font-black" symbolClassName="h-4 w-4" />
                  ) : '0'}
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">{t('dashboard.kpi.totalSavings')}</p>
              </div>
              <div className="rounded-2xl bg-[color:var(--color-surface)] p-4">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <p className="text-2xl font-black tabular-nums text-on-surface">{productsTracked}</p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">{t('dashboard.kpi.productsTracked')}</p>
              </div>
              <div className="rounded-2xl bg-[color:var(--color-surface)] p-4">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                  <Zap className="h-5 w-5" />
                </span>
                <p className="text-2xl font-black tabular-nums text-on-surface">{priceDropsCount}</p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">{t('dashboard.kpi.priceDrops')}</p>
              </div>
              <div className="rounded-2xl bg-[color:var(--color-surface)] p-4">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                  <Target className="h-5 w-5" />
                </span>
                <p className="text-2xl font-black tabular-nums text-on-surface">{triggeredAlertsCount}</p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">{t('dashboard.kpi.alertsTriggered')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alerts + notifications */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-1)] md:p-5 xl:col-span-7">
          <SectionHeader title={t('dashboard.section.priceAlerts')} href={`/${locale}/price-alerts`} t={t} isRTL={isRTL} />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : priceAlerts.length === 0 ? (
            <EmptyState icon={<TrendingDown className="h-8 w-8" />} title={t('dashboard.noAlerts')} className="rounded-2xl bg-[color:var(--color-surface-container-low)] py-12" />
          ) : (
            <div className="space-y-3">
              {priceAlerts.slice(0, 4).map(alert => {
                const name = locale === 'ar' ? alert.products.name_ar : alert.products.name_en;
                const currentPrice = alert.products.product_stores?.[0]?.current_price || 0;
                const triggered = currentPrice > 0 && currentPrice <= alert.target_price;
                const progress = currentPrice > 0 ? Math.min(100, Math.round((alert.target_price / currentPrice) * 100)) : 0;

                return (
                  <Link
                    key={alert.id}
                    href={`/${locale}/products/${alert.products.slug}`}
                    className={`group block rounded-2xl border p-3 transition-all hover:-translate-y-0.5 ${
                      triggered
                        ? 'border-[var(--brand-green)]/35 bg-[var(--brand-bg-green)]'
                        : 'border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface-container-low)] hover:border-[var(--brand-green)]/35'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <ProductIdentity
                          product={alert.products}
                          locale={locale}
                          name={name}
                          imageSizeClassName="h-14 w-14"
                          imageClassName="object-contain"
                          fallbackIcon={<Eye className="h-4 w-4" />}
                          titleClassName="line-clamp-1 text-sm font-bold"
                        />
                      </div>
                      {triggered && (
                        <Badge className="shrink-0 border-0 bg-[var(--brand-green)] text-[10px] text-white">
                          {t('dashboard.alertTriggered')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface)]">
                        <div
                          className={`h-full rounded-full transition-all ${triggered ? 'bg-[var(--brand-green)]' : 'bg-[var(--brand-gold)]'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="w-10 text-end text-xs font-bold tabular-nums text-on-surface-variant">{progress}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                      <span>{t('dashboard.targetPrice')}: <Price amount={alert.target_price} className="inline text-xs font-bold" symbolClassName="h-3 w-3" /></span>
                      {currentPrice > 0 && (
                        <span>{t('dashboard.currentPrice')}: <Price amount={currentPrice} className="inline text-xs font-bold" symbolClassName="h-3 w-3" /></span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-1)] md:p-5 xl:col-span-5">
          <SectionHeader title={t('dashboard.section.notifications')} href={`/${locale}/notifications`} t={t} isRTL={isRTL} />
          {loading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
          ) : notifications.length === 0 ? (
            <EmptyState icon={<Bell className="h-8 w-8" />} title={t('dashboard.noNotifications')} className="rounded-2xl bg-[color:var(--color-surface-container-low)] py-12" />
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map(notif => {
                const title = locale === 'ar' ? notif.title_ar : notif.title_en;
                const message = locale === 'ar' ? notif.message_ar : notif.message_en;
                const link = notif.products ? `/${locale}/products/${notif.products.slug}` : `/${locale}/notifications`;
                const Icon = getNotifIcon(notif.type);

                return (
                  <Link
                    key={notif.id}
                    href={link}
                    className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-[color:var(--color-surface-container-low)]"
                  >
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getNotifColor(notif.type)}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`line-clamp-1 text-sm ${notif.is_read ? 'text-on-surface-variant' : 'font-bold text-on-surface'}`}>
                          {title}
                        </p>
                        {!notif.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-green)]" />}
                      </div>
                      {message && <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">{message}</p>}
                      <p className="mt-1 text-[10px] font-medium text-on-surface-variant">{timeAgo(notif.created_at)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Product rails */}
      <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-1)] md:p-5">
        <SectionHeader
          title={t('dashboard.section.recommendations')}
          t={t}
          isRTL={isRTL}
          badge={
            <Badge variant="outline" className="rounded-full text-[10px]">
              <Sparkles className="me-1 h-3 w-3" />
              {recSource && recSource !== 'popularity'
                ? (locale === 'ar' ? 'ذكي' : 'Smart')
                : (locale === 'ar' ? 'رائج' : 'Trending')}
            </Badge>
          }
        />
        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[220px] w-[200px] shrink-0 rounded-xl" />)}
          </div>
        ) : recommendations.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recommendations.map(p => <ProductScrollCard key={`rec-${p.id}`} product={p} locale={locale} t={t} />)}
          </div>
        ) : (
          <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title={t('dashboard.noRecommendations')} className="py-10" />
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {(loading || favorites.length > 0) && (
          <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-1)] md:p-5 xl:col-span-7">
            <SectionHeader title={t('dashboard.section.favorites')} href={`/${locale}/wishlist`} t={t} isRTL={isRTL} />
            {loading ? (
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-[220px] w-[200px] shrink-0 rounded-xl" />)}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {favorites.map(p => <ProductScrollCard key={`fav-${p.id}`} product={p} locale={locale} t={t} />)}
              </div>
            )}
          </section>
        )}

        <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-1)] md:p-5 xl:col-span-5">
          <SectionHeader title={t('dashboard.section.recentSearches')} t={t} isRTL={isRTL} />
          {recentSearches.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recentSearches.map(s => (
                <Link
                  key={s.id}
                  href={`/${locale}/search?q=${encodeURIComponent(s.search_query)}`}
                  className="group inline-flex max-w-full items-center gap-2 rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface-container-low)] px-3.5 py-2 text-sm font-medium text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
                >
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" />
                  <span className="max-w-[220px] truncate">{s.search_query}</span>
                  <ArrowNav className="h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Search className="h-8 w-8" />} title={t('dashboard.noRecentSearches')} className="py-10" />
          )}
        </section>
      </div>

      {recentlyViewed.length > 0 && (
        <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] p-4 shadow-[var(--elevation-1)] md:p-5">
          <SectionHeader title={t('dashboard.section.recentlyViewed')} t={t} isRTL={isRTL} />
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyViewed.map(p => <ProductScrollCard key={`rv-${p.id}`} product={p} size="sm" locale={locale} t={t} />)}
          </div>
        </section>
      )}

      {!loading && favorites.length === 0 && recommendations.length === 0 && recentlyViewed.length === 0 && recentSearches.length === 0 && (
        <section className="rounded-[1.75rem] border border-dashed border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-8 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/50" />
          <h3 className="mb-1 text-lg font-black text-on-surface">
            {t('dashboard.startExploring')}
          </h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-on-surface-variant">
            {t('dashboard.startExploringDescription')}
          </p>
          <Link
            href={`/${locale}/search`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-on-primary transition-colors hover:bg-primary-600"
          >
            <Search className="h-4 w-4" />
            {t('dashboard.quickAction.search')}
          </Link>
        </section>
      )}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
