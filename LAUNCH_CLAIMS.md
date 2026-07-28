# LAUNCH_CLAIMS — what we may and may not say

**2026-07-28 · Every word on the site, in the launch post, and in the Misk file comes from list (a). Nothing from (b) appears anywhere.**
Every claim carries its measurement. Labels: **[MEASURED]** on production/live. Standing rule: *"We did not observe it" is never "it is not true"*; never name a retailer negatively.

> **Correction incorporated (2026-07-28):** an earlier draft said we had "~0 served comparisons" and could not claim comparison. **That was wrong.** Live measurement (52/52 multi-store cards accurate, 0 false, post-ADR-132) shows the storefront **does** serve genuine cross-retailer comparisons where retailers overlap. Comparison IS claimable — see (a).

---

## (a) CLAIMS WE CAN MAKE TRUTHFULLY — with the measurement behind each

**Price truth (our unique, defensible differentiator):**
1. **"We verified 925 genuine price drops from our own tracking."** [MEASURED] `tps_listing_price_facts` verdict `verified_drop` = 926.
2. **"65% of the advertised discounts we examined reference a price we never observed."** [MEASURED] inflated_reference 6,747 of 10,303 examinable = 65%.
3. **"We examined 10,302 discount offers."** [MEASURED] examinable (inflated + stable + verified) = 10,303.
4. **The Hisense 85″ U7Q proof:** *"Extra's page claims a 9,400 SAR saving; we publish 8,800 — because 14,399 is the highest price we actually observed over 14 days. We publish a smaller number than the merchant, because ours is evidence."* [MEASURED live 2026-07-28] Extra live: 5,599 / was 14,999; ours: observed_max 14,399, 14 distinct days, verdict verified_drop, model `85U7Q`.
5. **"No competitor can reproduce these numbers — they require a Saudi price-observation history that cannot be bought or scraped retroactively."** [INFERRED, defensible] Rakhys has 70,600 listings and no observation history.

**Comparison (real and demonstrable — but claim the capability + examples, never a count):**
6. **"We show genuine, live price comparisons across major Saudi retailers for products they both carry."** [MEASURED] 52/52 sampled multi-store cards had ≥2 genuinely-distinct retailers, 0 false. **Demonstrable example a judge can verify:** search *iPhone 16 128GB* → Jarir 1,899 · Extra 2,249 · Amazon 2,899 · Almanea 3,239. ACs (LG 18000 split) compare across Extra/Almanea/Noon.
7. **"Ranked cheapest-first, with no paid placement — commission never influences ranking."** [MEASURED, constitutional] ADR-002/ranking; `/go` measured exits.

**Product/status:**
8. **"Bilingual (Arabic + English), Saudi-market focused."** [MEASURED] live.
9. **"In private beta with real users; verified drops and discount-integrity are in production."** [MEASURED, honest — do not overstate].

---

## (b) CLAIMS WE CANNOT MAKE — and why (these appear NOWHERE)

1. **Any specific count of "comparable products"** (e.g. "166 comparable", "564 comparable products you can browse"). [WHY] 166 is an Amazon-double-count artifact (ADR-132); the ~564 is the **System-A layer** (richer, verified) but **locked/disconnected** — not browsable today; and most of the 5,543 products are **single-store**. Comparison is real *where retailers overlap*, but there is **no defensible total** to quote. Claim capability + examples (a-6), never a number.
2. **"Compare every product in Saudi Arabia" / breadth claims vs Rakhys.** [WHY] We are small on breadth; this invites the comparison we lose. EXECUTIVE_DIRECTIVE §2.1.
3. **"~564 comparable products" as consumer-visible.** [WHY] That set lives in the disconnected System A; connecting it is future work. Only claimable after connection ships.
4. **"97%+ matching precision."** [WHY] [MEASURED] precision is ~94–99% on the model-verifiable subset (7 false-merges / 122), and **78% of comparisons rest on unaudited name-based matching** — the figure is not verified. Do not cite a precision number externally.
5. **Any GTIN / "authoritative product identity" claim.** [WHY] GTIN coverage = 0 (measured); identity is inferred, not authority-backed.
6. **Any store named negatively** (e.g. "Extra inflates prices"). [WHY] Standing rule + legal exposure + it closes the commercial doors. The Hisense card is framed as *our number vs their claim*, never as an accusation.
7. **A total product/retailer count presented as strength** ("5,543 products", "22 stores"). [WHY] 22 stores includes ~16 with zero products; leading with volume invites the breadth comparison we lose.

---

## (c) MISK SUBMISSION — same two lists, framed for judges

**Misk CAN (lead with these):**
- The price-truth moat: **925 verified drops · 65% unobserved-reference · 10,302 examined** — original Saudi statistics no one else holds (also the top GEO citation driver).
- The proof card (a-4): one screenshot — Extra's 9,400 claim next to our evidence-based 8,800.
- **Live genuine comparison** (a-6) with the iPhone-16-across-4-retailers example — a judge can verify it on the site in 10 seconds.
- The moat argument: observation history compounds daily and cannot be acquired retroactively.
- Honest weakness, named first (more credible than hiding it): *"comparison breadth is early — most products are still single-store, and our matching recall is in measurement."*

**Misk CANNOT:**
- Everything in (b). Especially: no "N comparable products" figure, no "97% precision", no breadth claim, no negative naming.
- Do not present the ~564 or the 166 as headline metrics. If a comparable number is requested, say *"genuine comparison is live where retailers overlap; we don't quote a single count because most of the catalog is single-store — that's the honest state, and growing it is the plan."*

---

## THE ONE-LINE TEST
Before any sentence ships: **can a judge verify it on the site or in the data today?** If yes → (a). If it needs connection, a count we can't defend, or an unaudited precision number → (b), and it does not appear.
