// src/lib/founder/registry.ts
// The founder metrics register — ONE definition per metric id, versioned. Every number the
// Founder Operating Center shows, snapshots, summarises or exports carries one of these ids and
// the definition version in force when it was computed. Source of computation for the S/Q/D
// metrics: the SQL functions in scripts/database/58-founder-operating-center.sql
// (founder_window_metrics etc.), verified against the frozen September 2026 study window
// (docs/evidence/founder-decisions-2026-09-25/independent-verification.json).
//
// Semantics carried on every metric (never in prose alone):
//   unit           — what ONE counts: browsers (persistent tw_sid ids, never people), events, rows,
//                    interactions (exact-id, onClick-proven), SAR, …
//   confidence     — how far the number can be trusted for a BUSINESS claim, not its recount-ability
//   proves / notProves — the exact boundary of the claim, shown next to the number in the UI

export const DEFINITION_VERSION = '2026-09-25.1';

export type MetricUnit = 'browsers' | 'visits' | 'events' | 'rows' | 'interactions' | 'products' | 'sar' | 'orders' | 'items' | 'ratio';
export type SemanticConfidence = 'high' | 'medium' | 'low';

export interface MetricDefinition {
  id: string;
  nameAr: string;
  shortAr: string;
  unit: MetricUnit;
  definitionAr: string;
  provesAr: string;
  notProvesAr: string;
  confidence: SemanticConfidence;
  /** JSON key inside founder_window_metrics() output, when the metric comes from the pack. */
  packKey?: string;
  /** Denominator pack key, for ratio metrics. */
  denominatorKey?: string;
  source: string;
}

const M = (d: MetricDefinition) => d;

