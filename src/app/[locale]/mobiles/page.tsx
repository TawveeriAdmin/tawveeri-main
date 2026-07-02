// src/app/[locale]/mobiles/page.tsx
// كتالوج الجوالات — بطاقات تقود لصفحات المنتجات (روابط داخلية لـ SEO)
// ItemList JSON-LD → مؤهلة لـ Google Carousel

import { getMobileCards } from "@/lib/catalog/getProductComparison";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tawveeri.com";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  return {
    title: "أسعار الجوالات في السعودية — قارن ووفّر",
    description: "قارن أسعار الجوالات بين المتاجر السعودية: آيفون، سامسونج جالاكسي وأكثر. أسعار محدّثة تلقائياً — اعثر على أفضل سعر ووفّر.",
    alternates: { canonical: `${SITE_URL}/${params.locale}/mobiles` },
  };
}

export default async function MobilesPage({ params }: { params: { locale: string } }) {
  const cards = await getMobileCards();

  // ItemList JSON-LD — مؤهل لـ Google Carousel (summary page)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: c.nameAr,
        ...(c.imageUrl ? { image: [c.imageUrl] } : {}),
        ...(c.bestPrice !== null
          ? {
              offers: {
                "@type": "AggregateOffer",
                lowPrice: String(c.bestPrice),
                priceCurrency: "SAR",
                offerCount: c.storesCount,
              },
            }
          : {}),
        url: `${SITE_URL}/${params.locale}/product/${c.slug}`,
      },
    })),
  };

  return (
    <main dir="rtl" className="mx-auto max-w-5xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-2xl font-bold text-gray-900">أسعار الجوالات في السعودية</h1>
      <p className="mt-1 text-sm text-gray-500">
        قارن الأسعار بين المتاجر واعثر على أفضل سعر — {cards.length} جهاز متاح للمقارنة
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <a
            key={c.slug}
            href={`/${params.locale}/product/${c.slug}`}
            className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-green-400 hover:shadow-md transition"
          >
            {/* الصورة */}
            <div className="flex h-40 items-center justify-center">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.nameAr} className="h-full object-contain" />
              ) : (
                <div className="text-gray-300 text-sm">بدون صورة</div>
              )}
            </div>

            {/* الاسم */}
            <h2 className="mt-3 text-sm font-semibold text-gray-900 leading-snug group-hover:text-green-700 transition">
              {c.nameAr}
            </h2>

            {/* السعر والتوفير */}
            <div className="mt-2 flex items-end justify-between">
              <div>
                {c.bestPrice !== null && (
                  <>
                    <div className="text-xs text-gray-400">يبدأ من</div>
                    <div className="text-lg font-bold text-gray-900">
                      {c.bestPrice.toLocaleString("ar-SA")} <span className="text-xs font-normal">ريال</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-left">
                {c.savings !== null && c.savings > 0 && (
                  <div className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2 py-1">
                    وفّر {c.savings.toLocaleString("ar-SA")} ريال
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-400">
                  {c.storesCount === 2 ? "متجران" : `${c.storesCount} متاجر`}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}