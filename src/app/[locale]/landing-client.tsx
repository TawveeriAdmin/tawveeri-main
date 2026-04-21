'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LandingData } from '@/lib/landing/data';
import {
  Search,
  ArrowRight,
  Zap,
  Bell,
  Ticket,
  TrendingDown,
  Store,
  Smartphone,
  Laptop,
  Tv,
  Headphones,
  Gamepad2,
  Camera,
  Refrigerator,
  WashingMachine,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StoreLogo } from '@/components/ui/store-logo';
import { SARSymbol } from '@/components/ui/price';
import { useLocale } from '@/lib/simple-intl-provider';
import { SEARCH_STORE_DISPLAY_NAMES } from '@/lib/scraping/product-adapter';

/** Brand-voice static ticker items — v2 will replace with SSR `notifications` feed */
const TICKER_SAMPLES_AR = [
  { product: 'iPhone 15 Pro Max 256GB', drop: 450, store: 'Amazon SA' },
  { product: 'غسالة سامسونج أوتوماتيك 9 كيلو', drop: 320, store: 'Extra' },
  { product: 'MacBook Air M3 13-inch', drop: 800, store: 'Jarir' },
  { product: 'شاشة LG OLED 55 بوصة', drop: 1200, store: 'Almanea' },
  { product: 'Sony PS5 Standard', drop: 250, store: 'Noon' },
  { product: 'مكيف سبليت 24000 وحدة', drop: 550, store: 'Shaker' },
  { product: 'Samsung Galaxy S24 Ultra', drop: 600, store: 'Samsung SA' },
  { product: 'ثلاجة LG جانبية 26 قدم', drop: 900, store: 'SWSG' },
];

const TICKER_SAMPLES_EN = [
  { product: 'iPhone 15 Pro Max 256GB', drop: 450, store: 'Amazon SA' },
  { product: 'Samsung 9kg Front Load Washer', drop: 320, store: 'Extra' },
  { product: 'MacBook Air M3 13-inch', drop: 800, store: 'Jarir' },
  { product: 'LG OLED 55" TV', drop: 1200, store: 'Almanea' },
  { product: 'Sony PS5 Standard', drop: 250, store: 'Noon' },
  { product: 'Split AC 24000 BTU', drop: 550, store: 'Shaker' },
  { product: 'Samsung Galaxy S24 Ultra', drop: 600, store: 'Samsung SA' },
  { product: 'LG Side-by-Side Fridge 26cu.ft', drop: 900, store: 'SWSG' },
];

const CATEGORIES = [
  { slug: 'smartphone', icon: Smartphone, emoji: '📱', labelAr: 'هواتف', labelEn: 'Phones' },
  { slug: 'laptop', icon: Laptop, emoji: '💻', labelAr: 'لابتوب', labelEn: 'Laptops' },
  { slug: 'tv', icon: Tv, emoji: '📺', labelAr: 'تلفزيونات', labelEn: 'TVs' },
  { slug: 'audio', icon: Headphones, emoji: '🎧', labelAr: 'صوتيات', labelEn: 'Audio' },
  { slug: 'gaming', icon: Gamepad2, emoji: '🎮', labelAr: 'ألعاب', labelEn: 'Gaming' },
  { slug: 'camera', icon: Camera, emoji: '📷', labelAr: 'كاميرات', labelEn: 'Cameras' },
  { slug: 'washing_machine', icon: WashingMachine, emoji: '🫧', labelAr: 'غسالات', labelEn: 'Washers' },
  { slug: 'refrigerator', icon: Refrigerator, emoji: '🧊', labelAr: 'ثلاجات', labelEn: 'Fridges' },
] as const;

const FEATURED_COMPARISONS_AR = [
  { title: 'iPhone 15 Pro Max', subtitle: 'قارن بين 5 متاجر', savings: 750, gradient: 'from-[var(--brand-green-dark)] to-[var(--brand-green)]', href: '/compare?product=iphone-15-pro-max' },
  { title: 'غسالة 10kg أوتوماتيك', subtitle: 'أفضل 4 متاجر', savings: 620, gradient: 'from-[var(--brand-green)] to-[var(--brand-gold)]', href: '/compare?category=washing_machine' },
  { title: 'MacBook Air M3', subtitle: 'قارن المتاجر', savings: 900, gradient: 'from-[var(--brand-gold-dark)] to-[var(--brand-gold)]', href: '/compare?product=macbook-air-m3' },
];

