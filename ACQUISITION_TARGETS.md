# ACQUISITION_TARGETS — the primary line of work (post-2026-08-02)

**2026-07-28 · Authority: EXECUTIVE_DIRECTIVE (positioning) + MASTER_DIRECTIVE (phases) · ADR-133**
Governed by the measured rule (below). Every claim labelled **[MEASURED]** / **[INFERRED]** / **[ASSUMPTION]**.
ADRs checked: ADR-085 (provider framework), ADR-089/095/097/104/107/108/118 (config-only onboarding), ADR-103 (free Salla/Zid discovery is not viable), ADR-105/106 (overlap-bound growth), ADR-133 (matching marginal → acquisition is the growth lever).

---

## 0. WHY THIS IS NOW THE MAIN EFFORT

[MEASURED, ADR-133] Matching adds only **~10–50** comparable families to the current catalog — marginal. The catalog already holds **~564** genuine cross-retailer comparable families (locked in System A, connection releases them). **Growth beyond ~564 is bounded by cross-retailer OVERLAP — how many products two Saudi retailers both carry — which is an acquisition property, not an engineering one.** So after Connect (Phase 2.5), acquisition is the only lever that raises the ceiling.

**Sequencing:** this runs AFTER System A connection (Phase 2.5). Onboarding into a disconnected layer adds zero *visible* comparisons (ADR-125). Connect first, then acquire.

---

## 1. THE RULE (measured; it disqualifies most candidates)

[MEASURED, UCP concentration 2026-07-28] Of 127 UCP-store×major shared families, **alnakheelk 68 + najm 48 = 91%**; **sonyworld (single-brand) = 0**.

> **Onboard a store only if it is a MULTI-BRAND appliance / AC / large-electronics retailer whose brands overlap the majors (Samsung/LG/Hisense/TCL/Midea/Haier/…). Single-brand specialists, accessories shops, and no-overlap catalogs produce zero comparisons — do not onboard them regardless of size.**

**Ranking criterion = PREDICTED cross-retailer overlap, measured BEFORE onboarding** via `scripts/tps-analysis/feed-overlap-probe.ts` (public Woo/Salla/Zid catalog → SAR-gate → brand/model overlap with our single-store canonicals → an overlap score). Predicted overlap, not catalog size, not market size, decides rank.

