'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LandingData, LandingDeal, LandingFeatured } from '@/lib/landing/data';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  Monitor,
  Package,
  Printer,
  Refrigerator,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkle,
  Tablet,
  Ticket,
  Tv,
  WashingMachine,
  Watch,
  Wifi,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreLogo } from '@/components/ui/store-logo';
import { SARSymbol } from '@/components/ui/price';
import { useLocale } from '@/lib/simple-intl-provider';

const ARABIC_RE = /[\u0600-\u06FF]/;
const ASCII_LETTER_RE = /[A-Za-z]/;

function pickEnglishName(nameEn: string, nameAr: string): string | null {
  for (const value of [nameEn, nameAr]) {
    if (value && ASCII_LETTER_RE.test(value) && !ARABIC_RE.test(value)) return value;
  }
  return null;
}

function pickArabicName(nameEn: string, nameAr: string): string | null {
  for (const value of [nameAr, nameEn]) {
    if (value && ARABIC_RE.test(value)) return value;
  }
  return null;
}

function localizeName(nameEn: string, nameAr: string, locale: string): string | null {
  return locale === 'ar' ? pickArabicName(nameEn, nameAr) : pickEnglishName(nameEn, nameAr);
}

interface CategoryMeta {
  icon: typeof Smartphone;
  labelAr: string;
  labelEn: string;
  device: 'phone' | 'laptop' | 'tv' | 'audio' | 'appliance' | 'gaming' | 'tablet' | 'camera' | 'monitor' | 'printer' | 'network' | 'home' | 'watch' | 'kitchen' | 'care' | 'accessory' | 'fridge';
  image?: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  smartphone: { icon: Smartphone, labelAr: 'هواتف', labelEn: 'Phones', device: 'phone', image: '/images/categories/generated/smartphone.png' },
  laptop: { icon: Laptop, labelAr: 'لابتوب', labelEn: 'Laptops', device: 'laptop', image: '/images/categories/generated/laptop.png' },
  tablet: { icon: Tablet, labelAr: 'أجهزة لوحية', labelEn: 'Tablets', device: 'tablet', image: '/images/categories/generated/tablet.png' },
  tv: { icon: Tv, labelAr: 'تلفزيونات', labelEn: 'TVs', device: 'tv', image: '/images/categories/generated/tv.png' },
  audio: { icon: Headphones, labelAr: 'صوتيات', labelEn: 'Audio', device: 'audio', image: '/images/categories/generated/audio.png' },
  gaming: { icon: Gamepad2, labelAr: 'ألعاب', labelEn: 'Gaming', device: 'gaming', image: '/images/categories/generated/gaming.png' },
  camera: { icon: Camera, labelAr: 'كاميرات', labelEn: 'Cameras', device: 'camera', image: '/images/categories/generated/camera.png' },
  monitor: { icon: Monitor, labelAr: 'شاشات', labelEn: 'Monitors', device: 'monitor', image: '/images/categories/generated/monitor.png' },
  printer: { icon: Printer, labelAr: 'طابعات', labelEn: 'Printers', device: 'printer', image: '/images/categories/generated/printer.png' },
  networking: { icon: Wifi, labelAr: 'شبكات', labelEn: 'Networking', device: 'network', image: '/images/categories/generated/networking.png' },
  smart_home: { icon: Home, labelAr: 'منزل ذكي', labelEn: 'Smart Home', device: 'home', image: '/images/categories/generated/smart-home.png' },
  wearable: { icon: Watch, labelAr: 'ساعات ذكية', labelEn: 'Wearables', device: 'watch', image: '/images/categories/generated/wearable.png' },
  appliance: { icon: WashingMachine, labelAr: 'أجهزة منزلية', labelEn: 'Appliances', device: 'appliance', image: '/images/categories/generated/appliance.png' },
  kitchen: { icon: CookingPot, labelAr: 'مطبخ', labelEn: 'Kitchen', device: 'kitchen', image: '/images/categories/generated/kitchen.png' },
  personal_care: { icon: Sparkle, labelAr: 'عناية شخصية', labelEn: 'Personal Care', device: 'care', image: '/images/categories/generated/personal-care.png' },
  accessories: { icon: Package, labelAr: 'إكسسوارات', labelEn: 'Accessories', device: 'accessory', image: '/images/categories/generated/accessories.png' },
  refrigerator: { icon: Refrigerator, labelAr: 'ثلاجات', labelEn: 'Fridges', device: 'fridge', image: '/images/categories/generated/refrigerator.png' },
};

