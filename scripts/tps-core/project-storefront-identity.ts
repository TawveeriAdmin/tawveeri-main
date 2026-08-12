// scripts/tps-core/project-storefront-identity.ts
// ─────────────────────────────────────────────────────────────────────────────
// STOREFRONT IDENTITY PROJECTION (ADR-242 — Canonical Identity Convergence)
//
// Binds storefront `products.canonical_product_id` to the TPS knowledge graph by
// LISTING EQUALITY, never by product matching:
//
//   a storefront offer (store_id, product_url) and a TPS-identified observation
//   (store_id, normalized_payload._url) that name the SAME retailer listing are
//   the same real-world listing. The projection inherits the identity the TPS
//   engine already assigned to that listing. It never re-decides identity, never
//   compares names, never merges canonicals (ADR-176 untouched).
//
// WHY this exists: products.canonical_product_id was populated exactly once, by
// migration 005_link_products (2026-06-26, name_ar+brand text matching — the
// method docs/TPS.md:101 records as unvalidated debt). Every product ingested
// since is permanently unlinked, and every one of the 1,461 existing links
// points at legacy key-less canonicals disjoint from the live TPS graph.
//
// SAFETY CONTRACT (rule_version convergence-v1):
//   R1 unanimity   — every evidence row of a product must name ONE canonical;
//                    any disagreement → conflict, no link.
//   R2 uniqueness  — a normalized URL (or ASIN) whose TPS history names ≥2
//                    distinct ACTIVE canonicals is ambiguous → excluded.
//   R3 no reassign — products with an existing canonical_product_id are never
//                    modified. The June legacy links are left exactly as-is.
//   R5 tier gate   — only identity_key_status='valid' evidence projects in v1;
//                    low_confidence is measured and reported, not written
//                    (--include-low-confidence exists for a later, audited pass).
//   R6 provenance  — every write is recorded in storefront_identity_links with
//                    the matched value, the backing npo id, identity key, tier
//                    and rule version. Rollback = --rollback (restores NULL for
//                    exactly what this job wrote, nothing else).
//   R8 drift       — every run re-derives evidence for previously-written links;
//                    a link whose evidence now names a different canonical is
//                    flagged status='drift' (products row is NOT silently
//                    rewritten). Externally-changed links are reported.
//
// DRY BY DEFAULT. Nothing is written without --go.
//   npx tsx scripts/tps-core/project-storefront-identity.ts               # shadow
//   ... --go --limit 500                                                  # bounded write
//   ... --go --stores 3 --limit 50                                        # pilot cohort
//   ... --rollback --go                                                   # undo this job's links
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { storageContradiction, identityParamsDisagree, suffixedNumeralContradiction, deviceClassContradiction, sharedWordNumeralContradiction, brandContradiction, accessoryTitleContradiction } from "./identity-projection-guards";
import { classifyFromTitle, isAccessoryTitleHead } from "../../src/lib/scraping/utils/category-utils";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toPoolerDbUrl } = require("./pooler-url.js") as { toPoolerDbUrl: (raw: string) => string };

const RULE_VERSION = "convergence-v1";

