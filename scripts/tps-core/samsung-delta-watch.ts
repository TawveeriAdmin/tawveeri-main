// scripts/tps-core/samsung-delta-watch.ts
// ─────────────────────────────────────────────────────────────────────────────
// Samsung KSA New-Model Delta Watch (2026-09-14, maintenance-of-closure mission).
//
// The Samsung Saudi official catalog is CLOSED (927 raw sitemap candidates -> 404 core +
// 5 high-value accessories = 409 current-valid identities, ADR-354..361). This script does
// NOT re-run that classification. It answers one narrow question on a schedule: has
// Samsung's sitemap changed since the last check, and if so, is the change a genuinely new
// product/variant or just navigation noise the closed mission already knows how to
// recognize?
//
// SET-DIFF, NOT LASTMOD (Section 8 of the mission brief). Audited live: some real Samsung
// KSA product URLs (the S Pen accessory line) carry NO <lastmod> at all, while others do —
// inconsistent presence disqualifies lastmod as a correctness gate. This script diffs the
// FULL current sitemap URL set against `samsung_official_url_baseline` (durable memory of
// every URL ever classified, seeded once from the closed mission's own evidence) — cheap
// (a handful of sitemap.xml fetches), and correct regardless of whether lastmod is trustworthy.
//
// MODEL-CODE-FIRST DEDUPLICATION (Section 5). A new URL is never assumed to be a new
// product. Every genuinely-new URL is validated through the real scraper + the full
// CATEGORY_DEFS registry sweep (the exact same detect()/normalize()/buildIdentityKey()
// chain the closed catalog itself was built from) BEFORE anything is written — if the
// resolved identity_key already has a canonical, this is NEW_URL_SAME_PRODUCT (an alias),
// never a duplicate canonical.
//
// ONLY THE DELTA IS PROCESSED (Section 6). New/changed URLs are ingested via the same
// IngestionService.ingestBatch() the hourly chain uses, then canonicalized via the
// standard, unmodified `normalize-incremental.ts --stores 6` entry point — its own forward
// cursor guarantees existing, already-processed raw_observations are never re-touched.
//
// Usage:
//   npx tsx scripts/tps-core/samsung-delta-watch.ts [--dry-run]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const DELTA_LOCK_KEY = "samsung_ksa_delta_watch";
const DRY = process.argv.includes("--dry-run");
// Conservative lifecycle rule (Section 12): never demote past NOT_SEEN until a URL has
// been absent for this many CONSECUTIVE runs. No flapping, no automatic deletion.
const MISSES_BEFORE_POSSIBLY_DISCONTINUED = 3;

type BaselineRow = {
  official_url: string; model_code: string | null; identity_key: string | null;
  category: string | null; classification: string; lifecycle_state: string;
  consecutive_misses: number;
};

