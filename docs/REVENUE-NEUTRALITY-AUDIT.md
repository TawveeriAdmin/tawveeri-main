# Revenue-Neutrality Separation Audit

**Purpose:** prove, with file:line evidence, that Tawveeri's product ranking and
recommendation is **architecturally ranking-blind** — commission / affiliate / revenue
data can *never* influence what gets ranked, recommended, or marked as a Smart Pick.

**Governing authority:**
- `TAWVEERI_CONSTITUTION.md` — *"Commercial interest never enters ranking. Every merchant exit is measured via `/go`."*
- **ADR-043** (Merchant Independence) — *"catalog participation ≠ commercial partnership; a **ranking-blind Revenue Graph** guarantees organic ≠ paid architecturally."* (`docs/DECISIONS.md:14`)
- **ADR-044** (E15.5 kickoff) — *"the ranking-blind neutrality boundary [is] preserved throughout."* (`docs/DECISIONS.md:9`)
- Strategy: `docs/POST-E15-STRATEGY-2026-2040.md` §5.1 / §5.9 — the Revenue Graph is a **downstream** system: *"It cannot read into ranking; ranking cannot read from it."*

**Method:** read-only source inspection of every ranking/recommendation code path plus the
revenue/attribution path, corroborated by a pure static regression test
(`tests/agent/revenue-neutrality.test.ts`, 33 assertions, no DB, no network).

**Status:** `VERIFIED — ranking is ranking-blind. No leak found.` (audit date 2026-07-22)

---

## 1. The one-way boundary

Two systems, one direction of flow. Ranking produces an outcome; the outcome is measured;
the measurement produces revenue. Revenue never flows back.

```
   NEUTRAL RANKING (upstream)                MEASURED OUTCOME        REVENUE GRAPH (downstream)
   ───────────────────────────              ────────────────        ──────────────────────────
   reads ONLY:                              user clicks the         /go/[offerId]:
     • identity_key / suitability   ─rank─▶   platform-owned  ─exit─▶  • outbound_clicks (log)
     • store_count (corroboration)          go_url                    • affiliate tags (tag/utm)
     • price / total cost                                            • affiliate_program
     • identity_confidence
        │                                                                     │
        └──────────────  NO EDGE BACK: ranking never reads the Revenue Graph ─┘
```

The boundary is enforced by **construction**, not by policy: the ranking modules import
`createServerClient` and read a fixed column set from the neutral canonical graph
(`tps_product_projection`, `canonical_products`, `normalized_product_observations`,
`price_history`). None of them import, query, or reference `outbound_clicks`, affiliate
rules, or any commission field. The only artifact of the Revenue Graph that ranking emits is
an **opaque `go_url`** (`/go/{offer_id}`) — a measured-exit handle that carries no commission
information and is computed *after* ranking order is already fixed.

---

## 2. Ranking paths × fields they read (evidence)

Every ranking/recommendation path was read in full. The columns each one selects and the
signals each one sorts on are enumerated below with file:line evidence.

| Path | File | Ranks/sorts on (evidence) | Reads commission/affiliate/revenue? |
|---|---|---|---|
| **Hybrid search** | `src/app/api/v1/tps/search/route.ts` | Algolia relevance on the OWNED TPS index, split by `has_comparison` (`:64–65`); DB fallback **`.order('store_count', desc)`** (`:75`); offers sorted by **price** ascending (`:120`); Smart Pick = top corroborated hit (`:118`). Selected columns are all neutral: identity, names, brand, category, price, `store_count`, `identity_confidence` (`:74`). | **No.** grep clean. |
| **Recommendations** | `src/app/api/v1/tps/recommendations/route.ts` | Deterministic score = same-family / same-brand (identity_key parts, `:62–63`) + **`store_count`** corroboration (`:64`) + **cheaper price** delta (`:65`); sorted by score desc (`:71`); confidence from `identity_confidence` + `store_count` (`:69`). SELECT set is neutral (`:31`). | **No.** grep clean. |
| **Stage-1 agent (route)** | `src/app/api/v1/agent/decide/route.ts` | AC journey → `decideAc`; fallback order = **`store_count` then `lowest_price`** (`:57`). Rows built from `canonical_products` attributes + projection price/trust (`:26–45`). `go_url` attached **after** ranking, from cheapest offer (`:70–81`). Response self-declares `neutrality: "ranking-blind (suitability+trust+total-cost; no commission)"` (`:84`). | **No.** grep clean. |
| **Stage-1 agent (core)** | `src/lib/agent/decision-engine.ts` | Deterministic `score` from: BTU fit / suitability (`:104–111`), inverter efficiency (`:113`), cooling mode (`:116–117`), **trust via `store_count`** (`:119`), **total cost of ownership** unit+install+electricity vs budget (`:122–129`); sorted by score (`:136`); `suitability_score`, `confidence` from `identity_confidence`+`store_count` (`:131`). | **No.** grep clean. |

