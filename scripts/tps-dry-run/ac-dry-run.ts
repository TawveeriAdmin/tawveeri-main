// scripts/tps-dry-run/ac-dry-run.ts
// ─────────────────────────────────────────────────────────────────────────────
// AC Dry Run — READ ONLY
//
// التسلسل (لا يتغير):
//   Supabase (Read Only) → Store Adapter → acPlugin.detect()
//   → normalize() → buildIdentityKey() → scoreConfidence() → Console Report فقط
//
// ❌ لا كتابة لقاعدة البيانات  ❌ لا تعديل جداول  ❌ لا DDL
// ❌ لا تعديل على الـ Plugin    ❌ لا Matcher
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { resolve } from "path";

// حمّل .env.local صراحةً من جذر المشروع (dotenv الافتراضي يقرأ .env فقط)
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { acPlugin } from "../tps-plugins/ac";

// ─── 1. Supabase (Read Only) ─── نفس متغيرات المشروع في .env.local
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌ لم أجد بيانات Supabase في البيئة. تأكد أن .env.local يحوي " +
      "NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY (أو ANON_KEY)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── 2. Store Adapter ─── قراءة فقط: يحوّل بنية كل متجر إلى مدخلات CategoryPlugin
interface AdapterOutput {
  nameAr: string;
  nameEn: string;
  brand: string | null;
}

interface RawRow {
  id: number;
  store_name: string | null;
  raw_name: string | null;
  payload: Record<string, unknown> | null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function adaptRow(row: RawRow): AdapterOutput {
  const p = row.payload ?? {};

  const nameAr =
    asString(p.nameAr) ??
    asString(p.summaryAr) ??
    asString(p.name) ?? // المنيع
    asString(row.raw_name) ??
    "";

  const nameEn =
    asString(p.nameEn) ??
    asString(p.summaryEn) ??
    asString(p.title) ??
    "";

  const brand =
    asString(p.brandEn) ??
    asString(p.brandAr) ??
    asString(p.brand) ??
    null;

  return { nameAr, nameEn, brand };
}

// ─── 3. جلب المكيفات (قراءة فقط) ───
async function fetchACObservations(limit: number): Promise<RawRow[]> {
  const { data, error } = await supabase
    .from("raw_observations")
    .select("id, store_name, raw_name, payload")
    .or(
      [
        "raw_name.ilike.%مكيف جداري%",
        "raw_name.ilike.%مكيف سبليت%",
        "raw_name.ilike.%Split Air Conditioner%",
        "raw_name.ilike.%Split AC%",
      ].join(",")
    )
    .limit(limit);

  if (error) {
    console.error("❌ خطأ في القراءة من Supabase:", error.message);
    process.exit(1);
  }
  return (data ?? []) as RawRow[];
}

// ─── 4. التشغيل + التقرير ───
async function main() {
  const LIMIT = Number(process.env.DRY_RUN_LIMIT || 500);

  console.log("═".repeat(70));
  console.log("AC DRY RUN — READ ONLY  (لا كتابة، لا تعديل)");
  console.log(`Plugin: ${acPlugin.category} v${acPlugin.version}`);
  console.log("═".repeat(70));

  const rows = await fetchACObservations(LIMIT);
  console.log(`\nجُلب ${rows.length} صفاً مرشحاً للمكيفات (read-only).\n`);

  let detected = 0;
  let notDetected = 0;
  const statusCount: Record<string, number> = {
    valid: 0,
    low_confidence_candidate: 0,
    invalid: 0,
  };
  const invalidReasons: Record<string, number> = {};
  const byStore: Record<string, { detected: number; valid: number }> = {};
  const keyGroups: Record<string, { stores: Set<string>; samples: string[] }> = {};
  const sampleKeys: string[] = [];

  for (const row of rows) {
    const store = row.store_name ?? "?";
    byStore[store] ??= { detected: 0, valid: 0 };

    const { nameAr, nameEn, brand } = adaptRow(row);

    if (!acPlugin.detect(nameAr, nameEn)) {
      notDetected++;
      continue;
    }
    detected++;
    byStore[store].detected++;

    const norm = acPlugin.normalize(nameAr, nameEn, brand);

    const identity = acPlugin.buildIdentityKey(brand, norm.payload, {
      technology_inferred: norm.technology_inferred,
    });

    acPlugin.scoreConfidence(
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
      if (keyGroups[identity.key].samples.length < 4) {
        keyGroups[identity.key].samples.push(
          `${store}: ${(nameAr || nameEn).slice(0, 50)}`
        );
      }
      if (sampleKeys.length < 12) sampleKeys.push(`[${store}] ${identity.key}`);
    }
  }

  console.log("─".repeat(70));
  console.log("① الكشف (detect)");
  console.log(`   مكيف فعلي:      ${detected}`);
  console.log(`   مُستبعَد:        ${notDetected} (ثلاجة/حامل/غير مكيف)`);

  console.log("\n② حالة الهوية (buildIdentityKey)");
  const totalDetected = detected || 1;
  for (const [st, n] of Object.entries(statusCount)) {
    const pct = ((n / totalDetected) * 100).toFixed(1);
    console.log(`   ${st.padEnd(26)} ${String(n).padStart(5)}  (${pct}%)`);
  }

  if (Object.keys(invalidReasons).length) {
    console.log("\n③ أسباب invalid (أكثرها شيوعاً)");
    Object.entries(invalidReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([r, n]) => console.log(`   ${String(n).padStart(4)} × ${r}`));
  }

  console.log("\n④ حسب المتجر");
  for (const [st, c] of Object.entries(byStore)) {
    console.log(
      `   ${st.padEnd(12)} detected=${String(c.detected).padStart(4)}  valid=${String(
        c.valid
      ).padStart(4)}`
    );
  }

  console.log("\n⑤ عيّنة مفاتيح مولّدة");
  sampleKeys.forEach((k) => console.log(`   ${k}`));

  console.log("\n" + "─".repeat(70));
  console.log("⑥ ★ التطابق متعدد المتاجر (نفس identity_key من متجرين+)");
  const multi = Object.entries(keyGroups).filter(([, g]) => g.stores.size >= 2);
  if (multi.length === 0) {
    console.log("   لا يوجد تطابق متعدد المتاجر في هذه العيّنة.");
    console.log("   (متوقّع: لا تداخل ماركات بين إكسترا والمنيع في المكيفات.)");
  } else {
    console.log(`   وُجد ${multi.length} مفتاحاً مشتركاً بين متجرين+! ✅\n`);
    multi.slice(0, 10).forEach(([key, g]) => {
      console.log(`   KEY: ${key}`);
      console.log(`        المتاجر: ${[...g.stores].join(" / ")}`);
      g.samples.forEach((s) => console.log(`        - ${s}`));
      console.log("");
    });
  }

  console.log("═".repeat(70));
  console.log("انتهى Dry Run — لم تُكتب أي بيانات. تقرير فقط.");
  console.log("═".repeat(70));
}

main().catch((e) => {
  console.error("❌ فشل غير متوقع:", e);
  process.exit(1);
});