async function main() {
  const { Client } = await import("pg");
  const { createClient } = await import("@supabase/supabase-js");
  const { toPoolerDbUrl } = (await import("./pooler-url.js")) as { toPoolerDbUrl: (raw: string) => string };
  const { CATEGORY_DEFS } = await import("./category-registry");
  const { adaptRow } = await import("./progressive-engine");
  const {
    SamsungKsaScraper, isSamsungKsaProductUrl, HIGH_VALUE_ACCESSORY_SLUG, KNOWN_CONSUMER_CATEGORY_PATH,
  } = await import("../../src/lib/scraping/stores/samsung-ksa-scraper");
  const { IngestionService } = await import("../../src/lib/scraping/services/ingestion-service");

  const lockClient = new (Client as any)({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await lockClient.connect();
  const pg = new (Client as any)({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // ── Singleton guard (Section 10) — the exact proven pattern from the closed recovery ──
  const { rows: lockRows } = await lockClient.query("select pg_try_advisory_lock(hashtext($1)::bigint) as acquired", [DELTA_LOCK_KEY]);
  if (!lockRows[0]?.acquired) {
    console.error(`[singleton-guard] REFUSED — another delta-watch instance already holds the lock (key="${DELTA_LOCK_KEY}").`);
    await lockClient.end().catch(() => {});
    await pg.end().catch(() => {});
    process.exit(1);
  }
  console.log(`[singleton-guard] lock acquired — sole delta-watch instance for this run.`);

  const runStartedAt = new Date();
  let runId: string | null = null;
  if (!DRY) {
    const { rows } = await pg.query(
      "insert into samsung_delta_watch_runs (started_at, status) values ($1, 'running') returning run_id",
      [runStartedAt.toISOString()]
    );
    runId = rows[0].run_id;
    console.log(`[run] run_id=${runId}`);
  }

  const stats = {
    sitemap_urls_seen: 0, known_urls: 0, delta_urls: 0,
    new_products: 0, new_variants: 0, new_url_same_product: 0,
    updated_existing: 0, duplicates: 0, invalid: 0, failed: 0,
    user_visible_completed: 0,
  };

  try {
    // ── 1. Fetch the CURRENT official set (cheap — 3 XML documents, no PDP fetches yet) ──
    const SUB_SITEMAPS = [
      "https://www.samsung.com/sa_en/im-sitemap.xml",
      "https://www.samsung.com/sa_en/da-sitemap.xml",
      "https://www.samsung.com/sa_en/vd-sitemap.xml",
    ];
    const currentSet = new Set<string>();
    for (const smUrl of SUB_SITEMAPS) {
      const res = await fetch(smUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/xml, text/xml, */*" } });
      if (!res.ok) { console.warn(`[sitemap] WARN: ${smUrl} -> HTTP ${res.status}`); continue; }
      const xml = await res.text();
      const locs = (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((m) => m.replace(/<\/?loc>/g, "").replace(/["\\\s]+$/, "").trim());
      for (const loc of locs) {
        const isLowValueAccessory = /\/mobile-accessories\//i.test(loc) && !HIGH_VALUE_ACCESSORY_SLUG.test(loc);
        if (isSamsungKsaProductUrl(loc) && KNOWN_CONSUMER_CATEGORY_PATH.test(loc) && !isLowValueAccessory) currentSet.add(loc);
      }
    }
    stats.sitemap_urls_seen = currentSet.size;
    console.log(`[sitemap] current official set: ${currentSet.size} URLs`);

    // ── 2. Load the KNOWN baseline ──────────────────────────────────────────────────
    const { rows: knownRows } = await pg.query("select official_url, model_code, identity_key, category, classification, lifecycle_state, consecutive_misses from samsung_official_url_baseline");
    const known = new Map<string, BaselineRow>((knownRows as BaselineRow[]).map((r) => [r.official_url, r]));
    stats.known_urls = known.size;
    console.log(`[baseline] known URLs: ${known.size}`);

    // ── 3. Compute the delta ────────────────────────────────────────────────────────
    const deltaUrls = [...currentSet].filter((u) => !known.has(u));
    stats.delta_urls = deltaUrls.length;
    console.log(`[delta] genuinely new URLs (not in baseline): ${deltaUrls.length}`);

    // ── 4. Validate each delta URL — bounded, real PDP fetches ONLY for the delta ──────
    const scraper = new SamsungKsaScraper();
    const ingestion = new IngestionService();
    const { data: storeRow } = await sb.from("stores").select("id").eq("slug", "samsung_ksa").single();
    const storeId = Number((storeRow as { id: number | string } | null)?.id);

    const discoveries: { url: string; identity_key: string; category: string; classification: string; discoveredAt: string }[] = [];
    const newBaselineRows: BaselineRow[] = [];

    for (const url of deltaUrls) {
      const validatedAt = new Date().toISOString();
      try {
        // Validation (the live PDP fetch + classification) always runs, even in --dry-run
        // — it is read-only. Only the WRITES below (ingestBatch, baseline upsert,
        // canonicalization) are gated behind !DRY, so a dry run genuinely proves what
        // classification a candidate would receive, not just that it was "seen".
        const scraped = await scraper.updateProductPrice(url);
        if (!scraped) {
          stats.invalid++;
          newBaselineRows.push({ official_url: url, model_code: null, identity_key: null, category: null, classification: "INVALID", lifecycle_state: "CURRENT", consecutive_misses: 0 });
          console.log(`[delta] INVALID (no identity) — ${url.slice(-60)}`);
          continue;
        }
        const adapted = adaptRow(scraped as any, null);
        let matchedCategory: string | null = null;
        let identityKey: string | null = null;
        let status: string | null = null;
        for (const [catKey, def] of Object.entries(CATEGORY_DEFS as Record<string, any>)) {
          if (!def.plugin.detect(adapted.nameAr, adapted.nameEn)) continue;
          const norm = def.normalize(adapted.nameAr, adapted.nameEn, adapted.brand, scraped);
          const idr = def.plugin.buildIdentityKey(adapted.brand, norm.payload, { model_number: norm.model_number });
          if (idr.status !== "invalid") { matchedCategory = catKey; identityKey = idr.key; status = idr.status; break; }
        }

        if (!identityKey) {
          stats.invalid++;
          newBaselineRows.push({ official_url: url, model_code: null, identity_key: null, category: null, classification: "UNKNOWN", lifecycle_state: "CURRENT", consecutive_misses: 0 });
          console.log(`[delta] UNKNOWN (no category claimed it) — ${url.slice(-60)}`);
          continue;
        }

        // MODEL-CODE-FIRST DEDUPLICATION (Section 5): does this identity already exist?
        const { rows: existingCanon } = await pg.query("select id from canonical_products where tps_identity_key=$1", [identityKey]);
        const classification = existingCanon.length ? "NEW_URL_SAME_PRODUCT" : "NEW_PRODUCT";
        if (classification === "NEW_URL_SAME_PRODUCT") stats.new_url_same_product++; else stats.new_products++;

        newBaselineRows.push({ official_url: url, model_code: identityKey.includes("MODEL:") ? identityKey.split("MODEL:")[1] : null, identity_key: identityKey, category: matchedCategory, classification: "CURRENT_VALID_PRODUCT", lifecycle_state: "CURRENT", consecutive_misses: 0 });

        if (classification === "NEW_PRODUCT") {
          console.log(`${DRY ? "[dry] would be " : ""}[delta] NEW_PRODUCT — ${matchedCategory} ${identityKey} — ${url.slice(-60)}`);
          if (!DRY) {
            await ingestion.ingestBatch("samsung_ksa", [scraped], storeId, null);
            discoveries.push({ url, identity_key: identityKey, category: matchedCategory!, classification, discoveredAt: validatedAt });
          }
        } else {
          // NEW_URL_SAME_PRODUCT — a navigational duplicate of an already-known product
          // (model-code-first dedup, Section 5). Still worth a raw_observations row (real
          // evidence, append-only) once live, but never a new canonical.
          console.log(`${DRY ? "[dry] would be " : ""}[delta] NEW_URL_SAME_PRODUCT (alias of ${identityKey}) — ${url.slice(-60)}`);
          if (!DRY) await ingestion.ingestBatch("samsung_ksa", [scraped], storeId, null);
        }
      } catch (e) {
        stats.failed++;
        console.warn(`[delta] FAILED — ${e instanceof Error ? e.message : e} — ${url.slice(-60)}`);
      }
      await new Promise((r) => setTimeout(r, 400)); // source politeness (Section 15)
    }

    // ── 5. Persist new/updated baseline rows ───────────────────────────────────────
    if (!DRY && newBaselineRows.length) {
      const { error } = await sb.from("samsung_official_url_baseline").upsert(
        newBaselineRows.map((r) => ({ ...r, first_seen_at: validatedAtNow(), last_seen_at: validatedAtNow(), last_validated_at: validatedAtNow() })),
        { onConflict: "official_url" }
      );
      if (error) throw new Error(`baseline upsert failed: ${error.message}`);
    }

    // ── 6. Touch last_seen_at for every KNOWN url still present ────────────────────
    const stillPresent = [...currentSet].filter((u) => known.has(u));
    if (!DRY && stillPresent.length) {
      for (let i = 0; i < stillPresent.length; i += 500) {
        const chunk = stillPresent.slice(i, i + 500);
        await pg.query(
          "update samsung_official_url_baseline set last_seen_at=now(), consecutive_misses=0 where official_url = any($1::text[])",
          [chunk]
        );
      }
    }

    // ── 7. Lifecycle demotion for KNOWN urls absent this run (Section 12 — conservative) ──
    const missingUrls = [...known.keys()].filter((u) => !currentSet.has(u) && known.get(u)!.classification === "CURRENT_VALID_PRODUCT");
    for (const u of missingUrls) {
      const row = known.get(u)!;
      const misses = row.consecutive_misses + 1;
      const nextState =
        misses === 1 ? "TEMP_UNAVAILABLE" :
        misses === 2 ? "NOT_SEEN" :
        misses >= MISSES_BEFORE_POSSIBLY_DISCONTINUED ? "POSSIBLY_DISCONTINUED" : row.lifecycle_state;
      if (!DRY) {
        await pg.query(
          "update samsung_official_url_baseline set consecutive_misses=$2, lifecycle_state=$3, updated_at=now() where official_url=$1",
          [u, misses, nextState]
        );
      }
      if (misses === 1) console.log(`[lifecycle] first miss -> TEMP_UNAVAILABLE: ${u.slice(-60)}`);
    }

    // ── 8. If any NEW_PRODUCT this run, canonicalize via the standard, unmodified entry point ──
    let canonicalAt: string | null = null;
    let userVisibleAt: string | null = null;
    if (!DRY && discoveries.length) {
      console.log(`[canonicalize] ${discoveries.length} new product(s) — running the standard normalize-incremental (Samsung-scoped, forward-cursor, existing products untouched)...`);
      const { execSync } = await import("child_process");
      execSync("npx tsx scripts/tps-core/normalize-incremental.ts --stores 6 --batches 20 --limit 500", { stdio: "inherit" });
      canonicalAt = new Date().toISOString();

      // Verify user-visibility end-to-end for each discovery (not inferred).
      for (const d of discoveries) {
        const { rows: cp } = await pg.query("select id, is_active from canonical_products where tps_identity_key=$1", [d.identity_key]);
        if (cp.length && cp[0].is_active) {
          stats.user_visible_completed++;
        } else {
          console.warn(`[discover] WARNING: ${d.identity_key} did not canonicalize/activate this run — needs investigation, not silently retried forever.`);
        }
      }
      // Rebuild the projection so new canonicals reach the customer surface.
      execSync("npx tsx scripts/build-tps-projection.ts", { stdio: "inherit" });
      userVisibleAt = new Date().toISOString();
    }

    const finishedAt = new Date();
    console.log("\n=== SAMSUNG DELTA WATCH — RUN SUMMARY ===");
    console.log(JSON.stringify({ ...stats, started_at: runStartedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_ms: finishedAt.getTime() - runStartedAt.getTime() }, null, 2));
    if (discoveries.length) {
      console.log("\nDiscoveries this run:");
      for (const d of discoveries) console.log(`  ${d.identity_key} (${d.category}) — discovered_at=${d.discoveredAt} canonical_at=${canonicalAt} user_visible_at=${userVisibleAt}`);
    } else {
      console.log("\nNo new products this run. Quiet, recorded.");
    }

    if (!DRY && runId) {
      await pg.query(
        `update samsung_delta_watch_runs set finished_at=now(), status='completed',
         sitemap_urls_seen=$2, known_urls=$3, delta_urls=$4, new_products=$5, new_variants=$6,
         new_url_same_product=$7, updated_existing=$8, duplicates=$9, invalid=$10, failed=$11,
         user_visible_completed=$12, notes=$13
         where run_id=$1`,
        [runId, stats.sitemap_urls_seen, stats.known_urls, stats.delta_urls, stats.new_products, stats.new_variants,
          stats.new_url_same_product, stats.updated_existing, stats.duplicates, stats.invalid, stats.failed,
          stats.user_visible_completed, JSON.stringify({ discoveries, missing_this_run: missingUrls.length })]
      );
    }
  } catch (e) {
    if (!DRY && runId) {
      await pg.query("update samsung_delta_watch_runs set finished_at=now(), status='failed', notes=$2 where run_id=$1", [runId, JSON.stringify({ error: e instanceof Error ? e.message : String(e) })]).catch(() => {});
    }
    throw e;
  } finally {
    await lockClient.query("select pg_advisory_unlock(hashtext($1)::bigint)", [DELTA_LOCK_KEY]).catch(() => {});
    await lockClient.end().catch(() => {});
    await pg.end().catch(() => {});
  }
}

function validatedAtNow(): string { return new Date().toISOString(); }

process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.stack : e); process.exit(1); });
