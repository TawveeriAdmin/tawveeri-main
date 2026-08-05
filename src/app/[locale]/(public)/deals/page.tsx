// src/app/[locale]/deals/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// صفحة العروض — مستهلك نقي لـ getDeals() (Deal Engine Knowledge Layer)
// صفر منطق حسابي هنا: العرض، القوة، السبب — كلها تأتي جاهزة من الطبقة المعرفية.
// ItemList JSON-LD server-side — نفس نمط /mobiles المثبت (SEO + Carousel eligible)
//
// ADR-201: the page was hardcoded Arabic with dir="rtl" on BOTH locales. The strings
// below are the English MIRRORS of the already-approved Arabic claims (LAUNCH_VOCABULARY
// statements are bilingual by design — same claim, both languages, never a new claim).
// ─────────────────────────────────────────────────────────────────────────────

import { getDeals } from "@/lib/intelligence/getDeals";
import type { Metadata } from "next";

export const dynamic = "force-dynamic"; // عروض حية — تتحدث مع كل دورة scraping

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tawveeri.com";

const T = {
  ar: {
    metaTitle: "عروض الجوالات الحقيقية اليوم — مكتشفة تلقائياً",
    metaDesc:
      "عروض حقيقية محسوبة من تاريخ الأسعار الفعلي في المتاجر السعودية — لا خصومات مزعومة. أسعار أقل من المتوسط وأقل أسعار مسجّلة، محدّثة تلقائياً على مدار اليوم.",
    h1: "🔥 عروض اليوم الحقيقية",
    sub: "عروض حقيقية — لا خصومات مزعومة، فقط أسعار أقل من سعرها الأصلي المسجّل في المتجر",
    hot: "🔥 عرض قوي",
    good: "✅ سعر جيد",
    noImage: "بدون صورة",
    sar: "ريال",
    belowAvg: (n: string) => `أقل من متوسط السوق بـ ${n} ريال`,
    pctTitle: "مقارنةً بمتوسط سعر السوق الذي رصدناه",
    pctLabel: (p: number) => `-${p}٪ عن المتوسط`,
    emptyTitle: "لا توجد عروض قوية مكتشفة حالياً",
    emptyBody: "محرك العروض يراقب الأسعار على مدار اليوم — عُد قريباً، أو",
    browse: "تصفّح الفئات",
    footer:
      "الخصومات محسوبة مقابل السعر الأصلي المسجّل في المتجر. الأسعار تتغير — توفيري قد يحصل على عمولة عند الشراء عبر الروابط.",
    numberLocale: "ar-SA",
  },
  en: {
    metaTitle: "Real phone deals today — detected automatically",
    metaDesc:
      "Real deals computed from actual price history at Saudi retailers — no claimed discounts. Prices below the average and lowest recorded prices, refreshed automatically through the day.",
    h1: "🔥 Today's real deals",
    sub: "Real deals — no claimed discounts, only prices below the original price recorded at the store",
    hot: "🔥 Strong deal",
    good: "✅ Good price",
    noImage: "No image",
    sar: "SAR",
    belowAvg: (n: string) => `${n} SAR below the market average`,
    pctTitle: "Against the market-average price we observed",
    pctLabel: (p: number) => `-${p}% vs average`,
    emptyTitle: "No strong deals detected right now",
    emptyBody: "The deal engine watches prices through the day — check back soon, or",
    browse: "browse categories",
    footer:
      "Discounts are computed against the original price recorded at the store. Prices change — Tawveeri may earn a commission on purchases through links.",
    numberLocale: "en-US",
  },
} as const;

const dict = (locale: string) => (locale === "en" ? T.en : T.ar);

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = dict(params.locale);
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: { canonical: `${SITE_URL}/${params.locale}/deals` },
  };
}

