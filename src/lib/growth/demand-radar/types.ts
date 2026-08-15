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

export interface Classification {
  category: string | null; // production category key or null
  intentClass: IntentClass;
  intentStrength: IntentStrength;
  ksaRelevance: KsaRelevance;
  isDirectQuestion: boolean;
  budgetSar: number | null;
  confidence: number; // classifier's own confidence in the category+intent call
  via: 'heuristic' | 'llm';
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
