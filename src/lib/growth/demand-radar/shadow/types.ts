// Radar 2.0 Phase 2 — Shadow module types (Checkpoint 1). Deliberately
// isolated from the parent module's write-path files; only TYPES are
// imported from '../types' (compile-time only, not a write-path reference —
// the static isolation test checks for table-name string references, not
// type imports).
import type { RadarCandidate, Domain, Tier, Answerability, IntentType, BuyingStage, ExclusionClass } from '../types';

export type { RadarCandidate, Domain, Tier, Answerability, IntentType, BuyingStage, ExclusionClass };

/** Shadow Sample Review labels (Checkpoint 3) — deliberately a DIFFERENT
 *  vocabulary from Phase 1's FounderOutcome ('accepted'/'rejected'/
 *  'expired_no_review'), so the two are never confused in code or in data. */
export const SHADOW_REVIEW_LABELS = [
  'valuable',
  'not_a_lead',
  'exclusion_noise',
  'cannot_answer',
  'draft_quality_issue',
] as const;
export type ShadowReviewLabel = (typeof SHADOW_REVIEW_LABELS)[number];

export const SHADOW_FUNNEL_STAGES = ['fetched', 'replay_checked'] as const;
export type ShadowFunnelStage = (typeof SHADOW_FUNNEL_STAGES)[number];

export interface ShadowFunnelEvent {
  fingerprint: string | null;
  source: RadarCandidate['source'];
  domain: Domain | null;
  category: string | null;
  stage: ShadowFunnelStage;
  detail: string | null;
  opportunityScore: number | null;
  answerabilityStatus: Answerability | null;
  queryFamily: string;
  isTest: boolean;
}

export interface ShadowOutcomeRecord {
  fingerprint: string | null;
  tier: Tier | null;
  domain: Domain | null;
  category: string | null;
  intentType: IntentType | null;
  buyingStage: BuyingStage | null;
  exclusion: ExclusionClass | null;
  opportunityScore: number | null;
  answerabilityStatus: Answerability | null;
  queryFamily: string;
  isTest: boolean;
  retrievedByRadar1: boolean | null;
  shadowReviewLabel: ShadowReviewLabel | null;
}

/** The one content-bearing Shadow table (§T's 72h temporary lifecycle). */
export interface ShadowReviewQueueRow {
  fingerprint: string;
  source: RadarCandidate['source'];
  sourcePostId: string;
  sourceUrl: string;
  authorHandle: string | null;
  postText: string;
  postLang: string | null;
  sourcePostedAt: string | null;
  category: string | null;
  domain: Domain | null;
  retrievedByRadar1: boolean | null;
  queryFamily: string;
  isTest: boolean;
}

export const CONTROL_PARITY_QUERY_FAMILY = 'CONTROL_PARITY_V1';
/** §T: bounded lifecycle for the one content-bearing Shadow table. */
export const SHADOW_REVIEW_QUEUE_RETENTION_HOURS = 72;
