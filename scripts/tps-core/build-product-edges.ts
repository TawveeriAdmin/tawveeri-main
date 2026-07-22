// scripts/tps-core/build-product-edges.ts
// Materialize knowledge-graph relationship edges into tps_product_edges. Maps each
// category's Product DNA to the edge engine's shape and derives deterministic
// storage_variant + successor edges. Idempotent (rebuild = truncate + insert).
// Read-only on canonicals/projection.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { readFileSync } from "fs";
import { Client } from "pg";
import { assertFingerprint } from "./tps-batch";
import { deriveProductEdges, type EdgeCanonical } from "../../src/lib/intelligence/product-edges";

// Per-category DNA → EdgeCanonical field mapping.
const MAP: Record<string, { family: string; generation: string | null; variant: string | null; storage: string }> = {
  mobile: { family: "family", generation: "generation", variant: "variant", storage: "storage" },
  tablet: { family: "line", generation: "gen", variant: "connectivity", storage: "storage" },
};

(async () => {
  assertFingerprint(process.env.NEXT_PUBLIC_SUPABASE_URL || "", "vyceqrzttspyycdpojtn");
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("set statement_timeout = 0");
  await pg.query(readFileSync(resolve(process.cwd(), "scripts/database/knowledge-db/024_product_edges.sql"), "utf8"));
  await pg.query("truncate table tps_product_edges");

  let total = 0; const byCat: Record<string, number> = {};
  for (const [cat, m] of Object.entries(MAP)) {
    const { rows } = await pg.query(
      `select c.id, c.brand, c.attributes, p.lowest_price
       from canonical_products c
       left join tps_product_projection p on p.canonical_id = c.id
       where c.category = $1 and c.tps_identity_key is not null and c.attributes ? $2`,
      [cat, m.family]
    );
    const canonicals: EdgeCanonical[] = rows.map((r) => {
      const a = r.attributes ?? {};
      const stRaw = m.storage ? a[m.storage] : null;
      return {
        id: r.id, brand: r.brand,
        family: a[m.family] ?? null,
        generation: m.generation ? (a[m.generation] ?? null) : null,
        variant: m.variant ? (a[m.variant] ?? null) : null,
        storage: stRaw != null && /^\d+$/.test(String(stRaw)) ? Number(stRaw) : null,
        price: r.lowest_price != null ? Number(r.lowest_price) : null,
      };
    });
    const edges = deriveProductEdges(canonicals);
    for (const e of edges) {
      await pg.query(
        `insert into tps_product_edges (from_id, to_id, type, price_delta, detail, category, updated_at)
         values ($1,$2,$3,$4,$5,$6, now()) on conflict (from_id, to_id, type) do nothing`,
        [e.from_id, e.to_id, e.type, e.price_delta, e.detail, cat]
      );
    }
    byCat[cat] = edges.length; total += edges.length;
    console.log(`  ${cat}: ${canonicals.length} canonicals → ${edges.length} edges`);
  }
  console.log(`\nTOTAL edges: ${total}`); console.table(byCat);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
