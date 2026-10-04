// scripts/tps-analysis/tv-short-model-research.ts — TV short-model identity research (2026-10-04). READ-ONLY, shadow only.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Why: Wave 1's audit sample found TV groups holding two different manufacturer codes (TCL 85T8D vs 85C6K PRO, Hisense Q71Q vs
// 65S7N) that the identity gate cannot see: the gate's inputs never carry short manufacturer codes. Diagnosis: the TV plugin
// builds a model number from three lanes (payload → title → size-prefixed short code, ADR-177) but the verifier's callers
// (compare page, signals job) read only the first lane, and ADR-177's lane additionally requires the code verbatim in the title.
//
// This script measures, with labels that do NOT come from the extractor under test:
//   1. what each lane sees, per brand and per merchant;
//   2. how reliable each merchant's structured fields are (declared value present in the listing's own title / corroborated by
//      ANOTHER merchant independently stating the same code);
//   3. what the verifier would decide for every multi-store TV group under three wirings:
//        P0 current gate wiring   : extractManufacturerModel(payload)
//        P1 plugin parity         : the TV plugin's own model_number (payload → title → size-prefixed)
//        P2 P1 + declared field   : P1, else a short code declared in mpn/modelNumber/model_number (never `model`)
//        P3 P2 + title short code : P2, else a size-prefixed short code READ FROM THE TITLE under the ADR-177 conditions (shape, size
//                                   self-consistency, not a prefix of a longer token, panel/spec words refused) — the Amazon side of 85T8D
//   4. the traps a permissive rule would fall into (sizes, refresh rates, panel words, retailer SKUs, ASINs, whole titles).
// Output: a labelled dataset + replay JSON under docs/evidence/.../tv-short-model/.
//
//   npx tsx scripts/tps-analysis/tv-short-model-research.ts [--out=docs/evidence/.../tv-short-model]
import { config } from "dotenv";
import { resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { extractManufacturerModel, extractManufacturerModelFromName, extractSizePrefixedModel } from "../../src/lib/identity/store-identifiers";
// ONE implementation of the prototype lanes, shared with the regression fixtures (src/lib/identity/tv-short-model.ts — shadow only).
import { declaredShortModel, titleShortModel, titleWordRefusal, titleWords, screenSizeOf, trapClass, composeVerifierModel, DECLARED_FIELDS } from "../../src/lib/identity/tv-short-model";
import { normalize as tvNormalize } from "../tps-plugins/tv/parser";
import { resolveGroup, modelCodeOfKey } from "../tps-core/identity-verifier";

const argv = process.argv.slice(2);
const OUT = argv.find((a) => a.startsWith("--out="))?.split("=").slice(1).join("=") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/tv-short-model";
const STORE_SLUG: Record<number, string> = { 1: "jarir", 2: "amazon", 3: "noon", 4: "extra", 5: "almanea", 6: "samsung_ksa", 7: "shaker", 9: "najm", 18: "blackbox", 23: "alnakheelk", 8: "swsg" };
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const brandOf = (title: string, key: string | null) => {
  const k = (key ?? "").split("|")[0];
  if (k && !/^\d/.test(k)) return k;
  const m = /samsung|lg|sony|tcl|hisense|toshiba|panasonic|skyworth|xiaomi|philips|nikai|impex|haier/i.exec(title);
  return m ? m[0].toLowerCase() : "other";
};


// Whole-token view of a title: every normalized word AND every adjacent word pair (a code the merchant splits, "85C6K" + "PRO").
// Corroboration must be a WHOLE token — `85T` is a substring of `85T8D` and must never count as confirmed by it.
function tokenSet(title: string): Set<string> {
  const words = title.toUpperCase().split(/[\s,()/|–—:;"'،]+/).map((w) => norm(w)).filter(Boolean);
  const out = new Set(words);
  for (let i = 0; i + 1 < words.length; i++) out.add(words[i] + words[i + 1]);
  return out;
}


type Listing = { key: string; category: string; cid: string; store: number; title: string; payload: Record<string, unknown>; brand: string };

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const rows = (await pg.query(
    `select cp.id::text as cid, cp.tps_identity_key as key, co.store_id, co.name,
            jsonb_build_object('mpn', r.payload->'mpn', 'modelNumber', r.payload->'modelNumber', 'model_number', r.payload->'model_number', 'model', r.payload->'model',
                               'sku', r.payload->'sku', 'brand', r.payload->'brand', 'specifications', r.payload->'specifications') as payload
       from canonical_products cp
       join tps_current_offers co on co.identity_key = cp.tps_identity_key and co.status = 'valid' and co.payload->>'_superseded_by_identity' is null
       left join raw_observations r on r.id = co.raw_obs_id
      where cp.is_active and cp.category = 'tv' order by cp.id, co.store_id`)).rows as { cid: string; key: string; store_id: number; name: string; payload: Record<string, unknown> }[];
  await pg.query("rollback"); await pg.end();

  const L: Listing[] = rows.map((r) => ({ key: r.key, category: "tv", cid: r.cid, store: Number(r.store_id), title: r.name ?? "", payload: r.payload ?? {}, brand: brandOf(r.name ?? "", r.key) }));
  const byGroup = new Map<string, Listing[]>();
  for (const l of L) { const g = byGroup.get(l.cid); if (g) g.push(l); else byGroup.set(l.cid, [l]); }

  // ── per-listing lane outputs ──
  const lane = (l: Listing) => {
    const A = extractManufacturerModel(l.payload);
    const plugin = tvNormalize("", l.title, null, l.payload).model_number; // the TV plugin's own derivation (payload → title → size-prefixed)
    const N = extractManufacturerModelFromName(l.title);
    const S = (() => { const m = /(\d{2,3})\s?(?:"|”|inch|بوصة|انش|إنش)/i.exec(l.title); return extractSizePrefixedModel(l.payload, l.title, m ? Number(m[1]) : null); })();
    const D = declaredShortModel(l.payload, l.title);
    const T = titleShortModel(l.title);
    return { A, N, S, plugin, D, T, P0: A, P1: plugin, P2: plugin ?? D, P3: composeVerifierModel(plugin, l.payload, l.title) };
  };
  const laneOf = new Map<Listing, ReturnType<typeof lane>>(L.map((l) => [l, lane(l)]));

  // ── token dataset with independent labels ──
  type Rec = { brand: string; store: string; source: string; token: string; label: string; trap: string | null; corroborated_by: string[]; own_title_contains: boolean; accepted_by: string[]; title: string };
  const dataset: Rec[] = [];
  for (const [, G] of byGroup) {
    const stores = new Set(G.map((x) => x.store));
    for (const l of G) {
      const ln = laneOf.get(l)!;
      const fields = ([...DECLARED_FIELDS, "model"] as const).map((f) => [f, l.payload[f]] as const).filter(([, v]) => typeof v === "string" && (v as string).trim());
      for (const [f, v] of fields) {
        const token = norm(v as string);
        if (!token || token.length > 24) continue; // whole titles are recorded below as `whole_title`
        const trap = trapClass(token);
        const others = G.filter((o) => o.store !== l.store);
        const corroborated = stores.size > 1 ? others.filter((o) => tokenSet(o.title).has(token) || DECLARED_FIELDS.some((ff) => typeof o.payload[ff] === "string" && norm(o.payload[ff] as string) === token)).map((o) => STORE_SLUG[o.store] ?? String(o.store)) : [];
        const own = tokenSet(l.title).has(token);
        const label = trap ? `non_model:${trap}` : corroborated.length ? "model_confirmed_cross_merchant" : own && /\d/.test(token) && /[A-Z]/.test(token) ? "model_declared_in_own_title" : /\d/.test(token) && /[A-Z]/.test(token) ? "declared_uncorroborated" : "unlabelled";
        const accepted = (["P0", "P1", "P2", "P3"] as const).filter((p) => ln[p] && norm(ln[p] as string) === token);
        dataset.push({ brand: l.brand, store: STORE_SLUG[l.store] ?? String(l.store), source: f, token, label, trap, corroborated_by: corroborated, own_title_contains: own, accepted_by: accepted, title: l.title.slice(0, 90) });
      }
      for (const [f, v] of fields) if (typeof v === "string" && norm(v).length > 24) dataset.push({ brand: l.brand, store: STORE_SLUG[l.store] ?? String(l.store), source: f, token: norm(v).slice(0, 24) + "…", label: "non_model:whole_title", trap: "whole_title", corroborated_by: [], own_title_contains: true, accepted_by: [], title: l.title.slice(0, 90) });
    }
  }

  // ── per merchant / field reliability ──
  const rel: Record<string, { declared: number; in_own_title: number; cross_merchant_confirmed: number; trap: number }> = {};
  for (const d of dataset) {
    const k = `${d.store}.${d.source}`; const r = (rel[k] ??= { declared: 0, in_own_title: 0, cross_merchant_confirmed: 0, trap: 0 });
    r.declared++; if (d.own_title_contains) r.in_own_title++; if (d.label === "model_confirmed_cross_merchant") r.cross_merchant_confirmed++; if (d.label.startsWith("non_model")) r.trap++;
  }
  // ── lane coverage per brand ──
  const cover: Record<string, { listings: number; P0: number; P1: number; P2: number; P3: number; declared_short_only: number }> = {};
  for (const l of L) {
    const ln = laneOf.get(l)!; const c = (cover[l.brand] ??= { listings: 0, P0: 0, P1: 0, P2: 0, P3: 0, declared_short_only: 0 });
    c.listings++; if (ln.P0) c.P0++; if (ln.P1) c.P1++; if (ln.P2) c.P2++; if (ln.P3) c.P3++; if (!ln.P1 && ln.D) c.declared_short_only++;
  }
  // ── evaluation against independent labels ──
  const pos = dataset.filter((d) => d.label === "model_confirmed_cross_merchant");
  const neg = dataset.filter((d) => d.label.startsWith("non_model"));
  const evalP = (p: "P0" | "P1" | "P2" | "P3") => ({ confirmed_models: pos.length, accepted: pos.filter((d) => d.accepted_by.includes(p)).length, recall: Number((pos.filter((d) => d.accepted_by.includes(p)).length / Math.max(1, pos.length)).toFixed(3)),
    non_model_tokens: neg.length, false_accepts: neg.filter((d) => d.accepted_by.includes(p)).length });
  const uncorroboratedAccepted = dataset.filter((d) => d.label === "declared_uncorroborated" && d.accepted_by.includes("P2")).map((d) => `${d.store}.${d.source}=${d.token} | ${d.title}`);

  // ── verifier replay over every multi-store TV group ──
  const run = (p: "P0" | "P1" | "P2" | "P3", G: Listing[], key: string) => resolveGroup(
    G.map((l) => { const m = laneOf.get(l)![p]; return { title: l.title, label: String(l.store), structured: m ? { model: m } : undefined }; }), "tv", null, modelCodeOfKey(key));
  type Outcome = { store: number; outcome: string; reasons: string[] };
  const replay: { key: string; cid: string; stores: number[]; P0: Outcome[]; P1: Outcome[]; P2: Outcome[]; P3: Outcome[]; titles: string[] }[] = [];
  const share = { P0: { listings: 0, match: 0, review: 0, reject: 0 }, P1: { listings: 0, match: 0, review: 0, reject: 0 }, P2: { listings: 0, match: 0, review: 0, reject: 0 }, P3: { listings: 0, match: 0, review: 0, reject: 0 } };
  for (const [cid, G] of byGroup) {
    const sorted = [...new Map(G.map((x) => [x.store, x])).values()].sort((a, b) => a.store - b.store);
    if (sorted.length < 2) continue;
    const out: Record<string, Outcome[]> = {};
    for (const p of ["P0", "P1", "P2", "P3"] as const) {
      const res = run(p, sorted, sorted[0].key);
      out[p] = res.map((r, i) => ({ store: sorted[i].store, outcome: r.outcome, reasons: r.reasons.slice(0, 2) }));
      for (const r of res) { share[p].listings++; share[p][r.outcome as "match" | "review" | "reject"]++; }
    }
    replay.push({ key: sorted[0].key, cid, stores: sorted.map((s) => s.store), P0: out.P0, P1: out.P1, P2: out.P2, P3: out.P3, titles: sorted.map((s) => `${STORE_SLUG[s.store] ?? s.store}: ${s.title.slice(0, 80)}`) });
  }
  const verdictVec = (o: Outcome[]) => o.map((x) => x.outcome).join(",");
  const changed = (a: "P0" | "P1" | "P2" | "P3", b: "P0" | "P1" | "P2" | "P3") => replay.filter((g) => verdictVec(g[a]) !== verdictVec(g[b]));
  const named = [
    { label: "TCL 85T8D vs 85C6K PRO", match: (g: typeof replay[number]) => /tcl\|85\|4k\|mini_led\|144/.test(g.key) },
    { label: "Hisense Q71Q vs 65S7N", match: (g: typeof replay[number]) => /hisense\|65\|4k\|qled\|144/.test(g.key) },
  ].map((n) => { const g = replay.find(n.match); return { case: n.label, key: g?.key ?? null, P0: g?.P0.map((x) => `${STORE_SLUG[x.store] ?? x.store}:${x.outcome}`) ?? null, P1: g?.P1.map((x) => `${STORE_SLUG[x.store] ?? x.store}:${x.outcome}`) ?? null, P2: g?.P2.map((x) => `${STORE_SLUG[x.store] ?? x.store}:${x.outcome}`) ?? null }; });

  // ── comparable groups under each wiring: ≥ 2 distinct stores whose listing the verifier lets stand (match) ──
  const comparableUnder = (p: "P0" | "P1" | "P2" | "P3") => {
    let groups = 0, withAmazon = 0, amazonKept = 0, amazonExcluded = 0;
    for (const g of replay) {
      const kept = new Set(g[p].filter((x) => x.outcome === "match").map((x) => x.store));
      if (kept.size >= 2) { groups++; if (kept.has(2)) withAmazon++; }
      if (g[p].some((x) => x.store === 2)) { if (kept.has(2) && kept.size >= 2) amazonKept++; else if (g[p].find((x) => x.store === 2)!.outcome !== "match") amazonExcluded++; }
    }
    return { comparable_groups: groups, comparable_with_amazon: withAmazon, amazon_listings_in_multi_store_groups_kept: amazonKept, amazon_listings_held_back_by_verdict: amazonExcluded };
  };
  const comparable = { P0: comparableUnder("P0"), P1: comparableUnder("P1"), P2: comparableUnder("P2"), P3: comparableUnder("P3") };

  // ── P3 title-token audit: what the title lane accepts, against independent labels, and what it refuses and why ──
  const titleAudit = { accepted: 0, confirmed_by_other_merchant_declared: 0, confirmed_by_other_merchant_title: 0, unconfirmed: 0, trap_accepted: 0 };
  const titleUnconfirmed: string[] = []; const titleRefused: Record<string, number> = {};
  for (const l of L) {
    const size = screenSizeOf(l.title);
    const G = byGroup.get(l.cid) ?? [];
    const words = titleWords(l.title);
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const why = titleWordRefusal(w, words, size);
      if (why === "not_size_prefixed_shape") continue;
      if (why) { titleRefused[why] = (titleRefused[why] ?? 0) + 1; continue; }
      const t = laneOf.get(l)!.T; if (!t || norm(t) !== norm(w) && !norm(t).startsWith(norm(w))) continue;
      titleAudit.accepted++;
      if (trapClass(norm(w))) titleAudit.trap_accepted++;
      const others = G.filter((o) => o.store !== l.store);
      const decl = others.some((o) => DECLARED_FIELDS.some((f) => typeof o.payload[f] === "string" && (norm(o.payload[f] as string) === norm(w) || norm(o.payload[f] as string) === norm(t))));
      const tit = others.some((o) => tokenSet(o.title).has(norm(w)));
      if (decl) titleAudit.confirmed_by_other_merchant_declared++; else if (tit) titleAudit.confirmed_by_other_merchant_title++;
      else { titleAudit.unconfirmed++; if (titleUnconfirmed.length < 40) titleUnconfirmed.push(`${STORE_SLUG[l.store] ?? l.store}:${t} | ${l.title.slice(0, 70)}`); }
      break;
    }
  }

  // ── size-less series codes (Jarir "…, Black, Q71Q"): invisible to every lane above; how many listings carry one and nothing else? ──
  const SERIES_ONLY = /^[A-Z]\d{1,2}[A-Z]{1,2}$/;
  let seriesOnlyListings = 0, seriesOnlyInMulti = 0; const seriesExamples: string[] = [];
  for (const l of L) {
    if (composeVerifierModel(laneOf.get(l)!.plugin, l.payload, l.title)) continue;
    const tok = titleWords(l.title).find((w) => SERIES_ONLY.test(w) && !/^(\d+|4K|8K|HD)$/.test(w));
    if (!tok) continue;
    seriesOnlyListings++; if ((byGroup.get(l.cid) ?? []).length > 1 && new Set((byGroup.get(l.cid) ?? []).map((x) => x.store)).size > 1) seriesOnlyInMulti++;
    if (seriesExamples.length < 12) seriesExamples.push(`${STORE_SLUG[l.store] ?? l.store}:${tok} | ${l.title.slice(0, 60)}`);
  }

  mkdirSync(resolve(process.cwd(), OUT), { recursive: true });
  const labelCounts = dataset.reduce<Record<string, number>>((a, d) => { a[d.label] = (a[d.label] ?? 0) + 1; return a; }, {});
  const summary = {
    date: new Date().toISOString(), listings: L.length, multi_store_groups: replay.length, token_dataset_rows: dataset.length, label_counts: labelCounts,
    merchant_field_reliability: rel, lane_coverage_by_brand: cover,
    evaluation_vs_independent_labels: { P0: evalP("P0"), P1: evalP("P1"), P2: evalP("P2"), P3: evalP("P3") },
    sizeless_series_codes: { listings_with_series_code_and_no_other_model: seriesOnlyListings, of_which_in_multi_store_groups: seriesOnlyInMulti, examples: seriesExamples },
    comparable_under_each_wiring: comparable, p3_title_token_audit: titleAudit, p3_title_tokens_refused_by_reason: titleRefused, p3_unconfirmed_title_tokens: titleUnconfirmed,
    p2_accepted_but_uncorroborated: uncorroboratedAccepted.slice(0, 40), p2_accepted_but_uncorroborated_count: uncorroboratedAccepted.length,
    replay_listing_verdicts: share,
    groups_changed_P0_to_P1: changed("P0", "P1").length, groups_changed_P1_to_P2: changed("P1", "P2").length, groups_changed_P2_to_P3: changed("P2", "P3").length, groups_changed_P0_to_P3: changed("P0", "P3").length,
    named_cases: named,
  };
  writeFileSync(resolve(process.cwd(), OUT, "summary.json"), JSON.stringify(summary, null, 1));
  writeFileSync(resolve(process.cwd(), OUT, "token-dataset.json"), JSON.stringify(dataset));
  writeFileSync(resolve(process.cwd(), OUT, "replay-changed-groups.json"), JSON.stringify(changed("P0", "P3").map((g) => ({ key: g.key, titles: g.titles, P0: g.P0.map((x) => `${x.store}:${x.outcome}`), P1: g.P1.map((x) => `${x.store}:${x.outcome}`), P2: g.P2.map((x) => `${x.store}:${x.outcome}`), P3: g.P3.map((x) => `${x.store}:${x.outcome}(${(x.reasons[0] ?? "").slice(0, 70)})`) })), null, 1));
  console.log(JSON.stringify({ listings: summary.listings, groups: summary.multi_store_groups, labels: labelCounts, eval: summary.evaluation_vs_independent_labels, verdicts: share, changed: [summary.groups_changed_P0_to_P1, summary.groups_changed_P1_to_P2, summary.groups_changed_P2_to_P3, summary.groups_changed_P0_to_P3], comparable, titleAudit, titleRefused, named }, null, 1));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
