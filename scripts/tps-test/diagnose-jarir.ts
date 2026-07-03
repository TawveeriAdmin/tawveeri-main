// scripts/tps-test/diagnose-jarir.ts
// تشخيص جرير: adapter → complete variant → detect → normalize → identity — قراءة فقط، صفر كتابة

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { mobilePlugin } from "../tps-plugins/mobile";
import { canonicalizeBrand } from "../tps-core/brand-map";
import { adaptStoreRow } from "../tps-core/store-adapters";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } }
);

async function main() {
  const { data: canon } = await supabase
    .from("canonical_products")
    .select("tps_identity_key")
    .eq("category", "mobile")
    .eq("is_active", true);

  const canonKeys = (canon ?? []).map((c) => c.tps_identity_key ?? "");

  const kw = ["ايفون", "آيفون", "iphone", "جالاكسي", "galaxy"];
  const f = kw.map((x) => `raw_name.ilike.%${x}%`).join(",");

  const { data, error } = await supabase
    .from("raw_observations")
    .select("id, raw_name, payload")
    .eq("store_name", "جرير")
    .or(f)
    .order("id", { ascending: true })
    .limit(50);

  if (error) {
    console.error("❌", error.message);
    process.exit(1);
  }

  console.log(`جرير (مفلتر بالاسم): ${data?.length ?? 0} صف\n` + "═".repeat(70));

  let pass = 0;
  let parentSkipped = 0;
  let failDetect = 0;
  let failIdentity = 0;

  for (const row of data ?? []) {
    const p = (row.payload ?? {}) as Record<string, unknown>;
    const a = adaptStoreRow("جرير", p, row.raw_name);

    if (!a) {
      console.log(`✖ [${row.id}] adapter=null`);
      continue;
    }

    const name = (a.nameAr || a.nameEn).slice(0, 55);

    if (!a.isCompleteVariant) {
      parentSkipped++;
      console.log(`⊘ PARENT  [${row.id}] "${name}"`);
      continue;
    }

    if (!mobilePlugin.detect(a.nameAr, a.nameEn)) {
      failDetect++;
      console.log(`✖ DETECT  [${row.id}] "${name}"`);
      continue;
    }

    const norm = mobilePlugin.normalize(a.nameAr, a.nameEn, a.brand);
    const cb = canonicalizeBrand(a.brand);
    const identity = mobilePlugin.buildIdentityKey(cb, norm.payload, {});

    if (identity.status !== "valid" || !identity.key) {
      failIdentity++;
      console.log(
        `✖ IDENTITY [${row.id}] status=${identity.status} | "${name}" | brand=${a.brand}`
      );
      console.log(`            payload=${JSON.stringify(norm.payload)}`);
      continue;
    }

    pass++;

    const inCanon = canonKeys.some(
      (k) => k === identity.key || k.startsWith(identity.key + "|ram=")
    );

    console.log(
      `${inCanon ? "🎯 MATCH " : "✔ NEW   "} [${row.id}] ${identity.key} | model=${a.model} | sku=${a.sku} | price=${a.price} | adapter=${a.adapterVersion}`
    );
  }

  console.log("═".repeat(70));
  console.log(
    `النتيجة: valid=${pass} | parent skipped=${parentSkipped} | فشل detect=${failDetect} | فشل identity=${failIdentity}`
  );
  console.log(
    `🎯 = مفتاح جرير يطابق canonical موجود (منتج سيصبح ثلاثي المتاجر عند الكتابة)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});