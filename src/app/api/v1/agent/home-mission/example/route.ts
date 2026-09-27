import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { exampleMission } from '@/lib/agent/home-mission-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Generated only on demand. Single-flight + five-minute TTL, like the engine's
// category cache. No stale fallback: an unavailable example is visibly unavailable.
let cached: { body: unknown; expires: number } | null = null;
let pending: Promise<unknown> | null = null;
export async function GET() {
  try {
    if (!cached || cached.expires <= Date.now()) {
      if (!pending) pending = (async () => {
        const response = await POST(new NextRequest('http://localhost/api/v1/agent/home-mission', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mission: exampleMission() }),
        }));
        if (!response.ok) throw new Error('Example unavailable');
        const plan = await response.json();
        const body = { ...plan, generated_at: new Date().toISOString() };
        cached = { body, expires: Date.now() + 5 * 60_000 };
        return body;
      })().finally(() => { pending = null; });
      await pending;
    }
    return NextResponse.json(cached!.body, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'example_unavailable' }, { status: 503 });
  }
}
