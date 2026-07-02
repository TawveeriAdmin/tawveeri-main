// src/app/[locale]/product/[slug]/page.tsx
// صفحة المنتج — تقرأ من getProductComparison فقط، وSEO من getProductSEO فقط.
// JSON-LD يُحقن server-side في الـ HTML الأولي (شرط Google للأسعار المتغيرة).

import { getProductComparison } from "@/lib/catalog/getProductComparison";
import { getProductSEO } from "@/lib/catalog/getProductSEO";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// ═══ Metadata ديناميكي — من المولّد المركزي ═══
export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const product = await getProductComparison(params.slug);
  if (!product) return { title: "المنتج غير موجود | توفيري" };

  const seo = getProductSEO(product, params.locale);
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    openGraph: seo.openGraph,
  };
}

export default async function ProductPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const product = await getProductComparison(params.slug);
  if (!product) notFound();

  const seo = getProductSEO(product, params.locale);

  const specs: { label: string; value: string }[] = [];
  if (product.brand) specs.push({ label: "العلامة التجارية", value: product.brand });
  if (product.attributes.storage) specs.push({ label: "سعة التخزين", value: `${product.attributes.storage} جيجابايت` });
  if (product.attributes.ram) specs.push({ label: "الذاكرة العشوائية", value: `${product.attributes.ram} جيجابايت` });
  if (product.attributes.colors?.length) specs.push({ label: "الألوان المتوفرة", value: `${product.attributes.colors.length} لون` });

  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-4 py-8">
      {/* JSON-LD — server-side في HTML الأولي */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }}
      />

      {/* اسم المنتج */}
      <h1 className="text-2xl font-bold text-gray-900">{product.nameAr}</h1>
      {product.nameEn && product.nameEn !== product.nameAr && (
        <p className="mt-1 text-sm text-gray-500">{product.nameEn}</p>
      )}

      {/* الصورة */}
      {product.imageUrl && (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt={product.nameAr} className="h-64 object-contain" />
        </div>
      )}

      {/* شارة التوفير */}
      {product.savings !== null && product.savings > 0 && (
        <div className="mt-6 rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <span className="text-green-800 font-semibold text-lg">
            وفّر حتى {product.savings.toLocaleString("ar-SA")} ريال
          </span>
          <p className="text-green-600 text-sm mt-1">بمقارنة الأسعار بين المتاجر</p>
        </div>
      )}

      {/* جدول الأسعار */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">قارن الأسعار</h2>
        <div className="space-y-3">
          {product.offers.map((offer, i) => (
            <div
              key={offer.offerId}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                i === 0 ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <div className="font-semibold text-gray-900">{offer.storeName}</div>
                {i === 0 && (
                  <span className="text-xs text-green-700 font-medium">أفضل سعر</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xl font-bold text-gray-900">
                  {offer.price.toLocaleString("ar-SA")} <span className="text-sm font-normal">ريال</span>
                </div>
                <a
                  href={`/go/${offer.offerId}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  اذهب للمتجر
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* المواصفات */}
      {specs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">المواصفات</h2>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {specs.map((s, i) => (
              <div
                key={s.label}
                className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
              >
                <span className="text-gray-600">{s.label}</span>
                <span className="font-medium text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-gray-400 text-center">
        الأسعار محدّثة تلقائياً من المتاجر وقد تتغير. توفيري قد يحصل على عمولة عند الشراء عبر الروابط.
      </p>
    </main>
  );
}