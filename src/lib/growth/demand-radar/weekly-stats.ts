// Minimal weekly expiry counter (founder decision 2026-08-26): the 24h
// founder-review expiry now hard-deletes instead of soft-marking `expired`,
// and keeps no per-item detail — only how many were auto-cleared each week
// survives, in `demand_radar_weekly_stats`, so over-flagging is visible later
// without re-litigating individual posts.

/** Monday (UTC) of the ISO week containing `d`, as YYYY-MM-DD. */
export function isoWeekStart(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon=0, Sun=6
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
}

/** Adds `count` hard-deletions to this week's running total. No-op for count<=0. */
export async function recordWeeklyExpiry(sb: any, count: number, now = new Date()): Promise<void> {
  if (count <= 0) return;
  const weekStart = isoWeekStart(now);
  const { data: existing } = await sb
    .from('demand_radar_weekly_stats')
    .select('expired_count')
    .eq('week_start', weekStart)
    .maybeSingle();
  await sb.from('demand_radar_weekly_stats').upsert(
    {
      week_start: weekStart,
      expired_count: (existing?.expired_count ?? 0) + count,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'week_start' }
  );
}
