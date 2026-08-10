// src/lib/agent/semantic-fallback.ts
// FINAL SEMANTIC INTELLIGENCE, BILINGUAL PARITY & WAFFAR CLOSURE MISSION (2026-08-10).
//
// THE GOVERNING PRINCIPLE (mission brief §3): language may be probabilistic; commercial
// truth must stay deterministic and evidence-grounded. This module is INTERPRETATION ONLY —
// "what does the shopper's sentence MEAN" — never product fact, price, availability, or
// ranking. It runs OUTSIDE the ranking path entirely (ADR-002 is untouched: `decide()` never
// calls this, never will).
//
// MEASURED JUSTIFICATION (scripts/waffar-eval/corpus-dev.ts, 10/33 dev cases): the
// deterministic keyword parser (task-parser.ts) has a real, measured ceiling on genuinely
// novel, indirect, non-keyword Arabic/English shopping language — "أبي جهاز يكرف معي بالدوام"
// names no category at all; "gaming doesn't matter to me"-style comparatives beyond a fixed
// negation-marker list keep being invented one phrase at a time. Growing the keyword lists
// indefinitely (mission brief §5) is explicitly rejected as the ceiling strategy. A CLOSED-
// VOCABULARY extraction — the model chooses only among categories/priorities Tawveeri already
// scores, never invents a new one — closes this gap without opening a new one.
//
// CREDENTIAL REUSE, NOT A NEW PAID API: `ANTHROPIC_API_KEY` is already provisioned in this
// Railway environment (see `src/app/api/ai-assistant/route.ts`, disabled 2026-08-09 for an
// UNRELATED reason — being a second, disconnected answer-generation brain, not a credential
// or cost concern). This module calls the SAME provisioned key for a narrower, safer job:
// closed-vocabulary field extraction, never open-ended answer generation, never customer-
// facing text.
import { CATEGORY_KEYS, PRIORITY_KEYS } from './task-parser';

export interface SemanticExtraction {
  category: string | null;
  budget_total: number | null;
  priorities: string[];
  deprioritized_priorities: string[];
  confidence: number;
}

const MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 4000;
/** Below this, a semantic category guess is discarded rather than acted on — an unsure
 *  inference must fall through to an honest clarify/browse, never masquerade as resolved
 *  understanding (mission brief §10: "a weak semantic inference must never silently become a
 *  hard constraint" — the same discipline applied to CATEGORY, which gates everything else). */
const MIN_CATEGORY_CONFIDENCE = 0.6;

const SYSTEM_PROMPT = `You are a closed-vocabulary field extractor for Tawveeri, a Saudi price-comparison site. You NEVER answer the shopper, recommend a product, state a price, or invent facts. You ONLY read one shopping sentence (Arabic, English, Saudi/Gulf colloquial, or a mix) and extract which of Tawveeri's OWN already-supported fields it implies.

Valid categories (choose ONE or null if genuinely unclear): ${CATEGORY_KEYS.join(', ')}
Valid priority keys (choose zero or more, ONLY from this list): ${PRIORITY_KEYS.join(', ')}

Rules:
- category: the product category the sentence is about. Return null unless the sentence names or unambiguously implies an ACTUAL DEVICE/PRODUCT TYPE (directly, or through a clearly device-specific activity like "watch matches" -> tv, "photograph my kids" -> mobile). Vague adjectives alone ("something fast", "something simple", "something excellent", "something for my mother") are NOT enough — a request with no product-type signal at all must get category=null, even if a budget or a quality wish is mentioned. When genuinely torn between two categories, return null rather than picking one. NEVER invent a category outside the list above.
- budget_total: a number in SAR if a budget is clearly and unambiguously stated or strongly implied with a specific figure (e.g. "3k" = 3000). null if no clear number.
- priorities: priority keys the sentence POSITIVELY implies, from the list above only. Infer indirect phrasing (e.g. "I don't want to charge it all the time" implies "battery"; "I watch a lot of matches" implies "sports"; "I have many kids and it runs all day" implies "large"; "I'm a light sleeper and the noise bothers me" implies "quiet"). Never fabricate a priority the text gives no basis for.
- deprioritized_priorities: priority keys the sentence explicitly says DON'T matter or should be de-prioritized (not the same as excluded/hated — just "not important to me").
- confidence: your OWN honest 0.0-1.0 confidence in the category call specifically. Be conservative — 0.5 or below for anything you are genuinely guessing at.

Respond with ONLY a JSON object, no prose, no markdown fences:
{"category": "laptop" | null, "budget_total": number | null, "priorities": [...], "deprioritized_priorities": [...], "confidence": 0.0-1.0}`;

/**
 * Extract category/budget/priorities from free text the deterministic parser could not
 * classify. NEVER THROWS — every failure mode (no key, timeout, network error, malformed
 * JSON, an out-of-vocabulary value) returns `null`, and the caller's existing deterministic
 * behavior is the fallback (mission brief §18: failure containment — the site must remain
 * usable with or without this call ever succeeding).
 */
export async function semanticExtract(
  text: string,
  opts?: { signal?: AbortSignal },
): Promise<SemanticExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !text.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text.slice(0, 500) }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const raw = data.content?.[0]?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as Partial<SemanticExtraction>;

    // VALIDATION IS THE ENFORCEMENT POINT, NOT THE PROMPT (same discipline as F7 in the
    // disabled ai-assistant route). A prompt is a request; the model can still return a
    // category outside the list, a NaN, or a garbage priority string, and this is what stops
    // any of that from ever reaching a customer-visible field.
    const category = typeof parsed.category === 'string' && (CATEGORY_KEYS as readonly string[]).includes(parsed.category)
      ? parsed.category
      : null;
    const confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;
    const budgetRaw = typeof parsed.budget_total === 'number' && Number.isFinite(parsed.budget_total) ? parsed.budget_total : null;
    // MEASURED FIX (2026-08-10, case M11 in scripts/waffar-eval): `confidence` is the model's
    // OWN self-reported score for the CATEGORY call specifically (the prompt asks for exactly
    // that), so gating budget acceptance on it too silently dropped a perfectly clear "around
    // 3k" figure whenever the category happened to be genuinely ambiguous (camera vs mobile) —
    // two independent judgments were wrongly coupled to one score. The prompt already
    // instructs the model to return budget_total=null unless "clearly and unambiguously
    // stated" — trusting that null/non-null decision, backed by the SAME numeric sanity bounds
    // parseBudget (task-parser.ts) already enforces, is the one rule; no second, redundant
    // confidence gate that can only ever be wrong in one direction (too strict).
    const budget_total = budgetRaw != null && budgetRaw >= 100 && budgetRaw <= 500000
      ? budgetRaw
      : null;
    const validKeys = new Set(PRIORITY_KEYS);
    const priorities = Array.isArray(parsed.priorities)
      ? [...new Set(parsed.priorities.filter((p): p is string => typeof p === 'string' && validKeys.has(p)))]
      : [];
    const deprioritized_priorities = Array.isArray(parsed.deprioritized_priorities)
      ? [...new Set(parsed.deprioritized_priorities.filter((p): p is string => typeof p === 'string' && validKeys.has(p) && !priorities.includes(p)))]
      : [];

    return {
      category: confidence >= MIN_CATEGORY_CONFIDENCE ? category : null,
      budget_total,
      priorities,
      deprioritized_priorities,
      confidence,
    };
  } catch {
    // Timeout, network failure, malformed JSON — all equally "no semantic answer this turn".
    return null;
  } finally {
    clearTimeout(timeout);
    opts?.signal?.removeEventListener('abort', onExternalAbort);
  }
}
