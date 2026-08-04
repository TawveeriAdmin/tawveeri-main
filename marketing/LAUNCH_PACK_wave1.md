# LAUNCH PACK — WAVE 1 (Controlled Demand Validation)
**Status: FOUNDER-REVIEW CHECKPOINT CLOSED, 2026-08-04. Still fully unpublished.** Every
content item below remains `DRAFT`/`PENDING_FOUNDER_APPROVAL`/`HOLD` — nothing has been
published, scheduled, or approved for execution. This document was corrected during the
founder-review cycle (see HANDOVER checkpoint #47, ADR-208) to match the final approved-for-
review package. Founder decisions on the content table are **deferred** until the founder is
ready to begin public execution.

**Account status (verified, no credentials requested or handled):**
- **X: @Tawveeri exists** but is not connected or authorised for this workflow.
- **TikTok, Instagram, Snapchat:** no clearly matching public account was found during the
  check. This is not a claim that no account exists, and it is **not** a claim that the
  username "tawveeri" is available — availability is only confirmed by the founder at actual
  account-creation time.
- Account creation and connection are both deferred until the founder is ready.

**Evidence source:** marketing/SOCIAL_FACT_PACK_2026-08-04.md (measured 2026-08-04T09:28:20Z,
production `vyceqrzttspyycdpojtn`) + marketing/CLAIMS_LEDGER.md (claim_id references below).
**Voice/order source:** docs/LAUNCH_MARKETING_PLAYBOOK.md (§2 voice, §3 order, §4/§6 templates
— reused directly, not reinvented). **Vocabulary source:** docs/LAUNCH_VOCABULARY.md.

**Approval of any price-bearing item below is approval of its TEMPLATE AND SCRIPT ONLY.**
Every price, retailer, timestamp and landing journey must be revalidated immediately before
filming, scheduling or publishing — regardless of how much time has passed. The 48h figure
below is the Fact Pack snapshot's own expiry, not a guarantee that a price claim stays valid
for that whole window; revalidate same-day, always, even at hour 1.
**Every price cited expires 48h from the Fact Pack's measurement time** (2026-08-06T09:28Z) —
past that window the snapshot is unusable outright and the Fact Pack must be re-run
(`npx tsx scripts/tps-analysis/build-social-fact-pack.ts`) before any further use.

**Metrics framing (SAFJ / SDGS — governing definitions, docs/TAWVEERI_SOCIAL_GROWTH_SYSTEM.md
§2, formalized 2026-08-04):**
- **SAFJ (Social-attributed Fulfilled Journey):** a social-attributed session that either
  opens a valid comparison for one canonical product with ≥2 displayable retailers, or
  produces an attributable merchant outbound click from a verified product/comparison route.
- **SDGS (Social Demand Gap Session):** a social-attributed session that produces a
  zero-result query, a meaningful reformulation, unresolved purchase intent, or a requested
  product with no fulfillable comparison.
- Kept strictly separate — a session is never counted as both, and neither is redefined or
  merged with the other.

**Stop/continue thresholds are an early OBSERVATION checkpoint, not a definitive pass/fail
verdict** — especially at this account's pre-launch size (a handful of followers or fewer,
first posts ever; real-traffic baseline is 25 real sessions/30 days before any social push).
A piece is **worth repeating** (same hook/format again) if it drives ≥10 SAFJ attributable via
its `utm_content` within 72h of posting, AND draws no correction/complaint about accuracy. A
piece is **worth pausing** (do not repeat this hook/format yet, log why in CONTENT_LEDGER.csv's
`decision` column) if it drives <3 SAFJ in 72h, OR draws any reply/comment disputing the
price/claim's accuracy (pull, re-verify, then decide whether to correct-and-relink or retire).
Report SAFJ, SDGS, impressions, link clicks and attributed sessions **separately**, never
blended into one pass/fail number, and always alongside the sample-size caveat above.

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

### Video 5 — Trust/differentiation (no single product; the "why" piece) — **HOLD**
**Status: HOLD.** Excluded from the recommended first batch and from any batch until
re-measured same-day at actual publish time (see rollback/correction on claim-05).
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

