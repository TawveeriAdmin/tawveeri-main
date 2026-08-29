// PATCH /api/admin/growth/opportunities — founder decisions on radar
// opportunities (ADR-247 §22, §29). Approval is INTERNAL — it never publishes
// anywhere. Founder decisions are the evaluation feedback loop.

import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';
import { createServerClient } from '@/lib/database';
import { candidateFingerprint } from '@/lib/growth/demand-radar/heuristics';
import { emitFunnelEvent, recordOutcome, DEFAULT_QUERY_FAMILY } from '@/lib/growth/demand-radar/funnel';
import type { FounderOutcome, Domain } from '@/lib/growth/demand-radar/types';

const OPPORTUNITY_ACTIONS = new Set(['approved', 'changes_requested', 'dismissed', 'replied_manually']);
const MENTION_ACTIONS = new Set(['reviewed', 'replied_manually', 'dismissed']);

// Founder Acceptance Precision mapping (architecture doc §F): approved,
// replied_manually, and changes_requested all mean the founder judged the
// underlying OPPORTUNITY genuine (changes_requested is about draft quality,
// a separate concern) — only dismissed is a rejection. This is instrumentation
// on the EXISTING action semantics below, not a new action or a changed one.
function founderOutcomeFor(action: string): FounderOutcome | null {
  if (action === 'approved' || action === 'replied_manually' || action === 'changes_requested') return 'accepted';
  if (action === 'dismissed') return 'rejected';
  return null; // mention-only actions ('reviewed') never reach this path
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRequestAdmin(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
  let body: { id?: string; action?: string; note?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const isMention = body.kind === 'mention';
  const valid = isMention ? MENTION_ACTIONS : OPPORTUNITY_ACTIONS;
  if (!body.id || !body.action || !valid.has(body.action)) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 });
  }
  const sb = createServerClient() as any;
  const { data, error } = await sb
    .from(isMention ? 'brand_mentions' : 'demand_opportunities')
    .update({
      status: body.action,
      founder_note: body.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    // Phase 1: select the extra columns needed only to write the de-identified
    // funnel event/outcome below — this SELECT addition does not change what
    // is written to demand_opportunities/brand_mentions, only what is read
    // back from the same successful update.
    .select(isMention ? 'id, status' : 'id, status, source, source_post_id, tier, category, opportunity_type, is_test')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Funnel observability (Phase 1) — instruments this EXISTING mutation path
  // only; never blocks or changes the founder-facing response above.
  if (!isMention) {
    try {
      const founderOutcome = founderOutcomeFor(body.action);
      if (founderOutcome) {
        const fp = candidateFingerprint(data.source, data.source_post_id, '');
        const domain: Domain = data.opportunity_type === 'home_mission' ? 'home_mission' : 'product';
        await emitFunnelEvent({
          fingerprint: fp, source: data.source, domain, category: data.category,
          stage: founderOutcome === 'accepted' ? 'founder_acted' : 'founder_dismissed',
          detail: body.action, opportunityScore: null, answerabilityStatus: null,
          queryFamily: DEFAULT_QUERY_FAMILY, isTest: data.is_test,
        });
        await recordOutcome({
          fingerprint: fp, tier: data.tier, domain, category: data.category,
          intentType: null, buyingStage: null, exclusion: null,
          opportunityScore: null, answerabilityStatus: null,
          queryFamily: DEFAULT_QUERY_FAMILY, isTest: data.is_test, founderOutcome,
        });
      }
    } catch {
      /* observability must never break the founder-action response */
    }
  }

  return NextResponse.json({ ok: true, row: data });
}
