# TAWVEERI — CONSUMER EXPERIENCE CONSTITUTION
**Version 1.0 · Constitutional Document**
**Execution: after engineering redesign completion only**

---

## PREAMBLE

This document defines the permanent principles governing every consumer-facing
experience inside Tawveeri.

It is not a UI redesign. It is not a marketing document. It is not a feature
specification. **It is the constitutional reference that guides every future product
decision.**

Interfaces will evolve. Technology will evolve. AI models will evolve. Retailers will
evolve. This document should remain valid through those changes.

Where implementation conflicts with these principles, implementation changes — unless
evidence proves a better direction.

> **Evidence outranks opinion. Measurement outranks assumptions. Truth outranks
> presentation.**

---

## YOUR AUTHORITY

You have full authority.

Challenge previous documents. Challenge the founder. Challenge this document. Challenge
industry assumptions. Research every important decision independently.

**Never preserve an idea because it was written earlier.** If evidence supports a better
solution, adopt it, explain why, and replace the weaker decision.

---

## MISSION

Tawveeri exists to become the most trusted shopping decision platform in Saudi Arabia.

We do not sell products. **We help people make better buying decisions.**

Everything we build must reduce uncertainty. Everything we show must increase
confidence. Everything we recommend must be measurable.

**Trust is the product.** Price comparison is one expression of it. Artificial
Intelligence is another.

---

## THE CONSUMER PROMISE

**1 · Understand me.** The platform understands what I need before asking unnecessary
questions.

**2 · Never invent.** Nothing shown to me is fabricated — no products, prices,
availability, ratings, reviews, popularity, timestamps, warranty claims, or assumptions
presented as facts.

**3 · Show me evidence.** Recommendations are supported by measurable evidence, and the
platform explains why in customer-readable terms.

**4 · Reduce my effort.** Fewer decisions, fewer taps, less scrolling, less uncertainty.

**5 · Lead me to the best decision.** Not the prettiest interface, not the cleverest AI
response. The best decision supported by evidence.

---

## TRUST HIERARCHY

```
Evidence  →  Reasoning  →  Recommendation  →  Presentation
```

**Never reverse this order.** If presentation requires weakening evidence, presentation
loses.

---

# FOUNDATIONAL PRINCIPLES

## Principle 1 — Truth Before Convenience
Never make the interface appear more capable than the platform is. **If the data does
not exist, the feature does not exist.** If the evidence cannot be measured, the claim
cannot be shown.

## Principle 2 — Unknown Beats Incorrect
When certainty is unavailable, honest uncertainty is preferred over confident error.
The platform never guesses to avoid saying "we don't know."

## Principle 3 — Every Action Must Be Real
Every visible action must complete successfully. Never display:
- Compare without a comparison
- Buy without a destination
- Retailer without a verified offer
- Price without evidence
- AI recommendation without measurable support

**Dead ends permanently damage trust.**

## Principle 4 — Data Before Design
Every customer feature passes one gate: **do we possess this data · can we measure it ·
can we maintain it · can we verify it · can we explain it?**

If any answer is no, the feature is postponed. **The interface never outruns the
platform.**

## Principle 5 — Measured Reality Wins
Internal assumptions, manual testing, development environments and visual inspection
never override measured production behaviour.

**And measured production behaviour means what the server sends, not only what the
browser renders.** A claim present in served HTML is a claim, even when JavaScript
replaces it — search engines, social previews and AI assistants read the served
version.

## Principle 6 — Small Reversible Progress
Every improvement independently deployable. Every deployment measurable and reversible.
**Large irreversible redesigns are forbidden.**

## Principle 7 — Every Price Has Provenance
**Every price shown to a customer must be traceable to a specific observation we
recorded.**

Not "we believe it is accurate." Traceable — to a row, a timestamp, a source.

A price without provenance may be correct, but it is unprovable. **On a platform whose
promise is evidence, an unprovable price is the same failure as a false one.** Where
provenance is missing, the price is not published on a trust surface.

