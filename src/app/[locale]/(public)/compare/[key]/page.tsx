// src/app/[locale]/(public)/compare/[key]/page.tsx
// TPS Layer 4 — صفحة مقارنة الأسعار
// تقرأ من /api/compare?key=<tps_identity_key>
// لا تلمس products أو product_stores أو search

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, ShieldCheck, Trophy, ArrowRight } from 'lucide-react';
import { PublicPageShell } from '@/components/public/public-page-shell';
import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';

interface CompareOffer {
  store_name:   string;
  raw_name:     string;
  price:        number;
  availability: string | null;
  product_url:  string | null;
  confidence:   number;
  is_verified:  boolean;
}

interface CompareResult {
  canonical: {
    id:                  string;
    name_ar:             string;
    name_en:             string;
    brand:               string;
    category:            string;
    tps_identity_key:    string;
    identity_confidence: number;
    attributes:          Record<string, unknown>;
  };
  summary: {
    cheapest_store: string | null;
    lowest_price:   number | null;
    highest_price:  number | null;
    saving:         number | null;
    store_count:    number;
  };
  offers: CompareOffer[];
}

async function fetchCompare(key: string): Promise<CompareResult | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tawveeri.com';
    const res = await fetch(
      `${baseUrl}/api/compare?key=${encodeURIComponent(key)}`,
      { next: { revalidate: 300 } } // cache 5 دقائق
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const data = await fetchCompare(key);
  if (!data) return { title: 'مقارنة الأسعار | توفيري' };

  const name = data.canonical.name_ar || data.canonical.name_en;
  const price = data.summary.lowest_price;

  return {
    title: `${name} — مقارنة الأسعار | توفيري`,
    description: price
      ? `أرخص سعر لـ ${name} هو ${price} ر.س. قارن الأسعار بين ${data.summary.store_count} متاجر.`
      : `قارن أسعار ${name} بين أفضل المتاجر السعودية.`,
  };
}

