# Tawveeri Documentation — Index & Precedence

This repository is governed by a constitutional document set. This index defines what each document is, and — critically — **which wins when two disagree.**

---

## Precedence (highest authority first)

1. **`/TAWVEERI_CONSTITUTION.md`** — the ratified vision and principles. Governs everything. Amendments require founder ratification.
2. **`/docs/ARCHITECTURE.md`** — the living, canonical architecture. Authoritative over any dated evidence doc.
3. **`/docs/TPS.md`** — the canonical product-identity standard.
4. **`/docs/ROADMAP.md`** — capability maturity and execution sequence/status.
5. **`/CLAUDE.md`** — the engineering operating manual (how we work in this repo).
6. **`/docs/DECISIONS.md`** — the Decision Register (why things are the way they are).
7. **Evidence & working documents** (below) — dated snapshots and detail. Subordinate to all of the above.
8. **Code** — must conform to the documents above; where it doesn't, that is debt to fix, recorded as a decision.

**Rule:** where any document, comment, or implementation conflicts with a higher authority, the higher authority prevails and the lower is corrected — never the reverse silently.

---

## The constitutional set

| Document | Purpose |
|---|---|
| `TAWVEERI_CONSTITUTION.md` | What Tawveeri is; the twelve principles; governance. **Single Source of Truth.** |
| `docs/ARCHITECTURE.md` | Layered platform model, invariants, current-vs-target, extension contracts. |
| `docs/TPS.md` | Tawveeri Product Standard — identity, category plugins, evidence, confidence. |
| `docs/ROADMAP.md` | Capability maturity; E-phase execution status. |
| `docs/GLOSSARY.md` | One agreed meaning per term. |
| `docs/DECISIONS.md` | Decision Register (ADRs). |
| `CLAUDE.md` | Operating manual for engineers and AI working in the repo. |

## Evidence & working documents (dated, subordinate)

| Document | Role |
|---|---|
| `docs/UNIFIED-PLATFORM-BLUEPRINT-V1.md` | Detailed target-architecture evidence (2026-07-20). Appendix to `ARCHITECTURE.md`. |
| `docs/ENGINEERING-TRANSITION-PLAN.md` | Full E-phase plan, verification, rollback, risk, and E1–E3 completion record. |
| `docs/ARCHITECTURE-RECONCILIATION.md` | The two-system reconciliation and consolidation recommendation. |
| `docs/PRODUCTION-EXECUTION-TOPOLOGY.md` | Verified trigger/ingestion topology. |
| `docs/ENVIRONMENT-AUTHORITY.md` | Project authority, deployment, credential inventory. |
| `docs/LEGACY-DB-FINDINGS.md` | Legacy-only findings (System B). Kept strictly separate from production. |

---

## Status legend used across docs

✅ Complete & production-verified · 🟡 Partial · ⏭ Next · ⚪ Foundational/not built · ❌ Failing.
A phase is "complete" only with production evidence (Constitution Article IX).

## How to use this set

- **Making an engineering decision?** Check the Constitution's twelve principles and the architecture invariants. If your change conflicts with one, stop.
- **Adding a store or category?** Registration against a contract, not core changes (`ARCHITECTURE.md` §4, `TPS.md` §3).
- **Made a significant decision?** Add an ADR to `DECISIONS.md`.
- **Reporting work?** Only verified production value counts.

## خريطة توفيري — نقطة البداية للمهمات القادمة

آخر مراجعة للكود والواجهة: **2026-09-14**. هذه خريطة وصول إلى المصادر القائمة، وليست بديلًا للدستور أو سجل القرارات. الأعداد والأسعار المتغيرة ونتائج الزيارة محفوظة في [تقييم رحلة الشراء](report/PURCHASE-JOURNEY-AUDIT-2026-09-14.md)، ولا تُستخدم كوعود تسويقية.

