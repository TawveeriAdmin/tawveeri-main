// scripts/tps-core/build-projection-presentation.ts
// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION PRESENTATION LAYER (ADR-063) — images + measured exit links.
//
// `build-tps-projection.ts` computes prices and comparison facts but never
// touched `image_url`, and its header deferred `affiliate_best_url` to "an
// independent script later" that was never written. Measured consequence on
// 2026-07-23: **0 of 1,215 products had an image and 0 had an exit link**, even
// though 100% of raw observations carry image evidence and 21,704 normalized
// observations carry an offer URL. Customers saw a price table with no pictures
// and no way to buy. This is that missing script.
//
// Two fields, both derived from the CHEAPEST offer so the card is coherent:
//   image_url          — validated real image (see src/lib/catalog/product-image)
//   affiliate_best_url — `/go/<offer_id>`, a MEASURED exit, never a raw store URL.
//     The API contract requires clients to exit through /go so every click is
//     attributed and the commission layer stays observable. Publishing a raw
//     store URL here would create an unmeasured leak around that guarantee.
//
// Idempotent, bulk, read-only on evidence. Usage: npm run tps:presentation [-- --dry]
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { pickProductImage, isUsableImageUrl } from "../../src/lib/catalog/product-image";

const DRY = process.argv.includes("--dry");

interface OfferRow {
  canonical_id: string;
  offer_id: string;
  price: number | null;
  image_raw: string | null;
  url: string | null;
}

(async () => {
  const url = process.env.SUPABASE_DB_URL!;
  // See build-tps-projection.ts: accept direct host AND pooler form (ADR-078).
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // One bulk read: every projection product's offers, with the raw image payload
  // from the immutable observation behind each offer.
  const { rows } = await pg.query<OfferRow>(`
    select p.canonical_id,
           n.id as offer_id,
           ph.price::float8 as price,
           coalesce(o.payload->>'image_urls', o.payload->>'imageUrl', o.payload->>'image_url') as image_raw,
           n.normalized_payload->>'_url' as url
    from tps_product_projection p
    join normalized_product_observations n on n.canonical_product_id = p.canonical_id
    left join raw_observations o
      on (n.normalized_payload->>'_raw_id') ~ '^[0-9]+$'
     and o.id = (n.normalized_payload->>'_raw_id')::bigint
    left join lateral (
      select price from price_history h
      where h.canonical_product_id = p.canonical_id
        and h.tps_observation_id = n.id
      order by observed_at desc limit 1
    ) ph on true
  `);

  const byProduct = new Map<string, OfferRow[]>();
  for (const r of rows) (byProduct.get(r.canonical_id) ?? byProduct.set(r.canonical_id, []).get(r.canonical_id)!).push(r);

  const updates: { id: string; image: string | null; exit: string | null }[] = [];
  let withImage = 0, withExit = 0, imagelessProducts = 0;
  const rejectedHosts = new Map<string, number>();

  for (const [canonicalId, offers] of byProduct) {
    const image = pickProductImage(offers.map((o) => ({ raw: o.image_raw, price: o.price })));
    if (image) withImage++; else imagelessProducts++;

    // Diagnose WHY a product has no image, so store-side defects stay visible
    // instead of silently degrading the catalogue.
    if (!image) {
      for (const o of offers) {
        const raw = (o.image_raw ?? "").slice(0, 200);
        if (!raw) { rejectedHosts.set("(no image field)", (rejectedHosts.get("(no image field)") ?? 0) + 1); continue; }
        const m = /https?:\/\/([^/"\\]+)/i.exec(raw);
        const key = /;base64,|data:image/i.test(raw) ? "(base64 placeholder)" : m ? m[1] : "(unparseable)";
        rejectedHosts.set(key, (rejectedHosts.get(key) ?? 0) + 1);
      }
    }

    // Measured exit from the cheapest offer that actually has a URL.
    const cheapestWithUrl = [...offers]
      .filter((o) => o.url)
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0];
    const exit = cheapestWithUrl ? `/go/${cheapestWithUrl.offer_id}` : null;
    if (exit) withExit++;

    updates.push({ id: canonicalId, image, exit });
  }

  console.log(`products=${byProduct.size}  with image=${withImage}  with measured exit=${withExit}  imageless=${imagelessProducts}`);
  if (rejectedHosts.size) {
    console.log(`\nwhy products still have no image (offer-level causes):`);
    for (const [k, v] of [...rejectedHosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      const note = isUsableImageUrl(`https://${k}/x.jpg`) ? "" : "  ← host not in the verified list";
      console.log(`   ${String(v).padStart(6)}  ${k}${k.includes("(") ? "" : note}`);
    }
  }
  if (DRY) { console.log("\n--dry: nothing written"); await pg.end(); return; }

  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const vals: string[] = []; const params: unknown[] = [];
    chunk.forEach((u, j) => {
      const b = j * 3;
      vals.push(`($${b + 1}::uuid, $${b + 2}::text, $${b + 3}::text)`);
      params.push(u.id, u.image, u.exit);
    });
    const res = await pg.query(
      `update tps_product_projection p
         set image_url = v.image, affiliate_best_url = v.exit, updated_at = now()
       from (values ${vals.join(",")}) as v(canonical_id, image, exit)
       where p.canonical_id = v.canonical_id
         and (p.image_url is distinct from v.image or p.affiliate_best_url is distinct from v.exit)`,
      params
    );
    written += res.rowCount ?? 0;
  }
  console.log(`\nPRESENTATION updated=${written} product(s)`);
  console.log(`Search index must be re-synced to expose these: npm run tps:refresh -- --only search`);
  await pg.end();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
