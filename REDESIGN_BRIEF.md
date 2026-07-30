# TAWVEERI — CONSUMER EXPERIENCE REDESIGN (v2)
**Synthesised from four design reviews, three critiques of the first draft, a live site
audit, and production measurements · 2026-07-29**

---

## 0. MANDATE AND AUTHORITY

**Research this brief directly before executing it.** Read the code. Check every claim
against production. Where the evidence contradicts me, follow the evidence.

**If you find a better route to the same outcome, implement it and deploy it. Do not
return to me for permission.** You see the system; I see summaries. You have overridden
me correctly ten times in four days and every one was faster than my path. I would
rather be corrected than followed.

**Bound the research.** Limit external investigation to decisions that materially affect
an identified Tawveeri surface. Do not produce a broad competitor report. Record only
actionable findings and their direct implementation consequence.

**Full authority, with these exceptions — stop and report the exact risk:**
- paid commitments, credentials, billing, domain or DNS changes
- destructive migration or production data rewrite
- any irreversible deployment
- changes to matching logic or the decision engine
- **publishing any claim we have not measured**

**Do the work, not the proposal.** No mockups, no image generation. Code, tested,
deployed, measured.

---

## 0.1 A CORRECTION I OWE THIS DOCUMENT

The first draft of this brief cited: *"71% of AI product abandonment is caused by
interface and interaction design failures, not the model."*

**I traced that figure to a design agency's marketing blog. It is not a study, and I
published it without a source — inside a document whose §1 exists to stop exactly that.**

Worse: one of the three reviewers repeated it back to me as established fact.
**That is precisely how `+٦٢,٠٠٠ فرصة توفير` reached our homepage.**

The number is removed. What remains, stated honestly:

> A substantial share of AI-product failure comes from interaction design, unclear
> capability boundaries, and poor recovery paths — not from model quality alone.

**Apply this test to every number in this brief, including mine.**

---

## 1. 🔴 VERIFY THAT THE HOMEPAGE TRUTH FIXES REMAIN CLOSED

The homepage previously published three unevidenced figures:
`+٨٥,٠٠٠ منتج مقارن` · `٨ متجر موثوق` · `+٦٢,٠٠٠ فرصة توفير`.

**These figures were removed before this redesign began.**

Verify from current production that they remain absent, and do not reintroduce any
replacement figure unless it has a documented, stable and reproducible definition.

**None of the four design reviewers caught the original problem**, because none fetched
the live HTML. That is the lesson to carry forward, not the defect itself.

### 1.1 Before anything: `docs/DATA-AVAILABILITY-AUDIT.md`
Do not assume the data exists to replace these figures. Establish first:
- which fields actually exist — observation dates, store depth, verification state
- what is missing
- what can be honestly derived
- what cannot be claimed at all

### 1.2 Then produce `docs/HOMEPAGE-CLAIMS-AUDIT.md`

| Current figure | Actual source (query/function) | Honest replacement | Justification |
|---|---|---|---|
| +٨٥,٠٠٠ منتج | ? | ? | ? |
| ٨ متجر موثوق | ? | ? | ? |
| +٦٢,٠٠٠ فرصة | ? | ? | ? |

### 1.3 The naming rule — a technically correct query can still lie
- observations are **not** products
- offers examined are **not** offers available
- canonical products are **not** comparable products
- a technically connected retailer is **not** a retailer with coverage

Every public figure needs a **documented, stable, reproducible definition** — not just a
live query.

### 1.4 Absolute rule
**Never hardcode a number in JSX. Every figure derives from a live query with a
documented definition, or it does not appear.**

---

## 2. MY MEASUREMENTS ARE HYPOTHESES — reproduce them

Figures I have quoted — ~5,543 served products · ~489 comparable · 340 verified drops ·
10,302 examinable offers · ~88% unobserved-price share · a ~17.6% journey gate — are
**founder-supplied measurements taken from terminal output across several days.**

