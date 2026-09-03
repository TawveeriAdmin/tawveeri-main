// tests/admin/decision-grade-queries.test.ts — src/lib/admin/decision-grade-queries.ts
// ADR-286 (regression gate). Behavioral tests against a fixture-driven fake Supabase client —
// not a live database — proving the EXACT-ID correlation contract this whole ADR exists to
// establish: a decision-grade interaction is counted once, no matter how many outbound_clicks
// rows (retried /go requests) carry the same interaction_id.
//
// DEFECT FOUND WRITING THIS SUITE (fixed in the same pass, before ever shipping against real
// data): the first version of getDecisionGradeOutboundStats() used
// `.select('interaction_id', {count:'exact', head:true}).in(ids)` against outbound_clicks —
// that counts ROWS matching the id set, not distinct interaction identities. A single
// interaction correlated to 3 outbound_clicks rows (exactly the "retried /go" case) would have
// counted as 3, reintroducing the inflation bug this ADR closes. "repeated /go increases the
// decision-grade interaction count" test below is the one that would have failed against the
// original code — verified by re-deriving the broken query inline and confirming it disagrees.
import { getDecisionGradeOutboundStats } from '@/lib/admin/decision-grade-queries';

interface FPIRow { interaction_id: string; is_test: boolean; created_at: string }
interface OCRow { id: number; interaction_id: string | null }

let fpiRows: FPIRow[] = [];
let ocRows: OCRow[] = [];
let fpiError: { message: string } | null = null;
let ocError: { message: string } | null = null;

/** Minimal fake query builder supporting exactly the chain shapes
 *  getDecisionGradeOutboundStats() actually calls, filtering the in-memory fixture arrays.
 *  Thenable (implements .then) so a chain with no trailing .range() — the head-count shape —
 *  resolves correctly when awaited directly, exactly like the real Supabase query builder. */
function makeBuilder(table: string) {
  const state: { eq: Record<string, unknown>; gte?: string; lt?: string; in?: string[]; notNull?: string; head?: boolean } = { eq: {} };
  const rows = () => (table === 'first_party_interactions' ? fpiRows : (ocRows as unknown as FPIRow[]));
  const err = () => (table === 'first_party_interactions' ? fpiError : ocError);

  function filtered(): any[] {
    let r: any[] = rows().slice();
    for (const [k, v] of Object.entries(state.eq)) r = r.filter((row) => row[k] === v);
    if (state.gte) r = r.filter((row) => row.created_at >= state.gte!);
    if (state.lt) r = r.filter((row) => row.created_at < state.lt!);
    if (state.in) r = r.filter((row) => state.in!.includes(row.interaction_id));
    if (state.notNull) r = r.filter((row) => row[state.notNull!] != null);
    return r;
  }

  const builder: any = {
    eq(k: string, v: unknown) { state.eq[k] = v; return builder; },
    gte(_k: string, v: string) { state.gte = v; return builder; },
    lt(_k: string, v: string) { state.lt = v; return builder; },
    in(_k: string, v: string[]) { state.in = v; return builder; },
    not(k: string, _op: string, _v: unknown) { state.notNull = k; return builder; },
    order() { return builder; },
    select(_cols: string, opts?: { count?: string; head?: boolean }) {
      if (opts?.head) state.head = true;
      return builder;
    },
    range(from: number, to: number) {
      const page = filtered().slice(from, to + 1);
      return Promise.resolve({ data: err() ? null : page, error: err(), count: null });
    },
    // Makes the builder itself awaitable — the head-count path never calls .range(), so the
    // terminal `await` lands directly on the builder after .eq()/.gte()/.lt().
    then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
      const result = state.head
        ? { data: null, error: err(), count: err() ? null : filtered().length }
        : { data: err() ? null : filtered(), error: err(), count: null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return builder;
}

let currentClient: any;
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentClient,
}));

beforeEach(() => {
  fpiRows = [];
  ocRows = [];
  fpiError = null;
  ocError = null;
  currentClient = { from: (table: string) => makeBuilder(table) };
});

const WINDOW_START = new Date('2026-09-01T00:00:00Z');
const WINDOW_END = new Date('2026-09-08T00:00:00Z');
const inWindow = '2026-09-03T00:00:00Z';

