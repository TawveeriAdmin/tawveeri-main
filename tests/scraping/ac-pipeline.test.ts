/**
 * E6 — AC bounded pipeline invariants (ADR-022/023).
 * Pure-logic unit tests (no DB): brand canonicalization, AC identity contract,
 * cross-store corroboration, deterministic IDs, and category isolation.
 */
import { createHash } from 'crypto';
import { canonicalizeBrand } from '../../scripts/tps-core/brand-map';
import { acPlugin } from '../../scripts/tps-plugins/ac';

// mirror of the matcher's stableUuid (determinism contract)
function stableUuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16),
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
}

const P = { ac_type: 'split', capacity_btu: 18000, technology: 'Inverter', cooling_mode: 'cool_only', series_or_platform: null as string | null };

describe('AC brand canonicalization (ADR-022 fix)', () => {
  it('maps bilingual AC brands to one canonical form', () => {
    expect(canonicalizeBrand('LG')).toBe('lg');
    expect(canonicalizeBrand('إل جي')).toBe('lg');
    expect(canonicalizeBrand('GREE')).toBe('gree');
    expect(canonicalizeBrand('جري')).toBe('gree');
    expect(canonicalizeBrand('سامسونج')).toBe('samsung');
    expect(canonicalizeBrand('White Westinghouse')).toBe('westinghouse');
    expect(canonicalizeBrand('ويستنج هاوس')).toBe('westinghouse');
  });
  it('unknown brand falls through to lowercase (never guessed)', () => {
    expect(canonicalizeBrand('ZzUnknownBrand')).toBe('zzunknownbrand');
    expect(canonicalizeBrand(null)).toBe('unknown');
  });
});

describe('AC identity contract + cross-store corroboration', () => {
  it('Arabic and English brand yield the SAME identity key (unlocks corroboration)', () => {
    const en = acPlugin.buildIdentityKey('LG', { ...P }, {});
    const ar = acPlugin.buildIdentityKey('إل جي', { ...P }, {});
    expect(en.key).toBe(ar.key);
    expect(en.key).toBe('lg|split|NO_SERIES|18000|Inverter|cool_only');
  });
  it('valid when series is present', () => {
    const r = acPlugin.buildIdentityKey('GREE', { ...P, series_or_platform: 'Pular' }, {});
    expect(r.status).toBe('valid');
    expect(r.key).toBe('gree|split|Pular|18000|Inverter|cool_only');
  });
  it('fallback (NO_SERIES, low_confidence) when series missing', () => {
    const r = acPlugin.buildIdentityKey('GREE', { ...P }, {});
    expect(r.status).toBe('low_confidence_candidate');
    expect(r.key).toContain('NO_SERIES');
  });
  it('invalid when identity-critical fields are missing (never fabricated)', () => {
    expect(acPlugin.buildIdentityKey('GREE', { ac_type: 'split' } as any, {}).status).toBe('invalid');
    expect(acPlugin.buildIdentityKey(null, { ...P }, {}).status).toBe('invalid');
    expect(acPlugin.buildIdentityKey('GREE', { ...P, ac_type: undefined } as any, {}).status).toBe('invalid');
  });
  it('never merges incompatible critical fields (different capacity/cooling ⇒ different key)', () => {
    const a = acPlugin.buildIdentityKey('LG', { ...P, capacity_btu: 18000 }, {}).key;
    const b = acPlugin.buildIdentityKey('LG', { ...P, capacity_btu: 24000 }, {}).key;
    const c = acPlugin.buildIdentityKey('LG', { ...P, cooling_mode: 'hot_cold' }, {}).key;
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('Determinism + category isolation', () => {
  it('stableUuid is deterministic and valid v4-shaped', () => {
    const k = 'canonical:lg|split|NO_SERIES|18000|Inverter|cool_only';
    expect(stableUuid(k)).toBe(stableUuid(k));
    expect(stableUuid(k)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stableUuid('a')).not.toBe(stableUuid('b'));
  });
  it('AC plugin declares its own category (isolation from mobile)', () => {
    expect(acPlugin.category).toBe('ac');
  });
});
