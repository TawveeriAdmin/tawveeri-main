# LAUNCH BLOCKERS — FOUNDER UX AUDIT
**2026-07-29 · Every item below is a real observation from the live site**

---

## 0. THE ROOT CAUSE — read this first

The founder's instinct that something feels "random" is correct, and it has a single
cause. It is not randomness. **It is two systems answering the same question
differently inside one user journey.**

Last night's finding (to be recorded as a correction to ADR-125):
> System A is **not** isolated. `searchTPSCanonical` connects it for mobile and AC.
> The connection value is "**~172 served → extend to ~564**", not "0 → 564".

So:

| Surface | Data source | Knows multi-store? |
|---|---|---|
| Search results card | `searchTPSCanonical` (System A) | **Yes** — shows "4 متاجر" |
| وفّر agent | System A | **Yes** — says "مقارنة موثّقة في 5 متاجر" |
| **Compare page** | **Storefront (System B)** | **No** — "لا تتوفر مقارنة" |

**The user is told a comparison exists, clicks to see it, and is told it does not.**
Twice, on two different products, through two different entry points.

This is the missing link. Every symptom below is either this bug, a consequence of it,
or a rendering defect layered on top of it.

**Fixing this one thing removes the feeling of randomness.**

---

## 1. CONTRADICTIONS — highest severity, launch blockers

| # | What the user saw | Severity |
|---|---|---|
| **A1** | `apple iPhone 16 128GB` search card shows badge **"4 متاجر"**. Clicking **قارن الأسعار** → *"لا تتوفر مقارنة أسعار متعددة المتاجر لهذا المنتج حالياً"* | 🔴 BLOCKER |
| **A2** | وفّر recommends LG Split 18000 with **"مقارنة موثّقة في 5 متاجر"**. Clicking compare on the same product → *"لا تتوفر مقارنة"* | 🔴 BLOCKER |
| **A3** | وفّر card states **"سعر الجهاز ١,٥٦٠"** in the cost breakdown, and **"انخفاض حقيقي: كان 4109 وأصبح 2799"** in the same card. Two different prices for one product, one card | 🔴 BLOCKER |

**Rule to enforce:** a store count must never be displayed unless the compare page can
honour it. If the compare page cannot render N stores, the badge must not claim N.

---

## 2. THE SAVINGS-GATE HOLE — verify urgently

The وفّر card published: **"انخفاض حقيقي: كان 4109 وأصبح 2799 — توفير 32% مؤكَّد برصدنا"**

Extra's own live page for that AC shows: **2,799, was 4,109, 31.88% خصم**

**These are identical.** Either we genuinely observed 4,109 in our own price history, or
we are echoing Extra's claimed "was" and labelling it "مؤكَّد برصدنا".

ADR-051 measured Extra's advertised discounts as 100% inflated. If the agent path is
echoing the merchant, SAVINGS_GATE has a hole exactly where it matters most — on a
recommendation, presented as verified.

**Check `tps_listing_price_facts`: did we observe 4,109 ourselves, on which dates?**
If not, the agent path must be gated like the other four surfaces.

---

## 3. PRICE ACCURACY

| # | Issue |
|---|---|
| **B1** | وفّر total: **٣,١٠٦** = device 1,560 + install 350 + electricity ~1,196. But Extra's live device price is **2,799**. The 1,560 matches nothing on the page the user reached |
| **B2** | Founder reports going to the store and finding **Extra cheaper** than what we showed |

Establish which product our 1,560 belongs to, whether it is the same unit we
recommended, and whether it is live and in stock.

---

## 4. SEARCH

| # | Issue | Severity |
|---|---|---|
| **C1** | **Instability.** Cowork confirmed independently: re-running `نوفيا 16` returned washing machines and fans (sc=1, no TPS injection), where the same query earlier returned 4 real retailers. **TPS injection and/or relevance is intermittent** | 🔴 BLOCKER |
| **C2** | Searching from the results page opens a **new search** instead of refining the current one | 🟠 |
| **C3** | Results contain a product the user never searched for (a Jarir item appeared unprompted) | 🟠 |
| **C4** | No low→high option presentation. Founder expected 3 options ascending; got one price with no ordering context | 🟠 |
| **C5** | Clicking a product image navigates to a store at random rather than the product | 🟠 |
| **C6** | External reviewer: searching `iphone` returned **0 results**. Founder searching `جوال ايفون ١٦` returned **42**. Latin-script queries appear broken | 🔴 |
| **C7** | External reviewer: category pages (e.g. Phones) return **404** | 🔴 |

---

