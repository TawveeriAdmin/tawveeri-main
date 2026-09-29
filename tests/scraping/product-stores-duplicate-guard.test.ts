/**
 * F-012 — duplicate (product_id, store_id) pairs in `product_stores`.
 *
 * MEASURED ON PRODUCTION, 2026-09-29 (read-only):
 *   32,120 rows for 20,054 distinct (product_id, store_id) pairs — 12,066 surplus rows,
 *   37.6% of the table. By store: jarir 37 groups / 6,120 surplus, amazon 356 / 5,616,
 *   extra 5 / 320, noon 1 / 10.
 *
 * ROOT CAUSE, also measured the same day — the table's only pair-ish unique index is
 *   product_stores_product_store_unique ON product_stores (product_id, store_name)
 * i.e. keyed on the TEXT NAME, not on the canonical `stores.id`. That is a direct
 * ADR-004 violation ("canonical store identity is stores.id"; the slug/display-name/
 * ingested-label spellings disagree). The same store genuinely writes under more than one
 * spelling — `scraping_runs` for store_id=2 carries both 'amazon' and 'أمازون' — and
 * (product_id,'amazon') never conflicts with (product_id,'أمازون'), so each spelling is
 * free to create another row. `store_name` is also nullable, and in Postgres NULLs never
 * conflict at all.
 *
 * WHAT IS AND IS NOT FIXED HERE:
 *   - NEW duplicate creation on the live path was already closed on 2026-09-20 (see
 *     product-service.ts's own comment): the lookup selects ALL rows for the pair, orders
 *     deterministically and updates the first, instead of `.maybeSingle()` throwing on 2+
 *     matches and the error being swallowed so every re-scrape inserted yet another row.
 *     This file PINS that behaviour so it cannot silently regress — that regression is
 *     precisely what produced 12,066 rows.
 *   - Replacing the index with the correct (product_id, store_id) one CANNOT be done
 *     while 12,066 violating rows exist; that is a data migration (merging/deleting real
 *     offer rows with price history attached), which the current mandate explicitly
 *     forbids without founder approval. Documented, not attempted.
 */
import fs from 'node:fs';
import path from 'node:path';

// Normalized so these assertions are about CODE, not about whether the checkout happens
// to carry CRLF (core.autocrlf=true on Windows) or LF.
const src = fs
  .readFileSync(path.join(process.cwd(), 'src/lib/scraping/services/product-service.ts'), 'utf8')
  .split('\r\n')
  .join('\n');
/** collapse runs of whitespace so a match does not depend on indentation */
const flat = src.replace(/\s+/g, ' ');

describe('F-012 · product_stores duplicate-pair prevention must not regress', () => {
  it('the live path looks the pair up by store_id, never by store_name', () => {
    const lookup = src.indexOf(".select('id, current_price, price_pending_value')");
    expect(lookup).toBeGreaterThan(0);
    const block = src.slice(lookup, lookup + 500);
    expect(block).toContain(".eq('product_id', productId)");
    expect(block).toContain(".eq('store_id', storeId)");
    expect(block).not.toContain("store_name");
  });

  it('it selects ALL matching rows and picks deterministically — never .maybeSingle()', () => {
    // .maybeSingle() throws on 2+ matches; that throw was swallowed, the pair read as
    // "not found", and a fresh duplicate row was inserted on every single re-scrape.
    const lookup = src.indexOf(".select('id, current_price, price_pending_value')");
    const block = src.slice(lookup, lookup + 600);
    expect(block).not.toContain('.maybeSingle()');
    expect(block).toContain('.order(');
    expect(src).toContain('const existing = existingRows?.[0] ?? null;');
  });

  it('the deterministic ordering is stable (last_seen_at then updated_at, newest first)', () => {
    const lookup = src.indexOf(".select('id, current_price, price_pending_value')");
    const block = src.slice(lookup, lookup + 600);
    expect(block).toContain("order('last_seen_at', { ascending: false, nullsFirst: false })");
    expect(block).toContain("order('updated_at', { ascending: false, nullsFirst: false })");
  });

  it('an existing pair is UPDATED by its own row id, never re-inserted', () => {
    const upd = flat.indexOf(".from('product_stores') .update(updateData)");
    expect(upd).toBeGreaterThan(0);
    expect(flat.slice(upd, upd + 200)).toContain(".eq('id', existing.id)");
  });

  it('documents that the DB index is keyed on store_name, so the code cannot rely on it', () => {
    // If someone "cleans up" this comment they must also deal with the index reality.
    expect(src).toContain('unique index on product_stores is (product_id, store_name)');
  });
});
