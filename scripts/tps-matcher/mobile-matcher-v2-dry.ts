// scripts/tps-matcher/mobile-matcher-v2-dry.ts
// WRITE MODE عبر RPC ذرّية. DRY_RUN=true افتراضياً.
// TIP Module #1 مدمج: Condition جزء من الهوية القانونية (الميثاق — المادة 2).

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { mobilePlugin } from "../tps-plugins/mobile";
import { canonicalizeBrand } from "../tps-core/brand-map";
import { normalizeStoreUrl } from "../../src/lib/catalog/normalizeStoreUrl";
import { adaptStoreRow } from "../tps-core/store-adapters";
import { detectCondition } from "../tps-core/condition-detector";

const DRY_RUN = process.env.DRY_RUN !== "false";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
// Service role only — an anon fallback would return RLS-filtered rows as if complete.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ لا يوجد Supabase في .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

interface RawRow {
  id: number;
  store_name: string | null;
  raw_name: string | null;
  payload: Record<string, unknown> | null;
}

interface Offer {
  observationId: number;
  store: string;
  nameAr: string;
  nameEn: string;
  brandCanonical: string | null;
  price: number | null;
  ram: number | null;
  color: string | null;
  url: string | null;
  image: string | null;
  sku: string | null;
  model: string | null;
  adapterVersion: string;
  normalizedPayload: Record<string, unknown>;
  confidence: number;
  isAccessory: boolean;
  _normId?: string;
}

interface BaseGroup {
  baseKey: string;
  offers: Offer[];
  stores: Set<string>;
}

const PRICE_GAP_THRESHOLD = 1.6;
const ACCESSORY_WORDS = [
  "case", "cover", "protector", "charger", "cable", "earphone",
  "screen protector", "كفر", "غطاء", "واقي", "شاحن", "كابل", "سماعة",
];

