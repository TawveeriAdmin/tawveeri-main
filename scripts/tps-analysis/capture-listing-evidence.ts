// scripts/tps-analysis/capture-listing-evidence.ts — capture what merchant PRODUCT PAGES state about the manufacturer model (2026-10-04).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// EVIDENCE INGESTION, not identity mutation: reads the targets from production READ-ONLY, fetches each listing's public product page
// politely, parses it with src/lib/identity/page-evidence.ts and appends JSON lines to a file. It writes nothing to the database and
// changes no key. The replay (identity-evidence-replay.ts --captured=…) and the trust measurement (page-field-trust.ts) read the file.
//
// Politeness: one request at a time per host, ≥1.2 s between requests (Amazon ≥2.5 s), 25 s timeout, one retry on 5xx/timeout, a host
// is abandoned after 6 consecutive failures, and a host that answers 403 to its first 3 requests is recorded `transport_blocked`
// (Noon, LuLu) and not hammered — that is a TRANSPORT_GAP, not something to defeat.
//
//   npx tsx scripts/tps-analysis/capture-listing-evidence.ts --categories=tv,vacuum --out=docs/evidence/.../evidence-first/page-evidence-2026-10-04.jsonl [--limit=N] [--stores=1,2,4]
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "fs";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { resolveApprovedSlug } from "../../src/lib/retailers/approved-retailers";
import { parsePageEvidence } from "../../src/lib/identity/page-evidence";

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const CATS = (arg("categories") ?? "tv,vacuum").split(",").filter(Boolean);
const OUT = resolve(process.cwd(), arg("out") ?? "docs/evidence/amazon-diagnostic-2026-10-03/phase3b/evidence-first/page-evidence-2026-10-04.jsonl");
const LIMIT = Number(arg("limit") ?? 0);
const ALL_CATS = CATS.includes("all");          // trust measurement only: every category of the listed --stores
const ANY_STORE_COUNT = argv.includes("--any-store-count"); // do not require the listing to sit in a multi-store group
const ONLY_STORES = arg("stores")?.split(",").map(Number) ?? null;
// Store id -> slug from the ONE authority (approved-retailers STORE_ID_TO_SLUG). A hand-written map here once swapped 10/18/23 (blackbox/alnakheelk/lulu).
const STORE: Record<number, string> = new Proxy({} as Record<number, string>, { get: (_t, k) => resolveApprovedSlug(Number(k)) ?? String(k) });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Amazon: the canonical product page is /dp/<ASIN>; search-result URLs carry tracking and are not stable. */
function pageUrl(store: number, url: string): string {
  if (store === 2) { const m = /\/dp\/([A-Z0-9]{10})/.exec(url) ?? /\/gp\/product\/([A-Z0-9]{10})/.exec(url); if (m) return `https://www.amazon.sa/dp/${m[1]}`; }
  return url.split("#")[0];
}

type Target = { store_id: number; url: string; name: string };
type Line = { store_id: number; merchant: string; url: string; fetch_url: string; status: number | null; captured_at: string; bytes: number; items: { field: string; value: string }[]; error?: string; transport_blocked?: boolean };

(async () => {
  const dbUrl = process.env.SUPABASE_DB_URL; if (!dbUrl) throw new Error("SUPABASE_DB_URL missing");
  if (!dbUrl.includes("vyceqrzttspyycdpojtn") || dbUrl.includes("ffpsjjazsluolysgithg")) throw new Error("refusing: not production");
  const pg = new Client({ connectionString: toPoolerDbUrl(dbUrl), ssl: { rejectUnauthorized: false } });
  await pg.connect(); await pg.query("begin read only");
  const rows = (await pg.query(
    `select co.store_id, co.url, co.name from tps_current_offers co join canonical_products cp on cp.tps_identity_key = co.identity_key and cp.is_active
      where co.status = 'valid' and co.payload->>'_superseded_by_identity' is null and ($2::boolean or cp.category = any($1::text[])) and co.url is not null
        and ($3::boolean or exists (select 1 from tps_current_offers o2 where o2.identity_key = co.identity_key and o2.status = 'valid' and o2.store_id <> co.store_id))
      order by co.store_id, co.url`, [CATS, ALL_CATS, ANY_STORE_COUNT])).rows as Target[];
  await pg.query("rollback"); await pg.end();

  mkdirSync(dirname(OUT), { recursive: true });
  const done = new Set<string>();
  if (existsSync(OUT)) for (const l of readFileSync(OUT, "utf8").split("\n").filter(Boolean)) { try { done.add((JSON.parse(l) as Line).url); } catch { /* skip */ } }
  let targets = rows.filter((r) => (!ONLY_STORES || ONLY_STORES.includes(Number(r.store_id))) && !done.has(r.url));
  if (LIMIT) targets = targets.slice(0, LIMIT);
  const byHost = new Map<string, Target[]>();
  for (const t of targets) { const h = new URL(t.url).hostname; (byHost.get(h) ?? byHost.set(h, []).get(h)!).push(t); }
  console.log(JSON.stringify({ targets: targets.length, already_done: done.size, hosts: [...byHost].map(([h, v]) => `${h}:${v.length}`) }));

  const stat: Record<string, { ok: number; with_items: number; blocked: number; failed: number }> = {};
  const worker = async (host: string, list: Target[]) => {
    const s = (stat[host] ??= { ok: 0, with_items: 0, blocked: 0, failed: 0 });
    const gap = host.includes("amazon") ? 2600 : 1300;
    let consecutiveFail = 0, first403 = 0, probed = 0, blocked = false;
    for (const t of list) {
      const merchant = STORE[Number(t.store_id)] ?? String(t.store_id);
      const fetchUrl = pageUrl(Number(t.store_id), t.url);
      const base: Line = { store_id: Number(t.store_id), merchant, url: t.url, fetch_url: fetchUrl, status: null, captured_at: new Date().toISOString(), bytes: 0, items: [] };
      if (blocked) { appendFileSync(OUT, JSON.stringify({ ...base, transport_blocked: true }) + "\n"); s.blocked++; continue; }
      let line: Line = base;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(fetchUrl, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
          const html = await r.text();
          line = { ...base, status: r.status, bytes: html.length, items: r.status === 200 ? parsePageEvidence(html) : [] };
          if (r.status >= 500 && attempt === 0) { await sleep(3000); continue; }
          break;
        } catch (e) { line = { ...base, error: e instanceof Error ? e.message : String(e) }; if (attempt === 0) await sleep(3000); }
      }
      probed++;
      if (line.status === 403) { first403 += probed <= 3 ? 1 : 0; }
      if (probed <= 3 && first403 === 3) { blocked = true; line.transport_blocked = true; }
      if (line.status === 200) { s.ok++; consecutiveFail = 0; if (line.items.length) s.with_items++; } else { s.failed++; consecutiveFail++; }
      appendFileSync(OUT, JSON.stringify(line) + "\n");
      if (consecutiveFail >= 6) { console.log(`abandoning ${host} after 6 consecutive failures`); blocked = true; }
      await sleep(gap);
    }
  };
  await Promise.all([...byHost].map(([h, l]) => worker(h, l)));
  console.log(JSON.stringify({ done: true, by_host: stat }));
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
