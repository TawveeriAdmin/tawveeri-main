// scripts/tps-analysis/amazon-commercial-kpis.ts — Amazon commercial dashboard (2026-10-05, executive closure). READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// One page the founder can re-run any day. Every ratio prints its denominator. Four blocks:
//   INVENTORY QUALITY  offers total · claim-eligible (≤168h) · reference-only (stale) · unknown age · hot-set freshness buckets
//   IDENTITY           verified / review / reject for Amazon listings (the gate's own signals — nothing re-derived here)
//   COMMERCIAL         Amazon cheapest (verified, fresh, in stock) · comparison participation · out-of-stock-as-cheapest (must be 0)
//   FUNNEL             raw requests → human-evidenced exits → tagged human exits → partner orders → shipped qualifying → commission
// Funnel definitions (separated on purpose — a bot-inflated click is never a conversion denominator):
//   RAW REQUEST            every non-test, non-audit /go row to Amazon
//   HUMAN-EVIDENCED EXIT   interaction_id present  OR  (render-token valid AND a session) — the two approved human proofs (ADR-398)
//   TAGGED HUMAN EXIT      human-evidenced AND carries the affiliate tag
//   PARTNER-REPORTED ORDER / SHIPPED QUALIFYING ORDER  rows imported from the Associates report (`affiliate_conversions`)
// The ADR-398 regime (tag only on human evidence) began 2026-10-01; exits are reported both for the window and since that date.
//   npx tsx scripts/tps-analysis/amazon-commercial-kpis.ts [--days=7] [--live] [--out=…json]
// `--live` also probes tawveeri.com /api/search for a fixed query set (cards without observation time, accessory/off-grade picks, store filter).
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
const AMAZON_NAMES = ["%أمازون%", "%amazon%"];

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url || !url.includes("vyceqrzttspyycdpojtn")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only"); await pg.query("set statement_timeout=120000");
  const q = async (s: string, p: unknown[] = []) => (await pg.query(s, p)).rows;
  const o: Record<string, unknown> = { at: new Date().toISOString(), days: DAYS };

  // ── INVENTORY QUALITY ── TPS path: claim-eligible = valid, priced, observed ≤168h (the one predicate isFreshObservation uses)
  o.tps = (await q(`select count(*)::int valid, count(*) filter (where price > 0)::int priced,
      count(*) filter (where price > 0 and observed_at > now() - interval '168 hours')::int claim_eligible,
      count(*) filter (where price > 0 and observed_at <= now() - interval '168 hours')::int reference_only_stale,
      count(*) filter (where coalesce(price, 0) <= 0)::int current_null_price,
      count(*) filter (where observed_at is null)::int unknown_age
    from tps_current_offers where store_id = 2 and status = 'valid'`))[0];

  // Hot set = what a shopper or the business actually touches: comparison-visible (≥2 priced stores) OR clicked in the last 30d.
  o.hot_set_freshness = (await q(`with multi as (select identity_key from tps_current_offers where status = 'valid' and price > 0 group by 1 having count(distinct store_id) >= 2),
      clicked as (select distinct cp.tps_identity_key identity_key from outbound_clicks oc join canonical_products cp on cp.id = oc.canonical_product_id where oc.clicked_at > now() - interval '30 days'),
      hot as (select co.* from tps_current_offers co where co.store_id = 2 and co.status = 'valid' and co.price > 0
              and (co.identity_key in (select identity_key from multi) or co.identity_key in (select identity_key from clicked)))
    select count(*)::int hot_total,
      count(*) filter (where observed_at > now() - interval '24 hours')::int h24,
      count(*) filter (where observed_at > now() - interval '48 hours')::int h48,
      count(*) filter (where observed_at > now() - interval '168 hours')::int h168,
      count(*) filter (where observed_at <= now() - interval '168 hours')::int over168,
      count(*) filter (where observed_at is null)::int unknown
    from hot`))[0];

  // Legacy (storefront) path: visible rows and how many can prove an observation at all
  o.legacy = (await q(`select count(*)::int visible,
      count(*) filter (where ps.last_seen_at is null and ps.last_scraped_at is null)::int no_observation_time,
      count(*) filter (where ps.product_url ~ '(qid|dib)=')::int search_url_with_session_params
    from product_stores ps join products p on p.id = ps.product_id
    where ps.store_id = 2 and ps.store_name is not null and p.is_active and ps.current_price > 0 and ps.availability = 'in_stock' and ps.price_quarantined_at is null`))[0];

  // ── IDENTITY ── the gate's own signals for Amazon listings (store 2). verified = comparison-visible Amazon offers with no review/reject signal.
  o.identity = (await q(`with amz as (select co.identity_key, cp.id canonical_id from tps_current_offers co join canonical_products cp on cp.tps_identity_key = co.identity_key
                                      where co.store_id = 2 and co.status = 'valid' and co.price > 0),
      sig as (select canonical_product_id, verdict from tps_offer_identity_signals where store_id = 2)
    select (select count(*)::int from amz) amazon_priced_listings,
           (select count(*)::int from sig where verdict = 'review') review,
           (select count(*)::int from sig where verdict = 'reject') reject,
           (select count(*)::int from amz where canonical_id not in (select canonical_product_id from sig)) no_flag`))[0];

  // ── COMMERCIAL ──
  o.commercial = (await q(`select
      (select count(*)::int from tps_product_projection where cheapest_store like 'أمازون%') amazon_cheapest_rows,
      (select count(distinct co.identity_key)::int from tps_current_offers co where co.store_id = 2 and co.status = 'valid' and co.price > 0
         and co.identity_key in (select identity_key from tps_current_offers where status = 'valid' and price > 0 group by 1 having count(distinct store_id) >= 2)) comparison_participation,
      (select count(distinct co.identity_key)::int from tps_current_offers co where co.store_id = 2 and co.status = 'valid' and co.price > 0) amazon_priced_canonicals`))[0];

  // The acceptance count: a store whose CURRENT offer has no usable price (or is out of stock) must never be the projection's cheapest.
  o.unavailable_or_null_in_cheapest = (await q(`select count(*)::int n,
      count(*) filter (where p.category = 'tv')::int tv
    from tps_product_projection p
    where p.cheapest_store is not null and exists (
      select 1 from tps_current_offers co join stores s on s.id = co.store_id
      where co.identity_key = p.tps_identity_key and co.status = 'valid'
        and (coalesce(co.price, 0) <= 0 or co.payload->>'_availability' = 'out_of_stock')
        and (p.cheapest_store in (s.name_ar, s.name_en) or (s.id = 2 and p.cheapest_store like 'أمازون%'))
        and not exists (select 1 from tps_current_offers o2 where o2.identity_key = co.identity_key and o2.store_id = co.store_id and o2.status = 'valid' and o2.price > 0
                          and coalesce(o2.payload->>'_availability', '') <> 'out_of_stock'))`))[0];

  // Overlap legacy ↔ TPS by ASIN (same listing visible twice if not consolidated at read time)
  o.asin_overlap = (await q(`with l as (select substring(product_url from '/dp/([A-Z0-9]{10})') asin from product_stores where store_id = 2 and product_url ~ '/dp/[A-Z0-9]{10}'),
      t as (select substring(url from '/dp/([A-Z0-9]{10})') asin from tps_current_offers where store_id = 2 and status = 'valid')
    select (select count(distinct asin)::int from l) legacy_asins, (select count(distinct asin)::int from t) tps_asins, (select count(distinct l.asin)::int from l join t using (asin)) overlap`))[0];

  // ── FUNNEL ──
  const exitSql = (from: string) => `select count(*)::int raw_requests,
      count(*) filter (where is_test)::int test,
      count(*) filter (where not is_test and user_agent ~* '(bot|crawler|spider|curl|python|headless)')::int bot_ua,
      count(*) filter (where not is_test and (interaction_id is not null or (interaction_provenance = 'render_token_valid' and session_id is not null)))::int human_evidenced,
      count(*) filter (where not is_test and affiliate_tag is not null)::int tagged,
      count(*) filter (where not is_test and affiliate_tag is not null and (interaction_id is not null or (interaction_provenance = 'render_token_valid' and session_id is not null)))::int tagged_human,
      count(*) filter (where product_store_id is not null)::int through_go_ps
    from outbound_clicks where store_name ilike any ($1) and coalesce(source, '') <> 'audit_verify' and ${from}`;
  o.funnel_window = (await q(exitSql(`clicked_at > now() - ($2 || ' days')::interval`), [AMAZON_NAMES, String(DAYS)]))[0];
  o.funnel_since_adr398 = (await q(exitSql(`clicked_at >= '2026-10-01T00:00:00Z'`), [AMAZON_NAMES]))[0];
  o.partner = (await q(`select count(*)::int reported_orders, count(*) filter (where state = 'SHIPPED')::int shipped_qualifying,
      coalesce(sum(commission_amount) filter (where state = 'SHIPPED'), 0)::float commission_sar
    from affiliate_conversions where source ilike '%amazon%'`).catch(() => [{ reported_orders: null, shipped_qualifying: null, commission_sar: null }]))[0];

  const t = o.tps as Record<string, number>, h = o.hot_set_freshness as Record<string, number>, l = o.legacy as Record<string, number>;
  const id = o.identity as Record<string, number>, c = o.commercial as Record<string, number>, w = o.funnel_window as Record<string, number>, s98 = o.funnel_since_adr398 as Record<string, number>;
  const pr = o.partner as Record<string, number | null>;
  const summary = {
    inventory: {
      amazon_valid_offers: t.valid, priced: pct(t.priced, t.valid),
      claim_eligible_le168h: pct(t.claim_eligible, t.valid), reference_only_stale: pct(t.reference_only_stale, t.valid),
      current_null_price: pct(t.current_null_price, t.valid), unknown_age_tps: pct(t.unknown_age, t.valid),
      legacy_visible_without_observation_time: pct(l.no_observation_time, l.visible),
      hot_set: { total: h.hot_total, le24h: pct(h.h24, h.hot_total), le48h: pct(h.h48, h.hot_total), le168h: pct(h.h168, h.hot_total), over168h: pct(h.over168, h.hot_total), unknown: pct(h.unknown, h.hot_total) },
    },
    identity: { amazon_priced_listings: id.amazon_priced_listings, review: pct(id.review, id.amazon_priced_listings), reject: pct(id.reject, id.amazon_priced_listings), no_flag: pct(id.no_flag, id.amazon_priced_listings) },
    commercial: {
      amazon_cheapest_rows: c.amazon_cheapest_rows, comparison_participation: pct(c.comparison_participation, c.amazon_priced_canonicals),
      unavailable_or_null_price_store_named_cheapest: (o.unavailable_or_null_in_cheapest as Record<string, number>).n,
    },
    funnel: {
      window_days: DAYS,
      raw_requests: w.raw_requests, human_evidenced: pct(w.human_evidenced, w.raw_requests), tagged: pct(w.tagged, w.raw_requests),
      tagged_human: pct(w.tagged_human, w.human_evidenced), through_go_ps: pct(w.through_go_ps, w.raw_requests),
      since_adr398: { raw_requests: s98.raw_requests, human_evidenced: pct(s98.human_evidenced, s98.raw_requests), tagged: pct(s98.tagged, s98.raw_requests), tagged_human: pct(s98.tagged_human, s98.human_evidenced) },
      partner_reported_orders: pr.reported_orders, shipped_qualifying_orders: pr.shipped_qualifying, commission_sar: pr.commission_sar,
    },
  };

  if (LIVE) {
    const post = async (b: unknown) => (await fetch("https://tawveeri.com/api/search", { method: "POST", headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 kpi" }, body: JSON.stringify(b) })).json() as Promise<{ decisionCard?: { store_name?: string; is_tps?: boolean; last_observed_at?: string | null; title?: string }; products?: { stores?: { store?: string; product_url?: string }[] }[]; total?: number }>;
    const qs = ["ps5", "nintendo switch", "airpods pro", "samsung tv 65", "sony wh-1000xm5", "iphone 15", "dyson", "gopro", "mac book air", "air fryer"];
    let cards = 0, noObs = 0, accessoryPicks = 0, offGradePicks = 0; const probes: unknown[] = [];
    for (const query of qs) {
      const j = await post({ query }); const cd = j.decisionCard; if (cd) { cards++; if (!cd.last_observed_at) noObs++; if (/headset|headphone|controller/i.test(cd.title || "") && /^(ps5|nintendo switch)$/i.test(query)) accessoryPicks++; if (/renewed|refurbished|مجدد|مستعمل/i.test(cd.title || "")) offGradePicks++; }
      probes.push({ query, card: cd ? { store: cd.store_name, tps: cd.is_tps, observed: !!cd.last_observed_at } : null });
    }
    const filt = await post({ query: "tv", stores: ["amazon"] });
    const amazonOnly = (filt.products ?? []).every((p) => (p.stores ?? []).some((st) => /amazon|أمازون/i.test(st.store ?? "")));
    (summary as Record<string, unknown>).live = { queries: qs.length, cards, cards_without_observation_time: noObs, accessory_picks_for_device_queries: accessoryPicks, off_grade_picks: offGradePicks, store_filter_amazon_restricts_results: amazonOnly };
    o.live_probes = probes;
  }
  o.summary = summary;
  await pg.query("rollback"); await pg.end();
  if (OUT) writeFileSync(resolve(process.cwd(), OUT), JSON.stringify(o, null, 1));
  console.log(JSON.stringify({ summary, asin_overlap: o.asin_overlap }, null, 1));
})().catch((err) => { console.error("FATAL", err instanceof Error ? err.message : err); process.exit(1); });
