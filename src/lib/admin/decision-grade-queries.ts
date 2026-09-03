// src/lib/admin/decision-grade-queries.ts
// ADR-286 (third pass) — the actual decision-grade read contract. Founder/business reporting
// must never infer customer traction from raw `outbound_clicks` alone (a bare GET was always
// sufficient to write one — that is the whole incident this ADR closes). Post-cutover, the
// authoritative first-party interaction count comes from `first_party_interactions`
// (migration 46), filtered `is_test = false`; merchant-navigation correlation is an EXACT
// join on `interaction_id`, never a nearest-timestamp/session heuristic (rejected as the
// primary mechanism — see ADR-286's second correction pass for why).
//
// GRACEFUL ON AN UNAPPLIED MIGRATION: both migrations 45/46 are still unapplied as of this
// writing. Every query here degrades to `{value: null, reason}` on any Supabase error
// (including "relation does not exist") — same `Metric` convention founder-home-queries.ts
// already uses everywhere else — so this module is safe to wire in NOW, before the migration
// ships, without crashing the page it's added to.
import { createServerClient } from '@/lib/database';

export interface Metric {
  value: number | null;
  reason?: string;
}

const metric = (count: number | null, error?: { message: string } | null): Metric =>
  error ? { value: null, reason: error.message } : { value: count ?? 0 };

export interface DecisionGradeOutboundStats {
  /** First-party UI interactions recorded in the window, REAL only. The authoritative
   *  decision-grade count — every row here required a real onClick to have fired
   *  (src/lib/analytics/interaction.ts), never merely a rendered page or a valid render-token. */
  firstPartyInteractions: Metric;
  /** DISTINCT interaction_ids from outbound_clicks that exact-match a REAL first_party_interactions
   *  row — "merchant navigations we can prove followed a proven interaction". Deduplicated by
   *  interaction identity: a retried /go request for the same click never inflates this past 1. */
  merchantNavigationsCorrelated: Metric;
}

/** Real-only, exact-ID decision-grade stats for [start, end). Never throws. */
export async function getDecisionGradeOutboundStats(start: Date, end: Date): Promise<DecisionGradeOutboundStats> {
  const supabase = createServerClient() as unknown as { from: (table: string) => any };

  const interactions = await supabase
    .from('first_party_interactions')
    .select('interaction_id', { count: 'exact', head: true })
    .eq('is_test', false)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  // Correlated navigations: fetch REAL interaction_ids in-window, then fetch every
  // outbound_clicks.interaction_id that exact-matches one of them and dedupe CLIENT-SIDE into
  // a Set before counting.
  const idRows = await fetchAllInteractionIds(supabase, start, end);
  //
  // FIXED DURING THIS PASS'S OWN TEST-WRITING (not a pre-existing shipped defect — caught
  // before this ever ran against real data): the previous version used
  // `.select('interaction_id', {count:'exact', head:true}).in(...)`, which counts ROWS in
  // outbound_clicks matching the id set — NOT distinct interaction identities. A single
  // interaction correlated to 3 outbound_clicks rows (e.g. a retried /go request carrying the
  // same `iid`) would have counted as 3, silently reintroducing exactly the "repeated /go
  // inflates the metric" failure mode this whole ADR exists to close, directly contradicting
  // this function's own doc comment. Regression-tested below (decision-grade-queries.test.ts)
  // specifically for this case.
  let correlated: Metric = { value: 0 };
  if (idRows.error) {
    correlated = { value: null, reason: idRows.error.message };
  } else if (idRows.ids.length > 0) {
    const targetIds = new Set(idRows.ids);
    const distinctCorrelated = new Set<string>();
    let queryError: { message: string } | null = null;
    for (let i = 0; i < idRows.ids.length && !queryError; i += 500) {
      const chunk = idRows.ids.slice(i, i + 500);
      let from = 0;
      const pageSize = 1000;
      for (;;) {
        const r = await supabase
          .from('outbound_clicks')
          .select('interaction_id')
          .in('interaction_id', chunk)
          .not('interaction_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (r.error) { queryError = r.error; break; }
        for (const row of (r.data ?? []) as Array<{ interaction_id: string | null }>) {
          if (row.interaction_id && targetIds.has(row.interaction_id)) distinctCorrelated.add(row.interaction_id);
        }
        if (!r.data || r.data.length < pageSize) break;
        from += pageSize;
      }
    }
    correlated = queryError ? { value: null, reason: queryError.message } : { value: distinctCorrelated.size };
  }

  return {
    firstPartyInteractions: metric(interactions.count, interactions.error),
    merchantNavigationsCorrelated: correlated,
  };
}

async function fetchAllInteractionIds(
  supabase: { from: (table: string) => any },
  start: Date,
  end: Date
): Promise<{ ids: string[]; error: { message: string } | null }> {
  let ids: string[] = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('first_party_interactions')
      .select('interaction_id')
      .eq('is_test', false)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('interaction_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { ids: [], error };
    ids = ids.concat((data ?? []).map((r: { interaction_id: string }) => r.interaction_id));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { ids, error: null };
}