**Reproduce each from production before using it.** Document the query and timestamp.
Report any discrepancy. **Do not preserve a number merely because it appears in this
brief.**

### 2.1 Replace "4.5 stores" with explicit tiers
A fractional store count is not a metric. Define retailer status as:

- **production-deep** — sufficient depth, fresh prices, valid outbound links
- **production-limited** — real data, narrow category or depth
- **connected, not consumer-ready** — ingestion works, surface quality does not
- **inactive or broken**

**Only production-deep retailers appear in consumer-facing counts.** Publish the tier
definition alongside the number.

---

## 3. OTHER DEFECTS CONFIRMED LIVE

- `/ar/search?category=camera` → **٠ نتيجة**. A category with no products must not render
- Two separate sort controls on the search page doing the same job
- Store filter lists 6–8 retailers while far fewer have real depth
- Footer social links for Instagram, LinkedIn and YouTube are placeholder `#`
- **Brand collision:** `tawfeery.com`, `tawfeerly.com`, `twfere.com` all rank for our
  name. Assess the SEO and trust impact — reviewers flagged this may matter more than
  expected
- **`waffer.sa`** — a Saudi competitor comparing Noon, Amazon, Jarir and Extra that we
  did not know existed

### 3.1 Competitor work is bounded
For each of `waffer.sa`, Rakhys, Pricena and one global reference, capture **only**:
primary promise · first-screen structure · search entry pattern · product-versus-offer
distinction · price-evidence treatment · AI presence · trust disclosures ·
**one practice to adopt or explicitly reject.**

**Maximum two pages total.** Not a report — a decision.

---

## 4. ADOPT — the strongest ideas from the reviews

**Separate the advisor from the agent.** The single best idea across all four reviews:

> **وفّر — مستشارك للشراء.** Understands the need, explains, compares, recommends.
> **وكيل توفيري — ينفّذ ويتابع.** Watches price, stock, new retailers, and notifies.

Two products, two promises. Today they blur into one bubble.

**Also adopt:**
- Research and select the clearest Arabic-first hero question, with **one** large search
  field. `وش تدور عليه اليوم؟` is a candidate, not a mandated string
- Two explicit paths: `ابحث بنفسي` / `خل وفر يساعدني`
- وفّر present at hero · results · product · comparison · zero-results, each with
  **contextual suggested prompts** — never an empty box
- Product card: canonical name · 3–5 critical specs · best verified price · store count ·
  savings · **last observed time, rendered only from a real production observation
  timestamp** · availability · compare · ask-وفّر
- `أفضل سعر: 3,199 · متوفر في 4 متاجر · توفّر حتى 420 · تم التحقق قبل 32 دقيقة`
  instead of `من 3,199`

  **This wording is illustrative only.** Use wording permitted by
  `LAUNCH_VOCABULARY.md` and render it only when a verified production timestamp
  exists. **No data, no line.** Never estimate, default, or render "unknown".
- Product page in layers: identity → وفّر verdict → best offer **with a stated reason** →
  all offers → price history where supported → alternatives → evidence
- Comparison in two stages: quick verdict, then the spec table
- Design tokens instead of hardcoded values
- Mobile-first, bottom navigation of five items maximum, filters in a bottom sheet
  showing the result count before applying
- WCAG 2.2 AA, practical 44×44 targets
- **Never publish a UI richer than the data behind it**

---

## 5. REJECT — each with the measurement that disproves it

**FOMO and scarcity** — `بقي ٢ فقط`, urgency counters. It is the pattern we exist to
oppose, and our stock signal is measurably unreliable: `inStockFlag` reported
out-of-stock in every city for a product that renders as purchasable. We would be
inventing urgency on data we do not trust.

**"Increase store count immediately, match Pricena"** — measured: breadth without
overlap produces nothing. Sonyworld contributed **zero** shared families; alnakheelk 68,
najm 48. **Predicted overlap is the onboarding criterion, not count.**

