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
        url: `${SITE_URL}/${params.locale}/product/${d.slug}`,
      },
    })),
  };

  return (
    <main dir="rtl" className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-2xl font-bold text-gray-900">🔥 عروض اليوم الحقيقية</h1>
      <p className="mt-1 text-sm text-gray-500">
        مكتشفة تلقائياً من تاريخ الأسعار الفعلي — لا خصومات مزعومة، فقط أسعار أقل من متوسطها المسجّل
      </p>

      {deals.length === 0 ? (
        <div className="mt-12 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600 font-medium">لا توجد عروض قوية مكتشفة حالياً</p>
          <p className="mt-1 text-sm text-gray-400">
            محرك العروض يراقب الأسعار على مدار اليوم — عُد قريباً، أو تصفح{" "}
            <a href={`/${params.locale}/mobiles`} className="text-green-700 underline">
              كتالوج الجوالات
            </a>
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((d) => (
            <a
              key={d.productId}
              href={`/${params.locale}/product/${d.slug}`}
              className="group relative rounded-xl border border-gray-200 bg-white p-4 hover:border-green-400 hover:shadow-md transition"
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
              <h2 className="mt-3 text-sm font-semibold text-gray-900 leading-snug group-hover:text-green-700 transition">
                {d.nameAr}
              </h2>

              {/* السعر والخصم الحقيقي */}
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {d.bestPrice.toLocaleString("ar-SA")}{" "}
                    <span className="text-xs font-normal">ريال</span>
                  </div>
                  <div className="text-xs text-gray-400 line-through">
                    متوسطه {d.averagePrice.toLocaleString("ar-SA")} ريال
                  </div>
                </div>
                {d.discountPct > 0 && (
                  <div className="text-sm font-bold text-orange-600">-{d.discountPct}٪</div>
                )}
              </div>

              {/* السبب — نص الطبقة المعرفية كما هو */}
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{d.reason}</p>
            </a>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400 text-center">
        الخصومات محسوبة مقابل متوسط السعر المسجّل خلال آخر 30 يوماً. الأسعار تتغير — توفيري قد يحصل
        على عمولة عند الشراء عبر الروابط.
      </p>
    </main>
  );
}