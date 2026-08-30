/**
 * Radar Policy V2 — backtest against EVERY real founder-labeled candidate
 * this session has retained evidence for (integrated review, 2026-08-30).
 * Pure backtest: no database, no live wiring, no promotion. Two separate
 * evidence pools, reported separately (never pooled into one KPI, per
 * standing rule) — Radar 1's real production history and Shadow's
 * PRODUCT_RECOMMENDATION sample. This is the "tested against founder-
 * labelled Shadow evidence" step the integration review requires before any
 * policy is even considered for promotion — it is evidence, not a decision.
 */
import { scorePolicyV2, type PolicyV2Tier } from '@/lib/growth/demand-radar/shadow/policy-v2';
import type { Classification } from '@/lib/growth/demand-radar/types';

function cls(category: string | null = 'mobile'): Classification {
  return {
    category, intentClass: 'recommendation', intentStrength: 'strong', ksaRelevance: 'likely',
    isDirectQuestion: false, budgetSar: null, confidence: 0.9, via: 'heuristic',
    domain: 'product', buyingStage: 'research', intentType: 'help_request', exclusion: 'none',
  };
}

type Case = { text: string; category: string | null; founderVerdict: 'valuable' | 'not_valuable' };

// Radar 1's ENTIRE real, founder-reviewed production history (23/23) — verbatim
// texts and verdicts reconstructed from production in this session's Part 2 work.
const RADAR1_REAL: Case[] = [
  { text: '@mha_almaly أنا أبي ايفون سبع طعش', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'أحتاج مكيف يركض وراي وين ما اروح', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'ياحظكم مره ابغى ايباد من يوم كان عمري ١٠ لما بدت تنزل الايبادات الحلوة وانا ابي بالاخير اخواتي حصلو ايبادات الا انا 👌🏽', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: '@Emkan ودي جدا جدا جوالي هونر لكن أبغى جوال جديد #جوابك_يربحك', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@4TTTN @AzizbagBag يستاهل طيب انا مشجعله نصراويه ابي ايفون😃', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'والله مدري شفيني صايره منجد ابي جوال مو عشان البطارية لا لا انا ابي اكشخ بجوال جديد ولعلي ندمت اني ماطلبت من اهلي يجيبون', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@sahseh اكييييييد بشتري ايباد او لاب عشان الجامعه واذا مايكفي بشتري كل شي احتاجه عشان ابدا مشروع الكروشيه', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: 'انقمعت عشاني ابي جوال جديد 🩷 بعدين قلت انتو ما تحبوني افرج اصغر اخ بالبيت', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@yaser5066 ابي غسالة اكواب', category: 'washing_machine', founderVerdict: 'not_valuable' },
  { text: 'ابي ايباد جديد وربي ابكي ابي ولد جديد', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: '@barq ابي ايفون 👀⚡️⚡️⚡️', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@barq ابي ايباد مينيييي🥺', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: 'ابي سماعة ما تعور اذني ما تطيح مو سماعة راس شكلها حلو', category: 'audio', founderVerdict: 'not_valuable' },
  { text: 'ابي مكيف', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'محتاره بشتري لابتوب جديد الي كنت ابيه خلص والي موجود معالجه اقل منه بس ينفع عادي لي وفي نفس الوقت طرت بواحد اقوى', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: '@ovdgo2 ابي جوال', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@ovdgo2 ابي ايباد🤩', category: 'tablet', founderVerdict: 'not_valuable' },
  { text: '@__6j3 اي ابي هدايا ابي ايفون اخر اصدار ابي فلوس', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@Maya_t_59 يازين شاشتك ابغى شاشة زي كذا بكم شريتيها', category: 'tv', founderVerdict: 'not_valuable' },
  { text: 'أحتاج مكيف جري ٣٦٠٠٠ سبليت جداري هل موجود لديكم', category: 'air_conditioner', founderVerdict: 'valuable' },
  { text: '#فلة_وسيارات_هدايا_رسيس #رسيس_قول_وفعل #اليوم_الوطني ماشاء الله ربي يغنيكم انا ابي جوال فقط انسان قنوع 🥹', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'حرانة من الصبح ابغى مكيف 3 طن', category: 'air_conditioner', founderVerdict: 'not_valuable' },
  { text: 'بموت ابي   ايباد 😭😭😭😭!!!!', category: 'tablet', founderVerdict: 'not_valuable' },
];

// Shadow PRODUCT_RECOMMENDATION — all 25 real, founder-reviewed candidates
// (Checkpoint 5's 22 + the 2026-08-30 temporal-validation batch's 3), texts
// as retained in this session's HIGH-threshold audit. exclusion_noise counts
// as not_valuable for this backtest (it was noise the founder correctly
// flagged, whichever label word was used).
const SHADOW_PRODUCT_RECOMMENDATION: Case[] = [
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ قبل ما تشتري شوف المقارنة #الهلال_الخليج', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@azizthemaster @androidkq ايش افضل سامسونج الترا ٢٦ او هو', category: 'mobile', founderVerdict: 'valuable' },
  { text: 'وش افضل لعبة كلمات متقاطعه ايفون عربيه جربته؟', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'مـﻧـــ الخاصــــــ السلام عليكم ايش افضل جوال سامسونج سعره 600 ريال', category: 'mobile', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ #ليله_الجمعه', category: 'mobile', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ #زعماء_الشرقيه', category: 'mobile', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ شاهد المقارنة للنهاية واحكم #الاهلي_اوكلاند', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@SaudiAndroid طيب وش افضل جالكسي من ناحيه الاستخدام والسعر', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@SaudiAndroid بسألك وش افضل طريقة لنقل كل البيانات من ايفون إلى جالكسي؟', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'وش أفضل شريحة جوال؟', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: 'تقريبا لي فوق السنة شاري لابتوب كل ما احط خلفيه لما اطفي واشغل الجهاز تتغير الخلفية شلتها من الاعدادات ومافرق شيء افيدوني اعاني', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: 'أنا طالبة تصميم داخلي وأحتاج لابتوب يتحمل برامج التخصص مثل AutoCAD و3ds Max وRevit وSketchUp وLumion وPhotoshop وIllustrator محتارة بين هذي الأجهزة', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'اللي عنده معلومة ياليت يفيدها أنا طالبة تصميم داخلي وأحتاج لابتوب يتحمل برامج التخصص محتارة بين هذي الأجهزة', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'لي ساعتين وأنا محتارة بين اشتري أيباد مع كيبورد وقلم أو ماك بوك وبعد تفكير واستشارات تم طلب ماك بوك', category: 'laptop', founderVerdict: 'not_valuable' },
  { text: '@majedandroid وش افضل اشتري تابلت ام لابتوب شخصي .', category: 'laptop', founderVerdict: 'valuable' },
  { text: '@CEOAhmd بما انك مهندس وش افضل لابتوب متحول تنصح فيه ؟', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'ايش افضل لابتوب لتخصص CS??', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'وش تنصحوني لابتوب ل دراسة ؟', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'تخصصي تصميم جرافيك وابغا اخذ لابتوب وش تنصحوني فيه من مواصفات لاني احترت', category: 'laptop', founderVerdict: 'valuable' },
  { text: 'يا اخوان الي تخصصاتهم حاسب باخذ جهاز لابتوب وش افضل نوع ؟ مو شرط يكون افضل شي بس يكون مناسب يعني', category: 'laptop', founderVerdict: 'valuable' },
  { text: '@d7oom4cars وش افضل مكيف بينهم؟', category: 'air_conditioner', founderVerdict: 'valuable' },
  { text: '🔥 TCL QLED 65 🆚 Samsung QLED 65 محتار بين شاشة TCL وشاشة سامسونج؟ #الخلود_الاهلي', category: 'mobile', founderVerdict: 'not_valuable' },
  { text: '@Ws_n4 السؤال وش افضل لابتوب وماك لحفظ للأستخدام الدراسي ؟', category: 'laptop', founderVerdict: 'valuable' },
  { text: '@J1ASAD وش افضل مكيف موفر ل الطاقه', category: 'air_conditioner', founderVerdict: 'valuable' },
];

function backtest(cases: Case[]) {
  const rows = cases.map((c) => ({ ...c, result: scorePolicyV2(c.text, cls(c.category)) }));
  const surfaced = (t: PolicyV2Tier) => t === 'high' || t === 'medium';
  const surfacedRows = rows.filter((r) => surfaced(r.result.tier));
  const precision = surfacedRows.length > 0 ? surfacedRows.filter((r) => r.founderVerdict === 'valuable').length / surfacedRows.length : null;
  const totalValuable = rows.filter((r) => r.founderVerdict === 'valuable').length;
  const recall = totalValuable > 0 ? rows.filter((r) => r.founderVerdict === 'valuable' && surfaced(r.result.tier)).length / totalValuable : null;
  return { rows, precision, recall, surfacedCount: surfacedRows.length, totalValuable };
}

describe('Policy V2 backtest — Radar 1 real production (23 candidates, its entire history)', () => {
  const { rows, precision, recall, surfacedCount, totalValuable } = backtest(RADAR1_REAL);

  it('reports precision and recall explicitly (n=23 — below any promotion-worthy floor; this is a design check, not a promotion decision)', () => {
    console.log(`Radar1 backtest: surfaced=${surfacedCount}/23, of which valuable=${Math.round((precision ?? 0) * surfacedCount)}, recall=${recall}/${totalValuable} valuable, precision=${precision}`);
    expect(totalValuable).toBe(1);
  });

  it('the one real accept is surfaced (high or medium), not low or excluded', () => {
    const accept = rows.find((r) => r.founderVerdict === 'valuable')!;
    expect(['high', 'medium']).toContain(accept.result.tier);
    expect(accept.result.reasons).toContain('availability_question'); // "هل موجود لديكم" — buy-ready language the current formula has no signal for at all
  });

  it('does not surface every rejected candidate — some real precision improvement over the current formula, which surfaced all 23 identically at MEDIUM', () => {
    const surfacedFn = (t: PolicyV2Tier) => t === 'high' || t === 'medium';
    const rejectedSurfaced = rows.filter((r) => r.founderVerdict === 'not_valuable' && surfacedFn(r.result.tier)).length;
    expect(rejectedSurfaced).toBeLessThan(22); // current formula: 22/22 rejects also reach MEDIUM
  });

  it('catches the giveaway/contest-reply pattern the existing Shadow detectors do not', () => {
    const giveawayCase = rows.find((r) => r.text.includes('يربحك'))!;
    expect(giveawayCase.result.excluded).toBe(true);
    const nationalDayCase = rows.find((r) => r.text.includes('اليوم_الوطني'))!;
    expect(nationalDayCase.result.excluded).toBe(true);
  });

  it('catches the hyperbolic/emotional-wish pattern the existing Shadow detectors do not', () => {
    const cryingCase = rows.find((r) => r.text.includes('😭'))!;
    expect(cryingCase.result.excluded).toBe(true);
    const envyCase = rows.find((r) => r.text.includes('اخواتي'))!;
    expect(envyCase.result.excluded).toBe(true);
  });
});

describe('Policy V2 backtest — Shadow PRODUCT_RECOMMENDATION (25 candidates, kept as its own separate pool)', () => {
  const { rows, precision, recall, surfacedCount, totalValuable } = backtest(SHADOW_PRODUCT_RECOMMENDATION);

  it('reports precision and recall explicitly (n=25 — below Checkpoint 5.1s own ≥30 floor; not a promotion decision)', () => {
    console.log(`Shadow backtest: surfaced=${surfacedCount}/25, recall=${recall}/${totalValuable} valuable, precision=${precision}`);
    expect(totalValuable).toBe(15);
  });

  it('precision on this pool is directionally at or above the founder-reviewed baseline (60% FAP)', () => {
    expect(precision).not.toBeNull();
    expect(precision as number).toBeGreaterThanOrEqual(0.6);
  });

  it('the recurring merchant-ad template is excluded in every instance, including the fresh repost Checkpoint 5.1 was built against', () => {
    const adRows = rows.filter((r) => r.text.includes('🆚'));
    expect(adRows.length).toBeGreaterThan(0);
    for (const r of adRows) expect(r.result.excluded).toBe(true);
  });

  it('does not require answerability to surface a candidate — this function never reads it at all', () => {
    // Structural check: scorePolicyV2's signature takes no answerability parameter.
    expect(scorePolicyV2.length).toBe(2); // (text, cls) — no third argument exists to pass one
  });
});
