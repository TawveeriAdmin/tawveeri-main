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
- «**71%** من الخصومات المعلنة تشير إلى سعر **لم نرصده أبدًا**.»
- «نحتفظ بسجل أسعار **لا يمكن شراؤه بأثر رجعي**.»
- «حين لا نعرف، **نقول لا نعرف**.»

### English
- "We compare **758 products** across Saudi retailers."
- "We show **which retailer** each price came from, and **when we observed it**."
- "The link takes you to **that exact product**."
- "We publish a saving **only when we observed the drop ourselves** — our number is often **lower** than the retailer's."
- "**71%** of advertised discounts reference a price **we never observed**."
- "We hold price history **no competitor can buy retroactively**."
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

## 6. THE ONE-LINE FRAME

> **عربي:** «نُظهر لك السعر، ومن أين جاء، ومتى رصدناه — وحين لا نعرف، نقول ذلك.»
> **English:** "We show you the price, where it came from, and when we observed it — and when we don't know, we say so."
