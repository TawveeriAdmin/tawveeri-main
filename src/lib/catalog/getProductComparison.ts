// src/lib/catalog/getProductComparison.ts
// ─────────────────────────────────────────────────────────────────────────────
// طبقة القراءة الوحيدة لصفحة المنتج — الواجهة لا تعرف الجداول.
// تُرجع: المنتج + عرض أفضل سعر لكل متجر + مقدار التوفير + offerIds للأزرار.
// أي تغيير مستقبلي في مصدر البيانات (جدول Offers مثلاً) يحدث هنا فقط.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export interface StoreOffer {
  offerId: string;        // normalized_product_observations.id → يُستخدم في /go/{offerId}
  storeName: string;
  price: number;
  observedAt: string;
}

export interface ProductComparison {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  brand: string | null;
  imageUrl: string | null;
  attributes: {
    family?: string;
    generation?: string;
    variant?: string;
    storage?: string;
    ram?: number | null;
    colors?: string[];
  };
  offers: StoreOffer[];   // مرتبة من الأرخص للأغلى
  bestPrice: number | null;
  savings: number | null; // الفرق بين أغلى وأرخص عرض
}

// slug = tps_identity_key محولاً لصيغة URL آمنة
// "apple|iPhone|16|Pro Max|256" → "apple-iphone-16-pro-max-256"
export function identityKeyToSlug(key: string): string {
  return key.toLowerCase().replace(/\|/g, "-").replace(/\s+/g, "-").replace(/=/g, "-");
}

export async function getProductComparison(slug: string): Promise<ProductComparison | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // 1) جلب كل المنتجات النشطة (13 حالياً — استعلام خفيف) ومطابقة الـ slug
  const { data: products, error: pErr } = await supabase
    .from("canonical_products")
    .select("id, name_ar, name_en, brand, image_url, attributes, tps_identity_key")
    .eq("category", "mobile")
    .eq("is_active", true);

  if (pErr || !products) return null;

  const product = products.find((p) => identityKeyToSlug(p.tps_identity_key ?? "") === slug);
  if (!product) return null;

  // 2) آخر سعر لكل متجر من price_history
  const { data: prices, error: prErr } = await supabase
    .from("price_history")
    .select("store_name, price, observed_at, tps_observation_id")
    .eq("canonical_product_id", product.id)
    .order("observed_at", { ascending: false });

  if (prErr || !prices) return null;

  // أول ظهور لكل متجر = الأحدث (مرتّب تنازلياً)
  const latestByStore = new Map<string, { price: number; observedAt: string; tpsObservationId: string }>();
  for (const row of prices) {
    if (!latestByStore.has(row.store_name)) {
      latestByStore.set(row.store_name, {
        price: Number(row.price),
        observedAt: row.observed_at,
        tpsObservationId: row.tps_observation_id,
      });
    }
  }

  // 3) بناء العروض — offerId هو tps_observation_id (يشير لصف normalized الذي فيه _url)
  const offers: StoreOffer[] = [...latestByStore.entries()]
    .map(([storeName, v]) => ({
      offerId: v.tpsObservationId,
      storeName,
      price: v.price,
      observedAt: v.observedAt,
    }))
    .sort((a, b) => a.price - b.price);

  const bestPrice = offers.length ? offers[0].price : null;
  const worstPrice = offers.length ? offers[offers.length - 1].price : null;
  const savings = bestPrice !== null && worstPrice !== null && worstPrice > bestPrice
    ? worstPrice - bestPrice
    : null;

  const attrs = (product.attributes ?? {}) as ProductComparison["attributes"];

  return {
    id: product.id,
    slug,
    nameAr: product.name_ar,
    nameEn: product.name_en,
    brand: product.brand,
    imageUrl: product.image_url,
    attributes: attrs,
    offers,
    bestPrice,
    savings,
  };
}

// لقائمة المنتجات (نحتاجها للاختبار والفهرسة لاحقاً)
export async function getAllProductSlugs(): Promise<{ slug: string; nameAr: string }[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("canonical_products")
    .select("tps_identity_key, name_ar")
    .eq("category", "mobile")
    .eq("is_active", true);
  return (data ?? []).map((p) => ({
    slug: identityKeyToSlug(p.tps_identity_key ?? ""),
    nameAr: p.name_ar,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// بطاقات الكتالوج — كل ما تحتاجه صفحة /mobiles في استعلامين فقط
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductCard {
  slug: string;
  nameAr: string;
  imageUrl: string | null;
  bestPrice: number | null;
  savings: number | null;
  storesCount: number;
}

export async function getMobileCards(): Promise<ProductCard[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const { data: products } = await supabase
    .from("canonical_products")
    .select("id, name_ar, image_url, tps_identity_key")
    .eq("category", "mobile")
    .eq("is_active", true);

  if (!products || products.length === 0) return [];

  const ids = products.map((p) => p.id);
  const { data: prices } = await supabase
    .from("price_history")
    .select("canonical_product_id, store_name, price, observed_at")
    .in("canonical_product_id", ids)
    .order("observed_at", { ascending: false });

  // آخر سعر لكل (منتج، متجر)
  const latest = new Map<string, Map<string, number>>();
  for (const row of prices ?? []) {
    if (!latest.has(row.canonical_product_id)) latest.set(row.canonical_product_id, new Map());
    const byStore = latest.get(row.canonical_product_id)!;
    if (!byStore.has(row.store_name)) byStore.set(row.store_name, Number(row.price));
  }

  const cards: ProductCard[] = products.map((p) => {
    const byStore = latest.get(p.id) ?? new Map<string, number>();
    const vals = [...byStore.values()];
    const best = vals.length ? Math.min(...vals) : null;
    const worst = vals.length ? Math.max(...vals) : null;
    return {
      slug: identityKeyToSlug(p.tps_identity_key ?? ""),
      nameAr: p.name_ar,
      imageUrl: p.image_url,
      bestPrice: best,
      savings: best !== null && worst !== null && worst > best ? worst - best : null,
      storesCount: byStore.size,
    };
  });

  // الأعلى توفيراً أولاً
  return cards.sort((a, b) => (b.savings ?? 0) - (a.savings ?? 0));
}