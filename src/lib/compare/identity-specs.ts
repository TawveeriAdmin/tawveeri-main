// src/lib/compare/identity-specs.ts — ADR-388.
// Decision-relevant specifications for the multi-product compare tool, derived from the
// APPROVED structured identity the knowledge layer already holds — the TPS identity key.
// The key is the deterministic parser's output (`brand|type|series|capacity|technology|mode`
// for an air conditioner, scripts/tps-plugins/ac/identity.ts); reading it back is not a
// guess, and an identity sentinel (NO_SERIES / NO_TECH / NO_MODE / NA) is rendered as
// «غير متاح», never as a value. Categories without a documented key contract yield no rows.
//
// Founder finding (2026-09-26): the multi-product table showed category, brand and an
// unknown model and nothing a shopper could actually decide on (BTU, inverter, cooling mode).

export interface IdentitySpecRow {
  key: string;
  label: string;
  /** null = unknown / not stated — the page renders «غير متاح». */
  value: string | null;
}

const SENTINEL = /^(NO_|NA$|UNKNOWN$|N\/A$)/i;
const clean = (v: string | undefined): string | null => (v && !SENTINEL.test(v.trim()) ? v.trim() : null);

const AC_TYPE: Record<string, [string, string]> = {
  split: ['سبليت', 'Split'],
  window: ['شباك', 'Window'],
  portable: ['متنقل', 'Portable'],
  cassette: ['كاسيت', 'Cassette'],
  cabinet: ['دولابي', 'Cabinet'],
  ducted: ['مخفي (دكت)', 'Ducted'],
  evaporative: ['صحراوي', 'Evaporative'],
};
const AC_TECH: Record<string, [string, string]> = {
  inverter: ['انفرتر', 'Inverter'],
  standard: ['عادي (غير انفرتر)', 'Standard (non-inverter)'],
};
const AC_MODE: Record<string, [string, string]> = {
  cool_only: ['بارد فقط', 'Cool only'],
  hot_cold: ['بارد وحار', 'Hot & cold'],
};

function pick(map: Record<string, [string, string]>, raw: string | null, isAr: boolean): string | null {
  if (!raw) return null;
  const pair = map[raw.toLowerCase()];
  return pair ? pair[isAr ? 0 : 1] : raw;
}

/**
 * Rows for one product. `category` accepts both the storefront label (`air_conditioner`)
 * and the TPS short code (`ac`). Returns [] when the key does not follow the category's
 * documented contract — never rows built from a guess.
 */
export function identitySpecRows(
  identityKey: string | null | undefined,
  category: string | null | undefined,
  locale: 'ar' | 'en',
): IdentitySpecRow[] {
  const isAr = locale === 'ar';
  if (!identityKey) return [];
  const parts = identityKey.split('|');
  if (category === 'air_conditioner' || category === 'ac') {
    // brand | ac_type | series_or_platform | capacity_btu | technology | cooling_mode
    if (parts.length !== 6) return [];
    const [, type, series, capacity, tech, mode] = parts;
    const btu = clean(capacity);
    return [
      { key: 'ac_type', label: isAr ? 'النوع' : 'Type', value: pick(AC_TYPE, clean(type), isAr) },
      { key: 'series', label: isAr ? 'السلسلة' : 'Series', value: clean(series) },
      { key: 'capacity_btu', label: isAr ? 'السعة' : 'Capacity', value: btu && /^\d+$/.test(btu) ? (isAr ? `${Number(btu).toLocaleString('en-US')} وحدة (BTU)` : `${Number(btu).toLocaleString('en-US')} BTU`) : btu },
      { key: 'technology', label: isAr ? 'التقنية' : 'Technology', value: pick(AC_TECH, clean(tech), isAr) },
      { key: 'cooling_mode', label: isAr ? 'التشغيل' : 'Operation', value: pick(AC_MODE, clean(mode), isAr) },
    ];
  }
  return [];
}

/**
 * Merge identity rows across products into one table: the union of row keys (in first-seen
 * order), each product's value or null. A row is dropped when EVERY product is unknown for
 * it — a table full of «غير متاح» helps nobody (founder review 2026-09-26).
 */
export function mergeIdentitySpecTable(
  perProduct: IdentitySpecRow[][],
): Array<{ key: string; label: string; values: (string | null)[]; differs: boolean }> {
  const order: string[] = [];
  const labels = new Map<string, string>();
  for (const rows of perProduct) for (const r of rows) { if (!labels.has(r.key)) { labels.set(r.key, r.label); order.push(r.key); } }
  return order
    .map((key) => {
      const values = perProduct.map((rows) => rows.find((r) => r.key === key)?.value ?? null);
      const known = values.filter((v): v is string => v !== null);
      return { key, label: labels.get(key)!, values, differs: known.length === values.length && new Set(known).size > 1 };
    })
    .filter((row) => row.values.some((v) => v !== null));
}