const isAccessory = (t: string) =>
  ACCESSORY_WORDS.some((w) => t.toLowerCase().includes(w));

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function extractPrice(p: Record<string, unknown>): number | null {
  for (const c of [p.current_price, p.sellingPrice, p.price, p.wasPrice, p.original_price]) {
    const n = typeof c === "number" ? c : Number(asString(c));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function extractColor(p: Record<string, unknown>): string | null {
  return asString(p.featureArColor) ?? asString(p.color) ?? null;
}

function extractRam(
  nameAr: string,
  nameEn: string,
  p: Record<string, unknown>
): number | null {
  const f = asString(p.featureArMemoryRAMSize);
  if (f) {
    const m = f.match(/(\d+)/);
    if (m) return Number(m[1]);
  }

  const text = `${nameAr} ${nameEn}`.toLowerCase();

  const plus = text.match(/(\d+)\s*\+\s*\d+/);
  if (plus) return Number(plus[1]);

  const ramAr = text.match(/رام\s*(\d+)|(\d+)\s*(?:جيجا\s*)?رام/);
  if (ramAr) return Number(ramAr[1] ?? ramAr[2]);

  const ramEn = text.match(/(\d+)\s*gb\s*ram|ram\s*(\d+)/);
  if (ramEn) return Number(ramEn[1] ?? ramEn[2]);

  return null;
}

function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16),
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

const BRAND_AR: Record<string, string> = {
  apple: "آبل", samsung: "سامسونج", huawei: "هواوي", xiaomi: "شاومي",
  honor: "هونر", oppo: "أوبو", vivo: "فيفو", realme: "ريلمي",
  nokia: "نوكيا", google: "قوقل", oneplus: "ون بلس", motorola: "موتورولا",
  tecno: "تكنو", infinix: "إنفينكس", hmd: "إتش إم دي",
};

const FAMILY_AR: Record<string, string> = {
  iPhone: "آيفون",
  "Galaxy S": "جالاكسي",
  "Galaxy A": "جالاكسي",
  "Galaxy Z": "جالاكسي زد",
  "Galaxy Note": "جالاكسي نوت",
};

const VARIANT_AR: Record<string, string> = {
  "Pro Max": "برو ماكس",
  Pro: "برو",
  Plus: "بلس",
  Ultra: "ألترا",
  FE: "إف إي",
  Standard: "",
};

// ═══ TIP: أجزاء الهوية الخاصة — نبحث عنها بالمحتوى لا بالموضع ═══
const CONDITION_AR: Record<string, string> = {
  "renewed": "مجدد",
  "renewed-premium": "مجدد بريميوم",
  "renewed-a": "مجدد درجة أ",
  "renewed-b": "مجدد درجة ب",
  "renewed-c": "مجدد درجة ج",
  "refurbished": "مُصلَح مصنعياً",
  "open-box": "علبة مفتوحة",
  "used": "مستعمل",
};

const CONDITION_EN: Record<string, string> = {
  "renewed": "Renewed",
  "renewed-premium": "Renewed Premium",
  "renewed-a": "Renewed Grade A",
  "renewed-b": "Renewed Grade B",
  "renewed-c": "Renewed Grade C",
  "refurbished": "Refurbished",
  "open-box": "Open Box",
  "used": "Used",
};

function findRamPart(parts: string[]): string | null {
  return parts.find((p) => p.startsWith("ram=")) ?? null;
}

function findConditionPart(parts: string[]): string | null {
  return parts.find((p) => p in CONDITION_AR) ?? null;
}

function buildCanonicalNameAr(parts: string[]): string {
  const [brand, family, gen, variant, storage] = parts;
  const brandAr = BRAND_AR[brand] ?? brand;
  const familyAr = FAMILY_AR[family] ?? family;
  const variantAr = VARIANT_AR[variant] ?? variant;

  const ramRaw = findRamPart(parts);
  const ramPart = ramRaw ? ` رام ${ramRaw.replace("ram=", "")} جيجا` : "";

  const condRaw = findConditionPart(parts);
  const condPart = condRaw ? ` — ${CONDITION_AR[condRaw]}` : "";

  return `${brandAr} ${familyAr} ${gen} ${variantAr} ${storage} جيجابايت${ramPart}${condPart}`
    .replace(/\s+/g, " ")
    .trim();
}

function buildCanonicalNameEn(parts: string[]): string {
  const [brand, family, gen, variant, storage] = parts;
  const brandEn = brand.charAt(0).toUpperCase() + brand.slice(1);
  const variantClean = variant === "Standard" ? "" : `${variant} `;

  const ramRaw = findRamPart(parts);
  const ramPart = ramRaw ? ` ${ramRaw.replace("ram=", "")}GB RAM` : "";

  const condRaw = findConditionPart(parts);
  const condPart = condRaw ? ` (${CONDITION_EN[condRaw]})` : "";

  return `${brandEn} ${family} ${gen} ${variantClean}${storage}GB${ramPart}${condPart}`
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchMobiles(limit: number): Promise<RawRow[]> {
  const kw = ["ايفون", "آيفون", "iphone", "جالاكسي", "galaxy"];
  const f = (k: string[]) => k.map((x) => `raw_name.ilike.%${x}%`).join(",");

  const { data: a, error: e1 } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", "المنيع")
    .or(f(kw))
    .order("id", { ascending: true })
    .limit(limit);

  if (e1) {
    console.error("❌ المنيع:", e1.message);
    process.exit(1);
  }

  const extraRows: RawRow[] = [];
  const PAGE = 500;

  for (let from = 0; from < 30000; from += PAGE) {
    const { data: page, error } = await supabase
      .from("raw_observations")
      .select("id, store_name, raw_name, payload")
      .eq("store_name", "اكسترا")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("❌ إكسترا:", error.message);
      process.exit(1);
    }

    if (!page || page.length === 0) break;

    for (const row of page) {
      const rawCat = (row.payload as any)?.category;
      let cats: string[] = [];

      if (Array.isArray(rawCat)) cats = rawCat.map(String);
      else if (typeof rawCat === "string") {
        try {
          const pp = JSON.parse(rawCat);
          cats = Array.isArray(pp) ? pp.map(String) : [rawCat];
        } catch {
          cats = [rawCat];
        }
      }

      if (cats.some((c) => c.trim() === "Mobiles")) {
        extraRows.push(row as RawRow);
      }
    }

    // E6 bounded-batch guarantee: make إكسترا respect `limit` like the other
    // three stores, so a run cannot exceed 4 * limit observations (provable bound).
    if (extraRows.length >= limit) break;
    if (page.length < PAGE) break;
  }

  const { data: j, error: e3 } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", "جرير")
    .or(f(kw))
    .order("id", { ascending: true })
    .limit(limit);

  if (e3) {
    console.error("❌ جرير:", e3.message);
    process.exit(1);
  }

  const { data: az, error: e4 } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", "أمازون")
    .or(f(kw))
    .order("id", { ascending: true })
    .limit(limit);

  if (e4) {
    console.error("❌ أمازون:", e4.message);
    process.exit(1);
  }

  console.log(
    `   المنيع: ${(a ?? []).length} | إكسترا (Mobiles): ${extraRows.length} | جرير: ${(j ?? []).length} | أمازون: ${(az ?? []).length}`
  );

  return [...(a ?? []), ...extraRows.slice(0, limit), ...(j ?? []), ...(az ?? [])] as RawRow[];
}

function priceGapRatio(offers: Offer[]): number | null {
  const pr = offers.map((o) => o.price).filter((p): p is number => p !== null);
  if (pr.length < 2) return null;
  const min = Math.min(...pr);
  const max = Math.max(...pr);
  return min > 0 ? max / min : null;
}

function resolveRam(g: BaseGroup): { addToKey: number | null; ramValues: number[] } {
  const byStore = new Map<string, Set<number>>();

  for (const o of g.offers) {
    if (o.ram === null) continue;
    if (!byStore.has(o.store)) byStore.set(o.store, new Set());
    byStore.get(o.store)!.add(o.ram);
  }

  const all = [
    ...new Set(g.offers.map((o) => o.ram).filter((r): r is number => r !== null)),
  ];

  const everyStoreHasRam = [...g.stores].every((s) => byStore.has(s));

  if (everyStoreHasRam && all.length === 1) {
    return { addToKey: all[0], ramValues: all };
  }

  return { addToKey: null, ramValues: all };
}

async function main() {
  const LIMIT = Number(process.env.MATCHER_LIMIT || 1000);
  const now = new Date().toISOString();

  console.log("═".repeat(72));
  console.log(`MATCHER v2 — WRITE  [DRY_RUN=${DRY_RUN}]  (TIP: Condition-in-Identity)`);
  console.log(DRY_RUN ? "⚠️ محاكاة — لا كتابة." : "🔴 كتابة فعلية.");
  console.log("═".repeat(72));

  const rows = await fetchMobiles(LIMIT);
  console.log(`\nجُلب ${rows.length} صفاً.\n`);

  const baseGroups = new Map<string, BaseGroup>();
  let renewedCount = 0;

  for (const row of rows) {
    const store = row.store_name ?? "?";
    const p = (row.payload ?? {}) as Record<string, unknown>;

    const adapted = adaptStoreRow(store, p, row.raw_name);
    if (!adapted) continue;
    if (!adapted.isCompleteVariant) continue;

    // ═══ TIP Module #1: الحالة جزء من الهوية — المجدد ليس هو الجديد ═══
    const cond = detectCondition(adapted.nameAr, adapted.nameEn, adapted.model);
    if (!cond.isNew) renewedCount++;

    const { nameAr, nameEn, brand } = adapted;

    if (!mobilePlugin.detect(nameAr, nameEn)) continue;

    const norm = mobilePlugin.normalize(nameAr, nameEn, brand);
    const cb = canonicalizeBrand(brand);
    const identity = mobilePlugin.buildIdentityKey(cb, norm.payload, {});

    if (identity.status !== "valid" || !identity.key) continue;

    // الحالة تُلحق بالمفتاح: الجديد suffix فارغ (المفاتيح الحالية لا تتغير)
    const groupKey = identity.key + cond.identitySuffix;

    const ram = cb === "apple" ? null : extractRam(nameAr, nameEn, p);
    const conf = mobilePlugin.scoreConfidence(
      brand,
      norm.payload,
      norm.model_number,
      norm.ambiguity_flags ?? []
    );

    if (!baseGroups.has(groupKey)) {
      baseGroups.set(groupKey, {
        baseKey: groupKey,
        offers: [],
        stores: new Set(),
      });
    }

    const g = baseGroups.get(groupKey)!;
    const offerUrl = normalizeStoreUrl(store, adapted.url);
    const offerImage = adapted.image;

    g.offers.push({
      observationId: row.id,
      store,
      nameAr,
      nameEn,
      brandCanonical: cb,
      price: adapted.price ?? extractPrice(p),
      ram,
      color: extractColor(p),
      url: offerUrl,
      image: offerImage,
      sku: adapted.sku,
      model: adapted.model,
      adapterVersion: adapted.adapterVersion,
      normalizedPayload: norm.payload,
      confidence: typeof conf === "number" ? conf : 90,
      isAccessory: isAccessory(nameAr || nameEn),
    });

    g.stores.add(store);
  }

  console.log(`ℹ️ صفوف بحالة غير جديدة (مجدد/مستعمل/...): ${renewedCount}\n`);

  interface FG {
    key: string;
    offers: Offer[];
    stores: Set<string>;
    ramValues: number[];
    ramInKey: boolean;
  }

  const clean: FG[] = [];

  for (const g of baseGroups.values()) {
    const { addToKey, ramValues } = resolveRam(g);
    const key = addToKey !== null ? `${g.baseKey}|ram=${addToKey}` : g.baseKey;

    if (g.stores.size < 2) continue;
    if (g.offers.some((o) => o.isAccessory)) continue;

    const ratio = priceGapRatio(g.offers);
    if (ratio !== null && ratio > PRICE_GAP_THRESHOLD) continue;

    clean.push({
      key,
      offers: g.offers,
      stores: g.stores,
      ramValues,
      ramInKey: addToKey !== null,
    });
  }

  console.log(`✅ منتجات نظيفة: ${clean.length}\n`);
  const canonicalRows: any[] = [];
  const normalizedRows: any[] = [];
  const matchRows: any[] = [];
  const priceRows: any[] = [];
  const canonicalIds: string[] = [];
  // Phase 3: track only the observations actually canonicalized in this batch,
  // so we mark exactly those 'processed' after a successful atomic write.
  const processedObsIds = new Set<number>();

  for (const g of clean) {
    const parts = g.key.split("|");
    const canonicalId = stableUuid(`canonical:${g.key}`);
    canonicalIds.push(canonicalId);

    const nameAr = buildCanonicalNameAr(parts);
    const nameEn = buildCanonicalNameEn(parts);

    const withImage = g.offers
      .filter((o) => o.image !== null && o.price !== null)
      .sort((a, b) => a.price! - b.price!);

    const canonicalImage = withImage.length
      ? withImage[0].image
      : g.offers.find((o) => o.image)?.image ?? null;

    canonicalRows.push({
      id: canonicalId, name_ar: nameAr, name_en: nameEn, brand: parts[0],
      model_number: null, category: "mobile", image_url: canonicalImage,
      attributes: {
        family: parts[1], generation: parts[2], variant: parts[3],
        storage: parts[4], ram_in_key: g.ramInKey, ram: g.ramInKey ? g.ramValues[0] : null,
        ram_values: g.ramValues, identity_key: g.key, stores: [...g.stores],
        offers_count: g.offers.length,
        colors: [...new Set(g.offers.map((o) => o.color).filter(Boolean))],
        parser_version: "mobile-v1",
      },
      is_active: true, tps_identity_key: g.key, tps_version: "mobile-v1",
      variant_key: g.key, identity_confidence: 95, data_quality_score: 90,
      created_at: now, data_updated_at: now,
    });

    for (const o of g.offers) {
      const normId = stableUuid(`norm:raw_observations:${o.observationId}`);
      o._normId = normId;
      processedObsIds.add(o.observationId);
      normalizedRows.push({
        id: normId, source_table: "raw_observations",
        source_record_id: stableUuid(`raw_observations:${o.observationId}`),
        store_id: o.store, canonical_product_id: canonicalId,
        raw_name: o.nameAr || o.nameEn, detected_category: "mobile",
        language: o.nameAr ? "ar" : "en", brand: o.brandCanonical,
        model_number: o.model, color: o.color, identity_key: g.key,
        identity_key_status: "valid",
        normalized_payload: {
          ...(o.normalizedPayload ?? {}), _raw_id: o.observationId,
          _url: o.url, _image: o.image, _sku: o.sku,
          _model: o.model, _adapter_version: o.adapterVersion,
        },
        confidence: o.confidence, missing_critical: [], ambiguity_flags: [],
        needs_llm: false, ignored_terms: [], normalizer_version: "mobile-v1",
        tps_version: "mobile-v1", observed_at: now, plugin_version: "mobile-v1",
      });
    }

    for (const store of g.stores) {
      const so = g.offers.filter((o) => o.store === store);
      const priced = so.filter((o) => o.price !== null);
      const rep = priced.length ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)) : so[0];

      matchRows.push({
        raw_observation_id: rep._normId, canonical_product_id: canonicalId,
        match_method: "tps_identity_key", confidence: 95, is_verified: false,
        matched_at: now, identity_resolution_event_id: null,
      });

      if (priced.length) {
        priceRows.push({
          canonical_product_id: canonicalId, store_name: store,
          price: rep.price, tps_observation_id: rep._normId, observed_at: now,
        });
      }
    }
  } // نهاية الحلقة الرئيسية

  const lastPriceMap = new Map<string, number>();
  if (canonicalIds.length) {
    const { data: history, error } = await supabase.from("price_history")
      .select("canonical_product_id, store_name, price, observed_at")
      .in("canonical_product_id", canonicalIds)
      .order("observed_at", { ascending: false });

    if (error) { console.error("❌ جلب الأسعار:", error.message); process.exit(1); }
    for (const h of history ?? []) {
      const k = `${h.canonical_product_id}|${h.store_name}`;
      if (!lastPriceMap.has(k)) lastPriceMap.set(k, Number(h.price));
    }
  }

  const changedPrices = priceRows.filter((pr) => {
    const last = lastPriceMap.get(`${pr.canonical_product_id}|${pr.store_name}`);
    return last === undefined || last !== Number(pr.price);
  });

  console.log(
    `📦 canonical=${canonicalRows.length} | normalized=${normalizedRows.length} | matches=${matchRows.length} | price(متغيّر)=${changedPrices.length}/${priceRows.length}\n`
  );

  if (DRY_RUN) {
    console.log("⚠️ DRY_RUN — لم تُكتب أي بيانات.");
    if (process.env.DUMP_IDS) {
      require("fs").writeFileSync(process.env.DUMP_IDS, JSON.stringify({
        canonicalIds,
        canonicalSummary: canonicalRows.map((c) => ({ id: c.id, name_ar: c.name_ar, stores: (c.attributes as any).stores, key: c.tps_identity_key })),
        normalizedIds: normalizedRows.map((n) => n.id),
        changedPrices: changedPrices.map((p) => ({ canonical: p.canonical_product_id, store: p.store_name, price: p.price })),
      }, null, 2));
      console.log(`📝 dumped ${canonicalIds.length} candidate IDs -> ${process.env.DUMP_IDS}`);
    }
    return;
  }

  const { data: result, error: rpcError } = await supabase.rpc("write_mobile_batch", {
    p_canonical: canonicalRows, p_normalized: normalizedRows,
    p_matches: matchRows, p_prices: changedPrices, p_canonical_ids: canonicalIds,
  });

  if (rpcError) { console.error("❌ فشل:", rpcError.message); process.exit(1); }
  console.log("✅ اكتملت الكتابة بنجاح:", result);

  // Phase 3: mark ONLY the committed observations 'done' — after the atomic
  // write succeeded. Status vocabulary is the schema's check constraint:
  // pending | processing | done | failed | skipped. A failed write exits above,
  // leaving observations 'pending'. Never touches the wider backlog; idempotent.
  const obsIds = [...processedObsIds];
  let marked = 0;
  for (let i = 0; i < obsIds.length; i += 200) {
    const chunk = obsIds.slice(i, i + 200);
    const { error: stErr } = await supabase
      .from("raw_observations")
      .update({ processing_status: "done" })
      .in("id", chunk);
    if (stErr) { console.error("⚠️ status update failed:", stErr.message); break; }
    marked += chunk.length;
  }
  console.log(`🏷️ marked ${marked}/${obsIds.length} observations done.`);
}

main().catch((e) => {
  console.error("❌ فشل غير متوقع:", e);
  process.exit(1);
});