export default async function TpsComparePage({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  const decodedKey = decodeURIComponent(key);
  const data = await fetchCompare(decodedKey);

  if (!data || data.offers.length === 0) {
    notFound();
  }

  const { canonical, summary, offers } = data;
  const isAr = locale === 'ar';
  const name = isAr ? (canonical.name_ar || canonical.name_en) : (canonical.name_en || canonical.name_ar);

  const cheapestOffer = offers.find(o => o.store_name === summary.cheapest_store) ?? offers[0];

  return (
    <PublicPageShell locale={locale}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Link href={`/${locale}`} className="hover:text-on-surface transition-colors">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <Link href={`/${locale}/search`} className="hover:text-on-surface transition-colors">
            {isAr ? 'البحث' : 'Search'}
          </Link>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 rtl:rotate-180" />
          <span className="text-on-surface font-medium truncate max-w-[200px]">{name}</span>
        </nav>

        {/* ── Product Header ── */}
        <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs capitalize">
                {isAr
                  ? (canonical.category === 'ac' ? 'مكيفات' : canonical.category === 'mobile' ? 'جوالات' : canonical.category)
                  : canonical.category
                }
              </Badge>
              {canonical.brand && (
                <Badge variant="outline" className="text-xs">{canonical.brand}</Badge>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
                {isAr ? `ثقة ${canonical.identity_confidence}%` : `${canonical.identity_confidence}% confidence`}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface leading-snug mt-1">
              {name}
            </h1>
          </div>

          {/* Summary Bar */}
          {summary.lowest_price && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[var(--brand-bg-green)] border border-[var(--brand-green)]/20 p-3 text-center">
                <p className="text-xs text-on-surface-variant mb-1">{isAr ? 'أرخص سعر' : 'Lowest Price'}</p>
                <Price
                  amount={summary.lowest_price}
                  className="text-lg font-extrabold text-[var(--brand-green-dark)]"
                  symbolClassName="w-4 h-4"
                />
              </div>
              {summary.highest_price && summary.highest_price !== summary.lowest_price && (
                <div className="rounded-xl bg-[color:var(--color-surface-container)] p-3 text-center">
                  <p className="text-xs text-on-surface-variant mb-1">{isAr ? 'أعلى سعر' : 'Highest Price'}</p>
                  <Price
                    amount={summary.highest_price}
                    className="text-lg font-bold text-on-surface"
                    symbolClassName="w-4 h-4"
                  />
                </div>
              )}
              {summary.saving && summary.saving > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-3 text-center">
                  <p className="text-xs text-on-surface-variant mb-1">{isAr ? 'توفّر' : 'You Save'}</p>
                  <Price
                    amount={summary.saving}
                    className="text-lg font-bold text-amber-700 dark:text-amber-400"
                    symbolClassName="w-4 h-4"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cheapest Offer (featured) ── */}
        {cheapestOffer && (
          <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--brand-green)]/40 bg-[color:var(--color-surface-container-low)] p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-green)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                <Trophy className="h-3 w-3" />
                {isAr ? 'أفضل سعر' : 'Best Price'}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-on-surface-variant mb-1">
                  {isAr ? 'أفضل سعر الآن عند' : 'Best price at'}
                </span>
                <span className="text-base font-bold text-on-surface">
                  {cheapestOffer.store_name}
                </span>
                {cheapestOffer.availability === 'in_stock' && (
                  <span className="text-xs text-[var(--brand-green)] font-medium mt-0.5">
                    {isAr ? '● متوفر الآن' : '● In Stock'}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end shrink-0">
                <Price
                  amount={cheapestOffer.price}
                  className="text-3xl md:text-4xl font-extrabold text-[var(--brand-green-dark)]"
                  symbolClassName="w-6 h-6 md:w-7 md:h-7"
                />
              </div>
            </div>

            {cheapestOffer.product_url ? (
              <a
                href={cheapestOffer.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] px-5 text-sm font-semibold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]"
              >
                <span>{isAr ? `اشترِ من ${cheapestOffer.store_name}` : `Buy from ${cheapestOffer.store_name}`}</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <a
                href={`/${locale}/search?q=${encodeURIComponent(name)}`}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-green)] px-5 text-sm font-semibold text-white shadow-[var(--elevation-1)] transition-colors hover:bg-[var(--brand-green-dark)]"
              >
                <span>{isAr ? 'شوف في المتاجر' : 'Find in stores'}</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}

        {/* ── All Offers ── */}
        {offers.length > 1 && (
          <div className="rounded-2xl border border-[color:var(--color-outline-variant)] overflow-hidden">
            <div className="bg-[color:var(--color-surface-container)] px-4 py-3 border-b border-[color:var(--color-outline-variant)]">
              <h2 className="text-sm font-bold text-on-surface">
                {isAr ? `جميع العروض (${offers.length} متاجر)` : `All Offers (${offers.length} stores)`}
              </h2>
            </div>

            <div className="divide-y divide-[color:var(--color-outline-variant)]/50">
              {offers.map((offer, idx) => (
                <div
                  key={`${offer.store_name}-${idx}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-[color:var(--color-surface-container-low)] transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-on-surface">{offer.store_name}</span>
                    <span className="text-xs text-on-surface-variant truncate max-w-[200px] mt-0.5">
                      {offer.raw_name}
                    </span>
                    {offer.availability === 'in_stock' && (
                      <span className="text-xs text-[var(--brand-green)] font-medium mt-0.5">
                        {isAr ? '● متوفر' : '● In Stock'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Price
                      amount={offer.price}
                      className={`text-lg font-bold ${offer.price === summary.lowest_price ? 'text-[var(--brand-green-dark)]' : 'text-on-surface'}`}
                      symbolClassName="w-4 h-4"
                    />
                    {offer.product_url ? (
                      <a
                        href={offer.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-xs font-semibold text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
                      >
                        {isAr ? 'زيارة' : 'Visit'}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <a
                        href={`/${locale}/search?q=${encodeURIComponent(name)}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 text-xs font-semibold text-on-surface transition-colors hover:border-[var(--brand-green)]/50 hover:bg-[var(--brand-bg-green)]"
                      >
                        {isAr ? 'في المتاجر' : 'In stores'}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TPS Badge ── */}
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-on-surface-variant">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-green)]" />
          <span>
            {isAr
              ? `تم التحقق من المطابقة بدقة ${canonical.identity_confidence}% • مدعوم بـ TPS`
              : `Verified match at ${canonical.identity_confidence}% confidence • Powered by TPS`
            }
          </span>
        </div>

      </div>
    </PublicPageShell>
  );
}
