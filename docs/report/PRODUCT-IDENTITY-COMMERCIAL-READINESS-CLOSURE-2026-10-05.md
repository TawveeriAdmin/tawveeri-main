# Product Identity — Commercial Readiness Closure (2026-10-05)

# FINAL FOUNDER ANSWER

**القرار: `PARTIAL_READY`.**

الجملة التي تستطيع التصرف بها: **"هناك خلل حقيقي واحد يمنع التسويق بثقة، وهو بالضبط أن بوابة الهوية التي بُنيت وأُثبتت واختُبر تراجعها ما زالت مطفأة في الإنتاج لكل الفئات. تشغيلها قرار تشغيلي (علَم + نشر `main`) لا مشروع هندسي. بعد تشغيلها لفئة التلفزيونات كـcanary، تصبح المنصة `READY_TO_MARKET_WITH_MONITORING` لتلك الفئة، وتبقى الأجهزة الكبيرة مرجعية فقط."**

1. **هل Tawveeri جاهز للتسويق الآن؟** جزئيًا. طبقة الهوية جاهزة تقنيًا (مبنية، مقاسة على الإنتاج، ظل مستقر 3 دورات، تراجع مُنفَّذ مرتين). لكن الإنتاج يخدم اليوم **كل** الفئات بقاعدة "نفس المفتاح = نفس المنتج" بلا بوابة، وتشغيل المُحقِّق على كامل الكتالوج (قراءة فقط) يُظهر **145 قائمة بتعارض مادي حيّ من 4,593 قائمة في مجموعات متعددة المتاجر** (مجدّد مقابل جديد 56، كودان مختلفان 56، شبكة/RAM/تخزين 12…)، منها الجوالات 58 والغسالات 35 والتلفزيونات 6. هذا "صنف دمج خاطئ معروف" وفق معيارك، فلا أقول READY.
2. **الفئات Exact-ready (بعد تشغيل البوابة):** **TV** (كل بوابات الجاهزية مستوفاة عدا main shadow — القسم 6)، ثم **tablet** (تعليم 8%) و**mobile** (14%؛ بوابته العمياء مرّت 18/18 على الأزواج القاطعة) كموجات لاحقة بقرارك لا تلقائيًا.
3. **Equivalent/Family-only:** Tier B (نفس الجهاز بلون مختلف) **فارغ بصدق**: لم أجد توثيقًا من أي مصنّع للواحق اللون (Hitachi، Nikai) أو للأسماء المستعارة (TCL Q6C/C6K، Hisense) — فتبقى REVIEW معلنة. Family/reference-only: **Vacuum** (19 من 58 مجموعة غير مُثبتة)، **washing_machine** (56.8% تعليم)، **air_conditioner** (52.6%)، **dishwasher** (49.6%)، **laptop** (42.5%)، **refrigerator** (37.5%).
4. **هل Amazon يحصل على فرصة عادلة؟** نعم. في TV: 59 من 74 مجموعة فيها Amazon إدراج موثّق، 7 إزالة بتعارض كود مثبت، 8 review. سبب نقص Amazon الأصلي كان **فجوة أدلة/تداخل هوية** (حقل `model` عنده 44.9% فخاخ؛ جدول التفاصيل لا يصل لعميل آلي) لا تحيّزًا. لا يوجد أي boost ولا تخفيف خاص به.
5. **هل يوجد ranking/affiliate bias؟** لا. السعر ليس مدخلًا لأي قرار هوية؛ الترتيب لم يُمَس؛ ADR-304 (true-tie) يعيد ترتيب التعادلات فقط.
6. **حجم المخاطر المتبقية:** دمج خاطئ مؤكَّد في عيّنات التدقيق المستقلة بعد الأدلة: **0 من 105 أزواج** (40 مطابقات عشوائية + 11 تعليمات جديدة + 54 بالأدلة اليدوية). فقدان مقارنات بسبب التحفظ: TV 28 من 183 (21 منها تعارض كودي مثبت). تحفظ زائد: 7 من 11 تعليمات جديدة في العينة الصغيرة (كود Amazon غائب، لواحق لون غير موثقة).
7. **هل residual issues تمنع النمو؟** لا. تمنع فقط ادعاء "الأرخص لنفس الجهاز" على أزواج لا نثبتها، وهذا مقصود.
8. **ما يجب ألا نبنيه الآن:** Wave جديدة تلقائيًا، إعادة مفاتيح جماعية، Redis/queue جديد، إعادة بناء Algolia، مشروع reobserve، scraper جديد يتجاوز حظر Amazon/Noon/LuLu، أي قاعدة fuzzy لرفع التغطية، أي قصّ لواحق بلا وثيقة مصنّع.
9. **ما يُراقَب فقط:** دورات `identity_gate` (نجاح/عمر)، `tps_identity_wave_log` (ROLLBACK_REQUIRED)، نسبة review/reject لكل فئة مفعّلة، تدقيق أعمى شهري لـ30 زوجًا، تقادم `tps_listing_evidence` (60 يومًا).
10. **التوصية:** نعم، عُد للتسويق والنمو. الخطوة الوحيدة الباقية قبل ذلك قراران تشغيليان لك (القسم 6)؛ بعدهما **تُغلَق مهمة الهندسة** ويتحول الجهد إلى اكتساب متسوقين سعوديين حقيقيين وإثبات تجاري.

