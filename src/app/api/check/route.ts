import { NextRequest, NextResponse } from 'next/server';
import { checkProduct } from '@/lib/check/check-product';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 4096) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }); }
  if (typeof body?.url !== 'string') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  try {
    return NextResponse.json(await checkProduct(body.url, body.locale === 'en' ? 'en' : 'ar'), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
