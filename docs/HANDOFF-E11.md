# E11 Handoff — Mobile Convergence (true platform client, measured exits)

**Complexity XL.** Objective: mobile becomes a client of the unified platform, with attribution. Outcome: mobile targets System A, **exits via `/go`**, renders platform verdicts, holds no catalog queries. Prereqs: **E9 ✅, E8 ✅, E10 🔒 (blocked — legacy creds)**. **Deploy risk HIGH — app-store review is outside engineering control.**

## Done (this session — measured-exit groundwork)
- **`/go` channel attribution:** `src/app/go/[offerId]/route.ts` now reads `?source=` (validated `^[a-z_]{1,32}$`, defaults `product_page`) → `outbound_clicks.source`. So mobile vs web exits are distinguishable. No regression (default unchanged).
- **Mobile measured-exit helper:** `mobile/src/lib/exit/measured-exit.ts` — `openMeasuredExit({ offerId, url, source })`: routes through `https://tawveeri.com/go/{offerId}?source=mobile` **when an offerId (TPS normalized-observation UUID) is present**, else falls back to the raw URL. `isMeasurable()` / `measuredExitUrl()` exposed.
- **All 4 mobile exit surfaces converted** to `openMeasuredExit`: product page (`(stack)/product/[slug].tsx`), deals (`(tabs)/deals.tsx`), search (`(tabs)/search.tsx`), wishlist (`(stack)/wishlist.tsx`). Each passes `offerId: item.offer_id ?? …` — **currently undefined** because mobile reads the raw `products`/`product_stores` catalog (no observation offerId), so exits still fall back to raw URLs until the contract below lands. The plumbing is unified and forward-compatible.

## The blocking gap for real measured exits (the platform contract)
`/go/{offerId}` requires `offerId = normalized_product_observations.id`. Mobile's search (`/api/search/scrape`) returns **raw scraped products** (no offerId); only the ~48 TPS canonical products have observation offers. So measured exits require:
1. **API contract:** the mobile-facing search/product API must return **TPS canonical offers with `offer_id`** (like the web's `searchTPSCanonical`, which sets `product_url=/go/{obsId}`). Add `offer_id`/`compare_url` to the mobile product/search/deals payloads.
2. **Mobile:** populate `offer_id` on the items passed to `openMeasuredExit` (already wired to read `item.offer_id`).

## Remaining E11 (per the transition plan)
- Replace **45 direct catalog reads** with platform contracts (mobile currently queries Supabase `products`/`product_stores`/`deals` directly — e.g. `(tabs)/deals.tsx` `.from('product_stores')`). Route through the platform API instead.
- Adopt **canonical identity** (`tps_identity_key`) in place of `products.slug`.
- **Consume the decision object** (render platform verdicts / Smart Pick identically to web).
- **Repoint `EXPO_PUBLIC_*`** at System A (verify already `tawveeri.com` / A).
- **Release** — staged rollout; **app-store review latency is the critical-path tail** (transition plan §Track 2). This step needs founder/ops (store accounts, review) — an external gate.
- **E10 prerequisite** (user data on A) for the auth-convergence parts — blocked on legacy creds.

## Verification target (transition plan)
Zero catalog-table reads in the client · every exit produces a click row · verdicts identical to web for the same product · staged-rollout metrics healthy · **mobile revenue measurable**.

## Status
Measured-exit **groundwork shipped** (`/go` source param + mobile exit unification). **Full E11 is not complete** — it needs the platform-contract change (offerIds to mobile), the 45 catalog-read replacements, E10 (legacy creds), and an app-store release (external). Not a code-only, single-session milestone.