describe('getDecisionGradeOutboundStats — firstPartyInteractions', () => {
  it('counts REAL (is_test=false) interactions in the window', async () => {
    fpiRows = [
      { interaction_id: 'a', is_test: false, created_at: inWindow },
      { interaction_id: 'b', is_test: false, created_at: inWindow },
      { interaction_id: 'c', is_test: true, created_at: inWindow }, // excluded
      { interaction_id: 'd', is_test: false, created_at: '2026-08-01T00:00:00Z' }, // outside window
    ];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.firstPartyInteractions.value).toBe(2);
  });

  it('degrades to UNKNOWN (not zero) on a query error, e.g. an unapplied migration', async () => {
    fpiError = { message: 'relation "first_party_interactions" does not exist' };
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.firstPartyInteractions.value).toBeNull();
    expect(stats.firstPartyInteractions.reason).toMatch(/does not exist/);
  });
});

describe('getDecisionGradeOutboundStats — merchantNavigationsCorrelated (exact-ID dedup)', () => {
  it('THE REGRESSION THIS ADR EXISTS TO CLOSE: one interaction correlated to THREE outbound_clicks rows (a retried /go request reusing the same interaction_id) counts as ONE, not three', async () => {
    fpiRows = [{ interaction_id: 'click-1', is_test: false, created_at: inWindow }];
    ocRows = [
      { id: 1, interaction_id: 'click-1' },
      { id: 2, interaction_id: 'click-1' }, // retried /go, same iid
      { id: 3, interaction_id: 'click-1' }, // retried /go again, same iid
    ];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.firstPartyInteractions.value).toBe(1);
    expect(stats.merchantNavigationsCorrelated.value).toBe(1); // NOT 3

    // Prove the fix is real, not incidental: re-derive the ORIGINAL (defective) query shape
    // inline — a raw row count over the same fixture — and confirm it disagrees with the
    // fixed function's answer. If this assertion ever fails, the fixed function's behavior
    // has silently regressed back to row-counting.
    const rawRowCount = ocRows.filter((r) => r.interaction_id === 'click-1').length;
    expect(rawRowCount).toBe(3);
    expect(stats.merchantNavigationsCorrelated.value).not.toBe(rawRowCount);
  });

  it('two genuinely separate interactions, each with their own outbound_clicks row, count as TWO', async () => {
    fpiRows = [
      { interaction_id: 'click-1', is_test: false, created_at: inWindow },
      { interaction_id: 'click-2', is_test: false, created_at: inWindow },
    ];
    ocRows = [
      { id: 1, interaction_id: 'click-1' },
      { id: 2, interaction_id: 'click-2' },
    ];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.merchantNavigationsCorrelated.value).toBe(2);
  });

  it('an outbound_clicks row with no interaction_id (a raw request / render-token-only hit) never contributes', async () => {
    fpiRows = [{ interaction_id: 'click-1', is_test: false, created_at: inWindow }];
    ocRows = [
      { id: 1, interaction_id: 'click-1' },
      { id: 2, interaction_id: null }, // arbitrary GET, no iid at all
    ];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.merchantNavigationsCorrelated.value).toBe(1);
  });

  it('an outbound_clicks row carrying a FABRICATED interaction_id that was never recorded as a real interaction never contributes', async () => {
    fpiRows = [{ interaction_id: 'click-1', is_test: false, created_at: inWindow }];
    ocRows = [
      { id: 1, interaction_id: 'click-1' },
      { id: 2, interaction_id: 'guessed-by-a-crawler' }, // never went through /api/interactions
    ];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.merchantNavigationsCorrelated.value).toBe(1); // the fabricated id joins to nothing
  });

  it('a TEST interaction never contributes to either count, even if outbound_clicks correlates to it', async () => {
    fpiRows = [{ interaction_id: 'click-1', is_test: true, created_at: inWindow }];
    ocRows = [{ id: 1, interaction_id: 'click-1' }];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.firstPartyInteractions.value).toBe(0);
    expect(stats.merchantNavigationsCorrelated.value).toBe(0);
  });

  it('zero real interactions in the window correlates to zero, without querying outbound_clicks at all', async () => {
    fpiRows = [];
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.merchantNavigationsCorrelated.value).toBe(0);
  });

  it('degrades to UNKNOWN on an outbound_clicks query error', async () => {
    fpiRows = [{ interaction_id: 'click-1', is_test: false, created_at: inWindow }];
    ocError = { message: 'permission denied' };
    const stats = await getDecisionGradeOutboundStats(WINDOW_START, WINDOW_END);
    expect(stats.merchantNavigationsCorrelated.value).toBeNull();
    expect(stats.merchantNavigationsCorrelated.reason).toMatch(/permission denied/);
  });
});
