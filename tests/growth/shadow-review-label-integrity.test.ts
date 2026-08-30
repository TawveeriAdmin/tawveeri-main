/**
 * Radar 2.0 Phase 2 — measurement-integrity fix (founder decision
 * 2026-08-30). labelShadowReview() used to call recordShadowOutcome(),
 * which performs a FULL-ROW upsert — every successful founder label write
 * silently nulled exclusion/opportunity_score/answerability_status/tier/
 * intent_type/buying_stage on the SAME row it was supposed to only label
 * (confirmed against production: all 72 previously-labeled Shadow rows lost
 * those fields). The fix is updateShadowOutcomeReviewLabel(), a plain
 * two-column UPDATE. Proof by construction: since Postgres/PostgREST only
 * ever touches the columns present in an update payload, pinning the exact
 * payload key-set is a complete, mechanism-level proof that no other column
 * can be touched — stronger than observing one row's before/after state.
 *
 * Pure unit tests: @/lib/database is mocked, no database required.
 */

import { labelShadowReview } from '@/lib/growth/demand-radar/shadow/shadow-review';
import { SHADOW_FORBIDDEN_FIELDS } from '@/lib/growth/demand-radar/shadow/shadow-funnel';

type Call = { table: string; op: 'update' | 'insert'; payload: any };

function makeMockClient(opts: {
  queueSelectResult?: { data: any; error: any };
  outcomeUpdateError?: { message: string } | null;
  /** Rows the outcomes-table UPDATE's .select() should report as affected.
   *  Defaults to one matching row (the normal case). An empty array
   *  simulates a fingerprint that matches nothing — the zero-row bug this
   *  file's second describe block regression-tests. */
  outcomeUpdateAffectedRows?: any[];
} = {}) {
  const calls: Call[] = [];
  const queueSelectResult = opts.queueSelectResult ?? {
    data: { fingerprint: 'fp-abc123', category: 'laptop', retrieved_by_radar1: false, is_test: true, query_family: 'PRODUCT_RECOMMENDATION' },
    error: null,
  };
  const outcomeUpdateError = opts.outcomeUpdateError ?? null;
  const outcomeUpdateAffectedRows = opts.outcomeUpdateAffectedRows ?? [{ fingerprint: 'fp-abc123' }];

  function from(table: string) {
    if (table === 'demand_radar_shadow_review_queue') {
      return {
        update(payload: any) {
          calls.push({ table, op: 'update', payload });
          return {
            eq(_col: string, _val: string) {
              return {
                select(_cols: string) {
                  return { single: () => Promise.resolve(queueSelectResult) };
                },
              };
            },
          };
        },
      };
    }
    if (table === 'demand_radar_shadow_outcomes') {
      return {
        update(payload: any) {
          calls.push({ table, op: 'update', payload });
          return {
            eq: (_col: string, _val: string) => ({
              select: (_cols: string) =>
                Promise.resolve(
                  outcomeUpdateError
                    ? { data: null, error: outcomeUpdateError }
                    : { data: outcomeUpdateAffectedRows, error: null }
                ),
            }),
          };
        },
      };
    }
    if (table === 'demand_radar_shadow_funnel_events') {
      return {
        insert(payload: any) {
          calls.push({ table, op: 'insert', payload });
          return Promise.resolve({ error: null });
        },
      };
    }
    throw new Error(`unexpected table in mock: ${table}`);
  }

  return { client: { from }, calls };
}

let currentMock = makeMockClient();
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentMock.client,
}));

const outcomeUpdate = (calls: Call[]) => calls.find((c) => c.table === 'demand_radar_shadow_outcomes' && c.op === 'update')!;
const funnelInserts = (calls: Call[]) => calls.filter((c) => c.table === 'demand_radar_shadow_funnel_events');

