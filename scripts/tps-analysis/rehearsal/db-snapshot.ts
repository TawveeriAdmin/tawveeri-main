// db-snapshot.ts — instant save/restore of the whole local replica (CREATE DATABASE ... TEMPLATE).
// Lets a rollback rehearsal return to the exact post-setup state in seconds instead of re-loading (7 min).
//   npx tsx scripts/tps-analysis/rehearsal/db-snapshot.ts save baseline
//   npx tsx scripts/tps-analysis/rehearsal/db-snapshot.ts restore baseline
//   npx tsx scripts/tps-analysis/rehearsal/db-snapshot.ts list
// PostgREST holds pooled connections to the database, so we stop OUR recorded PostgREST/proxy PIDs first
// (by PID, verified image) and start() brings them back afterwards.
import { Client } from "pg";
import { localDbUrl, DB_NAME, readPids, writePids, sleep } from "./lib";
import { start, pidAlive } from "./start";

const safe = (n: string) => { if (!/^[a-z0-9_]{1,40}$/.test(n)) throw new Error("name must match [a-z0-9_]{1,40}"); return `tps_snap_${n}`; };

async function stopRest() {
  const pids = readPids();
  for (const name of ["proxy", "postgrest"] as const) {
    const rec = pids[name];
    if (rec && pidAlive(rec)) { try { process.kill(rec.pid); } catch { /* */ } }
    delete pids[name];
  }
  writePids(pids);
  await sleep(1000);
}

async function main() {
  const [cmd, name] = process.argv.slice(2);
  const admin = new Client({ connectionString: localDbUrl("postgres") });
  if (cmd === "list") {
    await admin.connect();
    console.log((await admin.query("select datname, pg_size_pretty(pg_database_size(datname)) size from pg_database where datname like 'tps_snap_%' order by 1")).rows);
    await admin.end(); return;
  }
  if (cmd !== "save" && cmd !== "restore") throw new Error("usage: save|restore|list <name>");
  const snap = safe(name);
  if (cmd === "restore") {
    await admin.connect();
    const ex = await admin.query("select 1 from pg_database where datname = $1", [snap]);
    await admin.end();
    if (!ex.rowCount) throw new Error(`snapshot ${snap} does not exist (nothing was stopped)`);
  }
  await stopRest();
  const admin2 = new Client({ connectionString: localDbUrl("postgres") });
  try {
    await admin2.connect();
    const kick = (db: string) => admin2.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [db]);
    if (cmd === "save") {
      await kick(DB_NAME); await kick(snap);
      await admin2.query(`drop database if exists ${snap}`);
      await admin2.query(`create database ${snap} template ${DB_NAME}`);
      console.log(`saved ${DB_NAME} -> ${snap}`);
    } else {
      await kick(DB_NAME); await kick(snap);
      await admin2.query(`drop database ${DB_NAME}`);
      await admin2.query(`create database ${DB_NAME} template ${snap}`);
      console.log(`restored ${snap} -> ${DB_NAME}`);
    }
  } finally {
    await admin2.end().catch(() => undefined);
    await start();
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