export default async function DealsPage({ params }: { params: { locale: string } }) {
  const deals = await getDeals(24);
  const t = dict(params.locale);
  const isAr = params.locale !== "en";

  // ItemList JSON-LD — العروض كمنتجات (نفس نمط /mobiles المعتمد)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isAr ? "عروض الجوالات الحقيقية في السعودية" : "Real phone deals in Saudi Arabia",
    itemListElement: deals.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: d.nameAr,
        ...(d.imageUrl ? { image: [d.imageUrl] } : {}),
        ...(d.brand ? { brand: { "@type": "Brand", name: d.brand } } : {}),
        offers: {
          "@type": "AggregateOffer",
          lowPrice: String(d.bestPrice),
          priceCurrency: "SAR",
          offerCount: d.storesCount,
        },
        url: `${SITE_URL}/${params.locale}/products/${d.slug}`,
      },
    })),
  };

  return (
    <main dir={isAr ? "rtl" : "ltr"} className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-2xl font-bold text-on-surface">{t.h1}</h1>
      <p className="mt-1 text-sm text-on-surface-variant">{t.sub}</p>

      {deals.length === 0 ? (
        <div className="mt-12 rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <p className="text-on-surface font-medium">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t.emptyBody}{" "}
            <a href={`/${params.locale}/categories`} className="text-[var(--brand-green-dark)] underline">
              {t.browse}
            </a>
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((d) => (
            <a
              key={d.productId}
              href={`/${params.locale}/products/${d.slug}`}
              className="group relative rounded-2xl border border-outline-variant bg-surface p-4 hover:border-[var(--brand-green)] hover:shadow-md transition"
            >
              {/* شارة قوة العرض — من الطبقة المعرفية. ADR-211 micro-patch: عرض بلا
                  دليل (متجر واحد بلا تاريخ أسعار) لا يستحق أي ادعاء تقييمي، ولو
                  ليّناً مثل "سعر جيد" — تُحجب الشارة كاملاً لهذا المستوى. */}
              {d.labelTier !== "single" && (
                <div
                  className={`absolute top-3 z-10 rounded-full px-2.5 py-1 text-xs font-bold ${isAr ? "right-3" : "left-3"} ${
                    d.strength === "hot"
                      ? "bg-orange-100 text-orange-700 border border-orange-300"
                      : "bg-green-100 text-green-700 border border-green-300"
                  }`}
                >
                  {d.strength === "hot" ? t.hot : t.good}
                </div>
              )}

              {/* الصورة */}
              <div className="flex h-40 items-center justify-center">
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.nameAr} className="h-full object-contain" />
                ) : (
                  <div className="text-gray-300 text-sm">{t.noImage}</div>
                )}
              </div>

              {/* الاسم */}
              <h2 className="mt-3 text-sm font-semibold text-on-surface leading-snug group-hover:text-[var(--brand-green-dark)] transition line-clamp-2">
                {d.nameAr}
              </h2>

              {/* المتجر — صريح على كل بطاقة (لا نوحي بتغطية متعددة المتاجر) */}
              {d.bestStore && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                  🏪 {d.bestStore}
                </span>
              )}

              {/* ADR-211 — الادعاء الوحيد المسموح لهذا العرض حسب دليله: متجر واحد ← توفر
                  فقط، متجر واحد بتاريخ أسعار مستقر ← أقل من المعتاد، متجران فأكثر ← أقل
                  سعر بين المتاجر. لا "أفضل سعر" لمتجر واحد بلا دليل. */}
              <p className="mt-1 text-xs font-semibold text-on-surface">{isAr ? d.labelAr : d.labelEn}</p>

              {/* السعر والخصم الحقيقي */}
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="text-lg font-bold text-on-surface">
                    {d.bestPrice.toLocaleString(t.numberLocale)}{" "}
                    <span className="text-xs font-normal">{t.sar}</span>
                  </div>
                  {/* ADR-129 (P0-2): averagePrice is OUR cross-store measurement, not a merchant "was" —
                      so it is NOT gated. Relabelled to state exactly what it is (below the market AVERAGE),
                      never "بدلاً من" which implies a former price. A claim no competitor can make. */}
                  {d.averagePrice > d.bestPrice && (
                    <div className="text-xs text-on-surface-variant">
                      {t.belowAvg(Math.round(d.averagePrice - d.bestPrice).toLocaleString(t.numberLocale))}
                    </div>
                  )}
                </div>
                {d.discountPct > 0 && (
                  <div className="text-sm font-bold text-[var(--brand-green-dark)]" title={t.pctTitle}>{t.pctLabel(d.discountPct)}</div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-on-surface-variant text-center">{t.footer}</p>
    </main>
  );
}
