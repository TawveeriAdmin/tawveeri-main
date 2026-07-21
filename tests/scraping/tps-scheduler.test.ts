/**
 * E6 — TPS scheduler safety invariants (ADR-025).
 * Pure-logic + behavioral tests (no live DB): hard bound, fingerprint, category
 * isolation, and route-wiring drift guards. Integration items (lock over HTTP,
 * overlap rejection, retry) are demonstrated in production (Phase 6), not here.
 */
import fs from 'fs';
import path from 'path';
import {
  assertBatchInvariants, assertFingerprint, perStoreLimit,
  TPS_MAX_OBSERVATIONS, type TpsBatchOptions,
} from '../../scripts/tps-core/tps-batch';
import { runMobileBatch } from '../../scripts/tps-matcher/mobile-matcher-v2-dry';
import { runAcBatch } from '../../scripts/tps-matcher/ac-matcher-v1-dry';

const base = (o: Partial<TpsBatchOptions>): TpsBatchOptions => ({
  category: 'mobile', dryRun: true, limit: 100, expectedFingerprint: 'vyceqrzttspyycdpojtn', ...o,
});

describe('hard-bound + validation invariants', () => {
  it('accepts a valid bounded invocation', () => {
    expect(() => assertBatchInvariants(base({ limit: 100 }))).not.toThrow();
  });
  it('accepts exactly 500', () => {
    expect(() => assertBatchInvariants(base({ limit: 500 }))).not.toThrow();
    expect(TPS_MAX_OBSERVATIONS).toBe(500);
  });
  it('rejects limit greater than 500', () => {
    expect(() => assertBatchInvariants(base({ limit: 501 }))).toThrow(/exceeds hard bound/);
    expect(() => assertBatchInvariants(base({ limit: 100000 }))).toThrow(/exceeds hard bound/);
  });
  it('rejects limit below the minimum', () => {
    expect(() => assertBatchInvariants(base({ limit: 0 }))).toThrow(/below minimum/);
    expect(() => assertBatchInvariants(base({ limit: -5 }))).toThrow(/below minimum/);
  });
  it('rejects an unsupported category', () => {
    expect(() => assertBatchInvariants(base({ category: 'tv' as never }))).toThrow(/invalid category/);
    expect(() => assertBatchInvariants(base({ category: 'all' as never }))).toThrow(/invalid category/);
  });
  it('requires an expected fingerprint', () => {
    expect(() => assertBatchInvariants(base({ expectedFingerprint: '' }))).toThrow(/[Ff]ingerprint/);
  });
});

describe('fingerprint enforcement', () => {
  it('passes when the project ref matches', () => {
    expect(() => assertFingerprint('https://vyceqrzttspyycdpojtn.supabase.co', 'vyceqrzttspyycdpojtn')).not.toThrow();
  });
  it('refuses a mismatched project (e.g. legacy)', () => {
    expect(() => assertFingerprint('https://ffpsjjazsluolysgithg.supabase.co', 'vyceqrzttspyycdpojtn')).toThrow(/mismatch/);
  });
});

describe('per-store split keeps the sum within the total bound', () => {
  it('mobile (4 stores): 500 → 125/store', () => expect(perStoreLimit(500, 4)).toBe(125));
  it('AC (2 stores): 500 → 250/store', () => expect(perStoreLimit(500, 2)).toBe(250));
  it('never returns 0', () => expect(perStoreLimit(1, 4)).toBe(1));
});

describe('category isolation (behavioral — throws before any DB access)', () => {
  it('runMobileBatch refuses a non-mobile category', async () => {
    const r = await runMobileBatch(base({ category: 'air_conditioner' }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/category isolation/);
    expect(r.writtenCanonicals).toBe(0);
  });
  it('runAcBatch refuses a non-AC category', async () => {
    const r = await runAcBatch(base({ category: 'mobile' }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/category isolation/);
    expect(r.writtenCanonicals).toBe(0);
  });
  it('a fingerprint mismatch is refused before any write', async () => {
    const r = await runAcBatch(base({ category: 'air_conditioner', expectedFingerprint: 'wrongproject' }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/fingerprint mismatch/);
    expect(r.writtenCanonicals).toBe(0);
  });
});

describe('scheduler route wiring (drift guard)', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'api', 'cron', 'tps-batch', 'route.ts'), 'utf8');
  it('requires Bearer CRON_SECRET auth and rejects anonymous', () => {
    expect(src).toMatch(/authorized\(req\)/);
    expect(src).toMatch(/Bearer \$\{secret\}/);
    expect(src).toMatch(/status: 401/);
  });
  it('rejects unsupported category and forbids "all"', () => {
    expect(src).toMatch(/category !== 'mobile' && category !== 'air_conditioner'/);
    expect(src).toMatch(/no 'all'/);
  });
  it('enforces the <=500 hard bound and a minimum', () => {
    expect(src).toMatch(/limit > TPS_MAX_OBSERVATIONS/);
    expect(src).toMatch(/limit < TPS_MIN_OBSERVATIONS/);
  });
  it('acquires the atomic lock and returns 409 on overlap', () => {
    expect(src).toMatch(/tps_acquire_run/);
    expect(src).toMatch(/overlapRejected: true/);
    expect(src).toMatch(/status: 409/);
  });
  it('defaults dryRun to true (writes require explicit dryRun:false)', () => {
    expect(src).toMatch(/dryRun = body\.dryRun !== false/);
  });
  it('POST executes; GET is read-only health', () => {
    expect(src).toMatch(/export async function POST/);
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/read-only health/);
  });
  it('validates the production fingerprint and finishes the run with sanitized metadata', () => {
    expect(src).toMatch(/const FINGERPRINT = 'vyceqrzttspyycdpojtn'/);
    expect(src).toMatch(/tps_finish_run/);
    // never references the raw service-role key, and never returns the secret value.
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/json\([^)]*process\.env\.CRON_SECRET/);
  });
});