**A logged-in dashboard as the centrepiece** — almost no logged-in users, and the public
journey is not yet healthy. Watch and alerts belong to the agent, and the agent ships
when the backend supports it.

**A floating AI chat bubble** — وفّر gets a panel or bottom sheet with contextual
prompts. Conversation is for open-ended intent; a form or filter is faster for a known,
finite choice set. A chat wrapper around three options is worse UX, not better.

**Price-history charts as a universal element** — our tracking window is short and we
hold few verified drops. **A chart over 14 days implies a history we do not have.** Show
history only where data supports it; elsewhere state `لا توجد بيانات كافية للحكم`.

**This fallback applies to price-history judgement only. It must never replace a
missing observation timestamp** — a missing timestamp means the line does not render
at all.

**Invented forecast metrics** — one review predicted "trust 3.2/5 → 4.1/5" and
"conversion 17.6% → 25–30%". Those numbers have no source, and the second conflates the
journey gate with a conversion rate. **Do not import them.**

---

## 6. THE DESIGN PRINCIPLE

Every comparison platform leads with breadth. **We cannot win breadth and should not
try.**

**Our intended differentiator is evidence-grounded saving rather than merchant-claimed
saving** — we publish a smaller saving than the merchant, because ours is observed.

**Verify how defensible and understandable this distinction is before publishing it.**
We do not hold evidence that no competitor could make the same claim, only that we can
support ours.

> **Prove, then explain. Never explain, then ask to be believed.**

### 6.1 The proof module must be dynamic — never hardcoded
A fixed hero product goes stale: the offer ends, the price moves, stock runs out, the
card rots, and the homepage becomes an advertisement for one product.

**Select it dynamically from currently qualifying evidence.** Qualification criteria:
- two or more retailers
- sufficient observation window
- fresh price
- valid outbound link
- an actually observed higher price — never a merchant-claimed one
- no identity conflict

**If nothing qualifies, the module falls back to a neutral evidence explainer or
disappears.** It must never render stale.

---

## 7. STRUCTURE

```
1  HERO — a researched Arabic-first question, not a mandated string.
   ONE large field accepting product name · model · plain need.
   Two labelled paths: ابحث بنفسي | خل وفر يساعدني
   Rotating example prompts (already live, and correct practice).

2  THE PROOF — dynamically selected, above the fold, per §6.1

3  CATEGORIES — only those with proven production coverage. No dead filters.

4  عروض موثّقة — verified only, real products, evidence line on each. See §7.1.

5  HOW WE VERIFY — after the proof. Honest statistics with stable definitions.

6  RETAILERS — production-deep only, with real depth shown.
```

**One doorway per function.** Search once. وفّر once. No duplicate sort controls.

### 7.1 Ranking — not absolute saving alone
Absolute saving alone lets expensive products dominate: 2,000 SAR off a 20,000 SAR TV
outranks 700 SAR off a 2,500 SAR phone, though the second matters more to more people.
Percentage alone produces accessory theatre.

**Build an explainable deal score** from verified absolute saving · relative saving ·
freshness · observation-window sufficiency · identity confidence · availability ·
retailer depth. **Absolute saving may be the visible figure; it must not be the sole
ranking factor.** The reason a deal ranks must be stateable in one sentence.

### 7.2 Unknown cost is never zero
Shipping, installation, coupon eligibility and regional availability are often unknown.
**Never treat an unknown component as zero.** If any is missing, label the total
**incomplete** and do not rank it above a fully comparable total without an explicit
explanation on the card.

### 7.3 Voice, camera and barcode
These may appear **only if end-to-end functionality already exists and passes production
testing.** Otherwise exclude them entirely — **do not render disabled or "coming soon"
controls.** My earlier draft called for them as first-class buttons; that contradicted
§1 and I was wrong.

---

## 8. وفّر — THE ADVISOR