describe('labelShadowReview — measurement-integrity fix', () => {
  it('1+2. the outcome-table update payload contains ONLY shadow_review_label and shadow_reviewed_at — every pre-existing analytical field is structurally untouchable', async () => {
    currentMock = makeMockClient();
    const result = await labelShadowReview('row-1', 'valuable');
    expect(result.ok).toBe(true);

    const upd = outcomeUpdate(currentMock.calls);
    expect(Object.keys(upd.payload).sort()).toEqual(['shadow_review_label', 'shadow_reviewed_at']);
    // explicitly pin that none of the previously-lost fields are present
    for (const forbidden of ['exclusion', 'opportunity_score', 'answerability_status', 'tier', 'intent_type', 'buying_stage', 'category', 'query_family', 'retrieved_by_radar1', 'is_test']) {
      expect(upd.payload).not.toHaveProperty(forbidden);
    }
    expect(upd.payload.shadow_review_label).toBe('valuable');
    expect(typeof upd.payload.shadow_reviewed_at).toBe('string');
  });

  it('3. repeated labeling (relabel with a different label) remains safe — every call still touches only the two intended fields', async () => {
    currentMock = makeMockClient();
    const first = await labelShadowReview('row-1', 'not_a_lead');
    const second = await labelShadowReview('row-1', 'valuable');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const updates = currentMock.calls.filter((c) => c.table === 'demand_radar_shadow_outcomes' && c.op === 'update');
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      expect(Object.keys(u.payload).sort()).toEqual(['shadow_review_label', 'shadow_reviewed_at']);
    }
    expect(updates[0].payload.shadow_review_label).toBe('not_a_lead');
    expect(updates[1].payload.shadow_review_label).toBe('valuable'); // last write wins — current intended semantics, no relabel guard exists
  });

  it('4. a failed outcome-table write returns ok:false and is a single atomic UPDATE — no partial mutation is possible', async () => {
    currentMock = makeMockClient({ outcomeUpdateError: { message: 'db unavailable' } });
    const result = await labelShadowReview('row-1', 'valuable');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('db unavailable');
    // exactly one update call was attempted (a single statement — atomic by construction, nothing to partially apply)
    const updates = currentMock.calls.filter((c) => c.table === 'demand_radar_shadow_outcomes' && c.op === 'update');
    expect(updates).toHaveLength(1);
  });

  it('engineering-debt fix: a zero-row outcome UPDATE (fingerprint matches nothing) is reported as a FAILURE, not a false success', async () => {
    // Regression test for the exact defect flagged in the integrated review
    // (2026-08-30): PostgREST reports no error when an UPDATE's WHERE clause
    // matches zero rows, so without checking affected-row existence this
    // silently "succeeded" while never persisting the founder's label.
    currentMock = makeMockClient({ outcomeUpdateAffectedRows: [] });
    const result = await labelShadowReview('row-1', 'valuable');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no matching outcome row/i);
    // exactly one update was attempted — the bug is in how the result is
    // interpreted, not in retrying or double-writing
    const updates = currentMock.calls.filter((c) => c.table === 'demand_radar_shadow_outcomes' && c.op === 'update');
    expect(updates).toHaveLength(1);
  });

  it('a missing/invalid row id fails cleanly without ever reaching the outcomes table', async () => {
    currentMock = makeMockClient({ queueSelectResult: { data: null, error: { message: 'no rows' } } });
    const result = await labelShadowReview('does-not-exist', 'valuable');
    expect(result.ok).toBe(false);
    const outcomeUpdates = currentMock.calls.filter((c) => c.table === 'demand_radar_shadow_outcomes');
    expect(outcomeUpdates).toHaveLength(0);
  });
});

describe('review_label_submitted / review_label_failed — observability semantics', () => {
  it('a successful label emits exactly one review_label_submitted event, never review_label_failed', async () => {
    currentMock = makeMockClient();
    await labelShadowReview('row-1', 'valuable');
    const events = funnelInserts(currentMock.calls);
    expect(events).toHaveLength(1);
    expect(events[0].payload.stage).toBe('review_label_submitted');
    expect(events[0].payload.fingerprint).toBe('fp-abc123');
    expect(events[0].payload.category).toBe('laptop');
    expect(events[0].payload.query_family).toBe('PRODUCT_RECOMMENDATION');
    expect(events[0].payload.is_test).toBe(true);
  });

  it('persistence failure (request reached the server) emits review_label_failed, never review_label_submitted', async () => {
    currentMock = makeMockClient({ outcomeUpdateError: { message: 'db unavailable' } });
    await labelShadowReview('row-1', 'valuable');
    const events = funnelInserts(currentMock.calls);
    expect(events).toHaveLength(1);
    expect(events[0].payload.stage).toBe('review_label_failed');
    expect(events[0].payload.detail).toBe('outcome_update_failed');
  });

  it('a zero-row outcome UPDATE emits review_label_failed with detail outcome_update_failed, never review_label_submitted', async () => {
    currentMock = makeMockClient({ outcomeUpdateAffectedRows: [] });
    await labelShadowReview('row-1', 'valuable');
    const events = funnelInserts(currentMock.calls);
    expect(events).toHaveLength(1);
    expect(events[0].payload.stage).toBe('review_label_failed');
    expect(events[0].payload.detail).toBe('outcome_update_failed');
    expect(events[0].payload.fingerprint).toBe('fp-abc123'); // fingerprint WAS resolved (queue row existed) — only the outcomes write failed
  });

  it('a bad/missing row id still emits review_label_failed (request reached the server), de-identified since no fingerprint was ever resolved', async () => {
    currentMock = makeMockClient({ queueSelectResult: { data: null, error: { message: 'no rows' } } });
    await labelShadowReview('does-not-exist', 'valuable');
    const events = funnelInserts(currentMock.calls);
    expect(events).toHaveLength(1);
    expect(events[0].payload.stage).toBe('review_label_failed');
    expect(events[0].payload.fingerprint).toBeNull();
    expect(events[0].payload.category).toBeNull();
  });

  it('an invalid label never even attempts a write or emits an event — no persistence was attempted', async () => {
    currentMock = makeMockClient();
    const result = await labelShadowReview('row-1', 'not-a-real-label' as any);
    expect(result.ok).toBe(false);
    expect(currentMock.calls).toHaveLength(0);
  });

  it('the emitted funnel event row never contains a forbidden (personal-data) field — same privacy contract as every other Shadow stage', async () => {
    currentMock = makeMockClient();
    await labelShadowReview('row-1', 'valuable');
    const events = funnelInserts(currentMock.calls);
    for (const forbidden of SHADOW_FORBIDDEN_FIELDS) {
      expect(events[0].payload).not.toHaveProperty(forbidden);
    }
    // and pin the exact allowed shape — nothing beyond what was approved
    expect(Object.keys(events[0].payload).sort()).toEqual([
      'answerability_status', 'category', 'detail', 'domain', 'fingerprint',
      'is_test', 'opportunity_score', 'query_family', 'source', 'stage',
    ].sort());
  });
});
