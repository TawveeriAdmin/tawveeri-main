// src/lib/catalog/getProductSEO.ts
// ─────────────────────────────────────────────────────────────────────────────
// المولّد المركزي الوحيد لكل بيانات SEO — من ProductComparison فقط.
// يولد: title, description, canonical, OpenGraph, JSON-LD (Product+AggregateOffer)
// أي تغيير في السعر/المتاجر ينعكس تلقائياً — البيانات المنظمة تطابق المعروض دائماً
// (نفس المصدر getProductComparison = تطابق مضمون بنيوياً، شرط Google).
// ملاحظة: الـ title بلا "| توفيري" — الـ layout يضيفها تلقائياً (منع التكرار).
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductComparison } from "./getProductComparison";

const SITE_NAME = "توفيري";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tawveeri.com";

export interface ProductSEO {
  title: string;
  description: string;
  canonical: string;
  openGraph: {
    title: string;
    description: string;
    url: string;
    siteName: string;
    images: { url: string; alt: string }[];
    locale: string;
    type: string;
  };
  jsonLd: Record<string, unknown>;
}

export function getProductSEO(product: ProductComparison, locale: string = "ar"): ProductSEO {
  const canonical = `${SITE_URL}/${locale}/product/${product.slug}`;
  const storesCount = product.offers.length;
  const bestPriceStr = product.bestPrice !== null
    ? product.bestPrice.toLocaleString("ar-SA")
    : null;

  // Title: "سعر آبل آيفون 16 برو ماكس 256 جيجابايت في السعودية — قارن ووفّر"
  // (بلا اسم الموقع — الـ layout يضيفه تلقائياً)
  const title = `سعر ${product.nameAr} في السعودية — قارن ووفّر`;

  // Description بأرخص سعر وعدد المتاجر — يتحدّث تلقائياً مع كل تغيير سعر
  const descParts: string[] = [];
  if (bestPriceStr) descParts.push(`أفضل سعر لـ ${product.nameAr} يبدأ من ${bestPriceStr} ريال`);
  else descParts.push(`قارن أسعار ${product.nameAr}`);
  const storesText = storesCount === 2 ? "متجرين" : `${storesCount} متاجر`;
  descParts.push(`قارن الأسعار في ${storesText} سعودية`);
  if (product.savings !== null && product.savings > 0) {
    descParts.push(`ووفّر حتى ${product.savings.toLocaleString("ar-SA")} ريال`);
  }
  const description = descParts.join("، ") + `. أسعار محدّثة تلقائياً على ${SITE_NAME}.`;

  // JSON-LD: Product + AggregateOffer (النوع الصحيح لمنصة مقارنة — Product Snippets)
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.nameAr,
    ...(product.nameEn ? { alternateName: product.nameEn } : {}),
    ...(product.imageUrl ? { image: [product.imageUrl] } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.offers.length > 0 && product.bestPrice !== null
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "SAR",
            lowPrice: String(product.bestPrice),
            highPrice: String(product.offers[product.offers.length - 1].price),
            offerCount: product.offers.length,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return {
    title,
    description,
    canonical,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.nameAr }] : [],
      locale: locale === "ar" ? "ar_SA" : "en_US",
      type: "website",
    },
    jsonLd,
  };
}