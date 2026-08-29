// Demand Radar types (ADR-247). One loop:
// DISCOVER → UNDERSTAND → PRIORITIZE → DRAFT → ALERT → FOUNDER DECIDES → TRACK.
// V1 is strictly human-in-the-loop: nothing here can publish externally.

/** A raw public post retrieved from a source. UNTRUSTED EXTERNAL DATA — its text
 *  is never interpolated into system instructions, only passed as data. */
export interface RadarCandidate {
  source: 'x' | 'mock';
  sourcePostId: string;
  sourceUrl: string;
  authorHandle: string | null;
  threadKey: string | null; // conversation id where the source provides one
  text: string;
  lang: string | null;
  postedAt: string | null; // ISO
}

export type KsaRelevance = 'confirmed' | 'likely' | 'unknown' | 'not_relevant';
export type Answerability = 'yes' | 'partial' | 'no' | 'unknown';
export type Tier = 'high' | 'medium' | 'ignore';
export type IntentStrength = 'strong' | 'weak' | 'none';

export type IntentClass =
  | 'recommendation' // وش تنصحون / أبي X
  | 'comparison' // محتار بين / أيهم أفضل
  | 'budget' // تحت 3000 / ميزانيتي
  | 'replacement' // خرب وأبي بديل
  | 'suitability' // يناسب غرفة 4×6 / للجامعة
  | 'price_where' // وين أرخص / كم سعره
  | 'timing' // أشتري الحين ولا أنتظر
  | 'other'
  | 'none';

// Four-axis taxonomy (Radar 2.0 Phase 1, founder decision 2026-08-29). Additive
// to Classification below — computed and logged for measurement (§ funnel
// events), but NOT yet consumed by rank.ts's tier decision. See
// computeOpportunityScore() in rank.ts and PHASE1_TAXONOMY_NOTES there.
export type Domain = 'product' | 'home_mission' | 'housing_partnership' | 'brand_mention' | 'other';
export type BuyingStage =
  | 'problem' | 'research' | 'comparison' | 'decision'
  | 'purchase_imminent' | 'post_purchase' | 'none';
export type IntentType =
  | 'help_request' | 'recommendation' | 'comparison' | 'price_search'
  | 'availability' | 'budget' | 'replacement' | 'gift_purchase' | 'other' | 'none';
export type ExclusionClass =
  | 'contest' | 'joke' | 'ad_seller' | 'post_purchase_story'
  | 'support_complaint' | 'spam' | 'needs_context' | 'none';

export interface Classification {
  category: string | null; // production category key or null
  intentClass: IntentClass;
  intentStrength: IntentStrength;
  ksaRelevance: KsaRelevance;
  isDirectQuestion: boolean;
  budgetSar: number | null;
  confidence: number; // classifier's own confidence in the category+intent call
  via: 'heuristic' | 'llm';
  /** Phase 1 four-axis taxonomy — observational only in Phase 1 (§ above). */
  domain: Domain;
  buyingStage: BuyingStage;
  intentType: IntentType;
  exclusion: ExclusionClass;
}

// ---- Funnel observability (Radar 2.0 Phase 1) ----------------------------
// One event per candidate per stage transition, content-free by construction.
// Never carries post_text / author_handle / source_url / tracking_url / raw
// source_post_id — only `fingerprint` (a one-way HMAC, see heuristics.ts).

export const FUNNEL_STAGES = [
  'fetched',
  'prefilter_rejected',
  'classified',
  'excluded',
  'ranked_ignore',
  'ranked_medium',
  'ranked_high',
  'alert_attempted',
  'alert_accepted',
  'founder_acted',
  'founder_dismissed',
  'expired',
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export interface FunnelEvent {
  fingerprint: string | null; // null only when no post id/text was available to hash
  source: RadarCandidate['source'];
  domain: Domain | null;
  category: string | null;
  stage: FunnelStage;
  /** Small enum context: which prefilter gate, which exclusion class, etc. */
  detail: string | null;
  opportunityScore: number | null;
  answerabilityStatus: Answerability | null;
  queryFamily: string;
  isTest: boolean;
}

export const FOUNDER_OUTCOMES = ['accepted', 'rejected', 'expired_no_review'] as const;
export type FounderOutcome = (typeof FOUNDER_OUTCOMES)[number];

export interface OutcomeRecord {
  fingerprint: string | null;
  tier: Tier;
  domain: Domain | null;
  category: string | null;
  intentType: IntentType | null;
  buyingStage: BuyingStage | null;
  exclusion: ExclusionClass | null;
  opportunityScore: number | null;
  answerabilityStatus: Answerability | null;
  queryFamily: string;
  isTest: boolean;
  founderOutcome: FounderOutcome | null;
}

export interface RankedOpportunity {
  candidate: RadarCandidate;
  classification: Classification;
  answerability: Answerability;
  answerabilityReason: string;
  tier: Tier;
  /** Decomposed, founder-readable Arabic reasons — never a bare magic number. */
  reasons: string[];
  suggestedQuery: string | null;
}

export interface CategoryCapability {
  category: string;
  products: number;
  comparable: number;
  fresh7d: number;
  /** true = radar-active: current Tawveeri can genuinely help in this category. */
  active: boolean;
}

/** Source adapter contract. Exactly one live source in V1 (Source One). */
export interface SourceAdapter {
  readonly source: RadarCandidate['source'];
  /** Returns 'unconfigured' when required credentials are absent — this is an
   *  explicit state, never silently reported as "0 candidates" (§37). */
  poll(cursor: string | null): Promise<
    | { status: 'ok'; candidates: RadarCandidate[]; nextCursor: string | null }
    | { status: 'unconfigured'; detail: string }
    | { status: 'source_unavailable'; detail: string }
  >;
}

export const OPPORTUNITY_STATUSES = [
  'new',
  'ready_for_review',
  'approved',
  'changes_requested',
  'dismissed',
  'replied_manually',
  'expired',
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
