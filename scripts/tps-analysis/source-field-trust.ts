// scripts/tps-analysis/source-field-trust.ts — source-field trust matrix (founder §15, 2026-10-04). READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// "Source semantics matter more than string length." For every (merchant, field) that can carry a manufacturer model — the four
// top-level payload fields AND the model-looking keys inside `specifications` (Noon `model_number`, Amazon `item model number`…) —
// measure, with labels independent of any extractor:
//   declared            how many current offers carry a value there
//   trap_pct            sizes / refresh rates / panel words / retailer SKUs / whole titles / fragments of the title
//   own_title_pct       the value appears as a whole token in the listing's own title
//   confirmed_pct       a DIFFERENT merchant independently states the same whole token (title word or structured field) in the same canonical group
// and classify the field HIGH / MEDIUM / LOW / UNMEASURED. It also sizes the extraction gap per category: offers whose ONLY model
// evidence sits in a trusted spec field that no lane currently reads (invisible to the key builder and to the verifier).
//
//   npx tsx scripts/tps-analysis/source-field-trust.ts [--out=docs/evidence/.../source-field-trust-2026-10-04.json]
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";
import { extractManufacturerModel, extractManufacturerModelFromName } from "../../src/lib/identity/store-identifiers";
import { trapClass, norm } from "../../src/lib/identity/tv-short-model";

const argv = process.argv.slice(2);
const OUT = argv.find((a) => a.startsWith("--out="))?.split("=").slice(1).join("=") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/source-field-trust-2026-10-04.json";
// Store id -> slug from the ONE authority (approved-retailers STORE_ID_TO_SLUG). A hand-written map here once swapped 10/18/23 (blackbox/alnakheelk/lulu).
const STORE: Record<number, string> = new Proxy({} as Record<number, string>, { get: (_t, k) => resolveApprovedSlug(Number(k)) ?? String(k) });
const TOP = ["mpn", "modelNumber", "model_number", "model"] as const;
// keys inside `specifications` are lower-cased and stripped of whitespace/bidi marks so "Item model number‏:" collapses to one key
const cleanKey = (k: string) => k.toLowerCase().replace(/[\s‎‏‪-‮:]+/g, " ").trim();
const SPEC_CODE_KEYS = /^(item model number|model number|model_number|manufacturer part number|part number|mpn)$/;
const SPEC_NAME_KEYS = /^(model name|model_name|model)$/;

