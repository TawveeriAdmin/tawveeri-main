# Waffar Final Intelligence Handover — 2026-08-10

**Status: Workstream CLOSED (reopened once, same day, re-closed).** This document is the durable
record of the final semantic-intelligence mission's architecture, evaluation methodology, and known
limitations. It is written so that a future engineer never needs the chat session that produced it.
See `docs/DECISIONS.md` ADR-237 for the original closure and ADR-238 for the reopened-mission
findings; this file is the fuller narrative of both.

**ADDENDUM (same day, reopened mission — see ADR-238 for full detail):** hours after the closure
below, the founder tested production on his own iPhone and found 4 real defects — one SEVERE
(a laptop backpack surfacing as the sole result for "ابي لاب توب للجامعه", an eligibility-invariant
violation). Root cause was NOT in the semantic-fallback layer this document describes — it was in
`/api/search`'s own retrieval pipeline: THREE independently-drifted category classifiers (this
mission's own "one decision system" principle, violated one layer down from where this document
was looking) plus an Algolia query-construction gap that sent a shopper's context words as
REQUIRED match terms. All fixed, live-verified, documented in ADR-238. The semantic-fallback
architecture itself (§2-§8 below) was NOT the defect and needed no changes.

## 1. The question this mission answered

Does Waffar understand what a Saudi/English shopper **means**, or only the words and patterns
explicitly taught to it? Answered with **measurement**, not assertion — see §5.

## 2. Architecture (final, as shipped)

```
Free text (AR / EN / code-switched)
        │
        ▼
parseShoppingTask()  ── deterministic, keyword/regex, LLM-free, ADR-002 (task-parser.ts)
        │
        ├─ category resolved + real need signal ──────────────► advisory, no LLM call, instant
        │
        └─ NO category, OR category-only-no-signal AND text is
           long/descriptive (≥5 words)
                    │
                    ▼
        semanticExtract()  ── Claude Haiku, CLOSED vocabulary only
        (semantic-fallback.ts)   (CATEGORY_KEYS / PRIORITY_KEYS — never invents a value
                                   outside what Tawveeri already scores)
                    │
                    ▼
        validated, bounded merge back into the SAME ParsedTask/DecisionState contract
        (/api/v1/agent/decide/route.ts)
                    │
                    ▼
        decide()  ── 100% deterministic ranking/eligibility/pricing/evidence, UNCHANGED
```

