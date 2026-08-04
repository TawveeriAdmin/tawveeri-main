# RESPONSE POLICY — Controlled Demand Validation
**Authority:** docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §18.4 (10 reply rules) + the execution
order's hard lines. This file is the working checklist; the Growth System is the definition.

## Absolute rules (never conditional on how good the opportunity looks)
1. **No unsolicited automated replies triggered by keyword match.** X's platform rules forbid
   it, and it reads as spam/harassment regardless of the answer's quality. Listening can be
   automated; the outbound act of replying is always a human decision.
   **Live-researched confirmation (2026-08-04):** this is no longer just policy — X shipped a
   hard API restriction on 2026-02-23 that blocks automated replies at the protocol level
   unless the original author mentions/quotes the replying account first, and a March 2026
   enforcement wave suspended accounts still running keyword-triggered reply automation. This
   rule was already correct; it is now also technically unavoidable for anything routed
   through the API. Source: [X API blocks automated spam replies](https://piunikaweb.com/2026/02/24/x-api-blocks-automated-spam-replies/).
2. **A human sends every external reply.** During this entire proof phase, Claude drafts an
   `intent_log` entry (see marketing/X_LISTENING_LEXICON.md schema) with a suggested reply —
   it never posts it. Sending is the one action reserved for the founder among "routine work."
3. **No cold DMs. No bulk mentions. No duplicate replies to the same person/thread.**
4. **No link-only replies.** A reply must answer the person's actual question in its own text
   first. A link is added only when it points to a *specific, directly relevant* result — never
   a generic homepage/bio link used as a promotion vehicle.
5. **No claim outside LAUNCH_VOCABULARY's CAN SAY list.** If the honest answer requires a
   phrase not yet in the vocabulary, the phrase is proposed with evidence and the vocabulary is
   amended FIRST (F1) — never used ad hoc in a reply "just this once."
6. Never name a retailer negatively for an unlicensed discount claim (EXECUTIVE_DIRECTIVE +
   Master Book §12 anti-fraud-discount-law note) — "we did not observe it" is the correct
   phrasing, not "they are lying."
7. Never reply if identity/product confidence is low — "I don't know" plainly (T7) beats a
   guess, and a wrong product match in a public reply is worse than silence.
8. Minimise personal data collected while listening: no persistent per-person profiles, no
   inferred sensitive attributes (see marketing/X_LISTENING_LEXICON.md retention rule).

## Reply decision flow (for the human sending it)
1. Does the intent_log entry have `production_evidence` attached (a real query/screenshot from
   this session, not a memory)? If no → do not reply, flag for re-verification.
2. Does the suggested reply answer the actual question asked, in its own sentence, before any
   link? If no → rewrite.
3. Is every claim in the reply already in LAUNCH_VOCABULARY's CAN SAY list? If no → do not send;
   propose the phrase for approval instead.
4. Is this the first reply to this specific person/thread on this topic? If no → skip (rule 3).
5. Founder or delegated human sends. Log `status: replied` + timestamp in the intent log.

## What "answering first" looks like (illustrative, not to be sent without evidence + approval)
- Bad: "Check tawveeri.com!" (link-only, no answer, exactly what rule 4 forbids)
- Good: "[Product] has been sitting around [last observed price] SAR at [retailer] as of
  [date] last time we checked — full comparison here if useful: [specific comparison link]."
  The sentence answers the question; the link is optional context, not the point.

## Escalation (stop and ask the founder)
- Any legal/privacy/platform-policy question a reply can't resolve on the vocabulary alone.
- Any reply that would require naming a retailer negatively, even truthfully.
- Any thread where the "conversation" looks like it's actually a coordinated brigade/bot
  pattern rather than a real shopper — do not engage, log and move on.