type Row = { identity_key: string | null; store_id: number; category: string; name: string | null; top: Record<string, string | null>; spec: Record<string, string> | null };
const words = (title: string) => new Set(title.toUpperCase().split(/[\s,()/|–—:;"'،]+/).map((w) => norm(w)).filter(Boolean));
const isCodeShape = (t: string) => t.length >= 4 && t.length <= 24 && /\d/.test(t) && /[A-Z]/.test(t);

(async () => {
  const url = process.env.SUPABASE_DB_URL; if (!url) throw new Error("SUPABASE_DB_URL missing");
  if (!url.includes("vyceqrzttspyycdpojtn") || url.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const rows = (await pg.query(
    `select co.identity_key, co.store_id, co.category, co.name,
            jsonb_build_object('mpn', r.payload->>'mpn', 'modelNumber', r.payload->>'modelNumber', 'model_number', r.payload->>'model_number', 'model', r.payload->>'model') as top,
            case when jsonb_typeof(r.payload->'specifications') = 'object'
                 then (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each_text(r.payload->'specifications') as t(k, v) where lower(k) ~ '(model|mpn|part.?number)') else null end as spec
       from tps_current_offers co left join raw_observations r on r.id = co.raw_obs_id
      where co.status = 'valid' and co.category is not null`)).rows as Row[];
  await pg.query("rollback"); await pg.end();

  // group index for cross-merchant confirmation: identity_key → listings
  const groups = new Map<string, Row[]>();
  for (const r of rows) if (r.identity_key) { const g = groups.get(r.identity_key); if (g) g.push(r); else groups.set(r.identity_key, [r]); }
  const declaredTokens = (r: Row): string[] => [
    ...TOP.map((f) => r.top?.[f]).filter((v): v is string => !!v).map(norm),
    ...Object.entries(r.spec ?? {}).filter(([k]) => SPEC_CODE_KEYS.test(cleanKey(k))).map(([, v]) => norm(String(v))),
  ];

  type Acc = { declared: number; trap: number; own_title: number; confirmed: number; confirmable: number };
  const acc = new Map<string, Acc>();
  const bump = (key: string, f: (a: Acc) => void) => { const a = acc.get(key) ?? { declared: 0, trap: 0, own_title: 0, confirmed: 0, confirmable: 0 }; f(a); acc.set(key, a); };
  const gap: Record<string, { offers: number; spec_only: number; spec_only_in_multi_store_groups: number }> = {};
  for (const r of rows) {
    const store = STORE[r.store_id] ?? String(r.store_id);
    const ownWords = words(r.name ?? "");
    const others = (r.identity_key ? groups.get(r.identity_key) ?? [] : []).filter((o) => o.store_id !== r.store_id);
    const fields: [string, string][] = [
      ...TOP.map((f): [string, string | null] => [`top.${f}`, r.top?.[f] ?? null]).filter((x): x is [string, string] => !!x[1]),
      ...Object.entries(r.spec ?? {}).map(([k, v]): [string, string] => [`spec.${cleanKey(k)}`, String(v)]).filter(([k]) => SPEC_CODE_KEYS.test(k.slice(5)) || SPEC_NAME_KEYS.test(k.slice(5))),
    ];
    for (const [field, value] of fields) {
      const token = norm(value); if (!token) continue;
      const key = `${store}|${field}`;
      const isTrap = !isCodeShape(token) && !SPEC_NAME_KEYS.test(field.slice(field.indexOf(".") + 1)) ? true : !!trapClass(token) || norm(r.name ?? "") === token || (token.length > 24);
      bump(key, (a) => { a.declared++; if (isTrap) a.trap++; if (!isTrap && ownWords.has(token)) a.own_title++; });
      if (!isTrap && others.length) {
        bump(key, (a) => { a.confirmable++; });
        const confirmed = others.some((o) => words(o.name ?? "").has(token) || declaredTokens(o).includes(token));
        if (confirmed) bump(key, (a) => { a.confirmed++; });
      }
    }
    // extraction gap: model evidence ONLY in a spec field no lane reads
    const g = (gap[r.category] ??= { offers: 0, spec_only: 0, spec_only_in_multi_store_groups: 0 }); g.offers++;
    const hasLaneEvidence = !!extractManufacturerModel({ mpn: r.top?.mpn, modelNumber: r.top?.modelNumber, model_number: r.top?.model_number, model: r.top?.model }) || !!(r.name && extractManufacturerModelFromName(r.name));
    const specCode = Object.entries(r.spec ?? {}).some(([k, v]) => SPEC_CODE_KEYS.test(cleanKey(k)) && isCodeShape(norm(String(v))) && !trapClass(norm(String(v))));
    if (!hasLaneEvidence && specCode) { g.spec_only++; if ((r.identity_key ? groups.get(r.identity_key) ?? [] : []).some((o) => o.store_id !== r.store_id)) g.spec_only_in_multi_store_groups++; }
  }
  const pct = (n: number, d: number) => (d ? Number(((100 * n) / d).toFixed(1)) : null);
  const matrix = [...acc.entries()].map(([k, a]) => {
    const [merchant, field] = k.split("|");
    const trap = pct(a.trap, a.declared), own = pct(a.own_title, a.declared), conf = pct(a.confirmed, a.confirmable);
    const trust = a.declared < 20 ? "UNMEASURED (n<20)" : trap != null && trap >= 20 ? "LOW" : trap != null && trap < 2 && ((conf ?? 0) >= 20 || (own ?? 0) >= 80) ? "HIGH" : "MEDIUM";
    return { merchant, field, declared: a.declared, trap_pct: trap, own_title_pct: own, confirmed_pct: conf, confirmable: a.confirmable, trust };
  }).sort((x, y) => x.merchant.localeCompare(y.merchant) || y.declared - x.declared);
  const gapOut = Object.entries(gap).filter(([, g]) => g.spec_only > 0).map(([category, g]) => ({ category, ...g, spec_only_pct: pct(g.spec_only, g.offers) })).sort((a, b) => b.spec_only - a.spec_only);
  writeFileSync(resolve(process.cwd(), OUT), JSON.stringify({ date: new Date().toISOString(), offers_measured: rows.length, rule: "HIGH: n>=20, traps<2% and (cross-merchant confirmed >=20% or in own title >=80%); LOW: traps>=20%; else MEDIUM", matrix, extraction_gap_spec_only_by_category: gapOut }, null, 1));
  console.log(JSON.stringify({ offers: rows.length, matrix: matrix.filter((m) => m.declared >= 20).map((m) => `${m.merchant}.${m.field}: n=${m.declared} trap=${m.trap_pct}% own=${m.own_title_pct}% confirmed=${m.confirmed_pct}%(${m.confirmable}) → ${m.trust}`), gap: gapOut }, null, 1));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