> **Clarification, ratified 2026-07-31:** *the layer at which the record lives is an
> implementation detail; what matters is that the evidence exists and can be produced on
> request.*
>
> **Applied ruling.** The 2,321 canonicals lacking a *normalized* observation are **not** a
> constitutional violation. Measured: `raw_url`, `payload`, `parser_version` and a timestamp
> are present on **100% of the 103,106 discovery observations**, so we can show a customer
> where a price came from and when. The normalized layer is a *processing* artefact, not an
> *evidence* artefact. The diagnosis in `docs/FRESHNESS-PROVENANCE-GAP.md` is closed.
>
> **F2 binds independently and is a separate test.** Evidence existing *somewhere* does not
> license a claim *here*: if the true observation timestamp cannot be resolved at the point of
> display, the line does not render there. Principle 7 governs whether the evidence exists;
> F2 governs whether it may be shown. Both must pass.

## Principle 8 — Commercial Neutrality
Tawveeri earns from affiliate arrangements. **No commercial relationship may influence
what is recommended, how results are ordered, or which retailer is shown as best.**

If the best evidenced option is a retailer that pays nothing, that option is shown
first.

Revenue mechanisms are preserved as technical infrastructure and disclosed when
required. **They never enter the ranking logic.** This principle is not negotiable at
any scale of revenue.

---

# AI PHILOSOPHY

Artificial Intelligence is not the product. **It is how the product reasons.**

Customers come to Tawveeri to make buying decisions, not to chat with an AI. The AI
exists only to reduce uncertainty and improve those decisions.

**Whenever AI increases complexity instead of reducing it, AI has failed.**

## AI Exists To Reason
AI should understand · clarify · compare · explain · recommend.

**Never impress. Never generate content for its own sake.** Every response should move
the customer closer to a measurable buying decision.

Warmth is permitted where it aids comprehension. **Personality must never overshadow
explanation** — current research is consistent that explanation is what builds trust,
and that unclear capability boundaries are a leading cause of AI-product abandonment.

## AI Must Be Honest
Every recommendation originates from Tawveeri's verified catalogue.

AI must never invent: products · prices · availability · retailers · coverage · ratings
· popularity · reviews · sales volume · warranty · energy consumption · specifications
absent from the catalogue · observation timestamps · future expectations.

**Recommendations must be reproducible.** The same evidence produces the same
recommendation. If a recommendation changes, evidence changed — not behaviour.

**AI must never be the authoritative source of product facts. Whenever structured
evidence and generated text disagree, structured evidence always wins.** (See Appendix
F7 — the generative surface.)

## Explain The Recommendation
Every recommendation answers one question: **why this?**

**Expose evidence, never implementation.** Not prompts, not model output, not internal
confidence scores. Customer-readable evidence:

> Lowest verified price · Available from five retailers · Matches your requested storage
> · Fits your stated budget · Suits your room size · Observed yesterday

**The explanation should increase confidence, not expose complexity.**

## Reduce Uncertainty
The purpose of AI is not answering questions. **It is reducing uncertainty.**

Every clarification question must change the recommendation. Questions that do not
improve confidence are never asked. **If the shopper already provided information, the
assistant never asks for it again.**

---

# UNIFIED SEARCH

**There is only one entry point.**

Customers never choose between search · AI search · assistant · chat · recommendation ·
comparison. **There is one search experience.** The system determines internally which
capabilities are required.

### Accepted input
Product names · natural language · needs · budgets · comparison requests · incomplete
thoughts · usage scenarios · problem descriptions · mixed Arabic and English ·
recoverable typing errors.

**The customer should never have to learn how to search. The system learns how customers
think.**

### Intelligent routing
Routing is determined by the query, **never by the customer.**

- Exact product queries may go directly to comparison
- Need-based queries may invoke reasoning
- Comparison requests may generate structured comparisons
- Ambiguous requests may ask **one** clarification question

**The customer never decides the workflow. The platform does.**

