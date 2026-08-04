/**
 * ADR-206 — Arabic mobile filter entry point must stay unmistakable.
 *
 * Production evidence (docs/baselines/2026-08-04-mobile-filter-discoverability/):
 * the only filter doorway on phones was a bare 48×36 icon — the visible label was
 * `hidden sm:inline`, so every viewport under 640px got an unlabelled control.
 * These are source-contract guards: they fail if anyone re-hides the label,
 * drops the accessible name, or removes the active-filter count badge.
 */
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('mobile filter entry (ADR-206)', () => {
  const client = read('src/app/[locale]/(public)/search/search-client.tsx');
  // the trigger button block: from the ref that identifies it to the sheet that follows
  const trigger = client.slice(
    client.indexOf('ref={mobileFiltersTriggerRef}'),
    client.indexOf('<MobileFilterSheet'),
  );

  it('locates the trigger button block', () => {
    expect(trigger.length).toBeGreaterThan(100);
  });

  it('renders a visible text label at every width (never breakpoint-hidden)', () => {
    expect(trigger).toContain("{t('search.mobileFilters')}</span>");
    const labelSpan = trigger.split('\n').find((l) => l.includes("mobileFilters')}</span>"))!;
    expect(labelSpan).not.toMatch(/\bhidden\b/);
    expect(labelSpan).not.toMatch(/\bsr-only\b/);
  });

  it('keeps the accessible name equal to the visible label (2.5.3 label-in-name)', () => {
    expect(trigger).toContain("aria-label={t('search.mobileFilters')}");
    expect(trigger).toContain('aria-expanded={mobileFiltersOpen}');
  });

  it('keeps the active-filter count badge on the trigger', () => {
    expect(trigger).toContain('activeFilterCount > 0');
    expect(trigger).toContain('{activeFilterCount}');
  });

  it('keeps the 44px touch target', () => {
    expect(trigger).toMatch(/className="[^"]*\bh-11\b[^"]*"/);
  });

  it('labels the entry «الفلاتر» in Arabic — the same word as the sheet it opens', () => {
    const ar = JSON.parse(read('messages/ar/search.json'));
    const en = JSON.parse(read('messages/en/search.json'));
    expect(ar.mobileFilters).toBe('الفلاتر');
    expect(en.mobileFilters).toBe('Filters');
    // the sheet title in mobile-filter-sheet.tsx uses the same word
    const sheet = read('src/components/search/mobile-filter-sheet.tsx');
    expect(sheet).toContain('الفلاتر');
  });
});
