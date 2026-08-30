// Founder Intelligence — AI reasoning layer (integrated review, 2026-08-30).
// AI is a REASONING layer over already-computed facts, never a number
// generator (ADR-002's "no LLM in the score/ranking path" precedent,
// extended to this new surface deliberately, not by accident). This file
// never computes a metric — every fact a founder ends up reading was
// computed by opportunities.ts/need-signals.ts/emerging-language.ts BEFORE
// this file ever runs, and is looked up by ID after the AI responds, never
// trusted verbatim from model output. If the model cites a candidate id
// that does not exist in what it was given, that recommendation is
// silently dropped — fail closed, never a fabricated fact shown to the
// founder.
//
// Same containment/fallback discipline as classify.ts (this codebase's own
// established pattern, reused rather than re-invented): fenced untrusted-
// context block is not applicable here (there is no untrusted freeform text
// in the input — every candidate is already-validated, already-evidenced
// structured data), strict JSON schema, timeout+abort, NEVER throws,
// degrades to an empty/unavailable result — the caller (daily-report.ts)
// renders exactly today's deterministic email when this returns
// aiAvailable:false, per ADR-216 Decision 6's still-correct guarantee that
// the email must never depend on an AI call succeeding.

import type { Opportunity } from './opportunities';

const MODEL = process.env.FOUNDER_INTEL_BRIEF_MODEL || 'claude-sonnet-5';
const TIMEOUT_MS = 15000;
const MAX_FOCUS_ITEMS = 3;

export type FocusDomain =
  | 'marketing_content' | 'product_engineering' | 'catalog_coverage'
  | 'commercial' | 'demand_radar' | 'home_mission';

export interface FounderIntelligenceCandidate {
  id: string;
  domain: FocusDomain;
  opportunity: Opportunity;
}

