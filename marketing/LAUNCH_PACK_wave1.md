# LAUNCH PACK — WAVE 1 (Controlled Demand Validation)
**Status: UNPUBLISHED.** Everything in this file is a draft awaiting founder review. No
account exists yet on any platform (see final report). Nothing here is scheduled.

**Evidence source:** marketing/SOCIAL_FACT_PACK_2026-08-04.md (measured 2026-08-04T09:28:20Z,
production `vyceqrzttspyycdpojtn`) + marketing/CLAIMS_LEDGER.md (claim_id references below).
**Voice/order source:** docs/LAUNCH_MARKETING_PLAYBOOK.md (§2 voice, §3 order, §4/§6 templates
— reused directly, not reinvented). **Vocabulary source:** docs/LAUNCH_VOCABULARY.md.
**Every price cited expires 48h from the Fact Pack's measurement time** (2026-08-06T09:28Z).
If this pack is used after that window, re-run `npx tsx scripts/tps-analysis/build-social-fact-pack.ts`
and refresh every number before publishing anything.

**Stop/continue thresholds, defined before any measurement exists (per KPI conventions
already in `scripts/tps-analysis/usage-report.ts`):** a piece **continues** (repeat the
hook/format) if it drives ≥10 qualified demand sessions (see docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md
§2) attributable via its `utm_content` within 72h of posting, AND generates no correction/
complaint about accuracy. A piece **stops** (do not repeat this hook/format, log why in
CONTENT_LEDGER.csv's `decision` column) if it drives <3 qualified demand sessions in 72h, OR
draws any reply/comment disputing the price/claim's accuracy (pull, re-verify, then decide
whether to correct-and-relink or retire).

---

## PART 1 — FIVE VIDEO SCRIPTS (TikTok primary; same asset reused as an Instagram Reel)

Format per docs/LAUNCH_MARKETING_PLAYBOOK.md §6: vertical, screen-recording of the real
product, no founder talking head, hook in the first 2 seconds, one CTA at the end.

### Video 1 — TV (proof pillar)
- **Hypothesis:** a concrete "X SAR difference across real Saudi retailers, here's the
  screen to prove it" hook converts better on TikTok than an abstract methodology pitch —
  TikTok is a discovery/proof engine, not an explainer channel (Growth System §5.1).
- **Hook (0-2s):** «قبل تشتري تلفزيون، شوف الفرق.» (Before you buy a TV, look at the gap.)
- **claim_id:** cdv-w1-claim-01
- **Script:**
```
0-2s   قبل تشتري تلفزيون، شوف الفرق.
2-6s   [تسجيل شاشة] كتابة "تلفزيون سامسونج" في بحث توفيري
6-13s  [النتائج] آخر سعر رصدناه: 1,649 ريال — من أمازون، رصدناه [تاريخ رصد فعلي عند النشر]
13-17s [الانتقال] صفحة المقارنة الكاملة — كل الأسعار اللي رصدناها لنفس الجهاز
17-20s وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.
```
- **CTA:** «جرّب توفيري — دوّر على المنتج اللي في بالك.» Link: `/ar/compare/samsung%7CMODEL%3AUA55U8000HUXSA?utm_source=tiktok&utm_medium=organic_social&utm_campaign=controlled_demand_validation_wave1&utm_content=cdv-w1-video-01`
- **Risk class:** LOW (headline offer 19h old at measurement time — see Fact Pack Candidate 5). Re-verify freshness the day of shoot/publish regardless.
- **Stop/continue:** per pack-level threshold above.

### Video 2 — Apple Watch 11 (proof pillar, aspirational category)
- **Hypothesis:** a wearable/aspirational product widens the audience beyond deal-hunters
  to "considering a purchase" browsers — tests whether the format works outside pure
  price-sensitive categories.
