# X LISTENING LEXICON — Controlled Demand Validation
**Authority:** docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md §18.3 (intent log schema, reproduced
below verbatim) — this file adds the actual search terms/lexicon, which the Growth System
left to be "harvested from real zero-results/reformulations/X intent posts," not guessed.

## Method (native search only, no paid API — per the execution order's channel guidance)
Use X's native search UI (or saved searches) with the terms below, in Arabic first (Saudi
dialect and MSA mixed), English second. **Read, log, never auto-reply** (see RESPONSE_POLICY.md).

## Seed lexicon (starting point — expand only from what's actually observed, never guessed)
**High buying intent (Arabic):** "ابي اشتري", "وش افضل سعر", "فين الاقل سعر", "احتاج [منتج] بسعر",
"مين يعرف سعر", "وين الاقى ارخص"
**Comparison question:** "ايهما افضل", "الفرق بين", "قارنو لي", "ايش الفرق", "مقارنة بين"
**Complaint (about price/retailer honesty — do NOT reply defensively, log only):**
"خصم وهمي", "السعر رفعوه قبل الخصم", "غالي عندهم", "ما وصل زي ما وصفوه"
**Deal rumor (verify against production before ever citing):** "عرض قوي", "تنزيلات",
"كوبون خصم", "السعر نزل"
**English mirrors:** "best price for", "cheapest place to buy", "is this a good deal",
"price comparison", "fake discount", "was this price ever real"

## Category anchors (tie generic intent to a product we can actually answer on)
Pull from marketing/SOCIAL_FACT_PACK_<date>.md categories currently in the comparable set:
mobile, smartwatch, tv, air_conditioner, washing_machine, refrigerator + brand names
(iPhone/ايفون, Samsung/سامسونج, LG/ال جي, Apple/آبل, Philips/فيليبس) — search
`"[brand/category term] + سعر"` and `"[brand/category term] + price"` combinations.

## Intent log schema (§18.3, verbatim — do not diverge from this shape)
```yaml
- source_post_id: ""
  source_url: ""
  captured_at: ""
  text_minimized: ""            # store only what's needed to act — not the full profile/history
  intent_class: high_buying_intent | comparison_question | complaint | deal_rumor | irrelevant
  product_entities: []
  identity_confidence: 0-100
  production_evidence: ""       # a real query run THIS session — never cached/remembered
  suggested_answer: ""
  link_needed: true|false
  risk: ""
  status: queued | approved | replied | skipped | expired
  retention_until: ""           # minimise personal data — set a real expiry, not indefinite
```

## Retention rule
No long-term profile per person. `text_minimized` holds only what's needed to judge/answer the
single post — never a running history of one account's posts. `retention_until` must be set on
every entry; expired entries are deleted, not archived.

## Status — 2026-08-04
No listening has been performed yet (no account exists — see final report's blocked-items list;
X/TikTok/Instagram account creation needs the founder). This file is the instrument ready to use
the moment an account exists. First pass: run the Arabic high-buying-intent terms against the
mobile/TV/AC anchors above (highest relevance to the current Fact Pack) before broadening.
