// GET /api/admin/retailer-report/export — CSV export of the AGGREGATED retailer report
// (ADR-216). No personal data: no session_id, no phone/email/token, no raw click rows — only
// the same aggregated counts the on-screen report shows.
import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { getRetailerReport } from '@/lib/admin/retailer-report-queries';
import type { Period } from '@/lib/admin/command-center-queries';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(',') + '\r\n';
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
    const { searchParams } = new URL(request.url);
    const storeId = Number(searchParams.get('storeId'));
    if (!Number.isFinite(storeId)) return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    const period = (searchParams.get('period') || '30d') as Period;
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;
    const historical = searchParams.get('historical') === '1';

    const report = await getRetailerReport(storeId, period, start, end, historical);

    const lines: string[] = [];
    lines.push(csvRow(['Tawveeri Retailer Partnership Report']));
    lines.push(csvRow(['Retailer', report.retailer?.displayName ?? String(storeId)]));
    lines.push(csvRow(['Period start', report.range.start.toISOString()]));
    lines.push(csvRow(['Period end', report.range.end.toISOString()]));
    lines.push(csvRow(['Generated at', report.generatedAt]));
    lines.push(csvRow([]));
    lines.push(csvRow(['Metric', 'Value']));
    lines.push(csvRow(['Qualified visits referred', report.qualifiedSessions]));
    // ADR-286 wording fix: RAW server-recorded /go request count, not proof of customer
    // interaction — "confirmed" retired from this export, matching the on-screen report.
    lines.push(csvRow(['Recorded retailer redirects', report.confirmedRedirects]));
    lines.push(csvRow(['Unique products referred', report.uniqueProducts]));
    lines.push(csvRow(['Known campaign', report.acquisition.withKnownCampaign]));
    lines.push(csvRow(['Unknown campaign', report.acquisition.unknownCampaign]));
    lines.push(csvRow([]));
    lines.push(csvRow(['Top products', 'Redirects']));
    for (const p of report.topProducts) lines.push(csvRow([p.nameEn, p.count]));
    lines.push(csvRow([]));
    lines.push(csvRow(['Top categories', 'Redirects']));
    for (const c of report.topCategories) lines.push(csvRow([c.category, c.count]));
    lines.push(csvRow([]));
    lines.push(csvRow(['Daily trend (Riyadh date)', 'Redirects', 'Qualified sessions']));
    for (const d of report.dailyTrend) lines.push(csvRow([d.date, d.redirects, d.qualifiedSessions]));
    lines.push(csvRow([]));
    lines.push(csvRow(['Known limitations']));
    for (const l of report.limitations) lines.push(csvRow([l]));

    const csv = lines.join('');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tawveeri-retailer-report-${report.retailer?.slug ?? storeId}-${period}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
}
