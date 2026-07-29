// src/app/api/compare/route.ts
// TPS Comparison API — Layer 4 Entry Point
//
// A thin HTTP wrapper. The derivation itself lives in `src/lib/compare/get-comparison.ts`
// (ADR-135's "one source for the card and the compare page"), so the compare PAGE can
// call it directly instead of fetching this route over the public internet — a round trip
// that was being rate-limited and silently rendering "لا تتوفر مقارنة" for products with
// live offers. See that file's header for the measurement.
//
// This route stays because it is a real public API surface (mobile, integrations).

import { NextRequest, NextResponse } from 'next/server';
import { getComparison, isComparisonError } from '@/lib/compare/get-comparison';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const result = await getComparison({
    canonicalId: searchParams.get('id'),
    identityKey: searchParams.get('key'),
    locale: searchParams.get('locale') === 'en' ? 'en' : 'ar',
  });

  if (isComparisonError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
