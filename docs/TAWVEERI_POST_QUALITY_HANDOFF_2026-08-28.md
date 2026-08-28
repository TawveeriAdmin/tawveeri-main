# Tawveeri — Post-Quality-Program Handoff (2026-08-28)

Read this first if you are a fresh Claude Code session starting after `/clear`. It is
self-contained — you should not need to re-read the full
`docs/TAWVEERI_QUALITY_PROGRAM_STATE.md` history to know what to do next, though that
file remains the full record if you need it (see §24 there for the closure detail this
file summarizes).

## 1. Current production status

- Production: `tawveeri.com`, Railway, service `tawveeri-main`, status **Online**.
- Latest relevant commit: **`df8adc2`** — `fix(trust): freshness-gate the Deal Engine's
  best-offer selection` (the last CODE change of the Quality Program).
- Full test suite: **141 suites / 2,363 tests, all passing.**
- `tsc --noEmit` baseline: **550 pre-existing errors** (tracked throughout the program via
  git-stash comparison; never worsened by any Quality Program fix — improved once,
  558→550, when dead code was removed). Do not treat this baseline as a new problem if
  you see it — it predates this handoff and is a known, accepted, non-blocking state per
  CLAUDE.md's own documented convention.

## 2. Quality program closure verdict

**CLOSED for measured scope**, as of 2026-08-28. Full detail: `docs/
TAWVEERI_QUALITY_PROGRAM_STATE.md` §24 (FINAL CLOSURE).

- P0 correctness: CLOSED.
- P1 storefront freshness / trust-language: CLOSED.
- No known issue blocks normal public usage, distribution/growth activity, or the Agent
  Era benchmark validation described in §6 below.
- This is a closure of what was MEASURED, not a claim of zero defects. §24's sections
  E–H name exactly what is known to remain (monitoring items, deferred feature work,
  catalog/merchant gaps engineering cannot solve, and logged follow-up tasks).

## 3. Exact latest relevant commits (chronological, most recent first)

```
df8adc2  fix(trust): freshness-gate the Deal Engine's best-offer selection
813948b  fix(trust): freshness-gate the multi-product compare tool's best-price crown
7f4412e  chore: remove orphaned store-detail-client.tsx (dead code, unreachable)
08d6429  fix(trust): thread product_stores freshness into the store detail page
79e0959  fix(trust): store-comparison-panel now agrees with the card on freshness
15baa0d  fix(search): Tier 2 -- actually narrow the result list for off-taxonomy queries
0e9f359  fix(trust): freshness gating on product-card badges + compare page gaps
9a032e8  fix(search): relevanceGroups was silently empty for any non-taxonomy query
007ffbb  fix(search): a downstream sort step was silently re-clobbering best_price
0cf97be  fix(tps): stale offers can no longer win or hold the "cheapest" claim
23bb033  fix(search): the live search route never read tps_price_implausibility_signals
3fae52b  fix(tps): iPhone 16e was merging into the genuine iPhone 16 identity
1837f42  fix(tps): all-category price-transition guard in the primary TPS write path
824ca8f  fix(tps): systemic accessory-contamination guard in the primary TPS ingestion path
```

All pushed to `origin/main`. All deployed and live-verified in production (not merely
tested locally) before being marked closed.

## 4. What must NOT be reopened without fresh evidence

Per standing instruction carried through the whole program: **do not reopen any of the
defects fixed above unless a fresh production regression has been independently
reproduced first** (not assumed, not inferred from code reading alone — reproduced
against live `tawveeri.com`). This applies in particular to:

- The iPhone 16/16e identity fix and its broader historical sweep (7 canonicals, 11
  store pairs) — §14.0/§15.
- The stale-cheapest-store freshness gate (168h floor) — §12.
- The search relevance fixes (Tier 1 ranking + Tier 2 result-list narrowing) — §14.3/§18.
- Every storefront-layer freshness-gating fix (§17–§22).

If you find something that LOOKS like one of these defects again, the correct first step
is the same discipline this program used throughout: reproduce it live against
production yourself, root-cause it, and only then decide whether it's a genuine
regression (reopen) or a new, different defect (new work unit).

## 5. Remaining non-blocking follow-ups (queued, not urgent)

Full detail in `docs/TAWVEERI_QUALITY_PROGRAM_STATE.md` §24 F–H. Summary:

- **§13** — four adjacent surfaces (`get-comparison.ts`, the UCP feed,
  `getProductComparison.ts`/`getMobileCards`) don't yet read the delist/implausibility
  exclusion tables other surfaces already do. Same proven fix pattern, not yet applied.
- **§11.1** — a small, real, not-yet-root-caused 19-row post-migration anomaly from the
  stale-cheapest-store investigation. Deliberately not chased.
- **APP-006** — shared-context/brand-vs-brand comparison parsing. Feature work, not a
  defect.
- **Gaming-laptop / use-case suitability schema gap** — P2, deferred.
- **`comparison-answer.tsx`/`closest-options.tsx` freshness plumbing** — needs new data
  plumbing from `resolve-comparison.ts`, not a one-line fix.
- **Search relevance Tier 2, full parity for sentence-shaped queries** — deliberately not
  extended there, given this exact trigger's documented regression history (TV-008, the
  AirPods aftermath, ADR-205).
- **Mobile-viewport re-test** — blocked by a browser-automation tooling gap
  (`resize_window` not constraining the viewport; concurrent-fork tab sharing), both
  already reported via `SendFeedback`. Retry once that's confirmed fixed.
- **Catalog/merchant gaps** (thin categories, ~89% single-store, SWSG Bunny Shield
  outage) — not engineering-fixable from this codebase alone; see §24 G.

None of these are blockers. Do not silently promote any of them back to P0/P1 without a
fresh, reproduced reason.

## 6. What comes next: TAWVEERI AGENT ERA — 30-task causal A/B/C validation

This is the strategic work this Quality Program interrupted, and what the next session
should actually pick up.

**Frozen benchmark artifacts** (local, not committed to git — reference them by path,
do not regenerate or modify them):

- `docs/benchmark/tawveeri-agent-benchmark-v1.0.json`
- `docs/benchmark/RUBRIC_v1.0.md`
- `docs/benchmark/EXECUTION_PROTOCOL_v1.0.md`
- `docs/benchmark/CONDITION_C_PAYLOAD_v1.0.md`
- `docs/benchmark/validation-subset-v1.0.json`
- `docs/benchmark/METHODOLOGY_FREEZE_REPORT_2026-08-27.md`

**Critical framing, stated explicitly so it is not lost across the `/clear` boundary:**
the earlier Condition A/B results (`docs/benchmark/condition-a-results-*.json`,
`condition-b-results-v1.0.json`, and their aggregate/report files) must **NOT** be
treated as the causal comparison. The execution protocol for those runs was not
controlled, and Tawveeri production changed materially during the Quality Program that
followed them (14 commits, spanning identity fixes, search relevance fixes, and
storefront-layer trust changes — see §3 above). Those earlier results are historical
artifacts only, not a valid baseline to compare against.

**What the next session should do**: run the frozen 30-task validation subset
(`validation-subset-v1.0.json`) as a **NEW paired A/B/C experiment**, executed strictly
under `EXECUTION_PROTOCOL_v1.0.md`'s controlled methodology, against the CURRENT
(post-Quality-Program) state of production. This is a fresh causal measurement, not a
continuation or re-analysis of the earlier runs.

**No benchmark execution happened in this closure session** — this handoff only records
where to start, it does not start it.