---

## 1. ما ثبت في المهمة من أولها

| السؤال الأول | الجواب النهائي |
|---|---|
| "لماذا Amazon لا يظهر مثل eXtra وAlmanea؟" | لأن **الهوية** عبر المتاجر كانت "نفس المفتاح = نفس المنتج" (دقة 65% على 459 زوجًا موسومًا)، وAmazon يحمل أضعف حقول موديل (LOW) وأقوى عناوين؛ فلا يلتقي بالمفتاح أو يلتقي خطأً. ليس ترتيبًا ولا أفلييت ولا حداثة. |
| ما بُني | مفتاح يقترح → **مُحقِّق حتمي** (match/review/reject، قواعد لكل فئة) → حَكَم مجموعات (أكبر مجموعة فرعية متسقة، لا دمج متعدٍ عبر تعارض) → جدول أحكام موحّد تقرؤه كل الواجهات → runner معزول (لا إعادة فتح سلسلة refresh) → مراقبة دائمة + تراجع بعلَم → **طبقة أدلة موحّدة** (حمولة + عنوان + صفحة التاجر، ثقة مقاسة لكل (تاجر، حقل)، GTIN بـchecksum، رفض القيم المركبة، سجل أسماء مستعارة بأدلة فقط). |
| Ground truth | أدلة المصنّع وصفحات التجار الموثوقة بالقياس؛ وسوم المؤسس/المراجعين/Claude إشارات فقط (ثبت ذلك عمليًا: 10 من 22 مجموعة TV وسمتَها "نفس" والمصنّع يفصلها). |

## 2. Final technical scorecard

| Metric | Before | Final | Decision |
|---|---:|---:|---|
| known false merges (live, ungated) | TV: 41 زوجًا بكودين مختلفين في 23/183 مجموعة؛ كتالوج: 145/4,593 قائمة بتعارض مادي | **0 مؤكَّد من 105 أزواج** مدقَّقة بعد الأدلة (مع البوابة)؛ **ما زالت حيّة بلا بوابة** | البوابة = الإصلاح |
| exact comparisons (TV) | 183/183 مجموعة تُعرض كمقارنة (205 في الإسقاط) | **155/183** موثّقة (subclusters) | GO canary |
| equivalent comparisons (Tier B) | — | **0** (لا توثيق مصنّع للواحق) | يبقى REVIEW معلنًا |
| family-only groups (Vacuum) | 32/56 | **19/58** غير مُثبتة (الالتقاط رفع التغطية 62.6%→82.1%) | reference-only |
| unresolved reviews (TV) | — | 13/514 زوجًا؛ 95/662 قائمة review | مقبول |
| Amazon verified participation (TV) | غير مقيس | **59/74** مجموعة (7 تعارض، 8 review) | عادل |
| false cheapest claims (TV, ungated) | — | **23/181** ادعاء "أرخص" يقع في مجموعة بزوج مختلف مثبت | تُزال بالبوابة |
| source model coverage (TV / Vacuum) | 95.1% / 62.6% | **98.2% (484/493) / 82.1% (101/123)** | مكتمل لما يمكن جلبه مشروعًا |
| surface consistency | — | **548/553 (99.1%)**، 0 عرض لما تُرفضه الإشارات | ✔ (في العملية؛ main لم يُنشر) |
| rollback status | مُجرَّب | **مُنفَّذ مرتين في الإنتاج** (TV 10-04 10:15Z، Vacuum 14:16Z) بعلَم واحد | ✔ |
| runner health | — | **3/3 دورات أدلة ناجحة** (04:06، 04:51، 05:51Z؛ ~30–37s)، إشارات TV ثابتة 95/6 | ✔ |

