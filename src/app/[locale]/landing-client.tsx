'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LandingData, LandingDeal, LandingFeatured } from '@/lib/landing/data';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Bell, Camera, ChevronLeft, ChevronRight,
  CookingPot, Gamepad2, Headphones, Home, Laptop, Monitor,
  Package, Printer, Refrigerator, Search, ShieldCheck,
  Smartphone, Sparkle, Tablet, Ticket, Tv, WashingMachine,
  Watch, Wifi, Zap,
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
  'smartphone','laptop','tablet','tv','audio','gaming','camera','monitor',
  'wearable','networking','smart_home','printer','appliance','refrigerator',
  'kitchen','personal_care','accessories',
];

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
    <div className="bg-[color:var(--color-surface)] text-[color:var(--color-on-surface)]">
      <Hero totalStores={safe.totalStores} totalProducts={safe.totalProducts} totalSavings={safe.totalSavings} />
      <AIAssistantBanner />
      <TopDeals deals={safe.topDeals} />
      <CategoryStrip categoryCounts={safe.categoryCounts} />
      <StoresSection stores={safe.stores} />
      <TrustSection />
    </div>
  );
}

// ─── HERO ────────────────────────────────────────────────────────────────────
function Hero({ totalStores, totalProducts, totalSavings }: { totalStores: number; totalProducts: number; totalSavings: number }) {
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
      <div aria-hidden className="absolute inset-0 opacity-70 dark:opacity-35" style={{ background: 'radial-gradient(circle at 18% 18%, rgba(85,178,149,0.34), transparent 28%), radial-gradient(circle at 86% 12%, rgba(226,187,78,0.18), transparent 20%)' }} />
      <div className="relative mx-auto flex w-full max-w-[980px] flex-col items-center px-4 pb-12 pt-56 text-center md:px-8 md:pb-16 md:pt-48">
        <div className="landing-reveal w-full">
          <p className="inline-flex rounded-full bg-[color:var(--color-surface)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)] shadow-sm dark:bg-[color:var(--color-surface-container-high)]">
            Tawveeri · {isRTL ? 'قارن · وفّر · بذكاء' : 'Compare · Save · Smart'}
          </p>
          <h1 className="mt-6 text-[36px] font-black leading-[1.12] tracking-tight text-[color:var(--color-on-surface)] md:text-[44px]">
            {isRTL ? 'قارن الأسعار من كل المتاجر' : 'Compare prices from every store'}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-[color:var(--color-on-surface-variant)]">
            {isRTL ? 'اعرف أرخص سعر، التوفر، والكوبونات في صفحة واحدة قبل ما تدفع.' : 'See the lowest price, stock status, and coupons on one page before you pay.'}
          </p>
          <form onSubmit={onSubmit} className="mx-auto mt-7 max-w-2xl">
            <div className="flex min-h-[72px] items-center gap-3 rounded-full border border-[color:var(--color-primary)]/35 bg-[color:var(--color-surface)] p-2.5 shadow-[0_22px_70px_-45px_rgba(26,26,26,0.65)] ring-1 ring-[color:var(--color-primary)]/10 transition focus-within:border-[color:var(--color-primary)] focus-within:ring-[color:var(--color-primary)]/30 dark:bg-[color:var(--color-surface-container-high)]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container)]">
                <Search className="h-5 w-5" strokeWidth={2} />
              </span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={isRTL ? 'ابحث باسم المنتج، الموديل، أو المتجر' : 'Search product, model, or store'}
                className="min-w-0 flex-1 bg-transparent text-start text-[16px] font-bold text-[color:var(--color-on-surface)] outline-none placeholder:font-semibold placeholder:text-[color:var(--color-on-surface-variant)]"
                aria-label={isRTL ? 'البحث عن منتج' : 'Search for a product'} />
              <Button type="submit" size="lg" className="h-12 shrink-0 rounded-full px-5 active:scale-[0.98]">
                {isRTL ? 'قارن الآن' : 'Compare now'}
                <ArrowRight className={cn('h-4 w-4', isRTL && 'rotate-180')} />
              </Button>
            </div>
          </form>
          <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] dark:bg-[color:var(--color-surface-container-low)]">
            <HeroStat value={totalStores > 0 ? totalStores.toLocaleString(isRTL ? 'ar-SA' : 'en-US') : '8'} label={isRTL ? 'متاجر موثوقة' : 'Trusted stores'} />
            <HeroStat value={totalProducts > 0 ? formatCompact(totalProducts, isRTL) : isRTL ? 'مباشر' : 'Live'} label={isRTL ? 'منتج' : 'Products'} />
            <HeroStat value={totalSavings > 0 ? formatCompact(totalSavings, isRTL) : isRTL ? 'أفضل' : 'Best'} label={isRTL ? 'فرص توفير' : 'Savings'} sar={totalSavings > 0} />
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

