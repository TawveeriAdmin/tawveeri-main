# APPENDIX F — PROTECTED TRUST POLICIES

**Append to `docs/CONSUMER_EXPERIENCE_CONSTITUTION.md` before the Amendment appendix.**

---

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

### F6 — Deferred value is not absent value
Technical debt accepted on the basis of no material customer-visible benefit must be
**reclassified the moment a planned feature depends on it.** The original assessment was
accurate; the dependency changes it.

Record such debt as deferred customer value, not as cleanup.

*(Current instance: the provenance foreign key deferred as DEBT-1, on which search-card
freshness now depends.)*

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

*(This belongs in the AI Philosophy section of the main Constitution as well, alongside
"AI must never be the authoritative source of product facts.")*

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

# RATIFIED DECISIONS AWAITING MERGE INTO THE MAIN BODY

*Recorded here because the main Constitution body has not yet been provided. Each entry names
its destination section and must be merged there verbatim when the body arrives.*

## → PRINCIPLE 7 — clarifying line, ratified 2026-07-31

> **The layer at which the record lives is an implementation detail; what matters is that the
> evidence exists and can be produced on request.**

**Founder decision, 2026-07-31.** Principle 7 asks whether we can show a customer where a price
came from and when. Measured: `raw_url`, `payload`, `parser_version` and a timestamp are present
on **100% of the 103,106 discovery observations**. We can. The normalized layer is a *processing*
artefact, not an *evidence* artefact.

**The 2,321 canonicals are NOT a constitutional violation.** The diagnosis in
`docs/FRESHNESS-PROVENANCE-GAP.md` and HANDOVER #21 stands as complete and is closed.

**F2 continues to bind independently.** Evidence existing somewhere does not license a claim
here: **if the true observation timestamp cannot be resolved at the point of display, the line
does not render there.** F2 governs display; Principle 7 governs whether the evidence exists.
The two are separate tests and both must pass.

**DEBT-1 is reclassified per F6** — *deferred customer value*, not cleanup — because search-card
freshness depends on it. It remains deferred; it is no longer filed as tidying.
