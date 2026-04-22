'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LandingData, LandingDeal } from '@/lib/landing/data';
import { cn } from '@/lib/utils';
import {
  Search,
  ArrowRight,
  Smartphone,
  Laptop,
  Tv,
  Tablet,
  Headphones,
  Gamepad2,
  Camera,
  Monitor,
  Printer,
  Wifi,
  Watch,
  Home,
  CookingPot,
  Sparkle,
  Package,
  Refrigerator,
  WashingMachine,
  ChevronRight,
  ChevronLeft,
  Bell,
  Ticket,
  Zap,
  TrendingDown,
  Apple,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreLogo } from '@/components/ui/store-logo';
import { SARSymbol } from '@/components/ui/price';
import { useLocale } from '@/lib/simple-intl-provider';

/* ─────────────────────── Locale-safe name picking ─────────────────────── */

const ARABIC_RE = /[؀-ۿ]/;
const ASCII_LETTER_RE = /[A-Za-z]/;

function pickEnglishName(name_en: string, name_ar: string): string | null {
  for (const v of [name_en, name_ar]) {
    if (v && ASCII_LETTER_RE.test(v) && !ARABIC_RE.test(v)) return v;
  }
  return null;
}
function pickArabicName(name_en: string, name_ar: string): string | null {
  for (const v of [name_ar, name_en]) if (v && ARABIC_RE.test(v)) return v;
  return null;
}
function localizeName(name_en: string, name_ar: string, locale: string): string | null {
  return locale === 'ar' ? pickArabicName(name_en, name_ar) : pickEnglishName(name_en, name_ar);
}

/* ─────────────────────── Category taxonomy ─────────────────────── */

interface CategoryMeta {
  icon: typeof Smartphone;
  labelAr: string;
  labelEn: string;
  staticImage?: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  smartphone:    { icon: Smartphone,     labelAr: 'الهواتف',              labelEn: 'Phones',        staticImage: '/images/categories/phones.jpg' },
  laptop:        { icon: Laptop,         labelAr: 'اللابتوبات',           labelEn: 'Laptops',       staticImage: '/images/categories/laptops.webp' },
  tablet:        { icon: Tablet,         labelAr: 'الأجهزة اللوحية',      labelEn: 'Tablets',       staticImage: '/images/categories/tablets.png' },
  tv:            { icon: Tv,             labelAr: 'التلفزيونات',          labelEn: 'TVs',           staticImage: '/images/categories/tv.jpg' },
  audio:         { icon: Headphones,     labelAr: 'الصوتيات',             labelEn: 'Audio',         staticImage: '/images/categories/audio.png' },
  gaming:        { icon: Gamepad2,       labelAr: 'الألعاب',              labelEn: 'Gaming',        staticImage: '/images/categories/gaming.jpg' },
  camera:        { icon: Camera,         labelAr: 'الكاميرات',            labelEn: 'Cameras',       staticImage: '/images/categories/cameras.webp' },
  monitor:       { icon: Monitor,        labelAr: 'الشاشات',              labelEn: 'Monitors',      staticImage: '/images/categories/monitors.jpg' },
  printer:       { icon: Printer,        labelAr: 'الطابعات',             labelEn: 'Printers',      staticImage: '/images/categories/printers.png' },
  networking:    { icon: Wifi,           labelAr: 'الشبكات',              labelEn: 'Networking',    staticImage: '/images/categories/networking.jpg' },
  smart_home:    { icon: Home,           labelAr: 'المنزل الذكي',         labelEn: 'Smart Home',    staticImage: '/images/categories/smart_home.png' },
  wearable:      { icon: Watch,          labelAr: 'الأجهزة القابلة للارتداء', labelEn: 'Wearables',    staticImage: '/images/categories/wearables.jpg' },
  appliance:     { icon: WashingMachine, labelAr: 'الأجهزة المنزلية',     labelEn: 'Appliances',    staticImage: '/images/categories/appliances.jpeg' },
  kitchen:       { icon: CookingPot,     labelAr: 'المطبخ',               labelEn: 'Kitchen',       staticImage: '/images/categories/kitchen.webp' },
  personal_care: { icon: Sparkle,        labelAr: 'العناية الشخصية',      labelEn: 'Personal Care', staticImage: '/images/categories/personal_care.jpeg' },
  accessories:   { icon: Package,        labelAr: 'الإكسسوارات',          labelEn: 'Accessories',   staticImage: '/images/categories/accessories.jpeg' },
  refrigerator:  { icon: Refrigerator,   labelAr: 'الثلاجات',             labelEn: 'Fridges',       staticImage: '/images/categories/fridges.jpg' },
};

