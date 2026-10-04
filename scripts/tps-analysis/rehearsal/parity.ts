// scripts/tps-analysis/rehearsal/parity.ts — compares the LOCAL catalog with the PRODUCTION catalog (read-only)
// for every replicated object and writes parity.md.
//   npx tsx scripts/tps-analysis/rehearsal/parity.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { DATA, DIR, prodClient, localClient, type ProdClient } from "./lib";
import { TABLES, FUNCTIONS, type SchemaMeta } from "./gen-schema";

const inList = TABLES.map((t) => `'${t}'`).join(",");
const Q = {
  cols: `select c.relname t, a.attname n, format_type(a.atttypid, a.atttypmod) ty, a.attnotnull nn, a.attidentity idn, coalesce(pg_get_expr(d.adbin, d.adrelid), '') def
           from pg_attribute a join pg_class c on c.oid = a.attrelid left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
          where c.relnamespace = 'public'::regnamespace and c.relname in (${inList}) and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped order by 1, a.attnum`,
  cons: `select c.relname t, con.conname n, con.contype ty, pg_get_constraintdef(con.oid) def from pg_constraint con join pg_class c on c.oid = con.conrelid
          where c.relnamespace = 'public'::regnamespace and c.relname in (${inList}) and con.contype in ('p','u','c','f') order by 1, 2`,
  idx: `select tablename t, indexname n, indexdef def from pg_indexes where schemaname = 'public' and tablename in (${inList}) order by 1, 2`,
  fn: `select proname n, pronargs, md5(pg_get_functiondef(oid)) h from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1::text[]) order by 1`,
  rls: `select relname t, relrowsecurity r from pg_class where relnamespace = 'public'::regnamespace and relname in (${inList}) and relkind = 'r' order by 1`,
};

type Row = Record<string, any>;
const key = (r: Row, ...ks: string[]) => ks.map((k) => String(r[k])).join("|");
function diff(a: Row[], b: Row[], ks: string[], cmp: string[]) {
  const A = new Map(a.map((r) => [key(r, ...ks), r])), B = new Map(b.map((r) => [key(r, ...ks), r]));
  const onlyProd = [...A.keys()].filter((k) => !B.has(k)), onlyLocal = [...B.keys()].filter((k) => !A.has(k));
  const differ = [...A.keys()].filter((k) => B.has(k) && cmp.some((c) => String(A.get(k)![c]) !== String(B.get(k)![c])));
  return { onlyProd, onlyLocal, differ, same: A.size - onlyProd.length - differ.length };
}

