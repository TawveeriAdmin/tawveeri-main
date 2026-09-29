/**
 * F-003 / F-004 — a price-update run that runs out of budget must tell the truth.
 *
 * MEASURED (production, 2026-09-29): amazon's two most recent `price_update` runs ended at
 * 480,443ms and 480,462ms against an 8-minute hard kill, recorded `status=failed`,
 * `products_updated=0`, `price_changes_detected=0` and no `stages` object at all — while the
 * same runs' logs show offers genuinely being saved ("[IngestionService] amazon: saved 1/1
 * raw observations"). The batch is `max_products=300` and the store's pages go through
 * Puppeteer, so the batch can never finish: the run is killed mid-flight every cycle and its
 * accounting is destroyed with it.
 *
 * These tests pin the two rules that make such a run honest:
 *   1. deferred work is NOT success (this file);
 *   2. deferred work is NOT counted as errors either (it was never attempted).
 */
import { priceUpdateOutcome } from '@/lib/scraping/services/price-update-outcome';

const baseStages = { selected: 0, attempted: 0, extracted: 0, accepted: 0, written: 0, observations_ingested: 0, product_only: 0, rejected: 0, deferred: 0 };

describe('F-003 · priceUpdateOutcome — a truncated run is partial, never success', () => {
  it('reports PARTIAL when the budget deadline deferred the tail of the batch', () => {
    // the shape amazon will now produce: ~90 refreshed, the rest never attempted
    expect(priceUpdateOutcome({
      success: true,
      products_updated: 90,
      errors: 0,
      deferred_quota_stores: [],
      stages: { ...baseStages, selected: 300, attempted: 90, accepted: 90, written: 90, deferred: 210 },
    })).toBe('partial');
  });

  it('reports FAILED when the deadline hit before anything was accepted', () => {
    expect(priceUpdateOutcome({
      success: true,
      products_updated: 0,
      errors: 0,
      deferred_quota_stores: [],
      stages: { ...baseStages, selected: 300, deferred: 300 },
    })).toBe('failed');
  });

  it('still reports SUCCESS for a genuinely complete run (no regression)', () => {
    expect(priceUpdateOutcome({
      success: true,
      products_updated: 15,
      errors: 0,
      deferred_quota_stores: [],
      stages: { ...baseStages, selected: 15, attempted: 15, accepted: 15, written: 15, deferred: 0 },
    })).toBe('success');
  });

  it('a deferral is not an error — the two are distinct signals', () => {
    const deferred = priceUpdateOutcome({
      success: true, products_updated: 5, errors: 0, deferred_quota_stores: [],
      stages: { ...baseStages, selected: 10, attempted: 5, accepted: 5, deferred: 5 },
    });
    const errored = priceUpdateOutcome({
      success: true, products_updated: 5, errors: 5, deferred_quota_stores: [],
      stages: { ...baseStages, selected: 10, attempted: 10, accepted: 5, deferred: 0 },
    });
    // both are honest "partial", but they arrive there from different facts
    expect(deferred).toBe('partial');
    expect(errored).toBe('partial');
  });

  it('an outright failure is still failed', () => {
    expect(priceUpdateOutcome({
      success: false, products_updated: 0, errors: 1, deferred_quota_stores: [], stages: { ...baseStages },
    })).toBe('failed');
  });
});

describe('F-003 · the soft deadline is wired to the same constant as the hard kill', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const parent = fs.readFileSync(path.join(process.cwd(), 'scripts/worker/jobs/price-update.ts'), 'utf8');
  const orchestrator = fs.readFileSync(path.join(process.cwd(), 'src/lib/scraping/services/scraping-orchestrator.ts'), 'utf8');

  it('the child receives a soft deadline derived from perStoreTimeoutMs, not a separate literal', () => {
    expect(parent).toContain('WORKER_PRICE_UPDATE_SOFT_DEADLINE_MS: String(Math.max(30_000, perStoreTimeoutMs - PER_STORE_SOFT_DEADLINE_MARGIN_MS))');
  });

  it('the loop defers (never errors) the untouched remainder when the deadline passes', () => {
    const idx = orchestrator.indexOf('budget self-deadline reached');
    expect(idx).toBeGreaterThan(0);
    const block = orchestrator.slice(Math.max(0, idx - 600), idx + 400);
    expect(block).toContain('stages.deferred += remaining;');
    expect(block).not.toContain('errors++');
  });

  it('is inert when the env var is absent, so no other caller changes behaviour', () => {
    expect(orchestrator).toContain("parseInt(process.env.WORKER_PRICE_UPDATE_SOFT_DEADLINE_MS || '0', 10)");
    expect(orchestrator).toContain('softDeadlineMs > 0 && Date.now() - startTime >= softDeadlineMs');
  });
});