/** "Hero tier" — big visual tiles above the fold */
const HERO_CATEGORIES = ['smartphone', 'laptop', 'tv', 'audio', 'appliance', 'gaming'];

/** Full display order for the exhaustive secondary grid */
const CATEGORY_DISPLAY_ORDER = [
  'smartphone', 'laptop', 'tablet', 'tv', 'audio', 'gaming',
  'camera', 'monitor', 'wearable', 'networking', 'smart_home', 'printer',
  'appliance', 'refrigerator', 'kitchen', 'personal_care', 'accessories',
];

/* ─────────────────────── Entry ─────────────────────── */

interface LandingPageClientProps {
  data?: LandingData;
}

export default function LandingPageClient({ data }: LandingPageClientProps = {}) {
  const safe: LandingData = data ?? {
    topDeals: [], featured: [], stores: [],
    categoryCounts: {}, categoryImages: {},
    totalSavings: 0, totalStores: 0, totalProducts: 0,
  };
  return (
    <div className="bg-[color:var(--color-surface)]">
      <Hero totalStores={safe.totalStores} totalProducts={safe.totalProducts} totalSavings={safe.totalSavings} />
      <HeroCategories categoryImages={safe.categoryImages} categoryCounts={safe.categoryCounts} />
      <TopDealsGrid deals={safe.topDeals} />
      <AllCategories categoryCounts={safe.categoryCounts} />
      <StoresStrip stores={safe.stores} />
      <ValueStripe />
      <AppDownloadBand />
    </div>
  );
}

/* ─────────────────────── Hero ─────────────────────── */

