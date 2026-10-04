// scripts/tps-analysis/rehearsal/run-sweep.ts — run the REAL runSweepUnit against the LOCAL replica only.
//
//   npx tsx scripts/tps-analysis/rehearsal/run-sweep.ts --limit 500 --stores 1,5
//   TPS_IDENTITY_V2=1 npx tsx scripts/tps-analysis/rehearsal/run-sweep.ts --limit 500 --stores 1,5
// Flags:
//   --limit N        observations per sweep (default 500, engine hard cap TPS_MAX_OBSERVATIONS=500)
//   --stores a,b     restrict to store ids (default: all TPS stores)
//   --dry            engine dry mode (reads + computes, writes nothing)
//   --rewind         before the sweep, reset the tps_progress_cursors `_all_` rows (selected stores) to the
//                    post-setup baseline (.data/cursor-baseline.json) so the SAME raw rows are replayed
//   --repeat K       run K sweeps back to back (cursor advances between them) — default 1
//   --json FILE      also write the metrics as JSON
//
// SAFETY: builds a supabase-js client for the LOCAL URL only. Hard-fails if the URL is not loopback or if ANY
// environment variable points at *.supabase.co. Does NOT load .env.local.
import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DATA, LOCAL_URL, serviceKey } from "./lib";

function guardEnv(where: string) {
  const bad = Object.entries(process.env).filter(([, v]) => typeof v === "string" && /supabase\.co/i.test(v as string));
  if (bad.length) throw new Error(`REFUSING TO RUN (${where}): env var(s) ${bad.map(([k]) => k).join(", ")} point at supabase.co. Unset them in this shell; the rehearsal must never see production credentials.`);
}

function arg(name: string): string | undefined { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
const has = (n: string) => process.argv.includes(n);

async function main() {
  guardEnv("before imports");
  const url = process.env.TPS_LOCAL_URL || LOCAL_URL;
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) throw new Error(`REFUSING TO RUN: ${url} is not a loopback URL`);

  // Imported after the guard; re-checked after (an import-time dotenv load must not smuggle production creds in).
  const { CATEGORY_DEFS, TPS_STORES } = await import("../../tps-core/category-registry");
  const { runSweepUnit } = await import("../../tps-core/progressive-engine");
  // The engine's import chain pulls in modules that call dotenv on .env.local at import time, which injects the
  // PRODUCTION Supabase URL/keys into process.env. Scrub every SUPABASE* variable and anything pointing at
  // supabase.co so nothing running in this process can reach production by accident (it would fail instead).
  const scrubbed: string[] = [];
  for (const [k, v] of Object.entries(process.env)) if (/supabase/i.test(k) || (typeof v === "string" && /supabase\.co/i.test(v))) { delete process.env[k]; scrubbed.push(k); }
  if (scrubbed.length) console.log(`scrubbed ${scrubbed.length} production env var(s) injected by import-time dotenv: ${scrubbed.join(", ")}`);
  guardEnv("after scrub");

  const limit = Number(arg("--limit") ?? 500);
  const stores = arg("--stores")?.split(",").map(Number).filter((n) => Number.isFinite(n));
  const dry = has("--dry");
  const repeat = Number(arg("--repeat") ?? 1);
  const sb = createClient(url, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const defs = Object.values(CATEGORY_DEFS);

  if (has("--rewind")) {
    const base: Record<string, number> = JSON.parse(fs.readFileSync(path.join(DATA, "cursor-baseline.json"), "utf8"));
    const ids = (stores ?? TPS_STORES.map((s) => s.id)).filter((id) => base[id] != null);
    for (const id of ids) {
      const { error } = await sb.from("tps_progress_cursors").upsert({ category: "_all_", store_id: id, last_raw_id: base[id], updated_at: new Date().toISOString() }, { onConflict: "category,store_id" });
      if (error) throw new Error(`rewind store ${id}: ${error.message}`);
    }
    console.log(`rewound cursors for stores [${ids.join(",")}] to baseline`);
  }

  console.log(`TPS_IDENTITY_V2=${process.env.TPS_IDENTITY_V2 === undefined ? "<unset>" : JSON.stringify(process.env.TPS_IDENTITY_V2)}  url=${url}  limit=${limit}  stores=${stores?.join(",") ?? "all"}  dry=${dry}`);
  const all: unknown[] = [];
  for (let i = 0; i < repeat; i++) {
    const t0 = Date.now();
    const r = await runSweepUnit(sb as any, defs, limit, stores, dry);
    const byCategory = Object.fromEntries(Object.entries(r.normalize.byCategory).filter(([, c]) => c.detected || c.touched.size).map(([k, c]) => [k, { detected: c.detected, valid: c.valid, lowConfidence: c.lowConfidence, invalid: c.invalid, touchedKeys: c.touched.size }]));
    const out = { sweep: i + 1, ms: Date.now() - t0, fetched: r.normalize.fetched, staged: r.normalize.staged, saturated: r.normalize.saturated, gapRecovered: r.normalize.gapRecovered ?? 0, byCategory, corroborate: r.corroborate };
    all.push(out);
    console.log(JSON.stringify(out, null, 2));
  }
  const jf = arg("--json");
  if (jf) fs.writeFileSync(jf, JSON.stringify(all, null, 2));
}

main().catch((e) => { console.error("run-sweep failed:", e); process.exit(1); });
