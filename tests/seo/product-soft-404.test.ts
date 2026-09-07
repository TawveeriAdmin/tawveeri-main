/**
 * Operational alert closure (2026-09-07): re-verifies the soft-404 fix on the product detail
 * route. Root cause (documented in `(product)/layout.tsx`): a `loading.tsx` Suspense boundary
 * flushes HTTP 200 before a later `notFound()` can change the status. The fix was moving
 * `products/[slug]` into its own route group with no `loading.tsx` — this test pins that
 * structural invariant so it can never be silently reintroduced.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const productGroupDir = join(root, 'src/app/[locale]/(product)');

describe('product detail soft-404 fix (regression guard)', () => {
  it('the (product) route group has no loading.tsx (reintroducing one brings the soft-404 back)', () => {
    expect(existsSync(join(productGroupDir, 'loading.tsx'))).toBe(false);
  });

  it('the layout explains why, so a future change cannot remove the file without seeing the warning', () => {
    const layoutSrc = readFileSync(join(productGroupDir, 'layout.tsx'), 'utf8');
    expect(layoutSrc).toMatch(/Do not add a `loading\.tsx`/);
    expect(layoutSrc).toMatch(/soft 404/i);
  });

  it('the page only 404s on a genuine null lookup, never on a failed/undefined one', () => {
    const pageSrc = readFileSync(
      join(productGroupDir, 'products/[slug]/page.tsx'),
      'utf8',
    );
    expect(pageSrc).toMatch(/if \(product === null\) notFound\(\);/);
    expect(pageSrc).not.toMatch(/if \(!product\) notFound\(\);/);
  });
});