function Hero({
  totalStores,
  totalProducts,
  totalSavings,
}: {
  totalStores: number;
  totalProducts: number;
  totalSavings: number;
}) {
  const { isRTL, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/${locale}/search?q=${encodeURIComponent(q)}` : `/${locale}/search`);
  };

  return (
    <section className="relative overflow-hidden border-b border-[color:var(--color-outline-variant)]/40">
      {/* Soft background wash — a subtle primary-tinted radial at the top.
          Split per-theme because `--color-primary-50` has no dark override
          (it's defined once as light mint), so reusing it in dark mode
          produced a bright silvery halo. Dark mode now uses a very
          low-alpha primary-700 so the glow feels like an extension of the
          brand green instead of a blown-out light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, var(--color-primary-50), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(48, 107, 84, 0.28), transparent 65%)',
        }}
      />
      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-14 md:px-8 md:py-20 lg:py-24">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-[32px] leading-[1.1] sm:text-[44px] md:text-[56px] md:leading-[1.05] font-black text-on-surface max-w-[780px] tracking-tight">
            {isRTL ? (
              <>
                قارن الأسعار
                <span className="text-primary-700"> ووفّر.</span>
              </>
            ) : (
              <>
                Compare prices.
                <span className="text-primary-700"> Save money.</span>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] md:text-base text-on-surface-variant">
            {isRTL
              ? 'الإلكترونيات والأجهزة المنزلية من أكبر المتاجر السعودية، في صفحة واحدة.'
              : 'Electronics and home appliances from top Saudi stores, on one page.'}
          </p>

          {/* Search — THE primary interaction. The soft primary-tinted ring
              is permanent (gives the field its Rakhys-like "glow" even at
              rest); on focus the ring darkens and the border turns primary
              so the active state still reads clearly. */}
          <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
            <div className="group relative flex items-center rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] ring-4 ring-primary/15 transition-all focus-within:border-primary focus-within:ring-primary/30">
              <Search className="pointer-events-none absolute start-5 h-5 w-5 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isRTL ? 'ابحث عن iPhone 15، ثلاجة LG، سماعات...' : 'Search iPhone 15, LG fridge, headphones...'}
                className="hero-search-input min-w-0 flex-1 bg-transparent py-3.5 md:py-4 text-[15px] md:text-[16px] text-on-surface placeholder:text-on-surface-variant/70 ps-14 pe-2 outline-none"
                aria-label={isRTL ? 'البحث عن منتج' : 'Search for a product'}
              />
              <Button type="submit" size="lg" className="m-1.5 shrink-0 rounded-full px-5 md:px-6">
                {isRTL ? 'بحث' : 'Search'}
                <ArrowRight className={cn('h-4 w-4', isRTL && 'rotate-180')} />
              </Button>
            </div>
          </form>

          {/* Trust strip — compact, one line */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-on-surface-variant">
            {totalStores > 0 && (
              <TrustInline>
                <span className="font-bold text-on-surface">{totalStores.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>{' '}
                {isRTL ? 'متجر سعودي' : 'Saudi stores'}
              </TrustInline>
            )}
            {totalProducts > 0 && (
              <TrustInline>
                <span className="font-bold text-on-surface">{formatCompact(totalProducts, isRTL)}</span>{' '}
                {isRTL ? 'منتج' : 'products'}
              </TrustInline>
            )}
            {totalSavings > 0 && (
              <TrustInline dot>
                <span className="font-bold text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)]">
                  {formatCompact(totalSavings, isRTL)}
                </span>
                <SARSymbol className="w-2.5 h-2.5 fill-current text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)] ms-0.5" />
                {' '}
                {isRTL ? 'متاحة للتوفير' : 'in savings available'}
              </TrustInline>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustInline({ children, dot = false }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {dot && <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-on-surface-variant/40" />}
      {children}
    </span>
  );
}

function formatCompact(n: number, isRTL: boolean): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}${isRTL ? 'م' : 'M'}`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}${isRTL ? 'ك' : 'K'}`;
  return n.toLocaleString(isRTL ? 'ar-SA' : 'en-US');
}

/* ─────────────────────── Hero categories (6 big tiles) ─────────────────────── */

function HeroCategories({
  categoryImages,
  categoryCounts,
}: {
  categoryImages: Record<string, string>;
  categoryCounts: Record<string, number>;
}) {
  const { isRTL, locale } = useLocale();
  const items = HERO_CATEGORIES
    .filter((slug) => CATEGORY_META[slug])
    .map((slug) => ({
      slug,
      ...CATEGORY_META[slug],
      count: categoryCounts[slug] ?? 0,
      img: CATEGORY_META[slug].staticImage ?? categoryImages[slug] ?? null,
    }));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-10 md:px-8 md:py-14">
      <SectionHeader
        title={isRTL ? 'تسوّق حسب الفئة' : 'Shop by category'}
        subtitle={isRTL ? 'تصفّح أكثر الفئات طلباً' : 'Jump into the most popular categories'}
      />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {items.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.slug}
              href={`/${locale}/search?category=${cat.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface-container-low)] aspect-[4/5] flex flex-col transition-all hover:border-primary hover:shadow-lg"
            >
              {/* Image fills most of the tile */}
              <div className="relative flex-1 bg-[color:var(--color-surface-container-lowest)]">
                {cat.img ? (
                  <Image
                    src={cat.img}
                    alt=""
                    aria-hidden
                    fill
                    sizes="(min-width: 768px) 16vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-primary-600">
                    <Icon className="h-16 w-16" strokeWidth={1.25} />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {/* Label footer */}
              <div className="p-3 flex items-center justify-between gap-2 bg-[color:var(--color-surface-bright)]">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate leading-tight">
                    {isRTL ? cat.labelAr : cat.labelEn}
                  </p>
                  {cat.count > 0 && (
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {cat.count.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'منتج' : 'items'}
                    </p>
                  )}
                </div>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────── Top Deals grid ─────────────────────── */

function TopDealsGrid({ deals }: { deals: LandingDeal[] }) {
  const { isRTL, locale } = useLocale();
  const items = deals
    .map((d) => {
      const name = localizeName(d.name_en, d.name_ar, locale);
      if (!name) return null;
      return { ...d, name };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 6);

  if (!items.length) return null;

  return (
    <section className="bg-[color:var(--color-surface-container-lowest)] border-y border-[color:var(--color-outline-variant)]/40">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-12 md:px-8 md:py-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <TrendingDown className="h-6 w-6 text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)]" />
                {isRTL ? 'أفضل العروض' : 'Top deals'}
              </span>
            }
            subtitle={isRTL ? 'أكبر التخفيضات النشطة في الكتالوج' : 'Biggest active discounts on the catalog'}
            inline
          />
          <Link
            href={`/${locale}/deals`}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary"
          >
            {isRTL ? 'كل العروض' : 'All deals'}
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((it) => {
            const discountPct = it.original_price > 0
              ? Math.round(((it.original_price - it.current_price) / it.original_price) * 100)
              : 0;
            return (
              <Link
                key={it.product_id}
                href={`/${locale}/products/${it.product_slug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] transition-all hover:border-primary/60 hover:shadow-md"
              >
                {/* Discount badge */}
                {discountPct > 0 && (
                  <span className="absolute start-2 top-2 z-10 inline-flex items-center rounded-full bg-[var(--brand-gold)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-dark-text)] shadow-sm">
                    -{discountPct}%
                  </span>
                )}

                {/* Image */}
                <div className="relative aspect-square bg-[color:var(--color-surface-container-lowest)]">
                  {it.image_url ? (
                    <Image
                      src={it.image_url}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 50vw"
                      className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-on-surface-variant/30">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-3 flex flex-col gap-1.5">
                  <p
                    dir="auto"
                    title={it.name}
                    className="text-[13px] font-medium text-on-surface line-clamp-2 leading-tight min-h-[2.3rem]"
                  >
                    {it.name}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-auto">
                    <span className="text-base font-bold text-primary-700">
                      {Math.round(it.current_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                    </span>
                    <SARSymbol className="w-3 h-3 fill-current text-primary-700" />
                    {it.original_price > it.current_price && (
                      <span className="text-[11px] text-on-surface-variant line-through">
                        {Math.round(it.original_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {isRTL ? it.store_name_ar : it.store_name_en}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Mobile "See all" */}
        <div className="mt-6 sm:hidden text-center">
          <Link
            href={`/${locale}/deals`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700"
          >
            {isRTL ? 'كل العروض' : 'See all deals'}
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── All categories (compact chips) ─────────────────────── */

function AllCategories({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const { isRTL, locale } = useLocale();
  const items = CATEGORY_DISPLAY_ORDER
    .filter((slug) => CATEGORY_META[slug])
    .map((slug) => ({ slug, ...CATEGORY_META[slug], count: categoryCounts[slug] ?? 0 }));

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-12 md:px-8 md:py-16">
      <SectionHeader
        title={isRTL ? 'كل الفئات' : 'Browse all categories'}
        subtitle={isRTL ? 'تصفّح كل فئات المنتجات المدعومة' : 'Every category we cover'}
      />
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.slug}
              href={`/${locale}/search?category=${cat.slug}`}
              className="group flex items-center gap-3 rounded-xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-3 transition-all hover:border-primary hover:bg-primary-50/40"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary group-hover:text-on-primary">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface truncate leading-tight">
                  {isRTL ? cat.labelAr : cat.labelEn}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {cat.count > 0
                    ? `${cat.count.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'منتج' : 'items'}`
                    : (isRTL ? 'تصفّح' : 'Browse')}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────── Stores strip ─────────────────────── */

function StoresStrip({ stores }: { stores: LandingData['stores'] }) {
  const { isRTL, locale } = useLocale();
  const list = stores.slice(0, 8);
  if (!list.length) return null;

  return (
    <section className="bg-[color:var(--color-surface-container-lowest)] border-y border-[color:var(--color-outline-variant)]/40">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-12 md:px-8 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <SectionHeader
            title={isRTL ? 'المتاجر المدعومة' : 'Supported stores'}
            subtitle={isRTL ? `${list.length} متجر سعودي في مقارنة واحدة` : `${list.length} Saudi stores in one search`}
            inline
          />
          <Link
            href={`/${locale}/stores`}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary"
          >
            {isRTL ? 'كل المتاجر' : 'All stores'}
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-4 md:grid-cols-8">
          {list.map((s) => (
            <Link
              key={s.slug}
              href={`/${locale}/stores/${s.slug}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-4 transition-all hover:border-primary hover:shadow-sm"
              title={isRTL ? s.name_ar : s.name_en}
            >
              <StoreLogo slug={s.slug} size="lg" locale={locale as 'ar' | 'en'} />
              <span className="text-[11px] text-on-surface-variant text-center line-clamp-1 group-hover:text-primary-700">
                {(isRTL ? s.name_ar : s.name_en) || s.slug}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Value props (compact band) ─────────────────────── */

function ValueStripe() {
  const { isRTL } = useLocale();
  const props = isRTL
    ? [
        { icon: Zap, title: 'مقارنة فورية', desc: 'كل الأسعار في صفحة واحدة.' },
        { icon: Bell, title: 'تنبيهات الأسعار', desc: 'اضبط السعر المستهدف واحصل على تنبيه فوري.' },
        { icon: Ticket, title: 'كوبونات نشطة', desc: 'كوبونات المتاجر السعودية الحالية.' },
      ]
    : [
        { icon: Zap, title: 'Instant compare', desc: 'Every price on one page.' },
        { icon: Bell, title: 'Price alerts', desc: 'Set a target — we tell you when it hits.' },
        { icon: Ticket, title: 'Live coupons', desc: 'Current codes from Saudi stores.' },
      ];

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-12 md:px-8 md:py-14">
      <div className="grid gap-4 md:grid-cols-3">
        {props.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className="flex items-start gap-4 rounded-xl border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] p-5"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h3 className="text-base font-bold text-on-surface">{p.title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{p.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────── App download band ─────────────────────── */

function AppDownloadBand() {
  const { isRTL } = useLocale();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 pb-16 md:px-8 md:pb-20">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-700 p-8 md:p-10 text-on-primary">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-[var(--brand-gold)]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-20 -bottom-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-black leading-tight">
              {isRTL ? 'حمّل تطبيق توفيري' : 'Get the Tawveeri app'}
            </h2>
            <p className="mt-2 text-sm md:text-base text-on-primary/85">
              {isRTL
                ? 'امسح الباركود، اضبط تنبيهات الأسعار، وقارن أسرع — كل هذا من هاتفك.'
                : 'Scan barcodes, set price alerts, and compare faster — right from your phone.'}
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <StoreBadge
              platform="apple"
              label={isRTL ? 'حمّل من' : 'Download on the'}
              name={isRTL ? 'آب ستور' : 'App Store'}
              href="#"
            />
            <StoreBadge
              platform="google"
              label={isRTL ? 'احصل عليه من' : 'GET IT ON'}
              name={isRTL ? 'جوجل بلاي' : 'Google Play'}
              href="#"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({
  platform,
  label,
  name,
  href,
}: {
  platform: 'apple' | 'google';
  label: string;
  name: string;
  href: string;
}) {
  const Icon = platform === 'apple' ? Apple : Play;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-3 rounded-xl bg-black px-4 py-2.5 transition-transform hover:scale-[1.02] text-white min-w-[160px]"
    >
      <Icon className="h-7 w-7 shrink-0" strokeWidth={1.5} />
      <div className="flex flex-col leading-tight text-start">
        <span className="text-[10px] opacity-80 uppercase tracking-wide">{label}</span>
        <span className="text-sm font-bold">{name}</span>
      </div>
    </a>
  );
}

/* ─────────────────────── Shared ─────────────────────── */

function SectionHeader({
  title,
  subtitle,
  inline = false,
}: {
  title: React.ReactNode;
  subtitle?: string;
  inline?: boolean;
}) {
  return (
    <div className={cn('max-w-2xl', !inline && 'text-start')}>
      <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
    </div>
  );
}
