# SOCIAL_CLAIMS_LEDGER.md

**PACK_VERSION:** 1.0 · **GENERATED_AT:** 2026-09-06 · **DATA_AS_OF:** 2026-09-06 (live production, `tawveeri.com`)
**Method:** (1) full-text mining of ADR-290 through ADR-300 plus `docs/CAPABILITY-CONTRACT.md` (2026-09-05), and (2) a fresh 2026-09-06 live-production re-verification pass of the highest-risk claims (refrigerator lock/size, AC room-size, phone camera+budget, merchant exit-link, follow-up quick-actions), performed in this session against `tawveeri.com`.
**This is the evidence backbone.** Every claim used in `PRODUCT_TRUTH_SOCIAL_PACK_AR.md` / `_EN.md`, the Quick Start, and the content bank must trace to a row here. No claim below is asserted without a citation. Unknown beats incorrect.

Status vocabulary (reused from `docs/CAPABILITY-CONTRACT.md` — do not invent a parallel vocabulary):
- **GREEN / PROVEN_LIVE** — verified working in production, citable test/ADR/live repro.
- **YELLOW / PARTIAL** — works in some cases, not others; gap is known and disclosed.
- **RED / UNSUPPORTED_BY_DESIGN** — deliberately not modeled as a capability, or a live check found it non-functional. Never claim publicly.
- **UNKNOWN** — not evaluated this pass. Never treat as GREEN by default.

---

## A. Claims RE-VERIFIED LIVE in this session (2026-09-06)

