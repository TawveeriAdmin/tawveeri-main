// scripts/worker/jobs/founder-daily.ts
//
// Hourly worker tick for the Founder Operating Center. All logic lives in the web app's
// /api/cron/founder-daily route (register-bound computation, snapshots, summaries) — this job
// only triggers it with the CRON_SECRET, keeping the founder computation OFF web page requests
// while reusing the one codebase. The route self-gates: before `summary_hour_riyadh` it returns
// `skipped`, and once a day's summary exists it returns `exists`, so hourly ticks are cheap.

const base = (process.env.FOUNDER_CRON_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tawveeri.com').replace(/\/$/, '');
const secret = process.env.CRON_SECRET;

async function main() {
  if (!secret) throw new Error('CRON_SECRET not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150_000);
  try {
    const res = await fetch(`${base}/api/cron/founder-daily`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: controller.signal });
    const body = await res.text();
    console.log(`[worker:founder-daily] HTTP ${res.status}: ${body.slice(0, 600)}`);
    if (!res.ok) throw new Error(`founder-daily returned ${res.status}`);
  } finally { clearTimeout(timer); }
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[worker:founder-daily] fatal:', err instanceof Error ? err.message : err); process.exit(1); });
