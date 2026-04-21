'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LandingData } from '@/lib/landing/data';
import { cn } from '@/lib/utils';

const ARABIC_RE = /[؀-ۿ]/;
const ASCII_LETTER_RE = /[A-Za-z]/;

/** Returns the name that actually looks like English: ASCII letters present,
 *  no Arabic characters. Picks from either column since the scraper sometimes
 *  writes English text into `name_ar` and vice versa. Returns null when the
 *  product has no English-readable name at all. */
function pickEnglishName(name_en: string, name_ar: string): string | null {
  for (const value of [name_en, name_ar]) {
    if (value && ASCII_LETTER_RE.test(value) && !ARABIC_RE.test(value)) return value;
  }
  return null;
}

/** Symmetric for Arabic — returns null when nothing readable. */
function pickArabicName(name_en: string, name_ar: string): string | null {
  for (const value of [name_ar, name_en]) {
    if (value && ARABIC_RE.test(value)) return value;
  }
  return null;
}

/** Strict locale-aware name picker. Returns null when the product has no
 *  viable name in the requested language — callers should then skip the
 *  item rather than showing the wrong language. */
function localizeName(name_en: string, name_ar: string, locale: string): string | null {
  return locale === 'ar'
    ? pickArabicName(name_en, name_ar)
    : pickEnglishName(name_en, name_ar);
}
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

/**
 * Canonical label + icon map for every value in the `product_category` enum
 * (migrations 01 + 18). Keep the keys in sync with the DB enum; the home grid
 * only renders keys that actually have products, so adding an unused entry is
 * harmless.
 */
interface CategoryMeta {
  icon: typeof Smartphone;
  labelAr: string;
  labelEn: string;
  /** Curated hero image under `public/images/categories/`. Leave out to fall
   *  back to the most-viewed DB product image, then the icon. */
  staticImage?: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  smartphone:    { icon: Smartphone,    labelAr: 'الهواتف',          labelEn: 'Phones',         staticImage: '/images/categories/phones.jpg' },
  laptop:        { icon: Laptop,        labelAr: 'اللابتوبات',       labelEn: 'Laptops',        staticImage: '/images/categories/laptops.webp' },
  tablet:        { icon: Tablet,        labelAr: 'الأجهزة اللوحية',   labelEn: 'Tablets',        staticImage: '/images/categories/tablets.png' },
  tv:            { icon: Tv,            labelAr: 'التلفزيونات',      labelEn: 'TVs',            staticImage: '/images/categories/tv.jpg' },
  audio:         { icon: Headphones,    labelAr: 'الصوتيات',         labelEn: 'Audio',          staticImage: '/images/categories/audio.png' },
  gaming:        { icon: Gamepad2,      labelAr: 'الألعاب',          labelEn: 'Gaming',         staticImage: '/images/categories/gaming.jpg' },
  camera:        { icon: Camera,        labelAr: 'الكاميرات',        labelEn: 'Cameras',        staticImage: '/images/categories/cameras.webp' },
  monitor:       { icon: Monitor,       labelAr: 'الشاشات',          labelEn: 'Monitors',       staticImage: '/images/categories/monitors.jpg' },
  printer:       { icon: Printer,       labelAr: 'الطابعات',         labelEn: 'Printers',       staticImage: '/images/categories/printers.png' },
  networking:    { icon: Wifi,          labelAr: 'الشبكات',          labelEn: 'Networking',     staticImage: '/images/categories/networking.jpg' },
  smart_home:    { icon: Home,          labelAr: 'المنزل الذكي',     labelEn: 'Smart Home',     staticImage: '/images/categories/smart_home.png' },
  wearable:      { icon: Watch,         labelAr: 'الأجهزة القابلة للارتداء', labelEn: 'Wearables',      staticImage: '/images/categories/wearables.jpg' },
  appliance:     { icon: WashingMachine, labelAr: 'الأجهزة المنزلية', labelEn: 'Appliances',    staticImage: '/images/categories/appliances.jpeg' },
  kitchen:       { icon: CookingPot,    labelAr: 'المطبخ',           labelEn: 'Kitchen',        staticImage: '/images/categories/kitchen.webp' },
  personal_care: { icon: Sparkle,       labelAr: 'العناية الشخصية',  labelEn: 'Personal Care',  staticImage: '/images/categories/personal_care.jpeg' },
  accessories:   { icon: Package,       labelAr: 'الإكسسوارات',      labelEn: 'Accessories',    staticImage: '/images/categories/accessories.jpeg' },
  refrigerator:  { icon: Refrigerator,  labelAr: 'الثلاجات',         labelEn: 'Fridges',        staticImage: '/images/categories/fridges.jpg' },
};


