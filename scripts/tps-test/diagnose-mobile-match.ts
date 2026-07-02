// scripts/tps-test/diagnose-mobile-match.ts
// READ ONLY — تشخيص سبب صفر multi-store
// run: npx tsx scripts/tps-test/diagnose-mobile-match.ts

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

async function main() {
  // ═══ الجزء 1: هل nameAr موجود في إكسترا؟ ═══
  console.log("═".repeat(72));
  console.log("① فحص وجود nameAr في payload إكسترا");
  console.log("═".repeat(72));

  const { data: extraSample } = await supabase
    .from("raw_observations")
    .select("id, raw_name, payload")
    .eq("store_name", "اكسترا")
    .filter("payload->category", "cs", '["Mobiles"]')
    .limit(5);

  (extraSample ?? []).forEach((row, i) => {
    const p = (row.payload ?? {}) as Record<string, unknown>;
    console.log(`\n[${i + 1}]`);
    console.log(`  raw_name       : ${row.raw_name ?? "null"}`);
    console.log(`  payload.nameAr : ${p.nameAr ?? "❌ غير موجود"}`);
    console.log(`  payload.nameEn : ${p.nameEn ?? "null"}`);
    console.log(`  payload.title  : ${p.title ?? "null"}`);
    console.log(`  payload keys   : ${Object.keys(p).join(", ")}`);
  });

  // ═══ الجزء 2: مفاتيح valid من كل متجر جنباً لجنب ═══
  console.log("\n" + "═".repeat(72));
  console.log("② مفاتيح valid — المنيع مقابل إكسترا");
  console.log("═".repeat(72));

  async function keysFor(store: string, useEnglish: boolean) {
    let q = supabase
      .from("raw_observations")
      .select("id, store_name, raw_name, payload")
      .eq("store_name", store)
      .limit(400);
    if (store === "اكسترا") {
      q = q.filter("payload->category", "cs", '["Mobiles"]');
    }
    const { data } = await q;

    const keys: { key: string; name: string; brand: string }[] = [];
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
      if (identity.status === "valid" && identity.key) {
        keys.push({
          key: identity.key,
          name: (nameAr || nameEn).slice(0, 45),
          brand: brand ?? "?",
        });
      }
    }
    return keys;
  }

  const almaneaKeys = await keysFor("المنيع", false);
  const extraKeys = await keysFor("اكسترا", true);

  console.log(`\n▼ المنيع (أول 15 من ${almaneaKeys.length} valid):`);
  almaneaKeys.slice(0, 15).forEach((k) =>
    console.log(`   ${k.key}\n      brand=[${k.brand}] name="${k.name}"`)
  );

  console.log(`\n▼ إكسترا (أول 15 من ${extraKeys.length} valid):`);
  extraKeys.slice(0, 15).forEach((k) =>
    console.log(`   ${k.key}\n      brand=[${k.brand}] name="${k.name}"`)
  );

  // ═══ الجزء 3: التقاطع الفعلي ═══
  const almaneaSet = new Set(almaneaKeys.map((k) => k.key));
  const extraSet = new Set(extraKeys.map((k) => k.key));
  const shared = [...almaneaSet].filter((k) => extraSet.has(k));

  console.log("\n" + "═".repeat(72));
  console.log("③ التقاطع");
  console.log(`   مفاتيح المنيع الفريدة : ${almaneaSet.size}`);
  console.log(`   مفاتيح إكسترا الفريدة : ${extraSet.size}`);
  console.log(`   مشتركة               : ${shared.length}`);
  if (shared.length) shared.forEach((k) => console.log(`   ★ ${k}`));
  console.log("═".repeat(72));
}

main().catch((e) => { console.error("❌", e); process.exit(1); });