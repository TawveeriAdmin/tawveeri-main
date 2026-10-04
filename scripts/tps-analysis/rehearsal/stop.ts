// scripts/tps-analysis/rehearsal/stop.ts — stop ONLY what start.ts started (recorded PIDs).
// Never matches by image name. Postgres is stopped via `pg_ctl stop` on OUR data directory.
//   npx tsx scripts/tps-analysis/rehearsal/stop.ts
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { PG_BIN, PGDATA, readPids, writePids, sleep } from "./lib";
import { pidAlive } from "./start";

export async function stop() {
  const pids = readPids();
  for (const name of ["proxy", "postgrest"] as const) {
    const rec = pids[name];
    if (!rec) continue;
    if (!pidAlive(rec)) { console.log(`${name}: pid ${rec.pid} not running (or reused by another image) — leaving alone`); delete pids[name]; continue; }
    try { process.kill(rec.pid); console.log(`${name}: stopped pid ${rec.pid}`); } catch (e: any) { console.log(`${name}: ${e.message}`); }
    delete pids[name];
    await sleep(300);
  }
  const pg = pids.postgres;
  if (pg) {
    const r = spawnSync(path.join(PG_BIN, "pg_ctl.exe"), ["stop", "-D", PGDATA, "-m", "fast", "-w", "-t", "60"], { encoding: "utf8" });
    console.log(`postgres: pg_ctl stop -> status ${r.status} ${(r.stdout || r.stderr || "").trim().split("\n").pop()}`);
    delete pids.postgres;
  }
  writePids(pids);
}

if (require.main === module) stop().catch((e) => { console.error("stop failed:", e.message); process.exit(1); });
