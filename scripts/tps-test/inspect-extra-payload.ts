// scripts/tps-test/inspect-extra-payload.ts
// READ ONLY — يطبع 10 صفوف من إكسترا لفهم بنية الـ payload
// run: npx tsx scripts/tps-test/inspect-extra-payload.ts

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ لم أجد بيانات Supabase في .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .eq("store_name", "اكسترا")
    .limit(10);

  if (error) {
    console.error("❌", error.message);
    process.exit(1);
  }

  if (!data?.length) {
    console.log("لا توجد صفوف لإكسترا.");
    return;
  }

  data.forEach((row, i) => {
    const p = (row.payload ?? {}) as Record<string, unknown>;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`[${i + 1}] id: ${row.id}`);
    console.log(`raw_name        : ${row.raw_name ?? "null"}`);
    console.log(`payload.nameEn  : ${p.nameEn ?? "null"}`);
    console.log(`payload.name_en : ${p.name_en ?? "null"}`);
    console.log(`payload.title   : ${p.title ?? "null"}`);
    console.log(`payload.name    : ${p.name ?? "null"}`);
    console.log(`payload.nameAr  : ${p.nameAr ?? "null"}`);
    console.log(`payload.brandEn : ${JSON.stringify(p.brandEn ?? "null")}`);
    console.log(`payload.brand   : ${JSON.stringify(p.brand ?? "null")}`);
    console.log(`payload.modelNumber : ${p.modelNumber ?? "null"}`);
    console.log(`\npayload keys    : ${Object.keys(p).join(", ")}`);
  });

  console.log(`\n${"═".repeat(60)}`);
  console.log("انتهى — لم تُكتب أي بيانات.");
}

main().catch((e) => {
  console.error("❌ فشل غير متوقع:", e);
  process.exit(1);
});