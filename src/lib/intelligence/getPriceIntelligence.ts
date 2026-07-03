// src/lib/intelligence/getPriceIntelligence.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tawveeri Intelligence Engine — Layer 3
// دالة القراءة الوحيدة لذكاء الأسعار — تُحسب من price_history المتراكم.
// المبدأ: صدق مطلق مع المستخدم — نعرض فقط ما تدعمه البيانات الفعلية.
// Deal Score: مقارنة السعر الحالي بمتوسط الفترة المتاحة (حتى 30 يوماً).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export type DealRating = "excellent" | "good" | "normal" | "high";

export interface PriceIntelligence {
  currentBestPrice: number;
  lowestEver: number;
  highestEver: number;
  average: number;              // متوسط الفترة المتاحة (حتى 30 يوم)
  trackingDays: number;         // كم يوماً نتتبع هذا المنتج (للصدق في العرض)
  pricePoints: number;          // عدد النقاط المسجلة
  isLowestEver: boolean;        // السعر الحالي = أقل سعر مسجّل؟
  diffFromAverage: number;      // % فرق السعر الحالي عن المتوسط (سالب = أرخص)
  trend: "rising" | "falling" | "stable";
  dealRating: DealRating;
  dealText: string;             // نص عربي جاهز للعرض
}

export async function getPriceIntelligence(canonicalProductId: string): Promise<PriceIntelligence | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: rows, error } = await supabase
    .from("price_history")
    .select("price, store_name, observed_at")
    .eq("canonical_product_id", canonicalProductId)
    .gte("observed_at", since.toISOString())
    .order("observed_at", { ascending: true });

  if (error || !rows || rows.length === 0) return null;

  const prices = rows.map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return null;

  // السعر الحالي الأفضل = أقل "آخر سعر" بين المتاجر
  const latestByStore = new Map<string, number>();
  for (const r of rows) latestByStore.set(r.store_name, Number(r.price)); // مرتّب تصاعدياً — الأخير يبقى
  const currentBestPrice = Math.min(...latestByStore.values());

  const lowestEver = Math.min(...prices);
  const highestEver = Math.max(...prices);
  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  const oldest = new Date(rows[0].observed_at).getTime();
  const trackingDays = Math.max(1, Math.round((Date.now() - oldest) / 86_400_000));

  const isLowestEver = currentBestPrice <= lowestEver;
  const diffFromAverage = average > 0 ? Math.round(((currentBestPrice - average) / average) * 100) : 0;

  // الاتجاه: مقارنة متوسط النصف الأخير بالنصف الأول
  let trend: PriceIntelligence["trend"] = "stable";
  if (prices.length >= 4) {
    const mid = Math.floor(prices.length / 2);
    const firstAvg = prices.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondAvg = prices.slice(mid).reduce((a, b) => a + b, 0) / (prices.length - mid);
    const change = (secondAvg - firstAvg) / firstAvg;
    if (change > 0.02) trend = "rising";
    else if (change < -0.02) trend = "falling";
  }

  // Deal Rating
  let dealRating: DealRating;
  let dealText: string;
  if (isLowestEver) {
    dealRating = "excellent";
    dealText = `أقل سعر مسجّل خلال ${trackingDays} يوماً من التتبع 🔥`;
  } else if (diffFromAverage <= -5) {
    dealRating = "good";
    dealText = `أقل من متوسط السعر بنسبة ${Math.abs(diffFromAverage)}٪ — سعر جيد ✅`;
  } else if (diffFromAverage < 5) {
    dealRating = "normal";
    dealText = `قريب من متوسط السعر خلال آخر ${trackingDays} يوماً`;
  } else {
    dealRating = "high";
    dealText = `أعلى من متوسط السعر بنسبة ${diffFromAverage}٪ — قد ينخفض لاحقاً`;
  }

  return {
    currentBestPrice, lowestEver, highestEver, average,
    trackingDays, pricePoints: prices.length,
    isLowestEver, diffFromAverage, trend, dealRating, dealText,
  };
}