# TAWVEERI — LAUNCH VOCABULARY
**2026-07-30 · The product and the announcement must use exactly this language.**

> **الأقوى فينا ليس تغطيتنا — بل أننا نقول للناس ما لا نعرفه.**
> *The strongest thing we have is not our coverage — it is that we tell people what we don't know.*

---

## 1. STRINGS CHANGED TONIGHT — live on production

Every change **removes** an unsupported claim. None adds one.

| # | File | Key | Before | After |
|---|---|---|---|---|
| 1 | `messages/en/search.json` | `searchSubtitle` | "Compare prices across **5 stores in real-time**" | "Compare prices across **8 Saudi retailers**" |
| 2 | `messages/ar/search.json` | `searchSubtitle` | «قارن الأسعار عبر **5 متاجر في الوقت الفعلي**» | «قارن الأسعار عبر **8 متاجر سعودية**» |
| 3 | `messages/en/search.json` | `featureRealTime` | "**Real-time** search" | "**Instant** search" |
| 4 | `messages/en/coupons.json` | `featured` | "Exclusive Coupon Codes **Updated Regularly**" | "Exclusive Coupon Codes" |
| 5 | `messages/ar/coupons.json` | `featured` | «أكواد خصم حصرية **تُحدّث باستمرار**» | «أكواد خصم حصرية» |

**Rendered by:** `search-client.tsx` (1–3) · `coupons-client.tsx` (4–5).

### Second pass — four corrections applied before announcement

| # | File | Key | Before | After |
|---|---|---|---|---|
| 6 | `messages/ar/search.json` | `searchSubtitle` | «قارن الأسعار عبر 8 متاجر سعودية» | «ابحث في منتجات 8 متاجر سعودية، وقارن الأسعار المتاحة.» |
| 7 | `messages/en/search.json` | `searchSubtitle` | "Compare prices across 8 Saudi retailers" | "Search products from 8 Saudi retailers and compare available prices." |
| 8 | `messages/ar/coupons.json` | `featured` | «أكواد خصم **حصرية**» | «أكواد خصم» |
| 9 | `messages/en/coupons.json` | `featured` | "**Exclusive** Coupon Codes" | "Coupon Codes" |
| 10 | `messages/ar/coupons.json` | `subtitle` | «وفّر أكثر مع أكواد خصم **حصرية**» | «وفّر أكثر مع أكواد الخصم» |
| 11 | `messages/en/coupons.json` | `subtitle` | "Save more with **exclusive** coupon codes" | "Save more with coupon codes" |

**Why "8 retailers" had to be requalified:** the old phrasing read as *every product is compared
across eight retailers*. Search covers eight; an individual comparison is often two. Search
**coverage** and per-product comparison **depth** are different things and now read differently.

**Why "exclusive" had to go — and it is worse than it looked.** The check was meant to confirm
whether our coupons are contracted exclusively. **The `coupons` table is EMPTY: 0 rows, 0
active, 0 stores.** So "exclusive" was not merely unverified — there is no coupon data behind
the claim at all. A second instance in the page `subtitle` was caught by grepping the whole
file rather than only the flagged key.

**Two notes on parity, because a one-sided fix is how this survives an audit:**
- **#2 was invisible in the English-only audit.** Arabic said «في الوقت الفعلي» — literally "in real-time". Fixing only English would have left the claim standing for the majority of our users.
- **#3 is English-only on purpose.** Arabic already said «بحث فوري» = *instant search*, which describes search **speed**, not price currency, and is true. English "Real-time" sat next to prices and had to go. The two locales now carry the same meaning.
- **"5 stores" was also simply wrong** — search covers **8**.

---

## 2. WHAT WE CAN TRUTHFULLY SAY

### عربي
- «نقارن أسعار **758 منتجًا** بين متاجر سعودية.»
- «نعرض لك **من أي متجر** جاء السعر، و**متى رصدناه**.»
- «الرابط ينقلك إلى **نفس المنتج** في المتجر.»
- «لا ننشر توفيرًا إلا إذا **رصدناه بأنفسنا** — ورقمنا غالبًا **أقل** من رقم المتجر.»
- «**في العروض التي فحصناها، 70%** من الخصومات المعلنة كانت تقارن بسعر **لم يظهر في سجل رصدنا**.» *(انظر §7 — الرقم 70% وليس 71%، ويتحرك)*
- «نحتفظ بسجل أسعار **لا يمكن شراؤه بأثر رجعي**.»
- «حين لا نعرف، **نقول لا نعرف**.»

### English
- "We compare **758 products** across Saudi retailers."
- "We show **which retailer** each price came from, and **when we observed it**."
- "The link takes you to **that exact product**."
- "We publish a saving **only when we observed the drop ourselves** — our number is often **lower** than the retailer's."
- "**Among the offers we examined, 70%** of advertised discounts referenced a price that **never appeared in our observed history**." *(see §7 — the figure is **70**, not 71, and it moves)*
- «نبني سجل السعر من يوم رصدناه، ولا نعرض تاريخًا لم نملكه.» / "We build price history from the day we observe it; **we do not invent earlier data**."
  - Interface variant: «نعرض سجل السعر عندما تتوفر بيانات كافية.» / "Price history appears when enough observed data is available."
- "When we don't know, **we say so**."

---

## 3. WHAT WE MUST NOT SAY

