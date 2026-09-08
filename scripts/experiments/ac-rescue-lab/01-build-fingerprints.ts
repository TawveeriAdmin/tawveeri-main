// AC Rescue Lab — Step 1: build experimental fingerprints. READ-ONLY against production.
// Writes local JSON only. No table write anywhere in this file.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import * as fs from "fs";
import { toPoolerDbUrl } from "../../tps-core/pooler-url";
import { normalize } from "../../tps-plugins/ac/parser";
import { canonicalizeBrand, detectBrandFromText } from "../../tps-core/brand-map";
import { extractModelMpnEvidence } from "../../tps-plugins/ac/model-mpn-evidence";

const OUT_DIR = resolve(__dirname, "out");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Placeholder/unsafe brand values that must never be treated as genuine shared identity
// (ADR-318 proved "Generic" causes real collisions; extending the denylist defensively).
const UNSAFE_BRAND_PLACEHOLDERS = new Set(["unknown", "generic", "no brand", "n/a", "na", "غير معروف"]);

interface Fingerprint {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  brand_raw: string | null;
  brand_canonical: string | null;
  brand_safe: boolean; // false if brand is a placeholder/unsafe value
  ac_type: string | null;
  capacity_btu: number | null;
  capacity_class: number | null; // rounded to nearest 1000 BTU, CANDIDATE-GENERATION ONLY
  cooling_mode: string | null;
  technology: string | null;
  technology_inferred: boolean;
  series_or_platform: string | null;
  model_number: string | null;
  mpn: string | null;
  source: "amazon_title_derived" | "trusted_canonical_identity_key";
  provenance_note: string;
}

function capacityClass(btu: number | null): number | null {
  if (btu === null || !Number.isFinite(btu)) return null;
  return Math.round(btu / 1000);
}

