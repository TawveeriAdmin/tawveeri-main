import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/scheduler — ground-truth for the ADR-078 automation.
 *
 * Reports, directly over HTTP (no DB dependency), whether the Next.js
 * instrumentation hook ran in THIS deploy and whether it spawned the scheduler,
 * plus the live commit SHA — so the automation can be diagnosed without Railway
 * logs. Read-only booleans/strings; nothing sensitive.
 */
export async function GET() {
  const g = globalThis as Record<string, unknown>;

  // Actively TEST whether this container can reach the DB via SUPABASE_DB_URL —
  // the scheduler spawns but writes no heartbeat, which points at a connection the
  // web app never exercises (it uses the Supabase JS client, not direct pg).
  let dbTest: { ok: boolean; ms?: number; error?: string; host?: string } = { ok: false, error: 'not attempted' };
  const url = process.env.SUPABASE_DB_URL;
  if (url) {
    let host: string | undefined;
    try { host = new URL(url).host; } catch { /* ignore */ }
    const t0 = Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Client } = require('pg') as typeof import('pg');
      const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000, query_timeout: 8000 });
      await client.connect();
      await client.query('select 1');
      await client.end();
      dbTest = { ok: true, ms: Date.now() - t0, host };
    } catch (e) {
      dbTest = { ok: false, ms: Date.now() - t0, host, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json(
    {
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
      instrumentationRan: g.__tawveeriInstrumentationRan ?? false,
      schedulerSpawned: g.__tawveeriSchedulerSpawned ?? false,
      schedulerError: g.__tawveeriSchedulerError ?? null,
      hasSupabaseDbUrl: !!process.env.SUPABASE_DB_URL,
      dbTest,
      nextRuntime: process.env.NEXT_RUNTIME ?? null,
      now: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
