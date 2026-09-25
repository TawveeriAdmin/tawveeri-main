// src/lib/founder/snapshots.ts — persists a computed metric pack as register-bound snapshot rows so
// summaries and reports quote a frozen, reproducible number (with its query hash and cutoff), not
// a live read that drifts as late events arrive.
import { createHash, randomUUID } from 'crypto';
import { createServerClient } from '@/lib/database';
import { DEFINITION_VERSION, METRICS } from './registry';
import { fetchWindowPack, type PackResult } from './metrics';
import type { MetricWindow } from './windows';

type AnyClient = { from: (table: string) => any };

export const PACK_QUERY_HASH = createHash('sha256').update('founder_window_metrics@' + DEFINITION_VERSION).digest('hex').slice(0, 16);

export interface SnapshotRun { runId: string; windows: Array<{ window: MetricWindow; result: PackResult; rows: number }> }

export async function snapshotWindows(windows: MetricWindow[], runId = randomUUID()): Promise<SnapshotRun> {
  const supabase = createServerClient() as unknown as AnyClient;
  const out: SnapshotRun = { runId, windows: [] };
  for (const w of windows) {
    const result = await fetchWindowPack(w);
    const rows: Record<string, unknown>[] = [];
    for (const def of Object.values(METRICS)) {
      if (!def.packKey) continue;
      const pack = result.ok ? (result.pack as unknown as Record<string, unknown>) : null;
      const num = pack ? pack[def.packKey] : null;
      const den = pack && def.denominatorKey ? pack[def.denominatorKey] : null;
      rows.push({
        metric_id: def.id, definition_version: DEFINITION_VERSION, window_kind: w.kind, window_start: w.start.toISOString(), window_end: w.end.toISOString(),
        numerator: num == null ? null : Number(num), denominator: den == null ? null : Number(den), unit: def.unit,
        coverage_state: !result.ok ? 'unavailable' : w.partial ? 'partial' : 'complete',
        computed_at: result.computedAt, last_event_at: result.ok ? result.pack.last_usage_event_at : null,
        query_hash: PACK_QUERY_HASH, snapshot_run_id: runId, meta: result.ok ? null : { reason: result.reason },
      });
    }
    if (rows.length) {
      const { error } = await supabase.from('founder_metric_snapshots').insert(rows);
      if (error) throw new Error(`snapshot insert failed: ${error.message}`);
    }
    out.windows.push({ window: w, result, rows: rows.length });
  }
  return out;
}

export interface SnapshotRow { metric_id: string; window_kind: string; window_start: string; window_end: string; numerator: number | null; denominator: number | null; coverage_state: string; computed_at: string; snapshot_run_id: string }

export async function latestSnapshots(windowKind: string, windowStart: Date, windowEnd: Date): Promise<SnapshotRow[]> {
  const supabase = createServerClient() as unknown as AnyClient;
  const { data } = await supabase.from('founder_metric_snapshots').select('metric_id, window_kind, window_start, window_end, numerator, denominator, coverage_state, computed_at, snapshot_run_id')
    .eq('window_kind', windowKind).eq('window_start', windowStart.toISOString()).eq('window_end', windowEnd.toISOString()).order('computed_at', { ascending: false }).limit(200);
  const seen = new Set<string>();
  const out: SnapshotRow[] = [];
  for (const r of (data ?? []) as SnapshotRow[]) { if (seen.has(r.metric_id)) continue; seen.add(r.metric_id); out.push({ ...r, numerator: r.numerator == null ? null : Number(r.numerator), denominator: r.denominator == null ? null : Number(r.denominator) }); }
  return out;
}