export interface FocusItem {
  candidateId: string;
  /** Looked up from the candidate, never from the model — see module header. */
  titleAr: string;
  evidenceAr: string;
  sampleSize: number;
  earlySignal: boolean;
  domain: FocusDomain;
  /** Model-authored narrative fields ONLY — no fact/number lives here. */
  whyNowAr: string;
  recommendedActionAr: string;
  riskCaveatAr: string;
  whatToMeasureNextAr: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface FounderIntelligenceBriefResult {
  focusItems: FocusItem[];
  aiAvailable: boolean;
  reason?: string;
}

const SYSTEM_PROMPT = `You are a prioritization assistant for the founder of Tawveeri (توفيري), a Saudi price-comparison site. You will be given a JSON list of CANDIDATE opportunities — each already computed deterministically from real production evidence, each with a stable "id".

Your ONLY job: pick at most ${MAX_FOCUS_ITEMS} candidates (0, 1, 2, or 3 — fewer is correct when the evidence is weak; picking zero is a valid and often correct answer) that deserve the founder's attention TODAY, and write a short Arabic explanation for each.

HARD RULES:
- You may ONLY reference a candidate by the exact "id" string given to you. Never invent an id, a number, a sample size, a percentage, or any fact not present in the candidate you were given.
- Do not restate the candidate's evidence in your own words with different numbers — the evidence text is already correct and will be shown verbatim; your job is WHY IT MATTERS and WHAT TO DO, not re-reporting the facts.
- If two candidates describe the same underlying situation, pick only the stronger one.
- A candidate with earlySignal=true is a small sample — say so plainly in confidence, do not inflate it.
- If NOTHING here is genuinely worth the founder's attention today (all early-signal, all already-known, nothing actionable), return an EMPTY list. Recommending nothing is a correct, valued answer — never manufacture urgency.
- Never suggest external publishing, sending, or a production change — every recommended_action must be something the founder personally reviews and decides, never something this system does automatically.

For each item you pick, respond with:
- candidate_id: the exact id string.
- why_now_ar: one short Arabic sentence — why this, why today, grounded only in the given evidence.
- recommended_action_ar: one short, concrete Arabic sentence — what the founder should actually do.
- risk_caveat_ar: one short Arabic sentence naming the real limitation (sample size, concentration, correlation-not-causation, etc).
- what_to_measure_next_ar: one short Arabic sentence — what evidence would confirm or update this.
- confidence: "low" | "medium" | "high" — low if earlySignal is true or the evidence is thin, high only for large, unambiguous, well-covered evidence.

Respond with ONLY a JSON array (possibly empty), no prose: [{"candidate_id": "...", "why_now_ar": "...", "recommended_action_ar": "...", "risk_caveat_ar": "...", "what_to_measure_next_ar": "...", "confidence": "low"|"medium"|"high"}]`;

function buildCandidatePayload(candidates: FounderIntelligenceCandidate[]) {
  return candidates.map((c) => ({
    id: c.id,
    domain: c.domain,
    title_ar: c.opportunity.titleAr,
    evidence_ar: c.opportunity.evidenceAr,
    sample_size: c.opportunity.sampleSize,
    early_signal: c.opportunity.earlySignal,
  }));
}

/** Validates the model's raw output against the exact candidate set it was
 *  given. Anything that doesn't resolve to a real candidate id, or is
 *  malformed, is dropped — never shown, never guessed at. */
function validateAndResolve(raw: unknown, candidates: FounderIntelligenceCandidate[]): FocusItem[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const items: FocusItem[] = [];
  for (const entry of raw) {
    if (items.length >= MAX_FOCUS_ITEMS) break;
    if (entry === null || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.candidate_id !== 'string') continue;
    const candidate = byId.get(o.candidate_id);
    if (!candidate) continue; // model cited an id that doesn't exist — dropped, never fabricated
    if (typeof o.why_now_ar !== 'string' || !o.why_now_ar) continue;
    if (typeof o.recommended_action_ar !== 'string' || !o.recommended_action_ar) continue;
    const confidence = o.confidence === 'low' || o.confidence === 'medium' || o.confidence === 'high' ? o.confidence : 'low';
    items.push({
      candidateId: candidate.id,
      titleAr: candidate.opportunity.titleAr,
      evidenceAr: candidate.opportunity.evidenceAr,
      sampleSize: candidate.opportunity.sampleSize,
      earlySignal: candidate.opportunity.earlySignal,
      domain: candidate.domain,
      whyNowAr: o.why_now_ar,
      recommendedActionAr: o.recommended_action_ar,
      riskCaveatAr: typeof o.risk_caveat_ar === 'string' ? o.risk_caveat_ar : '',
      whatToMeasureNextAr: typeof o.what_to_measure_next_ar === 'string' ? o.what_to_measure_next_ar : '',
      confidence,
    });
  }
  return items;
}

/**
 * Given an already-assembled candidate list (the caller's job — see
 * assembleFounderIntelligenceCandidates below), ask the model to pick and
 * explain at most 3. Never throws. Returns aiAvailable:false with a reason
 * on any failure (no key, timeout, bad response, empty candidate list) —
 * the caller must render the existing deterministic email unchanged in
 * that case, exactly as ADR-216 Decision 6 requires.
 */
export async function generateFounderIntelligenceBrief(
  candidates: FounderIntelligenceCandidate[]
): Promise<FounderIntelligenceBriefResult> {
  if (candidates.length === 0) {
    return { focusItems: [], aiAvailable: true }; // legitimately nothing to reason about — not a failure
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { focusItems: [], aiAvailable: false, reason: 'ANTHROPIC_API_KEY not configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(buildCandidatePayload(candidates)) }],
      }),
    });
    if (!res.ok) return { focusItems: [], aiAvailable: false, reason: `Anthropic API ${res.status}` };
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text.trim());
    return { focusItems: validateAndResolve(parsed, candidates), aiAvailable: true };
  } catch (e) {
    return { focusItems: [], aiAvailable: false, reason: e instanceof Error ? e.message : 'unknown error' };
  } finally {
    clearTimeout(timer);
  }
}

// ── Candidate assembly ───────────────────────────────────────────────────
// Pure composition of already-computed Opportunity[] arrays into the
// domain-tagged shape the AI call above expects. No computation of its own.

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `opp-${idCounter}`;
}

const KIND_DOMAIN: Record<Opportunity['kind'], FocusDomain> = {
  no_agreement_retailer: 'commercial',
  high_demand_low_coverage: 'catalog_coverage',
  demand_momentum: 'marketing_content',
  emerging_language: 'product_engineering',
};

export function assembleFounderIntelligenceCandidates(
  opportunities: Opportunity[]
): FounderIntelligenceCandidate[] {
  idCounter = 0;
  return opportunities.map((o) => ({ id: nextId(), domain: KIND_DOMAIN[o.kind], opportunity: o }));
}

/** Exported for the caller to render a deterministic "no AI recommendation
 *  this run" line when aiAvailable is false — never silently absent, per
 *  the founder's own requirement that AI failures be stated, not hidden. */
export function describeUnavailability(result: FounderIntelligenceBriefResult): string | null {
  if (result.aiAvailable) return null;
  return result.reason ?? 'unknown';
}
