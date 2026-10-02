import { serializeJsonLd } from '@/lib/seo/serialize-json-ld';
// src/app/[locale]/(public)/deals/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// صفحة العروض — ADR-400 (consumer-journey review, 2026-10-02).
//
// WHAT CHANGED AND WHY. The page's headline promised «لا خصومات مزعومة» while every card's
// percentage was computed against `product_stores.original_price` — the MERCHANT's own
// strike-through "was" price, which this platform publishes is unobserved ~71% of the time
// (EXECUTIVE_DIRECTIVE §2). Reviewer evidence #6: «حافظة بـ 11 ريال وخصم 64٪ عن سعر أصلي
// مسجّل … يعاكس «من نحن»». Standing rule 7: never publish a saving we did not verify.
//
// The page now has two clearly separated tiers:
//   1. «انخفاضات رصدناها بأنفسنا» — `verified_drop` rows from our own listing facts: the
//      current price, the highest price WE observed, the tracked days and the last-seen
//      date. A percentage appears ONLY here, because only here both prices are ours.
//   2. «عروض يعلنها المتجر» — the store-flagged deals (getDeals). The store's "was" price
//      is shown as the store's claim, muted, with no percentage and no strength badge
//      derived from it. The only label is the evidence tier the offer actually earned
//      (ADR-211: lowest among retailers / lower than usual / available at X).
//
// Tier 1 is served through `unstable_cache` (10 min): it resolves ~190 destination URLs and
// must not run on every request of a `force-dynamic` page.
// ─────────────────────────────────────────────────────────────────────────────

import { unstable_cache } from "next/cache";
import { getDeals } from "@/lib/intelligence/getDeals";
import { getHomeVerifiedDeals, type HomeVerifiedDeal } from "@/lib/intelligence/home-verified-deals";
import { observedSavingPct } from "@/lib/intelligence/observed-saving";
import type { Metadata } from "next";

export const dynamic = "force-dynamic"; // عروض حية — تتحدث مع كل دورة scraping

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tawveeri.com";
const RIYADH = "Asia/Riyadh";

const T = {
  ar: {
    metaTitle: "انخفاضات أسعار رصدناها بأنفسنا — السعودية",
    metaDesc:
      "خصم نعرضه = سعران رصدناهما نحن بتاريخين: أعلى سعر رصدناه والسعر الحالي. سعر «قبل» الذي يعلنه المتجر ولم نرصده لا نحسبه خصمًا.",
    h1: "انخفاضات رصدناها بأنفسنا",
    sub: "الخصم هنا بين سعرين رصدناهما نحن، بتاريخيهما. ما لم نرصده لا نحسبه.",
    verifiedTitle: "رصدنا السعر الأعلى ثم رصدنا الانخفاض",
    verifiedEmpty: "لا توجد انخفاضات مؤكدة برصدنا حاليًا — نبني سجل الأسعار على مدار اليوم.",
    wasObserved: (n: string, d: string | null) => `أعلى سعر رصدناه ${n} ريال${d ? ` · آخر رصد ${d}` : ""}`,
    tracked: (days: number) => `تتبّعناه ${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : days <= 10 ? "أيام" : "يومًا"}`,
    pct: (p: number) => `-${p}٪ برصدنا`,
    compare: "قارن المتاجر",
    go: "اذهب إلى المتجر",
    storeTitle: "عروض يعلنها المتجر — لم نرصد السعر الأصلي",
    storeSub: "المتجر يقول إن هذا عرض. نعرض سعره الحالي كما رصدناه، وسعر «قبل» الذي يعلنه كما يعلنه هو، بلا نسبة لأننا لم نرصده.",
    storeWas: (n: string) => `يعلن المتجر سعرًا سابقًا ${n} ريال — لم نرصده`,
    noImage: "بدون صورة",
    sar: "ريال",
    browse: "تصفّح الفئات",
    footer:
      "الأسعار كما رصدناها في وقت الرصد المذكور، دون شحن أو تركيب. تتغير الأسعار — تحقق من السعر النهائي والشروط في صفحة المتجر.",
    numberLocale: "ar-SA",
  },
  en: {
    metaTitle: "Price drops we observed ourselves — Saudi Arabia",
    metaDesc:
      "A discount shown here is two prices we observed, with their dates: the highest we saw and the current one. A store's “was” price we never observed is not counted as a discount.",
    h1: "Price drops we observed ourselves",
    sub: "A discount here sits between two prices we observed, with their dates. What we did not observe, we do not count.",
    verifiedTitle: "We observed the higher price, then the drop",
    verifiedEmpty: "No drops verified by our own tracking right now — the price history keeps building through the day.",
    wasObserved: (n: string, d: string | null) => `Highest we observed: ${n} SAR${d ? ` · last seen ${d}` : ""}`,
    tracked: (days: number) => `tracked ${days} day${days === 1 ? "" : "s"}`,
    pct: (p: number) => `-${p}% by our tracking`,
    compare: "Compare stores",
    go: "Go to the store",
    storeTitle: "Deals declared by the store — original price not observed by us",
    storeSub: "The store says this is a deal. We show its current price as we observed it, and its “was” price as the store states it — with no percentage, because we never observed it.",
    storeWas: (n: string) => `Store states a previous price of ${n} SAR — not observed by us`,
    noImage: "No image",
    sar: "SAR",
    browse: "browse categories",
    footer:
      "Prices as observed at the stated time, excluding shipping and installation. Prices change — check the final price and conditions on the store page.",
    numberLocale: "en-US",
  },
} as const;

const dict = (locale: string) => (locale === "en" ? T.en : T.ar);

