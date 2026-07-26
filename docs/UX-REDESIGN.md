# Tawveeri UX Redesign — Entry Experience (V2), Evidence-Grounded

**Mandate:** treat the existing UI as V1 only; redesign for measurable improvement in customer
understanding, trust, engagement, and purchasing decisions; build and measure, don't just recommend.

**Integrity note (Constitution: never fabricate):** this document grounds every decision in *real,
named* principles from UX/HCI, behavioral science, and decision research. It cites **mechanisms,
not invented statistics** — I do not claim specific conversion percentages from studies I cannot
verify. Where a principle predicts an outcome, the **Private Beta A/B test is the empirical judge**
for *this* market. Design conviction sets the champion; data confirms or flips it.

---

## 1. Diagnosis of V1 (what the evidence and the Constitution both flagged)

The V1 homepage stacked, with no single focal point: a stats row, an advisor link-card, a **live LLM
chat box**, a "0% interest financing" strip, a **hardcoded "المنيع — up to 59% off" deal banner**, and
a partners row. Problems, most severe first:

1. **A fabricated offer (constitutional violation).** The "up to 59% off" banner was hardcoded, not
   evidence-backed — exactly what "never fabricate a price/offer" forbids. **Removed.**
2. **Three competing AI/entry surfaces** — the homepage LLM chat (`/api/ai-assistant`), the
   deterministic `/advisor`, and a separate `/assistant` page. This is the "multiple search surfaces"
   the founder flagged: it fragments intent and splits measurement.
3. **Inverted hierarchy vs the platform's own principle** ("deterministic engines decide; LLMs only
   phrase"): V1 made a free-form LLM chat the hero and buried the deterministic, evidence-citing
   engine as a link. The differentiated, trustworthy surface was demoted.
4. **Cognitive overload / no primary action** — six competing modules; the user must choose where to
   even start.

## 2. Redesign decisions (each: principle → decision → how the beta tests it)

| Decision | Principle (real, named) | Mechanism | Beta metric |
|---|---|---|---|
| **One primary action** (the advisor input) | **Hick's Law**; **choice overload** (Iyengar & Lepper) | fewer competing options → faster, more confident first step | landing→search rate; session completion |
| **Deterministic advisor as hero** | Platform Constitution + **algorithm-aversion** (Dietvorst) | people distrust opaque automated advice; a *neutral, evidence-citing* engine is the antidote | evidence-interaction rate; outbound rate |
| **Trust-first eyebrow** ("neutral · evidence · total cost, not commission") | **trust calibration**; the neutrality is a genuine moat | states the ranking rule up front → reduces suspicion of hidden commercial bias | evidence rate; retention |
| **Concrete example chips** | **Recognition over recall**; **paradox of the active user** | a blank box paralyses; tappable real intents show *what to do* and seed good queries | landing→search rate |
| **Honest live stats, kept secondary** | **social proof**, but subordinate to the action | credibility without stealing the focal point (numbers are DB-true, never marketing) | — |
| **Search-first kept as a fair control** | **Jakob's Law** (users expect conventional shopping patterns) | some users prefer to drive; a real control avoids a strawman A/B | full 8-dimension comparison |
| **Mobile-first, ≥44px targets, thumb-reachable input** | **Fitts's Law**; touch-target ergonomics | Saudi traffic is mobile-dominant; large, reachable targets reduce friction | completion on mobile sessions |
| **Removed finance/deal/partner clutter** | **cognitive load theory**; **von Restorff** (isolation) | one salient action is more memorable and actionable than six | landing→search rate |

## 3. The entry experiment (champion vs control, reversible)

The founder's two requirements — *advisor-first by default* **and** *prove it beats search-first* **and**
*change without a redesign* — are satisfied by making the **landing surface a config value, not a
hardcoded design**:

- `src/lib/analytics/variant.ts` assigns each visitor a **stable arm** (persisted → retention is
  measured against a consistent experience). Split = `NEXT_PUBLIC_BETA_ADVISOR_SPLIT` (default 0.5 =
  balanced A/B). Set 1.0 to end on advisor, 0.0 to revert to search-first — **config only**.
- `BetaLanding` records `landing_view` (arm in `meta.variant`) and renders `AdvisorHome` (champion)
  or `SearchHome` (control). Every downstream event carries the arm automatically (via `track()`), so
  the **entire funnel** is comparable per arm.
- `npm run tps:usage` reports the two arms side-by-side across the founder's **8 dimensions**: landing
  engagement, search usage, product views, comparison usage, evidence interaction, outbound clicks,
  session completion, retention — and only calls a winner at ≥50 sessions/arm.

**QA/preview:** append `?variant=advisor` or `?variant=search` to force an arm; `?test=1` keeps that
traffic out of validation.

## 4. Naming & terminology (the founder's explicit question)

- **"Neutral Advisor" / "المستشار المحايد":** keep the **neutrality claim** — it is the genuine,
  defensible differentiator (commission-blind ranking) and directly counters algorithm-aversion. But
  the *label* is a **testable hypothesis**: "advisor/مستشار" can read as formal/financial in Arabic.
  V2 copy leans into a helpful-assistant voice ("قل وش تبي — نرشّح لك الأنسب بالأدلة") while preserving
  the neutrality trust line. If retention/engagement data suggests the "advisor" framing underperforms,
  the copy is a string change, not a rebuild.
- **Surface consolidation:** the homepage LLM chat is retired as a competing hero; the deterministic
  advisor is the single AI entry. This removes the "multiple search surfaces" ambiguity. (`/assistant`
  remains reachable but is no longer promoted; whether to retire it fully is a follow-up once beta
  traffic shows if anyone uses it.)

## 5. Scope & honesty about phasing

**Redesigned and measured now:** the **entry experience** — the highest-leverage first impression and
the literal subject of "advisor-first." Both arms are built, instrumented, and A/B-tested from session
one; a constitutional violation was removed.

**Deliberately evidence-gated (next):** deeper surfaces — product pages, comparison pages, cards,
filters, categories, global navigation. Redesigning these *before* any real-user signal would be
optimizing on assumption, which contradicts the mandate's own success criterion ("measurable
improvement"). The beta's per-dimension data (where users drop, what they don't engage) becomes the
brief for each next redesign. This is *keep improving until evidence supports the best experience* —
done responsibly, not as a big-bang rewrite that risks a working platform.

**Success criterion (unchanged):** measurable improvement in understanding, trust, engagement, and
purchasing decisions — read from `tps:usage`, arm vs arm, as real beta traffic accrues.