### Launch thread — FOUR parts (x-04 excluded, not a gap in a five-part count)
**Correction, 2026-08-04:** x-04 (the discount-integrity reply) is on HOLD — see below — and
is **not** part of the numbered thread. The thread that actually runs is four parts:
x-01 → x-02 → x-03 → x-05, labeled 1/4 → 4/4. The posted tweet text itself never contained an
explicit "1/5" or "1/4" label (X's own UI chains replies visually); this numbering is internal
reference only, now corrected to match what will actually be published — never "1/5 → 5/5"
with a silent gap at part 4. Recommended sequence: **x-01 is published and pinned FIRST**
(the anchor/launch post), the three replies complete the thread shortly after, and only THEN
does any single per-product post (x-06 onward) go out, each after its own same-day
revalidation. TikTok content does not enter this sequence at all — it is gated entirely on
TikTok account creation, independent of X's timeline.

**cdv-w1-x-01 — Part 1/4 (the benefit, published + pinned first) — claim_id cdv-w1-claim-07**
```
قبل تشتري، شوف فرق السعر.

أطلقنا توفيري — منصة سعودية تساعدك تدوّر على منتجك، وتقارن الأسعار
المتاحة من متاجر سعودية.

نبيّن لك من أي متجر جا السعر، ومتى رصدناه، وننقلك لصفحة المنتج نفسه.

ما زلنا في البداية، والتغطية مو كاملة. وإذا ما عرفنا، نقولها بوضوح.

جرّبه، ودوّر على المنتج اللي في بالك.
tawveeri.com/ar?utm_source=x&utm_medium=organic_social&utm_campaign=controlled_demand_validation_wave1&utm_content=cdv-w1-x-01
```

**cdv-w1-x-02 — Part 2/4 (the difference) — claim_id cdv-w1-claim-08**
```
وش المختلف في توفيري؟

ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا.

لذلك قد يكون رقم التوفير عندنا أقل من رقم المتجر — لكنه رقم نقدر
نشرح كيف وصلنا له.
```

**cdv-w1-x-03 — Part 3/4 (the proof, real spread we observed) — claim_id cdv-w1-claim-03**
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

**cdv-w1-x-04 — HOLD, excluded from the thread — claim_id cdv-w1-claim-05**
**Status: HOLD.** Not part of the 4-part thread that runs — the thread ends at x-05 (4/4).
```
في العروض اللي فحصناها، 60% من الخصومات المعلنة كانت تقارن بسعر
ما ظهر في سجل رصدنا أبدًا.

لهذا نبيّن لك أعلى سعر رصدناه، بدل ما نكرر السعر المشطوب.
```
*(60% = this session's live re-curl, 2026-08-04T09:38:13Z. Re-curl again at actual publish.)*
**Do not post without re-curling the figure same-day** (see claim-05). Excluded from the
recommended first sequence entirely, per the same volatility that holds video-05.

**cdv-w1-x-05 — Part 4/4, thread close (the invitation) — claim_id cdv-w1-claim-06**
```
هذي أول نسخة من توفيري.

جرّبه، ودوّر على منتج تفكر تشتريه، وقول لنا:
وش لقيت؟ ووين أخطأنا؟
```

### Five standalone single posts (recommended: SECOND in the sequence, after the thread,
each gated on its own same-day price/journey revalidation — not part of the smallest first
move, which is x-01 alone)

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
Both gated on Instagram account creation (no clearly matching account found during this
session's check) in addition to any content-approval status below.

### cdv-w1-carousel-01 — "كيف يشتغل توفيري" (How Tawveeri works), 6 slides
Order per Playbook §3: benefit → how it works → evidence → limits, honesty line as the CLOSE.
**Correction, 2026-08-04:** this carousel's claim association was fixed in
`marketing/CLAIMS_LEDGER.md` and `marketing/CONTENT_LEDGER.csv` — it uses claim-06/07/08 only;
the discount-integrity claim (claim-05) was never in its actual slide copy and the earlier
ledger cross-reference listing it was a bookkeeping error, now corrected in both files.
1. **Benefit:** «قبل تشتري، شوف فرق السعر.»
2. **How it works (1):** «تدوّر على منتجك في توفيري.» [screenshot: search]
3. **How it works (2):** «نبيّن لك من أي متجر جا السعر، ومتى رصدناه.» [screenshot: result card with "آخر سعر رصدناه" label]
4. **Evidence — claim-08:** «ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا.»
5. **Limits — claim-07:** «ما زلنا في البداية، والتغطية مو كاملة.» (uncounted, no catalog-size figure per vocabulary)
6. **Close — claim-06:** «وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.» + link with `utm_content=cdv-w1-carousel-01`

### cdv-w1-carousel-02 — "أسعار رصدناها هالأسبوع" (Prices we caught this week), 5 slides — **HOLD**
**Status: HOLD.** Most time-sensitive item in the pack — it bundles four prices at once.
Exact slide copy (this session's snapshot, template only):
1. تلفزيون سامسونج UA55U8000HUXSA — آخر سعر رصدناه: 1,649 ريال (أمازون) — رُصد بتاريخ [يُحدَّث يوم التجميع الفعلي]
2. ساعة Apple Watch 11 46mm — آخر سعر رصدناه: 1,579 ريال (أمازون) — رُصد بتاريخ [يُحدَّث يوم التجميع الفعلي]
3. قلاية هوائية فيليبس 9 لتر — آخر سعر رصدناه: 779 ريال — رُصد بتاريخ [يُحدَّث يوم التجميع الفعلي]
4. خلاط فيليبس 450 واط — آخر سعر رصدناه: 119 ريال — رُصد بتاريخ [يُحدَّث يوم التجميع الفعلي]
5. **Close — claim-06:** «وإذا ما عرفنا، نقولها بوضوح. جرّب توفيري.» + link with `utm_content=cdv-w1-carousel-02`

Even after HOLD is lifted, all four prices above must be re-measured in full on the actual
assembly day — `npx tsx scripts/tps-analysis/build-social-fact-pack.ts` — no exceptions, and
never carried forward from this document once more than 48h have passed since
2026-08-04T09:28:20Z.

---

## PART 4 — FIVE REPLY DRAFTS (voice/style examples only — not replies to any real post)

No real post has been replied to yet — the X account is not connected and no listening has
begun (see `marketing/X_LISTENING_LEXICON.md`). These five are illustrative scenario
templates approving the **voice and structure only**. Approving them authorizes nothing to be
sent: every real discovered-intent reply still requires human review and manual sending
(`marketing/RESPONSE_POLICY.md`), regardless of this approval.

**reply-01 — high buying intent**
*Scenario (hypothetical):* "ابغى اشتري تلفزيون سامسونج بس ما ادري وين ارخص سعر"
```
آخر سعر رصدناه لهذا التلفزيون كان 1,649 ريال عند أمازون بتاريخ [التاريخ الفعلي وقت الرد] —
تقدر تشوف باقي المتاجر اللي رصدنا فيها نفس الجهاز من هنا: [رابط مقارنة محدد]
```

**reply-02 — comparison question**
*Scenario (hypothetical):* "ايش الفرق بين توفيري ومواقع الكوبونات؟"
```
ما نحسب التوفير من رقم مشطوب. نحسبه من أسعار رصدناها بأنفسنا — عشان كذا رقمنا قد يكون أقل
من رقم المتجر، بس نقدر نشرح كيف وصلنا له.
```

**reply-03 — fake-discount complaint (MEDIUM risk — never names a retailer negatively)**
*Scenario (hypothetical):* "هذا المتجر يسوي خصم وهمي، يرفعون السعر قبل العرض!"
```
نقيس هذا الموضوع فعلاً بدل ما نفترضه. من العروض اللي فحصناها، نسبة منها تشير لسعر ما رصدناه
إحنا من قبل — يعني مو بالضرورة تلاعب، بس هو سعر ما شفناه إحنا. إذا حاب نشوف آخر سعر رصدناه
لنفس المنتج، قول لي اسمه.
```

**reply-04 — deal-rumor verification**
*Scenario (hypothetical):* "سمعت إن فيه عرض قوي على قلاية فيليبس الهوائية، حد يعرف إذا صحيح؟"
```
ما نقدر نأكد عروض ما رصدناها إحنا بأنفسنا. آخر سعر رصدنا له كان 779 ريال بتاريخ [كذا] — إذا
عندك رقم مختلف، ودّينا نتأكد.
```

**reply-05 — general thanks/engagement**
*Scenario (hypothetical):* "جربت توفيري اليوم، طلعت مفيدة!"
```
يعطيك العافية! إذا لقيت شي غلط أو ناقص، قول لنا نصلّحه — نبي نكون صريحين حتى مع أخطائنا.
```

---

## Corrected recommended posting order (illustrative sequencing only — nothing scheduled)
1. **x-01** — publish first, then pin manually on @Tawveeri (once connected and approved).
2. **x-02 → x-03 → x-05** — complete the 4-part launch thread as replies under x-01.
3. **x-06** — only after same-day revalidation of the TV price/retailer/link.
4. **x-07, x-08, x-09** — each only after its own same-day revalidation.
5. **x-10** — no claim, no revalidation needed, anytime in the sequence.
6. **video-01 through video-04** — begin only once a TikTok account exists; independent of
   the X sequence above, each still needs same-day revalidation at time of filming.
7. **carousel-01** — begins only once an Instagram account exists.
8. **Held indefinitely within this wave:** video-05, x-04, carousel-02.

## Pre-publish checklist (every piece, no exceptions)
1. Re-run the Fact Pack if >48h have passed since 2026-08-04T09:28:20Z; update every price —
   and even inside that window, revalidate immediately before actual use regardless (see the
   template-approval note at the top of this document).
2. Re-curl the discount-integrity figure same-day for any piece using claim-05 (video-05,
   x-04) — both remain HOLD until this happens AND the founder lifts the hold explicitly.
3. Confirm the destination URL is live and the UTM string matches marketing/UTM_CONVENTION.md.
4. Confirm no LuLu/Sharaf DG retailer is named (Fact Pack candidates used here don't include
   either, but re-check on any substitution).
5. Founder approval state on every claim_id used must read `APPROVED`, not
   `PENDING_FOUNDER_APPROVAL`, before anything is scheduled.
6. Confirm the target account exists and is connected/created before scheduling anything on
   that platform (X: connect @Tawveeri; TikTok/Instagram: create first; Snapchat: reserve
   the identity only, no content planned yet).
7. Any real reply to a real discovered post is drafted, then reviewed and sent by a human —
   never automated, regardless of how closely it matches an approved style example above.

## Founder-review checkpoint status — 2026-08-04
All ten corrections from the founder's review passes verified complete (see HANDOVER
checkpoint #47, ADR-208). Content-approval decisions on every item in this pack are
**deferred** until the founder is ready to begin public execution — nothing here is approved
for publishing. Account creation (TikTok, Instagram) and account connection (@Tawveeri) are
also deferred until the founder is ready.