function formatDay(iso: string | null | undefined, isAr: boolean): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat(isAr ? "ar-u-nu-latn" : "en-GB", { timeZone: RIYADH, day: "numeric", month: "long" }).format(new Date(t));
}

const getVerifiedDealsCached = unstable_cache(
  async (locale: string): Promise<HomeVerifiedDeal[]> => getHomeVerifiedDeals(24, locale),
  ["deals-page-verified-drops"],
  { revalidate: 600 },
);

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = dict(params.locale);
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: { canonical: `${SITE_URL}/${params.locale}/deals` },
  };
}

export default async function DealsPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const t = dict(params.locale);
  const isAr = params.locale !== "en";
  const [verified, storeDeals] = await Promise.all([
    getVerifiedDealsCached(params.locale).catch(() => [] as HomeVerifiedDeal[]),
    getDeals(12).catch(() => []),
  ]);

  // ItemList JSON-LD — ONLY the drops we can evidence (tier 1). A store's claim is not
  // published as structured data under our name.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isAr ? "انخفاضات أسعار رصدتها توفيري" : "Price drops observed by Tawveeri",
    itemListElement: verified.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: d.name,
        offers: { "@type": "Offer", price: String(d.price), priceCurrency: "SAR", ...(d.storeName ? { seller: { "@type": "Organization", name: d.storeName } } : {}) },
        url: d.internal ? `${SITE_URL}${d.href}` : `${SITE_URL}/${params.locale}/deals`,
      },
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <h1 className="text-2xl font-bold text-on-surface">{t.h1}</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{t.sub}</p>

      {/* ── Tier 1: drops WE observed ── */}
      <section aria-labelledby="verified-drops" className="mt-6" data-testid="deals-verified-section">
        <h2 id="verified-drops" className="text-base font-bold text-on-surface">{t.verifiedTitle}</h2>
        {verified.length === 0 ? (
          <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
            <p className="text-sm text-on-surface-variant">{t.verifiedEmpty}</p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {verified.map((d) => {
              const pct = observedSavingPct(d.price, d.observedMax);
              const seen = formatDay(d.lastSeen, isAr);
              return (
                <a
                  key={`${d.url}`}
                  href={d.href}
                  rel={d.internal ? undefined : "noopener nofollow"}
                  className="group relative rounded-2xl border border-outline-variant bg-surface p-4 hover:border-[var(--brand-green)] hover:shadow-md transition"
                  data-testid="verified-drop-card"
                >
                  {pct > 0 && (
                    <div className={`absolute top-3 z-10 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 border border-green-300 ${isAr ? "right-3" : "left-3"}`}>
                      {t.pct(pct)}
                    </div>
                  )}
                  <h3 className="mt-6 text-sm font-semibold text-on-surface leading-snug line-clamp-2"><bdi dir="auto">{d.name}</bdi></h3>
                  {d.storeName && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                      🏪 {d.storeName}
                    </span>
                  )}
                  <div className="mt-2 text-lg font-bold text-on-surface tabular-nums">
                    {d.price.toLocaleString(t.numberLocale)} <span className="text-xs font-normal">{t.sar}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{t.wasObserved(d.observedMax.toLocaleString(t.numberLocale), seen)}</p>
                  <p className="text-[11px] text-on-surface-variant">{t.tracked(d.trackedDays)}</p>
                  <p className="mt-2 text-xs font-semibold text-[var(--brand-green-dark)]">{d.internal ? t.compare : t.go} →</p>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Tier 2: the store's own claim, shown as a claim ── */}
      {storeDeals.length > 0 && (
        <section aria-labelledby="store-deals" className="mt-10" data-testid="deals-store-claims-section">
          <h2 id="store-deals" className="text-base font-bold text-on-surface">{t.storeTitle}</h2>
          <p className="mt-1 text-xs text-on-surface-variant">{t.storeSub}</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storeDeals.map((d) => (
              <a
                key={d.productId}
                href={`/${params.locale}/products/${d.slug}`}
                className="group relative rounded-2xl border border-outline-variant bg-surface p-4 hover:border-[var(--brand-green)] hover:shadow-md transition"
                data-testid="store-claim-card"
              >
                <div className="flex h-32 items-center justify-center">
                  {d.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    (<img src={d.imageUrl} alt={d.nameAr} className="h-full object-contain" />)
                  ) : (
                    <div className="text-gray-300 text-sm">{t.noImage}</div>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-on-surface leading-snug line-clamp-2"><bdi dir="auto">{isAr ? d.nameAr : (d.nameEn || d.nameAr)}</bdi></h3>
                {d.bestStore && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                    🏪 {d.bestStore}
                  </span>
                )}
                {/* ADR-211 — the only claim this offer earned by evidence (tier label), never a merchant-% badge. */}
                <p className="mt-1 text-xs font-semibold text-on-surface">{isAr ? d.labelAr : d.labelEn}</p>
                <div className="mt-2 text-lg font-bold text-on-surface tabular-nums">
                  {d.bestPrice.toLocaleString(t.numberLocale)} <span className="text-xs font-normal">{t.sar}</span>
                </div>
                {d.averagePrice > d.bestPrice && (
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">{t.storeWas(d.averagePrice.toLocaleString(t.numberLocale))}</p>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {verified.length === 0 && storeDeals.length === 0 && (
        <p className="mt-6 text-center text-sm text-on-surface-variant">
          <a href={`/${params.locale}/categories`} className="text-[var(--brand-green-dark)] underline">{t.browse}</a>
        </p>
      )}

      <p className="mt-8 text-xs text-on-surface-variant text-center">{t.footer}</p>
    </main>
  );
}
