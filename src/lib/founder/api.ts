// src/lib/founder/api.ts — one admin-gated wrapper for every /api/admin/founder/* route.
import { NextResponse, type NextRequest } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { LedgerValidationError } from './ledger';
import { windowFor, type MetricWindow, type WindowKind } from './windows';

export type AdminProfile = Awaited<ReturnType<typeof requireRequestAdmin>>;

export function withAdmin(handler: (req: NextRequest, admin: AdminProfile, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const admin = await requireRequestAdmin(req);
      return await handler(req, admin, ctx);
    } catch (error) {
      if (error instanceof LedgerValidationError) return NextResponse.json({ error: 'validation', fieldErrors: error.fieldErrors }, { status: 400 });
      if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error instanceof Error && error.message === 'not found') return NextResponse.json({ error: 'not found' }, { status: 404 });
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
  };
}

const KINDS: WindowKind[] = ['day', '7d', '30d', 'month', 'custom'];

/** Shared query-string → window resolver for pages and routes: ?w=7d | ?w=custom&start=&end= */
export function windowFromSearchParams(sp: { w?: string; start?: string; end?: string }, now = new Date()): MetricWindow {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (sp.start && sp.end && dateRe.test(sp.start) && dateRe.test(sp.end) && sp.start <= sp.end) return windowFor('custom', now, { start: sp.start, end: sp.end });
  const kind = KINDS.includes((sp.w ?? '') as WindowKind) && sp.w !== 'custom' ? (sp.w as WindowKind) : 'month';
  return windowFor(kind, now);
}
