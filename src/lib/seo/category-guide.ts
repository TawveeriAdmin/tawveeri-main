// src/lib/seo/category-guide.ts
// SAUDI SHOPPER LANGUAGE & DEMAND DISCOVERY mission (2026-08-11), search/AI-discovery phase.
//
// Repo audit (this mission) found category pages (ADR-226) are purely transactional — a live
// product listing with zero educational content explaining HOW to choose within a category,
// the exact content shape both Google (AI Overviews trigger heavily on "best X"/buying-guide
// content for commercial queries) and AI answer engines most readily cite (Q&A-structured
// content with named, verifiable data). This file supplies that content, bounded and honest:
//
// - Every "what to look for" point is grounded in a REAL priority the decision engine
//   (decision-engine.ts) actually scores for that category — never invented marketing fluff
//   disconnected from what Tawveeri can act on. Reading the guide teaches a shopper the exact
//   vocabulary Waffar/search can already use.
// - The two universal Q&As restate facts already established on the site FAQ (observed-price
//   honesty, single-store disclosure) — not new claims.
// - A category with no bespoke entry gets the universal Q&As only (never a fabricated
//   category-specific claim) — see `getCategoryGuide`'s fallback.
export interface GuideQA { q: string; a: string }

const BESPOKE: Record<string, { ar: GuideQA[]; en: GuideQA[] }> = {
  air_conditioner: {
    ar: [
      { q: 'كيف أعرف قدرة المكيف (BTU) المناسبة لغرفتي؟', a: 'القدرة المناسبة تعتمد على مساحة الغرفة بالمتر المربع — غرفة أكبر تحتاج قدرة أعلى، والأجواء الحارة في السعودية عادة تحتاج قدرة أعلى مما تنصح به الجداول المعتدلة. حدد مساحة الغرفة عند البحث لنساعدك في مقارنة الخيارات المناسبة.' },
      { q: 'هل مكيف الإنفرتر يستحق الفرق في السعر؟', a: 'مكيفات الإنفرتر عادة أهدأ في التشغيل وأوفر للكهرباء على المدى الطويل مقارنة بالمكيفات العادية بنفس القدرة — إن كان الهدوء أو توفير الفاتورة أولوية عندك، وضّح ذلك في بحثك.' },
    ],
    en: [
      { q: 'How do I know the right AC capacity (BTU) for my room?', a: 'The right capacity depends on your room\'s area in square meters — a larger room needs higher capacity, and Saudi Arabia\'s hot climate typically needs more capacity than moderate-climate charts suggest. State your room size when searching so we can compare the right-sized options.' },
      { q: 'Is an inverter AC worth the price difference?', a: 'Inverter ACs are typically quieter and more electricity-efficient long-term than standard units of the same capacity. If quiet operation or a lower bill matters to you, say so in your search.' },
    ],
  },
  mobile: {
    ar: [
      { q: 'أي مواصفة أهم: الكاميرا أم البطارية؟', a: 'يعتمد على استخدامك — إن كان التصوير أولوية وضّح ذلك، وإن كان طول عمر البطارية طوال اليوم أهم لك فاذكره. توفيري يرتب النتائج حسب ما تحدده أنت، لا حسب رأي عام واحد يناسب الجميع.' },
      { q: 'هل الجوال الأحدث دائمًا الخيار الأفضل؟', a: 'ليس بالضرورة — أحيانًا جيل سابق يقدم نفس المواصفات المهمة لك بسعر أقل. إن كان السعر المناسب أهم من كونه أحدث إصدار، وضّح ذلك في بحثك.' },
    ],
    en: [
      { q: 'Which matters more: camera or battery?', a: 'It depends on how you actually use your phone — if photography matters most, say so; if all-day battery life matters more, mention that instead. Tawveeri ranks results by what YOU state, not one generic opinion.' },
      { q: 'Is the newest phone always the best choice?', a: 'Not necessarily — an earlier generation can offer the same features that matter to you at a lower price. If a reasonable price matters more than being the latest release, say so in your search.' },
    ],
  },
  laptop: {
    ar: [
      { q: 'كيف أختار لابتوب حسب استخدامي (جامعة، تصميم، ألعاب)؟', a: 'لابتوب الجامعة والدراسة عادة يحتاج خفة وزن وبطارية جيدة أكثر من قوة معالجة عالية؛ التصميم والمونتاج يحتاج كرت شاشة منفصل ورام أعلى؛ الألعاب يحتاج كرت شاشة قوي وتخزين أكبر. وضّح استخدامك عند البحث لنرشح لك الأنسب مع سبب الترشيح.' },
      { q: 'هل يستحق الفرق بين لابتوب بسعر مناسب ولابتوب أغلى؟', a: 'إن لم تكن بحاجة لمواصفات متقدمة (كرت شاشة منفصل، رام كبير) فلابتوب بسعر مناسب قد يغطي احتياجك تمامًا. وضّح إن كان السعر المناسب أولوية عندك.' },
    ],
    en: [
      { q: 'How do I choose a laptop for my use case (university, design, gaming)?', a: 'A university/study laptop usually needs light weight and good battery more than raw processing power; design/video editing needs a discrete GPU and more RAM; gaming needs a strong GPU and more storage. Tell us your use case when searching and we\'ll rank options with the reason why.' },
      { q: 'Is the price gap between an affordable laptop and a pricier one worth it?', a: 'If you don\'t need advanced specs (discrete GPU, large RAM), an affordably priced laptop may fully cover your needs. Say so in your search if a reasonable price is your priority.' },
    ],
  },
  tablet: {
    ar: [
      { q: 'هل أحتاج تابلت بشريحة اتصال (سيلولار) أم واي فاي فقط؟', a: 'شريحة الاتصال مفيدة إن كنت تحتاج إنترنت خارج المنزل بدون الاعتماد على هوت سبوت الجوال — إن لم تكن بحاجة لذلك، تابلت واي فاي فقط عادة أرخص.' },
      { q: 'كم مساحة تخزين أحتاجها في التابلت؟', a: 'للاستخدام اليومي والدراسة، مساحة متوسطة عادة كافية؛ إن كنت ستخزن فيديوهات أو ألعابًا كبيرة، وضّح ذلك لنرشح خيارات بتخزين أكبر.' },
    ],
    en: [
      { q: 'Do I need a cellular tablet or is Wi-Fi-only enough?', a: 'Cellular is useful if you need internet away from home without relying on your phone\'s hotspot — if you don\'t need that, a Wi-Fi-only tablet is usually cheaper.' },
      { q: 'How much storage do I need on a tablet?', a: 'For everyday use and study, mid-range storage is usually enough; if you\'ll store large videos or games, mention that so we can recommend higher-storage options.' },
    ],
  },
  tv: {
    ar: [
      { q: 'ما مقاس الشاشة المناسب لغرفتي؟', a: 'يعتمد على مسافة الجلوس عن الشاشة — غرفة أو صالة كبيرة تحتاج مقاسًا أكبر ليكون العرض مريحًا. وضّح إن كانت الشاشة لصالة كبيرة عند البحث.' },
      { q: 'ما الفرق المهم لمشاهدة الرياضة أو الأفلام؟', a: 'مشاهدة المباريات تستفيد من معدل تحديث أعلى لحركة أوضح؛ الأفلام تستفيد أكثر من دقة ووضوح الألوان. وضّح استخدامك الأساسي عند البحث.' },
    ],
    en: [
      { q: 'What screen size is right for my room?', a: 'It depends on your viewing distance — a large living room needs a bigger size for a comfortable viewing experience. Mention if the TV is for a large room when you search.' },
      { q: 'What matters most for watching sports vs. movies?', a: 'Sports benefits from a higher refresh rate for clearer motion; movies benefit more from resolution and color accuracy. State your primary use when searching.' },
    ],
  },
  refrigerator: {
    ar: [
      { q: 'ما حجم الثلاجة المناسب لعائلتي؟', a: 'الحجم المناسب يعتمد على عدد أفراد الأسرة — عائلة كبيرة عادة تحتاج سعة أكبر لتغطية الاستخدام اليومي دون ازدحام. وضّح إن كانت الثلاجة لعائلة كبيرة عند البحث.' },
      { q: 'هل الثلاجة الموفرة للكهرباء تستحق فرق السعر؟', a: 'ثلاجة موفرة للكهرباء تعمل باستمرار على مدار اليوم، فالفرق في استهلاك الفاتورة يتراكم على المدى الطويل. وضّح إن كان توفير الكهرباء أولوية عندك.' },
    ],
    en: [
      { q: 'What refrigerator size fits my family?', a: 'The right size depends on household size — a larger family usually needs more capacity to cover daily use without overcrowding. Mention if it\'s for a large family when you search.' },
      { q: 'Is an energy-efficient fridge worth the price difference?', a: 'A fridge runs continuously all day, so the difference in electricity use compounds over time. Say so if lower electricity cost is a priority for you.' },
    ],
  },
  washing_machine: {
    ar: [
      { q: 'ما سعة الغسالة المناسبة لعائلتي؟', a: 'عائلة كبيرة أو استخدام يومي مكثف عادة يحتاج سعة أكبر لتقليل عدد الغسلات. وضّح إن كانت الغسالة لعائلة كبيرة عند البحث.' },
      { q: 'هل أحتاج غسالة مع نشافة مدمجة؟', a: 'غسالة بنشافة مدمجة توفر مساحة وخطوة إضافية، لكنها عادة أغلى وتغسل كميات أقل عند التجفيف. وضّح إن كنت تريد ميزة النشافة أو لا تحتاجها عند البحث.' },
    ],
    en: [
      { q: 'What washing-machine capacity fits my family?', a: 'A large family or heavy daily use usually needs more capacity to reduce how often you wash. Mention if it\'s for a large family when you search.' },
      { q: 'Do I need a washer with a built-in dryer?', a: 'A combo washer-dryer saves space and an extra step, but is typically pricier and dries smaller loads. Say whether you want or don\'t want the dryer feature when you search.' },
    ],
  },
  dishwasher: {
    ar: [
      { q: 'كم عدد الأماكن (المكان) المناسب لعائلتي؟', a: 'عائلة أكبر أو استخدام يومي مكثف يحتاج سعة أعلى لتقليل عدد مرات التشغيل. وضّح إن كانت غسالة الصحون لعائلة كبيرة عند البحث.' },
      { q: 'لماذا يهم أن تكون غسالة الصحون هادئة؟', a: 'إن كان مطبخك مفتوحًا على غرفة الجلوس أو الصالة، فمستوى الصوت أثناء التشغيل يهم أكثر. وضّح إن كان الهدوء أولوية عندك عند البحث.' },
    ],
    en: [
      { q: 'What dishwasher capacity fits my family?', a: 'A larger family or heavy daily use needs more capacity to reduce how often you run it. Mention if it\'s for a large family when you search.' },
      { q: 'Why does a quiet dishwasher matter?', a: 'If your kitchen is open to a living or dining area, noise level during operation matters more. Say so if quiet operation is a priority for you.' },
    ],
  },
  monitor: {
    ar: [
      { q: 'ما الفرق بين شاشة للعمل وشاشة للألعاب؟', a: 'شاشة العمل تستفيد أكثر من دقة عالية ووضوح للنصوص؛ شاشة الألعاب تستفيد أكثر من معدل تحديث عالٍ لحركة أسرع وأوضح. وضّح استخدامك الأساسي عند البحث.' },
    ],
    en: [
      { q: 'What\'s the difference between a work monitor and a gaming monitor?', a: 'A work monitor benefits more from high resolution and sharp text; a gaming monitor benefits more from a high refresh rate for faster, clearer motion. State your primary use when searching.' },
    ],
  },
  audio: {
    ar: [
      { q: 'أي نوع سماعات يناسبني — أذن أم رأس؟', a: 'سماعات الأذن اللاسلكية عادة أنسب للتنقل اليومي، بينما سماعات الرأس عادة توفر عزلًا أفضل للصوت وبطارية أطول. وضّح استخدامك عند البحث.' },
    ],
    en: [
      { q: 'Should I get earbuds or headphones?', a: 'Wireless earbuds are usually more convenient for daily commuting, while headphones typically offer better sound isolation and longer battery life. Mention your use case when you search.' },
    ],
  },
  smartwatch: {
    ar: [
      { q: 'ما أهم ميزة أبحث عنها في الساعة الذكية؟', a: 'إن كان تتبع اللياقة والرياضة أولوية وضّح ذلك؛ إن كانت الإشعارات والاتصال هي الأهم فحدد ذلك بدلاً منه.' },
    ],
    en: [
      { q: 'What feature should I prioritize in a smartwatch?', a: 'If fitness/workout tracking matters most, say so; if notifications and connectivity matter more, mention that instead.' },
    ],
  },
};