### Hard disqualifiers (any one ⇒ reject)
1. **Single-brand specialist** (sonyworld's zero is the reference case).
2. **No measured overlap** with the majors' brands/models (feed-overlap-probe score ≈ 0).
3. **Accessories/consumables only** (cases, cables, filters — not devices).
4. **No UCP profile AND no public feed** (Salla/Zid JSON-LD, Woo Store-API, Shopify products.json, Algolia) — cannot ingest credential-free.
5. **Hypermarket** (Panda/Lulu/Carrefour/BinDawood/Danube/Othaim) — electronics are a small fraction of a grocery catalog; bespoke scraper ROI does not clear.
6. **Telecom operator** (stc/Mobily/Zain/Axiom) — device pricing is contract/installment-bound; needs a Commercial-Variant telecom model first (a real project, not a connector).
7. **Manufacturer/distributor** (Zamil/Zagzoog) — spec enrichment only, never price/stock.
8. **Duplicate of an integrated store** (e.g. shaker.com.sa vs shakersa.com) — would fabricate false 2-store comparisons on identical stock.

---

## 2. DISCOVERY — where Saudi multi-brand appliance/AC Salla/Zid stores come from

[MEASURED, ADR-103 + acquisition-engine memory] **Free programmatic Salla/Zid discovery is not viable** — crt.sh / certspotter / Common Crawl / DuckDuckGo / platform directories are all blocked or too thin. The discoverable sources, in order:

1. **StoreLeads (primary).** A store-tech directory that can filter by country=Saudi + platform + product_count. **Founder action required (one check):** open its *Technologies* filter and confirm whether **Salla** and **Zid** are listed.
   - **If yes** → StoreLeads Premium is sufficient; export **~150–300** KSA Salla/Zid/Woo/Shopify **electronics** domains (`domain`, `platform`, `product_count`), product_count ≥ 50, active. Feed them to the ranking engine (§3).
   - **If no** → StoreLeads is Shopify-centric and low-yield here; a Salla/Zid-specific data source (paid, or a curated directory) becomes a genuine Founder-approval boundary. [MEASURED, acquisition-classification §long-tail]
2. **Salla/Zid category storefronts** (`salla.sa/<store>`, `*.zid.store`) surfaced via Saudi appliance/AC search — manual but yields the exact multi-brand-appliance profile we want.
3. **Enterprise majors by name** (not directory-discoverable): **SACO**, **Xcite** — known high-overlap, but custom-scraper (see §4).

---

## 3. MARGINAL COST PER STORE

[MEASURED earlier this session] For a store on a platform we already support (**Salla/Zid JSON-LD, Shopify products.json, Woo Store-API, Algolia**, or one publishing **UCP**): **~1–3 engineering hours, config-only** — a one-line `registry.ts` entry, no new code. [MEASURED] 9 of 22 registered stores publish `/.well-known/ucp` (all mid-market Salla/Shopify/Zid); UCP is a bonus (structured real-time price/stock) but the JSON-LD adapters already cover these platforms without it.

For an **enterprise** platform (SACO/Xcite): **HIGH** — a bespoke `BaseScraper` + anti-bot + ongoing maintenance. Justified only for confirmed HIGH overlap.

---

## 4. FIRST TARGETS — ranked by predicted overlap

**Labels:** overlap **[MEASURED]** = feed-overlap-probe run; **[PREDICTED]** = from the rule + category, not yet probed. **Onboarding is gated on a MEASURED overlap score > 0 (feed-overlap-probe) — never onboard on prediction alone.**

| # | Target | Platform | Cost | Overlap | Basis |
|---|---|---|---|---|---|
| 1 | **SACO (saco.sa)** | enterprise | HIGH | **HIGH [PREDICTED]** | Large overlapping electronics/appliance/tools catalog; multi-brand. Top custom-scraper candidate (acquisition-classification §D). |
| 2 | **Xcite (xcite.com.sa)** | enterprise | HIGH | **HIGH [PREDICTED]** | Pure multi-brand electronics (TV/mobile/laptop/appliance). 2nd custom-scraper candidate. |
| 3 | **alnakheelksa** (salla.sa/alnakheelksa) | Salla | LOW | **0.90 [MEASURED]** (acquisition-salla-seed) | Multi-brand AC/appliance; already the highest measured overlap seed. Confirm not already the onboarded `alnakheelk`. |
| 4 | **alhowaish** (salla.sa/alhowaish) | Salla | LOW | 0.74 [MEASURED] | Multi-brand appliances/vacuums — **already onboarded (store 20)**; listed for completeness. |
| 5–N | **StoreLeads KSA Salla/Zid electronics export** | Salla/Zid | LOW | **[PENDING]** | The real pipeline: ~150–300 domains → feed-overlap-probe → rank → onboard the >0-overlap subset. **Blocked on the §2 founder StoreLeads check.** |

**Honest status [MEASURED]:** I cannot hand you 20 *verified* new targets today, because **discovery is the bottleneck, not engineering** (ADR-103; acquisition-engine memory). The credential-free STRONG-overlap merchants surfaced in the 2026-07-25 sweep were already onboarded (najm, hdf, alnakheelk, etc.); a fresh batch requires the StoreLeads dataset. The **process** above is complete and ready; the **input** needs the one founder action in §2. SACO and Xcite are the two named enterprise targets worth a deliberate custom-scraper investment independent of StoreLeads.

---

## 4b. Retailer Opportunity Radar — founder-named candidates, research-only (2026-08-07)

Requested by the founder's SEO/AI-discoverability mission as its Phase-12 deliverable (research
only — no onboarding authorized here). Checked first: ADR-105 (35-retailer platform sweep),
`src/lib/retailers/approved-retailers.ts` + `docs/RETAILER-MATRIX.md` (current single source of
truth on what's already approved/ingested), and HANDOVER's 2026-08-03 `tps:acquire` re-probe
(tamkeen/alsaif/eddy/xcite/alhaqeel/hhm/emax/altheqa — all still `unknown` platform). Fresh
WebSearch/WebFetch research done for candidates not previously evaluated.

**TIER A — high incremental comparison value**
| Candidate | Domain | Why |
|---|---|---|
| **Bukhamsen** | bukhamsen.com | **[MEASURED 2026-08-07]** Live WooCommerce Store API confirmed by direct query (`wp-json/wc/store/v1/products` returns valid pricing/stock JSON) — the SAME config-only adapter class already proven (ADR-089/108), cheapest possible technical win found this session. Genuinely multi-brand: AC (TCL/Haier/Fisher/Calvinator), washers (LG/Samsung), TVs (LG/Skyworth) — real brand overlap with current majors. 14+ Eastern-Province branches, est. 1979 — real scale, not a shell. **Best new candidate found; not previously in any register.** |
| **Xcite (Alghanim)** | xcite.com.sa | Independently re-confirmed 3× (ADR-105 2026-07-26; `tps:acquire` re-probe 2026-08-03; ranked #2 in §4 above) as genuine multi-brand electronics (TV/mobile/laptop/appliance) with predicted HIGH overlap. Enterprise/closed platform — requires the same custom-scraper investment already earmarked for SACO. No new finding, but the founder named it directly so it's re-surfaced here with its full history. |
| **Al-Khunaizan** | alkhunaizan.sa | **Already on Tawveeri's own approved list** (`source: 'credential_free'`) — Magento with a working public sitemap, same proven pattern class as Alsaif Gallery ("scrapeable, engineering only, no credential needed" per RETAILER-MATRIX.md). Genuine appliance retailer, zero data ingested yet. Lowest legal/access risk of anything evaluated today — this is a pure engineering-backlog item, not a new evaluation. (Note: supersedes ADR-105's older "unknown enterprise platform" read on this same retailer — the sitemap-based path wasn't on record yet at that time.) |

**TIER B — useful category-depth value**
- **Al-Husayani** (alhusayani.sa) — genuine 30+-brand AC/appliance specialist (Zamil, Hitachi, Frigidaire — real overlap signal), but OpenCart platform = custom-scraper cost, unmeasured overlap.
- **Fouzan Center** (fouzancenter.com) — Salla-confirmed (cheap, proven adapter), large claimed scale, but catalog spans furniture/textiles beyond pure appliances — needs a category-mix check.
- **Sultan.sa** — promising profile (55 yrs, AC/appliances, multi-city) but platform undetermined (fetch blocked) — needs a basic technical probe.
- **Al Bassam Appliances** — named-fit plausible, but only assessed once (ADR-105) as "unknown enterprise platform," no category/overlap detail since — needs a fresh look.

**TIER C — low incremental value / defer**
- **Carrefour Saudi** — hard-disqualified by §1's existing rule (hypermarket, electronics minority of catalog) AND has a documented specific blocker (RETAILER-MATRIX.md: "Akamai + delivery-area session → headless yields wrong product/price; will NOT fabricate"). Already `commercial`-gated on the approved list — only a partnership, never scraping, is safe here.
- **Ahmed Abdulwahed** — confirmed NOT an operating storefront (`source: 'not_a_store'`, "Live Soon" placeholder per RETAILER-MATRIX.md). Nothing to observe.
- **Al-Abbad AC & Home Appliances** (alabbadest.com — the correct entity; a same-named "Al-Abbad Trading" at alabbadco.com is an unrelated plumbing/hardware distributor) — Salla-confirmed/cheap, but small regional scale (2–3 Eastern-Province branches) and its AC line is single-brand (Leon), tripping §1's single-brand disqualifier for its core category.

**Not onboarded. No architecture change. Full source list and per-candidate detail in the session's research transcript if needed later.**

---

## 5. THE ONE ACTION THAT UNBLOCKS THIS
**Founder:** open StoreLeads → Technologies filter → is **Salla** and **Zid** listed? Yes → export ~150–300 KSA Salla/Zid/Woo/Shopify electronics domains and hand them over; I rank by measured overlap and onboard the config-only subset autonomously. No → we scope a Salla/Zid data source (approval boundary). Until then, acquisition is process-ready but input-starved, and **Connect System A (Phase 2.5) is the higher-value work anyway** — it releases the ~564 already held.
