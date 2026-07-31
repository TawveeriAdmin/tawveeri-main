# IMPLEMENTATION ROADMAP — PHASE 2
**2026-07-31 · Sequenced against `CONSUMER_EXPERIENCE_CONSTITUTION.md` and Appendix F.**

---

## MY ORIGINAL ORDERING WAS NOT THE STRONGEST — and the Constitution is why

Before the Constitution existed I proposed: **§8 وفّر advisor → §2.1 retailer tiers → §11 WCAG.**

Reading F7 and Principle 4 in full changed it, and the change is not cosmetic. **F7 says a single
generated sentence undoes the vocabulary discipline everywhere else, invisibly, because no
repository search catches what an assistant says at runtime.** My original plan began by building
*more* assistant. The Constitution required me to first ask what the *existing* generative surface
is already doing.

Measured, and the answer split in two:

| finding | evidence |
|---|---|
| **The customer-facing advisor is DETERMINISTIC** — F7 live risk on `/advisor` is **zero** | `/advisor` → `askAdvisor` → `POST /api/v1/agent/decide`, which contains **no Anthropic call**. Everything it renders comes from structured evidence |
| **`/api/ai-assistant` is a live, unauthenticated, billable, generative endpoint that serves nobody** | Anonymous `POST` returns **200** with LLM-generated Arabic. **Zero references anywhere in the codebase**, mobile app included |

So the advisor is in better constitutional shape than I assumed, and the risk sits somewhere I had
not looked. **Building more assistant before closing that surface would have been exactly the
"interface outruns the platform" failure Principle 4 exists to prevent.**

---

## THE ORDER

Prioritised by: customer trust · measurable customer value · dependency order · production
evidence · implementation leverage · reversibility.

### P2-1 · Close the ungoverned generative surface — **IN PROGRESS**
`/api/ai-assistant` is live, unauthenticated, calls Anthropic on our key, and is referenced by
nothing. It is constrained to shopping by a system prompt (verified: it refuses an off-topic
poem), so it is not a general-purpose proxy — but it generates shopping claims at runtime under
**no verified vocabulary constraint**, which is precisely F7's subject.

**Constitutional basis:** F7 · Principle 1 (*if the data does not exist, the feature does not
exist* — inverted here: a feature no customer uses should not be able to make claims) ·
Principle 4.
**Customer cost of closing it: zero** — nothing calls it.
**Stopping condition:** endpoint no longer answers an unauthenticated generative request in
production, and no customer surface regresses.

### P2-2 · Close the EN 90% / AR 100% card-reachability gap
Same catalogue, same retailers — **the gap is ours.** Founder-flagged, measurable with the
existing harness, and it sits on surfaces later units touch.
**Dependency:** diagnose the residual before implementing; do not assume it is identity slugs.
**Stopping condition:** EN reaches parity, or the residual is proven structural and recorded.

### P2-3 · State the results ordering rule on the page (F4)
F4 requires the ordering rule be **stated in one readable line on the page.** No such line exists.
**Hard prerequisite:** establish what the ordering actually *is* before stating it — a false
statement of the rule is worse than no statement (F1).
**Note:** F4's *cheapest comparable total* cannot be fully honoured while delivery cost is
unknown; `/api/search` currently emits `delivery_cost: 0` as a literal. Under Principle 4 the
total-cost ordering is **postponed**, not faked. The *statement* of the true current rule is not.
**Stopping condition:** the page states its real ordering rule in one line, in both locales.

### P2-4 · A customer-outcome measurement beyond the harness
The Constitution names this **the first measurement obligation after launch**, and names honestly
that trust is not measured today.
**Sequenced here, not first**, because it measures customer behaviour and there are no customers
yet — building it before traffic produces an instrument with nothing to read, which is its own
failure class. Build it when launch traffic makes it readable.
**Stopping condition:** one measured customer outcome exists that the harness cannot produce.

### P2-5 · §8 وفّر advisor build-out *(was my #1)*
Demoted, on evidence. The advisor already works and is deterministic — the constitutionally
risky part of "AI" is the part that is not built. Build it **after** F7's guard is real, so the
protections exist before the generative surface does.
**Stopping condition:** each added capability passes Appendix B's tests and F7's adversarial test.

### P2-6 · §2.1 retailer tiers
Unblocks honest public retailer counts. Inputs already measured.

### P2-7 · §11 WCAG 2.2 AA pass
Never systematically done. Accessibility is a trust surface.

### P2-8 · UNIFIED SEARCH migration
Sequenced last deliberately: it is a **migration of shipped behaviour** touching both live entry
points, and it must carry the AI disclosure with it (Constitution → UNIFIED SEARCH → hard
condition; F5 extended). Doing it after P2-1…P2-3 means it migrates a surface that is already
governed, measured and honest, rather than migrating unresolved problems into a new shape.

---

## NOT ON THIS ROADMAP, AND WHY

| item | reason |
|---|---|
| Variant merging (Constitution → *Merge variations*) | **Measured immaterial:** 3 collapsible cards in 240 (1.25%). Merging risks violating the identity rule (storage/capacity/generation must never merge) for a ~1% visual gain. Revisit only if measurement changes |
| DEBT-1 provenance FK | Deferred; reclassified under F6 as deferred customer value. Reopens under its own triggers — **P2-2 may be one of them** |
| Deals ranking model | Explicitly deferred by founder decision |
| 404 body | Roadmap unit with acceptance criteria; prerequisite is the root layout owning the HTML shell |

---

## DELIVERABLES — created when they earn existence

`IMPLEMENTATION_ROADMAP.md` — this file, first because Phase 2 sequences from it.
`UX_DECISION_RECORD.md` — at the first significant UX decision, not retroactively.
`EXECUTION_PLAN.md` — when a phase is concrete enough to plan.
`DATA-AVAILABILITY-AUDIT.md` — widened when a feature depends on that coverage.
