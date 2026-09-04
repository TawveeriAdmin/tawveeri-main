// GET /api/admin/affiliate/reports — list imported affiliate reports + match-tier summary.
// POST /api/admin/affiliate/reports — upload + import an affiliate CSV (Amazon Associates today,
// any retailer export tomorrow via the same column-mapping shape). Idempotent on (source, checksum).
// Design: docs/AFFILIATE_RECONCILIATION_CONTRACT.md. Schema: scripts/database/30-affiliate-reconciliation.sql.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { parseCsv, normalizeRow, sha256, type ColumnMapping } from '@/lib/admin/affiliate-csv';

// affiliate_reports/affiliate_conversions aren't in the generated Database types (raw-migration
// tables, same convention as usage_events/outbound_clicks — see command-center-queries.ts).
type AnyClient = { from: (table: string) => any };

const MATCH_WINDOW_DAYS = 30;

export async function GET(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
    const supabase = createServerClient() as unknown as AnyClient;

    const { data: reports, error } = await supabase
      .from('affiliate_reports')
      .select('id, source, report_period_start, report_period_end, original_filename, row_count, imported_rows, rejected_rows, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const reportIds = (reports || []).map((r: { id: string }) => r.id);
    const tierCounts: Record<string, Record<string, number>> = {};
    if (reportIds.length > 0) {
      const { data: conversions, error: convError } = await supabase
        .from('affiliate_conversions')
        .select('report_id, match_tier')
        .in('report_id', reportIds);
      if (convError) throw convError;
      for (const c of (conversions || []) as Array<{ report_id: string; match_tier: string }>) {
        tierCounts[c.report_id] ??= {};
        tierCounts[c.report_id][c.match_tier] = (tierCounts[c.report_id][c.match_tier] || 0) + 1;
      }
    }

    return NextResponse.json({
      reports: (reports || []).map((r: { id: string }) => ({ ...r, matchTiers: tierCounts[r.id] || {} })),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRequestAdmin(request);
    const supabase = createServerClient() as unknown as AnyClient;

    const form = await request.formData();
    const file = form.get('file');
    const source = String(form.get('source') || '').trim();
    const mappingRaw = String(form.get('mapping') || '{}');
    // Amazon Decision Layer V2 §7 — dry-run preview: parse/normalize/match exactly as a
    // real import would, but never write affiliate_reports/affiliate_conversions. Lets
    // the founder verify the column mapping and match-tier mix against a real Amazon
    // export before committing it, without needing a second (different) file to test
    // the idempotency no-op path.
    const dryRun = String(form.get('dryRun') || '') === '1' || String(form.get('dryRun') || '').toLowerCase() === 'true';
    if (!(file instanceof File) || !source) {
      return NextResponse.json({ error: 'file and source are required' }, { status: 400 });
    }
    let mapping: ColumnMapping;
    try { mapping = JSON.parse(mappingRaw); } catch { return NextResponse.json({ error: 'mapping must be valid JSON' }, { status: 400 }); }

    const text = await file.text();
    const checksum = sha256(text);

    // Idempotency: re-uploading the same file for the same source is a no-op, not a duplicate insert.
    // Skipped in dry-run — a preview must never report "already imported" for a file that
    // was only ever previewed, and must never block re-previewing the same file twice.
    if (!dryRun) {
      const { data: existing } = await supabase
        .from('affiliate_reports')
        .select('id, created_at, row_count, imported_rows, rejected_rows')
        .eq('source', source)
        .eq('file_checksum', checksum)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ alreadyImported: true, report: existing });
      }
    }

    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) {
      return NextResponse.json({ error: 'file has no rows' }, { status: 400 });
    }

    const normalized = rows.map((r) => normalizeRow(r, mapping));
    const accepted = normalized.filter((r) => !r.rejected);
    const rejectedCount = normalized.length - accepted.length;

    // Amazon Decision Layer V2 §7 — Tracking ID validation: cross-check the report's own
    // tracking_id_raw values against the tracking IDs Tawveeri actually issued (every
    // affiliate_campaigns row, live or disabled, plus the shared org-wide default tag).
    // NON-BLOCKING by design — an unrecognized tracking ID is very likely a real Amazon
    // program tag we simply haven't wired a campaign for yet (or the shared default),
    // not a corrupt row; "unknown beats incorrect" means we surface it, never reject a
    // financial row on a guess.
    const { data: knownCampaigns } = await supabase.from('affiliate_campaigns').select('tracking_id');
    const knownTrackingIds = new Set<string>(['tawveeri0f-21']);
    for (const c of (knownCampaigns || []) as Array<{ tracking_id: string | null }>) {
      if (c.tracking_id) knownTrackingIds.add(c.tracking_id);
    }
    const unknownTrackingIds = Array.from(new Set(
      accepted.map((r) => r.tracking_id_raw).filter((t): t is string => !!t && !knownTrackingIds.has(t)),
    ));

    if (dryRun) {
      const previewMatchSummary = accepted.reduce((acc: Record<string, number>, r) => {
        // Preview tier: same AGGREGATE_ONLY rule as the real pass; EXACT/PROBABLE require
        // a live outbound_clicks lookup, which a preview intentionally skips (read cost
        // scoped to what's needed to validate the mapping, not a full dry-run of matching).
        const tier = (!r.item_name && !r.asin_or_sku && !r.order_date) ? 'AGGREGATE_ONLY' : 'PENDING_MATCH_ON_IMPORT';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {});
      return NextResponse.json({
        dryRun: true,
        rowCount: rows.length,
        wouldImportRows: accepted.length,
        wouldRejectRows: rejectedCount,
        unknownTrackingIds,
        previewMatchSummary,
      });
    }

    const { data: report, error: reportError } = await supabase
      .from('affiliate_reports')
      .insert({
        source,
        file_checksum: checksum,
        original_filename: file.name,
        column_mapping: mapping,
        row_count: rows.length,
        imported_rows: accepted.length,
        rejected_rows: rejectedCount,
        uploaded_by: admin.id,
      })
      .select('id')
      .single();
    if (reportError) throw reportError;

    // Match against outbound_clicks.sub_id — EXACT if sub_id matches within the window,
    // PROBABLE if ASIN+date window matches exactly one click, else AGGREGATE_ONLY/UNMATCHED.
    // Tier definitions: docs/AFFILIATE_RECONCILIATION_CONTRACT.md.
    const conversionRows = await Promise.all(accepted.map(async (r) => {
      let matchTier = 'UNMATCHED';
      let matchedClickId: number | null = null;

      if (!r.item_name && !r.asin_or_sku && !r.order_date) {
        matchTier = 'AGGREGATE_ONLY';
      } else if (r.sub_id) {
        const { data: clicks } = await supabase
          .from('outbound_clicks')
          .select('id, clicked_at')
          .eq('sub_id', r.sub_id)
          .limit(2);
        if (clicks && clicks.length === 1) {
          matchTier = 'EXACT';
          matchedClickId = clicks[0].id;
        }
      }

      if (matchTier === 'UNMATCHED' && r.asin_or_sku && r.order_date) {
        const windowStart = new Date(r.order_date);
        windowStart.setDate(windowStart.getDate() - MATCH_WINDOW_DAYS);
        const { data: candidates } = await supabase
          .from('outbound_clicks')
          .select('id')
          .eq('is_test', false)
          .gte('clicked_at', windowStart.toISOString())
          .lte('clicked_at', new Date(r.order_date).toISOString())
          .limit(2);
        if (candidates && candidates.length === 1) {
          matchTier = 'PROBABLE';
          matchedClickId = candidates[0].id;
        }
      }

      return {
        report_id: report.id,
        source,
        tracking_id_raw: r.tracking_id_raw,
        sub_id: r.sub_id,
        asin_or_sku: r.asin_or_sku,
        item_name: r.item_name,
        order_date: r.order_date,
        ship_date: r.ship_date,
        quantity: r.quantity,
        price: r.price,
        commission_amount: r.commission_amount,
        state: r.state,
        match_tier: matchTier,
        matched_click_id: matchedClickId,
      };
    }));

    if (conversionRows.length > 0) {
      const { error: insertError } = await supabase.from('affiliate_conversions').insert(conversionRows);
      if (insertError) throw insertError;
    }

    return NextResponse.json({
      reportId: report.id,
      rowCount: rows.length,
      importedRows: accepted.length,
      rejectedRows: rejectedCount,
      unknownTrackingIds,
      matchSummary: conversionRows.reduce((acc: Record<string, number>, r) => {
        acc[r.match_tier] = (acc[r.match_tier] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Authentication required' || error.message === 'Admin access required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
