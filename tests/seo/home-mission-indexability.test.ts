/**
 * ADR-301 (2026-09-07): Home Mission promoted from the ADR-249 pilot gate (noindex, nofollow,
 * unlisted) to a public, indexable strategic capability. Pins the new state and guards the
 * two other intentional noindex mechanisms this change must never touch: the compare/[key]
 * "nothing to compare" gate, and the non-canonical-host guard.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateMetadata } from '@/app/[locale]/home-mission/page';

const root = process.cwd();

describe('Home Mission — promoted to public indexable (ADR-301)', () => {
  it('Arabic page is index, follow', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it('English page is index, follow', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it('self-canonicalises per locale (no cross-locale canonical mistake)', async () => {
    const ar = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
    const en = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(ar.alternates?.canonical).toBe('https://tawveeri.com/ar/home-mission');
    expect(en.alternates?.canonical).toBe('https://tawveeri.com/en/home-mission');
  });

  it('reciprocal hreflang (ar/en/x-default) is correct in both directions', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs.ar).toBe('https://tawveeri.com/ar/home-mission');
    expect(langs.en).toBe('https://tawveeri.com/en/home-mission');
    expect(langs['x-default']).toBe('https://tawveeri.com/ar/home-mission');
  });

  it('sitemap advertises both locale URLs through the existing static-page architecture', () => {
    const sitemapSrc = readFileSync(join(root, 'src/app/sitemap.ts'), 'utf8');
    expect(sitemapSrc).toMatch(/['"]\/home-mission['"]/);
  });

  it('footer carries an always-server-rendered link (the homepage entry card is client-only/dismiss-gated, ADR-257, and never appears in the initial HTML)', () => {
    const footerSrc = readFileSync(join(root, 'src/components/layout/footer.tsx'), 'utf8');
    expect(footerSrc).toMatch(/\/\$\{locale\}\/home-mission/);
  });
});

describe('Home Mission promotion did not touch other intentional noindex surfaces (regression guard)', () => {
  it('compare/[key] still noindexes when there is nothing to compare', () => {
    const compareSrc = readFileSync(
      join(root, 'src/app/[locale]/(public)/compare/[key]/page.tsx'),
      'utf8',
    );
    expect(compareSrc).toMatch(/robots:\s*{\s*index:\s*false,\s*follow:\s*true\s*}/);
  });

  it('the non-canonical-host guard still emits noindex, follow', () => {
    const canonicalHostSrc = readFileSync(join(root, 'src/lib/seo/canonical-host.ts'), 'utf8');
    expect(canonicalHostSrc).toMatch(/NON_CANONICAL_ROBOTS_TAG\s*=\s*'noindex, follow'/);
  });

  it('robots.txt disallow rules are untouched (no new blanket disallow introduced)', () => {
    const robotsSrc = readFileSync(join(root, 'src/app/robots.ts'), 'utf8');
    expect(robotsSrc).not.toMatch(/home-mission/);
  });
});
