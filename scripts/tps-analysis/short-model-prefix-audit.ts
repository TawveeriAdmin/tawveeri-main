// scripts/tps-analysis/short-model-prefix-audit.ts
// READ-ONLY. The PROOF the founder demanded before MIN_MODEL_LENGTH is made
// retailer-aware (ADR-058 boundary).
//
// THE TEST, stated by the founder and implemented literally here:
//   "If the same short string appears as a PREFIX of a longer model elsewhere in
//    that retailer's catalogue, it is a truncation — reject. If it stands alone
//    consistently, it is the model — accept."
//
// Two scopes are measured separately, because they are not the same claim:
//   ROW scope       — is the candidate a strict prefix of a longer model-shaped
//                     token in the SAME observation's own text? (This is the test
//                     the runtime can actually apply, per row, with no index.)
//   CATALOGUE scope — is it a strict prefix of a longer model-shaped string
//                     anywhere in that retailer's catalogue? (The founder's exact
//                     wording; run here as verification of the row-scope rule.)
//
// If the two scopes disagree, the row-scope rule is NOT safe to ship and this
// prints the disagreement rather than a verdict.
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";

const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** 4–5 char candidates that LOOK like a manufacturer code (letter + digit, one token). */
const SHORT_CANDIDATE = /^[A-Za-z0-9][A-Za-z0-9\-/._]{3,4}$/;
const isShortCandidate = (v: string) => SHORT_CANDIDATE.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v);
/** Any model-shaped token, used to build the "longer strings" universe. */
const MODEL_TOKEN = /^[A-Za-z0-9][A-Za-z0-9\-/._]{3,23}$/;
const isModelToken = (v: string) => MODEL_TOKEN.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v);

