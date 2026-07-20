// scripts/tps-dry-run/mobile-dry-run.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mobile Dry Run — READ ONLY
// ❌ لا كتابة DB  ❌ لا تعديل plugin  ❌ لا Matcher
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
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

interface RawRow {
  id: number;
  store_name: string | null;
  raw_name: string | null;
  payload: Record<string, unknown> | null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function extractBrand(v: unknown): string | null {
  if (Array.isArray(v)) return asString(v[0]);
  const s = asString(v);
  if (!s) return null;
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length) return asString(arr[0]);
    } catch { /* تجاهل */ }
  }
  return s;
}

function adaptRow(row: RawRow): { nameAr: string; nameEn: string; brand: string | null } {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const isExtra = row.store_name === "اكسترا";

  const brand = isExtra
    ? (extractBrand(p.brandEn) ?? extractBrand(p.brand) ?? null)
    : (extractBrand(p.brand) ?? extractBrand(p.brandEn) ?? extractBrand(p.brandAr) ?? null);

  if (isExtra) {
    const nameEn =
      asString(p.nameEn) ?? asString(p.title) ?? asString(row.raw_name) ?? "";
    return { nameAr: "", nameEn, brand };
  } else {
    const nameAr =
      asString(p.nameAr) ?? asString(p.name) ?? asString(row.raw_name) ?? "";
    return { nameAr, nameEn: "", brand };
  }
}

async function fetchMobiles(limitPerStore: number): Promise<RawRow[]> {
  const mobileKeywords = ["ايفون", "آيفون", "iphone", "جالاكسي", "galaxy"];
  const buildFilter = (keywords: string[]) =>
    keywords.map((k) => `raw_name.ilike.%${k}%`).join(",");

  // ── المنيع: فلتر على raw_name بالكلمات المفتاحية ──
  const { data: almanea, error: e1 } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", "المنيع")
    .or(buildFilter(mobileKeywords))
    .limit(limitPerStore);
  if (e1) { console.error("❌ المنيع:", e1.message); process.exit(1); }

  // ── إكسترا: فلتر مباشر على payload->category في PostgreSQL ──
  const { data: extra, error: e2 } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", "اكسترا")
    .filter("payload->category", "cs", '["Mobiles"]')
    .limit(limitPerStore);
  if (e2) { console.error("❌ إكسترا:", e2.message); process.exit(1); }

  console.log(
    `   المنيع: ${(almanea ?? []).length} | إكسترا (category=Mobiles): ${(extra ?? []).length}`
  );
  return [...(almanea ?? []), ...(extra ?? [])] as RawRow[];
}

