// tests/tps/spec-category-isolation.test.ts
// Samsung KSA Phase 0 hardening (2026-09-13, ADR-356) — the proven regression: a dishwasher's
// own spec table ("Size 24\"", generic control/display labels) satisfied the monitor plugin's
// weak inch+cue fallback via `adaptRow`'s shared `nameEn`, producing a spurious `monitor`
// identity for a dishwasher. Root cause: `adaptRow` put spec-table text into the ONE `nameEn`
// value every category plugin's `detect()` shares. The architectural fix is generic (not
// Samsung-specific): `adaptRow` never touches `specifications` at all — the invariant this
// suite proves holds for ANY category, not just the one pair that was caught live.
import { adaptRow } from '../../scripts/tps-core/progressive-engine';
import { CATEGORY_DEFS } from '../../scripts/tps-core/category-registry';

/** A representative real-shaped spec table for each category — deliberately including at
 *  least one label/value combination that could plausibly trip an unrelated category's weak
 *  fallback (a bare size, a bare Hz/inch-shaped figure) if it ever leaked. */
const SPEC_FIXTURES: Record<string, Record<string, string>> = {
  air_conditioner: { 'Cooling Capacity': '18000 BTU/h', 'Type': 'Split', 'Size': '24 inch' },
  refrigerator: { 'Net Total (Liter)': '264 ℓ', 'Type': 'Bottom Mount', 'Size': '32 inch' },
  washing_machine: { 'Capacity (kg)': '9', 'Type': 'Front Load', 'Size': '27 inch' },
  dishwasher: { 'Capacity (Place Setting)': '14 P/S', 'Size': '24"', 'Control Type': 'Hidden touch' },
  tv: { 'Screen Size': '65 inch', 'Resolution': '3,840 x 2,160', 'Refresh Rate': '60 Hz' },
  monitor: { 'Resolution': '3,840 x 2,160', 'Refresh Rate': '144 Hz', 'Panel Type': 'VA' },
  mobile: { 'Storage (GB)': '256', 'Memory (GB)': '8', 'Screen Size (Class)': '6.7 inch' },
  tablet: { 'Storage (GB)': '128', 'Screen Size (Class)': '10.9 inch', 'Connectivity': 'Wi-Fi' },
  smartwatch: { 'Case Size (mm)': '44', 'Connectivity': 'GPS', 'Battery Capacity (mAh)': '425' },
  audio: { 'Output Power (W)': '160', 'Connectivity': 'Bluetooth', 'Type': 'Party Speaker' },
  microwave: { 'Capacity (L)': '23', 'Type': 'Solo', 'Control Type': 'Dial' },
  vacuum: { 'Suction Power (W)': '250', 'Type': 'Stick', 'Battery Type': 'Digital Inverter Motor' },
};

/** Only the base title text (no category-identifying words) — the plugin under test must
 *  decide detect() from THIS ALONE; if a foreign category's spec fixture ever changed the
 *  detect() outcome, the leak would show up here. */
const GENERIC_TITLE = 'Samsung Product Model XYZ123';

describe('ADR-356 — adaptRow never leaks spec-table text across categories (regression matrix)', () => {
  it('adaptRow.nameEn is ALWAYS title-only, regardless of which category the specifications belong to', () => {
    for (const [category, specs] of Object.entries(SPEC_FIXTURES)) {
      const payload = { name_en: GENERIC_TITLE, specifications: { raw: specs } };
      const { nameEn } = adaptRow(payload, null);
      expect(nameEn).toBe(GENERIC_TITLE);
      // Sanity: the fixture's own values are genuinely present in the payload (so a failure
      // here would prove a real leak, not an empty fixture).
      expect(Object.keys(specs).length).toBeGreaterThan(0);
      void category;
    }
  });

  it('the proven live case: dishwasher spec text does not make ANY foreign category detect() accept the row', () => {
    const payload = { name_en: 'DW8700B Freestanding Dishwasher 14 Place Settings Silver (DW60BG830FSLYL)', specifications: { raw: SPEC_FIXTURES.dishwasher } };
    const { nameAr, nameEn, brand } = adaptRow(payload, null);
    const hits: string[] = [];
    for (const def of Object.values(CATEGORY_DEFS)) {
      if (def.plugin.detect(nameAr, nameEn)) hits.push(def.category);
    }
    expect(hits).toEqual(['dishwasher']);
    void brand;
  });

  it('a store that never populates specifications.raw sees byte-identical adaptRow output (no-op guarantee)', () => {
    const withoutSpecs = adaptRow({ name_en: GENERIC_TITLE }, null);
    const withEmptySpecs = adaptRow({ name_en: GENERIC_TITLE, specifications: {} }, null);
    expect(withoutSpecs).toEqual(withEmptySpecs);
    expect(withoutSpecs.nameEn).toBe(GENERIC_TITLE);
  });
});
