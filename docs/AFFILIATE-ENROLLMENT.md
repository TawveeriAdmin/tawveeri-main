# Affiliate Enrollment — Founder Action Guide

**Purpose:** monetize the exits we already measure. Every `/go` exit and every storefront `go_click`
is already tracked (`outbound_clicks` + `usage_events`). Enrollment turns *measured* exits into *paid*
exits **with no architectural change** — the Provider Framework already carries the adapters.

**Founder Approval Boundary:** only the Founder can enroll (sign contracts, accept payment terms).
This guide is what you do in parallel with the Private Beta; nothing here blocks the beta.

## How activation works (why it's zero-engineering)

The exit pipeline is one function — `buildOfferExitLink()` (`src/lib/providers/link.ts`) — driven by a
per-retailer `affiliate` config in `src/lib/providers/registry.ts`. Three adapters already exist and cover
essentially every Saudi program:

| Adapter | Use when | Config shape |
|---|---|---|
| `amazon` | Amazon Associates/Creators tag | `{ network: "amazon", trackingId: "<your-tag>", supportsSubId: true, subIdParam: "ascsubtag" }` |
| `param` | Any network that appends tracking query params (Noon, ArabClicks/ArabyAds, Admitad, Boostiny) | `{ network: "param", trackingId: "<id>", params: [{name,value},…], supportsSubId: true, subIdParam: "<param>" }` |
| `direct` | No program yet (default) | `affiliate: null` — still fully measured, just unmonetized |

**Activation step (config only, ~1 line each, no new code):** once you hand back the tracking ID/params
for a retailer, that retailer's `affiliate: null` becomes the matching adapter config above. The framework
does the rest; `/go` immediately builds monetized links. No schema change, no new adapter, no redeploy risk.

## Enrollment checklist (do these in parallel)

### 1. Amazon SA — highest priority (biggest catalog overlap)
- Enroll: **Amazon Associates / Amazon Creators** for **amazon.sa** (KSA store).
- Hand back: your **Associate tag** (e.g. `yourname-21`).
- Status: framework already wired with a **placeholder** tag `tawveeri-21` — replace with your real tag. Until then, Amazon exits carry a tag that is **not yours** (no revenue) — swap ASAP.

### 2. Noon — ALREADY ENROLLED (superseded 2026-08-07, ADR-224/225 — corrected here 2026-09-05)
This section previously described the ADR-181 (2026-08-02) values as current. They were
superseded five weeks ago and this file was never updated — corrected now while auditing
the codebase for the Amazon × Noon Affiliate Commerce mission. **Do not use the values
below the strikethrough line; they are historical only.**
- **Current, live values (ADR-224/225, verified against two independently-generated
  "Everyday Campaign" dashboard links):** `utm_source=C1000264L`, `utm_medium=AFFfbc721aa80c8`,
  `utm_campaign=CMP2ce0b63a6a1anoon`, `adjust_deeplink_js=1` — an Adjust-network campaign,
  not the bare `utm_source=<publisher id>&utm_medium=referral` shape ADR-181 assumed. Live
  in `src/lib/providers/registry.ts`'s `noon` entry today; already applied to every organic
  Noon exit via `/go` and `buildOfferExitLink()` — no further founder action needed for
  this part.
- ~~RESOLVED 2026-08-02 from a real dashboard-generated link. noon attribution is
  `utm_source=<publisher id>&utm_medium=referral` — ours is **C1000094L**. There is no
  `aff_code` and no `utm_campaign` in a genuine noon partner link.~~ (superseded)
- **DNC160 is NOT a tracking parameter.** It is a customer COUPON code (10% cashback, capped
  25 SAR) typed at checkout — a separate system in the same dashboard. It belongs on the
  coupons surface, never on an outbound link. (This finding is still current — unrelated to
  the C1000094L→C1000264L correction above.)
- **`o=` is not ours and is not required.** Every organic product link on noon's own listing
  pages carries `?o=` (50/50 measured); it has no effect on product, price or seller (a
  bogus value renders identically). It is noon's internal link token — preserved when the
  source URL has one, never synthesized by us. (Still current.)
- **What's actually still open for Noon:** (1) a signed written consent for using the
  "Noon" brand name on a promotional campaign CARD specifically (ADR-284's "clause-8.3"
  question — organic exit attribution above is unaffected and unblocked); (2) confirmed
  Noon-side report/reconciliation access equivalent to Amazon's Associates Central export
  (AFFILIATE_RECONCILIATION_CONTRACT.md: none confirmed yet). See DECISIONS.md's Amazon ×
  Noon Affiliate Commerce Engine entry (2026-09-05) for the full current state.

### 3. KSA multi-advertiser networks — covers Jarir, eXtra, Almanea, Samsung, etc.
- Enroll in **one** aggregator that carries these advertisers: **ArabClicks (ArabyAds)**, **Admitad**, or **Boostiny/Ecomz**.
- Hand back: your **publisher/affiliate id** + the per-advertiser deep-link param format.
- Activation: each becomes a `param` config. These are `affiliate: null` today (measured direct exits).

### 4. Salla / Zid merchant stores (Najm, HDF, Golden Store, PC Palace, Sony World, …)
- Most are small independent shops — **direct exits are fine** for the beta (still measured).
- If you want monetization: Salla stores can enroll via **Salla's affiliate marketing** app or a network that lists them; hand back the deep-link param → `param` config. Low priority vs #1–#3.

## What to hand back (per retailer)
1. Program/network name.
2. Your tracking id (tag / publisher id / campaign id).
3. The URL param(s) the network expects (name + value), and which param carries the sub-id (for our `/go` click id).

That's it — I convert each into a registry config line and monetization goes live retailer-by-retailer, with
zero downtime and full click attribution preserved.
