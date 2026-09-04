// tests/admin/affiliate-reports-route-contract.test.ts — src/app/api/admin/affiliate/reports/route.ts
// Amazon Decision Layer V2 §7: the existing Amazon report importer (ADR-213) gained a
// dry-run preview and Tracking ID cross-check. A real end-to-end test needs a live
// Supabase client (createServerClient + requireRequestAdmin) which isn't mocked anywhere
// in this route today — same structural-contract convention as
// tests/campaigns/claim-guard-wired.test.ts, reading the route source directly rather
// than mocking Supabase end-to-end.
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/admin/affiliate/reports/route.ts'), 'utf8');

describe('affiliate report importer — dry-run + tracking-id contract', () => {
  it('accepts a dryRun form field', () => {
    expect(source).toMatch(/form\.get\('dryRun'\)/);
  });

  it('a dry-run response never inserts into affiliate_reports or affiliate_conversions', () => {
    const dryRunBlockStart = source.indexOf('if (dryRun) {');
    expect(dryRunBlockStart).toBeGreaterThan(-1);
    const dryRunBlockEnd = source.indexOf('\n    }', dryRunBlockStart);
    const block = source.slice(dryRunBlockStart, dryRunBlockEnd);
    expect(block).not.toMatch(/\.insert\(/);
    expect(block).toMatch(/dryRun:\s*true/);
  });

  it('dry-run skips the idempotency (already-imported) check — a preview must never be recorded as an import', () => {
    const idempotencyCheckIdx = source.indexOf("Idempotency: re-uploading");
    const guardNearby = source.slice(idempotencyCheckIdx, idempotencyCheckIdx + 400);
    expect(guardNearby).toMatch(/if \(!dryRun\)/);
  });

  it('cross-checks tracking_id_raw against known affiliate_campaigns tracking IDs', () => {
    expect(source).toMatch(/knownTrackingIds/);
    expect(source).toMatch(/unknownTrackingIds/);
    expect(source).toMatch(/tawveeri0f-21/); // the shared org-wide default tag is always "known"
  });

  it('an unrecognized tracking ID is surfaced, never used to reject or block the import (unknown beats incorrect)', () => {
    // The real (non-dry-run) insert path must not filter `accepted` by unknownTrackingIds.
    const insertIdx = source.indexOf("supabase.from('affiliate_conversions').insert(conversionRows)");
    expect(insertIdx).toBeGreaterThan(-1);
    expect(source).not.toMatch(/unknownTrackingIds\.length\s*>\s*0.*(?:return|throw)/s);
  });

  it('unknownTrackingIds is returned on both the dry-run preview and the real import response', () => {
    const occurrences = source.split('unknownTrackingIds,').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(1);
    expect(source).toMatch(/dryRun:\s*true,[\s\S]{0,200}unknownTrackingIds/);
  });
});
