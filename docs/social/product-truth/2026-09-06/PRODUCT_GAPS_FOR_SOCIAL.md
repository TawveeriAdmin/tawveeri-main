# PRODUCT_GAPS_FOR_SOCIAL.md

Real defects and open gaps discovered while building this pack, recorded per CLAUDE.md's task-ledger rule and mission §24 (record, do not silently fix). None of these were modified in this mission — this is documentation/QA only.

---

## GAP-1 — "Continue with Tawveeri" follow-up quick-actions do not function (NEW, found live 2026-09-06)

**What:** The results page renders four follow-up chips under the top recommendation ("لو رفعت الميزانية 500؟" / "طيب أرخص؟" / "ليش هذا أفضل؟" / "وين أشتريه؟" / "ابدأ بحث جديد"). Clicking "لو رفعت الميزانية 500؟" (what if I raise my budget by 500?) produced **zero change** to the page — identical budget banner, identical top pick, identical prices, before and after the click.
**Where:** `/ar/search` results page, smartphone journey (`جوال كاميرا ممتازة بميزانية 2000`).
**Impact on social/marketing:** Do not depict, screenshot, or script content implying these follow-up buttons work. This directly touches mission-mandated verification of "BUDGET ADJUSTMENT behavior" — the honest answer is: **the UI offers it, the backend does not yet act on it.**
**Scope of this finding:** Only "raise budget by 500" was click-tested. The other three buttons ("cheaper", "why is this better", "where do I buy it") were not tested and should not be assumed broken OR working.
**Recommended next step:** A founder-reviewed engineering pass to confirm root cause (dead click handler vs. a silently-failing fetch) and either wire it up or remove the false affordance. Suggest registering as ADR-301 once fixed, updating `docs/CAPABILITY-CONTRACT.md` at that time.

---

## GAP-2 — Repeated searches via the homepage search box can silently fail (NEW, found live 2026-09-06)

**What:** After two successful searches submitted via the homepage's search input (click box, type, press Enter), a third attempt in the same browser tab within roughly two minutes did not navigate to `/search` at all — the page briefly went blank, then returned to the homepage, with no visible error. The identical query submitted as a direct `https://tawveeri.com/ar/search?q=...` URL worked immediately and reliably.
**Where:** `/ar` homepage search box → Enter key or "بحث" button.
**Possible cause (not confirmed):** Could be a client-side navigation/state issue, or the same "own rate limiter" pattern already on record in memory (`tawveeri-own-rate-limiter`: a server component fetching its own `/api/search/scrape` can hit the 15 req/min limiter and 429 silently). Not root-caused this session — flagged as a hypothesis, not a finding.
**Impact on social/marketing:** A social operator or Grok recording a screen demo should expect the possibility of an unexplained bounce back to the homepage on a rapid third+ search, and should not interpret it as "the query wasn't understood" — retry, or use a direct URL, before concluding a query fails.
**Recommended next step:** Engineering reproduction with browser devtools/network tab open to capture the actual failing request (this session's browser-automation tooling could not inspect network traffic mid-navigation).

---

## GAP-3 — The secondary "Hot Deals" grid on search-results pages is not filtered by search relevance (confirmed live, 2 categories)

**What:** Below the primary ranked results (which are genuinely relevant — this matches the existing, previously-verified North-Star search-relevance finding, see memory `tawveeri-search-relevance-cleared`), every search-results page shows a second "عرض ساخن" (Hot Deal) grid of generic/trending inventory unrelated to the query. On an air-conditioner search, this grid included a Dell Chromebook, a 4G router, extension cords, and a small CD player. On a phone search, it included gaming earbuds, a portable ice maker, a tablet, and security cameras.
**Where:** Bottom two-thirds of every `/ar/search` results page.
**Impact on social/marketing:** The primary ranked list (top of page) is strong, on-topic, and safe to screenshot for content. **The secondary grid is not** — an un-cropped full-page screenshot or scroll-through video risks looking like poor search quality to a viewer who doesn't distinguish the two sections. See `SOCIAL_ASSET_MANIFEST.md` for the specific safe-crop guidance this produces.
**Recommended next step:** Either scope this grid to the search category, or relabel it clearly as "متاجر أخرى قد تعجبك" (unrelated to your search) so it can't be mistaken for a relevance failure.

---

## GAP-4 — Refrigerator lock/key requirement has no structured resolution path (documented, not new — ADR-290)

**What:** Already correctly disclosed to the shopper (see `SOCIAL_CLAIMS_LEDGER.md` A2/A3) — not a defect in behavior, but a standing catalog-depth gap: lock/key evidence exists in some Amazon titles only, too thin/single-provider to structure as a real filter.
**Impact on social/marketing:** Frame as an honesty differentiator (Tawveeri says "we don't know" instead of guessing), never as "Tawveeri finds fridges with locks."
**Recommended next step:** No action needed for this mission; a genuine fix would require broader per-merchant structured-attribute coverage, which is a catalog-depth investment decision, not a quick engineering fix.

---

## GAP-5 — Air conditioner category has zero valid Amazon-side offers (documented, not new — ADR-295)

**What:** AC is Tawveeri's single highest-demand search category (137–139 events/30 days) but Amazon contributes zero valid AC listings, making cross-merchant AC comparison structurally thinner than other categories even though the room-size→capacity matching itself works well (see `SOCIAL_CLAIMS_LEDGER.md` A4).
**Impact on social/marketing:** Do not imply AC comparisons span all 8 active merchants equally. Frame AC content around the capacity-matching intelligence, not merchant breadth.
**Recommended next step:** A merchant-acquisition/catalog-depth priority, not a documentation fix.

---

## GAP-6 — Several smartphone sub-claims remain "not independently re-verified" (documented, not new)

**What:** Battery-priority, performance-priority, and free-form pain-point phone search were all marked in `docs/CAPABILITY-CONTRACT.md` as founder-cited but not independently re-verified as of 2026-09-05. This session re-verified camera-priority live (now GREEN) but did not have time to re-test the other three.
**Impact on social/marketing:** Content should lean on the re-verified camera-priority claim (A6) first; battery/performance/pain-point content should wait for a quick live re-check (5 minutes each) before publishing, per `SOCIAL_CAPABILITY_CONTRACT.json`'s revalidation dates.
**Recommended next step:** A 15-30 minute live re-verification pass on the three remaining sub-claims.

---

## Summary table

| Gap | Severity for social use | New or documented | Action needed before publishing related content |
|---|---|---|---|
| GAP-1 (follow-up chips don't work) | High — direct risk of a false product claim | New | Never depict as working |
| GAP-2 (search box silent-fail) | Medium — operational risk for live demos | New | Use direct search URLs for reliable demo recording |
| GAP-3 (irrelevant hot-deals grid) | Medium — visual/perception risk | New | Crop screenshots to the primary ranked list only |
| GAP-4 (fridge lock unresolved) | Low — already correctly disclosed | Documented | Frame as honesty, not capability |
| GAP-5 (AC Amazon gap) | Low — already disclosed via evidence | Documented | Frame around capacity-matching, not merchant breadth |
| GAP-6 (unverified phone sub-claims) | Medium — content-blocking, not product-breaking | Documented | Live re-check before use |
