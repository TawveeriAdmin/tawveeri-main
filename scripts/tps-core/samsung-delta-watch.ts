// Samsung Saudi catalog worker: full public finder + bilingual sitemap delta.
// Full manufacturer codes identify physical variants; URLs identify source aliases.
// Every run refreshes finder price/stock and known PDP-only models, appends real
// observations through IngestionService, normalizes Samsung, then projects.
// Missing sitemap URLs are lifecycle evidence, never automatic product deletion.
// --dry-run performs source reads/classification without database mutations.
import { config } from "dotenv";
import { resolve } from "path";
import { guardSamsungConnections } from './samsung-connection-guard';
import { runSamsungWorkerChild } from './samsung-worker-child';
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
    SamsungKsaScraper, isSamsungKsaProductUrl, KNOWN_CONSUMER_CATEGORY_PATH,
  } = await import("../../src/lib/scraping/stores/samsung-ksa-scraper");
  const { IngestionService } = await import("../../src/lib/scraping/services/ingestion-service");
  const { fetchSamsungCatalog, samsungSaudiUrl, samsungCatalogProduct } = await import("../../src/lib/scraping/stores/samsung-catalog");
  const { samsungManufacturerIdentity, samsungCatalogExclusion } = await import("./samsung-manufacturer-identity");

  const lockClient = new (Client as any)({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false }, keepAlive: true, keepAliveInitialDelayMillis: 10000 });
  await lockClient.connect();
  const pg = new (Client as any)({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false }, keepAlive: true, keepAliveInitialDelayMillis: 10000 });
  await pg.connect();
  const connectionGuard = guardSamsungConnections([lockClient, pg]);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // ── Singleton guard (Section 10) — the exact proven pattern from the closed recovery ──
  const { rows: lockRows } = await lockClient.query("select pg_try_advisory_lock(hashtext($1)::bigint) as acquired", [DELTA_LOCK_KEY]);
  if (!lockRows[0]?.acquired) {
    console.error(`[singleton-guard] REFUSED — another delta-watch instance already holds the lock (key="${DELTA_LOCK_KEY}").`);
    await lockClient.end().catch(() => {});
    await pg.end().catch(() => {});
    connectionGuard.close();
    process.exit(1);
  }
  console.log(`[singleton-guard] lock acquired — sole delta-watch instance for this run.`);

  const runStartedAt = new Date();
  let runId: string | null = null;
  let runNotes: Record<string, unknown> = {};
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
    // ── 1. Fetch the CURRENT official set (cheap — 4 XML documents, no PDP fetches yet) ──
    // PROVEN LIVE (2026-09-14, final verification): assorted-sitemap.xml is overwhelmingly
    // marketing/FAQ/news/care-pack content (of 482 URLs, only 1 is a real consumer product
    // — see the `movable_screen` path filter above) but it is NOT redundant with the other
    // 3 — that one real product exists in NO other sitemap. Excluding it entirely would be
    // a genuine, provable future-product blind spot (this exact product was already once
    // missed for this reason). Included here with the SAME shape + known-category filters
    // as the other 3 — not a broad ingestion source: only 2 of 482 URLs currently survive
    // both filters, and both are validated (not trusted) before anything is written.
    const SUB_SITEMAPS = ['sa_en', 'sa'].flatMap(site => ['im', 'da', 'vd', 'assorted']
      .map(group => `https://www.samsung.com/${site}/${group}-sitemap.xml`));
    const currentSet = new Set<string>();
    for (const smUrl of SUB_SITEMAPS) {
      const res = await fetch(smUrl, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "Mozilla/5.0", Accept: "application/xml, text/xml, */*" } });
      // An incomplete source set must never demote known products as missing.
      if (!res.ok) throw new Error(`[sitemap] ${smUrl} -> HTTP ${res.status}`);
      const xml = await res.text();
      const locs = (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((m) => m.replace(/<\/?loc>/g, "").replace(/["\\\s]+$/, "").trim());
      for (const loc of locs) {
        const consumer = KNOWN_CONSUMER_CATEGORY_PATH.test(loc)
          || /\/(tv-accessories|home-appliance-accessories|display-accessories|projector-accessories|projectors)\//.test(loc);
        if (isSamsungKsaProductUrl(loc) && consumer) currentSet.add(loc);
      }
    }
    stats.sitemap_urls_seen = currentSet.size;
    const catalog = await fetchSamsungCatalog();
    connectionGuard.assertHealthy();
    const catalogModels = new Map<string, typeof catalog[number]>();
    for (const item of catalog) if (!catalogModels.has(item.model.modelCode)) catalogModels.set(item.model.modelCode, item);
    for (const item of catalogModels.values()) {
      const url = samsungSaudiUrl(item.model.originPdpUrl || item.model.pdpUrl);
      if (url) currentSet.add(url);
    }
    console.log(`[sources] sitemap=${stats.sitemap_urls_seen}, finder_models=${catalogModels.size}, union_urls=${currentSet.size}`);

    // ── 2. Load the KNOWN baseline ──────────────────────────────────────────────────
    const { rows: knownRows } = await pg.query("select official_url, model_code, identity_key, category, classification, lifecycle_state, consecutive_misses from samsung_official_url_baseline");
    const known = new Map<string, BaselineRow>((knownRows as BaselineRow[]).map((r) => [r.official_url, r]));
    // A still-live exact PDP can predate this URL registry and disappear from
    // both finder and sitemap (measured EO-IC100BBEGWW). Treat current merchant
    // evidence as a refresh seed, never as proof that the PDP is still available.
    const { rows: priorOffers } = await pg.query(`select o.url,r.payload->>'sku' model
      from tps_current_offers o join raw_observations r on r.id=o.raw_obs_id
      where o.store_id=6 and o.status='valid'`);
    for (const row of priorOffers) {
      if (known.has(row.url) || samsungCatalogExclusion(row.model || '')) continue;
      const identity = samsungManufacturerIdentity(6, { brand: 'Samsung', sku: row.model, product_url: row.url });
      if (identity) known.set(row.url, { official_url: row.url, model_code: identity.model, identity_key: identity.key,
        category: identity.category, classification: 'CURRENT_VALID_PRODUCT', lifecycle_state: 'CURRENT', consecutive_misses: 0 });
    }
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
    if (storeId !== 6) throw new Error('Unexpected Samsung store identity');
    const catalogProducts = new Map<string, ReturnType<typeof samsungCatalogProduct>>();
    for (const item of catalogModels.values()) {
      // Hard bundles are multiple physical products, not an interchangeable SKU
      // for either constituent. Retain their source evidence, do not offer-match them.
      if (samsungCatalogExclusion(item.model.modelCode)) continue;
      const product = samsungCatalogProduct(item);
      const sourceUrl = samsungSaudiUrl(item.model.originPdpUrl || item.model.pdpUrl)!;
      if (catalogProducts.has(sourceUrl)) throw new Error('Multiple Samsung models share one variant URL');
      catalogProducts.set(sourceUrl, product);
    }
    // Complete price/availability refresh, independent of URL newness. A known
    // model can change stock or price without changing any sitemap entry.
    let finderIngested = 0;
    if (!DRY) {
      connectionGuard.assertHealthy();
      finderIngested = await ingestion.ingestBatch('samsung_ksa', [...catalogProducts.values()], storeId, null);
      if (finderIngested !== catalogProducts.size) throw new Error(`Incomplete finder ingestion ${finderIngested}/${catalogProducts.size}`);
    }
    const knownModels = new Set([...known.values()].map(row => row.model_code?.toUpperCase()).filter(Boolean));
    const { rows: legacyModels } = await pg.query('select distinct p.model from products p join product_stores ps on ps.product_id=p.id where ps.store_id=6');
    for (const row of legacyModels) if (row.model) knownModels.add(String(row.model).toUpperCase());

    const discoveries: { url: string; identity_key: string; category: string; classification: string; discoveredAt: string }[] = [];
    const newBaselineRows: BaselineRow[] = [];
    const finderForUrl = (url: string) => {
      const direct = catalogProducts.get(url);
      if (direct) return direct;
      const terminal = new URL(url).pathname.replace(/\/buy\/$/, '/').split('/').filter(Boolean).pop()!
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matches = [...catalogProducts.values()].filter(product => terminal.endsWith(product.sku!.replace(/[^A-Z0-9]/g, '')));
      // Locale and marketing aliases can corroborate an already observed SKU,
      // but cannot supply another price observation or a fabricated fresh PDP.
      return matches.length === 1 && samsungManufacturerIdentity(storeId, { ...matches[0], product_url: url })
        ? matches[0] : null;
    };
    // A previously valid PDP can remain purchasable after disappearing from both
    // navigation and the finder (verified EO-IC100BBEGWW). Also retry known
    // sitemap candidates: a previous parser miss is not a permanent exclusion.
    const refreshOnly = [...known.values()].filter(row => !samsungCatalogExclusion(row.model_code || '')
      && (currentSet.has(row.official_url) || row.classification === 'CURRENT_VALID_PRODUCT')
      && !finderForUrl(row.official_url)).map(row => row.official_url);
    const refreshOnlySet = new Set(refreshOnly);
    const observedSupplementModels = new Set<string>();

    for (const url of [...deltaUrls, ...refreshOnly]) {
      connectionGuard.assertHealthy();
      const validatedAt = new Date().toISOString();
      try {
        // Validation (the live PDP fetch + classification) always runs, even in --dry-run
        // — it is read-only. Only the WRITES below (ingestBatch, baseline upsert,
        // canonicalization) are gated behind !DRY, so a dry run genuinely proves what
        // classification a candidate would receive, not just that it was "seen".
        const finderProduct = finderForUrl(url);
        const scraped = finderProduct ?? await scraper.updateProductPrice(url);
        connectionGuard.assertHealthy();
        if (!scraped) {
          stats.invalid++;
          const prior = known.get(url);
          newBaselineRows.push({ official_url: url, model_code: prior?.model_code ?? null, identity_key: prior?.identity_key ?? null,
            category: prior?.category ?? null, classification: "INVALID", lifecycle_state: "CURRENT", consecutive_misses: 0 });
          console.log(`[delta] INVALID (no identity) — ${url.slice(-60)}`);
          continue;
        }
        const excluded = samsungCatalogExclusion(scraped.sku || '');
        if (excluded) {
          stats.invalid++;
          newBaselineRows.push({ official_url: url, model_code: scraped.sku, identity_key: null,
            category: scraped.category, classification: excluded, lifecycle_state: 'CURRENT', consecutive_misses: 0 });
          continue;
        }
        const adapted = adaptRow(scraped as any, null);
        let matchedCategory: string | null = null;
        let identityKey: string | null = null;
        let status: string | null = null;
        const manufacturer = samsungManufacturerIdentity(storeId, scraped as any);
        if (manufacturer) {
          matchedCategory = manufacturer.category;
          identityKey = manufacturer.key;
          status = 'valid';
        }
        for (const [catKey, def] of Object.entries(CATEGORY_DEFS as Record<string, any>)) {
          if (manufacturer) break;
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
        currentSet.add(url); // successful current PDP evidence, even without a sitemap entry

        // MODEL-CODE-FIRST DEDUPLICATION (Section 5): does this identity already exist?
        const model = scraped.sku?.toUpperCase();
        const classification = refreshOnlySet.has(url) ? 'UPDATED_EXISTING'
          : model && knownModels.has(model) ? "NEW_URL_SAME_PRODUCT" : "NEW_PRODUCT";
        if (classification === 'UPDATED_EXISTING') stats.updated_existing++;
        else if (classification === "NEW_URL_SAME_PRODUCT") stats.new_url_same_product++; else stats.new_products++;
        if (model) knownModels.add(model);

        newBaselineRows.push({ official_url: url, model_code: scraped.sku || scraped.model || null, identity_key: identityKey, category: matchedCategory, classification: "CURRENT_VALID_PRODUCT", lifecycle_state: "CURRENT", consecutive_misses: 0 });

        if (classification === "NEW_PRODUCT") {
          console.log(`${DRY ? "[dry] would be " : ""}[delta] NEW_PRODUCT — ${matchedCategory} ${identityKey} — ${url.slice(-60)}`);
          if (!DRY) {
            if (!finderProduct && !observedSupplementModels.has(model!) && await ingestion.ingestBatch("samsung_ksa", [scraped], storeId, null) !== 1) throw new Error('PDP ingestion failed');
            if (model) observedSupplementModels.add(model);
            discoveries.push({ url, identity_key: identityKey, category: matchedCategory!, classification, discoveredAt: validatedAt });
          }
        } else {
          // NEW_URL_SAME_PRODUCT — a navigational duplicate of an already-known product
          // (model-code-first dedup, Section 5). Still worth a raw_observations row (real
          // evidence, append-only) once live, but never a new canonical.
          console.log(`${DRY ? "[dry] would be " : ""}[delta] NEW_URL_SAME_PRODUCT (alias of ${identityKey}) — ${url.slice(-60)}`);
          if (!DRY && !finderProduct && !observedSupplementModels.has(model!) && await ingestion.ingestBatch("samsung_ksa", [scraped], storeId, null) !== 1) throw new Error('Alias ingestion failed');
          if (model) observedSupplementModels.add(model);
        }
      } catch (e) {
        stats.failed++;
        console.warn(`[delta] FAILED — ${e instanceof Error ? e.message : e} — ${url.slice(-60)}`);
      }
      if (!finderForUrl(url)) await new Promise((r) => setTimeout(r, 400));
    }

    // ── 5. Persist new/updated baseline rows ───────────────────────────────────────
    const deltaUrlSet = new Set(deltaUrls);
    for (const [url, product] of catalogProducts) {
      if (deltaUrlSet.has(url)) continue;
      const identity = samsungManufacturerIdentity(storeId, product as any);
      if (identity) newBaselineRows.push({ official_url: url, model_code: identity.model,
        identity_key: identity.key, category: identity.category, classification: 'CURRENT_VALID_PRODUCT',
        lifecycle_state: 'CURRENT', consecutive_misses: 0 });
    }
    if (!DRY && newBaselineRows.length) {
      connectionGuard.assertHealthy();
      const { error } = await sb.from("samsung_official_url_baseline").upsert(
        newBaselineRows.map((r) => ({ ...r, last_seen_at: validatedAtNow(), last_validated_at: validatedAtNow() })),
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
          "update samsung_official_url_baseline set last_seen_at=now(), consecutive_misses=0, lifecycle_state='CURRENT' where official_url = any($1::text[])",
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
    let realizationHealth: Record<string, unknown> | null = null;
    let storefrontHealth: Record<string, unknown> | null = null;
    let discoveryVisibility: Record<string, number> = {};
    if (!DRY && (discoveries.length || finderIngested)) {
      connectionGuard.assertHealthy();
      console.log(`[canonicalize] ${discoveries.length} new product(s) — running the standard normalize-incremental (Samsung-scoped, forward-cursor, existing products untouched)...`);
      await runSamsungWorkerChild('scripts/tps-core/normalize-incremental.ts', ['--stores', '6', '--batches', '20', '--limit', '500', '--require-lane']);
      connectionGuard.assertHealthy();
      canonicalAt = new Date().toISOString();

      // Build before checking reachability. Active identity alone is not projection.
      if (!(await pg.query('select pg_try_advisory_lock($1) ok', [8148148])).rows[0].ok) {
        throw new Error('Projection deferred: normalization lane occupied');
      }
      await runSamsungWorkerChild('scripts/build-tps-projection.ts');
      connectionGuard.assertHealthy();
      const { syncSamsungStorefront } = await import('./sync-samsung-storefront');
      storefrontHealth = (await syncSamsungStorefront(pg, true)).summary;
      console.log('[storefront-health]', JSON.stringify(storefrontHealth));
      const { rows: visibility } = await pg.query(`with expected as (select unnest($1::text[]) identity_key)
        select case when c.id is null then 'canonical_missing' when not c.is_active then 'canonical_inactive'
          when p.canonical_id is null then 'projection_missing' when o.identity_key is null then 'current_offer_missing'
          when o.price is null or o.price<=0 then 'unpriced'
          when coalesce(o.payload->>'_availability','') not in ('in_stock','limited_stock','pre_order') then 'unavailable'
          else 'purchasable' end reason,count(*)::int models
        from expected e left join canonical_products c on c.tps_identity_key=e.identity_key
        left join tps_product_projection p on p.canonical_id=c.id
        left join tps_current_offers o on o.identity_key=e.identity_key and o.category=c.category and o.store_id=6 and o.status='valid'
        group by 1`, [discoveries.map(d => d.identity_key)]);
      discoveryVisibility = Object.fromEntries(visibility.map(row => [row.reason, row.models]));
      stats.user_visible_completed = discoveryVisibility.purchasable || 0;
      console.log('[discovery-visibility]', JSON.stringify(discoveryVisibility));
      // Rebuild the projection so new canonicals reach the customer surface.
      userVisibleAt = new Date().toISOString();
      const models = [...new Set([...catalogProducts.values()].map(p => p.sku).concat(newBaselineRows
        .filter(row => row.classification === 'CURRENT_VALID_PRODUCT').map(row => row.model_code)).filter(Boolean))];
      const { rows: health } = await pg.query(`with expected as (select unnest($1::text[]) model)
        select count(distinct e.model)::int expected_models,
          count(distinct e.model) filter(where c.id is null)::int canonical_unresolved,
          count(distinct e.model) filter(where c.id is not null and not c.is_active)::int canonical_inactive,
          count(distinct e.model) filter(where c.id is not null and p.canonical_id is null)::int projection_unresolved,
          count(distinct e.model) filter(where o.identity_key is null)::int current_observation_unresolved,
          count(distinct e.model) filter(where o.price>0)::int priced_models,
          count(distinct e.model) filter(where o.price>0 and coalesce(o.payload->>'_availability','out_of_stock') in ('in_stock','limited_stock'))::int purchasable_models,
          count(distinct e.model) filter(where o.payload->>'_availability' is null)::int missing_availability,
          count(distinct e.model) filter(where o.category<>c.category)::int category_drift
        from expected e left join canonical_products c on c.tps_identity_key='samsung|MODEL:'||e.model
        left join tps_product_projection p on p.canonical_id=c.id
        left join tps_current_offers o on o.identity_key='samsung|MODEL:'||e.model and o.store_id=6 and o.status='valid'`, [models]);
      realizationHealth = health[0];
      console.log('[realization-health]', JSON.stringify(realizationHealth));
    }

    const finishedAt = new Date();
    console.log("\n=== SAMSUNG DELTA WATCH — RUN SUMMARY ===");
    console.log(JSON.stringify({ ...stats, started_at: runStartedAt.toISOString(), finished_at: finishedAt.toISOString(), duration_ms: finishedAt.getTime() - runStartedAt.getTime() }, null, 2));
    if (discoveries.length) {
      console.log("\nDiscoveries this run:");
      for (const d of discoveries) console.log(`  ${d.identity_key} (${d.category}) — discovered_at=${d.discoveredAt} canonical_at=${canonicalAt} user_visible_at=${userVisibleAt}`);
    } else if (DRY && stats.new_products) {
      console.log(`Dry run classified ${stats.new_products} new models; none ingested.`);
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
          stats.user_visible_completed, JSON.stringify(runNotes = { discoveries, missing_this_run: missingUrls.length,
            finder_unique_models: catalogModels.size, finder_ingested: finderIngested,
            finder_excluded_by_policy: catalogModels.size - catalogProducts.size,
            source_union_urls: currentSet.size,
            completed_full_discovery_at: finishedAt.toISOString(), completed_delta_discovery_at: finishedAt.toISOString(),
            completed_price_stock_refresh_at: finishedAt.toISOString(), realization_health: realizationHealth,
            storefront_health: storefrontHealth,
            discovery_visibility_reasons: discoveryVisibility,
            visibility_measure: 'active canonical + projection + priced available Samsung offer; browser journeys measured separately' })]
      );
    }
    if (stats.failed) throw new Error(`Samsung discovery incomplete: ${stats.failed} PDP failures`);
    if (realizationHealth && ['canonical_unresolved', 'canonical_inactive', 'projection_unresolved', 'current_observation_unresolved', 'category_drift']
      .some(field => Number(realizationHealth![field]) > 0)) throw new Error('Samsung realization incomplete; see recorded health metrics');
  } catch (e) {
    if (!DRY && runId) {
      // Independent HTTP connection: a lost PG session cannot report its own failure.
      const { error } = await sb.from('samsung_delta_watch_runs').update({ finished_at: new Date().toISOString(),
        status: 'failed', notes: JSON.stringify({ ...runNotes, error: e instanceof Error ? e.message : String(e) }) }).eq('run_id', runId);
      if (error) console.error('[run] failed to persist failure status:', error.message);
    }
    throw e;
  } finally {
    connectionGuard.close();
    await lockClient.query("select pg_advisory_unlock(hashtext($1)::bigint)", [DELTA_LOCK_KEY]).catch(() => {});
    await lockClient.end().catch(() => {});
    await pg.end().catch(() => {});
  }
}

function validatedAtNow(): string { return new Date().toISOString(); }

process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

main().catch((e) => { console.error("FATAL", e instanceof Error ? e.stack : e); process.exit(1); });
