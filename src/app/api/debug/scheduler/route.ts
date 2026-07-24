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
  return NextResponse.json(
    {
      commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
      instrumentationRan: g.__tawveeriInstrumentationRan ?? false,
      schedulerSpawned: g.__tawveeriSchedulerSpawned ?? false,
      schedulerError: g.__tawveeriSchedulerError ?? null,
      hasSupabaseDbUrl: !!process.env.SUPABASE_DB_URL,
      nextRuntime: process.env.NEXT_RUNTIME ?? null,
      now: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
