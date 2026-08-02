import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg"; import { toPoolerDbUrl } from "../tps-core/pooler-url";
(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const before = await pg.query(`select count(*)::int n from scraping_runs where status in ('running','pending') and started_at < now() - interval '120 minutes'`);
  console.log("stale open runs before:", before.rows[0].n);
  const r = await pg.query(`update scraping_runs set status='failed', finished_at=now(),
      error_message='run never completed — one-time reap 2026-08-02 (see run-logger.reapStaleRuns)'
    where status in ('running','pending') and started_at < now() - interval '120 minutes' returning id`);
  console.log("reaped:", r.rowCount);
  const after = await pg.query(`select coalesce(s.slug,r.store_name) store, count(*)::int n from scraping_runs r
    left join stores s on s.id=r.store_id where r.status in ('running','pending') group by 1 order by 2 desc`);
  console.log("still open (live, <120m):"); for (const x of after.rows as any[]) console.log(`   ${x.store}: ${x.n}`);
  await pg.end();
})().catch(e=>{console.error(e);process.exit(1);});
