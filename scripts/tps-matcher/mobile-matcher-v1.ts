// scripts/tps-matcher/mobile-matcher-v2-dry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Product Matcher v2 — DRY WRITE PLAN — READ ONLY
// يخطط للمسار الرباعي الصحيح المطابق للـ FKs 100%:
//   1. normalized_product_observations  (الجسر Layer 1)
//   2. canonical_products               (Layer 2)
//   3. product_matches                  (يربط 1→2 عبر uuid)
//   4. price_history                    (عبر tps_observation_id uuid)
// ❌ صفر كتابة DB. يطبع ما سيُكتب فقط.
// run: npx tsx scripts/tps-matcher/mobile-matcher-v2-dry.ts
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { mobilePlugin } from "../tps-plugins/mobile";
import { canonicalizeBrand } from "../tps-core/brand-map";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
// Service role only — an anon fallback would return RLS-filtered rows as if complete.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ لم أجد بيانات Supabase في .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ⚠️ id نوعه uuid (string) — تصحيح نهائي من number
interface RawRow {
  id: string;
  store_name: string | null;
  raw_name: string | null;
  payload: Record<string, unknown> | null;
}

interface Offer {
  observationId: string;   // uuid
  store: string;
  nameAr: string;
  nameEn: string;
  brandRaw: string | null;
  brandCanonical: string;
  price: number | null;
  color: string | null;
  normalizedPayload: any;
  identityKey: string;
  confidence: number;
  isAccessory: boolean;
}

interface IdentityGroup {
  key: string;
  offers: Offer[];
  stores: Set<string>;
}

const PRICE_GAP_THRESHOLD = 1.6;
const ACCESSORY_WORDS = [
  "case", "cover", "protector", "charger", "cable", "earphone",
  "screen protector", "كفر", "غطاء", "واقي", "شاحن", "كابل", "سماعة",
];
const isAccessory = (t: string) => ACCESSORY_WORDS.some((w) => t.toLowerCase().includes(w));

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
function extractBrand(v: unknown): string | null {
  if (Array.isArray(v)) return asString(v[0]);
  const s = asString(v);
  if (!s) return null;
  if (s.startsWith("[")) {
    try { const arr = JSON.parse(s); if (Array.isArray(arr) && arr.length) return asString(arr[0]); } catch {}
  }
  return s;
}
function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.sellingPrice, p.price, p.wasPrice]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}
function extractColor(p: Record<string, unknown>): string | null {
  return asString(p.featureArColor) ?? asString(p.color) ?? null;
}
function adaptRow(row: RawRow) {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const isExtra = row.store_name === "اكسترا";
  const brand = isExtra
    ? (extractBrand(p.brandEn) ?? extractBrand(p.brand) ?? null)
    : (extractBrand(p.brand) ?? extractBrand(p.brandEn) ?? extractBrand(p.brandAr) ?? null);
  const nameAr = isExtra ? "" : (asString(p.nameAr) ?? asString(p.name) ?? asString(row.raw_name) ?? "");
  const nameEn = isExtra ? (asString(p.nameEn) ?? asString(p.title) ?? asString(row.raw_name) ?? "") : "";
  return { nameAr, nameEn, brand };
}

async function fetchMobiles(limitPerStore: number): Promise<RawRow[]> {
  const kw = ["ايفون", "آيفون", "iphone", "جالاكسي", "galaxy"];
  const f = (k: string[]) => k.map((x) => `raw_name.ilike.%${x}%`).join(",");
  const { data: almanea, error: e1 } = await supabase
    .from("raw_observations").select("id, store_name, raw_name, payload")
    .eq("store_name", "المنيع").or(f(kw)).limit(limitPerStore);
  if (e1) { console.error("❌ المنيع:", e1.message); process.exit(1); }
  const { data: extra, error: e2 } = await supabase
    .from("raw_observations").select("id, store_name, raw_name, payload")
    .eq("store_name", "اكسترا").filter("payload->category", "cs", '["Mobiles"]').limit(limitPerStore);
  if (e2) { console.error("❌ إكسترا:", e2.message); process.exit(1); }
  return [...(almanea ?? []), ...(extra ?? [])] as RawRow[];
}