| # | Claim | Status | Live repro (exact query) | What was observed | Evidence source |
|---|---|---|---|---|---|
| A1 | Tawveeri recognizes a "small" refrigerator size preference | **GREEN** | `أبي ثلاجة صغيرة وقفلها مهم` on `/ar/search` | Chip `small` appeared under "فهمت طلبك كالتالي"; top 4 results were 200L/200L/130L/80L units each captioned "سعة X لتر — ثلاجة صغيرة كما طلبت" | Live UI, ADR-290 |
| A2 | Tawveeri discloses (never filters, never fabricates) when it cannot verify a stated requirement — refrigerator lock case | **GREEN** | same query | Every result carried: "⚠️ لا تتوفر لدينا بيانات موثوقة عن وجود قفل لهذه الثلاجة — تحقق من مواصفات المنتج مباشرة قبل الشراء إذا كان القفل مهماً لك" | Live UI, ADR-290 |
| A3 | Tawveeri verifies/filters by refrigerator lock | **RED** | same query | No lock-based filtering occurred — 418 raw matches, unfiltered by lock; disclosure only (see A2) | ADR-290 (`UNSUPPORTED_BY_DESIGN`, confirmed) |
| A4 | Tawveeri recognizes room-size → AC capacity(BTU) matching | **GREEN — new, not previously in the contract** | `مكيف لغرفة 25 متر بميزانية 2500` | Chips `25 م²` + `تحت 2500 ريال`; results captioned "مناسب لغرفة ~25م² (السعة 17800/18000/18100/18300 وحدة تطابق المطلوب)" | Live UI, 2026-09-06 |
| A5 | Tawveeri parses a maximum budget across categories, both phrasings ("بحد أقصى" and "بميزانية") | **GREEN** | fridge, AC, and phone queries above all used "بميزانية X" | Every result page showed the banner "طبّقنا الميزانية المذكورة في بحثك: X ريال أو أقل" and a budget chip | ADR-291 (بحد أقصى), live-confirmed this session for "بميزانية" phrasing too |
| A6 | Camera-priority + budget smartphone search | **GREEN — re-verified, was "founder-cited, not independently re-verified"** | `جوال كاميرا ممتازة بميزانية 2000` | Chips `جوال` / `تحت 2000 ريال` / `تصوير`; top pick iPhone 14 Pro Max captioned "إصدار Pro Max — كاميرا أفضل" | Live UI, 2026-09-06; supersedes the "not re-verified" caveat in `docs/CAPABILITY-CONTRACT.md` row 2 |
| A7 | Tawveeri surfaces a plain-language reason for each recommendation without an extra click | **GREEN — new** | all three queries above | Every card carried an inline caption (e.g. "إصدار Pro Max — كاميرا أفضل", "إنفرتر — كفاءة أعلى") visible by default, plus an optional "لماذا هذا الترشيح؟" expander for more | Live UI, 2026-09-06 |
| A8 | Tawveeri discloses cross-merchant storage-capacity ambiguity instead of silently merging different variants | **GREEN — new** | phone query | "⚠️ السعة التخزينية غير محددة في هذه العروض — قد تختلف بين المتاجر" shown on every phone card | Live UI, 2026-09-06 |
| A9 | Tawveeri flags a listed "before" price it has never actually observed (anti-fake-discount honesty) | **GREEN — new, cross-category** | all three queries above | Repeated verbatim on fridge/AC/phone results: "لم نرصده يومًا بسعر «قبل» المعلن (X)" | Live UI, 2026-09-06 |
| A10 | Ranking is not influenced by commercial/merchant interest | **GREEN — restated on every results page** | all three queries above | Footer line on every search results page: "الترتيب محايد تمامًا — المصلحة التجارية لا تدخل في الترتيب أبدًا" | Live UI, 2026-09-06; matches Constitution invariant |
| A11 | Clicking through to a merchant lands on a real, live product page carrying Tawveeri's affiliate tag | **GREEN — new** | clicked "تحقق من السعر والمتجر" on the fridge result | Landed on `amazon.sa/dp/B08XNYDM9P?tag=tawveeri0f-21&ascsubtag=...`, matching product, live price | Live browser test, 2026-09-06 |
| A12 | Zero-confident-match fallback is honestly labeled, not disguised as a real result | **GREEN — new** | phone query, bottom of results | "توفيري تعرّف على الموديل، لكن لم نثبت عرضًا مطابقًا بما يكفي. استكشف على Amazon" under an explicit "مادة إعلانية • رابط عمولة" (sponsored content • affiliate link) label | Live UI, 2026-09-06 |
| A13 | "Continue with Tawveeri" follow-up quick-actions ("لو رفعت الميزانية 500؟" / "طيب أرخص؟" / "ليش هذا أفضل؟" / "وين أشتريه؟") actually change the search when clicked | **RED — real defect found live** | clicked "لو رفعت الميزانية 500؟" on the phone results page | Page content was byte-for-byte identical after the click — same budget banner (2,000), same top pick, same price. The button renders but does not execute | Live browser test, 2026-09-06 — **see PRODUCT_GAPS_FOR_SOCIAL.md GAP-1** |
| A14 | Repeated searches submitted through the homepage search box (Enter key / button click) are reliable | **YELLOW — reproducibility issue found live** | 3rd+ search attempt via the homepage UI within ~2 minutes silently returned to the homepage instead of navigating to `/search`; the identical query submitted as a direct `?q=` URL worked immediately | Not root-caused this session (could be client-side nav state or the middleware's own rate limiter — see memory `tawveeri-own-rate-limiter`) | Live browser test, 2026-09-06 — **see PRODUCT_GAPS_FOR_SOCIAL.md GAP-2** |
| A15 | The secondary "عرض ساخن" (Hot Deals) grid shown below the main ranked results is filtered by search relevance | **RED — confirmed live, both AC and phone queries** | AC query showed a Dell Chromebook, a 4G router, extension cords, a CD player, a small TV; phone query showed gaming earbuds, an ice maker, a tablet, security cameras, projectors | This grid is generic/trending inventory, not search-matched. The **primary ranked list above it is highly relevant** — only the secondary grid is the issue | Live UI, 2026-09-06 — **see PRODUCT_GAPS_FOR_SOCIAL.md GAP-3**; do not use raw un-cropped search screenshots for social without cropping this grid out |

**Important scope note on A13/A14/A15:** these are genuine live findings from a single test session, not an exhaustive QA sweep. They are reported per CLAUDE.md's task-ledger rule (report the finding, don't silently fix it, don't hide it) and per mission §24 (record a Product Gap, do not modify production). A founder-reviewed engineering pass should re-verify before either confirming these as standing defects or closing them.

---

## B. Claims carried forward from ADR-290–300 (full findings in the mining pass; not independently re-verified live this session — flagged where the contract itself already flagged them)

| # | Claim | Status | ADR | Note |
|---|---|---|---|---|
| B1 | Battery-priority + budget smartphone search | YELLOW→treat as GREEN pending re-check | CAPABILITY-CONTRACT row 3 | Same publication gate as A6 (camera); not re-tested live this session — recommend a quick live check before using in content, but same mechanism as A6 which WAS re-verified |
| B2 | Performance-priority phone search | **YELLOW/PARTIAL** | CAPABILITY-CONTRACT row 4 | "Founder-cited, not independently re-verified" — still true after this session; do not claim GREEN |
| B3 | Free-form "my phone is slow/dying" pain-point search | **YELLOW/PARTIAL** | CAPABILITY-CONTRACT row 5 | Same caveat as B2 |
| B4 | Unnamed A-vs-B comparison ("iPhone vs Samsung, which is better?") | **RED** | CAPABILITY-CONTRACT row 7 | Not re-verified; treat as unsupported |
| B5 | Buy-now-vs-wait timing guidance | **RED** | CAPABILITY-CONTRACT row 8 | Not re-verified; treat as unsupported |
| B6 | Condition (new/renewed/used) disclosure, cross-merchant | **YELLOW/PARTIAL** | ADR-287, ADR-298/299/300 | Storefront layer preserves condition text; canonical/identity layer strips it. Internal Amazon×Noon shadow-comparison engine: only 3 of 50 real overlap pairs safely condition-comparable, 47 correctly resolve UNKNOWN (ADR-299/300) |
| B7 | Automatic discovery/addition of a product you searched for that wasn't in the catalog | **RED/UNPROVEN** | ADR-291(D), ADR-292, ADR-293 | Safety mechanism (never fabricates) is proven; a genuinely-new product being added this way has never been proven live. Do not claim auto-discovery works |
| B8 | Data freshness ("always up to date prices") | **YELLOW** | ADR-296 | Typically 1–2h fresh under normal operation; a redeploy can still kill an in-flight refresh — disclosed residual risk, not proven immune |
| B9 | Air conditioner: broad multi-merchant price comparison | **RED for Amazon-side specifically** | ADR-295 | Zero valid Amazon AC offers — real catalog gap despite AC being the single highest-demand category (137–139 search events/30d) |
| B10 | Live Grok/AI social-agent integration exists | **RED** | ADR-297 | Explicitly, repeatedly confirmed zero integration; TikTok is fully manual, one founder-reviewed video at a time |
| B11 | "Unknown beats incorrect" as a brand-level honesty claim | **GREEN — the anchor claim** | ADR-290/291/298/299/300 pattern, reinforced by A2/A8/A9/A12 above | The single most evidence-dense claim in the whole register — recommended as the anchor brand claim across all content |
| B12 | Real confirmed commission/revenue from Amazon or Noon | **RED/UNKNOWN — zero confirmed** | `docs/report/SEPTEMBER-2026-EXECUTION-BASELINE.md` | `affiliate_reports`/`affiliate_conversions` both 0 rows; not a shopper-facing claim, but relevant if any content implies proven revenue/scale |
| B13 | Noon-branded promotional/partner placement | **RED (legal, not product)** | ADR-284/294, clause-8.3 | Consent unresolved — never call Noon an "official partner" |
| B14 | "Noon is usually cheaper" (any category) | **RED** | ADR-294 | Explicitly disproven for TV: of 140 row-pairs, Amazon cheaper in 33, Noon in only 15, 92 exact ties. Amazon is usually cheaper-or-tied, not Noon |
| B15 | Tawveeri compares Amazon vs Noon prices for the same product | **YELLOW/PARTIAL** | ADR-294/295/298 | Real, but internal/shadow — not a promoted, publicly-labeled "Noon comparison" feature |

---

## C. Business/traffic facts relevant to any claim about scale, users, or revenue

| # | Fact | Value | Source | Use in content |
|---|---|---|---|---|
| C1 | Published products | 7,112 | `tawveeri.com/api/stats`, 2026-09-06 | Safe to cite as "thousands of products," never a precise-sounding "market-leading catalog" |
| C2 | Comparable (≥2-store) products | 1,384 | same | This is the honest denominator for any "we compare prices" claim — do not imply all 7,112 are multi-store comparable |
| C3 | Active serving stores | 8 (of 24 registry rows) | same, ADR-245 | Never cite "24 stores" — only 8 actually serve customer-facing results today |
| C4 | Real sessions, August 2026 | 419 (391 post-baseline) | `AUGUST-2026-FOUNDER-REVIEW.md` | Small, real, growing — do not round up or imply mass adoption |
| C5 | Sessions reaching a merchant | 64 (16.4%) | same | Real exit behavior exists; do not claim a specific "conversion rate" — no revenue is confirmed (see C6) |
| C6 | Confirmed affiliate revenue | **0 confirmed** — infrastructure built, 0 rows imported | same | Never claim "Tawveeri has earned/saved shoppers X SAR" as a company-revenue figure. Savings-per-shopper claims must instead cite the live per-product "وفّر X ريال" figures individually, which ARE real observed price deltas |

---

## D. Revalidation rule

Any row above marked with a live-repro query should be re-run before its first use in a published post if more than **14 days** have passed since `LAST VERIFIED`. Any YELLOW/RED row must never be silently promoted to GREEN by a social operator or by Grok — only a new dated ADR or a documented re-verification (added as a new lettered section here, never overwriting existing rows) can change a status.
