import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';

const startTime = Date.now();

export async function GET() {
  const requestStart = Date.now();

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from('stores').select('id').limit(1);

    const responseTime = Date.now() - requestStart;

    if (error) {
      return NextResponse.json(
        {
          status: 'degraded',
          uptime: Math.floor((Date.now() - startTime) / 1000),
          timestamp: new Date().toISOString(),
          db: 'disconnected',
          responseTime,
          error: error.message,
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        db: 'connected',
        responseTime,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    const responseTime = Date.now() - requestStart;
    return NextResponse.json(
      {
        status: 'degraded',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        db: 'error',
        responseTime,
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
