# X → Product learning loop (minimal)

**Decision 2026-09-04:** **DESIGNED — not auto-ingested.**

## Why not implement blind ingest

Intent Desk posts are noisy. Personal stories ≠ shopping demand. Blind ingest into Demand Radar would pollute category demand with social chatter.

## Safe loop (ops → eng later)

1. Founder-approved Intent Desk candidates already classified (DIRECT_PURCHASE, COMPARISON, HOME_MISSION, …).
2. Weekly: export **qualified** phrases only (purchase-intent, Saudi Arabic, in-category) into Demand Radar *shadow* / Emerging Language review queue — human gate retained.
3. Exclude ads, jokes, politics, brand hate, off-category.

## Ticket for eng (if not this PR)

`ENG-X-DEMAND-SHADOW-INGEST`: optional CSV/API from Intent Desk log → `demand-radar` shadow adapter with `source=x_intent_desk` and `is_social=true` flag; never auto-promote to production ranks without founder/growth review.