const FEATURED_COMPARISONS_EN = [
  { title: 'iPhone 15 Pro Max', subtitle: 'Compared across 5 stores', savings: 750, gradient: 'from-[var(--brand-green-dark)] to-[var(--brand-green)]', href: '/compare?product=iphone-15-pro-max' },
  { title: '10kg Front Load Washer', subtitle: 'Top 4 stores', savings: 620, gradient: 'from-[var(--brand-green)] to-[var(--brand-gold)]', href: '/compare?category=washing_machine' },
  { title: 'MacBook Air M3', subtitle: 'Compare stores', savings: 900, gradient: 'from-[var(--brand-gold-dark)] to-[var(--brand-gold)]', href: '/compare?product=macbook-air-m3' },
];

const VALUE_PROPS_AR = [
  { icon: Zap, title: 'مقارنة فورية', description: 'ابحث مرة، واحصل على الأسعار من 8 متاجر في ثوانٍ.' },
  { icon: Bell, title: 'تنبيهات ذكية', description: 'اضبط سعرك المستهدف ونحن ننبّهك لحظة انخفاضه.' },
  { icon: Ticket, title: 'كوبونات نشطة', description: 'كوبونات تُطبَّق تلقائيًا على أفضل سعر قبل الشراء.' },
];

const VALUE_PROPS_EN = [
  { icon: Zap, title: 'Instant comparison', description: 'Search once, get every price from 8 stores in seconds.' },
  { icon: Bell, title: 'Smart alerts', description: 'Set your target price and we notify you the moment it drops.' },
  { icon: Ticket, title: 'Live coupons', description: 'Coupons applied automatically to the best price before you buy.' },
];

const FEATURED_STORES: string[] = [
  'amazon', 'noon', 'jarir', 'extra', 'almanea', 'shaker', 'samsung_ksa', 'swsg',
];

interface LandingPageClientProps {
  data?: LandingData;
}

