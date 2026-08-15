// مرصد الطلب — founder queries (ADR-247 §22-23). Server-side reads only.
// REAL and TEST are fetched separately and never blended; the radar state row
// makes SOURCE_UNAVAILABLE / UNCONFIGURED visible instead of a silent zero.

import { createServerClient } from '@/lib/database';

export interface OpportunityRow {
  id: string;
  source: string;
  source_url: string;
  author_handle: string | null;
  post_text: string;
  source_posted_at: string | null;
  first_seen_at: string;
  classified_at: string | null;
  alerted_at: string | null;
  category: string | null;
  intent_class: string | null;
  intent_strength: string | null;
  ksa_relevance: string;
  answerability: string;
  tier: string;
  score_reasons: string[];
  suggested_query: string | null;
  suggested_reply: string | null;
  tracking_url: string | null;
  status: string;
  founder_note: string | null;
  is_test: boolean;
}

export interface RadarState {
  source: string;
  last_poll_at: string | null;
  last_poll_status: string | null;
  last_poll_candidates: number | null;
}

export interface CategoryRadarStats {
  category: string;
  candidates: number;
  high: number;
  medium: number;
  approved: number;
  dismissed: number;
  replied: number;
}

export const OPPORTUNITY_STATUS_LABEL_AR: Record<string, string> = {
  new: 'جديدة',
  ready_for_review: 'بانتظار المراجعة',
  approved: 'معتمدة',
  changes_requested: 'مطلوب تعديل',
  dismissed: 'متجاهَلة',
  replied_manually: 'تم الرد يدويًا',
  expired: 'منتهية',
};

export async function fetchRadarSurface(): Promise<{
  open: OpportunityRow[];
  recentClosed: OpportunityRow[];
  states: RadarState[];
  categoryStats: CategoryRadarStats[];
  testCount: number;
}> {
  const sb = createServerClient() as any;
  const [openRes, closedRes, stateRes, allRes, testRes] = await Promise.all([
    sb.from('demand_opportunities')
      .select('*')
      .in('status', ['new', 'ready_for_review', 'approved', 'changes_requested'])
      .order('tier', { ascending: true }) // 'high' < 'ignore' < 'medium' alphabetically — re-sorted below
      .order('created_at', { ascending: false })
      .limit(40),
    sb.from('demand_opportunities')
      .select('*')
      .in('status', ['replied_manually', 'dismissed', 'expired'])
      .order('updated_at', { ascending: false })
      .limit(10),
    sb.from('demand_radar_state').select('source, last_poll_at, last_poll_status, last_poll_candidates'),
    sb.from('demand_opportunities')
      .select('category, tier, status, is_test')
      .eq('is_test', false)
      .limit(5000),
    sb.from('demand_opportunities').select('id', { count: 'exact', head: true }).eq('is_test', true),
  ]);

  const tierOrder = (t: string) => (t === 'high' ? 0 : t === 'medium' ? 1 : 2);
  const open = ((openRes.data ?? []) as OpportunityRow[]).sort(
    (a, b) => tierOrder(a.tier) - tierOrder(b.tier) || (a.first_seen_at < b.first_seen_at ? 1 : -1)
  );

  const stats = new Map<string, CategoryRadarStats>();
  for (const r of (allRes.data ?? []) as Array<{ category: string | null; tier: string; status: string }>) {
    const key = r.category ?? 'غير محدد';
    const s = stats.get(key) ?? { category: key, candidates: 0, high: 0, medium: 0, approved: 0, dismissed: 0, replied: 0 };
    s.candidates++;
    if (r.tier === 'high') s.high++;
    if (r.tier === 'medium') s.medium++;
    if (r.status === 'approved') s.approved++;
    if (r.status === 'dismissed') s.dismissed++;
    if (r.status === 'replied_manually') s.replied++;
    stats.set(key, s);
  }

  return {
    open,
    recentClosed: (closedRes.data ?? []) as OpportunityRow[],
    states: (stateRes.data ?? []) as RadarState[],
    categoryStats: [...stats.values()].sort((a, b) => b.candidates - a.candidates),
    testCount: testRes.count ?? 0,
  };
}