> ⚠️ **Conflict to resolve explicitly:** `REDESIGN_BRIEF.md` §7 proposes two labelled
> paths — «ابحث بنفسي / خل وفر يساعدني». **This Constitution supersedes that.** One
> entry point; the system routes. Do not implement both. If evidence supports the two-path
> model, bring it with the evidence and amend this document — do not silently keep both.

### Migration status and hard condition — recorded 2026-07-31

**This is a migration of shipped behaviour, not a greenfield decision.** `/advisor` and search
are two live entry points today, and the AI disclosure (Appendix F7, `LAUNCH_VOCABULARY` §8)
currently sits on the `/advisor` surface.

- It is **its own reversible unit**, measured before and after with the journey harness.
- It **does not begin until Phase 2 sequencing places it there.**

> **HARD CONDITION — the AI disclosure must survive the move.** If `/advisor` is absorbed into a
> unified entry point, the disclosure **relocates with it. It never disappears in the refactor.**
>
> **This is the F5 failure class applied to a trust element rather than to revenue:** a trust
> element silently lost in a restructure, where nothing breaks, no test fails, and no error
> surfaces. Verify the disclosure is present on the unified surface **in production** after the
> migration, exactly as an affiliate tag is verified after an exit-layer change.

### One experience
Search retrieves. AI reasons. Comparison validates. Together they are one experience.

The customer should feel only one thing:

> *"I described what I needed. Tawveeri understood me. Then it showed me the best
> verified options."*

---

# RESULTS EXPERIENCE

**Purpose:** help the customer reach the best measurable buying decision with the least
possible effort.

Not to maximise page views. Not to maximise clicks. Not to display the largest
catalogue. **To reduce decision fatigue while preserving confidence.**

### Results must match intent
There is no fixed rule such as "always show three" or "always show the full catalogue."

The platform determines which presentation serves the intent:
- Exact product queries may prioritise direct comparison
- Need-based queries may present a small, high-confidence set before the wider catalogue
- Broad exploratory searches may surface categories before products

**The interface adapts to the goal, not the reverse.**

### Comparison is Tawveeri's signature
Comparison is not a feature. **It is the identity.**

Every comparison immediately answers: where is the lowest verified price · how much can
be saved · which retailers currently offer this · how recently was it verified.

**The customer should never inspect multiple pages to answer these.**

### Every recommendation must be actionable
Never recommend what cannot be compared. Never compare what cannot be verified. Never
display an action that cannot be completed.

**Confidence comes from reliability, not quantity.**

### Information consistency
Products displayed together should expose a consistent level of measurable information.

Research shows customers **dismiss items that do not display the same attributes as
their neighbours** — excluding relevant products simply because an attribute is absent.

**The solution is never to fabricate the missing attribute.** Communicate only what is
verified, while maintaining visual consistency, so that absence reads as neutral rather
than as inferiority.

### Merge variations
Colour and minor variants of the same product occupy **one** list item, not several.
Splitting them fragments comparison and inflates the catalogue without adding value.

---

# THE AI ASSISTANT — وفّر

The assistant represents Tawveeri's intelligence. It is not a separate destination. It
is not a chatbot competing with search. **It is the reasoning layer behind the shopping
experience.**

### Discoverable, never distracting
The assistant must always be discoverable and must never compete with the primary search
experience. **Its location may evolve as evidence evolves. Its discoverability must
not.**

### AI disclosure
**Customers must always understand when they are interacting with Artificial
Intelligence.**

Disclosure must be clear, simple, human, and **visible at the moment of interaction** —
not in a footer, not in terms.

**Trust increases when capabilities are communicated honestly. Trust decreases when
intelligence is disguised.**

*Regulatory note: EU AI Act Article 50 becomes applicable on 2 August 2026 and requires
people to be informed when interacting with certain AI systems, subject to the scope and
exceptions in the Regulation. Tawveeri serves Saudi customers, so this is not primarily
a compliance matter — but clear disclosure remains the correct durable trust standard
regardless of jurisdiction. Verify the current legal text before relying on it.*

**The name وفّر communicates the outcome rather than the technology, which is correct.
The name is not the disclosure. The label is.**

