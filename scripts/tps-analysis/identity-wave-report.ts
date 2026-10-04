// scripts/tps-analysis/identity-wave-report.ts — ADR-405. READ-ONLY.
// Turns the persistent measurements in `tps_identity_wave_log` (written hourly by the isolated runner's `identity-monitor`
// step) into the numbers a Wave closure report needs, for one category and a time window — so the closure is a mechanical
// summary of what was recorded while nobody was watching, not a recollection.
//
//   npx tsx scripts/tps-analysis/identity-wave-report.ts --category=vacuum [--since=2026-10-04T10:20:00Z] [--until=...] [--md]
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const argv = process.argv.slice(2);
const arg = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? null;
const CAT = arg("category");
const SINCE = arg("since") ?? "1970-01-01T00:00:00Z";
const UNTIL = arg("until") ?? new Date().toISOString();
if (!CAT || !/^[a-z0-9_]+$/.test(CAT)) { console.error("--category=<name> required"); process.exit(1); }

type Metrics = {
  at: string; triggers?: string[]; warnings?: string[];
  runner?: { run_age_hours: number | null; last_run_seconds: number | null; previous_gap_hours?: number | null; stale_incident?: boolean };
  categories?: Record<string, {
    projection: { comparable: number; total: number }; signals: { review: number; reject: number }; verdict_share: number;
    identity_effect: Record<string, number> | null; merchants: { store_id: number; in_verified_comparisons: number; review: number; reject: number }[];
    verified_groups_scanned: number; code_conflict_candidates: string[]; evidence_strength?: { exact_model_key: number; stated_codes_agree: number; family_only: number };
    surface: { requested: number; checked: number; failed: number; signalled_listing_shown_as_verified: number } | null;
  }>;
};
const pct = (a: number[], p: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const stat = (a: number[]) => (a.length ? { min: Math.min(...a), p50: pct(a, 50), p95: pct(a, 95), max: Math.max(...a), last: a[a.length - 1] } : null);

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  if ((await pg.query("select to_regclass('tps_identity_wave_log') as t")).rows[0].t === null) { console.log(JSON.stringify({ error: "tps_identity_wave_log does not exist yet" })); await pg.end(); return; }
  const base = (await pg.query("select taken_at, metrics from tps_identity_wave_log where source = 'baseline' and $1 = any(categories) order by taken_at desc limit 1", [CAT])).rows[0];
  const rows = (await pg.query(
    "select taken_at, source, verdict, triggers, metrics from tps_identity_wave_log where source in ('runner','manual') and $1 = any(categories) and taken_at >= $2 and taken_at <= $3 order by taken_at asc",
    [CAT, SINCE, UNTIL])).rows as { taken_at: string; source: string; verdict: string; triggers: string[]; metrics: Metrics }[];
  await pg.query("rollback"); await pg.end();

  const runner = rows.filter((r) => r.source === "runner");
  const cats = rows.map((r) => r.metrics.categories?.[CAT]).filter(Boolean) as NonNullable<Metrics["categories"]>[string][];
  const times = runner.map((r) => new Date(r.taken_at).getTime());
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / 60000);
  const effectSum = (k: string) => cats.reduce((a, c) => a + (c.identity_effect?.[k] ?? 0), 0);
  const effectMax = (k: string) => Math.max(0, ...cats.map((c) => c.identity_effect?.[k] ?? 0));
  const last = cats[cats.length - 1];
  const baseCat = (base?.metrics as Metrics | undefined)?.categories?.[CAT] as unknown as { comparable: number; total: number } | undefined;
  const report = {
    category: CAT, window: { since: SINCE, until: UNTIL },
    baseline: baseCat ? { taken_at: base.taken_at, comparable: baseCat.comparable, total: baseCat.total } : null,
    operational: {
      runner_cycles_recorded: runner.length, healthy: runner.filter((r) => r.verdict === "HEALTHY").length, alerts: runner.filter((r) => r.verdict === "ROLLBACK_REQUIRED").length,
      first: runner[0]?.taken_at ?? null, last: runner[runner.length - 1]?.taken_at ?? null,
      cycle_gap_minutes: stat(gaps), missed_cycles_over_90min: gaps.filter((g) => g > 90).length,
      run_seconds: stat(runner.map((r) => r.metrics.runner?.last_run_seconds).filter((v): v is number => typeof v === "number")),
      max_signal_age_hours: Math.max(0, ...runner.map((r) => r.metrics.runner?.previous_gap_hours ?? r.metrics.runner?.run_age_hours ?? 0)),
      stale_signal_incidents: runner.filter((r) => r.metrics.runner?.stale_incident).length,
      trigger_history: [...new Set(rows.flatMap((r) => r.triggers))],
    },
    identity: {
      comparable_over_time: stat(cats.map((c) => c.projection.comparable)), total_rows: last?.projection.total ?? null,
      review_now: last?.signals.review ?? null, reject_now: last?.signals.reject ?? null, verdict_share: stat(cats.map((c) => c.verdict_share)),
      evidence_strength_last: last?.evidence_strength ?? null,
      candidate_warnings_cycles: cats.filter((c) => c.code_conflict_candidates.length).length,
      candidate_groups_last: last?.code_conflict_candidates ?? [],
    },
    commercial: {
      identity_effect_last: last?.identity_effect ?? null,
      comparisons_removed_max_in_a_cycle: effectMax("comparisons_removed"), lowest_price_claims_removed_max: effectMax("lowest_price_claims_removed"),
      cheapest_merchant_changed_by_identity_cycles: cats.filter((c) => (c.identity_effect?.cheapest_merchant_changed_by_identity ?? 0) > 0).length,
      cheapest_merchant_changed_by_identity_sum: effectSum("cheapest_merchant_changed_by_identity"),
      amazon: { unconfirmed_last: last?.identity_effect?.amazon_listings_unconfirmed ?? null, in_verified_comparisons_last: last?.identity_effect?.amazon_in_verified_comparisons ?? null, cheapest_in_verified_last: last?.identity_effect?.amazon_cheapest_in_verified_comparisons ?? null },
      merchants_last: last?.merchants ?? [],
      note: "identity effect is computed inside ONE snapshot of current offers with prices held fixed; cheapest_merchant_changed_by_identity therefore excludes price drift",
    },
    surface_consistency: {
      cycles_checked: cats.filter((c) => c.surface).length,
      requests: cats.reduce((a, c) => a + (c.surface?.requested ?? 0), 0), ok: cats.reduce((a, c) => a + (c.surface?.checked ?? 0), 0), failed: cats.reduce((a, c) => a + (c.surface?.failed ?? 0), 0),
      signalled_listing_shown_as_verified: cats.reduce((a, c) => a + (c.surface?.signalled_listing_shown_as_verified ?? 0), 0),
    },
  };
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
