// scripts/tps-analysis/page-field-trust.ts — measured trust of every (merchant, PAGE field) in a capture file (2026-10-04). READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Same discipline as source-field-trust.ts, applied to what merchant PRODUCT PAGES state (page-evidence.ts fields). A page field is
// trusted only after being measured, with labels that do not come from the field under test:
//   n              values captured at that (merchant, field)
//   trap_pct       sizes / refresh rates / panel words / retailer ids / the whole title / a long non-model string
//   own_title_pct  the value appears as a whole token in the listing's own title
//   confirmed_pct  a DIFFERENT merchant independently states the same whole token (title word, payload field, or its own page field)
//                  in the same canonical group — measured only over groups that have another merchant
//   own_payload_conflict_pct  the page value differs from a model the SAME listing's payload already states (a self-contradiction)
// Classification: HIGH n>=20, traps<2%, own-payload conflicts<5% and (confirmed>=20% or own-title>=80%); LOW traps>=20% or conflicts>=20%;
// confirmable>=30 with <5% confirmed is LOW (never corroborated); n<20 UNMEASURED; else MEDIUM. GTIN is additionally validated by checksum before it is counted.
//
//   npx tsx scripts/tps-analysis/page-field-trust.ts --in=…/page-evidence-2026-10-04.jsonl [--out=…/page-field-trust-2026-10-04.json]
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { extractModelEvidence } from "../../src/lib/identity/manufacturer-model-evidence";
import { isValidGtin } from "../../src/lib/identity/page-evidence";
import { trapClass, norm } from "../../src/lib/identity/tv-short-model";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const IN = resolve(process.cwd(), arg("in") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/evidence-first/page-evidence-2026-10-04.jsonl");
const OUT = resolve(process.cwd(), arg("out") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/evidence-first/page-field-trust-2026-10-04.json");

type Line = { store_id: number; merchant: string; url: string; status: number | null; items: { field: string; value: string }[]; transport_blocked?: boolean; bytes: number };
const words = (title: string) => new Set(title.toUpperCase().split(/[\s,()/|–—:;"'،]+/).map((w) => norm(w)).filter(Boolean));
const shapeOk = (t: string) => t.length >= 4 && t.length <= 24 && /\d/.test(t) && /[A-Z]/.test(t);

(async () => {
  const lines = readFileSync(IN, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Line);
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const rows = (await pg.query(
    `select co.store_id, co.url, co.name, co.identity_key,
            jsonb_build_object('mpn', r.payload->'mpn', 'modelNumber', r.payload->'modelNumber', 'model_number', r.payload->'model_number', 'model', r.payload->'model',
                               'gtin', r.payload->'gtin', 'brand', r.payload->'brand', 'specifications', r.payload->'specifications') as payload
       from tps_current_offers co left join raw_observations r on r.id = co.raw_obs_id
      where co.status = 'valid' and co.url is not null`)).rows as { store_id: number; url: string; name: string | null; identity_key: string | null; payload: Record<string, unknown> }[];
  await pg.query("rollback"); await pg.end();

  type L = { merchant: string; title: string; key: string | null; tokens: Set<string>; payloadCodes: Set<string> };
  const byUrl = new Map<string, L>(); const groups = new Map<string, L[]>();
  const pageByUrl = new Map<string, { field: string; value: string }[]>();
  for (const l of lines) if (l.status === 200) pageByUrl.set(l.url, l.items);
  for (const r of rows) {
    const merchant = resolveApprovedSlug(r.store_id) ?? String(r.store_id);
    const ev = extractModelEvidence({ merchant, title: r.name ?? "", payload: r.payload ?? {} });
    const payloadCodes = new Set(ev.filter((e) => e.usable_for_identity && e.evidence_type !== "gtin" && e.source_field !== "title").map((e) => e.normalized_value));
    const tokens = new Set([...ev.filter((e) => e.usable_for_identity && e.evidence_type !== "gtin").map((e) => e.normalized_value), ...words(r.name ?? "")]);
    for (const it of pageByUrl.get(r.url) ?? []) if (/mpn|manufacturer_no|modelNumber|model_number|item_model_number|part_number/.test(it.field)) tokens.add(norm(it.value));
    const l: L = { merchant, title: r.name ?? "", key: r.identity_key, tokens, payloadCodes };
    byUrl.set(r.url, l);
    if (r.identity_key) (groups.get(r.identity_key) ?? groups.set(r.identity_key, []).get(r.identity_key)!).push(l);
  }

  type Acc = { n: number; trap: number; own: number; confirmable: number; confirmed: number; selfCmp: number; selfConflict: number };
  const acc = new Map<string, Acc>();
  const coverage: Record<string, { listings: number; fetched_200: number; with_items: number; blocked: number; failed: number }> = {};
  for (const l of lines) {
    const merchant = resolveApprovedSlug(l.store_id) ?? String(l.store_id);
    const c = (coverage[merchant] ??= { listings: 0, fetched_200: 0, with_items: 0, blocked: 0, failed: 0 });
    c.listings++; if (l.status === 200) { c.fetched_200++; if (l.items.length) c.with_items++; } else if (l.transport_blocked) c.blocked++; else c.failed++;
    if (l.status !== 200) continue;
    const me = byUrl.get(l.url);
    for (const it of l.items) {
      const k = `${merchant}|${it.field}`; const a = acc.get(k) ?? { n: 0, trap: 0, own: 0, confirmable: 0, confirmed: 0, selfCmp: 0, selfConflict: 0 }; acc.set(k, a);
      a.n++;
      if (it.field === "page.jsonld.gtin") {
        const ok = isValidGtin(it.value);
        if (!ok) { a.trap++; continue; }
        const others = (me?.key ? groups.get(me.key) ?? [] : []).filter((o) => o.merchant !== merchant);
        // GTIN confirmation: another merchant's PAGE states the same GTIN
        const gt = norm(it.value);
        const conf = others.some((o) => { for (const [u, v] of byUrl) if (v === o) return (pageByUrl.get(u) ?? []).some((x) => x.field === "page.jsonld.gtin" && norm(x.value) === gt); return false; });
        if (others.length) { a.confirmable++; if (conf) a.confirmed++; }
        continue;
      }
      const t = norm(it.value);
      const isTrap = !shapeOk(t) || !!trapClass(t) || (me ? norm(me.title) === t : false);
      if (isTrap) { a.trap++; continue; }
      if (me?.tokens.has(t) && words(me.title).has(t)) a.own++;
      const others = (me?.key ? groups.get(me.key) ?? [] : []).filter((o) => o.merchant !== merchant);
      if (others.length) { a.confirmable++; if (others.some((o) => o.tokens.has(t))) a.confirmed++; }
      if (me && me.payloadCodes.size) { a.selfCmp++; if (!me.payloadCodes.has(t)) a.selfConflict++; }
    }
  }
  const pct = (n: number, d: number) => (d ? Number(((100 * n) / d).toFixed(1)) : null);
  const matrix = [...acc.entries()].map(([k, a]) => {
    const [merchant, field] = k.split("|");
    const trap = pct(a.trap, a.n), own = pct(a.own, a.n), conf = pct(a.confirmed, a.confirmable), conflict = pct(a.selfConflict, a.selfCmp);
    const uncorroborated = a.confirmable >= 30 && (conf ?? 0) < 5;   // a field no other merchant ever echoes is a merchant-internal code, not a manufacturer model
    const trust = a.n < 20 ? "UNMEASURED" : (trap ?? 0) >= 20 || (conflict ?? 0) >= 20 || uncorroborated ? "LOW" : (trap ?? 0) < 2 && (conflict ?? 0) < 5 && ((conf ?? 0) >= 20 || (own ?? 0) >= 80) ? "HIGH" : "MEDIUM";
    return { merchant, field, declared: a.n, trap_pct: trap, own_title_pct: own, confirmed_pct: conf, confirmable: a.confirmable, own_payload_conflict_pct: conflict, own_payload_compared: a.selfCmp, trust };
  }).sort((x, y) => x.merchant.localeCompare(y.merchant) || y.declared - x.declared);
  writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString(), captures: lines.length, rule: "LOW also when confirmable>=30 and confirmed<5% (never corroborated); HIGH n>=20, traps<2%, own-payload conflicts<5%, (confirmed>=20% or own-title>=80%); LOW traps>=20% or conflicts>=20%; n<20 UNMEASURED; else MEDIUM", coverage, matrix }, null, 1));
  console.log(JSON.stringify({ coverage }, null, 1));
  for (const m of matrix) console.log(`${m.merchant}.${m.field}: n=${m.declared} trap=${m.trap_pct}% own=${m.own_title_pct}% confirmed=${m.confirmed_pct}%(${m.confirmable}) selfConflict=${m.own_payload_conflict_pct}%(${m.own_payload_compared}) → ${m.trust}`);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
