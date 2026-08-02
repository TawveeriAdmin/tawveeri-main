// scripts/tps-analysis/ingestion-diagnosis.ts
// READ-ONLY. Per-retailer ingestion diagnosis: is it enabled, is it scheduled, when did
// it last ATTEMPT, when did it last SUCCEED, and which layer is failing.
//
// WHY IT IS EMPIRICAL RATHER THAN CONFIG-READING. The scheduler's ingest sets come from
// Railway env vars that OVERRIDE the repo defaults, and this machine cannot read them. So
// the enabled set is inferred from what production actually did: a store receiving rows on
// a 6h/12h rhythm is being ingested, whatever any file says. Config is the claim;
// raw_observations is the evidence.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const FAIL_H = 48, WARN_H = 26;   // the platform-health SLO

(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  console.log("═══ 1. FRESHNESS + VOLUME PER STORE (SLO: >48h FAIL, >26h WARN) ═══");
  const per = await pg.query(`
    select s.id, s.name, s.slug, null::boolean is_active,
           count(o.id)::int observations,
           max(o.scraped_at) last_obs,
           round(extract(epoch from now()-max(o.scraped_at))/3600.0, 1) age_h,
           count(o.id) filter (where o.scraped_at > now() - interval '48 hours')::int last_48h,
           count(o.id) filter (where o.scraped_at > now() - interval '7 days')::int last_7d
    from stores s left join raw_observations o on o.store_id = s.id
    group by 1,2,3 order by age_h asc nulls last`);
  for (const r of per.rows as any[]) {
    const age = r.age_h === null ? null : Number(r.age_h);
    const lvl = age === null ? "NEVER" : age > FAIL_H ? "FAIL " : age > WARN_H ? "WARN " : " ok  ";
    console.log(`[${lvl}] ${String(r.slug ?? r.id).padEnd(16)} id=${String(r.id).padStart(2)} obs=${String(r.observations).padStart(7)} age=${age === null ? "  —" : age.toFixed(1).padStart(6)}h  48h=${String(r.last_48h).padStart(6)}  7d=${String(r.last_7d).padStart(6)}`);
  }

  console.log("\n═══ 2. HOW ROWS ARRIVE — ingestion path, last 14 days ═══");
  const via = await pg.query(`
    select s.slug, o.payload->>'_ingested_via' via, count(*)::int n,
           round(extract(epoch from now()-max(o.scraped_at))/3600.0,1) age_h
    from raw_observations o join stores s on s.id=o.store_id
    where o.scraped_at > now() - interval '14 days'
    group by 1,2 order by 1,3 desc`);
  for (const r of via.rows as any[]) console.log(`   ${String(r.slug).padEnd(16)} via=${String(r.via ?? "(none)").padEnd(22)} n=${String(r.n).padStart(7)}  newest=${r.age_h}h`);

  console.log("\n═══ 3. INGESTION RHYTHM — distinct hours with arrivals, last 7 days ═══");
  const rhythm = await pg.query(`
    select s.slug, count(distinct date_trunc('hour', o.scraped_at))::int active_hours,
           min(o.scraped_at) first_seen, max(o.scraped_at) last_seen
    from raw_observations o join stores s on s.id=o.store_id
    where o.scraped_at > now() - interval '7 days' group by 1 order by 2 desc`);
  for (const r of rhythm.rows as any[]) console.log(`   ${String(r.slug).padEnd(16)} hours_with_arrivals=${String(r.active_hours).padStart(3)}   ${String(r.first_seen).slice(5,16)} → ${String(r.last_seen).slice(5,16)}`);

  console.log("\n═══ 4. SCHEDULES + RUNS (the ADR-069 dispatcher subsystem) ═══");
  for (const t of ["scraping_schedules", "scraping_runs"]) {
    const cols = await pg.query(`select column_name from information_schema.columns where table_name=$1 order by ordinal_position`, [t]);
    if (!cols.rows.length) { console.log(`   ${t}: TABLE DOES NOT EXIST`); continue; }
    const n = await pg.query(`select count(*)::int n from ${t}`);
    console.log(`   ${t}: ${n.rows[0].n} rows · columns: ${cols.rows.map((c: any) => c.column_name).join(", ")}`);
  }
  const sched = await pg.query(`select * from scraping_schedules limit 30`).catch(() => ({ rows: [] as any[] }));
  if (sched.rows.length) { console.log("   schedules:"); console.table(sched.rows); }
  const runs = await pg.query(`select * from scraping_runs order by 1 desc limit 10`).catch(() => ({ rows: [] as any[] }));
  if (runs.rows.length) { console.log("   most recent runs:"); console.table(runs.rows); }

  console.log("\n═══ 5. BACKPRESSURE STATE (gates discovery + feed at 500k, resumes at 400k) ═══");
  const bp = await pg.query(`select coalesce(sum((select count(*) from raw_observations o
      where o.store_id = k.store_id and o.id > k.last_raw_id)),0)::int rows_behind
    from tps_progress_cursors k where k.category = '_all_'`);
  const behind = Number(bp.rows[0].rows_behind);
  console.log(`   rows behind = ${behind}  → discovery ${behind >= 500000 ? "GATED (this alone would freeze every catalogue)" : "not gated"}`);

  console.log("\n═══ 6. PER-STORE CURSOR LAG ═══");
  const lag = await pg.query(`
    select s.slug, k.last_raw_id, (select count(*) from raw_observations o where o.store_id=k.store_id and o.id > k.last_raw_id)::int behind
    from tps_progress_cursors k join stores s on s.id=k.store_id where k.category='_all_' order by behind desc limit 15`);
  for (const r of lag.rows as any[]) console.log(`   ${String(r.slug).padEnd(16)} behind=${String(r.behind).padStart(7)}`);

  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