- **Hook (0-2s):** «تفكر تشتري Apple Watch؟ شوف وين أرخص.»
- **claim_id:** cdv-w1-claim-02
- **Script:**
```
0-2s   تفكر تشتري Apple Watch؟ شوف وين أرخص.
2-6s   [تسجيل شاشة] كتابة "Apple Watch 11" في بحث توفيري
6-13s  [النتائج] آخر سعر رصدناه: 1,579 ريال — من أمازون
13-17s [الانتقال] المقارنة: نفس الساعة عند متاجر ثانية بأسعار مختلفة
17-20s وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.
```
- **CTA:** link to the product's compare page with `utm_content=cdv-w1-video-02`.
- **Risk class:** LOW (141h old headline offer — inside the "cite individually" comfort
  zone but re-verify at publish; 4 of the other 4 retailer rows on this candidate are >7d
  old, so do NOT name those other retailers/prices on screen, only the headline one).
- **Stop/continue:** per pack-level threshold.

### Video 3 — Philips Air Fryer (proof pillar, mass-market ticket size)
- **Hypothesis:** a lower price-point, mass-owned appliance category tests whether the
  hook works for everyday purchases, not just big-ticket electronics.
- **Hook (0-2s):** «قلاية هوائية؟ شوف فرق السعر قبل لا تطلبها.»
- **claim_id:** cdv-w1-claim-03
- **Script:**
```
0-2s   قلاية هوائية؟ شوف فرق السعر قبل لا تطلبها.
2-7s   [تسجيل شاشة] كتابة "قلاية هوائية فيليبس" في بحث توفيري
7-15s  [النتائج] آخر سعر رصدناه: 779 ريال — والفرق بين أرخص وأغلى متجر رصدناه: 590 ريال
15-20s [الانتقال] صفحة المنتج نفسها عند المتجر
20-25s وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.
```
- **CTA:** compare-page link, `utm_content=cdv-w1-video-03`.
- **Risk class:** LOW (headline 39h old).
- **Stop/continue:** per pack-level threshold.

### Video 4 — Philips Blender (proof pillar, small-ticket honesty test)
- **Hypothesis:** a small-ticket item (119 SAR) tests whether "even small purchases are
  worth checking" resonates, or whether the format only works for expensive items.
- **Hook (0-2s):** «حتى الخلاط... تفرق فيه ٧٠ ريال؟»
- **claim_id:** cdv-w1-claim-04
- **Script:**
```
0-2s   حتى الخلاط... تفرق فيه 70 ريال؟
2-6s   [تسجيل شاشة] كتابة "خلاط فيليبس" في بحث توفيري
6-13s  [النتائج] آخر سعر رصدناه: 119 ريال — وأغلى متجر رصدناه: 189 ريال
13-17s [الانتقال] صفحة المقارنة الكاملة
17-20s وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.
```
- **CTA:** compare-page link, `utm_content=cdv-w1-video-04`.
- **Risk class:** LOW (headline 107h old — inside window, re-verify at publish).
- **Stop/continue:** per pack-level threshold.

### Video 5 — Trust/differentiation (no single product; the "why" piece)
- **Hypothesis:** after four proof pieces, one piece explaining the discount-integrity
  finding builds the differentiation Master Book/Playbook §1 calls for ("our finding is a
  measurement against a standard that already exists, not an accusation").
- **Hook (0-2s):** «وش اللي نقيسه فعلاً؟» (What do we actually measure?)
- **claim_id:** cdv-w1-claim-05 (MUST be re-curled same-day as publish, per its ledger entry)
- **Script:**
```
0-2s   وش اللي نقيسه فعلاً؟
2-8s   [نص على الشاشة] من بين العروض اللي فحصناها، 60% أشارت إلى سعر "كان" ما رصدناه إحنا
8-14s  [تسجيل شاشة] صفحة منتج تعرض "آخر سعر رصدناه" — مو "السعر الحالي"
14-18s [نص] ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا
18-24s وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.
```
*(60% is this session's live re-curl, 2026-08-04T09:38:13Z — 9,003/15,010 checkable listings.
It is ALREADY different from the 70% cached in LAUNCH_VOCABULARY/LAUNCH_MARKETING_PLAYBOOK,
proof the drift is real. Re-curl `https://tawveeri.com/api/v1/tps/discount-integrity` again
the day this is actually filmed — do not trust even 60% past today.)*
- **CTA:** homepage link, `utm_content=cdv-w1-video-05`.
- **Risk class:** MEDIUM — this is the one piece whose number is guaranteed to have moved
  since measurement (documented history: 87.7%→72%→71%→70%→60% today). Do not shoot until
  same-day re-verification.
- **Stop/continue:** per pack-level threshold; additionally, pull immediately if any reply
  disputes the methodology (Ministry of Commerce framing exists precisely to keep this
  measurement-not-accusation, per Playbook §1).

---

## PART 2 — TEN X POSTS

### Thread (5 parts — Playbook §4 template, reused verbatim in structure, adapted wording
kept as close to the approved template as the content allows)