### Explain recommendations
Recommendations explain themselves — with measurable evidence, never with internal
reasoning, hidden prompts, or model output.

**Evidence builds confidence. Confidence builds trust.**

---

# MOBILE FIRST

Assume the customer is on a mobile device.

Reduce scrolling · typing · taps · waiting · visual noise · unnecessary choices.

**The interface should disappear behind the decision.** The customer should remember the
outcome, not the interaction.

---

# MEASUREMENT

Every product decision must be measurable. Every interface improvement validated. Every
AI behaviour evaluated.

**Opinion never closes a decision. Measurement does.**

Before every major change: measure the current experience · deploy the smallest
meaningful improvement · measure again. **If customer outcomes do not improve, the
change did not succeed.**

### What is measured today
The journey harness is the current instrument: landing → search → correct product →
correct retailer → working outbound link. Reported separately for Arabic and English.

**This is the only customer-outcome measurement Tawveeri currently possesses.**

### An honest gap
This Constitution names trust as the highest metric. **Trust is not measured today.**

Until behavioural data exists, "trust" is a direction, not a number, and must not be
cited as evidence for any decision. Naming this openly is itself an application of
Principle 2.

**Establishing a customer-outcome measurement beyond the harness is the first
measurement obligation after launch.**

### Instruments are suspect until proven
**Prove the instrument before believing a number that would change a priority.**

This project has caught multiple instrument defects — a harness reporting 87.5% that was
17.6%, a gate at 100% while the founder's own query returned one store, a metric
structurally unable to see outside its own registry, a throughput figure measuring
network latency rather than system capacity, and encoding corruption that made correct
Arabic search look broken.

**A number that agrees with us deserves more scrutiny, not less. A number that moves
because the method moved is not progress.**

---

# KNOWN FAILURE CLASSES

These have occurred. They are documented so they are recognised rather than
rediscovered.

| Class | Signature | Response |
|---|---|---|
| **Silent failure** | A path returns nothing with no recorded reason | Every attempt terminates in an explicit state |
| **Instrument flattery** | A metric improves without an identified cause | Decompose before believing |
| **Registry blindness** | A metric cannot see what is outside its own list | Any metric iterating a registry measures the registry, not reality |
| **Definition drift** | The same word means two things in two contexts | One definition, one owner, resolved in writing |
| **Rendered ≠ served** | Verified in the browser, still wrong on the wire | Verify from the server response |
| **Environment gap** | Verified in development, broken in production | A fix verified only in dev is unverified |
| **Sampling bias** | Measuring the top of a ranked list oversamples quality | Sample evenly across the population |
| **Provenance loss** | A price exists with no traceable observation | Principle 7. Do not publish it on a trust surface |
| **Evidence generated but not propagated** | Evidence is written correctly, but the identifier proving it is discarded by a higher layer. Nothing errors; the nullable FK is simply never populated | Return the identifier. See `docs/ENGINEERING-RULES.md` Rule 1 |
| **Trust element lost in a restructure** | A disclosure, attribution or evidence line disappears during a refactor. Nothing breaks, no test fails | Verify the element in production after the change, as F5 requires for attribution |

**A failure that produces a new verified rule is a successful failure.**

---

# IMPLEMENTATION PRINCIPLES

Implementation follows the Constitution. Never the reverse.

Every change: small · reversible · measurable · testable · independently deployable.

Every deployment: production verification · journey validation · rollback strategy ·
measurement before and after.

**Engineering discipline protects customer trust.**

---

# REQUIRED DELIVERABLES

1. **`CONSUMER_EXPERIENCE_CONSTITUTION.md`** — this document, as the permanent reference
2. **`DATA_AVAILABILITY_AUDIT.md`** — every customer-facing feature mapped against real
   production data, with unsupported features named explicitly. Never hide a limitation
3. **`UX_DECISION_RECORD.md`** — every significant decision: evidence, alternatives,
   trade-offs, reason for acceptance, reason for rejection
4. **`IMPLEMENTATION_ROADMAP.md`** — prioritised by customer value, not engineering
   convenience. Each phase delivers measurable customer benefit
