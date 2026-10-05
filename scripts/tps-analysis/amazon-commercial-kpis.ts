// scripts/tps-analysis/amazon-commercial-kpis.ts — Amazon commercial-truth scorecard (2026-10-05). READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// One summary the founder can read: how much of Amazon's visible inventory can carry a commercial CLAIM, how much is reference-only,
// whether any current-null offer can still win a "cheapest", and what human exits actually looked like. No bot-inflated denominators:
// every ratio prints its denominator, and exits are split into human-evidenced / raw / bot / test.
//   npx tsx scripts/tps-analysis/amazon-commercial-kpis.ts [--days=7] [--live] [--out=…json]
// `--live` also probes tawveeri.com /api/search for a fixed query set (cards without observation time, accessory picks, store filter).
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const argv = process.argv.slice(2);
const DAYS = Number(argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7);
const LIVE = argv.includes("--live");
const OUT = argv.find((a) => a.startsWith("--out="))?.split("=").slice(1).join("=");
const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : `${n}/0`);

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url || !url.includes("vyceqrzttspyycdpojtn")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only"); await pg.query("set statement_timeout=120000");
  const q = async (s: string, p: unknown[] = []) => (await pg.query(s, p)).rows;
  const o: Record<string, unknown> = { at: new Date().toISOString(), days: DAYS };

  // TPS path: claim-eligible = valid, priced, observed ≤168h (the single predicate isFreshObservation uses)
  o.tps = (await q(`select count(*)::int valid, count(*) filter (where price > 0)::int priced,
      count(*) filter (where price > 0 and observed_at > now() - interval '168 hours')::int claim_eligible,
      count(*) filter (where price > 0 and observed_at > now() - interval '24 hours')::int h24,
      count(*) filter (where price > 0 and observed_at > now() - interval '48 hours')::int h48,
      count(*) filter (where price > 0 and observed_at <= now() - interval '168 hours')::int stale_reference,
      count(*) filter (where coalesce(price, 0) <= 0)::int current_null_price
    from tps_current_offers where store_id = 2 and status = 'valid'`))[0];

  // Legacy (storefront) path: visible rows and how many can prove an observation at all
  o.legacy = (await q(`select count(*)::int visible,
      count(*) filter (where ps.last_seen_at is null and ps.last_scraped_at is null)::int no_observation_time,
      count(*) filter (where p.canonical_product_id is null)::int no_canonical,
      count(*) filter (where ps.product_url ~ '(qid|dib)=')::int search_url_with_session_params,
      count(*) filter (where ps.product_url ~ '/sspa/')::int sponsored_click_urls
    from product_stores ps join products p on p.id = ps.product_id
    where ps.store_id = 2 and ps.store_name is not null and p.is_active and ps.current_price > 0 and ps.availability = 'in_stock' and ps.price_quarantined_at is null`))[0];

  // Projection: can a current-null Amazon offer still be a cheapest store?
  o.current_null_in_cheapest = (await q(`select count(*)::int n from tps_product_projection p join tps_current_offers co
      on co.identity_key = p.tps_identity_key and co.store_id = 2 and co.status = 'valid' and coalesce(co.price, 0) <= 0
     where p.cheapest_store in ('أمازون', 'أمازون السعودية')`))[0];

  // Overlap legacy ↔ TPS by ASIN (same listing visible twice if not consolidated at read time)
  o.asin_overlap = (await q(`with l as (select substring(product_url from '/dp/([A-Z0-9]{10})') asin from product_stores where store_id = 2 and product_url ~ '/dp/[A-Z0-9]{10}'),
      t as (select substring(url from '/dp/([A-Z0-9]{10})') asin from tps_current_offers where store_id = 2 and status = 'valid')
    select (select count(distinct asin)::int from l) legacy_asins, (select count(distinct asin)::int from t) tps_asins, (select count(distinct l.asin)::int from l join t using (asin)) overlap`))[0];

  // Exits (Amazon only): human-evidenced vs raw vs bot vs test, tagged vs untagged
  o.exits = (await q(`select count(*)::int total,
      count(*) filter (where is_test)::int test,
      count(*) filter (where not is_test and user_agent ~* '(bot|crawler|spider|curl|python|headless)')::int bot_ua,
      count(*) filter (where not is_test and interaction_id is not null)::int with_interaction_id,
      count(*) filter (where not is_test and interaction_provenance = 'render_token_valid')::int render_token_valid,
      count(*) filter (where not is_test and interaction_provenance = 'raw_request')::int raw_request,
      count(*) filter (where affiliate_tag is not null)::int tagged,
      count(*) filter (where affiliate_tag is not null and not is_test and interaction_id is not null)::int tagged_human_evidenced,
      count(*) filter (where product_store_id is not null)::int legacy_ps_exits
    from outbound_clicks where store_name ilike any (array['%أمازون%', '%amazon%']) and coalesce(source, '') <> 'audit_verify' and clicked_at > now() - ($1 || ' days')::interval`, [String(DAYS)]))[0];

  const t = o.tps as Record<string, number>, l = o.legacy as Record<string, number>, e = o.exits as Record<string, number>;
  const summary = {
    claim_eligible_tps_offers: pct(t.claim_eligible, t.valid),
    reference_only_stale_tps: pct(t.stale_reference, t.valid),
    current_null_offers: pct(t.current_null_price, t.valid),
    legacy_visible_without_observation_time: pct(l.no_observation_time, l.visible),
    current_null_offers_winning_cheapest: (o.current_null_in_cheapest as Record<string, number>).n,
    human_evidenced_tagged_exits: pct(e.tagged_human_evidenced, e.total),
    legacy_exits_through_go: pct(e.legacy_ps_exits, e.total),
  };

  if (LIVE) {
    const post = async (b: unknown) => (await fetch("https://tawveeri.com/api/search", { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 kpi" }, body: JSON.stringify(b) })).json() as Promise<{ decisionCard?: { store_name?: string; is_tps?: boolean; last_observed_at?: string | null; title?: string }; products?: { stores?: { store?: string; product_url?: string }[] }[]; total?: number }>;
    const qs = ["ps5", "nintendo switch", "airpods pro", "samsung tv 65", "sony wh-1000xm5", "iphone 15", "dyson", "gopro", "mac book air", "air fryer"];
    let cards = 0, noObs = 0, accessoryPicks = 0; const probes: unknown[] = [];
    for (const query of qs) {
      const j = await post({ query }); const c = j.decisionCard; if (c) { cards++; if (!c.last_observed_at) noObs++; if (/headset|headphone|controller/i.test(c.title || "") && /^(ps5|nintendo switch)$/i.test(query)) accessoryPicks++; }
      probes.push({ query, card: c ? { store: c.store_name, tps: c.is_tps, observed: !!c.last_observed_at } : null });
    }
    const filt = await post({ query: "tv", stores: ["amazon"] });
    const amazonOnly = (filt.products ?? []).every((p) => (p.stores ?? []).some((s) => /amazon|أمازون/i.test(s.store ?? "")));
    (summary as Record<string, unknown>).live = { queries: qs.length, cards, cards_without_observation_time: noObs, accessory_picks_for_device_queries: accessoryPicks, store_filter_amazon_restricts_results: amazonOnly };
    o.live_probes = probes;
  }
  o.summary = summary;
  await pg.query("rollback"); await pg.end();
  if (OUT) writeFileSync(resolve(process.cwd(), OUT), JSON.stringify(o, null, 1));
  console.log(JSON.stringify({ summary, tps: o.tps, legacy: o.legacy, asin_overlap: o.asin_overlap, exits: o.exits }, null, 1));
})().catch((err) => { console.error("FATAL", err instanceof Error ? err.message : err); process.exit(1); });