## 3. Final commercial scorecard

- **verified comparisons retained (TV):** 155/183.
- **legitimate comparisons recovered by evidence:** 14 زوج TV (2 REVIEW→MATCH، 12 REVIEW→DIFFERENT) و20 زوج Vacuum (14 REVIEW→MATCH، 6 →DIFFERENT)؛ 15 قائمة TV و24 Vacuum استعادت كود موديل؛ **0** تطابق سابق فُقد.
- **coverage lost for safety (TV):** 28/183 (21 تعارض مثبت + 7 review).
- **coverage restored by enrichment:** Vacuum 25→39 مجموعة موثّقة؛ TV 154→155.
- **Amazon verified wins:** تُقاس بعد البوابة (لا رقم مسبق).
- **store participation (TV):** 10 تجار في المجموعات الموثّقة؛ لا تاجر أُقصي كتاجر.
- **categories commercially useful (exact):** TV الآن؛ tablet وmobile كموجات.
- **categories intentionally restricted (reference/family):** vacuum، washing_machine، air_conditioner، dishwasher، laptop، refrigerator، audio، air_fryer.
- **claims that became more honest:** "لم نتأكد أنه نفس الموديل أو الإصدار — لا يدخل في المقارنة" تُعرض بدل "أرخص" على 101 قائمة TV؛ "أرخص" لا يُمنح إلا لمجموعة فرعية موثّقة.

## 4. تعريف "نفس المنتج" كما يعمل الآن

Tier A (EXACT) = كود مصنّع موثوق مطابق أو GTIN مؤكَّد عبر التجار + لا تعارض مادي → مقارنة وادعاء أرخص. Tier B (EQUIVALENT) = اختلاف غير مادي **موثّق من المصنّع** → **لا سجل بعد** (البحث لم يجد وثيقة لـHitachi/Nikai). Tier C (FAMILY) = مواصفات/عائلة بلا كود → مرجع/بدائل، لا ادعاء أرخص. DIFFERENT = كودان موثوقان مختلفان (Samsung F/H موثّق كسنة مختلفة)، مجدّد/جديد، شبكة، RAM/تخزين، سعة، PRO/PLUS مُصرَّح من الجانبين. السعر ليس دليلًا. الأزواج قبل المجموعات؛ لا دمج متعدٍ.

## 5. بوابة جاهزية TV (القسم 28 من توجيهك)

| الشرط | الحالة |
|---|---|
| ≥3 دورات ظل مستقرة | ✔ 3/3 |
| التقاط الأدلة مستقر | ✔ (1,700 صفحة؛ Amazon/Noon/LuLu = TRANSPORT_GAP مُعلن) |
| لا دمج خاطئ مادي مؤكَّد في تدقيق مستقل | ✔ 0/105 |
| فشل TCL/Hisense محسوم أو REVIEW آمن | ✔ |
| نسبة false-review مقبولة | ⚠ 7/11 في عينة صغيرة؛ ثمنها مقارنة مفقودة لا ادعاء خاطئ |
| سياسة لون/أسماء بأدلة | ✔ الأدلة تقول "غير موثّق" → REVIEW (قرار صادق) |
| search/product/compare متسقة | ✔ 99.1% في العملية |
| **main shadow يؤكد سلوك الـworker** | ✘ **لم يُنفَّذ** — نشر `main` رفضه نظام الصلاحيات مرتين (push ثم `railway up`)؛ لم ألتف عليه |
| rollback مُختبَر | ✔ |
| التغطية ما زالت مفيدة | ✔ 155/183 |

