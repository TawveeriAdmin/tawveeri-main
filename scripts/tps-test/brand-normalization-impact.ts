// scripts/tps-test/brand-normalization-impact.ts
// READ ONLY — يقيس أثر تطبيع البراند على التقاطع بين المتاجر
// يحسب shared keys: قبل التطبيع vs بعد التطبيع
// run: npx tsx scripts/tps-test/brand-normalization-impact.ts

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { mobilePlugin } from "../tps-plugins/mobile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "",
  { auth: { persistSession: false } }
);

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
    } catch {}
  }
  return s;
}

// ── طبقة التطبيع المؤقتة (للاختبار فقط، ليست دائمة بعد) ──
// تحوّل كل صيغ البراند لشكل قانوني موحّد
const BRAND_CANONICAL_MAP: Record<string, string> = {
  // Apple
  "apple": "apple", "آبل": "apple", "ابل": "apple", "أبل": "apple", "آيفون": "apple",
  // Samsung
  "samsung": "samsung", "سامسونج": "samsung", "سامسونغ": "samsung",
  // Huawei
  "huawei": "huawei", "هواوي": "huawei",
  // Xiaomi
  "xiaomi": "xiaomi", "شاومي": "xiaomi", "شياومي": "xiaomi",
  // Honor
  "honor": "honor", "هونر": "honor", "هونور": "honor",
  // Oppo
  "oppo": "oppo", "أوبو": "oppo", "اوبو": "oppo",
  // Vivo
  "vivo": "vivo", "فيفو": "vivo",
  // Realme
  "realme": "realme", "ريلمي": "realme",
  // Nokia
  "nokia": "nokia", "نوكيا": "nokia",
  // HMD
  "hmd": "hmd",
  // Google
  "google": "google", "قوقل": "google", "جوجل": "google",
  // Motorola
  "motorola": "motorola", "موتورولا": "motorola",
};

function normalizeBrand(raw: string | null): string {
  if (!raw) return "unknown";
  const key = raw.trim().toLowerCase();
  return BRAND_CANONICAL_MAP[key] ?? key; // لو غير معروف، نرجع lowercase على الأقل
}

// نعيد بناء المفتاح ببراند مطبّع بدل الخام
function rebuildKeyWithCanonicalBrand(originalKey: string, rawBrand: string | null): string {
  const canonical = normalizeBrand(rawBrand);
  // المفتاح صيغته: brand|family|generation|variant|storage
  // نستبدل الجزء الأول (البراند) بالقيمة المطبّعة
  const parts = originalKey.split("|");
  parts[0] = canonical;
  return parts.join("|");
}

async function collectKeys(store: string, useEnglish: boolean) {
  let q = supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", store)
    .limit(2000); // كل الصفوف، لا حد ضيّق
  if (store === "اكسترا") {
    q = q.filter("payload->category", "cs", '["Mobiles"]');
  }
  const { data } = await q;

  // نجمع: المفتاح الأصلي + المفتاح المطبّع
  const original: string[] = [];
  const normalized: string[] = [];

  for (const row of data ?? []) {
    const p = (row.payload ?? {}) as Record<string, unknown>;
    const brand = useEnglish
      ? extractBrand(p.brandEn) ?? extractBrand(p.brand) ?? null
      : extractBrand(p.brand) ?? extractBrand(p.brandEn) ?? null;

    const nameAr = asString(p.nameAr) ?? asString(row.raw_name) ?? "";
    const nameEn = asString(p.nameEn) ?? asString(p.title) ?? "";

    if (!mobilePlugin.detect(nameAr, nameEn)) continue;
    const norm = mobilePlugin.normalize(nameAr, nameEn, brand);
    const identity = mobilePlugin.buildIdentityKey(brand, norm.payload, {});
    if (identity.status !== "valid" || !identity.key) continue;

    original.push(identity.key);
    normalized.push(rebuildKeyWithCanonicalBrand(identity.key, brand));
  }
  return { original, normalized };
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return [...new Set(a)].filter((k) => setB.has(k));
}

async function main() {
  console.log("═".repeat(72));
  console.log("BRAND NORMALIZATION IMPACT — READ ONLY");
  console.log("═".repeat(72));

  const almanea = await collectKeys("المنيع", false);
  const extra = await collectKeys("اكسترا", true);

  console.log(`\nالمنيع : ${almanea.original.length} valid keys`);
  console.log(`إكسترا : ${extra.original.length} valid keys`);

  // ── قبل التطبيع ──
  const sharedBefore = intersection(almanea.original, extra.original);
  // ── بعد التطبيع ──
  const sharedAfter = intersection(almanea.normalized, extra.normalized);

  console.log("\n" + "─".repeat(72));
  console.log("① التقاطع قبل تطبيع البراند");
  console.log(`   مشتركة: ${sharedBefore.length}`);
  sharedBefore.slice(0, 10).forEach((k) => console.log(`   ★ ${k}`));

  console.log("\n② التقاطع بعد تطبيع البراند");
  console.log(`   مشتركة: ${sharedAfter.length}`);
  sharedAfter.slice(0, 20).forEach((k) => console.log(`   ★ ${k}`));

  console.log("\n" + "═".repeat(72));
  console.log("③ الحكم");
  if (sharedAfter.length > sharedBefore.length) {
    console.log(`   ✅ التطبيع رفع التقاطع من ${sharedBefore.length} إلى ${sharedAfter.length}`);
    console.log(`   → بناء brand-map.ts مبرر رسمياً.`);
  } else if (sharedAfter.length === sharedBefore.length && sharedAfter.length > 0) {
    console.log(`   ⚠️ التقاطع موجود أصلاً (${sharedAfter.length}) والتطبيع لم يغيّره.`);
    console.log(`   → البراند ليس العائق الوحيد. راجع family/storage.`);
  } else {
    console.log(`   ❌ التطبيع لم يرفع التقاطع (${sharedBefore.length} → ${sharedAfter.length}).`);
    console.log(`   → المشكلة أعمق: tokenization أو family extraction أو storage.`);
    console.log(`   → لا نبني brand-map.ts بعد. نحتاج تشخيص أعمق للحقول.`);
  }
  console.log("═".repeat(72));
}

main().catch((e) => { console.error("❌", e); process.exit(1); });