| الجزء ووظيفته | مصدر الحقيقة ومسار التنفيذ | كيف يُختبر؟ | القيد الذي يجب تذكره |
|---|---|---|---|
| الدخول واللغتان والثقة | `src/app/[locale]/(public)/`؛ رسائل `messages/`؛ `src/lib/seo/metadata.ts` | زيارة `/ar` و`/en` وصفحات about/how-it-works/faq؛ فحص HTML قبل JavaScript وبعده | نجاح HTTP لا يثبت وضوح المحتوى أو الفهرسة الفعلية؛ بعض مسارات المقارنة الحالية تكرر الغلاف العام |
| فهم وصف الحاجة والبحث عن موديل | `src/lib/agent/task-parser.ts` → `route-query.ts` → `src/app/api/search/route.ts`؛ الواجهة `src/app/[locale]/(public)/search/search-client.tsx` | `tests/agent/task-parser.test.ts` و`route-query.test.ts` و`budget-model-name.test.ts`؛ اختبر نفس النص عربيًا وإنجليزيًا | رقم السعة/الموديل ليس ميزانية. مستند ADR-291 يشرح فرض سقف السعر؛ إصلاح اصطدام Pro Max موثق في ADR-365 |
| جمع المنتجات وهويتها ومطابقتها | `src/lib/providers/`؛ `scripts/tps-core/`؛ `raw_observations` → `normalized_product_observations` → `canonical_products`/`product_matches` → `price_history` → `tps_product_projection`؛ Algolia فهرس مشتق | اختبارات TPS وscraping؛ أدوات `scripts/tps-analysis/` بعد قراءة آثارها؛ قياس معرف العرض والمتجر والتوقيت، لا العدد فقط | **«كود المنتجات ٢» محمي بتوجيه المالك: قراءة واختبار فقط.** لم يحدد التوجيه مساره الحرفي؛ لا توسع تعديلًا إلى الجمع أو التطبيع أو المطابقة دون تحديد حدوده. لا تشغّل أدوات الكتابة كأنها فحوص |
| «وفّر» وأسباب التوصية | `/api/v1/agent/decide`؛ `decision-engine.ts` للأحكام؛ `evidence-engine.ts` للثقة؛ `advisor-api.ts` و`advisor-answer.tsx` للعرض؛ `src/lib/agent/` لحوار المتابعة | اختبارات `tests/agent/`، ثم ربط السؤال والبطاقة والعرض الفعلي | يوجد مسار semantic-fallback اختياري يعتمد إعدادًا خارجيًا قائمًا؛ لا تضف خدمة أو مفتاحًا أو تكلفة. مصدر السعر وبيانات الخصم ليسا بالضرورة العرض نفسه |
| مقارنة المتاجر واختيار العرض | `src/lib/compare/get-comparison.ts` مشترك بين `/api/compare` وصفحة `/[locale]/compare/[key]`؛ سجل السعر مع العرض المصدر | `tests/compare/`؛ `scripts/tps-analysis/ui-journey.js --query ...` بعد قراءة تعليماته؛ فتح المتجر والتحقق من الموديل والحالة والسعر | المقارنة قد تضم جديدًا ومجددًا أو اختلاف ضمان/لون؛ العدد لا يثبت تكافؤ الشروط. وجود سجل قديم لا يثبت السعر الحالي |
| تاريخ السعر والتوفير والحداثة | `price_history`؛ `tps_listing_price_facts`؛ `src/lib/intelligence/observed-freshness.ts` و`discount-lookup.ts` | `tests/intelligence/` و`tests/compare/get-comparison-freshness.test.ts`؛ قارن تاريخ الرصد ومصدر سطر الخصم بسعر البطاقة | `last_observed_at` ليس وقت بناء الفهرس. لا تستنتج نسبة دقة الأسعار من نسبة حداثة سجلات projection |
| التنبيهات | `src/components/products/price-alert-dialog.tsx`؛ `/[locale]/price-alerts`؛ `/api/cron/check-price-alerts`؛ طبقات notifications/push | اختبارات الواجهات والمنطق؛ اختبار إرسال فعلي منفصل بحساب مأذون | وجود الكود لا يثبت وصول الإشعار. **لم يُختبر إرسال إشعار** في هذه المهمة؛ لا تشغّل cron أثناء الفحص |
| تجهيز المنزل | `/[locale]/home-mission` → `/api/v1/agent/home-mission`؛ `home-mission.ts` و`home-mission-view.ts` و`home-mission-share.ts` | `tests/agent/home-mission*.test.ts`؛ اختبار المدخلات والخطة والعودة من المتجر؛ اختبار التكامل منفصل | الخطط ليست سلة دفع موحدة؛ الشراء والتوصيل لدى المتاجر. إنشاء خطة محفوظة/مشاركتها قد يكتب بيانات؛ لم يُختبر ذلك حيًا هنا |
| الإحالة والأفلييت والعمولة | `/go/[offerId]`؛ `buildGoUrl`/Provider Framework؛ `outbound_clicks`؛ `affiliate_reports`/`affiliate_conversions`؛ `src/lib/campaigns/revenue-proof-queries.ts` | `tests/providers/` و`tests/campaigns/revenue-proof-queries.test.ts` و`tests/admin/affiliate-csv.test.ts`؛ [تعريف المقاييس](METRIC_DEFINITIONS.md) و[عقد المطابقة](AFFILIATE_RECONCILIATION_CONTRACT.md) | النقرة ≠ إحالة مؤهلة ≠ شراء ≠ عمولة مؤكدة/مدفوعة. لا تعدّل الروابط/المفاتيح. للزيارة الاختبارية استخدم cookie `tw_test=1` قبل فتح `/go` |
| الاكتشاف والفهرسة | `src/app/sitemap.ts`/`robots.ts`؛ صفحات categories/product/compare ومعايير المحتوى القائمة | `tests/seo/`؛ فحص canonical/robots/JSON-LD وروابط sitemap؛ Search Console لإثبات الفهرسة | `/search` أداة `noindex` عمدًا (ADR-229)، وصفحات الفئات/المقارنات هي مدخل المحتوى. لا تخمّن slug من اسم الفئة الداخلي |
| التشغيل وجودة القياس | `src/instrumentation.ts`؛ `scripts/scheduler.js`؛ أدوات health/sanity؛ `jest.config.js` وخط أساس TypeScript | `npm test`؛ `npm run test:coverage`؛ `npm run typecheck:baseline` | التطوير المحلي قد يشغّل المجدول: اضبط `DISABLE_INPROCESS_SCHEDULER=1` و`DISABLE_DEMAND_RADAR=1` في عملية الاختبار فقط. بوابة Jest الحالية تجمع التغطية من ملفين فقط، ولا تمثل تغطية المنصة كلها |