**cdv-w1-x-01 — Post 1 (the benefit) — claim_id cdv-w1-claim-07**
```
قبل تشتري، شوف فرق السعر.

أطلقنا توفيري — منصة سعودية تساعدك تدوّر على منتجك، وتقارن الأسعار
المتاحة من متاجر سعودية.

نبيّن لك من أي متجر جا السعر، ومتى رصدناه، وننقلك لصفحة المنتج نفسه.

ما زلنا في البداية، والتغطية مو كاملة. وإذا ما عرفنا، نقولها بوضوح.

جرّبه، ودوّر على المنتج اللي في بالك.
tawveeri.com/ar?utm_source=x&utm_medium=organic_social&utm_campaign=controlled_demand_validation_wave1&utm_content=cdv-w1-x-01
```

**cdv-w1-x-02 — Reply 1 (the difference) — claim_id cdv-w1-claim-08**
```
وش المختلف في توفيري؟

ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا.

لذلك قد يكون رقم التوفير عندنا أقل من رقم المتجر — لكنه رقم نقدر
نشرح كيف وصلنا له.
```

**cdv-w1-x-03 — Reply 2 (the proof, real spread we observed) — claim_id cdv-w1-claim-03**
```
مثال حقيقي رصدناه بأنفسنا:

قلاية هوائية فيليبس 9 لتر — أرخص متجر رصدناه: 779 ريال، أغلى متجر
رصدناه: 1,369 ريال. فرق 590 ريال على نفس المنتج بالضبط.

[صورة: صفحة المقارنة في توفيري، تُلتقط طازجة يوم النشر]
```
*Note: unlike the original Playbook example (a retailer's advertised "was" price vs ours),
this version cites only our OWN observed cross-retailer spread — no specific "retailer
advertised X, we say Y" comparison exists as verified evidence this session, so none is
claimed. Do not add one without a fresh, dated instrument backing it.*

**cdv-w1-x-04 — Reply 3 (the measurement, conditional) — claim_id cdv-w1-claim-05**
```
في العروض اللي فحصناها، 60% من الخصومات المعلنة كانت تقارن بسعر
ما ظهر في سجل رصدنا أبدًا.

لهذا نبيّن لك أعلى سعر رصدناه، بدل ما نكرر السعر المشطوب.
```
*(60% = this session's live re-curl, 2026-08-04T09:38:13Z. Re-curl again at actual publish.)*
**Do not post without re-curling the figure same-day** (see claim-05). If not reproducible
that day, drop this reply from the thread entirely — the Playbook explicitly allows dropping
this reply rather than posting stale evidence.

**cdv-w1-x-05 — Reply 4 (the invitation) — claim_id cdv-w1-claim-06**
```
هذي أول نسخة من توفيري.

جرّبه، ودوّر على منتج تفكر تشتريه، وقول لنا:
وش لقيت؟ ووين أخطأنا؟
```

### Five standalone single posts

**cdv-w1-x-06 — TV — claim_id cdv-w1-claim-01**
```
تلفزيون سامسونج UA55U8000HUXSA — آخر سعر رصدناه: 1,649 ريال (أمازون).
شوف باقي المتاجر اللي رصدنا فيها نفس الجهاز:
[رابط المقارنة]?utm_source=x&utm_medium=organic_social&utm_campaign=controlled_demand_validation_wave1&utm_content=cdv-w1-x-06
```

**cdv-w1-x-07 — Apple Watch — claim_id cdv-w1-claim-02**
```
Apple Watch 11 46mm — آخر سعر رصدناه: 1,579 ريال (أمازون).
[رابط المقارنة]?...&utm_content=cdv-w1-x-07
```

**cdv-w1-x-08 — Air fryer — claim_id cdv-w1-claim-03**
```
قلاية هوائية فيليبس 9 لتر — آخر سعر رصدناه: 779 ريال.
فرق 590 ريال بين أرخص وأغلى متجر رصدناه لنفس القلاية بالضبط.
[رابط المقارنة]?...&utm_content=cdv-w1-x-08
```

**cdv-w1-x-09 — Blender — claim_id cdv-w1-claim-04**
```
خلاط فيليبس 450 واط — آخر سعر رصدناه: 119 ريال.
حتى المنتجات الصغيرة، يفرق فيها السعر بين المتاجر.
[رابط المقارنة]?...&utm_content=cdv-w1-x-09
```

**cdv-w1-x-10 — Listening prompt (no claim, pure engagement) — no claim_id**
```
وش آخر منتج دوّرت له قبل ما تشتريه؟
قول لنا في الردود، وجرّبه في توفيري — نبيله لك أسعاره اللي رصدناها.
tawveeri.com/ar?utm_source=x&utm_medium=organic_social&utm_campaign=controlled_demand_validation_wave1&utm_content=cdv-w1-x-10
```

---

## PART 3 — TWO CAROUSELS (Instagram)

### cdv-w1-carousel-01 — "كيف يشتغل توفيري" (How Tawveeri works), 6 slides
Order per Playbook §3: benefit → how it works → evidence → limits, honesty line as the CLOSE.
1. **Benefit:** «قبل تشتري، شوف فرق السعر.»
2. **How it works (1):** «تدوّر على منتجك في توفيري.» [screenshot: search]
3. **How it works (2):** «نبيّن لك من أي متجر جا السعر، ومتى رصدناه.» [screenshot: result card with "آخر سعر رصدناه" label]
4. **Evidence — claim-08:** «ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا.»
5. **Limits — claim-07:** «ما زلنا في البداية، والتغطية مو كاملة.» (uncounted, no catalog-size figure per vocabulary)
6. **Close — claim-06:** «وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.» + link with `utm_content=cdv-w1-carousel-01`

### cdv-w1-carousel-02 — "أسعار رصدناها هالأسبوع" (Prices we caught this week), 5 slides
One slide per product (TV, Apple Watch, air fryer, blender), each showing: product name,
"آخر سعر رصدناه" + value + retailer + observation date (pulled fresh from the Fact Pack at
publish time, not these cached numbers), closing slide repeats claim-06 honesty line + link
with `utm_content=cdv-w1-carousel-02`.
**Before assembling this carousel, re-run** `npx tsx scripts/tps-analysis/build-social-fact-pack.ts`
**and use whatever numbers that run produces — never the numbers frozen in this document once
more than 48h have passed since 2026-08-04T09:28:20Z.**

---

## Pre-publish checklist (every piece, no exceptions)
1. Re-run the Fact Pack if >48h have passed since 2026-08-04T09:28:20Z; update every price.
2. Re-curl the discount-integrity figure same-day for any piece using claim-05.
3. Confirm the destination URL is live and the UTM string matches marketing/UTM_CONVENTION.md.
4. Confirm no LuLu/Sharaf DG retailer is named (Fact Pack candidates used here don't include
   either, but re-check on any substitution).
5. Founder approval state on every claim_id used must read `APPROVED`, not
   `PENDING_FOUNDER_APPROVAL`, before anything is scheduled.