export default function LandingPageClient({ data }: LandingPageClientProps = {}) {
  const safeData: LandingData = data ?? {
    topDeals: [],
    featured: [],
    stores: [],
    categoryCounts: {},
    totalSavings: 0,
  };
  return (
    <div className="bg-[color:var(--color-surface)]">
      <Hero />
      <CategoryRail />
      <PriceDropTicker deals={safeData.topDeals} />
      <FeaturedComparisons featured={safeData.featured} />
      <PopularCategories categoryCounts={safeData.categoryCounts} />
      <FeaturedStores stores={safeData.stores} />
      <ValueProps />
      <SavingsStat totalSavings={safeData.totalSavings} />
      <AppCta />
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  const { isRTL, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/${locale}/search?q=${encodeURIComponent(q)}` : `/${locale}/search`);
  };

  return (
    <section className="relative overflow-hidden bg-[color:var(--color-surface-container)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(85,178,149,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(226,187,78,0.10), transparent 60%)',
        }}
      />
      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-24 lg:py-28">
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary" className="mb-6">
            <Sparkles className="h-3 w-3 me-1.5" />
            {isRTL ? 'الجديد في توفيري' : 'New on Tawveeri'} · {isRTL ? '8 متاجر' : '8 stores'}
          </Badge>

          <h1 className="t-h1 md:text-[52px] md:leading-[60px] text-on-surface max-w-[820px] font-black">
            {isRTL ? (
              <>
                قارن الأسعار.
                <span className="text-[var(--brand-green-dark)]"> وفّر المال. </span>
                اشترِ بذكاء.
              </>
            ) : (
              <>
                Compare prices.
                <span className="text-[var(--brand-green-dark)]"> Save money. </span>
                Shop smart.
              </>
            )}
          </h1>

          <p className="mt-5 max-w-[620px] t-body text-on-surface-variant">
            {isRTL
              ? 'أكبر منصة مقارنة أسعار للإلكترونيات والأجهزة المنزلية في السعودية. من أمازون إلى اكسترا، كل الأسعار في مكان واحد.'
              : 'Saudi Arabia\'s largest price comparison platform for electronics and home appliances. Every price from every store, in one search.'}
          </p>

          <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
            <div className="group relative flex items-center overflow-hidden rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] shadow-[var(--elevation-1)] transition-shadow focus-within:shadow-[var(--elevation-3)] focus-within:border-[var(--brand-green)]">
              <Search className="pointer-events-none absolute start-5 h-5 w-5 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isRTL
                    ? 'ابحث عن iPhone 15، ثلاجة LG، مكيف سبليت...'
                    : 'Search for iPhone 15, LG fridge, Split AC...'
                }
                className="min-w-0 flex-1 bg-transparent py-4 text-[16px] text-on-surface outline-none placeholder:text-on-surface-variant/70 ps-14 pe-3"
                aria-label={isRTL ? 'البحث عن منتج' : 'Search for a product'}
              />
              <Button type="submit" size="lg" className="m-1.5 shrink-0 px-6">
                {isRTL ? 'بحث' : 'Search'}
                <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <TrustChip icon={Store}>{isRTL ? '8 متاجر سعودية' : '8 Saudi stores'}</TrustChip>
            <TrustChip icon={RefreshCw}>{isRTL ? 'تحديث يومي' : 'Daily updates'}</TrustChip>
            <TrustChip icon={ShieldCheck}>{isRTL ? 'بدون رسوم' : 'No fees'}</TrustChip>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustChip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)]/80 px-3 py-1.5 t-small text-on-surface-variant">
      <Icon className="h-3.5 w-3.5 text-[var(--brand-green-dark)]" />
      {children}
    </span>
  );
}

/* ───────────────────────── Category rail ───────────────────────── */

function CategoryRail() {
  const { isRTL, locale } = useLocale();

  return (
    <section className="border-b border-[color:var(--color-outline-variant)]/50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                href={`/${locale}/search?category=${cat.slug}`}
                className="group shrink-0 snap-start inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--brand-green-light)] bg-[var(--brand-green)]/5 px-4 py-2 transition-all hover:border-[var(--brand-green)] hover:bg-[var(--brand-green)] hover:text-white hover:shadow-[var(--elevation-2)]"
              >
                <Icon
                  className="h-4 w-4 text-[var(--brand-green-dark)] transition-colors group-hover:text-white"
                  strokeWidth={1.75}
                />
                <span className="t-body-strong text-on-surface group-hover:text-white transition-colors">
                  {isRTL ? cat.labelAr : cat.labelEn}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Price-drop ticker ───────────────────────── */

function PriceDropTicker({ deals }: { deals: LandingData['topDeals'] }) {
  const { isRTL, locale } = useLocale();
  const fallbackItems = isRTL ? TICKER_SAMPLES_AR : TICKER_SAMPLES_EN;
  const items = useMemo(() => {
    if (!deals?.length) return null;
    return deals.map((d) => ({
      product: isRTL ? d.name_ar : d.name_en,
      drop: Math.round(d.savings),
      store: isRTL ? d.store_name_ar : d.store_name_en,
      productSlug: d.product_slug,
    }));
  }, [deals, isRTL]);
  const displayItems = items ?? fallbackItems;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % displayItems.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [displayItems.length]);

  const current = displayItems[index];
  const currentProductSlug = (current as { productSlug?: string })?.productSlug;

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 md:px-8 mt-4">
      <div className="rounded-[var(--radius-md)] border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/8 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 t-caption font-bold text-[var(--brand-gold-dark)] shrink-0">
            <TrendingDown className="h-3.5 w-3.5" />
            {isRTL ? 'انخفاض' : 'Live'}
          </span>
          <span aria-hidden className="h-4 w-px bg-[var(--brand-gold)]/30 shrink-0" />
          <div key={index} className="flex flex-1 min-w-0 items-center justify-center overflow-hidden leading-none">
            {currentProductSlug ? (
              <Link
                href={`/${locale}/products/${currentProductSlug}`}
                className="t-small text-on-surface truncate text-center my-0 animate-in fade-in duration-500 hover:underline"
              >
                <span className="font-semibold">{current.product}</span>
                <span className="text-on-surface-variant mx-2">·</span>
                <span className="inline-flex items-center gap-1 text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)] font-bold">
                  {isRTL ? 'وفّر' : 'Save'} {current.drop}
                  <SARSymbol className="w-3 h-3 fill-current" />
                </span>
                <span className="text-on-surface-variant mx-2">·</span>
                <span className="text-on-surface-variant">{current.store}</span>
              </Link>
            ) : (
              <p className="t-small text-on-surface truncate text-center my-0 animate-in fade-in duration-500">
                <span className="font-semibold">{current.product}</span>
                <span className="text-on-surface-variant mx-2">·</span>
                <span className="inline-flex items-center gap-1 text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)] font-bold">
                  {isRTL ? 'وفّر' : 'Save'} {current.drop}
                  <SARSymbol className="w-3 h-3 fill-current" />
                </span>
                <span className="text-on-surface-variant mx-2">·</span>
                <span className="text-on-surface-variant">{current.store}</span>
              </p>
            )}
          </div>
          <Link
            href={`/${locale}/deals`}
            className="hidden md:inline-flex items-center gap-1 shrink-0 t-small font-semibold text-[var(--brand-green-dark)] dark:text-[var(--brand-green)] hover:text-[var(--brand-gold-dark)] transition-colors"
          >
            {isRTL ? 'عرض الكل' : 'See all'}
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Featured comparisons ───────────────────────── */

const FEATURED_GRADIENTS = [
  'from-[var(--brand-green-dark)] to-[var(--brand-green)]',
  'from-[var(--brand-green)] to-[var(--brand-gold)]',
  'from-[var(--brand-gold-dark)] to-[var(--brand-gold)]',
  'from-[var(--brand-green-dark)] to-[var(--brand-gold-dark)]',
  'from-[var(--brand-gold)] to-[var(--brand-green)]',
  'from-[var(--brand-green)] to-[var(--brand-green-dark)]',
] as const;

function FeaturedComparisons({ featured }: { featured: LandingData['featured'] }) {
  const { isRTL, locale } = useLocale();
  const fallback = isRTL ? FEATURED_COMPARISONS_AR : FEATURED_COMPARISONS_EN;
  const items = featured.length
    ? featured.slice(0, 3).map((f, i) => ({
        title: isRTL ? f.name_ar : f.name_en,
        subtitle: isRTL
          ? `قارن في ${f.store_count} ${f.store_count === 1 ? 'متجر' : 'متاجر'}`
          : `Compared across ${f.store_count} store${f.store_count === 1 ? '' : 's'}`,
        savings: Math.round(f.max_savings),
        gradient: FEATURED_GRADIENTS[i % FEATURED_GRADIENTS.length],
        href: `/products/${f.product_slug}`,
      }))
    : fallback;

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="t-h2 text-on-surface">
            {isRTL ? 'مقارنات مختارة' : "Editor's comparisons"}
          </h2>
          <p className="mt-2 t-body text-on-surface-variant max-w-lg">
            {isRTL
              ? 'قصص مقارنة حقيقية — نختار المنتج، نقارن المتاجر، ونعرض لك أين تشتري.'
              : 'Real comparison stories — we pick the product, compare stores, and show you where to buy.'}
          </p>
        </div>
        <Link
          href={`/${locale}/compare`}
          className="hidden md:inline-flex items-center gap-1 t-body-strong text-[var(--brand-green-dark)] hover:text-[var(--brand-green)]"
        >
          {isRTL ? 'كل المقارنات' : 'All comparisons'}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.title}
            href={`/${locale}${item.href}`}
            className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br ${item.gradient} p-6 text-white shadow-[var(--elevation-1)] transition-all hover:shadow-[var(--elevation-3)] hover:-translate-y-0.5`}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -end-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative">
              <p className="t-caption text-white/80">{item.subtitle}</p>
              <h3 className="t-h3 mt-2 font-bold">{item.title}</h3>
            </div>
            <div className="relative mt-6 flex items-end justify-between">
              <div>
                <p className="t-caption text-white/70">
                  {isRTL ? 'أقصى توفير حتى الآن' : 'Max savings found'}
                </p>
                <p className="t-h3 mt-0.5 font-black inline-flex items-center gap-1.5">
                  {item.savings}
                  <SARSymbol className="w-5 h-5 fill-current" />
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 t-small font-semibold">
                {isRTL ? 'قارن' : 'Compare'}
                {isRTL ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Popular categories ───────────────────────── */

function PopularCategories({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const { isRTL, locale } = useLocale();

  return (
    <section className="bg-[color:var(--color-surface-container)]/50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
        <h2 className="t-h2 text-on-surface mb-2">
          {isRTL ? 'فئات شائعة' : 'Popular categories'}
        </h2>
        <p className="t-body text-on-surface-variant mb-8 max-w-lg">
          {isRTL
            ? 'ابدأ من فئتك المفضلة وقارن الأسعار فورًا.'
            : 'Start from your favorite category and compare prices instantly.'}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.slug] ?? 0;
            const countLabel = count > 0
              ? (isRTL ? `${count.toLocaleString('ar-SA')} منتج` : `${count.toLocaleString('en-US')} products`)
              : (isRTL ? 'ابدأ المقارنة ←' : 'Start comparing →');
            return (
              <Link
                key={cat.slug}
                href={`/${locale}/search?category=${cat.slug}`}
                className="group flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-5 transition-all hover:border-[var(--brand-green)] hover:shadow-[var(--elevation-2)] hover:-translate-y-0.5"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-green)]/10 text-[var(--brand-green-dark)] dark:text-[var(--brand-green)] transition-colors group-hover:bg-[var(--brand-gold)]/20 group-hover:text-[var(--brand-gold-dark)]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="flex flex-col">
                  <span className="t-body-strong text-on-surface">
                    {isRTL ? cat.labelAr : cat.labelEn}
                  </span>
                  <span className="t-small text-on-surface-variant group-hover:text-[var(--brand-green-dark)]">
                    {countLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Featured stores ───────────────────────── */

function FeaturedStores({ stores }: { stores: LandingData['stores'] }) {
  const { isRTL, locale } = useLocale();

  const list = stores.length
    ? stores.slice(0, 8)
    : FEATURED_STORES.map((slug) => ({
        slug,
        name_ar: SEARCH_STORE_DISPLAY_NAMES[slug]?.name_ar ?? slug,
        name_en: SEARCH_STORE_DISPLAY_NAMES[slug]?.name_en ?? slug,
        logo_url: null,
        average_rating: null as number | null,
        total_reviews: null as number | null,
      }));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h2 className="t-h2 text-on-surface">
            {isRTL ? 'متاجر مدعومة' : 'Supported stores'}
          </h2>
          <p className="mt-2 t-body text-on-surface-variant">
            {isRTL
              ? `${list.length} متاجر سعودية في مقارنة واحدة.`
              : `${list.length} Saudi stores in one comparison.`}
          </p>
        </div>
        <Link
          href={`/${locale}/stores`}
          className="hidden md:inline-flex items-center gap-1 t-body-strong text-[var(--brand-green-dark)] hover:text-[var(--brand-green)]"
        >
          {isRTL ? 'كل المتاجر' : 'All stores'}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {list.map((s) => {
          const label = isRTL ? s.name_ar : s.name_en;
          const showRating =
            typeof s.average_rating === 'number' && s.average_rating > 0;
          return (
            <Link
              key={s.slug}
              href={`/${locale}/stores/${s.slug}`}
              className="group flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-4 transition-all hover:border-[var(--brand-green)] hover:shadow-[var(--elevation-1)]"
              title={label}
            >
              <StoreLogo slug={s.slug} size="lg" locale={locale as 'ar' | 'en'} />
              <span className="t-small text-on-surface-variant text-center line-clamp-1 group-hover:text-[var(--brand-green-dark)]">
                {label || s.slug}
              </span>
              {showRating && (
                <span className="inline-flex items-center gap-0.5 t-caption text-[var(--brand-gold-dark)]">
                  <Star className="h-3 w-3 fill-current" />
                  {s.average_rating!.toFixed(1)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── Value props ───────────────────────── */

function ValueProps() {
  const { isRTL } = useLocale();
  const props = isRTL ? VALUE_PROPS_AR : VALUE_PROPS_EN;

  return (
    <section className="bg-[color:var(--color-surface-container-low)]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {props.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] bg-[color:var(--color-surface)] p-6 border border-[color:var(--color-outline-variant)]/50"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-green)]/10 text-[var(--brand-green-dark)] dark:text-[var(--brand-green)]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="t-h4 text-on-surface">{p.title}</h3>
                  <p className="mt-2 t-body text-on-surface-variant">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Savings stat ───────────────────────── */

function formatSavings(value: number, isRTL: boolean): string {
  // Round to nearest thousand for a cleaner hero number.
  const rounded = Math.round(value);
  if (rounded >= 1_000_000) {
    const m = rounded / 1_000_000;
    return isRTL
      ? `+${m.toFixed(m >= 10 ? 0 : 2).replace(/\.0+$/, '')} مليون`
      : `${m.toFixed(m >= 10 ? 0 : 2).replace(/\.0+$/, '')}M+`;
  }
  if (rounded >= 1_000) {
    const k = Math.round(rounded / 1_000);
    return isRTL
      ? `+${k.toLocaleString('ar-SA')}`
      : `${k.toLocaleString('en-US')}K+`;
  }
  return rounded.toLocaleString(isRTL ? 'ar-SA' : 'en-US');
}

function SavingsStat({ totalSavings }: { totalSavings: number }) {
  const { isRTL } = useLocale();
  const displaySavings = totalSavings > 0
    ? formatSavings(totalSavings, isRTL)
    : isRTL ? '+1,250,000' : '1.25M+';

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--brand-green-dark)] via-[var(--brand-green)] to-[var(--brand-green-dark)] p-10 md:p-14 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-20 -top-20 h-80 w-80 rounded-full bg-[var(--brand-gold)]/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-20 -bottom-20 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative flex flex-col items-center text-center">
          <Badge variant="best" className="mb-6">
            <Star className="h-3 w-3 fill-current" />
            {isRTL ? 'ثقة المستخدمين' : 'Trusted by shoppers'}
          </Badge>
          <p className="t-h2 md:text-[44px] md:leading-[52px] font-black">
            {isRTL ? 'ساعدنا المتسوقين على توفير' : "We've helped shoppers save"}
          </p>
          <p className="mt-2 text-[64px] md:text-[96px] font-black leading-none tracking-tight text-[var(--brand-gold)] num-ltr inline-flex items-baseline gap-3 justify-center">
            {displaySavings}
            <SARSymbol className="w-12 h-12 md:w-16 md:h-16 fill-current self-center" />
          </p>
          <p className="mt-4 t-body text-white/80 max-w-lg">
            {isRTL
              ? 'قارن مرة واحدة، وفّر دائمًا. نحن نُحدِّث الأسعار يوميًا عبر 8 متاجر.'
              : 'Compare once, save always. We refresh prices daily across 8 stores.'}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── App CTA ───────────────────────── */

function AppCta() {
  const { isRTL } = useLocale();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-16 md:px-8 md:pb-20">
      <div className="grid gap-8 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--brand-gold)]/60 bg-[var(--brand-gold)]/8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <Badge variant="coupon" className="mb-3">
            <Sparkles className="h-3 w-3" />
            {isRTL ? 'قريبًا' : 'Coming soon'}
          </Badge>
          <h2 className="t-h3 text-on-surface">
            {isRTL
              ? 'توفيري على جوالك — تنبيهات فورية وأفضل الأسعار'
              : 'Tawveeri on your phone — instant alerts and best prices'}
          </h2>
          <p className="mt-2 t-body text-on-surface-variant max-w-lg">
            {isRTL
              ? 'حمّل تطبيق توفيري وكن أول من يعرف بانخفاض الأسعار ونشر الكوبونات الجديدة.'
              : 'Download the Tawveeri app to be first to know about price drops and new coupons.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
          <Button variant="default" size="lg" className="shrink-0">
            {isRTL ? 'تحميل iOS' : 'Download iOS'}
          </Button>
          <Button variant="outline" size="lg" className="shrink-0">
            {isRTL ? 'تحميل Android' : 'Download Android'}
          </Button>
        </div>
      </div>
    </section>
  );
}