const ALL_CATEGORIES = [
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
  'refrigerator',
  'kitchen',
  'personal_care',
  'accessories',
];

interface LandingPageClientProps {
  data?: LandingData;
}

export default function LandingPageClient({ data }: LandingPageClientProps = {}) {
  const safe: LandingData = data ?? {
    topDeals: [],
    featured: [],
    stores: [],
    categoryCounts: {},
    categoryImages: {},
    totalSavings: 0,
    totalStores: 0,
    totalProducts: 0,
  };

  return (
    <div className="bg-[color:var(--color-surface)] text-[color:var(--color-on-surface)]">
      <Hero
        totalStores={safe.totalStores}
        totalProducts={safe.totalProducts}
        totalSavings={safe.totalSavings}
      />
      <CategoryShowcase categoryCounts={safe.categoryCounts} />
      <FeaturedProducts products={safe.featured} />
      <TopDeals deals={safe.topDeals} />
      <StoresSection stores={safe.stores} />
      <TrustSection />
    </div>
  );
}

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

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/${locale}/search?q=${encodeURIComponent(trimmed)}` : `/${locale}/search`);
  };

  return (
    <section className="relative overflow-hidden border-b border-[color:var(--color-outline-variant)] bg-[color:var(--color-primary-container)] dark:bg-[color:var(--color-surface)]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-70 dark:opacity-35"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, rgba(85,178,149,0.34), transparent 28%), radial-gradient(circle at 86% 12%, rgba(226,187,78,0.18), transparent 20%)',
        }}
      />
      <div className="relative mx-auto flex w-full max-w-[980px] flex-col items-center px-4 pb-12 pt-56 text-center md:px-8 md:pb-16 md:pt-48">
        <div className="landing-reveal w-full">
          <p className="inline-flex rounded-full bg-[color:var(--color-surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)] shadow-sm dark:bg-[color:var(--color-surface-container-high)]">
            Tawveeri · {isRTL ? 'قارن · وفّر · بذكاء' : 'Compare · Save · Smart'}
          </p>

          <h1 className="mt-6 text-[36px] font-black leading-[1.12] tracking-tight text-[color:var(--color-on-surface)] md:text-[44px]">
            {isRTL ? 'قارن الأسعار من كل المتاجر' : 'Compare prices from every store'}
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[color:var(--color-on-surface-variant)]">
            {isRTL
              ? 'اعرف أرخص سعر، التوفر، والكوبونات في صفحة واحدة قبل ما تدفع.'
              : 'See the lowest price, stock status, and coupons on one page before you pay.'}
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-7 max-w-2xl">
            <div className="flex min-h-[72px] items-center gap-3 rounded-full border border-[color:var(--color-primary)]/35 bg-[color:var(--color-surface)] p-2.5 shadow-[0_22px_70px_-45px_rgba(26,26,26,0.65)] ring-1 ring-[color:var(--color-primary)]/10 transition focus-within:border-[color:var(--color-primary)] focus-within:ring-[color:var(--color-primary)]/30 dark:bg-[color:var(--color-surface-container-high)]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container)]">
                <Search className="h-5 w-5" strokeWidth={2} />
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={isRTL ? 'ابحث باسم المنتج، الموديل، أو المتجر' : 'Search product, model, or store'}
                className="min-w-0 flex-1 bg-transparent text-start text-[16px] font-bold text-[color:var(--color-on-surface)] outline-none placeholder:font-semibold placeholder:text-[color:var(--color-on-surface-variant)]"
                aria-label={isRTL ? 'البحث عن منتج' : 'Search for a product'}
              />
              <Button type="submit" size="lg" className="h-12 shrink-0 rounded-full px-5 active:scale-[0.98]">
                {isRTL ? 'قارن الآن' : 'Compare now'}
                <ArrowRight className={cn('h-4 w-4', isRTL && 'rotate-180')} />
              </Button>
            </div>
          </form>

          <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-container-low)]">
            <HeroStat
              value={totalStores > 0 ? totalStores.toLocaleString(isRTL ? 'ar-SA' : 'en-US') : '8'}
              label={isRTL ? 'متاجر موثوقة' : 'Trusted stores'}
            />
            <HeroStat
              value={totalProducts > 0 ? formatCompact(totalProducts, isRTL) : isRTL ? 'مباشر' : 'Live'}
              label={isRTL ? 'منتج' : 'Products'}
            />
            <HeroStat
              value={totalSavings > 0 ? formatCompact(totalSavings, isRTL) : isRTL ? 'أفضل' : 'Best'}
              label={isRTL ? 'فرص توفير' : 'Savings'}
              sar={totalSavings > 0}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label, sar = false }: { value: string; label: string; sar?: boolean }) {
  return (
    <div className="border-e border-[color:var(--color-outline-variant)] p-4 last:border-e-0">
      <div className="flex items-center gap-1 text-[22px] font-black text-[color:var(--color-on-surface)]">
        <span>{value}</span>
        {sar && <SARSymbol className="h-4 w-4 fill-current text-[color:var(--color-primary)]" />}
      </div>
      <p className="mt-1 text-[11px] font-semibold text-[color:var(--color-on-surface-variant)]">{label}</p>
    </div>
  );
}

function CategoryShowcase({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const { isRTL, locale } = useLocale();
  const items = ALL_CATEGORIES
    .filter((slug) => CATEGORY_META[slug])
    .map((slug) => ({
      slug,
      ...CATEGORY_META[slug],
      count: categoryCounts[slug] ?? 0,
    }));

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-12 md:px-8">
      <SectionHeader
        badge={isRTL ? 'التصنيفات' : 'Categories'}
        title={isRTL ? 'ابدأ من الفئة المناسبة' : 'Start with the right category'}
        subtitle={isRTL ? 'كل الفئات الأساسية بحجم سريع للتصفح والمقارنة.' : 'All core categories in a compact browsing grid.'}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((category, index) => (
          <CategoryCard
            key={category.slug}
            category={category}
            href={`/${locale}/search?category=${category.slug}`}
            index={index}
            className={getCategoryGridClass(index, items.length)}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryCard({
  category,
  href,
  index,
  className,
}: {
  category: CategoryMeta & { slug: string; count: number };
  href: string;
  index: number;
  className?: string;
}) {
  const { isRTL } = useLocale();

  return (
    <Link
      href={href}
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'landing-reveal group relative flex overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] shadow-[0_12px_34px_-30px_rgba(26,26,26,0.45)] transition duration-300 hover:-translate-y-0.5 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-low)]',
        'flex-col',
        className,
      )}
    >
      <CategoryCardImage category={category} />

      <div className="relative shrink-0 border-t border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 py-2.5 dark:bg-[color:var(--color-surface-container-low)]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-black text-[color:var(--color-on-surface)]">
              {isRTL ? category.labelAr : category.labelEn}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-[color:var(--color-on-surface-variant)]">
              {category.count > 0
                ? `${category.count.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'منتج' : 'items'}`
                : isRTL ? 'عرض المنتجات' : 'View products'}
            </p>
          </div>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] transition duration-300 group-hover:scale-105">
            {isRTL ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        </div>
      </div>
    </Link>
  );
}

function getCategoryGridClass(index: number, total: number): string | undefined {
  if (total % 5 !== 2 || index < total - 2) return undefined;
  return index === total - 2 ? 'xl:col-start-2' : 'xl:col-start-4';
}

function CategoryCardImage({ category }: {
  category: CategoryMeta;
}) {
  if (category.image) {
    return (
      <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-[#f7faf8] dark:bg-[#f7faf8]">
        <Image
          src={category.image}
          alt=""
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain transition duration-500 group-hover:scale-[1.025]"
          priority={category.device === 'phone' || category.device === 'laptop'}
        />
        <div className="absolute start-3 top-3 h-2 w-2 rounded-full bg-[color:var(--color-tertiary)]" />
      </div>
    );
  }

  const Icon = deviceIconMap[category.device] ?? Package;
  return (
    <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-[color:var(--color-primary-container)] dark:bg-[color:var(--color-surface-container-high)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(85,178,149,0.28),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(226,187,78,0.20),transparent_28%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-16 w-16 rotate-[-4deg] items-center justify-center rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] text-[color:var(--color-primary)] shadow-sm dark:bg-[color:var(--color-surface-container-low)]">
          <Icon className="h-8 w-8" strokeWidth={1.35} />
        </div>
      </div>
    </div>
  );
}

const deviceIconMap: Record<CategoryMeta['device'], typeof Smartphone> = {
  phone: Smartphone,
  laptop: Laptop,
  tv: Tv,
  audio: Headphones,
  appliance: WashingMachine,
  gaming: Gamepad2,
  tablet: Tablet,
  camera: Camera,
  monitor: Monitor,
  printer: Printer,
  network: Wifi,
  home: Home,
  watch: Watch,
  kitchen: CookingPot,
  care: Sparkle,
  accessory: Package,
  fridge: Refrigerator,
};

function FeaturedProducts({ products }: { products: LandingFeatured[] }) {
  const { isRTL, locale } = useLocale();
  const items = products
    .map((product) => {
      const name = localizeName(product.name_en, product.name_ar, locale);
      return name ? { ...product, name } : null;
    })
    .filter((item): item is LandingFeatured & { name: string } => item !== null)
    .slice(0, 4);

  if (!items.length) return null;

  return (
    <section className="border-y border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] dark:bg-[color:var(--color-surface-container-low)]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-12 md:px-8">
        <SectionHeader
          badge={isRTL ? 'بطاقات المنتج' : 'Product cards'}
          title={isRTL ? 'منتجات عليها مقارنة قوية' : 'Products with strong comparison coverage'}
          subtitle={isRTL ? 'بطاقات واضحة تعرض السعر، عدد المتاجر، وأقرب إجراء.' : 'Clear cards showing price, store count, and the next action.'}
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {items.map((product) => (
            <Link
              key={product.product_id}
              href={`/${locale}/products/${product.product_slug}`}
              className="group rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-4 transition hover:-translate-y-1 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[color:var(--color-primary-container)] dark:bg-[color:var(--color-surface-container-high)]">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[color:var(--color-primary)]">
                    <Package className="h-14 w-14" strokeWidth={1.4} />
                  </div>
                )}
              </div>
              <h3 dir="auto" className="mt-4 line-clamp-2 min-h-[45px] text-[18px] font-bold leading-snug text-[color:var(--color-on-surface)]">
                {product.name}
              </h3>
              <p className="mt-1 text-[13px] text-[color:var(--color-on-surface-variant)]">
                {isRTL
                  ? `أرخص سعر من ${product.store_count} متاجر`
                  : `Lowest price from ${product.store_count} stores`}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 text-[22px] font-black text-[color:var(--color-on-surface)]">
                  <span>{Math.round(product.best_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
                  <SARSymbol className="h-4 w-4 fill-current" />
                </div>
                <span className="rounded-full bg-[color:var(--color-primary)] px-3 py-2 text-[11px] font-bold text-[color:var(--color-on-primary)]">
                  {isRTL ? 'قارن الآن' : 'Compare'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TopDeals({ deals }: { deals: LandingDeal[] }) {
  const { isRTL, locale } = useLocale();
  const items = deals
    .map((deal) => {
      const name = localizeName(deal.name_en, deal.name_ar, locale);
      return name ? { ...deal, name } : null;
    })
    .filter((item): item is LandingDeal & { name: string } => item !== null)
    .slice(0, 6);

  if (!items.length) return null;

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-12 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <SectionHeader
          badge={isRTL ? 'الشارات' : 'Badges'}
          title={isRTL ? 'عروض بتوفير واضح' : 'Deals with clear savings'}
          subtitle={isRTL ? 'نستخدم الذهبي فقط لعناصر التميّز مثل الخصم وأفضل سعر.' : 'Gold is reserved for highlight moments such as discounts and best price.'}
        />
        <Link href={`/${locale}/deals`} className="hidden items-center gap-1 text-[13px] font-bold text-[color:var(--color-primary)] md:inline-flex">
          {isRTL ? 'كل العروض' : 'All deals'}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((deal) => {
          const savings = Math.max(0, deal.original_price - deal.current_price);
          const discountPct = deal.original_price > 0 ? Math.round((savings / deal.original_price) * 100) : 0;

          return (
            <Link
              key={`${deal.product_id}-${deal.store_slug}`}
              href={`/${locale}/products/${deal.product_slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-2.5 transition hover:-translate-y-1 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-low)]"
            >
              <div className="relative aspect-[4/3] min-h-[150px] overflow-hidden rounded-xl bg-[color:var(--color-primary-container)] dark:bg-[color:var(--color-surface-container-high)]">
                {discountPct > 0 && (
                  <span className="absolute start-3 top-3 z-[1] rounded-full bg-[color:var(--color-tertiary)] px-3 py-1.5 text-[11px] font-black text-[color:var(--color-on-tertiary)]">
                    {isRTL ? `خصم ${discountPct}%` : `${discountPct}% off`}
                  </span>
                )}
                {deal.image_url ? (
                  <Image
                    src={deal.image_url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-contain p-3 transition duration-300 group-hover:scale-[1.025]"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full min-h-[150px] items-center justify-center text-[color:var(--color-primary)]">
                    <Package className="h-11 w-11" />
                  </div>
                )}
              </div>
              <div className="min-w-0 p-1.5 pt-3">
                <h3 dir="auto" className="line-clamp-2 min-h-[40px] text-[15px] font-bold leading-snug text-[color:var(--color-on-surface)]">
                  {deal.name}
                </h3>
                <p className="mt-1 truncate text-[13px] text-[color:var(--color-on-surface-variant)]">
                  {isRTL ? deal.store_name_ar : deal.store_name_en}
                </p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1 text-[20px] font-black text-[color:var(--color-on-surface)]">
                      <span>{Math.round(deal.current_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
                      <SARSymbol className="h-4 w-4 fill-current" />
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-[color:var(--color-primary)]">
                      {isRTL
                        ? `وفّر ${Math.round(savings).toLocaleString('ar-SA')} ريال`
                        : `Save ${Math.round(savings).toLocaleString('en-US')} SAR`}
                    </p>
                  </div>
                  <span className="rounded-full bg-[color:var(--color-primary)] px-3 py-2 text-[11px] font-bold text-[color:var(--color-on-primary)]">
                    {isRTL ? 'شاهد' : 'View'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function StoresSection({ stores }: { stores: LandingData['stores'] }) {
  const { isRTL, locale } = useLocale();
  const list = stores.slice(0, 8);
  if (!list.length) return null;

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-12 md:px-8">
      <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-6 dark:bg-[color:var(--color-surface-container-low)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            badge={isRTL ? 'المتاجر' : 'Stores'}
            title={isRTL ? 'متاجر موثوقة في مقارنة واحدة' : 'Trusted stores in one comparison'}
            subtitle={isRTL ? 'مصادر أسعار واضحة ومحدّثة لكسب ثقة المستخدم.' : 'Clear, updated price sources built for user trust.'}
          />
          <Link href={`/${locale}/stores`} className="inline-flex items-center gap-1 text-[13px] font-bold text-[color:var(--color-primary)]">
            {isRTL ? 'عرض المتاجر' : 'View stores'}
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {list.map((store) => (
            <Link
              key={store.slug}
              href={`/${locale}/stores/${store.slug}`}
              className="flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] p-4 transition hover:-translate-y-1 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container)]"
            >
              <StoreLogo slug={store.slug} size="lg" locale={locale as 'ar' | 'en'} />
              <span className="line-clamp-1 text-center text-[13px] font-bold text-[color:var(--color-on-surface-variant)]">
                {(isRTL ? store.name_ar : store.name_en) || store.slug}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const { isRTL } = useLocale();
  const items = isRTL
    ? [
        { icon: Zap, title: 'سريع ومباشر', desc: 'نوصل المعلومة بأقصر طريق، بدون تعقيد أو تشويش.' },
        { icon: ShieldCheck, title: 'ثقة وموثوقية', desc: 'نقدم معلومات دقيقة ومحدّثة لكسب ثقة المستخدم.' },
        { icon: Bell, title: 'تنبيهات واضحة', desc: 'اعرف متى يصل المنتج للسعر المناسب لك.' },
        { icon: Ticket, title: 'كوبونات مفهومة', desc: 'الكوبون يظهر مع السعر والتوفر في نفس السياق.' },
      ]
    : [
        { icon: Zap, title: 'Fast and direct', desc: 'We deliver the answer quickly, without clutter or confusion.' },
        { icon: ShieldCheck, title: 'Trusted and current', desc: 'Accurate, updated information builds user confidence.' },
        { icon: Bell, title: 'Clear alerts', desc: 'Know when the product reaches the price you want.' },
        { icon: Ticket, title: 'Useful coupons', desc: 'Coupons appear with price and stock context.' },
      ];

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 pb-16 md:px-8">
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-5 dark:bg-[color:var(--color-surface-container-low)]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <h3 className="mt-4 text-[18px] font-bold text-[color:var(--color-on-surface)]">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-[color:var(--color-on-surface-variant)]">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeader({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
        {badge}
      </p>
      <h2 className="mt-2 text-[28px] font-black leading-tight text-[color:var(--color-on-surface)]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-[15px] leading-7 text-[color:var(--color-on-surface-variant)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function formatCompact(value: number, isRTL: boolean): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}${isRTL ? 'م' : 'M'}`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}${isRTL ? 'ك' : 'K'}`;
  }
  return value.toLocaleString(isRTL ? 'ar-SA' : 'en-US');
}
