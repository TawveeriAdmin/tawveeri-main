/**
 * Engineering-debt fix (integrated review, 2026-08-30): emitShadowFunnelEvent()
 * and recordShadowOutcome() previously only caught THROWN exceptions — a
 * PostgREST-level {error} response resolves normally (no throw), so a failed
 * write vanished with zero trace anywhere. Both now log a returned {error}
 * to console.error while preserving the original contract exactly: never
 * throws, always resolves void, never blocks the caller. These are pure
 * observability regression tests — no database required.
 */

import { emitShadowFunnelEvent, recordShadowOutcome } from '@/lib/growth/demand-radar/shadow/shadow-funnel';

type MockResult = { error: { message: string } | null };

function mockClientReturning(result: MockResult) {
  return {
    from: (_table: string) => ({
      insert: (_payload: any) => Promise.resolve(result),
      upsert: (_payload: any, _opts: any) => Promise.resolve(result),
    }),
  };
}

let currentClient: any;
jest.mock('@/lib/database', () => ({
  createServerClient: () => currentClient,
}));

const baseFunnelEvent = {
  fingerprint: 'fp-1', source: 'x' as const, domain: 'product' as const, category: 'laptop',
  stage: 'fetched' as const, detail: null, opportunityScore: null, answerabilityStatus: null,
  queryFamily: 'PRODUCT_RECOMMENDATION', isTest: true,
};
const baseOutcome = {
  fingerprint: 'fp-1', tier: null, domain: 'product' as const, category: 'laptop',
  intentType: null, buyingStage: null, exclusion: null, opportunityScore: null,
  answerabilityStatus: null, queryFamily: 'PRODUCT_RECOMMENDATION', isTest: true,
  retrievedByRadar1: null, shadowReviewLabel: null,
};

describe('emitShadowFunnelEvent — swallowed-failure observability fix', () => {
  let errSpy: jest.SpyInstance;
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { errSpy.mockRestore(); });

  it('a PostgREST {error} response (no thrown exception) is now logged, not silently dropped', async () => {
    currentClient = mockClientReturning({ error: { message: 'permission denied' } });
    await expect(emitShadowFunnelEvent(baseFunnelEvent)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0].join(' ')).toContain('permission denied');
  });

  it('a thrown exception (network failure) is still caught and logged, never propagated', async () => {
    currentClient = { from: () => { throw new Error('network down'); } };
    await expect(emitShadowFunnelEvent(baseFunnelEvent)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0].join(' ')).toContain('network down');
  });

  it('success logs nothing', async () => {
    currentClient = mockClientReturning({ error: null });
    await emitShadowFunnelEvent(baseFunnelEvent);
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe('recordShadowOutcome — swallowed-failure observability fix', () => {
  let errSpy: jest.SpyInstance;
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { errSpy.mockRestore(); });

  it('an upsert {error} response (fingerprint present) is now logged, not silently dropped', async () => {
    currentClient = mockClientReturning({ error: { message: 'constraint violation' } });
    await expect(recordShadowOutcome(baseOutcome)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0].join(' ')).toContain('constraint violation');
  });

  it('an insert {error} response (no fingerprint) is now logged, not silently dropped', async () => {
    currentClient = mockClientReturning({ error: { message: 'insert failed' } });
    await expect(recordShadowOutcome({ ...baseOutcome, fingerprint: null })).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls[0].join(' ')).toContain('insert failed');
  });

  it('a thrown exception is still caught and logged, never propagated', async () => {
    currentClient = { from: () => { throw new Error('network down'); } };
    await expect(recordShadowOutcome(baseOutcome)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it('success logs nothing', async () => {
    currentClient = mockClientReturning({ error: null });
    await recordShadowOutcome(baseOutcome);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