interface LandingPageClientProps {
  data?: LandingData;
}

export default function LandingPageClient({ data }: LandingPageClientProps = {}) {
  const safeData: LandingData = data ?? {
    topDeals: [],
    stores: [],
    categoryCounts: {},
    categoryImages: {},
    totalSavings: 0,
    totalStores: 0,
    totalProducts: 0,
  };
  return (
    <div className="bg-[color:var(--color-surface)]">
      <Hero totalStores={safeData.totalStores} totalProducts={safeData.totalProducts} />
      <CategoryRail categoryCounts={safeData.categoryCounts} />
      <PriceDropTicker deals={safeData.topDeals} />
      <PopularCategories categoryCounts={safeData.categoryCounts} categoryImages={safeData.categoryImages} />
      <FeaturedStores stores={safeData.stores} />
      <ValueProps />
      <SavingsStat
        totalSavings={safeData.totalSavings}
        totalStores={safeData.totalStores}
        totalProducts={safeData.totalProducts}
      />
    </div>
  );
}

/** Rank the available category keys by live product count, keep only those
 *  present in CATEGORY_META, and cap the list. */
function rankCategories(
  counts: Record<string, number>,
  limit: number,
): Array<{ slug: string; count: number } & CategoryMeta> {
  return Object.entries(counts)
    .filter(([slug, c]) => c > 0 && CATEGORY_META[slug])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([slug, count]) => ({ slug, count, ...CATEGORY_META[slug] }));
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({ totalStores, totalProducts }: { totalStores: number; totalProducts: number }) {
  const { isRTL, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/${locale}/search?q=${encodeURIComponent(q)}` : `/${locale}/search`);
  };

  const storeCountText = totalStores > 0
    ? (isRTL ? `${totalStores.toLocaleString('ar-SA')} متجر` : `${totalStores.toLocaleString('en-US')} stores`)
    : null;
  const productCountText = totalProducts > 0
    ? (isRTL ? `${totalProducts.toLocaleString('ar-SA')} منتج` : `${totalProducts.toLocaleString('en-US')} products`)
    : null;

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
          {storeCountText && (
            <Badge variant="secondary" className="mb-6">
              <Sparkles className="h-3 w-3 me-1.5" />
              {isRTL ? `مقارنة عبر ${storeCountText}` : `Comparing across ${storeCountText}`}
            </Badge>
          )}

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
              ? (productCountText && storeCountText
                  ? `قارن أسعار ${productCountText} عبر ${storeCountText} سعودية في صفحة مقارنة واحدة.`
                  : 'قارن أسعار منتجاتك المفضلة عبر عدة متاجر سعودية في صفحة واحدة.')
              : (productCountText && storeCountText
                  ? `Compare prices on ${productCountText} across ${storeCountText} — every offer on one page.`
                  : 'Compare prices on your favorite products across multiple Saudi stores on one page.')}
          </p>

          <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
            <div className="group relative flex items-center rounded-full border-2 border-[color:var(--color-outline-variant)]/60 bg-[color:var(--color-surface)] shadow-[var(--elevation-1)] transition-all focus-within:border-[var(--brand-green-dark)] focus-within:shadow-[var(--elevation-3)] focus-within:ring-4 focus-within:ring-[var(--brand-green)]/20">
              <Search className="pointer-events-none absolute start-5 h-5 w-5 text-on-surface-variant" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isRTL
                    ? 'ابحث عن iPhone 15، ثلاجة LG، مكيف سبليت...'
                    : 'Search for iPhone 15, LG fridge, Split AC...'
                }
                className="hero-search-input min-w-0 flex-1 bg-transparent py-4 text-[16px] text-on-surface placeholder:text-on-surface-variant/70 ps-14 pe-3"
                aria-label={isRTL ? 'البحث عن منتج' : 'Search for a product'}
              />
              <Button type="submit" size="lg" className="m-1.5 shrink-0 px-6">
                {isRTL ? 'بحث' : 'Search'}
                <ArrowRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {storeCountText && (
              <TrustChip icon={Store}>{isRTL ? `${storeCountText} سعودية` : `${storeCountText} in Saudi Arabia`}</TrustChip>
            )}
            <TrustChip icon={RefreshCw}>{isRTL ? 'تحديث تلقائي' : 'Auto price refresh'}</TrustChip>
            <TrustChip icon={ShieldCheck}>{isRTL ? 'بدون رسوم' : 'Free to use'}</TrustChip>
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

function CategoryRail({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const { isRTL, locale } = useLocale();
  const categories = rankCategories(categoryCounts, 10);
  if (!categories.length) return null;

  return (
    <section className="border-b border-[color:var(--color-outline-variant)]/50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8">
        <div className="flex flex-wrap justify-center gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-x-auto lg:overflow-visible snap-x snap-mandatory">
          {categories.map((cat) => {
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
  const items = useMemo(
    () =>
      deals
        .map((d) => {
          const product = localizeName(d.name_en, d.name_ar, locale);
          if (!product) return null;
          return {
            product,
            drop: Math.round(d.savings),
            currentPrice: Math.round(d.current_price),
            originalPrice: Math.round(d.original_price),
            imageUrl: d.image_url,
            store: isRTL ? d.store_name_ar : d.store_name_en,
            productSlug: d.product_slug,
          };
        })
        .filter((x): x is Exclude<typeof x, null> => x !== null),
    [deals, isRTL, locale],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  // No real deals → don't show the banner at all.
  if (!items.length) return null;

  const current = items[index % items.length];

  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 md:px-8 mt-8">
      <Link
        key={index}
        href={`/${locale}/products/${current.productSlug}`}
        className="group relative grid grid-cols-[120px_1fr_auto] items-center gap-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--brand-gold)]/40 bg-gradient-to-br from-[var(--brand-gold)]/20 via-[var(--brand-gold)]/10 to-transparent p-4 transition-all hover:shadow-[var(--elevation-2)] hover:border-[var(--brand-gold)]/70 sm:grid-cols-[160px_1fr_auto] sm:gap-6 sm:p-5"
      >
        {/* Decorative blurred echo of the image in the background */}
        {current.imageUrl && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Image
              src={current.imageUrl}
              alt=""
              fill
              sizes="100vw"
              className="object-cover scale-110 blur-3xl opacity-20"
              unoptimized
            />
          </div>
        )}

        {/* Product image */}
        <div className="relative h-24 w-full overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-surface)] sm:h-28">
          {current.imageUrl ? (
            <Image
              src={current.imageUrl}
              alt=""
              fill
              sizes="(min-width: 640px) 160px, 120px"
              className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--brand-gold-dark)]">
              <TrendingDown className="h-8 w-8" />
            </div>
          )}
          <span className="absolute top-1.5 start-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--brand-gold)] px-2 py-0.5 t-caption font-bold text-[var(--brand-dark-text)] shadow-[var(--elevation-1)]">
            <TrendingDown className="h-3 w-3" />
            {isRTL ? 'انخفاض' : 'Drop'}
          </span>
        </div>

        {/* Body */}
        <div className="relative min-w-0">
          <p
            dir="auto"
            className="truncate t-body-strong text-on-surface sm:text-[17px] leading-tight"
            title={current.product}
          >
            {current.product}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 t-small text-on-surface-variant">
            <span className="inline-flex items-center gap-1 font-bold text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)]">
              {isRTL ? 'وفّر' : 'Save'} {current.drop.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              <SARSymbol className="w-3 h-3 fill-current" />
            </span>
            <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-on-surface-variant/40" />
            <span className="inline-flex items-baseline gap-1">
              <span className="font-semibold text-on-surface">{current.currentPrice.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
              <SARSymbol className="w-2.5 h-2.5 fill-current" />
              <span className="line-through text-on-surface-variant">
                {current.originalPrice.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
              </span>
            </span>
            <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-on-surface-variant/40" />
            <span className="text-on-surface-variant">{current.store}</span>
          </div>
        </div>

        {/* See-all affordance */}
        <span className="relative hidden shrink-0 items-center gap-1 self-center t-small font-semibold text-[var(--brand-green-dark)] dark:text-[var(--brand-green)] sm:inline-flex">
          {isRTL ? 'عرض الكل' : 'See all'}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </Link>
    </section>
  );
}


/* ───────────────────────── Popular categories ───────────────────────── */

/**
 * Fixed display order for the category directory. Keep this list as the
 * editorial order of the section — it does NOT change based on DB counts.
 * Any key added to CATEGORY_META but not listed here won't render.
 */
const CATEGORY_DISPLAY_ORDER: string[] = [
  'smartphone',
  'laptop',
  'tablet',
  'tv',
  'audio',
  'gaming',
  'camera',
  'monitor',
  'wearable',
  'networking',
  'smart_home',
  'printer',
  'appliance',
  'kitchen',
  'refrigerator',
  'personal_care',
  'accessories',
];

function PopularCategories({
  categoryCounts,
  categoryImages,
}: {
  categoryCounts: Record<string, number>;
  categoryImages: Record<string, string>;
}) {
  const { isRTL, locale } = useLocale();
  const categories = CATEGORY_DISPLAY_ORDER
    .filter((slug) => CATEGORY_META[slug])
    .map((slug) => ({ slug, count: categoryCounts[slug] ?? 0, ...CATEGORY_META[slug] }));

  return (
    <section className="border-t border-[color:var(--color-outline-variant)]/40">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
        <h2 className="t-h2 text-on-surface mb-2">
          {isRTL ? 'تسوّق حسب الفئة' : 'Shop by category'}
        </h2>
        <p className="t-body text-on-surface-variant mb-8 max-w-lg">
          {isRTL
            ? 'تصفّح كل فئات المنتجات المدعومة في توفيري.'
            : 'Browse every product category we cover.'}
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const countLabel =
              cat.count > 0
                ? (isRTL
                    ? `${cat.count.toLocaleString('ar-SA')} منتج`
                    : `${cat.count.toLocaleString('en-US')} products`)
                : (isRTL ? 'تصفّح' : 'Browse');
            // Image priority: curated static asset → most-viewed DB product image → icon fallback
            const imageUrl = cat.staticImage ?? categoryImages[cat.slug] ?? null;
            const label = isRTL ? cat.labelAr : cat.labelEn;
            return (
              <Link
                key={cat.slug}
                href={`/${locale}/search?category=${cat.slug}`}
                className="group flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-outline-variant)]/50 bg-[color:var(--color-surface)] transition-all hover:border-[var(--brand-green)] hover:shadow-[var(--elevation-1)]"
              >
                {/* Decorative blurred image — purely visual identity, no text overlay */}
                <div className="relative h-14 w-full overflow-hidden bg-[color:var(--color-surface-container-lowest)]">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt=""
                      aria-hidden
                      fill
                      sizes="(min-width: 1280px) 12vw, (min-width: 1024px) 17vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover scale-110 blur-sm opacity-75 transition-transform duration-500 group-hover:scale-125"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[var(--brand-green)]/10" aria-hidden />
                  )}
                </div>
                {/* Clean label panel */}
                <div className="flex items-center gap-2 p-2.5">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-green)]/10 text-[var(--brand-green-dark)]">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-on-surface truncate leading-tight">{label}</p>
                    <p className="text-[10px] text-on-surface-variant group-hover:text-[var(--brand-green-dark)] leading-tight">
                      {countLabel}
                    </p>
                  </div>
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
  const list = stores.slice(0, 8);
  if (!list.length) return null;

  return (
    <section className="bg-[color:var(--color-surface-container-lowest)] border-t border-[color:var(--color-outline-variant)]/40">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
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
      </div>
    </section>
  );
}

/* ───────────────────────── Value props ───────────────────────── */

function ValueProps() {
  const { isRTL } = useLocale();
  const props = isRTL
    ? [
        { icon: Zap, title: 'مقارنة فورية', description: 'ابحث مرة واحدة، واحصل على الأسعار من كل المتاجر المدعومة في صفحة واحدة.' },
        { icon: Bell, title: 'تنبيهات الأسعار', description: 'اضبط السعر المستهدف لأي منتج، وسنرسل لك تنبيهاً حين يصل إليه.' },
        { icon: Ticket, title: 'كوبونات المتاجر', description: 'اعثر على كوبونات المتاجر النشطة وطبّقها عند الانتقال إلى صفحة الشراء.' },
      ]
    : [
        { icon: Zap, title: 'Instant comparison', description: 'Search once and see every supported-store price for the product on a single page.' },
        { icon: Bell, title: 'Price alerts', description: 'Set a target price on any product and get notified the moment a store hits it.' },
        { icon: Ticket, title: 'Store coupons', description: 'Browse active coupons from each store and apply them when you hand off to checkout.' },
      ];

  return (
    <section className="border-t border-[color:var(--color-outline-variant)]/40">
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

function SavingsStat({
  totalSavings,
  totalStores,
  totalProducts,
}: {
  totalSavings: number;
  totalStores: number;
  totalProducts: number;
}) {
  const { isRTL } = useLocale();

  // Only render when we actually have something real to boast about.
  if (totalSavings <= 0) return null;

  const displaySavings = formatSavings(totalSavings, isRTL);
  const storesText = totalStores > 0
    ? (isRTL ? `${totalStores.toLocaleString('ar-SA')} متجر` : `${totalStores.toLocaleString('en-US')} stores`)
    : null;
  const productsText = totalProducts > 0
    ? (isRTL ? `${totalProducts.toLocaleString('ar-SA')} منتج` : `${totalProducts.toLocaleString('en-US')} products`)
    : null;

  return (
    <section className="border-t border-[color:var(--color-outline-variant)]/40 bg-[color:var(--color-surface-container-lowest)]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8 md:py-20">
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
            {isRTL ? 'عروض نشطة الآن' : 'Live deals right now'}
          </Badge>
          <p className="t-h2 md:text-[44px] md:leading-[52px] font-black">
            {isRTL ? 'مجموع التوفير المتاح في كتالوجنا' : 'Active savings across the catalog'}
          </p>
          <p className="mt-2 text-[64px] md:text-[96px] font-black leading-none tracking-tight text-[var(--brand-gold)] num-ltr inline-flex items-baseline gap-3 justify-center">
            {displaySavings}
            <SARSymbol className="w-12 h-12 md:w-16 md:h-16 fill-current self-center" />
          </p>
          <p className="mt-4 t-body text-white/80 max-w-lg">
            {isRTL
              ? `إجمالي فرق السعر بين السعر الأصلي والسعر الحالي للمنتجات المخفّضة${storesText && productsText ? `، عبر ${storesText} و${productsText}` : ''}.`
              : `The sum of original-vs-current price gaps on discounted items${storesText && productsText ? `, across ${storesText} and ${productsText}` : ''}.`}
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}