// ─── AI ASSISTANT BANNER ─────────────────────────────────────────────────────
function AIAssistantBanner() {
  const { isRTL, locale } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const onAsk = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/${locale}/assistant?q=${encodeURIComponent(q)}` : `/${locale}/assistant`);
  };

  const suggestions = isRTL
    ? ['ابي ارخص ايفون 16', 'مكيف لغرفة 25 متر', 'لابتوب للدراسة بأقل من 2500', 'سماعات تحت 500 ريال']
    : ['Cheapest iPhone 16', 'AC for 25m room', 'Laptop under 2500 SAR', 'Earbuds under 500 SAR'];

  return (
    <section className="border-y border-[color:var(--color-outline-variant)] bg-gradient-to-b from-[color:var(--color-primary-container)]/40 to-[color:var(--color-surface)]">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 md:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-4xl shadow-[0_0_0_6px_rgba(85,178,149,0.15),0_0_30px_rgba(85,178,149,0.2)]">🤖</div>
            <span className="absolute -bottom-1 -end-1 rounded-full bg-[color:var(--color-tertiary)] px-2.5 py-1 text-[10px] font-black text-[color:var(--color-on-tertiary)] shadow-sm">AI</span>
            <span className="absolute -top-1 -start-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--color-primary)] opacity-40" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-[color:var(--color-primary)]" />
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[28px] font-black text-[color:var(--color-on-surface)] md:text-[34px]">{isRTL ? 'وفّر' : 'Waffir'}</h2>
            <span className="rounded-full border border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary-container)] px-3 py-1 text-[12px] font-bold text-[color:var(--color-primary)]">
              {isRTL ? 'مساعد ذكاء اصطناعي' : 'AI Assistant'}
            </span>
          </div>
          <p className="mb-8 max-w-xl text-[15px] leading-7 text-[color:var(--color-on-surface-variant)]">
            {isRTL ? 'قول لي وش تبي بالعامية وأنا أدور لك أرخص سعر من 8 متاجر سعودية — فوري' : "Tell me what you need and I'll find the lowest price from 8 Saudi stores instantly"}
          </p>
          <form onSubmit={onAsk} className="w-full max-w-2xl mb-6">
            <div className="flex min-h-[64px] items-center gap-3 rounded-full border-2 border-[color:var(--color-primary)]/40 bg-[color:var(--color-surface)] p-2.5 shadow-[0_8px_40px_-20px_rgba(85,178,149,0.35)] transition focus-within:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-high)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] text-xl">🤖</span>
              <input value={query} onChange={e => setQuery(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={isRTL ? 'مثلاً: ابي مكيف لغرفة 25 متر بأقل من 2000 ريال...' : 'e.g. AC for 25sqm room under 2000 SAR...'}
                className="min-w-0 flex-1 bg-transparent text-start text-[15px] font-semibold text-[color:var(--color-on-surface)] outline-none placeholder:text-[color:var(--color-on-surface-variant)]" />
              <Button type="submit" size="lg" className="h-11 shrink-0 rounded-full px-6 active:scale-[0.98]">
                {isRTL ? 'اسأل وفّر' : 'Ask Waffir'}
                <ArrowRight className={cn('h-4 w-4', isRTL && 'rotate-180')} />
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => router.push(`/${locale}/assistant?q=${encodeURIComponent(s)}`)}
                className="rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[color:var(--color-on-surface-variant)] transition hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-low)]">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── TOP DEALS ───────────────────────────────────────────────────────────────
function TopDeals({ deals }: { deals: LandingDeal[] }) {
  const { isRTL, locale } = useLocale();
  const items = deals
    .map((deal) => { const name = localizeName(deal.name_en, deal.name_ar, locale); return name ? { ...deal, name } : null; })
    .filter((item): item is LandingDeal & { name: string } => item !== null)
    .slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-12 md:px-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <SectionHeader badge={isRTL ? '🔥 أفضل العروض اليوم' : '🔥 Best deals today'} title={isRTL ? 'عروض بتوفير حقيقي' : 'Deals with real savings'} />
        <Link href={`/${locale}/deals`} className="hidden items-center gap-1 text-[13px] font-bold text-[color:var(--color-primary)] md:inline-flex shrink-0">
          {isRTL ? 'كل العروض' : 'All deals'}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Link>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {items.map((deal) => {
          const savings = Math.max(0, deal.original_price - deal.current_price);
          const discountPct = deal.original_price > 0 ? Math.round((savings / deal.original_price) * 100) : 0;
          return (
            <Link key={`${deal.product_id}-${deal.store_slug}`} href={`/${locale}/products/${deal.product_slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-2.5 transition hover:-translate-y-1 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container-low)]">
              <div className="relative aspect-[4/3] min-h-[130px] overflow-hidden rounded-xl bg-[color:var(--color-primary-container)] dark:bg-[color:var(--color-surface-container-high)]">
                {discountPct > 0 && (
                  <span className="absolute start-2 top-2 z-[1] rounded-full bg-[color:var(--color-tertiary)] px-2.5 py-1 text-[11px] font-black text-[color:var(--color-on-tertiary)]">
                    {isRTL ? `خصم ${discountPct}%` : `${discountPct}% off`}
                  </span>
                )}
                {deal.image_url ? (
                  <Image src={deal.image_url} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-contain p-3 transition duration-300 group-hover:scale-[1.025]" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-[color:var(--color-primary)]"><Package className="h-11 w-11" /></div>
                )}
              </div>
              <div className="p-1.5 pt-3 flex-1 flex flex-col">
                <h3 dir="auto" className="line-clamp-2 text-[14px] font-bold leading-snug text-[color:var(--color-on-surface)] flex-1">{deal.name}</h3>
                <p className="mt-1 truncate text-[11px] text-[color:var(--color-on-surface-variant)]">{isRTL ? deal.store_name_ar : deal.store_name_en}</p>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1 text-[18px] font-black text-[color:var(--color-on-surface)]">
                      <span>{Math.round(deal.current_price).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</span>
                      <SARSymbol className="h-3.5 w-3.5 fill-current" />
                    </div>
                    {savings > 0 && (
                      <p className="text-[10px] font-bold text-[color:var(--color-primary)]">
                        {isRTL ? `وفّر ${Math.round(savings).toLocaleString('ar-SA')} ريال` : `Save ${Math.round(savings).toLocaleString('en-US')} SAR`}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-[color:var(--color-primary)] px-2.5 py-1.5 text-[10px] font-bold text-[color:var(--color-on-primary)] shrink-0">
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

// ─── CATEGORY STRIP (horizontal scrollable — مستوحى من PriceRunner) ──────────
function CategoryStrip({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const { isRTL, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);

  const items = ALL_CATEGORIES
    .filter((slug) => CATEGORY_META[slug])
    .map((slug) => ({ slug, ...CATEGORY_META[slug], count: categoryCounts[slug] ?? 0 }));

  const visibleItems = expanded ? items : items.slice(0, 8);

  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8">
      <div className="flex items-center justify-between mb-5">
        <SectionHeader badge={isRTL ? 'الأقسام' : 'Categories'} title={isRTL ? 'تسوّق حسب الفئة' : 'Shop by category'} />
        <button onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded-full border border-[color:var(--color-outline-variant)] px-4 py-2 text-[12px] font-bold text-[color:var(--color-primary)] transition hover:bg-[color:var(--color-primary-container)]">
          {expanded ? (isRTL ? 'عرض أقل ↑' : 'Show less ↑') : (isRTL ? 'كل الأقسام ↓' : 'All categories ↓')}
        </button>
      </div>

      {/* Horizontal scrollable strip */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {visibleItems.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link key={cat.slug} href={`/${locale}/search?category=${cat.slug}`}
              className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-4 transition hover:border-[color:var(--color-primary)] hover:-translate-y-0.5 dark:bg-[color:var(--color-surface-container-low)]"
              style={{ minWidth: 90 }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)] transition group-hover:bg-[color:var(--color-primary)] group-hover:text-[color:var(--color-on-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <span className="text-center text-[12px] font-bold text-[color:var(--color-on-surface)] leading-tight">
                {isRTL ? cat.labelAr : cat.labelEn}
              </span>
              {cat.count > 0 && (
                <span className="text-[10px] text-[color:var(--color-on-surface-variant)]">
                  {cat.count.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── STORES ──────────────────────────────────────────────────────────────────
function StoresSection({ stores }: { stores: LandingData['stores'] }) {
  const { isRTL, locale } = useLocale();
  const list = stores.slice(0, 8);
  if (!list.length) return null;
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-10 md:px-8">
      <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-6 dark:bg-[color:var(--color-surface-container-low)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeader badge={isRTL ? 'المتاجر' : 'Stores'} title={isRTL ? '8 متاجر سعودية في مقارنة واحدة' : '8 Saudi stores in one comparison'} />
          <Link href={`/${locale}/stores`} className="inline-flex items-center gap-1 text-[13px] font-bold text-[color:var(--color-primary)]">
            {isRTL ? 'عرض المتاجر' : 'View stores'}
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {list.map((store) => (
            <Link key={store.slug} href={`/${locale}/stores/${store.slug}`}
              className="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-lowest)] p-3 transition hover:-translate-y-1 hover:border-[color:var(--color-primary)] dark:bg-[color:var(--color-surface-container)]">
              <StoreLogo slug={store.slug} size="lg" locale={locale as 'ar' | 'en'} />
              <span className="line-clamp-1 text-center text-[11px] font-bold text-[color:var(--color-on-surface-variant)]">
                {(isRTL ? store.name_ar : store.name_en) || store.slug}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TRUST ───────────────────────────────────────────────────────────────────
function TrustSection() {
  const { isRTL } = useLocale();
  const items = isRTL
    ? [
        { icon: Zap, title: 'سريع ومباشر', desc: 'نوصل المعلومة بأقصر طريق، بدون تعقيد.' },
        { icon: ShieldCheck, title: 'ثقة وموثوقية', desc: 'معلومات دقيقة ومحدّثة من المتاجر مباشرة.' },
        { icon: Bell, title: 'تنبيهات السعر', desc: 'اعرف متى يصل المنتج للسعر المناسب لك.' },
        { icon: Ticket, title: 'كوبونات فعّالة', desc: 'الكوبون يظهر مع السعر في نفس المكان.' },
      ]
    : [
        { icon: Zap, title: 'Fast and direct', desc: 'We deliver the answer quickly, without clutter.' },
        { icon: ShieldCheck, title: 'Trusted data', desc: 'Accurate prices updated directly from stores.' },
        { icon: Bell, title: 'Price alerts', desc: 'Know when the product hits your target price.' },
        { icon: Ticket, title: 'Useful coupons', desc: 'Coupons shown with price and availability.' },
      ];
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 pb-16 md:px-8">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] p-5 dark:bg-[color:var(--color-surface-container-low)]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--color-primary-container)] text-[color:var(--color-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <h3 className="mt-4 text-[16px] font-bold text-[color:var(--color-on-surface)]">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-[color:var(--color-on-surface-variant)]">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function SectionHeader({ badge, title, subtitle }: { badge: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">{badge}</p>
      <h2 className="mt-1 text-[24px] font-black leading-tight text-[color:var(--color-on-surface)]">{title}</h2>
      {subtitle && <p className="mt-1 text-[14px] leading-6 text-[color:var(--color-on-surface-variant)]">{subtitle}</p>}
    </div>
  );
}

function formatCompact(value: number, isRTL: boolean): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}${isRTL ? 'م' : 'M'}`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}${isRTL ? 'ك' : 'K'}`;
  return value.toLocaleString(isRTL ? 'ar-SA' : 'en-US');
}

const deviceIconMap: Record<CategoryMeta['device'], typeof Smartphone> = {
  phone: Smartphone, laptop: Laptop, tv: Tv, audio: Headphones,
  appliance: WashingMachine, gaming: Gamepad2, tablet: Tablet,
  camera: Camera, monitor: Monitor, printer: Printer, network: Wifi,
  home: Home, watch: Watch, kitchen: CookingPot, care: Sparkle,
  accessory: Package, fridge: Refrigerator,
};
