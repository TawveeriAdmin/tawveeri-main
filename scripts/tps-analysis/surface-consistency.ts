// scripts/tps-analysis/surface-consistency.ts — do the shopper-visible surfaces agree about identity? (Evidence-First closure, 2026-10-04.) READ-ONLY.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// One identity truth must govern every purchase claim. The projection / search / UCP / agents read the SIGNALS (`build-identity-signals`);
// the compare page runs the verifier LIVE (`getComparison` → `applyIdentityVerifierGate`). Both now ask the same evidence function for the
// declared model. This script runs both over every multi-store canonical of the given categories — with the evidence flag and the read gate
// forced ON in-process, writing nothing — and reports every (canonical, store) where they disagree:
//   signal reject  → the compare page must NOT list the store      signal review → the page must mark it `identity_verdict: review`
//   no signal      → the page must list it WITHOUT a verdict (or omit it for stock/availability reasons — counted separately)
// The signals come from a `build-identity-signals.ts --dry --examples=N` JSON (--signals=<file>), run with the same flags.
//
//   TPS_IDENTITY_GATE=tv,vacuum TPS_IDENTITY_EVIDENCE=tv,vacuum npx tsx scripts/tps-analysis/surface-consistency.ts --signals=…/signals-dry-evidence.json --categories=tv,vacuum
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const CATS = (arg("categories") ?? "tv,vacuum").split(",").filter(Boolean);
const SIGNALS = resolve(process.cwd(), arg("signals") ?? "");
const OUT = arg("out") ? resolve(process.cwd(), arg("out")!) : null;
if (!process.env.TPS_IDENTITY_GATE || !process.env.TPS_IDENTITY_EVIDENCE) throw new Error("run with TPS_IDENTITY_GATE and TPS_IDENTITY_EVIDENCE set (in-process only; nothing is written)");

(async () => {
  // dynamic import: get-comparison reads NEXT_PUBLIC_SUPABASE_URL when the module loads, so dotenv must have run first
  const { getComparison, isComparisonError } = await import("../../src/lib/compare/get-comparison");
  const sig = JSON.parse(readFileSync(SIGNALS, "utf8")) as { examples?: Record<string, { key: string; store: number; verdict: "review" | "reject" }[]> };
  const flagged = new Map<string, "review" | "reject">();
  for (const c of CATS) for (const e of sig.examples?.[c] ?? []) flagged.set(`${e.key}|${e.store}`, e.verdict);
  const url = process.env.SUPABASE_DB_URL!; if (!url.includes("vyceqrzttspyycdpojtn")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(url), ssl: { rejectUnauthorized: false } }); await pg.connect(); await pg.query("begin read only");
  const keys = (await pg.query(
    `select cp.tps_identity_key as key, cp.category from canonical_products cp
      where cp.is_active and cp.category = any($1::text[]) and (select count(distinct co.store_id) from tps_current_offers co where co.identity_key = cp.tps_identity_key and co.status = 'valid') >= 2
      order by 1`, [CATS])).rows as { key: string; category: string }[];
  await pg.query("rollback"); await pg.end();

  const idBySlug = new Map<string, number>();
  for (let i = 1; i <= 40; i++) { const s = resolveApprovedSlug(i); if (s) idBySlug.set(s, i); }
  const tally = { canonicals: 0, errors: 0, listings_compared: 0, agree: 0, signal_reject_but_page_lists: 0, signal_review_but_page_clean: 0, page_review_but_no_signal: 0, page_review_signal_reject: 0, omitted_by_page_not_flagged: 0 };
  const mismatches: unknown[] = [];
  for (const k of keys) {
    const r = await getComparison({ identityKey: k.key, locale: "en" });
    tally.canonicals++;
    if (isComparisonError(r)) { tally.errors++; continue; }
    const present = new Map(r.offers.map((o) => [idBySlug.get(o.store_slug) ?? -1, o]));
    // every store with a signal, plus every store the page lists
    const stores = new Set<number>([...present.keys()]);
    for (const [fk] of flagged) { const [key, st] = [fk.slice(0, fk.lastIndexOf("|")), Number(fk.slice(fk.lastIndexOf("|") + 1))]; if (key === k.key) stores.add(st); }
    for (const st of stores) {
      const s = flagged.get(`${k.key}|${st}`) ?? null; const o = present.get(st);
      const page = !o ? "absent" : o.identity_verdict?.outcome === "review" ? "review" : "clean";
      tally.listings_compared++;
      const ok = (s === "reject" && page === "absent") || (s === "review" && page === "review") || (s === null && page === "clean");
      if (ok) { tally.agree++; continue; }
      if (s === null && page === "absent") { tally.omitted_by_page_not_flagged++; continue; }   // stock/stale/availability, not identity
      if (s === "reject" && page === "review") tally.page_review_signal_reject++;
      else if (s === "reject" && page === "clean") tally.signal_reject_but_page_lists++;
      else if (s === "review" && page === "clean") tally.signal_review_but_page_clean++;
      else if (s === null && page === "review") tally.page_review_but_no_signal++;
      mismatches.push({ key: k.key, store: st, signal: s, page, reasons: o?.identity_verdict?.reasons });
    }
  }
  const out = { date: new Date().toISOString(), categories: CATS, tally, mismatches };
  if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ tally, sample_mismatches: mismatches.slice(0, 12) }, null, 1));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