5. **`EXECUTION_PLAN.md`** — small, reversible, production-safe iterations, each ending
   in production verification and measurable success criteria

> **Status, 2026-07-31.** (1) exists — this file. (2) exists as
> `docs/DATA-AVAILABILITY-AUDIT.md` (hyphenated, created under the launch brief); it maps
> production data availability but has not been re-scoped to *every* customer-facing feature.
> (3), (4) and (5) **do not exist**. `docs/DECISIONS.md` holds engineering ADRs, not UX decision
> records. Creating them is Phase 2 work, not done here.

---

# APPENDIX A — NON-NEGOTIABLE RULES

**Customer trust is the highest product metric.** Every feature either strengthens or
weakens it. There is no neutral outcome.

**Evidence before opinion.** Internal discussion does not determine direction. Evidence,
customer behaviour and production measurement do.

**Data before features.** No feature without measurable data. No claim without evidence.
No recommendation without verification.

**Understanding before automation.** Automation without understanding creates friction.
AI exists to improve decisions, not to automate poor ones.

**Honest limitations.** When Tawveeri cannot answer confidently, it says so. Customers
respect transparent limitations. They rarely forgive confident mistakes.

**Commercial neutrality.** No revenue relationship influences ranking or
recommendation — at any scale.

**Continuous improvement.** The Constitution is stable; implementation is not. The
Constitution evolves only when evidence demonstrates a stronger principle.

---

# APPENDIX B — DECISION TESTS

Every proposed customer-facing feature passes all of these:

**Trust test** — will this increase customer trust? If not, reject.

**Evidence test** — can every claim be supported by measurable evidence? If not, reject.

**Simplicity test** — does this reduce customer effort or increase it? If it adds
unnecessary effort, reject.

**Reproducibility test** — would the same verified catalogue produce the same
recommendation? If not, identify why.

**Data availability test** — do we possess the data, can we maintain it, can we verify
it? If not, defer.

**Provenance test** — can every price and claim be traced to a recorded observation? If
not, it does not appear on a trust surface.

**Longevity test** — will this principle still hold if the interface changes completely
in five years? If not, it belongs in the roadmap, not the Constitution.

---

# APPENDIX C — SUCCESS DEFINITION

Tawveeri succeeds when customers consistently feel:

> "I did not have to become an expert before buying."
> "The platform understood what I needed."
> "It explained its recommendation clearly."
> "I trusted the information."
> "I made a better buying decision."

---

# APPENDIX D — THE TAWVEERI IDENTITY

If another company removed the logo from the interface, customers should still recognise
the experience as Tawveeri.

**Tawveeri always:**
- Understands before recommending
- Measures before claiming
- Compares before persuading
- Explains before asking the customer to act
- Prefers honesty over completeness
- Prefers trust over engagement
- Prefers evidence over marketing
- Prefers long-term credibility over short-term growth

The customer should never leave thinking: *"the AI sounded intelligent."*

The customer should leave thinking: **"I trust the decision I just made."**

---

# APPENDIX F — PROTECTED TRUST POLICIES

## Why this appendix exists

`YOUR AUTHORITY` invites you to challenge every previous document, including this one.
That invitation is correct and it stands for design, sequencing, structure, wording, and
technical approach.

**A small number of decisions are different in kind.** They are not preferences, not
founder taste, and not inherited habit. Each was established by production measurement
or by a customer-facing failure that actually occurred, and each is now part of what
Tawveeri *is* rather than how it currently looks.

**These are trust policies.** They are protected not because someone senior wrote them,
but because evidence produced them — and because their reversal is silent. Nothing
breaks, no test fails, no error appears. The platform simply resumes making a claim it
cannot support.

**This appendix states principles, never implementation.** Where a current implementation
is named, it is named parenthetically as today's instance, so the policy outlives the
code that currently satisfies it.

---

## The amendment rule for this appendix

A protected policy may be changed. It may not be changed silently.

**If measured evidence appears to contradict one of these policies:**

