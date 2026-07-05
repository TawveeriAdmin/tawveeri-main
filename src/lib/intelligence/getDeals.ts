// src/lib/intelligence/getDeals.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Deal Engine — Knowledge Layer (AI-Native)
// دالة معرفية نقية: تقرأ canonical_products + price_history فقط، صفر كتابة.
// عرض حقيقي = أفضل سعر فعلي حالي أقل من متوسط الفترة بعتبة، أو أقل سعر مسجّل.
// السعر المعتمد: effective_price إن كان رقماً موجباً — وإلا price (الصفر لا يُعتمد).
// المستهلكون المتساوون: /deals، البحث، صفحة المنتج، وفّر، API، أي AI Agent.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { identityKeyToSlug } from "@/lib/catalog/getProductComparison";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const WINDOW_DAYS = 30;
const DEAL_THRESHOLD_PCT = 4;
const MIN_PRICE_POINTS = 2; // منصة فتية — تاريخنا يتعمق تلقائياً وسنرفعها لاحقاً

export type DealStrength = "hot" | "good";

export interface Deal {
  productId: string;
  slug: string;
  compareUrl: string;
  nameAr: string;
  nameEn: string | null;
  brand: string | null;
  imageUrl: string | null;
  bestPrice: number;
  bestStore: string;
  averagePrice: number;
  discountPct: number;
  isLowestEver: boolean;
  trackingDays: number;
  storesCount: number;
  strength: DealStrength;
  reason: string;
}

export async function getDeals(limit = 20, minDiscountPct = DEAL_THRESHOLD_PCT): Promise<Deal[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // 1) الكتالوج النشط
  const { data: products, error: pErr } = await supabase
    .from("canonical_products")
    .select("id, name_ar, name_en, brand, image_url, tps_identity_key")
    .eq("category", "mobile")
    .eq("is_active", true);
  if (pErr || !products?.length) return [];

  // 2) التاريخ السعري للنافذة
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const ids = products.map((p) => p.id);

  const { data: history, error: hErr } = await supabase
    .from("price_history")
    .select("canonical_product_id, store_name, price, effective_price, observed_at")
    .in("canonical_product_id", ids)
    .gte("observed_at", since.toISOString())
    .order("observed_at", { ascending: true });
  if (hErr || !history?.length) return [];

  // 3) تجميع في الذاكرة
  interface Agg { prices: number[]; latestByStore: Map<string, number>; oldest: number; }
  const byProduct = new Map<string, Agg>();
  for (const r of history) {
    const raw = (r as { effective_price?: number | null; price?: number | null });
    const eff = Number(raw.effective_price);
    const base = Number(raw.price);
    // effective_price يُعتمد فقط إن كان رقماً موجباً — الصفر وnull يسقطان لـ price
    const price = Number.isFinite(eff) && eff > 0 ? eff : base;
    if (!Number.isFinite(price) || price <= 0) continue;
    let agg = byProduct.get(r.canonical_product_id);
    if (!agg) {
      agg = { prices: [], latestByStore: new Map(), oldest: new Date(r.observed_at).getTime() };
      byProduct.set(r.canonical_product_id, agg);
    }
    agg.prices.push(price);
    agg.latestByStore.set(r.store_name, price);
  }

  // 4) حساب العروض
  const deals: Deal[] = [];
  for (const p of products) {
    const slug = identityKeyToSlug(p.tps_identity_key ?? "");
    if (!p.tps_identity_key || !slug) continue;

    const agg = byProduct.get(p.id);
    if (!agg || agg.latestByStore.size === 0) continue;
    if (agg.prices.length < MIN_PRICE_POINTS) continue;

    let bestPrice = Infinity;
    let bestStore = "";
    for (const [store, price] of agg.latestByStore) {
      if (price < bestPrice) { bestPrice = price; bestStore = store; }
    }
    if (!Number.isFinite(bestPrice)) continue;

    const average = agg.prices.reduce((a, b) => a + b, 0) / agg.prices.length;
    const lowestEver = Math.min(...agg.prices);
    const discountPct = average > 0 ? ((average - bestPrice) / average) * 100 : 0;
    const isLowestEver = bestPrice <= lowestEver;

    if (!isLowestEver && discountPct < minDiscountPct) continue;

    const trackingDays = Math.max(1, Math.round((Date.now() - agg.oldest) / 86_400_000));
    const roundedPct = Math.round(discountPct);
    const strength: DealStrength = isLowestEver || roundedPct >= 10 ? "hot" : "good";

    const reasonParts: string[] = [];
    if (isLowestEver) reasonParts.push(`أقل سعر مسجّل خلال ${trackingDays} يوماً من التتبع`);
    if (roundedPct >= DEAL_THRESHOLD_PCT) reasonParts.push(`أرخص من متوسط السعر بنسبة ${roundedPct}٪`);
    reasonParts.push(`أفضل سعر لدى ${bestStore}`);

    deals.push({
      productId: p.id,
      slug,
      compareUrl: `/ar/product/${slug}`,
      nameAr: p.name_ar,
      nameEn: p.name_en,
      brand: p.brand,
      imageUrl: p.image_url,
      bestPrice: Math.round(bestPrice),
      bestStore,
      averagePrice: Math.round(average),
      discountPct: roundedPct,
      isLowestEver,
      trackingDays,
      storesCount: agg.latestByStore.size,
      strength,
      reason: reasonParts.join(" · "),
    });
  }

  // 5) الترتيب: hot أولاً، ثم الأعمق خصماً
  deals.sort((a, b) => {
    if (a.strength !== b.strength) return a.strength === "hot" ? -1 : 1;
    return b.discountPct - a.discountPct;
  });

  return deals.slice(0, limit);
}