const UNIVERSAL: { ar: GuideQA[]; en: GuideQA[] } = {
  ar: [
    { q: 'هل السعر المعروض هو السعر الحالي فعلاً؟', a: 'السعر المعروض هو آخر سعر رصدناه فعليًا في صفحة المتجر، وليس بالضرورة السعر اللحظي — المتاجر تغيّر أسعارها باستمرار. نكتب تاريخ الرصد بجانب كل سعر، وتحقق دائمًا من السعر النهائي في صفحة المتجر قبل الشراء.' },
    { q: 'لماذا يظهر بعض المنتجات في متجر واحد فقط؟', a: 'لأننا لم نرصد ذلك المنتج بعد في متجر آخر — إما لأن متجرًا آخر لا يبيعه، أو لم نغطِّه هناك حتى الآن. نعرض مقارنة فقط عندما نرصد المنتج فعلًا في أكثر من متجر.' },
  ],
  en: [
    { q: 'Is the displayed price the current price?', a: "The displayed price is the last one we actually observed on the retailer's page, not necessarily the instant price — retailers change prices continuously. We show the observation date next to every price; always confirm the final price on the retailer's page before buying." },
    { q: 'Why does a product sometimes show only one store?', a: "Because we haven't observed that product at another store yet — either another store doesn't carry it, or we haven't covered it there yet. We only show a comparison once we've actually observed the product at more than one store." },
  ],
};

export function getCategoryGuide(categoryKey: string, locale: string): GuideQA[] {
  const isAr = locale !== 'en';
  const bespoke = BESPOKE[categoryKey];
  const bespokeQAs = bespoke ? (isAr ? bespoke.ar : bespoke.en) : [];
  const universalQAs = isAr ? UNIVERSAL.ar : UNIVERSAL.en;
  return [...bespokeQAs, ...universalQAs];
}