## 6. القراران المطلوبان منك (الطريق إلى READY_TO_MARKET_WITH_MONITORING)

1. **نشر `tawveeri-main` بالكود الحالي** (`0cd10264`) مع `TPS_IDENTITY_EVIDENCE=tv` والبوابة `off` — لا تغيير مرئي؛ يثبت التكافؤ على الخدمة التي تخدم صفحة المقارنة. (تنفيذه يحتاج صلاحية نشر إنتاج أرفضها أنا بنفسي حاليًا.)
2. **TV canary:** `TPS_IDENTITY_GATE=tv` على الخدمتين، مع baseline في `tps_identity_wave_log` ومراقبة الدورات وقاعدة "دمج خاطئ مادي واحد مؤكَّد = تراجع فوري" (التراجع = `TPS_IDENTITY_GATE=off`). لا تنتقل فئة أخرى تلقائيًا.

## 7. Merchant Identity Data Contract (للمتاجر/feeds المستقبلية)

merchant SKU · brand · exact manufacturer model/MPN · GTIN إن وُجد · condition · material variant attributes (storage/RAM/network/size/capacity/bundle) · availability · price · timestamp. (Google Merchant Center: GTIN/MPN/Brand هي المعرّفات الفريدة التي يحددها المصنّع؛ لا SKU داخلي ولا تخمين.)

## 8. Residual backlog

- **P0 — Launch blocker:** القراران في القسم 6 (تشغيلي لا هندسي).
- **P1 — Monitor / next window:** job التقاط دوري (أسبوعي، لمرشّحي المقارنة فقط)؛ تدقيق أعمى شهري 30 زوجًا؛ مجموعات 2+2 (T04) تفقد زوجين مشروعين حتى إعادة المفاتيح؛ مجموعة Panasonic 2+2 حيث الصفحة أكثر تساهلًا من الإشارات؛ ASIN يُفتح على مقاس مختلف (freshness/وجهة `/go`).
- **P2 — Future optimization:** Tier B عند توفر وثيقة مصنّع للواحق اللون؛ قاعدة سعة/شكل لـVacuum؛ TCL Q6C/C6K إن صدر بيان رسمي.
- **P3 — Data/partnership:** مسار مرخَّص لحقول Model Number من Amazon.sa وNoon (API/feed)؛ بيانات رسمية من Najm/Alnakheelk (SKU داخلي)؛ LuLu.

## 9. ADR

ADR جديد (ADR-406 عند الاعتماد): طبقة الأدلة الموحّدة + مصفوفة ثقة (تاجر، حقل) مقاسة + `tps_listing_evidence` + علَم `TPS_IDENTITY_EVIDENCE` + سياسة Tier A/B/C + سجل أسماء مستعارة بأدلة (فارغ) + "السعر ليس دليل هوية" + قرار PARTIAL_READY. يُكتب مع تفعيل الـcanary؛ ADR-405 لا يُعدَّل (بنيته صحيحة).

## 10. سجل البنود

| البند | الحالة |
|---|---|
| Evidence enrichment | DONE (Amazon/Noon/LuLu: TRANSPORT_GAP) |
| Unified evidence abstraction + pairwise/subclusters | DONE |
| Evidence-backed colour/alias policy | DONE — النتيجة: لا توثيق → سجل فارغ، REVIEW |
| TV replay / Vacuum replay / other categories replay | DONE |
| Production shadow (worker) | DONE، 3 دورات |
| Main shadow | NOT DONE — صلاحية نشر مرفوضة (تبعية مُعلنة) |
| Surface consistency | DONE (في العملية) |
| Minimal UX semantics | NOT NEEDED — النص الحالي ("لم نتأكد أنه نفس الموديل أو الإصدار") كافٍ لـREVIEW؛ Tier B لا وجود له |
| Regression tests | DONE (983 ناجحة في identity/compare/tps-core/catalog) |
| ADR update | NOT DONE (يُكتب مع الـcanary) |
| Controlled canary | NOT DONE — بوابة main shadow غير مستوفاة؛ قرارك |
| Wave 2 / ranking / affiliate / mass re-key / broad refresh | لم يحدث |

**STOP.** مهمة الهندسة تتوقف هنا بانتظار القرارين.
