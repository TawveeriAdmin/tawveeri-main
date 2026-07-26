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

### 2. Noon — second priority
- Enroll: Noon's affiliate program via **Admitad**, **Boostiny**, or **ArabClicks (ArabyAds)** (whichever accepts you).
- Hand back: the tracking params they assign (campaign/publisher id). Current config uses placeholder `utm_campaign=DNC160` — replace with your real values.

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