function parseIdentityKey(key: string | null): { brand: string | null; ac_type: string | null; series: string | null; btu: number | null; tech: string | null; mode: string | null } {
  if (!key) return { brand: null, ac_type: null, series: null, btu: null, tech: null, mode: null };
  const [brand, ac_type, series, btuStr, tech, mode] = key.split("|");
  return {
    brand: brand || null, ac_type: ac_type || null,
    series: series === "NO_SERIES" ? null : series || null,
    btu: btuStr ? Number(btuStr) : null,
    tech: tech === "NO_TECH" ? null : tech || null,
    mode: mode === "NO_MODE" ? null : mode || null,
  };
}

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // ── AMAZON SIDE: all 270, fingerprint derived fresh from title (matches production's own
  //    title-only extraction path exactly — the SAME normalize()/brand-detection functions
  //    already used in production, not a new heuristic) + model/mpn evidence where captured.
  console.log("Building Amazon AC fingerprints (270 expected)...");
  const amazonRows = await c.query(`
    select p.id, p.name_en, p.name_ar, p.canonical_product_id,
           (select payload->'specifications' from raw_observations ro
            where ro.store_id = 2 and ro.raw_name = p.name_en
            order by ro.scraped_at desc limit 1) as specs
    from products p join product_stores ps on ps.product_id = p.id
    where p.category = 'air_conditioner' and ps.store_id = 2`);

  const amazonFingerprints: Fingerprint[] = amazonRows.rows.map((row: any) => {
    const norm = normalize(row.name_ar || "", row.name_en || "", null);
    const brandRaw = detectBrandFromText(row.name_en || row.name_ar || "");
    const brandCanonical = brandRaw ? canonicalizeBrand(brandRaw) : "unknown";
    const ev = extractModelMpnEvidence(row.specs);
    const btu = (norm.payload as any).capacity_btu ?? null;
    return {
      id: row.id, name_en: row.name_en, name_ar: row.name_ar,
      brand_raw: brandRaw, brand_canonical: brandCanonical,
      brand_safe: !UNSAFE_BRAND_PLACEHOLDERS.has(brandCanonical.toLowerCase()),
      ac_type: (norm.payload as any).ac_type ?? null,
      capacity_btu: btu, capacity_class: capacityClass(btu),
      cooling_mode: (norm.payload as any).cooling_mode ?? null,
      technology: (norm.payload as any).technology ?? null,
      technology_inferred: norm.technology_inferred,
      series_or_platform: (norm.payload as any).series_or_platform ?? null,
      model_number: ev.model_number?.normalized_value ?? null,
      mpn: ev.mpn?.normalized_value ?? null,
      source: "amazon_title_derived",
      provenance_note: row.canonical_product_id ? `storefront row already linked to canonical ${row.canonical_product_id}` : "unlinked storefront row",
    };
  });

  // ── TRUSTED SIDE: existing canonicals with >=1 non-Amazon observation. Fingerprint parsed
  //    directly from the ALREADY-COMPUTED tps_identity_key (production's own authoritative
  //    output) — not re-derived, since this IS the trusted reference this lab compares against.
  console.log("Building trusted (non-Amazon) AC canonical fingerprints...");
  const trustedRows = await c.query(`
    select distinct cp.id, cp.name_en, cp.name_ar, cp.brand, cp.model_number, cp.tps_identity_key,
           (select string_agg(distinct npo.identity_key_status, ',') from normalized_product_observations npo
            where npo.canonical_product_id = cp.id and npo.store_id != '2') as tier_status,
           (select string_agg(distinct npo.store_id, ',') from normalized_product_observations npo
            where npo.canonical_product_id = cp.id and npo.store_id != '2') as store_ids
    from canonical_products cp
    join normalized_product_observations npo on npo.canonical_product_id = cp.id
    where cp.category = 'air_conditioner' and cp.is_active and npo.store_id != '2'`);

  const trustedFingerprints: (Fingerprint & { tier_status: string | null; store_ids: string | null })[] = trustedRows.rows.map((row: any) => {
    const parsed = parseIdentityKey(row.tps_identity_key);
    const brandCanonical = parsed.brand ?? (row.brand ? canonicalizeBrand(row.brand) : "unknown");
    return {
      id: row.id, name_en: row.name_en, name_ar: row.name_ar,
      brand_raw: row.brand, brand_canonical: brandCanonical,
      brand_safe: !UNSAFE_BRAND_PLACEHOLDERS.has(brandCanonical.toLowerCase()),
      ac_type: parsed.ac_type, capacity_btu: parsed.btu, capacity_class: capacityClass(parsed.btu),
      cooling_mode: parsed.mode, technology: parsed.tech, technology_inferred: false,
      series_or_platform: parsed.series, model_number: row.model_number, mpn: null,
      source: "trusted_canonical_identity_key",
      provenance_note: `tps_identity_key=${row.tps_identity_key ?? "NULL"}`,
      tier_status: row.tier_status, store_ids: row.store_ids,
    };
  });

  fs.writeFileSync(resolve(OUT_DIR, "amazon-fingerprints.json"), JSON.stringify(amazonFingerprints, null, 2));
  fs.writeFileSync(resolve(OUT_DIR, "trusted-fingerprints.json"), JSON.stringify(trustedFingerprints, null, 2));

  // ── Coverage measurement (Amazon side — the population we're trying to rescue) ──────────
  const n = amazonFingerprints.length;
  const pct = (k: number) => `${k}/${n} (${((k / n) * 100).toFixed(1)}%)`;
  const coverage = {
    TOTAL_AC_ROWS: n,
    BRAND_COVERAGE_safe_only: pct(amazonFingerprints.filter(f => f.brand_safe).length),
    TYPE_COVERAGE: pct(amazonFingerprints.filter(f => f.ac_type).length),
    CAPACITY_COVERAGE: pct(amazonFingerprints.filter(f => f.capacity_btu !== null).length),
    MODE_COVERAGE: pct(amazonFingerprints.filter(f => f.cooling_mode).length),
    INVERTER_TECH_COVERAGE: pct(amazonFingerprints.filter(f => f.technology).length),
    SERIES_COVERAGE: pct(amazonFingerprints.filter(f => f.series_or_platform).length),
    MODEL_NUMBER_COVERAGE: pct(amazonFingerprints.filter(f => f.model_number).length),
    MPN_COVERAGE: pct(amazonFingerprints.filter(f => f.mpn).length),
    FULL_FOUNDER_FINGERPRINT_COVERAGE_brand_type_capacity_mode_inverter: pct(
      amazonFingerprints.filter(f => f.brand_safe && f.ac_type && f.capacity_btu !== null && f.cooling_mode && f.technology).length
    ),
    MINIMAL_BLOCKING_FINGERPRINT_brand_type_capacity: pct(
      amazonFingerprints.filter(f => f.brand_safe && f.ac_type && f.capacity_btu !== null).length
    ),
  };
  console.log("\n=== AMAZON-SIDE FINGERPRINT COVERAGE ===");
  console.log(JSON.stringify(coverage, null, 2));

  console.log("\n=== TRUSTED UNIVERSE SIZE & TIER SPLIT ===");
  console.log("trusted fingerprints:", trustedFingerprints.length);
  console.log("trusted, valid-tier only:", trustedFingerprints.filter(f => f.tier_status?.includes("valid")).length);
  console.log("trusted, safe brand only:", trustedFingerprints.filter(f => f.brand_safe).length);

  fs.writeFileSync(resolve(OUT_DIR, "coverage-summary.json"), JSON.stringify({ amazon_coverage: coverage, trusted_universe_size: trustedFingerprints.length, trusted_valid_tier: trustedFingerprints.filter(f => f.tier_status?.includes("valid")).length }, null, 2));

  await c.end();
  console.log("\nWrote:", OUT_DIR);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