function priceGapRatio(offers: Offer[]): number | null {
  const prices = offers.map((o) => o.price).filter((p): p is number => p !== null);
  if (prices.length < 2) return null;
  const min = Math.min(...prices), max = Math.max(...prices);
  return min > 0 ? max / min : null;
}

async function main() {
  const LIMIT = Number(process.env.MATCHER_LIMIT || 1000);
  const now = new Date().toISOString();

  console.log("═".repeat(72));
  console.log("MATCHER v2 — DRY WRITE PLAN — لا كتابة DB");
  console.log("مسار: raw → normalized → canonical → matches → price");
  console.log("═".repeat(72));

  const rows = await fetchMobiles(LIMIT);
  console.log(`\nجُلب ${rows.length} صفاً.\n`);

  // التجميع
  const groups = new Map<string, IdentityGroup>();
  for (const row of rows) {
    const store = row.store_name ?? "?";
    const p = (row.payload ?? {}) as Record<string, unknown>;
    const { nameAr, nameEn, brand } = adaptRow(row);
    if (!mobilePlugin.detect(nameAr, nameEn)) continue;
    const norm = mobilePlugin.normalize(nameAr, nameEn, brand);
    const canonicalBrand = canonicalizeBrand(brand);
    const identity = mobilePlugin.buildIdentityKey(canonicalBrand, norm.payload, {});
    if (identity.status !== "valid" || !identity.key) continue;
    const conf = mobilePlugin.scoreConfidence(brand, norm.payload, norm.model_number, norm.ambiguity_flags ?? []);
    const displayName = nameAr || nameEn;

    if (!groups.has(identity.key)) groups.set(identity.key, { key: identity.key, offers: [], stores: new Set() });
    const g = groups.get(identity.key)!;
    g.offers.push({
      observationId: row.id,
      store,
      nameAr, nameEn,
      brandRaw: brand,
      brandCanonical: canonicalBrand,
      price: extractPrice(p),
      color: extractColor(p),
      normalizedPayload: norm.payload,
      identityKey: identity.key,
      confidence: typeof conf === "number" ? conf : 90,
      isAccessory: isAccessory(displayName),
    });
    g.stores.add(store);
  }

  // تصفية: multi_store النظيفة فقط
  const clean: IdentityGroup[] = [];
  for (const g of groups.values()) {
    if (g.stores.size < 2) continue;
    if (g.offers.some((o) => o.isAccessory)) continue;
    const ratio = priceGapRatio(g.offers);
    if (ratio !== null && ratio > PRICE_GAP_THRESHOLD) continue;
    clean.push(g);
  }

  console.log(`✅ منتجات نظيفة ستُكتب: ${clean.length}\n`);

  // ── بناء الخطة الرباعية (في الذاكرة) ──
  const normalizedPlan: any[] = [];
  const canonicalPlan: any[] = [];
  const matchesPlan: any[] = [];
  const pricePlan: any[] = [];

  for (const g of clean) {
    const canonicalId = randomUUID();
    const parts = g.key.split("|"); // brand|family|generation|variant|storage

    // اختَر ممثلاً للاسم: أول عرض من المنيع (عربي) وأول من إكسترا (إنجليزي)
    const arOffer = g.offers.find((o) => o.nameAr);
    const enOffer = g.offers.find((o) => o.nameEn);

    // 1) canonical_products
    canonicalPlan.push({
      id: canonicalId,
      name_ar: arOffer?.nameAr ?? enOffer?.nameEn ?? g.key,
      name_en: enOffer?.nameEn ?? null,
      brand: parts[0] ?? null,
      model_number: null,
      category: "mobile",
      attributes: {
        family: parts[1] ?? null,
        generation: parts[2] ?? null,
        variant: parts[3] ?? null,
        storage: parts[4] ?? null,
        identity_key: g.key,
        stores: [...g.stores],
        offers: g.offers.length,
        colors: [...new Set(g.offers.map((o) => o.color).filter(Boolean))],
        parser_version: "mobile-v1",
      },
      is_active: true,
      tps_identity_key: g.key,
      tps_version: "mobile-v1",
      variant_key: g.key,
      identity_confidence: 95,   // ضمن CHECK (نتأكد قبل write)
      data_quality_score: 90,    // ضمن CHECK (نتأكد قبل write)
      created_at: now,
      data_updated_at: now,
    });

    // 2) normalized_product_observations — صف لكل عرض (الجسر)
    for (const o of g.offers) {
      const normId = randomUUID();
      o["_normId"] = normId; // نربطه لاحقاً في matches
      normalizedPlan.push({
        id: normId,
        source_table: "raw_observations",
        source_record_id: o.observationId,   // uuid ✅
        store_id: o.store,
        canonical_product_id: canonicalId,
        raw_name: o.nameAr || o.nameEn,
        detected_category: "mobile",
        language: o.nameAr ? "ar" : "en",
        brand: o.brandCanonical,
        model_number: null,
        color: o.color,
        identity_key: g.key,
        identity_key_status: "valid",
        normalized_payload: o.normalizedPayload ?? {},
        confidence: o.confidence,
        missing_critical: [],
        ambiguity_flags: [],
        needs_llm: false,
        ignored_terms: [],
        normalizer_version: "mobile-v1",
        tps_version: "mobile-v1",
        observed_at: now,
        plugin_version: "mobile-v1",
      });
    }

    // 3) product_matches — يربط canonical بصف normalized (uuid ✅)
    for (const o of g.offers) {
      matchesPlan.push({
        raw_observation_id: o["_normId"],   // → normalized_product_observations.id
        canonical_product_id: canonicalId,
        match_method: "tps_identity_key",
        confidence: 95,
        is_verified: false,
        matched_at: now,
        identity_resolution_event_id: null,
      });
    }

    // 4) price_history — أقل سعر لكل (canonical + store)، عبر tps_observation_id
    for (const store of g.stores) {
      const storeOffers = g.offers.filter((o) => o.store === store);
      const priced = storeOffers.filter((o) => o.price !== null);
      if (priced.length === 0) continue;
      const cheapest = priced.reduce((a, b) => (a.price! <= b.price! ? a : b));
      pricePlan.push({
        canonical_product_id: canonicalId,
        store_name: store,
        price: cheapest.price,
        tps_observation_id: cheapest["_normId"],  // uuid ✅
        raw_observation_id: null,                  // bigint FK لا يطابقنا — نتركه
        observed_at: now,
      });
    }
  }

  // ── طباعة الخطة ──
  console.log("─".repeat(72));
  console.log(`① normalized_product_observations — ${normalizedPlan.length} صف (الجسر)`);
  console.log(`② canonical_products — ${canonicalPlan.length} صف`);
  console.log(`③ product_matches — ${matchesPlan.length} صف`);
  console.log(`④ price_history — ${pricePlan.length} صف`);
  console.log("─".repeat(72));

  canonicalPlan.forEach((c) => {
    console.log(`\n★ ${c.tps_identity_key}`);
    console.log(`   name_ar: ${c.name_ar.slice(0, 45)}`);
    console.log(`   name_en: ${(c.name_en ?? "—").slice(0, 45)}`);
    console.log(`   brand=${c.brand} | attributes.storage=${c.attributes.storage} | colors=${c.attributes.colors.length}`);
    const myPrices = pricePlan.filter((ph) => ph.canonical_product_id === c.id);
    myPrices.forEach((ph) => console.log(`   💰 ${ph.store_name}: ${ph.price} ريال`));
  });

  console.log("\n" + "═".repeat(72));
  console.log("⑤ ملخص خطة الكتابة");
  console.log(`   normalized_product_observations : ${normalizedPlan.length}`);
  console.log(`   canonical_products              : ${canonicalPlan.length}`);
  console.log(`   product_matches                 : ${matchesPlan.length}`);
  console.log(`   price_history                   : ${pricePlan.length}`);
  console.log(`   ⚠️ DRY — لم تُكتب أي بيانات. راجع قبل v2-write.`);
  console.log("═".repeat(72));
}

main().catch((e) => { console.error("❌ فشل غير متوقع:", e); process.exit(1); });