## 5. PRODUCT CARDS AND COMPARE PAGE

| # | Issue |
|---|---|
| **D1** | Store names render garbled and overlapping: **"جر اك أم ال"** — appears to be truncated store names colliding |
| **D2** | **"أفضل سعر"** badge appears on single-store products. With one offer there is no "best" — this is a false claim |
| **D3** | Metric boxes are inconsistent. `iPhone 16 256GB` shows three (أرخص / أعلى / توفّر). `iPhone 16 Plus 256GB` shows only أرخص. Same page type, different anatomy |
| **D4** | Offers list shows **"في المتاجر"** as text with no obvious link. The founder could not easily reach the retailer |
| **D5** | Founder clicked a 2,399 result and **could not tell which store it belonged to** |
| **D6** | `iPhone 16 256GB` compares Amazon **(256 GB) - Black** against Extra **White, 256GB**. Per TPS rules colour should not split a canonical — but the user sees two different colours presented as one product with no explanation. Either state that colour does not affect the comparison, or show the colour available at each store |

---

## 6. وفّر AGENT

| # | Issue |
|---|---|
| **E1** | User asked: *"ابي مكيف رخيص لغرفه ٤٠ متر"*. Agent replied: *"أضف مساحة الغرفة (بالمتر) لأحسب السعة المناسبة بدقة"* — **the area was already given**. Arabic numeral and phrasing parsing failure |
| **E2** | Response is too long and scattered. Founder: *"ما اعرف احسها كثير ومشتته"* |
| **E3** | Confidence shown as **74/100** with no explanation of what it means or what would raise it |
| **E4** | The cost model (device + install + annual electricity) is genuinely excellent and unique — but it is buried under noise, and its device price is wrong (§3) |

---

## 7. COPY AND POSITIONING

| # | Issue |
|---|---|
| **F1** | Remove: *"نسخة تجريبية عامة · نضيف متاجر ومقارنات باستمرار"* — it invites the reviewer's verdict before they see the product |
| **F2** | Rewrite the headline. Current: *"قارن أسعار الإلكترونيات عبر متاجر السعودية — بالأدلة، لا أرقام مسوّقة"* |
| **F3** | Competitor benchmark — Rakhys: *"أذكى تطبيق لمقارنة أسعار الإلكترونيات في السعودية"* |

### Headline research

Global comparison platforms lead on a **single differentiating mechanism**, not on
breadth:
- **CamelCamelCamel** — Amazon price history, alerts, historical charts
- **Idealo** — price history and trends, shipping included in total, side-by-side
- **PriceRunner** — strong filtering plus price history
- **Honey** — Droplist: add an item, get notified when the price drops

**Every leading platform's hook is price history or price drop alerts — which is
exactly what Tawveeri uniquely has in Saudi Arabia and does not say.**

Candidate headlines, to be tested rather than chosen by opinion:

1. **"نتتبّع الأسعار بأنفسنا — فنعرف متى التخفيض حقيقي"**
2. **"قبل ما تشتري: هل السعر نزل فعلاً؟"**
3. **"أسعار الجوالات والأجهزة المنزلية في السعودية — بالدليل، لا بالإعلان"**
4. **"٦٥٪ من التخفيضات المعلنة تشير إلى سعر لم نرصده يومًا"**
5. **"مقارنة أسعار مبنية على رصد حقيقي، لا على ما يقوله المتجر"**

Sub-line must name the categories in plain Saudi Arabic: **الجوالات · اللابتوبات ·
الشاشات · المكيفات · الغسالات · الثلاجات · الأجهزة المنزلية**.

---

## 8. EXTERNAL REVIEW — a stranger's verdict, unprompted

An independent AI review of the live site scored it **6.5/10** and reported:
- `iphone` → 0 results
- Category pages → 404
- ~15 products on some pages, mostly laptops
- No price alerts, no filters worth the name, no app
- Positioned it against Pricena and noted "بدون عمولة" as the potential edge

**The reviewer identified the right differentiator and could not find the product.**
Everything in §1–§6 explains why.

---

## 9. DEPLOYMENT — standing rule

Every completed, approved change is committed, pushed, **and verified live on Railway**
in the same session. Report the deployment status and the live URL checked.
Work that is not deployed does not exist.

---

## 10. SYSTEM A — do not lose it

Correct ADR-125: System A is **not** isolated. `searchTPSCanonical` connects it for
mobile and AC. Connection value is **~172 served → extend to ~564**, not 0 → 564.

Extending that connection to the **compare page** is the fix for §1. It is no longer a
future phase — it is the launch blocker.
