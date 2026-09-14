// scripts/tps-analysis/seed-samsung-delta-baseline.ts
// One-time bootstrap of samsung_official_url_baseline from the CLOSED mission's own
// evidence (ADR-354 through ADR-361) — no re-fetching, no re-classification, purely
// persisting what was already proven. This is what makes the New-Model Delta Watch able
// to recognize "already decided, not a product" URLs without re-checking them forever.
// Idempotent (upsert on official_url) — safe to re-run if the baseline table is ever reset.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const DRY = !process.argv.includes("--confirm-write");
const SCRATCH = "C:/Users/Hp/AppData/Local/Temp/claude/c--Users-Hp-Downloads-Tawveeri-Official/a8612a71-a18c-49c7-ac64-d907b4182f57/scratchpad";

type Row = {
  official_url: string; model_code: string | null; identity_key: string | null;
  category: string | null; classification: string; lifecycle_state: string;
};

async function main() {
  const fs = await import("fs");
  const { Client } = await import("pg");
  const { toPoolerDbUrl } = await import("../tps-core/pooler-url");
  const { createClient } = await import("@supabase/supabase-js");

  const client = new (Client as any)({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const snap = JSON.parse(fs.readFileSync(`${SCRATCH}/FROZEN-SNAPSHOT-758.json`, "utf8"));
  const urlLedger: any[] = JSON.parse(fs.readFileSync(`${SCRATCH}/URL_LEDGER.json`, "utf8"));
  const U404: any[] = JSON.parse(fs.readFileSync(`${SCRATCH}/U-404.json`, "utf8"));

  const distinctSet = new Set<string>(snap.distinctUrls);
  const rows = new Map<string, Row>();

  // 1. The raw URLs collapsed away by literal /buy/ duplication (927 -> 758 distinct).
  for (const u of snap.rawUrls as string[]) {
    if (!distinctSet.has(u)) rows.set(u, { official_url: u, model_code: null, identity_key: null, category: null, classification: "DUPLICATE_URL", lifecycle_state: "CURRENT" });
  }

  // 2. Map: which of the 758 survived to the final 404 (as a PRIMARY url) vs became a
  //    VARIANT_NAVIGATION_DUPLICATE of an already-counted identity vs was later proven
  //    INVALID/BUNDLE_NON_PRODUCT during identity-level audit (the 425 -> 404 step).
  const validKeys = new Set(U404.map((r) => r.identity_key));
  const urlToPrimaryKey = new Map<string, string>();
  for (const id of U404) for (const u of id.official_urls || []) urlToPrimaryKey.set(u, id.identity_key);

  const L425: any[] = JSON.parse(fs.readFileSync(`${SCRATCH}/IDENTITY_LEDGER.json`, "utf8"));
  const removedInvalid = new Set(["samsung|Galaxy Z|Z Flip 3|Standard|NO_STORAGE", "samsung|Galaxy Z|Z Fold 3|Standard|NO_STORAGE"]);
  const removedBundleKeys = new Set(
    L425.map((r) => r.identity_key).filter((k) => !validKeys.has(k) && !removedInvalid.has(k))
  );
  const urlToRemovedReason = new Map<string, string>();
  for (const id of L425) {
    if (removedInvalid.has(id.identity_key)) for (const u of id.official_urls || []) urlToRemovedReason.set(u, "INVALID");
    else if (removedBundleKeys.has(id.identity_key)) for (const u of id.official_urls || []) urlToRemovedReason.set(u, "BUNDLE_NON_PRODUCT");
  }

  for (const r of urlLedger) {
    const u = r.official_url;
    if (rows.has(u)) continue;
    let classification: string;
    let identity_key: string | null = null;
    let model_code: string | null = (r.resolved_identity_key && /MODEL:(.+)$/.exec(r.resolved_identity_key)?.[1]) || null;

    if (r.url_classification === "PRODUCT_IDENTITY_SOURCE") {
      const removedReason = urlToRemovedReason.get(u);
      if (removedReason) {
        classification = removedReason;
      } else if (urlToPrimaryKey.has(u)) {
        identity_key = urlToPrimaryKey.get(u)!;
        classification = "CURRENT_VALID_PRODUCT";
      } else {
        identity_key = r.resolved_identity_key || null;
        classification = "VARIANT_NAVIGATION_DUPLICATE";
      }
    } else if (r.url_classification === "CONTAMINATION_NOT_PRODUCT") {
      classification = "CONTAMINATION";
    } else if (r.url_classification === "DEAD_OR_GONE") {
      classification = "HISTORICAL";
    } else if (r.url_classification === "B2B_OUT_OF_SCOPE") {
      classification = "B2B";
    } else if (r.url_classification === "UNSUPPORTED_CATEGORY_EXPLICIT") {
      classification = "UNSUPPORTED_CATEGORY";
    } else {
      classification = r.url_classification; // MARKETING, FAMILY_PAGE pass through unchanged
    }

    rows.set(u, { official_url: u, model_code, identity_key, category: null, classification, lifecycle_state: "CURRENT" });
  }

  // 3. The 20 S-Pen URLs (mobile-accessories) carried a STALE pre-fix classification.
  //    Overwrite with the CURRENT, correct state: 5 real stylus identities.
  const { rows: stylusStaging } = await client.query(
    "SELECT identity_key, url, category FROM tps_identity_staging WHERE store_id=6 AND category='stylus'"
  );
  const stylusIdentityByUrl = new Map<string, { key: string; category: string }>();
  for (const s of stylusStaging) stylusIdentityByUrl.set(s.url, { key: s.identity_key, category: s.category });
  for (const [url, info] of stylusIdentityByUrl) {
    rows.set(url, { official_url: url, model_code: null, identity_key: info.key, category: info.category, classification: "CURRENT_VALID_PRODUCT", lifecycle_state: "CURRENT" });
  }

  console.log(`Prepared ${rows.size} baseline rows (927 real sitemap URLs + 13 historical probe URLs = 940 expected).`);
  const byClass: Record<string, number> = {};
  for (const r of rows.values()) byClass[r.classification] = (byClass[r.classification] || 0) + 1;
  console.log(JSON.stringify(byClass, null, 2));

  if (DRY) {
    console.log("\nDRY RUN — no writes performed. Re-run with --confirm-write to apply.");
    await client.end();
    return;
  }

  const values = [...rows.values()];
  for (let i = 0; i < values.length; i += 500) {
    const chunk = values.slice(i, i + 500);
    const { error } = await sb.from("samsung_official_url_baseline").upsert(
      chunk.map((r) => ({ ...r, first_seen_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), last_validated_at: new Date().toISOString() })),
      { onConflict: "official_url" }
    );
    if (error) throw new Error(`upsert failed at chunk ${i}: ${error.message}`);
  }
  console.log(`\nWrote ${values.length} rows to samsung_official_url_baseline.`);
  const { rows: countRows } = await client.query("SELECT classification, count(*)::int n FROM samsung_official_url_baseline GROUP BY classification ORDER BY n DESC");
  console.log(JSON.stringify(countRows, null, 2));
  await client.end();
}

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.stack : e); process.exit(1); });
