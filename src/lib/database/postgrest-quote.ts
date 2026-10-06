// src/lib/database/postgrest-quote.ts
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Quote a free-text value for a PostgREST filter list / logic tree: `or=(name_ar.eq."…",name_ar.eq."…")`.
//
// WHY (measured 2026-10-06): `.in('name_ar', titles)` wraps a value in double quotes only when it contains `,` `(` or `)`, and never escapes a double quote inside it.
// A product title such as `HP Elitebook 14" FHD` (348 of 1,000 laptop titles carry a `"`) therefore corrupts the whole list and PostgREST silently answers with
// nothing for the neighbouring values: a 16-title chunk returned 0 rows where one-by-one lookups returned 2. No error, no signal — the exact PostgREST silent-failure
// class CLAUDE.md warns about. Quoting each value ourselves, with `\` and `"` escaped, makes the filter exact for any title.
// Use it with `.or(values.map((v) => `col.eq.${postgrestQuote(v)}`).join(','))` for free-text columns; ids and slugs never need it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export function postgrestQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
