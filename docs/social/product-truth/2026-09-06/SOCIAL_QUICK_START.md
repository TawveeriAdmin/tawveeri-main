# SOCIAL_QUICK_START.md
**Read this first.** Five minutes to understand Tawveeri well enough to market it honestly. Everything here is cited in `SOCIAL_CLAIMS_LEDGER.md` — go there for the evidence behind any line.

## What Tawveeri is
A Saudi price-decision platform: describe your need and budget in Arabic or English, Tawveeri compares real observed prices across active Saudi merchants and explains its recommendation — then sends you to the merchant to buy. It does not sell anything itself.

## One promise
"We don't guess — we tell you honestly, even when the honest answer is 'we don't know.'" This is proven live and repeatedly (refrigerator lock disclosure, storage-capacity ambiguity, fake-discount detection) — it is the single strongest, most evidence-backed brand claim available. Anchor content on it.

## Top GREEN capabilities today
1. Budget-ceiling understanding, any phrasing, all categories.
2. "Small" refrigerator size preference, evidence-based.
3. Honest disclosure when a stated requirement (e.g. a lock) can't be verified — never silently dropped, never fabricated.
4. AC room-size → BTU capacity matching (new finding, live-verified 2026-09-06).
5. Phone camera-priority + budget search, with a written reason per pick.
6. Fake-discount detection — flags a "before" price never actually observed.
7. Fully neutral ranking — commercial interest never affects order (stated on every results page).
8. Real, working merchant exit links carrying the correct affiliate tag.
9. Honest zero-confident-match fallback, clearly labeled as sponsored/affiliate content.
10. Cross-merchant storage/spec ambiguity disclosure (phones).
11. Natural-language follow-up questions ("what if my budget were higher?", "cheaper?") — confirmed working live 2026-09-06: each returns an honest, explicit answer (a real before/after comparison, or an explicit "no change" verdict), not a silent no-op. **Correction:** an earlier same-day test reported these as broken (GAP-1 in `PRODUCT_GAPS_FOR_SOCIAL.md`); that observation was invalidated by a later, more reliable reproduction — root cause was a browser-automation click-coordinate mismatch in the test tooling, not product behavior. See `docs/report/TAWVEERI-CURRENT-STATE-2026-09-06.md`.
12. Home Mission's full intake → review → build-plan flow — confirmed working end-to-end live 2026-09-06 (real multi-category plan, real budget allocation, real per-room AC matching, honest evidence disclosures). **Correction:** an earlier same-day test reported the submit step as stuck; invalidated by the same later reproduction as item 11 — same root cause (test-tooling click mismatch), not a product defect. Real-world shopper completion RATE for this flow was not re-measured and remains a separate, open question (see item 7 below).

## Top RED / do-not-promise capabilities
1. Verifying a refrigerator (or anything) has a lock/key — disclosed, not filtered.
2. Unnamed brand-vs-brand comparison ("iPhone or Samsung, which is better").
3. Buy-now-vs-wait timing guidance.
4. Automatic discovery/addition of a product not already in the catalog.
5. Official partnership with any merchant (Noon explicitly legally unresolved).
6. "Noon is usually cheaper" — the opposite is true for TVs.
7. Any live Grok/AI-agent integration with the product — none exists (ADR-297); this very pack is manually maintained, not a live feed.

## Top 10 real shopper journeys to use in content (in order of evidence strength)
1. Small fridge + lock matters (honesty differentiator — the flagship story).
2. AC for a room size + budget (capacity matching, new finding).
3. Phone, camera priority + budget (re-verified live).
4. Any journey showing the fake-discount catch on a real product.
5. Any journey showing the merchant exit link landing on a real product page.
6. The honest "couldn't find a confident match" fallback with its affiliate label.
7. Home Mission's full plan-building flow — confirmed working end-to-end 2026-09-06, but do not claim or imply a proven high shopper completion rate; that data point is separately still an open question (last known figure: August 2026, real engagement with zero completions — not re-measured since).
8-10. TV, laptop, tablet, washer journeys — all live-tested 2026-09-06 and confirmed GREEN (see `docs/report/TAWVEERI-CAPABILITY-TRUTH-2026-09-06.md`); re-check freshness if using more than ~2 weeks after that date.

## Top 5 content formats
1. Screen-recorded real search with the honesty disclosure visible (crop out the unrelated "Hot Deals" grid below — see `SOCIAL_ASSET_MANIFEST.md`).
2. Before/after price-history screenshot proving a fake discount caught.
3. "Ask it like this" carousel showing real query phrasing that works (budget, room size, camera priority).
4. Founder-style explainer on "why we say 'we don't know' instead of guessing."
5. Merchant-neutral comparison card screenshot with the ranking-neutrality line visible.

## Current X rule
Reply workflow only: show the exact reply text, recommend, wait, get exact founder approval, publish exactly what was approved. No live Grok-to-product integration exists — Grok drafts from this pack, not from a live query.

## Current TikTok rule
Fully manual. One founder-reviewed video at a time. No auto-posting, no scheduled bulk uploads.

## Public approval rule
Nothing publishes without the founder approving the exact artifact shown (not a description of it). See `SOCIAL_GOVERNANCE.md` §1.

## Key measurement rule
Never call correlation attribution. A view or click is not a confirmed conversion — confirmed affiliate revenue is currently zero (`SOCIAL_CLAIMS_LEDGER.md` C6). Report platform-native metrics as platform-native, Tawveeri session/exit-click data as deterministic, and anything else as correlation only.

## Where to read the full Product Truth
`PRODUCT_TRUTH_SOCIAL_PACK_AR.md` / `_EN.md` (this folder) for the full narrative, `SOCIAL_CLAIMS_LEDGER.md` for every citation, `SOCIAL_CAPABILITY_CONTRACT.json` for the machine-readable version, `PRODUCT_GAPS_FOR_SOCIAL.md` for known defects, `SOCIAL_GOVERNANCE.md` for what never to publish.

**Final current-truth documents (supersede any conflicting detail above or in the older files):** `docs/report/TAWVEERI-CURRENT-STATE-2026-09-06.md` (full corrected founder audit), `docs/report/TAWVEERI-FOUNDER-SCORECARD-2026-09-06.md` (concise decision view), `docs/report/TAWVEERI-CAPABILITY-TRUTH-2026-09-06.md` (per-category capability truth, including Home Mission's final verified state). These three were written after a final, more reliable re-verification and are the authoritative reference — read them first if anything here seems to conflict.
