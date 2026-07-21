// scripts/tps-matcher/ac-matcher-v1-dry.ts
// Category-specific AC matcher — DRY_RUN by default. Uses acPlugin ONLY
// (never mobile parsing rules). Balanced multi-store fetch (Extra + Almanea),
// hard-capped so total observations <= 2 * AC_PER_STORE and neither store can
// consume the whole limit. Read-only report; no writes.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { acPlugin } from "../tps-plugins/ac";

const DRY_RUN = process.env.DRY_RUN !== "false";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("no supabase env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Canonical store identities (stores.id): Extra=4, Almanea=5.
const AC_STORES = [{ id: 4, name: "اكسترا" }, { id: 5, name: "المنيع" }];
const AC_FILTER = [
  "raw_name.ilike.%مكيف جداري%", "raw_name.ilike.%مكيف سبليت%",
  "raw_name.ilike.%Split Air Conditioner%", "raw_name.ilike.%Split AC%",
].join(",");

interface RawRow { id: number; store_id: number | null; store_name: string | null; raw_name: string | null; payload: Record<string, unknown> | null; }
const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
function adaptRow(row: RawRow) {
  const p = row.payload ?? {};
  const nameAr = asString(p.nameAr) ?? asString(p.summaryAr) ?? asString(p.name) ?? asString(row.raw_name) ?? "";
  const nameEn = asString(p.nameEn) ?? asString(p.summaryEn) ?? asString(p.title) ?? "";
  const brand = asString(p.brandEn) ?? asString(p.brandAr) ?? asString(p.brand) ?? null;
  const model = asString(p.model) ?? asString(p.sku) ?? null; // Almanea carries model
  return { nameAr, nameEn, brand, model };
}

async function fetchStore(storeId: number, limit: number): Promise<RawRow[]> {
  const { data, error } = await supabase
    .from("raw_observations")
    .select("id, store_id, store_name, raw_name, payload")
    .eq("store_id", storeId).or(AC_FILTER).order("id", { ascending: true }).limit(limit);
  if (error) { console.error(`store ${storeId}:`, error.message); process.exit(1); }
  return (data ?? []) as RawRow[];
}

interface Offer { obsId: number; storeId: number | null; store: string; key: string | null; status: string; reason?: string; primary: boolean; model: string | null; payload: Record<string, unknown>; name: string; }

async function main() {
  const PER_STORE = Number(process.env.AC_PER_STORE || 250); // 250+250 = 500 total
  console.log("═".repeat(70));
  console.log(`AC MATCHER v1 — DRY_RUN=${DRY_RUN}  (acPlugin ${acPlugin.category} v${acPlugin.version})`);
  console.log("═".repeat(70));

  const perStoreRows: Record<string, number> = {};
  const rows: RawRow[] = [];
  for (const s of AC_STORES) { const r = await fetchStore(s.id, PER_STORE); perStoreRows[s.name] = r.length; rows.push(...r); }
  console.log("fetched by store:", JSON.stringify(perStoreRows), "| total:", rows.length, "(hard cap", 2 * PER_STORE + ")");

  const offers: Offer[] = [];
  const detectByStore: Record<string, number> = {};
  const statusCount: Record<string, number> = { valid: 0, low_confidence_candidate: 0, invalid: 0 };
  const parserFailures: { obsId: number; reason: string; name: string }[] = [];
  for (const row of rows) {
    const store = row.store_name ?? "?";
    const { nameAr, nameEn, brand, model } = adaptRow(row);
    if (!acPlugin.detect(nameAr, nameEn)) continue;
    detectByStore[store] = (detectByStore[store] ?? 0) + 1;
    const norm = acPlugin.normalize(nameAr, nameEn, brand);
    const identity = acPlugin.buildIdentityKey(brand, norm.payload, { technology_inferred: norm.technology_inferred });
    statusCount[identity.status] = (statusCount[identity.status] ?? 0) + 1;
    if (identity.status === "invalid") parserFailures.push({ obsId: row.id, reason: identity.reason ?? "?", name: (nameAr || nameEn).slice(0, 45) });
    // Primary = strong model-number evidence present (Almanea model / normalized model_number).
    const primary = Boolean(model && String(model).replace(/[^a-z0-9]/gi, "").length >= 5);
    offers.push({ obsId: row.id, storeId: row.store_id, store, key: identity.key, status: identity.status, reason: identity.reason, primary, model, payload: norm.payload as any, name: (nameAr || nameEn) });
  }

  // Group by fallback identity key; track distinct STORE IDs (not names).
  const groups = new Map<string, { storeIds: Set<number>; offers: Offer[] }>();
  for (const o of offers) {
    if (!o.key) continue;
    if (!groups.has(o.key)) groups.set(o.key, { storeIds: new Set(), offers: [] });
    const g = groups.get(o.key)!; if (o.storeId != null) g.storeIds.add(o.storeId); g.offers.push(o);
  }
  const corroborated = [...groups.entries()].filter(([, g]) => g.storeIds.size >= 2);
  const singleStore = [...groups.entries()].filter(([, g]) => g.storeIds.size < 2);

  console.log("\n① detect by store:", JSON.stringify(detectByStore));
  console.log("② identity status:", JSON.stringify(statusCount));
  console.log("③ distinct identity keys:", groups.size, "| >=2-store CORROBORATED:", corroborated.length, "| single-store:", singleStore.length);
  const primaryValid = corroborated.filter(([, g]) => g.offers.some((o) => o.primary) && g.offers.every((o) => o.status === "valid"));
  const fallbackCorrob = corroborated.filter(([, g]) => g.offers.every((o) => o.status !== "valid"));
  console.log("④ SAFE candidates — primary-valid corroborated:", primaryValid.length, "| fallback corroborated (>=2 stores):", fallbackCorrob.length);
  console.log("⑤ parser failures (invalid) -> parser_improvement_queue:", parserFailures.length);
  if (corroborated.length) {
    console.log("\n>=2-store corroborated keys (SAFE to canonicalize):");
    corroborated.slice(0, 15).forEach(([k, g]) => {
      console.log(`   KEY ${k} | stores ${[...g.storeIds].join("+")}`);
      g.offers.slice(0, 3).forEach((o) => console.log(`      [${o.store}#${o.obsId}] ${o.name.slice(0, 48)}`));
    });
  } else {
    console.log("\n(no >=2-store corroborated AC identity keys in this balanced sample)");
  }
  // Suspicious-merge guard: within a key, capacity/cooling/tech/type are identical by key construction — assert it.
  let mergeViolations = 0;
  for (const [, g] of groups) {
    const caps = new Set(g.offers.map((o) => String(o.payload.capacity_btu)));
    const cools = new Set(g.offers.map((o) => String(o.payload.cooling_mode)));
    if (caps.size > 1 || cools.size > 1) mergeViolations++;
  }
  console.log("⑥ suspicious-merge violations (mismatched capacity/cooling within a key):", mergeViolations);

  if (process.env.DUMP_IDS) {
    require("fs").writeFileSync(process.env.DUMP_IDS, JSON.stringify({
      perStoreRows, corroboratedKeys: corroborated.map(([k, g]) => ({ key: k, storeIds: [...g.storeIds], obsIds: g.offers.map((o) => o.obsId) })),
      parserFailureObsIds: parserFailures.map((p) => p.obsId),
    }, null, 2));
    console.log(`\n📝 dumped IDs -> ${process.env.DUMP_IDS}`);
  }
  console.log("\n" + "═".repeat(70) + "\nDRY RUN — no data written.\n" + "═".repeat(70));
}
main().catch((e) => { console.error("failed:", e); process.exit(1); });
