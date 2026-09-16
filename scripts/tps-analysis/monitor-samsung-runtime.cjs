/* Authenticated read-only evidence of the deployed scheduler's actual completion. */
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const expected = process.argv.find(a => a.startsWith('--commit='))?.slice(9);
if (!expected) throw new Error('--commit required');
const file = 'docs/evidence/samsung-recovery-railway-runtime-monitor-2026-09-16.json';
const result = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { startedAt: new Date().toISOString(), expectedCommit: expected, rows: [] };
if (result.expectedCommit !== expected) throw new Error('Existing monitor evidence belongs to another commit');
function compactRun(run) {
  if (!run) return run;
  const notes = typeof run.notes === 'string' ? JSON.parse(run.notes) : run.notes || {};
  const { discoveries, ...summary } = notes;
  return { ...run, notes: { ...summary, discoveriesCount: discoveries?.length ?? notes.discoveriesCount } };
}
for (const row of result.rows) row.run = compactRun(row.run);
(async () => {
  for (;;) {
    const row = { observedAt: new Date().toISOString() };
    try {
      const response = await fetch('https://tawveeri.com/api/debug/scheduler', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, signal: AbortSignal.timeout(30000) });
      row.httpStatus = response.status;
      if (!response.ok) throw new Error(`Scheduler HTTP ${response.status}`);
      const runtime = await response.json();
      row.commit = runtime.commit; row.heartbeat = runtime.heartbeat; row.resources = runtime.samsungRuntimeResources;
      row.schedulerExit = runtime.schedulerExit;
      row.samsungLog = [runtime.schedulerStdout, runtime.schedulerStderr].filter(Boolean).join('\n').split('\n')
        .filter(line => /samsung|realization-health|storefront-health|run_id|EAGAIN|singleton/i.test(line)).slice(-30);
      const [job, run] = await Promise.all([
        sb.from('tps_job_state').select('*').eq('job', 'samsung-delta-watch').single(),
        sb.from('samsung_delta_watch_runs').select('*').order('started_at', { ascending: false }).limit(1),
      ]);
      if (job.error || run.error) throw new Error(job.error?.message || run.error?.message);
      row.job = job.data; row.run = compactRun(run.data[0]);
      result.rows.push(row);
      const success = row.commit === expected && row.run?.status === 'completed'
        && Date.parse(row.run.started_at) > Date.parse(result.startedAt)
        && Date.parse(row.job.last_success_at) >= Date.parse(row.run.finished_at);
      if (success) result.completedAt = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ at: row.observedAt, commit: row.commit, resources: row.resources,
        run: row.run && { id: row.run.run_id, status: row.run.status, started: row.run.started_at }, lastSuccess: row.job.last_success_at, success }));
      if (success) break;
    } catch (error) { row.error = String(error); result.rows.push(row); fs.writeFileSync(file, JSON.stringify(result, null, 2)); console.log(row.error); }
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