async function main() {
  const LIMIT = Number(process.env.DRY_RUN_LIMIT || 1000);

  console.log("═".repeat(72));
  console.log("MOBILE DRY RUN — READ ONLY");
  console.log(`Plugin: ${mobilePlugin.category} v${mobilePlugin.version}`);
  console.log("═".repeat(72));

  const rows = await fetchMobiles(LIMIT);
  console.log(`\nجُلب ${rows.length} صفاً مرشحاً للجوالات (read-only).\n`);

  let detected = 0;
  let notDetected = 0;
  const statusCount: Record<string, number> = { valid: 0, invalid: 0 };
  const invalidReasons: Record<string, number> = {};
  const byStore: Record<string, { detected: number; valid: number }> = {};
  const keyGroups: Record<string, { stores: Set<string>; samples: string[] }> = {};
  const sampleKeys: string[] = [];

  for (const row of rows) {
    const store = row.store_name ?? "?";
    byStore[store] ??= { detected: 0, valid: 0 };

    const { nameAr, nameEn, brand } = adaptRow(row);

    if (!mobilePlugin.detect(nameAr, nameEn)) {
      notDetected++;
      continue;
    }
    detected++;
    byStore[store].detected++;

    const norm = mobilePlugin.normalize(nameAr, nameEn, brand);
    const canonicalBrand = canonicalizeBrand(brand);
    const identity = mobilePlugin.buildIdentityKey(canonicalBrand, norm.payload, {});
    mobilePlugin.scoreConfidence(
      brand,
      norm.payload,
      norm.model_number,
      norm.ambiguity_flags ?? []
    );

    statusCount[identity.status] = (statusCount[identity.status] ?? 0) + 1;

    if (identity.status === "invalid") {
      const r = identity.reason ?? "unknown";
      invalidReasons[r] = (invalidReasons[r] ?? 0) + 1;
    }
    if (identity.status === "valid") byStore[store].valid++;

    if (identity.key) {
      keyGroups[identity.key] ??= { stores: new Set(), samples: [] };
      keyGroups[identity.key].stores.add(store);
      if (keyGroups[identity.key].samples.length < 5) {
        keyGroups[identity.key].samples.push(
          `${store}: ${(nameAr || nameEn).slice(0, 55)}`
        );
      }
      if (sampleKeys.length < 12) sampleKeys.push(`[${store}] ${identity.key}`);
    }
  }

  console.log("─".repeat(72));
  console.log("① الكشف (detect)");
  console.log(`   جوال فعلي:  ${detected}`);
  console.log(`   مُستبعَد:    ${notDetected}`);

  console.log("\n② حالة الهوية");
  const tot = detected || 1;
  for (const [st, n] of Object.entries(statusCount)) {
    console.log(`   ${st.padEnd(10)} ${String(n).padStart(5)}  (${((n / tot) * 100).toFixed(1)}%)`);
  }

  if (Object.keys(invalidReasons).length) {
    console.log("\n③ أسباب invalid (الأكثر)");
    Object.entries(invalidReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([r, n]) => console.log(`   ${String(n).padStart(4)} × ${r}`));
  }

  console.log("\n④ حسب المتجر");
  for (const [st, c] of Object.entries(byStore)) {
    console.log(
      `   ${st.padEnd(10)} detected=${String(c.detected).padStart(4)}  valid=${String(c.valid).padStart(4)}`
    );
  }

  console.log("\n⑤ عيّنة مفاتيح");
  sampleKeys.forEach((k) => console.log(`   ${k}`));

  // ─── القسم ⑥ ───
  const ACCESSORY_WORDS = [
    "case", "cover", "protector", "charger", "cable", "earphone",
    "screen protector", "كفر", "غطاء", "واقي", "شاحن", "كابل", "سماعة",
  ];
  const isAccessory = (t: string) =>
    ACCESSORY_WORDS.some((w) => t.toLowerCase().includes(w));

  console.log("\n" + "─".repeat(72));
  console.log("⑥ ★ التطابق متعدد المتاجر (نفس المفتاح من متجرين+)");
  const multiStore = Object.entries(keyGroups).filter(([, g]) => g.stores.size >= 2);
  if (multiStore.length === 0) {
    console.log("   لا يوجد تطابق متعدد المتاجر في هذه العيّنة.");
  } else {
    console.log(`   وُجد ${multiStore.length} منتجاً مشتركاً بين متجرين+! ✅✅\n`);
    multiStore.forEach(([key, g]) => {
      const hasAccessory = g.samples.some(isAccessory);
      console.log(`   ★ ${key}${hasAccessory ? "  ⚠️ POSSIBLE ACCESSORY" : ""}`);
      console.log(`     المتاجر: ${[...g.stores].join(" / ")}`);
      g.samples.forEach((s) => {
        console.log(`     - ${s}${isAccessory(s) ? " ← ⚠️" : ""}`);
      });
      console.log("");
    });
  }

  const sameStoreDup = Object.entries(keyGroups).filter(
    ([, g]) => g.stores.size === 1 && g.samples.length >= 2
  );
  console.log("─".repeat(72));
  console.log(
    `⑦ (مراقبة) مفاتيح بنفس المتجر لها 2+ منتج (ألوان غالباً): ${sameStoreDup.length}`
  );

  console.log("═".repeat(72));
  console.log("انتهى Mobile Dry Run — لم تُكتب أي بيانات.");
  console.log("═".repeat(72));
}

main().catch((e) => {
  console.error("❌ فشل غير متوقع:", e);
  process.exit(1);
});