// tests/search/search-route-dedup-order.test.ts — ADR-388 source contract.
// ADR-387 added `mergeSameListingCards` INSIDE `mergeVerifiedCanonicalSearchResults`, which
// the search route runs BEFORE the TPS canonical injection (`searchTPSCanonical` →
// `products = [...tpsProducts, ...products]`). The identity-bearing card the storefront and
// ghost cards must fold into therefore was not in the array yet, and «مكيف سامسونج 18000»
// kept returning three cards live (2026-09-26). ADR-387's "one merged card" proof was taken
// on a differently phrased query that only ever had one card. The fix is a second pass on
// the FINAL array, after `deduplicateProducts`. This test pins that ordering in the source.
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/search/route.ts'), 'utf8');

describe('search route — same-listing merge runs after TPS injection', () => {
  it('imports mergeSameListingCards', () => {
    expect(src).toMatch(/import \{[^}]*mergeSameListingCards[^}]*\} from '@\/lib\/catalog\/merge-verified-canonical-search-results'/);
  });

  it('the final mergeSameListingCards(products) call comes after the TPS spread and after deduplicateProducts', () => {
    const injection = src.indexOf('products = [...tpsProducts, ...products]');
    const dedupe = src.indexOf('products = deduplicateProducts(products);');
    const merge = src.lastIndexOf('products = mergeSameListingCards(products);');
    expect(injection).toBeGreaterThan(0);
    expect(dedupe).toBeGreaterThan(injection);
    expect(merge).toBeGreaterThan(dedupe);
  });

  it('ADR-389: identity-less memory canonicals get their storefront listing URL attached after injection and before the final merge', () => {
    const injection = src.indexOf('products = [...tpsProducts, ...products]');
    const attach = src.indexOf('products = attachStorefrontListingUrls(products');
    const merge = src.lastIndexOf('products = mergeSameListingCards(products);');
    expect(attach).toBeGreaterThan(injection);
    expect(merge).toBeGreaterThan(attach);
    expect(src).toContain(".select('id, name_ar, product_stores(store_id, product_url)')");
  });

  it('the merge still happens before pagination/slicing of the response', () => {
    const merge = src.lastIndexOf('products = mergeSameListingCards(products);');
    const paginate = src.indexOf('.slice(', merge);
    expect(paginate).toBeGreaterThan(merge);
  });
});