export const METRICS: Record<string, MetricDefinition> = {
  // ── Audience (Q) ────────────────────────────────────────────────────────
  Q01: M({ id: 'Q01', nameAr: 'المتصفحات المرصودة', shortAr: 'متصفحات', unit: 'browsers', packKey: 'observed_browsers',
    definitionAr: 'عدد معرّفات المتصفح الفريدة (tw_sid) التي سجلت أي حدث استخدام غير اختباري داخل النافذة.',
    provesAr: 'حجم المتصفحات التي وصلت وسجلت حدثًا.', notProvesAr: 'عدد الأشخاص، أو بشريتهم، أو إقامتهم في السعودية.',
    confidence: 'medium', source: 'usage_events' }),
  Q01V: M({ id: 'Q01V', nameAr: 'الزيارات المنفصلة', shortAr: 'زيارات', unit: 'visits', packKey: 'visits_30m',
    definitionAr: 'زيارة = سلسلة أحداث لمتصفح واحد تفصلها عن سابقتها 30 دقيقة خمول أو أكثر. تعريف زمني معلن، لا جلسة بشرية مؤكدة.',
    provesAr: 'عدد مرات العودة إلى الموقع بفاصل زمني.', notProvesAr: 'شخصًا واحدًا لكل زيارة.', confidence: 'medium', source: 'usage_events' }),
  Q01N: M({ id: 'Q01N', nameAr: 'متصفحات جديدة', shortAr: 'جديدة', unit: 'browsers', packKey: 'new_browsers',
    definitionAr: 'متصفح أول حدث له على الإطلاق وقع داخل النافذة.', provesAr: 'أول ظهور للمعرّف.', notProvesAr: 'أن الشخص لم يزر الموقع من جهاز آخر أو بعد مسح التخزين.', confidence: 'medium', source: 'usage_events' }),
  Q01R: M({ id: 'Q01R', nameAr: 'متصفحات عائدة', shortAr: 'عائدة', unit: 'browsers', packKey: 'returning_browsers',
    definitionAr: 'متصفح له حدث قبل بداية النافذة وحدث داخلها.', provesAr: 'عودة المعرّف نفسه.', notProvesAr: 'عودة الشخص نفسه.', confidence: 'medium', source: 'usage_events' }),
  Q01I: M({ id: 'Q01I', nameAr: 'متصفحات أظهرت نية شراء', shortAr: 'نية شراء', unit: 'browsers', packKey: 'intent_browsers',
    definitionAr: 'متصفح سجل بحثًا أو استشارة أو فتح منتج أو مقارنة أو دليلًا أو ضغطة خروج داخل النافذة.',
    provesAr: 'تفاعلًا يتجاوز مجرد الوصول.', notProvesAr: 'حاجة شراء حقيقية أو قرارًا.', confidence: 'medium', source: 'usage_events' }),
  Q02: M({ id: 'Q02', nameAr: 'طلبات الخروج الخام', shortAr: 'خروج خام', unit: 'rows', packKey: 'raw_outbound_rows',
    definitionAr: 'كل صفوف سجل /go غير الاختبارية داخل النافذة، بما فيها الطلبات بلا معرّف متصفح والآلية والمكررة.',
    provesAr: 'حجم الطلبات التي وصلت خادم /go.', notProvesAr: 'ضغطات بشرية أو وصولًا إلى المتجر.', confidence: 'low', source: 'outbound_clicks' }),
  Q02S: M({ id: 'Q02S', nameAr: 'خروج خام بلا معرّف', shortAr: 'بلا معرّف', unit: 'rows', packKey: 'raw_outbound_without_session',
    definitionAr: 'صفوف /go التي لا تحمل معرّف متصفح؛ قرينة على حركة آلية أو بلا سياق تصفح.', provesAr: 'نقص هوية الطلب.', notProvesAr: 'أن كل صف منها آلي.', confidence: 'low', source: 'outbound_clicks' }),
  Q03: M({ id: 'Q03', nameAr: 'تفاعلات صريحة مسجلة', shortAr: 'تفاعلات', unit: 'interactions', packKey: 'explicit_interactions',
    definitionAr: 'سجلات first_party_interactions غير الاختبارية داخل النافذة؛ كل سجل يتطلب تنفيذ معالج ضغط فعلي في المتصفح.',
    provesAr: 'أن ضغطة فعلية حدثت في واجهتنا.', notProvesAr: 'وصول المتجر أو شراء.', confidence: 'high', source: 'first_party_interactions' }),
  // ── Journey (S) ─────────────────────────────────────────────────────────
  S01: M({ id: 'S01', nameAr: 'متصفحات أرسلت بحثًا', shortAr: 'بحث', unit: 'browsers', packKey: 'search_sessions',
    definitionAr: 'معرّفات متصفح فريدة سجلت حدث search أو advisor_query داخل النافذة.', provesAr: 'إرسال بحث.', notProvesAr: 'أشخاصًا سعوديين أو نية شراء مؤكدة.', confidence: 'medium', source: 'usage_events' }),
  D01: M({ id: 'D01', nameAr: 'أحداث البحث الخام', shortAr: 'أحداث بحث', unit: 'events', packKey: 'search_events',
    definitionAr: 'عدد أحداث search/advisor_query؛ يتضخم بتكرار المتصفح الواحد.', provesAr: 'حجم محاولات البحث.', notProvesAr: 'عدد الباحثين.', confidence: 'medium', source: 'usage_events' }),
  S02: M({ id: 'S02', nameAr: 'تلقت نتائج غير فارغة', shortAr: 'نتيجة', unit: 'browsers', packKey: 'positive_result_sessions', denominatorKey: 'search_sessions',
    definitionAr: 'من متصفحات S01: تلك التي سجلت حدث نتائج بنفس نص البحث حرفيًا خلال 30 دقيقة وعدد النتائج > 0.',
    provesAr: 'أن النظام أعاد نتيجة.', notProvesAr: 'ملاءمة النتيجة أو قراءتها.', confidence: 'medium', source: 'usage_events' }),
  S03: M({ id: 'S03', nameAr: 'ضغطت رابط المقارنة', shortAr: 'مقارنة', unit: 'browsers', packKey: 'comparison_click_sessions',
    definitionAr: 'متصفحات سجلت alternative_view مع via=compare_link (ضغطة فعلية على «قارن» في بطاقة الاختيار الذكي).',
    provesAr: 'ضغطة مقارنة مسجلة على هذا السطح.', notProvesAr: 'إتمام مقارنة أو تغطية كل أسطح الموقع.', confidence: 'high', source: 'usage_events' }),
  S03E: M({ id: 'S03E', nameAr: 'ضغطات رابط المقارنة', shortAr: 'ضغطات', unit: 'events', packKey: 'comparison_click_events',
    definitionAr: 'عدد أحداث alternative_view/compare_link.', provesAr: 'عدد الضغطات.', notProvesAr: 'قرارات مقارنة.', confidence: 'high', source: 'usage_events' }),
  S03A: M({ id: 'S03A', nameAr: 'عروض مقارنة تلقائية', shortAr: 'تلقائية', unit: 'events', packKey: 'comparison_auto_events',
    definitionAr: 'أحداث comparison_view تُطلق تلقائيًا عند فتح صفحة منتج بأكثر من عرض؛ ليست فعل مستخدم.', provesAr: 'عرض الصفحة.', notProvesAr: 'أن المستخدم قارن.', confidence: 'low', source: 'usage_events' }),
  S04: M({ id: 'S04', nameAr: 'فتحت منتجًا بعد البحث', shortAr: 'فتح منتج', unit: 'browsers', packKey: 'product_after_search_sessions', denominatorKey: 'search_sessions',
    definitionAr: 'من متصفحات S01: تلك التي سجلت product_view خلال 30 دقيقة بعد البحث.', provesAr: 'فتح صفحة منتج بعد بحث.', notProvesAr: 'أن المنتج هو نتيجة البحث نفسها (لا ربط query_id تاريخيًا).', confidence: 'medium', source: 'usage_events' }),
  S05: M({ id: 'S05', nameAr: 'خروج مرتبط مسجل', shortAr: 'خروج مرتبط', unit: 'interactions', packKey: 'linked_interactions',
    definitionAr: 'تفاعلات صريحة (interaction_id) لها صف /go يحمل المعرّف نفسه، والطرفان داخل النافذة وغير اختباريين. يُعد المعرّف مرة واحدة مهما تكرر الصف.',
    provesAr: 'ضغطة فعلية أعقبها طلب تحويل إلى المتجر.', notProvesAr: 'تحميل صفحة التاجر أو شراء.', confidence: 'high', source: 'first_party_interactions ⋈ outbound_clicks' }),
  S05B: M({ id: 'S05B', nameAr: 'متصفحات خرجت مرتبطة', shortAr: 'متصفحات خروج', unit: 'browsers', packKey: 'linked_sessions',
    definitionAr: 'معرّفات متصفح فريدة في S05.', provesAr: 'عدد المتصفحات خلف الخروج المرتبط.', notProvesAr: 'أشخاصًا.', confidence: 'high', source: 'first_party_interactions ⋈ outbound_clicks' }),
  S06: M({ id: 'S06', nameAr: 'بحث تبعه خروج مرتبط', shortAr: 'بحث→خروج', unit: 'browsers', packKey: 'linked_after_search_sessions', denominatorKey: 'search_sessions',
    definitionAr: 'من متصفحات S01: تلك التي سجلت خروجًا مرتبطًا (S05) خلال 30 دقيقة بعد البحث.', provesAr: 'ارتباطًا زمنيًا بين بحث وخروج.', notProvesAr: 'سببية أو شراء.', confidence: 'medium', source: 'usage_events ⋈ S05' }),
  S07: M({ id: 'S07', nameAr: 'طلبات أبلغ عنها الشريك', shortAr: 'طلبات', unit: 'orders',
    definitionAr: 'طلبات/بنود مستوردة من تقرير الشريك أو مدخلة يدويًا بإثبات، مطابقة على الوحدة التي يعرضها الشريك.',
    provesAr: 'ما أبلغ عنه الشريك للفترة المغطاة.', notProvesAr: 'أي شيء عن فترة بلا تقرير؛ غياب التقرير ≠ صفر.', confidence: 'high', source: 'affiliate_conversions + founder_revenue_entries' }),
  S08: M({ id: 'S08', nameAr: 'عمولات معتمدة', shortAr: 'عمولات', unit: 'sar',
    definitionAr: 'مجموع العمولات بحالة معتمدة أو مدفوعة، بعد المرتجعات كما يعرّفها الشريك، بالريال بعد تحويل موثق.',
    provesAr: 'إيرادًا معتمدًا موثقًا.', notProvesAr: 'إيرادًا مقبوضًا (انظر S08P) أو أي مبلغ لفترة بلا تغطية.', confidence: 'high', source: 'affiliate_conversions + founder_revenue_entries' }),
  S08P: M({ id: 'S08P', nameAr: 'عمولات مقبوضة نقدًا', shortAr: 'مقبوض', unit: 'sar',
    definitionAr: 'مجموع العمولات بحالة مدفوعة بتاريخ دفع داخل النافذة.', provesAr: 'نقدًا وصل.', notProvesAr: 'ربحية بعد المصروفات.', confidence: 'high', source: 'founder_revenue_entries' }),
  // ── Money (F) ───────────────────────────────────────────────────────────
  F01: M({ id: 'F01', nameAr: 'نقد مصروف', shortAr: 'مصروف نقدًا', unit: 'sar',
    definitionAr: 'مجموع المصروفات المدفوعة بتاريخ دفع داخل النافذة، بالريال بعد تحويل موثق.', provesAr: 'ما خرج من النقد.', notProvesAr: 'تكلفة التشغيل للفترة (انظر F02).', confidence: 'high', source: 'founder_expenses' }),
  F02: M({ id: 'F02', nameAr: 'تكلفة تشغيل الفترة', shortAr: 'تكلفة الفترة', unit: 'sar',
    definitionAr: 'المصروفات موزعة على فترة الخدمة بالتناسب اليومي؛ اشتراك سنوي يظهر بجزئه الشهري لا بكامل مبلغه.', provesAr: 'تكلفة الفترة إداريًا.', notProvesAr: 'قيدًا محاسبيًا معتمدًا.', confidence: 'high', source: 'founder_expenses' }),
  F03: M({ id: 'F03', nameAr: 'مصروفات مستحقة غير مدفوعة', shortAr: 'مستحق', unit: 'sar',
    definitionAr: 'مصروفات بحالة «مستحق» بتاريخ استحقاق حتى نهاية النافذة.', provesAr: 'التزامات قائمة.', notProvesAr: 'الفواتير التي لم تُدخل بعد.', confidence: 'high', source: 'founder_expenses' }),
  F04: M({ id: 'F04', nameAr: 'إجمالي ما صُرف منذ البداية', shortAr: 'إجمالي الصرف', unit: 'sar',
    definitionAr: 'كل المصروفات المدفوعة منذ أول سجل.', provesAr: 'ما أُدخل من صرف.', notProvesAr: 'اكتمال السجل التاريخي؛ ما لم يُدخل لا يُحسب.', confidence: 'medium', source: 'founder_expenses' }),
  F05: M({ id: 'F05', nameAr: 'تمويل المؤسس', shortAr: 'تمويل', unit: 'sar',
    definitionAr: 'مبالغ ضخها المؤسس لتمويل المشروع؛ ليست إيرادًا تجاريًا.', provesAr: 'مصدر النقد.', notProvesAr: 'أي إيراد.', confidence: 'high', source: 'founder_funding' }),
  F06: M({ id: 'F06', nameAr: 'النتيجة التشغيلية الإدارية', shortAr: 'نتيجة الفترة', unit: 'sar',
    definitionAr: 'S08 (عمولات معتمدة بتاريخ اعتماد داخل الفترة) − F02 (تكلفة الفترة). سياسة إدارية معلنة، غير محاسبية.', provesAr: 'اتجاه الفترة.', notProvesAr: 'ربحًا معتمدًا أو ضريبيًا.', confidence: 'medium', source: 'derived' }),
  F07: M({ id: 'F07', nameAr: 'صافي التدفق النقدي', shortAr: 'صافي النقد', unit: 'sar',
    definitionAr: 'S08P (مقبوض) − F01 (مصروف نقدًا) داخل النافذة.', provesAr: 'حركة النقد.', notProvesAr: 'ربحية.', confidence: 'high', source: 'derived' }),
  F08: M({ id: 'F08', nameAr: 'عمولات مستحقة غير مقبوضة', shortAr: 'مستحق القبض', unit: 'sar',
    definitionAr: 'عمولات معتمدة بلا تاريخ دفع.', provesAr: 'مبالغ منتظرة.', notProvesAr: 'ضمان قبضها.', confidence: 'high', source: 'founder_revenue_entries' }),
  // ── Coverage/quality (C) ────────────────────────────────────────────────
  C01: M({ id: 'C01', nameAr: 'تغطية تقارير الشركاء', shortAr: 'تغطية', unit: 'ratio',
    definitionAr: 'عدد مصادر الشريك (أمازون، نون) التي يوجد لها تقرير مستورد أو إدخال موثق يغطي النافذة، من 2.', provesAr: 'إمكان الحكم المالي.', notProvesAr: 'اكتمال كل أيام النافذة داخل التقرير.', confidence: 'high', source: 'affiliate_reports + founder_revenue_entries' }),
};

export const PARTNER_SOURCES = ['amazon_associates', 'noon_affiliate'] as const;
export type PartnerSource = (typeof PARTNER_SOURCES)[number];
export const PARTNER_LABEL_AR: Record<string, string> = { amazon_associates: 'أمازون السعودية', noon_affiliate: 'نون' };

export function metricDef(id: string): MetricDefinition {
  const d = METRICS[id];
  if (!d) throw new Error(`unknown metric id ${id}`);
  return d;
}

export const EXPENSE_CATEGORIES = ['hosting', 'data_extraction', 'ai', 'tools', 'advertising', 'design', 'contractor', 'fees', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_AR: Record<ExpenseCategory, string> = {
  hosting: 'استضافة', data_extraction: 'استخراج بيانات', ai: 'ذكاء اصطناعي', tools: 'أدوات', advertising: 'إعلان',
  design: 'تصميم', contractor: 'متعاقد', fees: 'رسوم', other: 'أخرى',
};