1. Document the evidence, with its query and timestamp
2. Explain the trade-off in customer terms — what improves, what is put at risk
3. Propose the replacement policy
4. **Request founder approval before changing it**

This preserves both principles the Constitution holds at once: agents decide
autonomously on implementation, and the trust boundaries of the product do not move
without a decision.

**Everything not listed here remains fully open to challenge, research, re-ordering and
replacement.**

---

## The policies

### F1 — Claim boundaries are evidence, not style
The approved claim vocabulary defines what production can currently support. Its
permitted and prohibited lists are evidence boundaries.

**No research finding makes an unsupported claim acceptable.** If a phrase is needed and
absent, propose it with its evidence and amend the vocabulary first. Never invent
customer-facing wording.

This is Principle 1 applied to language.

*(Current implementation: `docs/LAUNCH_VOCABULARY.md`, CAN SAY / MUST NOT SAY.)*

*Origin: three homepage figures published against measured values roughly an order of
magnitude smaller — and in one case more than a hundredfold.*

### F2 — No observation timestamp without a verified value
An observation date renders only from a verified production timestamp. Where none
exists, **the line does not render.** Never estimate, never default, never display
"unknown."

*Origin: a stored timestamp displaying "observed 7 days ago" for a price whose true
observation was 25 days old. Eighteen days of error, live, on the platform's central
claim.*

### F3 — Never render an action the system cannot complete
This restates Principle 3 with the specific case that produced it: **a comparison action
must never appear where the comparison cannot be delivered.**

*Origin: the first defect found by hand — a card stating availability across four
retailers whose comparison page reported that no multi-retailer comparison existed.*

### F4 — Search ordering and deal ranking are different rules
The results experience correctly rejects any fixed rule such as "always show three." It
does not settle ordering, and ordering is settled here.

**Search results present the cheapest comparable total first, with the ordering rule
stated in one readable line on the page.** An incomplete total never outranks a complete
one without explicit explanation.

**A weighted deal score governs the deals surface only**, where absolute saving alone
would let a large discount on an expensive item outrank a proportionally larger one on
an affordable item.

**Two surfaces, two rules.** This has already been misread once as making cheapest-first
a defect; it is not.

*(Current implementation: the explainable deal score defined in the redesign brief
applies to deals; search ordering is defined here.)*

### F5 — Revenue attribution is preserved and verified
Principle 8 states that revenue mechanisms are preserved as technical infrastructure and
never enter ranking logic. Made concrete:

**Approved affiliate identifiers and attribution mechanisms survive any change touching
outbound links, the exit layer, or any component constructing a retailer URL — and are
verified on a real production URL after deployment.**

A link that opens correctly but has lost its attribution looks perfectly healthy and
earns nothing. Its failure is invisible to every test that checks whether the link works.

*(Current implementation: the Amazon affiliate tag `tawveeri-21`, presently the only
active revenue mechanism.)*

**Extended 2026-07-31 to trust elements.** The same silent-loss class applies to a
disclosure or evidence line removed during a restructure. See UNIFIED SEARCH → migration
status: the AI disclosure must survive absorption of `/advisor` and be verified in
production afterwards.

### F6 — Deferred value is not absent value
Technical debt accepted on the basis of no material customer-visible benefit must be
**reclassified the moment a planned feature depends on it.** The original assessment was
accurate; the dependency changes it.

Record such debt as deferred customer value, not as cleanup.

*(Current instance: the provenance foreign key deferred as DEBT-1, on which search-card
freshness now depends. **Reclassification applied 2026-07-31** in
`docs/ENGINEERING-RULES.md`: DEBT-1 is recorded as deferred customer value, not cleanup.
It remains deferred.)*

---

## F7 — The generative surface

**The assistant generates text at runtime.** Every other customer-facing string is
static: it can be found by search, corrected, and verified.

**No repository search catches what the assistant says in a live answer.** A single
generated sentence — a currency claim, a refresh cadence, an invented specification, a
saving we did not observe — undoes the vocabulary discipline everywhere else, invisibly.