const argNum = (name: string, dflt: number) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const go = process.argv.includes("--go");
  const rollback = process.argv.includes("--rollback");
  const includeLowConfidence = process.argv.includes("--include-low-confidence");
  // --repoint-legacy (ADR-243, founder-authorized): operate on the FINITE cohort of
  // products whose current canonical_product_id targets a LEGACY key-less canonical
  // (the 2026-06-26 005_link_products output). Same evidence, same guards; the ledger
  // row records prior_canonical_product_id so rollback restores the OLD value, never
  // NULL. The hourly chain never passes this flag — R3 (never reassign) still governs
  // continuous operation; this is a bounded, audited, one-cohort amendment.
  const repointLegacy = process.argv.includes("--repoint-legacy");
  const limit = Math.min(2000, argNum("limit", 500));
  const si = process.argv.indexOf("--stores");
  const onlyStores = si >= 0
    ? String(process.argv[si + 1] ?? "").split(",").map((s) => Number(s.trim())).filter(Number.isFinite)
    : undefined;
  if (onlyStores && !onlyStores.length) throw new Error("--stores given but empty");

  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL || ""), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query(`SET statement_timeout = '180s'`);

  try {
    if (rollback) {
      await runRollback(pg, go, limit);
      return;
    }

    // ── Evidence build (set-based, temp tables — session-scoped) ────────────────
    // Both sides normalized identically: strip scheme + www, query, hash, trailing
    // slashes. Path case is preserved (a case-folded path could alias two real pages).
    await pg.query(`
      create temp table _sf as
      select ps.product_id, ps.store_id, p.category as sf_category,
             p.canonical_product_id as existing_link,
             ps.product_url,
             nullif(regexp_replace(regexp_replace(split_part(split_part(ps.product_url,'#',1),'?',1), '^https?://(www\\.)?', ''), '/+$', ''), '') as u,
             case when ps.store_id = 2 then coalesce(
               upper((regexp_match(ps.product_url, '/dp/(B0[A-Za-z0-9]{8})'))[1]),
               case when p.sku ~* '^B0[A-Z0-9]{8}$' then upper(p.sku) end
             ) end as asin
      from product_stores ps
      join products p on p.id = ps.product_id
      where ps.product_url is not null and ps.product_url <> ''`);
    await pg.query(`create index on _sf (store_id, u)`);

    // TPS side: only observations the identity engine actually resolved, and only
    // to canonicals that are still ACTIVE (a superseded/deactivated canonical drops
    // out here, so legitimate canonical churn does not read as URL ambiguity).
    await pg.query(`
      create temp table _tps as
      select n.store_id::int as store_id,
             nullif(regexp_replace(regexp_replace(split_part(split_part(n.normalized_payload->>'_url','#',1),'?',1), '^https?://(www\\.)?', ''), '/+$', ''), '') as u,
             case when n.store_id = '2' then upper((regexp_match(n.normalized_payload->>'_url', '/dp/(B0[A-Za-z0-9]{8})'))[1]) end as asin,
             n.normalized_payload->>'_url' as tps_raw_url,
             n.canonical_product_id as cid, n.identity_key, n.identity_key_status,
             n.observed_at, n.id as npo_id, cp.category as canon_category
      from normalized_product_observations n
      join canonical_products cp on cp.id = n.canonical_product_id and cp.is_active
      where n.normalized_payload->>'_url' is not null
        and n.canonical_product_id is not null
        and n.store_id ~ '^[0-9]+$'`);
    await pg.query(`create index on _tps (store_id, u)`);
    await pg.query(`create index on _tps (asin) where asin is not null`);

    // R2 — a URL/ASIN whose full ACTIVE-canonical history is plural is ambiguous.
    await pg.query(`
      create temp table _url_amb as
      select store_id, u from _tps where u is not null
      group by store_id, u having count(distinct cid) > 1`);
    await pg.query(`
      create temp table _asin_amb as
      select asin from _tps where asin is not null
      group by asin having count(distinct cid) > 1`);

    // Evidence rows: URL lane for every store, ASIN lane for Amazon (store 2) whose
    // URL shapes differ structurally between the two pipelines (search-result paths
    // vs /dp/ASIN) so URL equality under-matches there.
    await pg.query(`
      create temp table _ev as
      select sf.product_id, sf.store_id, sf.sf_category, t.cid, t.identity_key,
             t.identity_key_status, t.canon_category, 'url_exact'::text as lane,
             sf.u as matched_value, sf.product_url, t.tps_raw_url, t.npo_id, t.observed_at
      from _sf sf join _tps t on t.store_id = sf.store_id and t.u = sf.u
      where sf.u is not null
        and not exists (select 1 from _url_amb a where a.store_id = sf.store_id and a.u = sf.u)
      union all
      select sf.product_id, sf.store_id, sf.sf_category, t.cid, t.identity_key,
             t.identity_key_status, t.canon_category, 'asin_exact', sf.asin,
             sf.product_url, t.tps_raw_url, t.npo_id, t.observed_at
      from _sf sf join _tps t on t.store_id = 2 and t.asin = sf.asin
      where sf.store_id = 2 and sf.asin is not null
        and not exists (select 1 from _asin_amb a where a.asin = sf.asin)`);

    // R1 — per-product unanimity across ALL lanes and ALL offers.
    await pg.query(`
      create temp table _cand as
      select product_id, count(distinct cid) as n_cid
      from _ev group by product_id`);

    // Representative evidence row per clean product: prefer valid-tier, then the
    // most recent observation (provenance points at the freshest proof).
    await pg.query(`
      create temp table _pick as
      select distinct on (e.product_id) e.*
      from _ev e join _cand c on c.product_id = e.product_id and c.n_cid = 1
      order by e.product_id, (e.identity_key_status = 'valid') desc, e.observed_at desc nulls last`);

    // ── Shadow report ────────────────────────────────────────────────────────────
    const one = async (sql: string) => (await pg.query(sql)).rows[0];
    const all = async (sql: string) => (await pg.query(sql)).rows;

    const base = await one(`
      select
        (select count(*) from products where canonical_product_id is null) as unlinked_products,
        (select count(distinct product_id) from _sf where existing_link is null) as unlinked_with_url,
        (select count(*) from _url_amb) as ambiguous_urls,
        (select count(*) from _asin_amb) as ambiguous_asins`);

    const cand = await one(`
      select
        count(distinct c.product_id) filter (where c.n_cid = 1) as clean,
        count(distinct c.product_id) filter (where c.n_cid > 1) as conflicting
      from _cand c
      where exists (select 1 from _sf sf where sf.product_id = c.product_id and sf.existing_link is null)`);

    // All clean candidates, with the names both sides carry, so the R11
    // contradiction veto and every aggregate below run over ONE fetched set.
    const storeFilter = onlyStores ? `and p.store_id in (${onlyStores.join(",")})` : "";
    type Picked = {
      product_id: string; cid: string; store_id: number; lane: string;
      matched_value: string; product_url: string; tps_raw_url: string | null; npo_id: string;
      identity_key: string; identity_key_status: string;
      sf_category: string | null; canon_category: string | null;
      product_name_en: string | null; product_name_ar: string | null;
      canon_name_en: string | null; canon_name_ar: string | null; store_slug: string;
      product_brand: string | null; canon_brand: string | null;
      prior_cid: string | null;
    };
    // Chain mode targets UNLINKED products; repoint mode targets products whose
    // CURRENT link is a legacy key-less canonical (and only those — a product
    // already pointing at a TPS canonical is never touched by either mode).
    const targetJoin = repointLegacy
      ? `join products pr on pr.id = p.product_id and pr.canonical_product_id is not null and pr.canonical_product_id <> p.cid
         join canonical_products legacy on legacy.id = pr.canonical_product_id and legacy.tps_identity_key is null`
      : `join products pr on pr.id = p.product_id and pr.canonical_product_id is null`;
    const picked = (await all(`
      select p.product_id, p.cid, p.store_id, p.lane, p.matched_value, p.product_url,
             p.tps_raw_url, p.npo_id, p.identity_key, p.identity_key_status, p.sf_category, p.canon_category,
             pr.name_en as product_name_en, pr.name_ar as product_name_ar,
             pr.brand as product_brand, cp.brand as canon_brand,
             cp.name_en as canon_name_en, cp.name_ar as canon_name_ar,
             s.slug as store_slug, pr.canonical_product_id as prior_cid
      from _pick p
      ${targetJoin}
      join canonical_products cp on cp.id = p.cid
      join stores s on s.id = p.store_id
      where true ${storeFilter}`)) as Picked[];

    // Deterministic NEGATIVE-evidence vetoes (identity-projection-guards.ts).
    // Each is a refusal, never a link: R11 storage contradiction, R12
    // identity-bearing query params must agree (Jarir childSku class), R13
    // suffixed-numeral contradiction (14T≠14, 13C≠13, nova 14i≠14), R14
    // device-class contradiction (an air fryer never links to a mobile
    // canonical, whatever the TPS graph mis-parsed).
    const vetoCounts: Record<string, number> = { R11_storage: 0, R12_params: 0, R13_suffix: 0, R14_device: 0, R15_wordnum: 0, R16_brand: 0, R17_accessory: 0 };
    const vetoSamples: string[] = [];
    const surviving: Picked[] = [];
    for (const r of picked) {
      const productText = `${r.product_name_en ?? ""} ${r.product_name_ar ?? ""}`;
      const canonText = `${r.canon_name_en ?? ""} ${r.canon_name_ar ?? ""} ${r.identity_key ?? ""}`;
      const canonNames = `${r.canon_name_en ?? ""} ${r.canon_name_ar ?? ""}`;
      let veto: string | null = null;
      if (r.lane === "url_exact" && identityParamsDisagree(r.product_url, r.tps_raw_url)) veto = "R12_params";
      else if (storageContradiction(productText, canonText)) veto = "R11_storage";
      else if (suffixedNumeralContradiction(productText, canonNames)) veto = "R13_suffix";
      else if (sharedWordNumeralContradiction(productText, canonNames)) veto = "R15_wordnum";
      else if (brandContradiction(r.product_brand, r.canon_brand)) veto = "R16_brand";
      else if (accessoryTitleContradiction(isAccessoryTitleHead(productText), r.canon_category)) veto = "R17_accessory";
      else if (deviceClassContradiction(classifyFromTitle(productText), r.canon_category)) veto = "R14_device";
      if (veto) {
        vetoCounts[veto]++;
        if (vetoSamples.length < 14) vetoSamples.push(`${veto} ${r.store_slug} «${(r.product_name_en || r.product_name_ar || "").slice(0, 55)}» vs ${r.identity_key}`);
      } else {
        surviving.push(r);
      }
    }
    const vetoTotal = Object.values(vetoCounts).reduce((a, b) => a + b, 0);

    const allowedTiers = includeLowConfidence
      ? new Set(["valid", "low_confidence_candidate"])
      : new Set(["valid"]);
    const eligibleRows = surviving.filter((r) => allowedTiers.has(r.identity_key_status));

    const countBy = <T,>(rows: T[], key: (r: T) => string) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };

    const modeRule = repointLegacy ? "legacy-repoint-v1" : RULE_VERSION;
    console.log(`\n═══ STOREFRONT IDENTITY ${repointLegacy ? "LEGACY RE-POINT" : "PROJECTION"} — ${go ? "WRITE RUN" : "DRY RUN (nothing written)"} · ${modeRule} ═══`);
    if (repointLegacy) {
      const legacyBase = await one(`
        select count(*) as legacy_linked
        from products pr join canonical_products lc on lc.id = pr.canonical_product_id
        where lc.tps_identity_key is null`);
      console.log(`  products currently linked to LEGACY canonicals    ${legacyBase.legacy_linked}`);
    } else {
      console.log(`  unlinked storefront products                      ${base.unlinked_products}`);
      console.log(`  … of which have at least one offer URL            ${base.unlinked_with_url}`);
    }
    console.log(`  R2 ambiguous URLs excluded (multi-canonical)      ${base.ambiguous_urls}`);
    console.log(`  R2 ambiguous ASINs excluded                       ${base.ambiguous_asins}`);
    if (!repointLegacy) console.log(`  evidence-bearing unlinked products: clean=${cand.clean} conflict(R1)=${cand.conflicting}`);
    console.log(`  clean candidates fetched${onlyStores ? ` [stores ${onlyStores.join(",")}]` : ""}      ${picked.length}`);
    console.log(`  negative-evidence vetoes                          ${vetoTotal}  (R11 storage=${vetoCounts.R11_storage} · R12 params=${vetoCounts.R12_params} · R13 suffix=${vetoCounts.R13_suffix} · R14 device=${vetoCounts.R14_device} · R15 wordnum=${vetoCounts.R15_wordnum} · R16 brand=${vetoCounts.R16_brand} · R17 accessory=${vetoCounts.R17_accessory})`);
    for (const v of vetoSamples) console.log(`    VETO ${v}`);
    console.log(`  tier split of surviving candidates:`);
    for (const [k, n] of countBy(surviving, (r) => r.identity_key_status)) console.log(`    ${k.padEnd(26)} ${n}`);
    console.log(`  ELIGIBLE under tier gate ${includeLowConfidence ? "(valid+low_confidence)" : "(valid only)"}: ${eligibleRows.length}`);
    console.log(`  by store × lane:`);
    for (const [k, n] of countBy(eligibleRows, (r) => `${r.store_slug.padEnd(14)} ${r.lane}`)) console.log(`    ${k.padEnd(26)} ${n}`);
    console.log(`  category agreement (storefront → canonical):`);
    for (const [k, n] of countBy(eligibleRows, (r) => `${String(r.sf_category).padEnd(16)} → ${r.canon_category}`)) console.log(`    ${k.padEnd(40)} ${n}`);

    // Repoint-only: chart-continuity delta. The legacy canonicals receive fresh
    // firecrawl-keyed price rows, so re-pointing swaps the customer chart's data
    // source — measure per candidate what the chart HAS under the prior cid vs
    // what it WOULD have under the TPS cid (same store, 90d), before writing.
    if (repointLegacy && eligibleRows.length) {
      const buckets = { gain: 0, equal: 0, partial_loss: 0, loss_to_zero: 0, none_before_none_after: 0 };
      for (let i = 0; i < eligibleRows.length; i += 300) {
        const chunk = eligibleRows.slice(i, i + 300);
        const values = chunk.map((_, k) => `($${k * 4 + 1}::uuid,$${k * 4 + 2}::int,$${k * 4 + 3}::uuid,$${k * 4 + 4}::uuid)`).join(",");
        const params = chunk.flatMap((r) => [r.product_id, r.store_id, r.prior_cid, r.cid]);
        const rows = (await pg.query(`
          select v.pid,
            (select count(*) from price_history ph where ph.canonical_product_id = v.prior and ph.store_id = v.sid and ph.observed_at >= now() - interval '90 days') as prior_pts,
            (select count(*) from price_history ph where ph.canonical_product_id = v.newc and ph.store_id = v.sid and ph.observed_at >= now() - interval '90 days') as new_pts
          from (values ${values}) as v(pid, sid, prior, newc)`, params)).rows as { prior_pts: string; new_pts: string }[];
        for (const r of rows) {
          const a = Number(r.prior_pts), b = Number(r.new_pts);
          if (a === 0 && b === 0) buckets.none_before_none_after++;
          else if (b > a) buckets.gain++;
          else if (b === a) buckets.equal++;
          else if (b > 0) buckets.partial_loss++;
          else buckets.loss_to_zero++;
        }
      }
      console.log(`  chart continuity (same-store 90d points, prior→new): gain=${buckets.gain} equal=${buckets.equal} partial_loss=${buckets.partial_loss} LOSS_TO_ZERO=${buckets.loss_to_zero} none_either=${buckets.none_before_none_after}`);
    }

    // ── R8 drift pass over previously-written links ─────────────────────────────
    // Tolerates the ledger not existing yet, so a pure-shadow run needs no DDL.
    const ledgerExists = (await one(`select to_regclass('public.storefront_identity_links') is not null as ok`)).ok;
    if (!ledgerExists) {
      console.log(`  drift check: storefront_identity_links does not exist yet — skipped (shadow mode)`);
    }
    const drift = !ledgerExists ? [] : await all(`
      select l.id, l.product_id, l.canonical_product_id as written_cid,
             pr.canonical_product_id as current_col,
             c.n_cid, pk.cid as evidence_cid
      from storefront_identity_links l
      join products pr on pr.id = l.product_id
      left join _cand c on c.product_id = l.product_id
      left join _pick pk on pk.product_id = l.product_id
      where l.status = 'active'`);
    const drifted = drift.filter((d) => d.evidence_cid && d.evidence_cid !== d.written_cid);
    const external = drift.filter((d) => d.current_col !== d.written_cid);
    const evidenceGone = drift.filter((d) => !d.evidence_cid);
    console.log(`  drift check over ${drift.length} active links: drift=${drifted.length} externally_changed=${external.length} evidence_gone=${evidenceGone.length}`);
    if (go && drifted.length) {
      for (const d of drifted) {
        await pg.query(
          `update storefront_identity_links set status='drift', drift_detected_at=now(),
             note = coalesce(note,'') || ' evidence now names ' || $2
           where id = $1 and status='active'`, [d.id, d.evidence_cid]);
      }
      console.log(`  → ${drifted.length} link(s) marked drift (products rows NOT rewritten — audit required)`);
    }

    // --audit-sample N: print N deterministic-random eligible survivors (title vs
    // canonical, both sides) for a human precision audit. Identity-rich categories
    // first — that is where a wrong link is most damaging and most checkable.
    const as = process.argv.indexOf("--audit-sample");
    if (as >= 0) {
      const n = Math.min(100, Number(process.argv[as + 1]) || 40);
      const rich = new Set(["mobile", "tablet", "laptop", "tv", "monitor", "smartwatch"]);
      const md5ish = (s: string) => s.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
      const sample = [...eligibleRows]
        .sort((a, b) => Number(rich.has(b.canon_category ?? "")) - Number(rich.has(a.canon_category ?? "")) || md5ish(a.product_id) - md5ish(b.product_id))
        .slice(0, n);
      console.log(`\n  AUDIT SAMPLE (${sample.length}):`);
      for (const r of sample) {
        console.log(`   [${r.store_slug}/${r.lane}] «${(r.product_name_en || r.product_name_ar || "").slice(0, 70)}»`);
        console.log(`      → ${(r.canon_name_en || r.canon_name_ar || "").slice(0, 60)} · ${r.identity_key}`);
      }
    }

    if (!go) {
      console.log(`\n  DRY RUN — no products row touched, no link recorded. Pass --go to write (bounded --limit ${limit}).`);
      return;
    }
    // R6 — no provenance ledger, no writes. Ever.
    if (!ledgerExists) throw new Error("storefront_identity_links missing — apply migration 025 before any --go run");

    // ── Bounded write ────────────────────────────────────────────────────────────
    const rows = [...eligibleRows]
      .sort((a, b) => a.product_id.localeCompare(b.product_id))
      .slice(0, limit);

    let linked = 0, skipped = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await pg.query("begin");
      try {
        for (const r of chunk) {
          // Race-safe, idempotent compare-and-set: chain mode requires the column
          // to still be NULL; repoint mode requires it to still be the exact
          // legacy value the evidence was computed against. Any concurrent change
          // skips the product, and its provenance row is then not written either.
          const upd = repointLegacy
            ? await pg.query(
                `update products set canonical_product_id = $1
                 where id = $2 and canonical_product_id = $3`, [r.cid, r.product_id, r.prior_cid])
            : await pg.query(
                `update products set canonical_product_id = $1
                 where id = $2 and canonical_product_id is null`, [r.cid, r.product_id]);
          if (upd.rowCount !== 1) { skipped++; continue; }
          await pg.query(
            `insert into storefront_identity_links
               (product_id, canonical_product_id, store_id, evidence_class, matched_value,
                storefront_url, tps_npo_id, tps_identity_key, identity_key_status, rule_version,
                prior_canonical_product_id)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [r.product_id, r.cid, r.store_id, r.lane, r.matched_value,
             r.product_url, r.npo_id, r.identity_key, r.identity_key_status, modeRule,
             repointLegacy ? r.prior_cid : null]);
          linked++;
        }
        await pg.query("commit");
      } catch (e) {
        await pg.query("rollback");
        throw e;
      }
    }
    console.log(`\n  WROTE ${linked} link(s) (${skipped} skipped by the race guard) — bounded by --limit ${limit}.`);
    console.log(`  Rollback: npx tsx scripts/tps-core/project-storefront-identity.ts --rollback --go`);
  } finally {
    await pg.end();
  }
})().catch((e) => { console.error("FATAL", e instanceof Error ? (e.stack || e.message) : JSON.stringify(e)); process.exit(1); });

// ── Rollback: restore the PRE-LINK value for exactly what this job wrote. ──────
// convergence-v1 rows restore NULL (the column was empty before); legacy-repoint
// rows restore prior_canonical_product_id (the legacy canonical they replaced).
async function runRollback(pg: Client, go: boolean, limit: number) {
  const { rows } = await pg.query(`
    select l.id, l.product_id, l.canonical_product_id, l.prior_canonical_product_id,
           (pr.canonical_product_id = l.canonical_product_id) as still_ours
    from storefront_identity_links l
    join products pr on pr.id = l.product_id
    where l.status = 'active'
    order by l.id
    limit $1`, [limit]);
  const ours = rows.filter((r) => r.still_ours);
  const changed = rows.filter((r) => !r.still_ours);
  console.log(`\n═══ ROLLBACK ${go ? "" : "(DRY — nothing written)"} ═══`);
  console.log(`  active links inspected: ${rows.length} · restorable: ${ours.length} · externally changed (left alone): ${changed.length}`);
  if (!go) return;
  for (let i = 0; i < ours.length; i += 100) {
    const chunk = ours.slice(i, i + 100);
    await pg.query("begin");
    try {
      for (const r of chunk) {
        await pg.query(
          `update products set canonical_product_id = $3
           where id = $1 and canonical_product_id = $2`,
          [r.product_id, r.canonical_product_id, r.prior_canonical_product_id ?? null]);
        await pg.query(
          `update storefront_identity_links set status='rolled_back',
             note = coalesce(note,'') || ' rolled back ' || now()::text
           where id = $1`, [r.id]);
      }
      await pg.query("commit");
    } catch (e) {
      await pg.query("rollback");
      throw e;
    }
  }
  console.log(`  rolled back ${ours.length} link(s).`);
}
