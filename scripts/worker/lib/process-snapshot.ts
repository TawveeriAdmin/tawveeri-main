import { readdirSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';

// Process names and resource counters only. Never read cmdline or environ.
export function parseProcessStatus(text: string) {
  const fields = Object.fromEntries(text.split('\n').map(line => {
    const i = line.indexOf(':'); return [line.slice(0, i), line.slice(i + 1).trim()];
  }));
  return {
    name: (fields.Name || '?').slice(0, 40),
    ppid: Number(fields.PPid), state: (fields.State || '?').split(' ')[0],
    threads: Number(fields.Threads || 0), rssKb: Number((fields.VmRSS || '0').split(/\s/)[0]),
  };
}

export function processAgeSeconds(stat: string, uptime: number, ticks: number | null): number | null {
  if (!ticks || ticks <= 0) return null;
  // comm may itself contain spaces and parentheses. Field 22 is index 19
  // after the final closing parenthesis (the remainder begins at field 3).
  const start = Number(stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/)[19]);
  const age = uptime - start / ticks;
  return Number.isFinite(age) && age >= 0 ? Math.floor(age) : null;
}

export function collectProcessSnapshot() {
  if (process.platform !== 'linux') return { supported: false };
  let ticks: number | null = null;
  try { ticks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8', timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { /* age remains unknown */ }
  const uptime = Number(readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
  const ids = readdirSync('/proc').filter(id => /^\d+$/.test(id));
  const rows = [];
  for (const id of ids.slice(0, 2048)) {
    try {
      const status = parseProcessStatus(readFileSync(`/proc/${id}/status`, 'utf8'));
      rows.push({ pid: Number(id), ...status, ageSeconds: processAgeSeconds(readFileSync(`/proc/${id}/stat`, 'utf8'), uptime, ticks) });
    } catch { /* process exited between enumeration and read */ }
  }
  return {
    supported: true, observedAt: new Date().toISOString(), enumerated: ids.length,
    sampled: rows.length, threads: rows.reduce((sum, row) => sum + row.threads, 0),
    zombies: rows.filter(row => row.state === 'Z').length,
    truncated: ids.length > 2048 || rows.length > 64,
    processes: rows.sort((a, b) => b.rssKb - a.rssKb || a.pid - b.pid).slice(0, 64),
  };
}
