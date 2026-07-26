// src/app/[locale]/deals/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// صفحة العروض — مستهلك نقي لـ getDeals() (Deal Engine Knowledge Layer)
// صفر منطق حسابي هنا: العرض، القوة، السبب — كلها تأتي جاهزة من الطبقة المعرفية.
// ItemList JSON-LD server-side — نفس نمط /mobiles المثبت (SEO + Carousel eligible)
// ─────────────────────────────────────────────────────────────────────────────

import { getDeals } from "@/lib/intelligence/getDeals";
import type { Metadata } from "next";

export const dynamic = "force-dynamic"; // عروض حية — تتحدث مع كل دورة scraping

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://tawveeri.com";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  return {
    title: "عروض الجوالات الحقيقية اليوم — مكتشفة تلقائياً",
    description:
      "عروض حقيقية محسوبة من تاريخ الأسعار الفعلي في المتاجر السعودية — لا خصومات مزعومة. أسعار أقل من المتوسط وأقل أسعار مسجّلة، محدّثة تلقائياً على مدار اليوم.",
    alternates: { canonical: `${SITE_URL}/${params.locale}/deals` },
  };
}

export default async function DealsPage({ params }: { params: { locale: string } }) {
  const deals = await getDeals(24);

  // ItemList JSON-LD — العروض كمنتجات (نفس نمط /mobiles المعتمد)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "عروض الجوالات الحقيقية في السعودية",
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
    <main dir="rtl" className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-2xl font-bold text-on-surface">🔥 عروض اليوم الحقيقية</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        عروض حقيقية — لا خصومات مزعومة، فقط أسعار أقل من سعرها الأصلي المسجّل في المتجر
      </p>

      {deals.length === 0 ? (
        <div className="mt-12 rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <p className="text-on-surface font-medium">لا توجد عروض قوية مكتشفة حالياً</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            محرك العروض يراقب الأسعار على مدار اليوم — عُد قريباً، أو{" "}
            <a href={`/${params.locale}/categories`} className="text-[var(--brand-green-dark)] underline">
              تصفّح الفئات
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
              {/* شارة قوة العرض — من الطبقة المعرفية */}
              <div
                className={`absolute top-3 right-3 z-10 rounded-full px-2.5 py-1 text-xs font-bold ${
                  d.strength === "hot"
                    ? "bg-orange-100 text-orange-700 border border-orange-300"
                    : "bg-green-100 text-green-700 border border-green-300"
                }`}
              >
                {d.strength === "hot" ? "🔥 عرض قوي" : "✅ سعر جيد"}
              </div>

              {/* الصورة */}
              <div className="flex h-40 items-center justify-center">
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt={d.nameAr} className="h-full object-contain" />
                ) : (
                  <div className="text-gray-300 text-sm">بدون صورة</div>
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

              {/* السعر والخصم الحقيقي */}
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="text-lg font-bold text-on-surface">
                    {d.bestPrice.toLocaleString("ar-SA")}{" "}
                    <span className="text-xs font-normal">ريال</span>
                  </div>
                  <div className="text-xs text-on-surface-variant line-through">
                    بدلاً من {d.averagePrice.toLocaleString("ar-SA")} ريال
                  </div>
                </div>
                {d.discountPct > 0 && (
                  <div className="text-sm font-bold text-[var(--brand-green-dark)]">-{d.discountPct}٪</div>
                )}
              </div>

              {/* السبب — نص الطبقة المعرفية كما هو */}
              <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">{d.reason}</p>
            </a>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-on-surface-variant text-center">
        الخصومات محسوبة مقابل السعر الأصلي المسجّل في المتجر. الأسعار تتغير — توفيري قد يحصل
        على عمولة عند الشراء عبر الروابط.
      </p>
    </main>
  );
}