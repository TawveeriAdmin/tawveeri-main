import { config } from "dotenv"; import { resolve } from "path"; config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg"; import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";
(async () => {
  const url = process.env.SUPABASE_DB_URL!; if (!url.includes("vyceqrzttspyycdpojtn")) throw new Error("not prod");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } }); await pg.connect(); await pg.query("begin read only");
  const q = async (sql: string, p: unknown[] = []) => (await pg.query(sql, p)).rows;
  // Store id -> slug from the ONE authority (approved-retailers STORE_ID_TO_SLUG). A hand-written map here once swapped 10/18/23 (blackbox/alnakheelk/lulu).
  const STORE: Record<number, string> = new Proxy({} as Record<number, string>, { get: (_t, k) => resolveApprovedSlug(Number(k)) ?? String(k) });
  const tot = await q(`select co.store_id, count(*) n from tps_current_offers co where co.status='valid' group by 1 order by 1`);
  console.log("offers/store", JSON.stringify(tot));
  for (const cat of ["tv","vacuum"]) for (const [id,name] of Object.entries(STORE)) {
    const keys = await q(`select k, count(*) c from tps_current_offers co join raw_observations r on r.id=co.raw_obs_id, jsonb_object_keys(r.payload) k where co.status='valid' and co.category=$1 and co.store_id=$2 group by k order by c desc limit 40`, [cat, Number(id)]);
    const n = await q(`select count(*) n from tps_current_offers where status='valid' and category=$1 and store_id=$2`, [cat, Number(id)]);
    if (!Number(n[0].n)) continue;
    const spec = await q(`select lower(regexp_replace(k,'[\s:]+',' ','g')) k, count(*) c from tps_current_offers co join raw_observations r on r.id=co.raw_obs_id, jsonb_object_keys(case when jsonb_typeof(r.payload->'specifications')='object' then r.payload->'specifications' else '{}'::jsonb end) k where co.status='valid' and co.category=$1 and co.store_id=$2 group by 1 order by c desc limit 25`, [cat, Number(id)]);
    console.log(`\n## ${cat}/${name} n=${n[0].n}\n payload keys: ${keys.map((x:any)=>x.k+":"+x.c).join(", ")}\n spec keys: ${spec.map((x:any)=>x.k+":"+x.c).join(", ")}`);
  }
  await pg.query("rollback"); await pg.end();
})();