export async function writeParity(prodIn?: ProdClient, rep?: any) {
  const prod = prodIn ?? (await prodClient());
  const local = await localClient();
  try {
    const meta: SchemaMeta = JSON.parse(fs.readFileSync(path.join(DIR, "schema.meta.json"), "utf8"));
    if (!rep) { try { rep = JSON.parse(fs.readFileSync(path.join(DATA, "load-report.json"), "utf8")); } catch { rep = null; } }
    await prod.query("begin read only");
    const P = async (s: string, p?: unknown[]) => prod.query(s, p);
    const L = async (s: string, p?: unknown[]) => (await local.query(s, p)).rows;
    const pc = await P(Q.cols), lc = await L(Q.cols);
    const pk = await P(Q.cons), lk = await L(Q.cons);
    const pi = await P(Q.idx), li = await L(Q.idx);
    const pf = await P(Q.fn, [FUNCTIONS as unknown as string[]]), lf = await L(Q.fn, [FUNCTIONS as unknown as string[]]);
    const pr = await P(Q.rls), lr = await L(Q.rls);
    const localFnNames = (await L("select proname from pg_proc where pronamespace = 'public'::regnamespace order by 1")).map((r) => r.proname);
    const prodFnNames = (await P("select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1::text[]) order by 1", [FUNCTIONS as unknown as string[]])).map((r: Row) => r.proname);
    await prod.query("rollback");

    const dCols = diff(pc, lc, ["t", "n"], ["ty", "nn", "idn", "def"]);
    // Local FKs were dropped on purpose; compare FKs separately.
    const pkNoFk = pk.filter((r: Row) => r.ty !== "f"), lkNoFk = lk.filter((r: Row) => r.ty !== "f");
    const dCons = diff(pkNoFk, lkNoFk, ["t", "n"], ["def"]);
    const pkFk = pk.filter((r: Row) => r.ty === "f"), lkFk = lk.filter((r: Row) => r.ty === "f");
    const dFk = diff(pkFk, lkFk, ["t", "n"], ["def"]);
    // index defs are textual; normalise schema-qualified differences nothing else expected
    const dIdx = diff(pi, li, ["t", "n"], ["def"]);
    const dFn = diff(pf, lf, ["n"], ["h", "pronargs"]);
    const dRls = diff(pr, lr, ["t"], ["r"]);

    const L2: string[] = [];
    const ok = (b: boolean) => (b ? "MATCH" : "DIFFERS");
    L2.push("# Rehearsal replica — PARITY REPORT", "");
    L2.push(`Generated ${new Date().toISOString()} by \`parity.ts\` (production read-only; local = PostgreSQL embedded 17.6 + PostgREST v13.0.8, \`db-max-rows=1000\`).`);
    L2.push(`Source catalog: ${meta.prodVersion}`, "");
    L2.push("## 1. Catalog parity (local vs production, live comparison)", "");
    L2.push("| Object class | Production | Local | Result |", "|---|---:|---:|---|");
    L2.push(`| Tables (replicated set) | ${TABLES.length} | ${new Set(lc.map((r) => r.t)).size} | ${ok(new Set(lc.map((r) => r.t)).size === TABLES.length)} |`);
    L2.push(`| Columns (name, type, NOT NULL, identity, default) | ${pc.length} | ${lc.length} | ${ok(!dCols.onlyProd.length && !dCols.onlyLocal.length && !dCols.differ.length)} |`);
    L2.push(`| PK / UNIQUE / CHECK constraints | ${pkNoFk.length} | ${lkNoFk.length} | ${ok(!dCons.onlyProd.length && !dCons.onlyLocal.length && !dCons.differ.length)} |`);
    L2.push(`| Indexes (incl. constraint-backing; full indexdef) | ${pi.length} | ${li.length} | ${ok(!dIdx.onlyProd.length && !dIdx.onlyLocal.length && !dIdx.differ.length)} |`);
    L2.push(`| Foreign keys (all, incl. to non-replicated tables) | ${pkFk.length} | ${lkFk.length} | KEPT ${lkFk.length}/${pkFk.length} (see §3) |`);
    L2.push(`| Functions on the write path (${FUNCTIONS.join(", ")}) — name + md5(pg_get_functiondef) | ${pf.length} | ${lf.length} | ${ok(!dFn.onlyProd.length && !dFn.onlyLocal.length && !dFn.differ.length)} |`);
    L2.push(`| RLS enabled per table | ${pr.filter((r: Row) => r.r).length} | ${lr.filter((r: Row) => r.r).length} | ${ok(!dRls.differ.length)} (no policies replicated — see §4) |`, "");
    L2.push(`\`select proname from pg_proc\` (public) — production (filtered to replicated functions): **${prodFnNames.join(", ")}**; local (entire public schema): **${localFnNames.join(", ")}**.`, "");
    const section = (title: string, d: ReturnType<typeof diff>) => { if (d.onlyProd.length || d.onlyLocal.length || d.differ.length) { L2.push(`### Differences: ${title}`, ""); for (const k of d.onlyProd) L2.push(`- only in production: \`${k}\``); for (const k of d.onlyLocal) L2.push(`- only local: \`${k}\``); for (const k of d.differ) L2.push(`- differs: \`${k}\``); L2.push(""); } };
    section("columns", dCols); section("constraints", dCons); section("indexes", dIdx); section("functions", dFn);
    if (dFk.onlyProd.length) { L2.push("### Foreign keys present in production but not local (deliberate, §3)", ""); for (const k of dFk.onlyProd) L2.push(`- \`${k}\``); L2.push(""); }

    L2.push("## 2. Replicated objects", "");
    L2.push("| Table | Columns | Prod rows (estimate) | Local rows loaded | Scope |", "|---|---:|---:|---:|---|");
    for (const t of meta.tables) {
      const loaded = rep?.rows?.[t.name];
      const scope = ["stores", "canonical_products", "tps_current_offers", "tps_progress_cursors", "tps_product_projection", "tps_price_implausibility_signals", "tps_offer_delist_signals", "samsung_official_url_baseline"].includes(t.name) ? "all rows"
        : t.name === "tps_identity_staging" ? "EMPTY (hot path never reads it)"
        : t.name === "raw_observations" ? `last ${rep?.rawDays ?? "?"} days per TPS store (cap ${rep?.rawCap ?? "?"}/store)`
        : `canonicals of categories [${(rep?.categories ?? []).join(", ")}] only`;
      L2.push(`| \`${t.name}\` | ${t.cols.length} | ${t.prodRowEstimate} | ${loaded ?? "?"} | ${scope} |`);
    }
    L2.push("", `Functions copied verbatim (\`pg_get_functiondef\`): ${meta.functions.map((f) => "`" + f.sig + "`").join(", ")}.`, "");
    L2.push(`Constraints (${meta.constraints.length}): ` + meta.constraints.map((c) => `\`${c.table}.${c.name}\``).join(", "), "");
    L2.push(`Indexes (non-constraint, created post-load, ${meta.indexes.length}): ` + meta.indexes.map((c) => `\`${c.name}\``).join(", "), "");
    L2.push(`Sequences recreated: ${meta.sequences.map((s) => "`" + s.split("|")[0] + "`").join(", ") || "none"}; identity columns keep GENERATED ALWAYS AS IDENTITY (loaded with OVERRIDING SYSTEM VALUE, sequences re-seeded to max+1).`, "");

    L2.push("## 3. Foreign keys", "", "| Table | Constraint | Kept locally | Reason if dropped |", "|---|---|---|---|");
    for (const f of meta.fks) L2.push(`| \`${f.table}\` | \`${f.name}\` | ${f.kept ? "yes" : "NO"} | ${f.reason ?? ""} |`);
    L2.push("");

    L2.push("## 4. Deliberate omissions and deviations", "");
    const fixed = [
      "RLS **policies** and per-role GRANTs other than `service_role ALL` are not replicated (RLS is ENABLED on every replicated table; `service_role` has BYPASSRLS like Supabase; `anon`/`authenticated` have no table grants). The engine only uses the service-role key.",
      "Extensions (pg_cron, pgmq/vector, pg_net, supabase_vault, pg_trgm, ...) are not installed; none of the replicated tables use them (no triggers, no vector/trgm columns — verified from the catalog).",
      "Database collation is `C` (initdb --locale=C); production uses the Supabase default. Affects only text ORDER BY on non-ASCII data; the engine's keyset reads order by integer/uuid keys.",
      "Postgres durability settings are relaxed (fsync=off, synchronous_commit=off, full_page_writes=off) — disposable instance. Time zone forced to UTC to match production.",
      "PostgREST v13.0.8 (Windows build) with `db-max-rows=1000`, `db-pool=10`, role statement timeouts copied from production (authenticator 30s, anon/authenticated/service_role 20s). Production's exact PostgREST/Supabase gateway version is not queryable from SQL; supabase-js reaches it through a 40-line reverse proxy that strips `/rest/v1` (see proxy.cjs).",
      "`tps_identity_staging` is EMPTY. The sweep still WRITES to it (`normalizeSweep` upserts staging rows) and the trailing gap re-scan reads it (`.in('raw_obs_id', ids)`); both are exercised against the empty table.",
      "Sampling bounds: normalized_product_observations / product_matches / price_history only for sampled categories; raw_observations only the recent window. Engine behaviour for OTHER categories' existing canonicals (their history rows are absent) is exercised for the canonical/current-offer write paths only.",
    ];
    for (const f of fixed) L2.push(`- ${f}`);
    L2.push("", "| Kind | Object | Detail |", "|---|---|---|");
    for (const o of meta.omissions) L2.push(`| ${o.kind} | \`${o.object}\` | ${o.detail.replace(/\|/g, "\\|")} |`);
    L2.push("");
    if (rep) {
      L2.push("## 5. Load details", "");
      for (const n of rep.notes ?? []) L2.push(`- ${n}`);
      L2.push("", "| TPS store id | raw rows copied | min id | max id | capped | cursor set to |", "|---:|---:|---:|---:|---|---:|");
      for (const [sid, v] of Object.entries<any>(rep.rawPerStore ?? {})) L2.push(`| ${sid} | ${v.copied} | ${v.minId ?? ""} | ${v.maxId ?? ""} | ${v.capped ? "yes" : "no"} | ${rep.cursorBaseline?.[sid] ?? ""} |`);
      L2.push("");
    }
    fs.writeFileSync(path.join(DIR, "parity.md"), L2.join("\n"));
    const bad = [dCols, dCons, dIdx, dFn].some((d) => d.onlyProd.length || d.onlyLocal.length || d.differ.length);
    console.log(`parity.md written — catalog parity ${bad ? "HAS DIFFERENCES (see file)" : "OK"}`);
    return !bad;
  } finally {
    await local.end();
    if (!prodIn) await prod.end();
  }
}

if (require.main === module) writeParity().catch((e) => { console.error(e); process.exit(1); });