- **Hybrid, never pure chat.** The answer is a **card**: product · verified price ·
  store · why it fits · evidence line · one clear action
- **Two sentences of reasoning, maximum.** The founder's verdict on the current agent
  was `كثير ومشتته`
- **Parse what the user already said.** `ابي مكيف رخيص لغرفه ٤٠ متر` contains the area.
  Asking for it again is the most damaging failure a shopping assistant can make, and it
  happens today
- **Structured follow-ups as buttons** when the choice set is finite
- **Contextual prompts per surface.** Never an empty box
- **Confidence in plain language, or not at all.** `74/100` means nothing to a shopper
- **No recommendation without data.** Where we do not cover a category, say so honestly
  and offer to search directly rather than returning an empty result
- **Explicit fallback** — hand off to search with the query pre-filled. Never a dead end
- **Distinguish fact from inference from recommendation.** Never invent a spec
- **No login before first value**

## 9. وكيل توفيري — THE AGENT

A separate layer, separate promise: watch price · notify on stock return · notify when a
new retailer carries it · notify below a threshold.

**Build the contract and the component. Ship nothing to the public that the backend does
not already support.** Label it distinctly from وفّر.

---

## 10. DESIGN SYSTEM

Real tokens — semantic colours, typography, spacing, radius, shadows, breakpoints,
motion, focus and disabled states. No repeated hardcoded values.

Identity: modern Saudi, calm, trustworthy, uncrowded. Not a copy of Amazon, Noon or
Temu. Not a neon AI dashboard. Not glassmorphism-heavy. No gradients without reason. No
cards inside cards.

Colour discipline: one strong primary · **green only where a saving is verified, never
decorative** · red for warning or price increase, never ornament · a distinct colour for
verification and freshness.

Product images dominant. Price legible. Freshness quiet but visible. One icon library.
Keep the existing logo unless there is a concrete usability problem. Arabic-first
typography.

---

## 11. ACCESSIBILITY, PERFORMANCE, SEO

WCAG 2.2 AA: contrast · keyboard navigation · visible focus · skip link · semantic
headings · accessible dialogs and sheets · focus trapping · screen-reader labels ·
reduced motion · RTL focus order · text alternatives for charts · no colour-only meaning
· 200% zoom · practical 44×44 targets.

Performance: Server Components by default. Watch LCP, CLS, INP, image and font loading,
bundle size, duplicate API calls, search debouncing. The redesign must not slow the site.

SEO: preserve metadata, alternates, canonicals, breadcrumb and product structured data —
**offer structured data only for real offers.** No thin programmatic pages.

---

## 12. THE ACCEPTANCE TEST

**Build the homepage-start journey harness first.** NOT REACHED for three sessions, and
the only way to know whether any of this helped.

Landing → find the input → search or ask → result → compare → correct product at the
correct retailer.

For 20 real Saudi shopper queries in both languages, measure: taps to a correct product
page · store name visible at every step · card price matches compare-page price ·
outbound link lands on the exact product · dead ends.

**Baseline before. Re-measure after. Report the delta every time.**

You predicted the gate falls into the 50–70% band once the homepage leg is included.
**Say so again when it happens.** A number that falls because we started measuring
honestly is progress.

---

## 13. PHASES AND GATES

**Phase A and the §1 truth fixes are mandatory now.**

**Phases B–E proceed only where they improve or expose E15.5 evidence.** Any redesign
item requiring new backend capability, new identity logic, new retailer ingestion, or
unsupported data is **recorded as deferred, not implemented.** This redesign must not
become an undeclared E16.

- **A — Foundation:** audits · tokens · typography · layout primitives · accessibility
  foundations · shared states · header and mobile navigation
- **B — Discovery:** homepage · single search input · categories · results · filters ·
  product cards · zero-results
- **C — Decision:** product page · offers · price history where supported · alternatives
  · comparison · evidence
- **D — AI:** وفّر entry points · contextual prompts · panel · grounded cards · error
  states · agent separation
