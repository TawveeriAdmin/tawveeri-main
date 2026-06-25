'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/simple-intl-provider';
import { getSupabaseBrowserClient } from '@/lib/database';
import { StoreLogo } from '@/components/ui/store-logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Package,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoreSummary {
  id: string | number;
  name_ar: string;
  name_en: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  average_rating: number | null;
  total_reviews: number | null;
  total_products: number | null;
  is_featured: boolean;
  is_premium: boolean;
  status: string;
}

type SortOption = 'name' | 'rating' | 'products';
type StoreFilter = 'all' | 'featured' | 'premium';

export default function StoresListingClient() {
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? getSupabaseBrowserClient() : null,
  );

  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const t = useTranslations();

  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('all');

  const fetchErrorFallback = isRTL
    ? 'تعذر تحميل بيانات المتاجر حالياً.'
    : 'Failed to load stores right now.';

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        setLoading(false);
        setError(fetchErrorFallback);
      });
      return;
    }

    let cancelled = false;

    async function fetchStores() {
      const sb = supabase;
      if (!sb) return;

      setLoading(true);
      setError(null);

      try {
        const { data: rawStores, error: queryError } = await sb
          .from('stores')
          .select('id, name, offer, coupon_code, link, category, slug')
          .order('name', { ascending: true });

        if (queryError) throw queryError;

        const mapped: StoreSummary[] = (rawStores || []).map((s: any) => ({
          id: s.id,
          name_ar: s.name || '',
          name_en: s.name || '',
          slug: s.slug || String(s.id),
          logo_url: null,
          website_url: s.link || null,
          average_rating: null,
          total_reviews: null,
          total_products: 0,
          is_featured: false,
          is_premium: false,
          status: 'active',
        }));

        if (cancelled) return;
        setStores(mapped);
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching stores:', err);
        setError(err instanceof Error ? err.message : fetchErrorFallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchStores();

    return () => {
      cancelled = true;
    };
  }, [supabase, fetchErrorFallback]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = [...stores];

    if (q) {
      result = result.filter(
        (store) =>
          store.name_ar.toLowerCase().includes(q) ||
          store.name_en.toLowerCase().includes(q) ||
          store.slug.toLowerCase().includes(q),
      );
    }

    if (storeFilter === 'featured') {
      result = result.filter((store) => Boolean(store.is_featured));
    }

    if (storeFilter === 'premium') {
      result = result.filter((store) => Boolean(store.is_premium));
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = isRTL ? a.name_ar : a.name_en;
        const nameB = isRTL ? b.name_ar : b.name_en;
        return nameA.localeCompare(nameB, locale);
      }

      if (sortBy === 'rating') {
        return (b.average_rating ?? 0) - (a.average_rating ?? 0);
      }

      return (b.total_products ?? 0) - (a.total_products ?? 0);
    });

    return result;
  }, [stores, searchQuery, sortBy, locale, storeFilter, isRTL]);

  const premiumCount = useMemo(
    () => stores.filter((store) => Boolean(store.is_premium)).length,
    [stores],
  );

  const productsTotal = useMemo(
    () => stores.reduce((sum, store) => sum + (store.total_products ?? 0), 0),
    [stores],
  );

  const hasActiveFilters = storeFilter !== 'all' || Boolean(searchQuery);

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setSortBy('name');
    setStoreFilter('all');
  };

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-primary-container)] p-5 dark:bg-[color:var(--color-surface-container-low)] md:p-8">
        <div
          aria-hidden
          className="absolute inset-0 opacity-80 dark:opacity-40"
          style={{
            background:
              'radial-gradient(circle at 12% 12%, rgba(85,178,149,0.32), transparent 30%), radial-gradient(circle at 88% 12%, rgba(226,187,78,0.18), transparent 24%)',
          }}
        />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="inline-flex rounded-full bg-[color:var(--color-surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)] shadow-sm dark:bg-[color:var(--color-surface-container-high)]">
              {isRTL ? 'المتاجر الموثوقة' : 'Trusted stores'}
            </p>

            <h1 className="mt-5 max-w-3xl text-[36px] font-black leading-tight text-[color:var(--color-on-surface)] md:text-[48px]">
              {isRTL ? 'اختَر المتجر قبل ما تدفع' : 'Choose the store before you pay'}
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[color:var(--color-on-surface-variant)]">
              {isRTL
                ? 'قارن المتاجر والعروض من متاجر السعودية في صفحة واحدة واضحة.'
                : 'Compare stores and offers from Saudi stores in one clear page.'}
            </p>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-container)]">
            <StoreMetric
              value={loading ? '...' : stores.length.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              label={isRTL ? 'متجر' : 'Stores'}
            />
            <StoreMetric
              value={loading ? '...' : productsTotal.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              label={isRTL ? 'منتج' : 'Products'}
            />
            <StoreMetric
              value={loading ? '...' : premiumCount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              label={isRTL ? 'موثوق' : 'Trusted'}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-3 shadow-[0_18px_60px_-48px_rgba(26,26,26,0.5)] dark:bg-[color:var(--color-surface-container-low)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <form onSubmit={onSearchSubmit}>
            <div className="flex min-h-[60px] items-center gap-3 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] p-2 transition focus-within:border-[color:var(--color-primary)] focus-within:ring-4 focus-within:ring-[color:var(--color-primary)]/15 dark:bg-[color:var(--color-surface)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-high)]">
                <Search className="h-5 w-5" strokeWidth={2} />
              </span>

              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('stores.searchPlaceholder')}
                aria-label={t('stores.searchPlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[color:var(--color-on-surface)] outline-none placeholder:text-[color:var(--color-on-surface-variant)]"
              />

              <button
                type="submit"
                className="h-11 rounded-full bg-[color:var(--color-primary)] px-5 text-[13px] font-bold text-[color:var(--color-on-primary)] transition hover:bg-primary-600"
              >
                {isRTL ? 'بحث' : 'Search'}
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] p-1 dark:bg-[color:var(--color-surface)]">
              {(['all', 'featured', 'premium'] as const).map((filter) => {
                const active = storeFilter === filter;
                const label =
                  filter === 'all'
                    ? isRTL
                      ? 'الكل'
                      : 'All'
                    : filter === 'featured'
                      ? isRTL
                        ? 'مميزة'
                        : 'Featured'
                      : isRTL
                        ? 'موثوقة'
                        : 'Trusted';

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStoreFilter(filter)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full px-3 text-[12px] font-bold transition-colors',
                      active
                        ? 'bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)]'
                        : 'text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-on-surface)]',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-11 w-[154px] rounded-full border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] text-[12px] font-bold dark:bg-[color:var(--color-surface)]">
                <SlidersHorizontal className="me-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="rating">{t('stores.sortRating')}</SelectItem>
                <SelectItem value="products">{t('stores.sortProducts')}</SelectItem>
                <SelectItem value="name">{t('stores.sortName')}</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleReset}
                aria-label={isRTL ? 'تصفير' : 'Reset'}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] text-[color:var(--color-on-surface-variant)] transition hover:text-[color:var(--color-on-surface)] dark:bg-[color:var(--color-surface)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 px-2 pb-1 text-[12px] font-semibold text-[color:var(--color-on-surface-variant)]">
          <span>
            {loading
              ? t('stores.subtitle')
              : `${filteredStores.length.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${
                  isRTL ? 'نتيجة' : 'results'
                }`}
          </span>

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-primary-container)] px-3 py-1 text-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-high)]"
            >
              &ldquo;{searchQuery}&rdquo;
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </section>

      {loading && <StoresSkeleton />}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && filteredStores.length === 0 && (
        <EmptyState
          icon={<Store className="h-12 w-12" />}
          title={t('stores.noStores')}
          description={searchQuery ? t('stores.noStoresMatch', { query: searchQuery }) : undefined}
        />
      )}

      {!loading && !error && filteredStores.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStores.map((store) => (
            <StoreTile key={store.id} store={store} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-e border-[color:var(--color-outline-variant)] p-4 last:border-e-0">
      <p className="text-[26px] font-black text-[color:var(--color-on-surface)]">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-[color:var(--color-on-surface-variant)]">
        {label}
      </p>
    </div>
  );
}

function StoreTile({ store, locale }: { store: StoreSummary; locale: string }) {
  const isRTL = locale === 'ar';
  const storeName = isRTL ? store.name_ar : store.name_en;
  const products = store.total_products ?? 0;
  const rating = store.average_rating ?? 0;

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-3 transition duration-300 hover:-translate-y-1 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-low)]">
      <div className="rounded-[1.25rem] bg-[color:var(--color-primary-container)] p-4 dark:bg-[color:var(--color-surface-container)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
            <StoreLogo
              slug={store.slug}
              size="lg"
              locale={locale as 'ar' | 'en'}
              className="h-14 w-14"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-1.5">
            {store.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-tertiary)] px-2.5 py-1 text-[10px] font-black text-[color:var(--color-on-tertiary)]">
                <Sparkles className="h-3 w-3" />
                {isRTL ? 'مميز' : 'Featured'}
              </span>
            )}
          </div>
        </div>

        <h2 className="mt-5 line-clamp-1 text-[22px] font-black text-[color:var(--color-on-surface)]">
          {storeName}
        </h2>

        <p className="mt-1 text-[13px] font-semibold text-[color:var(--color-on-surface-variant)]">
          {isRTL ? 'مصدر أسعار وتوفر للمقارنة' : 'Price and availability source'}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[color:var(--color-surface-container-lowest)] p-3 dark:bg-[color:var(--color-surface-container)]">
          <div className="flex items-center gap-1 text-[18px] font-black text-[color:var(--color-on-surface)]">
            <Star className="h-4 w-4 fill-[color:var(--color-tertiary)] text-[color:var(--color-tertiary)]" />
            <span>{rating > 0 ? rating.toFixed(1) : '-'}</span>
          </div>

          <p className="mt-1 text-[11px] font-bold text-[color:var(--color-on-surface-variant)]">
            {isRTL ? 'التقييم' : 'Rating'}
          </p>
        </div>

        <div className="rounded-2xl bg-[color:var(--color-surface-container-lowest)] p-3 dark:bg-[color:var(--color-surface-container)]">
          <div className="flex items-center gap-1 text-[18px] font-black text-[color:var(--color-on-surface)]">
            <Package className="h-4 w-4 text-[color:var(--color-primary)]" />
            <span>{products.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
          </div>

          <p className="mt-1 text-[11px] font-bold text-[color:var(--color-on-surface-variant)]">
            {isRTL ? 'منتج' : 'Products'}
          </p>
        </div>
      </div>
    </article>
  );
}

function StoresSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1.5rem] border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-3 dark:bg-[color:var(--colo-surface-container-low)]"
        >
          <div className="rounded-[1.25rem] bg-[color:var(--color-primary-container)] p-4 dark:bg-[color:var(--color-surface-container)]">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="mt-5 h-6 w-32" />
            <Skeleton className="mt-2 h-4 w-44" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>

          <Skeleton className="mt-3 h-11 rounded-full" />
        </div>
      ))}
    </div>
  );
}