### عربي
- ❌ «أسعار **لحظية** / **مباشرة** / **حالية** / **في الوقت الفعلي**»
- ❌ «نحدّث الأسعار **يوميًا** / **باستمرار** / كل ساعة» — أي وعد بجدول تحديث
- ❌ «نتابع **كل** الأسعار في السعودية» — أو أي ادعاء بتغطية شاملة
- ❌ «**5,023** منتجًا مقارنًا» — هذا حجم الكتالوج؛ **758** هو الرقم القابل للمقارنة
- ❌ ذكر **لولو** أو **شرف دي جي** كمصدر مقارنة
- ❌ «**شراكات رسمية** مع المتاجر» — لا توجد؛ برنامج أمازون التسويقي هو الوحيد

### English
- ❌ "**real-time** / **live** / **current** / **up-to-date** prices"
- ❌ "updated **daily** / **hourly** / **continuously**" — any refresh cadence
- ❌ "we track **every**/**all** prices in Saudi Arabia" — any comprehensive-market claim
- ❌ "**5,023** products compared" — that is the catalogue; **758** is comparable. Never merge them
- ❌ **LuLu** or **Sharaf DG** named as comparison sources
- ❌ "**Official partnerships** with retailers" — we have none; the Amazon affiliate programme is the only one
- ❌ "verified across 8 retailers" used as a **freshness** claim (8 is coverage, not currency)

### Never publish internal engineering figures
❌ **112/112 · 770/770 · 86/86 · any harness, test or gate result.** They are evidence for us,
not a benefit to a customer, and quoting them publicly invites a question we have no interest
in answering. The customer-facing translation of a passing gate is simply: *the journey works*.

❌ **"We hold price history no competitor can buy retroactively."** Competitor language, not
customer language — it answers nothing for a shopper and carries an implicit comparison. Use
the §2 replacement instead.

❌ **«حصرية» / "exclusive"** for coupons — the coupon table is empty; there is nothing to be
exclusive about.

**The rule when unsure: it goes in this list.**

---

## 4. THE REPLACEMENT VOCABULARY — past tense, evidence-anchored

| Use this | Not this |
|---|---|
| «رصدنا» / «آخر رصد» / «تاريخ الرصد» | «نحدّث» / «مباشر» / «لحظي» |
| «أعلى سعر رصدناه» | «أعلى سعر» |
| "observed" / "last observed" / "observation date" | "updated" / "live" / "real-time" |
| "highest price we observed" | "original price" |

---

## 5. LATENT COPY — not live, do NOT quote, fix in Week 1

These exist in the repo but render nowhere (0 component references), so they are **not** a launch blocker. They must not be reactivated without rewording.

- `messages/{ar,en}/agent.json :: measuredExitNote` — "Prices are updated from stores" / «الأسعار تُحدّث من المتاجر». A cadence claim. **Would be a blocker the moment it is wired into WAFFAR.**
- `messages/{ar,en}/search.json :: realTimeScrape`, `scrapeNote` — "Real-time Scrape".
- `messages/{ar,en}/landing.json :: features.*` — the legacy home block, replaced by `BetaLanding`. Contains **"Official partnerships with top stores"** / «شراكات رسمية مع أكبر المتاجر» — **factually untrue** — and "compares prices from all stores". Dead, but delete or rewrite before any reuse.
  - Its `alerts.stats` = "Real-time" / «إشعارات فورية» describes **notification speed, not price currency**, and is true. Left unchanged deliberately.

---

## 7. THE DISCOUNT-INTEGRITY FIGURE — methodology, so it may be published

**Status: REPRODUCIBLE ON DEMAND.** It stays in CAN SAY. But **the number is 70%, not 71%.**

**Reproduce it in one command — no credentials, public endpoint:**
```
curl -s https://tawveeri.com/api/v1/tps/discount-integrity
```

**Measured 2026-07-30 16:14:53 UTC** (`generated_at` is returned in the payload):

| field | value |
|---|---|
| **checkable listings (the sample size)** | **13,858** |
| `inflated_reference` | **9,661** |
| `verified_drop` | 372 |
| `stable` | 3,825 |
| `insufficient_history` (abstains, excluded) | 10,458 |
| superseded duplicate drops (suppressed) | 634 |
| **published share** | **9,661 ÷ 13,858 = 70%** |

**Definitions, stated exactly as the system computes them:**
- **"advertised discount"** = a listing where the retailer displays a "was" price.
- **"never observed"** (`inflated_reference`) = we never recorded that listing at or above the
  advertised "was" price during our tracked period. **It is not an accusation of fraud** — it
  says the reference price is one *we* did not see.
- **Listings with thin history abstain** (`insufficient_history`, 10,458) and are excluded from
  the denominator entirely, per ADR-134. This makes the figure *more* conservative, not less.

**It moves, and it has moved: 87.7% → 72% → 71% → 70%.** Earlier values used narrower
denominators on smaller populations and no longer reproduce. **Always re-run the command above
before quoting it, and quote it with its date.** If asked to defend it, show the endpoint — the
`methodology` and `neutrality` fields are returned in the response itself.

**Public wording (do not paraphrase):**
> عربي: «في العروض التي فحصناها، 70% من الخصومات المعلنة كانت تقارن بسعر لم يظهر في سجل رصدنا.»
> English: "Among the offers we examined, 70% of advertised discounts referenced a price that
> never appeared in our observed history."

**"Among the offers we examined" is load-bearing.** Without it the sentence reads as a
market-wide claim, which our own MUST NOT list forbids.

---

## 6. THE ONE-LINE FRAME

> **عربي:** «نُظهر لك السعر، ومن أين جاء، ومتى رصدناه — وحين لا نعرف، نقول ذلك.»
> **English:** "We show you the price, where it came from, and when we observed it — and when we don't know, we say so."