**تعامل مع عمر التوثيق:** README الجذري وافتتاحية ARCHITECTURE وبعض TPS/ROADMAP تصف مراحل قديمة، بينما ADR-042 وما بعده تسجل انتهاء الاعتماد التشغيلي على النظام القديم وتوسع المنصة. لا تعِد بناء قدرة بناءً على عبارة «غير مبنية» قديمة؛ اربطها بآخر ADR والكود ودليل حي. هذه الخريطة لا تصحح تلك الوثائق ضمنيًا ولا تعلن صحة كل أرقامها.

**متابعة مرجع القرار السعودي:** [تقرير 14 سبتمبر 2026](report/SAUDI-PURCHASE-REFERENCE-2026-09-14.md) يجمع البحث العالمي، تقييم Home Mission، إثبات نشر ADR-365 وإفصاح عروض المقارنة ADR-366. `OfferDescription` يعرض `raw_name` كاملًا ويعيد استخدام `src/lib/campaigns/condition.ts`؛ غياب حالة صريحة لا يعني جديدًا. اختبار العرض: `tests/compare/offer-description.test.tsx`. سياسة التعادل التجاري القديمة ADR-304 قيد مستقل موثق، وليست جزءًا من هذا الإفصاح.

**دورة العمل:** راجع `git status` والتعليمات وآخر ADR؛ اختبر حالة محددة قبل التعديل؛ غيّر أصغر مسار خارج المحمي؛ أعد الاختبار؛ سجل المصدر والتاريخ والقيود. لا تحفظ مفاتيح أو جلسات أو بيانات مستخدمين في الأدلة. لا تنشر أو ترسل رسائل أو تشغّل إعلانات ضمن مهمة التقييم دون إذن المالك.
