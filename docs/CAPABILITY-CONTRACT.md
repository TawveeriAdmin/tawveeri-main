# Tawveeri Product Capability Contract

**Purpose.** The one place Grok (or anyone drafting shopper-facing social/marketing content) checks before promising a shopper journey Tawveeri may not actually support. Sourced from real, founder-accepted ADRs in `docs/DECISIONS.md` — never invented, never guessed. Updated manually alongside the ADR that changes a capability's status; not a live database table or API (see "Why not a live API" below).

**States** (deliberately reuse this codebase's own existing vocabulary rather than inventing a new one — see `src/lib/agent/catalog-gap.ts`'s `classifyZeroResult()`, the nearest existing primitive):

- **GREEN / PROVEN_LIVE** — verified working in production, with a citable test/ADR.
- **PARTIAL** — works in some cases, not others; the gap is known and disclosed.
- **RED / UNSUPPORTED_BY_DESIGN** — deliberately not modeled as a structured, filterable capability (usually: evidence too thin, single-provider, or a real product ambiguity) — disclosed to the shopper when relevant, never silently dropped, never fabricated as supported.
- **UNKNOWN** — not yet evaluated. Default for anything not listed below. Never assume GREEN.

## Current capability index

| Capability | Category | Status | Evidence | Last verified |
|---|---|---|---|---|
| Budget constraint (بحد أقصى) | cross-category | GREEN | ADR-291 — preserved across search, cross-category, unit-tested | 2026-09-05 |
| Camera priority + budget | smartphone | GREEN | Founder-cited, X post `d1_v23_latabda` published only after this passed QA | 2026-09-05 |
| Battery priority + budget | smartphone | GREEN | Founder-cited, same publication gate | 2026-09-05 |
| Performance priority (phone) | smartphone | PARTIAL | Founder-cited at publication; not independently re-verified this session | 2026-09-05 |
| Free-form current-device pain point | cross-category | PARTIAL | Founder-cited at publication; not independently re-verified this session | 2026-09-05 |
| Refrigerator lock/key requirement (قفلها مهم) | refrigerator | RED / UNSUPPORTED_BY_DESIGN | ADR-290 — `parseLockRequirement()` discloses `wants_lock` but deliberately does NOT filter on it (evidence too thin, single-provider); `categoryEnforcedZero` prevents a silent zero-result instead | 2026-09-05 |
| Unnamed A-vs-B comparison | cross-category | RED (as of publication) | Founder-cited; not re-verified this session — do not assume resolved | 2026-09-05 |
| Buy-now-vs-wait guidance | cross-category | RED (as of publication) | Founder-cited; not re-verified this session — do not assume resolved | 2026-09-05 |
| Condition (new/renewed/used) disclosure | cross-category, storefront layer | PARTIAL | ADR-287 — `extractSpecsFromTitle()` reads `products.name_en` (preserves "Renewed -"); confirmed 2026-09-05 that `canonical_products.name_en` (identity layer) does NOT preserve condition markers — any surface reading only the canonical name will miss it | 2026-09-05 |
| Noon-branded promotional placement | commerce | RED (legal, not product) | ADR-284/294 — clause-8.3 written brand-consent unresolved | 2026-09-05 |

**Anything not listed above is UNKNOWN, not GREEN.** Do not infer support from a category simply existing in the catalog.

## Why not a live database table or API

The founder's own mission explicitly warns against building "a giant orchestration platform" and a "direct Grok→production write API... unless clearly necessary." A live, automatically-updated capability table would need: (a) a trustworthy write path (what re-verifies a capability and flips its status — nothing does this automatically today), and (b) read access for an external system (a new integration surface). Neither is justified by current volume — this mirrors the same deferral already applied to a "Product Gap" table (`src/lib/agent/catalog-gap.ts`'s own design note: "deliberately deferred until real volume justifies schema"). This document is the smallest viable version: versioned by git, updated by whoever writes the next relevant ADR, readable by anyone (including relayed to Grok by the founder) without any new infrastructure. Promote to a live table/API only when manual updates genuinely can't keep pace — not preemptively.

## How a new capability gets added or changed here

1. A real ADR in `docs/DECISIONS.md` proves or disproves a specific shopper-facing capability (the way ADR-290/291 did for lock/budget).
2. That ADR's author adds or updates the corresponding row in this table in the same commit.
3. Nothing here is ever asserted without a citable ADR — no capability is marked GREEN from a chat conversation alone.
