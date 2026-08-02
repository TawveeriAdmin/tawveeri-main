import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg"; import { toPoolerDbUrl } from "../tps-core/pooler-url";
(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const r = await pg.query(`select r.id, coalesce(s.slug,r.store_name) store, r.status, r.products_discovered d,
      r.errors_count, r.duration_ms, r.error_summary, r.error_message,
      round(extract(epoch from now()-r.started_at)/60.0,1) min_ago
    from scraping_runs r left join stores s on s.id=r.store_id
    where r.started_at > now() - interval '40 minutes' order by r.started_at desc limit 8`);
  for (const x of r.rows as any[]) {
    console.log(`\nid=${x.id} ${x.store} ${x.status} discovered=${x.d} errors=${x.errors_count} dur=${x.duration_ms}ms ${x.min_ago}m ago`);
    if (x.error_summary) console.log(`   error_summary: ${JSON.stringify(x.error_summary).slice(0,500)}`);
    if (x.error_message) console.log(`   error_message: ${String(x.error_message).slice(0,300)}`);
  }
  await pg.end();
})().catch(e=>{console.error(e);process.exit(1);});