function tokens(text: string): string[] {
  return text.split(/[\s،,;:()[\]{}"'؛|–—]+/).map(t => t.replace(/[.,،؛:]+$/, "")).filter(Boolean);
}

(async () => {
  const pg = new Client({ connectionString: toPoolerDbUrl(process.env.SUPABASE_DB_URL), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query("set statement_timeout = 0");

  // ── candidates: every short model string a TV observation actually carries ──
  const cand = await pg.query(`
    select s.raw_obs_id, s.store_id, st.name store, s.status,
           coalesce(r.payload->>'model', r.payload->>'modelNumber', r.payload->>'model_number', r.payload->>'mpn') m,
           coalesce(r.payload->>'nameEn', r.payload->>'name_en', r.payload->>'title',
                    r.payload->>'nameAr', r.payload->>'name_ar', r.payload->>'name', r.raw_name) nm
    from tps_identity_staging s
    join raw_observations r on r.id = s.raw_obs_id
    left join stores st on st.id = s.store_id
    where s.category='tv'`);

  type C = { store: string; storeId: number; m: string; name: string; status: string };
  const candidates: C[] = [];
  for (const r of cand.rows as any[]) {
    const m = asString(r.m); if (!m || !isShortCandidate(m)) continue;
    candidates.push({ store: String(r.store ?? r.store_id), storeId: Number(r.store_id), m: m.toUpperCase(), name: String(r.nm ?? "").toUpperCase(), status: r.status });
  }
  console.log(`short (4–5 char) model candidates on TV observations: ${candidates.length} rows, ${new Set(candidates.map(c => c.storeId + "|" + c.m)).size} distinct store+model\n`);

  // ── CATALOGUE scope: every model-shaped string each candidate store publishes ──
  const storeIds = [...new Set(candidates.map(c => c.storeId))];
  const universe = new Map<number, Set<string>>();
  for (const id of storeIds) {
    const set = new Set<string>();
    // model fields across the store's ENTIRE catalogue (all categories)
    const mf = await pg.query(`
      select distinct upper(trim(v)) v from (
        select payload->>'model' v from raw_observations where store_id=$1
        union all select payload->>'modelNumber' from raw_observations where store_id=$1
        union all select payload->>'model_number' from raw_observations where store_id=$1
        union all select payload->>'mpn' from raw_observations where store_id=$1
      ) t where v is not null and trim(v) <> ''`, [id]);
    for (const r of mf.rows as any[]) { const v = String(r.v); if (isModelToken(v)) set.add(v); }
    // model-shaped tokens inside that store's TV listing NAMES
    const nm = await pg.query(`
      select coalesce(r.payload->>'nameEn', r.payload->>'name_en', r.payload->>'title',
                      r.payload->>'nameAr', r.payload->>'name_ar', r.payload->>'name', r.raw_name) nm
      from tps_identity_staging s join raw_observations r on r.id=s.raw_obs_id
      where s.category='tv' and s.store_id=$1`, [id]);
    for (const r of nm.rows as any[]) for (const t of tokens(String(r.nm ?? "").toUpperCase())) if (isModelToken(t)) set.add(t);
    universe.set(id, set);
    console.log(`universe[${id}] = ${set.size} model-shaped strings`);
  }

  // ── run both scopes ────────────────────────────────────────────────────────
  type Verdict = { rowTrunc: boolean; catTrunc: boolean };
  const seen = new Map<string, { c: C; v: Verdict; n: number; longer: string | null }>();
  for (const c of candidates) {
    const k = `${c.storeId}|${c.m}`;
    const prev = seen.get(k);
    if (prev) { prev.n++; continue; }
    // ROW scope — a longer model-shaped token in this listing's own name that starts with it
    const rowLonger = tokens(c.name).find(t => isModelToken(t) && t.length > c.m.length && t.startsWith(c.m)) ?? null;
    // CATALOGUE scope — same, anywhere in the store's catalogue
    const uni = universe.get(c.storeId)!;
    let catLonger: string | null = null;
    for (const v of uni) { if (v.length > c.m.length && v.startsWith(c.m)) { catLonger = v; break; } }
    seen.set(k, { c, v: { rowTrunc: !!rowLonger, catTrunc: !!catLonger }, n: 1, longer: rowLonger ?? catLonger });
  }

  const perStore = new Map<string, { accept: number; reject: number; disagree: number; acceptEx: string[]; rejectEx: string[]; disagreeEx: string[]; rows: number }>();
  for (const { c, v, n, longer } of seen.values()) {
    const e = perStore.get(c.store) ?? { accept: 0, reject: 0, disagree: 0, acceptEx: [], rejectEx: [], disagreeEx: [], rows: 0 };
    perStore.set(c.store, e); e.rows += n;
    if (v.rowTrunc !== v.catTrunc) { e.disagree++; if (e.disagreeEx.length < 6) e.disagreeEx.push(`${c.m}→${longer} (row=${v.rowTrunc} cat=${v.catTrunc})`); }
    if (v.catTrunc) { e.reject++; if (e.rejectEx.length < 6) e.rejectEx.push(`${c.m}⊂${longer}`); }
    else { e.accept++; if (e.acceptEx.length < 6) e.acceptEx.push(c.m); }
  }

  console.log(`\n═══ VERDICT per retailer (catalogue scope = the founder's test) ═══`);
  for (const [s, e] of [...perStore].sort((a, b) => b[1].rows - a[1].rows)) {
    console.log(`\n${s}   observations=${e.rows}  distinct-short-models=${e.accept + e.reject}`);
    console.log(`   ACCEPT (stands alone)   ${String(e.accept).padStart(4)}   ${e.acceptEx.join(" ")}`);
    console.log(`   REJECT (truncation)     ${String(e.reject).padStart(4)}   ${e.rejectEx.join(" ")}`);
    console.log(`   row-vs-catalogue disagreement ${e.disagree}${e.disagree ? "  " + e.disagreeEx.join(" ") : ""}`);
  }

  const totalDisagree = [...perStore.values()].reduce((a, b) => a + b.disagree, 0);
  console.log(`\nTOTAL row-scope vs catalogue-scope disagreements: ${totalDisagree}`);
  console.log(totalDisagree === 0
    ? "→ the per-row prefix test reproduces the catalogue test exactly; it is safe to apply at parse time."
    : "→ the scopes DISAGREE. Do NOT ship the per-row rule on its own; the disagreements above are the reason.");

  await pg.end();
})().catch((e) => { console.error(e); process.exit(1); });