- **E — Quality:** RTL/LTR · mobile QA · accessibility · performance · SEO · analytics ·
  tests · production build

Keep the build green between each.

### 13.1 Deployment discipline — corrected
My earlier instruction to "deploy each change" was wrong. It multiplies deployments,
risks shipping incomplete journeys, and makes the stable version unclear.

**Commit in small reversible units. Deploy only at coherent, tested checkpoints.**
Never deploy an incomplete user journey. Every production deployment requires: a
verified build · smoke test · rollback reference · post-deploy journey check.

---

## 14. SCOPE LIMITS

E15.5 remains active — do not declare it complete, do not open E16. Do not surface
categories, retailers, offers or features that production data does not support. Do not
fabricate price history, ratings or savings. Do not build checkout. Do not fill the
interface with "coming soon."

**Unknown beats incorrect. Precision over recall. No claim without evidence.**

### 14.1 DO NOT BREAK WHAT ALREADY EARNS
The Amazon affiliate tag `tawveeri-21` is **live and working**, and it is currently our
only revenue mechanism.

If this redesign touches outbound links, the exit layer, or any component that builds a
retailer URL, **the affiliate tag and click tracking must survive unchanged.** Verify a
real outbound URL still carries the tag after any such change, and report it.

A link that opens correctly but has lost its tag looks perfectly healthy and earns
nothing — exactly the class of silent failure this project has already found three
times.

**This is a technical preservation requirement, not a copy instruction.** Say nothing
publicly about commission, affiliate relationships or ranking policy in this work.
Revenue-model disclosure belongs in its own document, written from the live
implementation, not from a plan.

---

## 15. WHAT SUCCESS MEANS

Not that it looks better:

- a user understands what Tawveeri does within seconds
- one obvious input, and immediate access to search or وفّر
- product identity clear; product, offer and retailer distinguishable
- the user knows **why** an offer was called best
- the user sees when the price was last checked
- وفّر and the agent are never confused
- **no unevidenced claim appears anywhere**
- mobile works
- outbound links, tracking and data intact
- production build passes
- **and the journey harness number improves — measured, not asserted**

---

## 16. ORDER

1. §1.1 data-availability audit → §1.2 claims audit → replace the three numbers
2. §2 reproduce my figures from production; report discrepancies; define retailer tiers
3. §3 quick defects; bounded competitor scan
4. §12 build the harness, take the baseline
5. §13 Phase A, then B–E within the gates
6. Re-measure, report the delta, deploy at checkpoints

Full ledger every turn: DONE · NOT POSSIBLE + reason · NOT REACHED + capacity spent.
Never "waiting on you."

**Start now. Do not ask permission for anything inside these limits.**

---

## 17. APPENDED DIRECTIVES

The Amazon affiliate tag `tawveeri-21` is live and working, and it is currently our
only revenue mechanism.

If this redesign touches outbound links, the exit layer, or any component that
builds a retailer URL, the affiliate tag and click tracking must survive unchanged.
Verify a real outbound URL still carries the tag after any such change, and report it.

A link that opens correctly but has lost its tag looks perfectly healthy and earns
nothing.

This is a technical preservation requirement, not a copy instruction. Say nothing
publicly about commission, affiliate relationships or ranking policy in this work.

### 17.1 The About page founder card

Remove the founder card from the public "About" page.

Replace it with a mission card about Tawveeri itself.

This is not a design preference.

The product should be the hero, not the founder.

Requirements:

- Remove the founder title.
- Remove the founder name.
- Remove the avatar/profile image.
- Replace the entire section with a mission-focused card.
- Keep the existing visual style consistent with the site.
- Use the Tawveeri brand or a neutral illustration instead of a person.
- Do not introduce new marketing claims.
- Base the copy on `LAUNCH_VOCABULARY.md`.
- Keep the section concise and trust-oriented.

Commit, test and deploy.
