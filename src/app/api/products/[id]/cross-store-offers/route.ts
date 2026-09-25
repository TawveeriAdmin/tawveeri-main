import { NextResponse } from 'next/server';
import { getCrossCanonicalOffers } from '@/lib/catalog/get-cross-canonical-offers';

/**
 * GET /api/products/[id]/cross-store-offers?exclude=2,4,5
 *
 * Server-side only (uses the service-role client to read `storefront_identity_links`,
 * an internal provenance table) — see get-cross-canonical-offers.ts for the full
 * rationale. `exclude` is the comma-separated list of store ids already shown on the
 * current product's own page, so a store is never duplicated.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const exclude = new Set(
    (searchParams.get('exclude') || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
  );

  try {
    const offers = await getCrossCanonicalOffers(id, exclude);
    return NextResponse.json({ offers });
  } catch (error) {
    console.error('cross-store-offers error:', error);
    // Fail closed to an empty list — never breaks the product page over this optional enrichment.
    return NextResponse.json({ offers: [] });
  }
}