**The one governing rule:** language may be probabilistic; commercial truth must stay deterministic.
`semanticExtract()` is called from exactly one place (`/api/v1/agent/decide/route.ts`) and its output
can only ever populate `category` (from a closed list), `budget_total` (numeric-bounded), and
`inferred_priorities` (from a closed list, merged as *soft, ranking-only* signal, never a hard
constraint, never `explicit_preferences`). It is never called from `decide()`, `shouldAsk()`, or any
ranking/eligibility code. ADR-002 ("deterministic engines decide; LLMs only phrase, with supplied
facts") is unmodified — here the LLM does not even phrase; it only classifies into an existing schema.

## 3. Files touched this mission

| File | What changed |
|---|---|
| `src/lib/agent/task-parser.ts` | Exported `CATEGORY_KEYS`/`PRIORITY_KEYS` (closed vocab for the semantic layer); added `inferred_priorities`/`semantic_confidence` to `ParsedTask`; English negation markers (deprioritize/exclude, post-positioned — "gaming doesn't matter" pattern); budget approximator ("حول"/"around"); category-check reorder (phone before camera). |
| `src/lib/agent/route-query.ts` | `looksDescriptive()` heuristic — routes a genuinely descriptive, category-less OR signal-less sentence (≥5 words) to `advisory` instead of a silent unrelated browse, giving the server's semantic fallback a chance; fixed a named-model false-positive (any digit in the sentence, e.g. a budget figure, falsely marked a category word as a specific model). |
| `src/lib/agent/semantic-fallback.ts` | **New.** The schema-constrained extraction function. Never throws; every failure mode (no key, timeout, malformed JSON, out-of-vocabulary value) returns `null` and the deterministic result stands alone. |
| `src/app/api/v1/agent/decide/route.ts` | Wires the fallback in: triggers only per §2's gate; merges with validation and a deterministic-wins conflict guard (a semantic priority that contradicts what the deterministic parser already read as de-prioritized/excluded is dropped before merge). |
| `src/lib/agent/advisor-api.ts` | `AdvisorParsed` gained `inferred_priorities`/`semantic_confidence` so the server's response type carries the new fields to the client. |
| `src/lib/agent/decision-state.ts` | `applyParsedTask` now routes `inferred_priorities` into `DecisionState.inferred_preferences` + `soft_preferences` — never `explicit_preferences`. The explicit/inferred split this field already existed for (built in an earlier mission, never populated) is now live. |
| `src/lib/agent/compare-intent.ts` | Bilingual-parity fix: a bare "cheapest" only means PRODUCT_COMPARISON when the subject carries a model-identifying digit (e.g. "cheapest iphone 16"); a bare category ("cheapest laptop") now converges with Arabic's existing "أرخص لابتوب" behavior (eligibility-safe advisory ranking). |
| `scripts/waffar-eval/` | **New.** The durable, re-runnable evaluation harness — see §4. |
| `docs/DECISIONS.md` | ADR-237. |

## 4. Evaluation harness — how to re-run it

```bash
# Deterministic-only baseline (no network calls, instant)
npx tsx scripts/waffar-eval/measure.ts dev

# Full pipeline including the semantic fallback (real Anthropic API calls, ~1-2 min)
npx tsx scripts/waffar-eval/measure.ts dev --semantic
npx tsx scripts/waffar-eval/measure.ts holdout --semantic

# Bilingual parity (AR/EN/code-switched pairs, meaning convergence not text equality)
npx tsx scripts/waffar-eval/parity.ts
```

- `corpus-dev.ts` — visible/consulted while implementing. Safe to extend when a NEW real
  production failure is found (add a case, tag `knownDeterministicGap` if it's an accepted,
  disclosed limitation rather than a bug to fix).
- `corpus-holdout.ts` — was written AFTER the architecture was locked and never consulted while
  writing the fixes above. **Do not "fix the system to pass a holdout case."** If a future
  engineer adds cases here, treat failures as signal about genuine generalization, and write the
  NEXT holdout set fresh, after any resulting fix, to keep the discipline honest.
- `measure.ts`'s `resolveTask()` mirrors the exact trigger/merge logic in `/api/v1/agent/decide/route.ts`.
  If that route's merge logic changes, update this mirror in the same commit or the eval stops
  measuring what actually ships.

## 5. Measured results (2026-08-10, this mission)

| Corpus | Deterministic only | + Semantic fallback |
|---|---|---|
| Dev (33 cases, consulted during implementation) | 70% (23/33) | 97% (32/33) |
| **Holdout (16 cases, never consulted)** | **69% (11/16)** | **88% (14/16)** |

The holdout gain (+19pp on entirely unseen phrasing) is the honest answer to §1: this is
generalization, not memorization of the dev corpus's specific sentences.

Bilingual parity: **4/5** pairs converge to an identical structured mission; the 5th differs only
in routing mode (harmless extra round-trip), with identical resolved meaning — see ADR-237 for the
explanation (word-count-threshold sensitivity, not a meaning divergence).

Full regression suite: **1730/1730** passing before and after every change in this mission.

## 6. Known, disclosed, non-blocking limitations

1. **Extremely obscure colloquial idioms** ("يكرف معي" — "keeps up with me", a rare Saudi
   colloquialism) are not reliably resolved by the semantic layer. Acceptable residual ceiling —
   even a capable general model has one.
2. **Arabic transliterations of English loanwords** not in the deterministic regex (e.g. "فريزر"
   for "freezer") are not always bridged by the semantic layer either. A real, found, disclosed
   gap — not fixed under holdout discipline (see §4).
3. **Negation-window edge case**: a deprioritize marker separated from its keyword by an extra
   word ("مب مهم **عندي** الألعاب") can fall just outside the deterministic parser's fixed
   12-character lookback window. A second, deeper finding from the same case: even when the
   semantic layer correctly identifies a de-prioritization, the merge logic only ADDS inferred
   priorities — it has no mechanism to SUBTRACT a deterministic false positive it disagrees with.
   Both are real, disclosed architectural boundaries.
4. **No brand/model exclusion field.** "ما أبي سامسونج" ("I don't want Samsung") has nowhere to
   land — `DecisionState` has no brand-preference field today. Out of scope for this mission
   (§11: don't add a field without material, demonstrated benefit); a real gap if brand exclusion
   becomes a priority later.
5. **No durability/build-quality priority key.** "survives my kid dropping it" has no keyword to
   land on. Same out-of-scope reasoning as #4.
6. **Mobile visual verification limitation** (pre-existing, unrelated to this mission): the
   session's browser-automation tooling cannot prove a genuine mobile viewport render. Every
   production verification claim in the closure report is qualified accordingly.

None of the above block production use — every one degrades to an honest "cannot resolve, please
clarify" rather than a fabricated or wrong answer, which is the platform's own non-negotiable rule
(CLAUDE.md: "Unknown beats incorrect").

## 7. Cost and latency

- The semantic fallback calls `claude-haiku-4-5-20251001` (small, fast, cheap) — never
  `claude-sonnet-*` — and only on the minority of queries the deterministic parser cannot already
  resolve (measured: ~30/33 dev cases triggered it, but the dev corpus was deliberately adversarial
  and skewed toward exactly the sentences meant to need it; real production traffic — mostly
  short, explicit browse/product queries — will trigger it far less often).
- 4-second timeout, capped `max_tokens: 300`, first 500 characters of input only.
- Never called on `EXACT_PRODUCT`, `PRODUCT_COMPARISON`, or any pricing/ranking path — only the
  advisory/NEEDS_DISCOVERY journey.
- No new paid credential: reuses the `ANTHROPIC_API_KEY` already provisioned in this Railway
  environment for the (disabled) `/api/ai-assistant` route.

## 8. Extending this safely

- **Never** call `semanticExtract()` from `decide()`, `shouldAsk()`, or anything in the
  ranking/eligibility path. That boundary is what keeps ADR-002 intact.
- **Never** add a category or priority to the semantic prompt without also adding it to
  `CATEGORY_KEYS`/`PRIORITY_KEYS` in `task-parser.ts` first — the validation step silently drops
  anything outside those lists, by design.
- When you find a new deterministic gap (a real, common phrasing the parser should just handle),
  fix `task-parser.ts` directly — that stays the free, fast, primary path. Reserve the semantic
  layer for genuinely novel, indirect, non-enumerable language, matching this mission's own
  finding: growing keyword lists closes vocabulary gaps; it never closes the kind of gap the
  semantic layer exists for.
- Before shipping any further changes to this stack, re-run `npm test`, then
  `npx tsx scripts/waffar-eval/measure.ts dev --semantic` and `... holdout --semantic`, and compare
  against the numbers in §5. A regression on the holdout corpus specifically is the strongest
  signal something broke real generalization, not just a specific hardcoded case.