**The governing rule, which survives any change of model, retrieval method, or agent
architecture:**

> **Whenever structured evidence and generated text disagree, structured evidence always
> wins.**

*(Also recorded in the AI Philosophy section above, alongside "AI must never be the
authoritative source of product facts.")*

Whenever the assistant is built or changed:

- **It states no claim outside the approved vocabulary.** Not a current-price claim, not
  a refresh cadence, not a coverage claim, not a specification absent from the catalogue
- **It never presents a merchant's claimed discount as ours**, and never states a saving
  we did not observe
- **Where data is absent it says so plainly** and hands off to search — never a guess,
  never an empty result
- **It is tested adversarially before deployment:** asked about a product from a retailer
  with no provenance, and about a category we do not cover. Read exactly what it produces
- **If enforcing these protections requires changing the protected AI control layer,
  stop and report before proceeding**

*Two measured failures to fix specifically: the assistant asked for a room area the
shopper had already supplied in the same sentence, and its answers were verbose where a
structured card was needed.*

---

## The test that decides membership

A policy belongs in this appendix when **all three** hold:

1. It was established by production measurement or an actual customer-facing failure
2. Its reversal is silent — nothing breaks, no test fails, no error surfaces
3. Its reversal would cause Tawveeri to make a claim it cannot support

**Anything failing any of the three belongs in the roadmap, not here.**

This appendix should stay short. **A long list of protected policies is a sign that
opinion is being smuggled in beside evidence.**

---

# APPENDIX E — AMENDMENT

The Constitution is amended by evidence, never by opinion.

**A principle is added** when a failure reveals a class rather than an instance.
**A principle is retired** when production evidence contradicts it, with the evidence
recorded.
**Implementation detail never enters this document** — it belongs in the roadmap.

**The founder approves every amendment.** Agents propose; the founder decides. Every
amendment records what changed, what evidence caused it, and what it replaced.

**Where this Constitution conflicts with any earlier document, this Constitution wins** —
unless the earlier document carries measured evidence this one lacks. In that case,
bring the conflict forward rather than choosing silently.

## Amendment log

| Date | Change | Evidence | Replaces |
|---|---|---|---|
| 2026-07-31 | **Principle 7 clarification** — the layer at which the record lives is an implementation detail; what matters is that the evidence exists and can be produced on request | `raw_url`, `payload`, `parser_version` and a timestamp present on 100% of 103,106 discovery observations (`docs/FRESHNESS-PROVENANCE-GAP.md`) | The open question of whether 2,321 canonicals without a normalized observation constituted a violation. Ruling: they do not |
| 2026-07-31 | **F5 extended** to trust elements (disclosures, evidence lines), not only revenue attribution | The AI disclosure shipped onto `/advisor`, a surface UNIFIED SEARCH will absorb | — |
| 2026-07-31 | **Two failure classes added** — "evidence generated but not propagated", "trust element lost in a restructure" | `docs/ENGINEERING-RULES.md` Rule 1; the `/advisor` migration condition | — |

---

# THE STANDARD

If evidence proves this Constitution wrong, **improve it. Do not defend it.**

If a stronger solution exists, **adopt it.**

Do not preserve decisions because they are familiar.
Do not preserve ideas because the founder wrote them.
Do not preserve recommendations because they came from AI.

**Preserve only what evidence consistently supports.**

---

# THE FINAL PRINCIPLE

Tawveeri is not building another shopping website.

It is building **the most trusted shopping decision platform in Saudi Arabia.**

Every product. Every recommendation. Every comparison. Every AI response. Every customer
journey.

**Must earn that trust again. Every single time.**

> Evidence outranks opinion.
> Measurement outranks assumptions.
> Truth outranks presentation.
> **Trust outranks everything.**

---

## CONSTITUTIONAL OATH

- Seek truth before convenience
- Measure before claiming
- Verify before recommending
- Explain before persuading
- Reduce effort before adding features
- Build trust before growth
- Improve continuously through evidence

**When in doubt, choose the path that increases long-term customer trust.**

*End of Constitution.*
