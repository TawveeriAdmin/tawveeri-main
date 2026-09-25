// GET /api/admin/founder/export?kind=founder|investor|store&store=<slug>&w=month|7d|30d|day&start=&end=&format=json|csv
import { NextResponse, type NextRequest } from 'next/server';
import { withAdmin, windowFromSearchParams } from '@/lib/founder/api';
import { buildFounderReport, buildInvestorReport, buildStoreReport, reportToCsv } from '@/lib/founder/reports';
import { createAuditLog } from '@/lib/auth/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withAdmin(async (req: NextRequest, admin) => {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind') ?? 'founder';
  const w = windowFromSearchParams({ w: sp.get('w') ?? undefined, start: sp.get('start') ?? undefined, end: sp.get('end') ?? undefined });
  const report = kind === 'investor' ? await buildInvestorReport(w) : kind === 'store' ? await buildStoreReport(w, sp.get('store') ?? '') : await buildFounderReport(w);
  // admin_logs.entity_id is a uuid column — the report kind goes in details, never in entity_id.
  await createAuditLog({ user_id: admin.id, action: 'founder_report_export', entity_type: 'founder_report', entity_id: null, details: { kind, store: sp.get('store') ?? null, window: report.window, format: sp.get('format') ?? 'json' } });
  if ((sp.get('format') ?? 'json') === 'csv') {
    return new NextResponse(reportToCsv(report), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="tawveeri-${kind}-report-${report.window.start.slice(0, 10)}.csv"` } });
  }
  return NextResponse.json(report);
});