**Signals actually used — the complete allowlist:** `tps_identity_key` (identity /
suitability), `store_count` (corroboration / trust), `lowest_price` / `total_cost_estimate`
(price / total cost of ownership), `identity_confidence` (confidence). Nothing else steers
order.

**grep evidence (forbidden terms in ranking):** searching all four files for
`outbound_clicks | affiliate | commission | revenue | tag | program` returns **only** the
word *"commission"*, and only inside comments and one response-string literal that *deny* its
influence:
- `src/app/api/v1/agent/decide/route.ts:15` — comment: *"…never commission"*
- `src/app/api/v1/agent/decide/route.ts:84` — response string: *"…no commission"*
- `src/lib/agent/decision-engine.ts:6` — comment: *"…never commission"*
- `src/lib/agent/decision-engine.ts:123` — comment: *"…suitability, not commission"*

There is **zero** occurrence of `outbound_clicks`, `affiliate`, `revenue`, `tag`, or
`program` — not even in prose — in any ranking file. The term *"commission"* survives only as
a neutrality *assertion*, never as a field read (proven by stripping comments + string
literals in the regression test; see §4).

---

## 3. The revenue/attribution path is strictly downstream

**`src/app/go/[offerId]/route.ts`** is the sole home of the Revenue Graph. It runs only when a
user **exits** — i.e. after ranking has already produced and returned an order:

1. Resolve the offer from `normalized_product_observations` by `offer_id` (`:65–69`).
2. Normalize the destination URL (`:78`).
3. **Inject the affiliate code** per store — Amazon `tag=tawveeri-21`, Noon `utm_*` — via `AFFILIATE_RULES` / `applyAffiliate()` (`:24–49`, `:80`).
4. **Record the click** into `outbound_clicks` with `affiliate_program`, destination, source, UA, referrer (`:94–103`).
5. `302` redirect to the merchant (`:105`).

Crucially:
- This route is reached by an HTTP navigation to `/go/{id}`; it is **never imported** by any
  ranking module. The regression test asserts no ranking file matches `from '.../go/...'` or
  references `AFFILIATE_RULES`.
- The `offer_id` embedded in each ranking result's `go_url` is chosen by neutral logic
  (cheapest offer of the already-ranked canonical: search `:120`, agent `:70–81`) — the
  affiliate program is decided *inside* `/go` at click time, invisible to ranking.
- `outbound_clicks` is a **write-only sink** from ranking's perspective: nothing in the four
  ranking paths ever `SELECT`s from it. Commission/attribution therefore has no read path back
  into any score, sort, or Smart Pick.

This realizes the strategy's guarantee (`docs/POST-E15-STRATEGY-2026-2040.md:102`): the Revenue
Graph *"maps outcomes → revenue … It cannot read into ranking; ranking cannot read from it.
This separation is the technical guarantee of neutrality. Measured via `/go` (already live)."*

---

## 4. Automated regression guard

`tests/agent/revenue-neutrality.test.ts` (pure, no DB/network) freezes this guarantee:

- Reads each ranking source file as a string; **strips comments + string literals**; asserts
  the executable code matches none of `outbound_clicks | affiliate | commission | revenue`.
- Asserts the raw source (even prose) of every ranking file is free of `outbound_clicks`,
  `affiliate`, `revenue`.
- Asserts ranking *does* read the neutral signals (`store_count`, `lowest_price`,
  `suitability_score`, `identity_confidence`).
- **Positive control:** asserts the Revenue Graph terms (`outbound_clicks`, `AFFILIATE_RULES`)
  *do* live in `/go`, and that no ranking file imports `/go` or `AFFILIATE_RULES`.

Result: **33 passed / 33** (`npx jest tests/agent/revenue-neutrality.test.ts`). Any future
edit that reads a commission/affiliate field into a ranking path fails CI loudly.

---

## 5. Verdict

> **RANKING-BLIND: VERIFIED.**
>
> Across all four ranking/recommendation code paths, ordering is decided **only** by identity/
> suitability, cross-store corroboration (`store_count`/trust), price / total cost of
> ownership, and `identity_confidence`. No path reads `outbound_clicks`, affiliate tags,
> commission, or any revenue signal. The Revenue Graph exists solely downstream in
> `/go/[offerId]`, reached by user exit and never imported by ranking, forming a **one-way,
> ranking-blind boundary** (ranking → outcome → revenue, never back).
>
> This satisfies the Constitution (*"Commercial interest never enters ranking"*), ADR-043
> (Merchant Independence), and ADR-044 (ranking-blind Revenue Graph). Enforced going forward by
> `tests/agent/revenue-neutrality.test.ts`.

**FINDINGS:** none. No leak of revenue/commission/affiliate data into any ranking path was
found.
