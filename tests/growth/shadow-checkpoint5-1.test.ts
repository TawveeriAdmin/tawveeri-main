/**
 * Radar 2.0 Phase 2 — Checkpoint 5.1 precision-fix tests (founder decision
 * 2026-08-29). Every rejection case below is one of the 22 real,
 * founder-reviewed Checkpoint 5 PRODUCT_RECOMMENDATION candidates (fetched
 * read-only from demand_radar_shadow_review_queue) — not a hypothetical.
 * Every "must NOT override" case is one of the 13 founder-labeled
 * `valuable` candidates from that same sample, MINUS the 2 TCL/Samsung ad
 * posts the founder labeled `valuable` inconsistently with the other 2
 * identical ad posts labeled `not_a_lead` — Checkpoint 5.1 exists in part to
 * resolve that exact inconsistency, so those 2 are asserted to override too.
 */
import fs from 'fs';
import path from 'path';
import {
  isMerchantAdComparisonBait,
  detectOwnedOrDecided,
  detectSupportOrMigration,
  isNewsOrGenericConversation,
  isCarrierLineNotDevice,
  isContextPoorReply,
  applyShadowExclusionOverrides,
} from '@/lib/growth/demand-radar/shadow/shadow-exclusion';
import { normalizeForNearDupDetection, computeContentFingerprint, NearDuplicateTracker } from '@/lib/growth/demand-radar/shadow/shadow-dedup';
import type { Classification } from '@/lib/growth/demand-radar/types';

const SHADOW_DIR = path.join(__dirname, '..', '..', 'src', 'lib', 'growth', 'demand-radar', 'shadow');
const FORBIDDEN_TABLE_REFS = [
  "'demand_radar_funnel_events'", '"demand_radar_funnel_events"',
  "'demand_radar_outcomes'", '"demand_radar_outcomes"',
];

function baseCls(overrides: Partial<Classification> = {}): Classification {
  return {
    category: 'laptop',
    intentClass: 'recommendation',
    intentStrength: 'strong',
    ksaRelevance: 'likely',
    isDirectQuestion: true,
    budgetSar: null,
    confidence: 0.8,
    via: 'llm',
    domain: 'product',
    buyingStage: 'research',
    intentType: 'recommendation',
    exclusion: 'none',
    ...overrides,
  };
}

describe('Checkpoint 5.1 isolation — static reference test', () => {
  it('shadow-exclusion.ts and shadow-dedup.ts never reference Phase 1 control tables', () => {
    for (const file of ['shadow-exclusion.ts', 'shadow-dedup.ts']) {
      const content = fs.readFileSync(path.join(SHADOW_DIR, file), 'utf8');
      for (const forbidden of FORBIDDEN_TABLE_REFS) expect(content).not.toContain(forbidden);
    }
  });

  it('neither file imports Radar 1\'s shared saudi-lexicon.ts or classify.ts prompt', () => {
    for (const file of ['shadow-exclusion.ts', 'shadow-dedup.ts']) {
      const content = fs.readFileSync(path.join(SHADOW_DIR, file), 'utf8');
      expect(content).not.toContain('saudi-lexicon');
      expect(content).not.toContain('SYSTEM_PROMPT');
    }
  });
});

describe('Checkpoint 5.1 rejection cases — real Checkpoint 5 false positives', () => {
  it('owned-device support question ("شاري لابتوب...تتغير الخلفية...افيدوني اعاني") → post_purchase_story/owns_device', () => {
    const text = 'تقريبا لي فوق السنة شاري لابتوب، كل ما احط خلفيه لما اطفي واشغل الجهاز تتغير الخلفية؟!\nشلتها من الاعدادات ومافرق شيء او مدري ممكني غلطت، افيدوني اعاني للاسف https://t.co/SlMICANTEe';
    const r = applyShadowExclusionOverrides(text, baseCls());
    expect(r).toEqual({ exclusion: 'post_purchase_story', detail: 'owns_device' });
  });

  it('decision-already-made ("محتارة بين اشتري أيباد...تم طلب ماك بوك") → post_purchase_story/decision_already_made', () => {
    const text = 'لي ساعتين وأنا محتارة بين اشتري أيباد مع كيبورد وقلم أو ماك بوك وبعد تفكير واستشارات تم طلب ماك بوك🏃🏽‍♀️‍➡️';
    const r = applyShadowExclusionOverrides(text, baseCls());
    expect(r).toEqual({ exclusion: 'post_purchase_story', detail: 'decision_already_made' });
  });

  it('merchant ad comparison bait, variant 1 (labeled not_a_lead) → ad_seller', () => {
    const text = '🔥 TCL QLED 65 🆚 Samsung QLED 65\n\nمحتار بين شاشة TCL وشاشة سامسونج؟ 👀\nقبل ما تشتري، شوف المقارنة واكتشف أي شاشة تستحق فلوسك! 💰\n\n📺 جودة الصورة\n🎮 الأداء للألعاب\n\nشاشة TCL أم شاشة سامسونج؟ 🤔\nشاهد المقارنة \n👏للطلب ⬇️\n\nhttps://t.co/uLngC5Dmxu\n\n#النصر_التعاون \n #الهلال_الخليج https://t.co/kadfZV2pCV';
    const r = applyShadowExclusionOverrides(text, baseCls({ category: 'mobile' }));
    expect(r?.exclusion).toBe('ad_seller');
  });

  it('merchant ad comparison bait, variant 2 (labeled not_a_lead) → ad_seller', () => {
    const text = '🔥 TCL QLED 65 🆚 Samsung QLED 65\n\nمحتار بين شاشة TCL وشاشة سامسونج؟ 👀\nقبل ما تشتري، شوف المقارنة واكتشف أي شاشة تستحق فلوسك! 💰\n\n📺 جودة الصورة\n🎮 الأداء للألعاب\n\nشاشة TCL أم شاشة سامسونج؟ 🤔\nشاهد المقارنة للنهاية واحكم \n👏للطلب ⬇️\nhttps://t.co/uLngC5Dmxu\n\n #الاهلي_اوكلاند https://t.co/SWAAUXwmcE';
    const r = applyShadowExclusionOverrides(text, baseCls({ category: 'mobile' }));
    expect(r?.exclusion).toBe('ad_seller');
  });

  it('the SAME ad template, on the 2 copies the founder inconsistently labeled valuable, ALSO overrides to ad_seller (this is the inconsistency Checkpoint 5.1 fixes)', () => {
    const text3eb = '🔥 TCL QLED 65 🆚 Samsung QLED 65\n\nمحتار بين شاشة TCL وشاشة سامسونج؟ 👀\nقبل ما تشتري، شوف المقارنة واكتشف أي شاشة تستحق فلوسك! 💰\n\n📺 جودة الصورة\n🎮 الأداء للألعاب\n\nشاشة TCL أم شاشة سامسونج؟ 🤔\nشاهد المقارنة \n\nhttps://t.co/UiThzH1gMV\n\n #ليله_الجمعه https://t.co/PNPSNxgtJB';
    const text305 = '🔥 TCL QLED 65 🆚 Samsung QLED 65\n\nمحتار بين شاشة TCL وشاشة سامسونج؟ 👀\nقبل ما تشتري، شوف المقارنة واكتشف أي شاشة تستحق فلوسك! 💰\n\n📺 جودة الصورة\n🎮 الأداء للألعاب\n\nشاشة TCL أم شاشة سامسونج؟ 🤔\nشاهد المقارنة \n👏للطلب ⬇️\n\nhttps://t.co/UiThzH1gMV\n\n #زعماء_الشرقيه_موعدنا_الجمعه https://t.co/CVBJOUlEbf';
    expect(applyShadowExclusionOverrides(text3eb, baseCls({ category: 'mobile' }))?.exclusion).toBe('ad_seller');
    expect(applyShadowExclusionOverrides(text305, baseCls({ category: 'mobile' }))?.exclusion).toBe('ad_seller');
  });

  it('device-migration/support question ("وش افضل طريقة لنقل كل البيانات من ايفون إلى جالكسي") → support_complaint', () => {
    const text = '@SaudiAndroid بسألك وش افضل طريقة لنقل كل البيانات من ايفون إلى جالكسي ؟';
    const r = applyShadowExclusionOverrides(text, baseCls({ category: 'mobile' }));
    expect(r).toEqual({ exclusion: 'support_complaint', detail: 'device_support_or_migration' });
  });

  it('news/narrative anecdote (UK phone-theft story, "في بريطانيا...صاروا") → news_review', () => {
    const text = 'في بريطانيا، الحرامية صاروا إذا سرقوا جوال واكتشفوا إنه سامسونج أو أي جهاز أندرويد، يرجعونه لصاحبه بنفس اللحظة! إذا ما كان آيفون ما يبونه من الأساس 😂\n\nحتى السرقة دخلها التعصب للشركات !!\n\nوش رايكم انتم وش افضل عندك ايفون او اندرويد مع ذكر الاسباب ؟ https://t.co/MCHSqsDQaa';
    const r = applyShadowExclusionOverrides(text, baseCls({ category: 'mobile' }));
    expect(r).toEqual({ exclusion: 'news_review', detail: 'news_or_narrative_anecdote' });
  });

  it('carrier/SIM line, not a device ("وش أفضل شريحة جوال؟") → generic_conversation, category nulled', () => {
    const text = 'وش أفضل شريحة جوال؟';
    const r = applyShadowExclusionOverrides(text, baseCls({ category: 'mobile' }));
    expect(r).toEqual({ exclusion: 'generic_conversation', detail: 'carrier_sim_not_device', categoryOverride: null });
  });

  it('isCarrierLineNotDevice never fires outside the mobile category (same phrase, different category)', () => {
    expect(isCarrierLineNotDevice('وش أفضل شريحة جوال؟', 'laptop')).toBe(false);
    expect(isCarrierLineNotDevice('وش أفضل شريحة جوال؟', null)).toBe(false);
  });
});

describe('Checkpoint 5.1 forward-intent guard — must NOT false-reject genuine purchase intent', () => {
  it('"ناوي اشتري" combined with an owned-device word does not fire owned/decided', () => {
    const r = detectOwnedOrDecided('اشتريت قبل جوال قديم بس الحين ناوي اشتري لابتوب جديد للجامعة');
    expect(r.fired).toBe(false);
  });

  it('"أبي اشتري" forward intent alone does not fire', () => {
    const r = detectOwnedOrDecided('أبي اشتري لابتوب للجامعة، وش تنصحوني فيه؟');
    expect(r.fired).toBe(false);
  });

  it('"ابغى اشتري" forward intent alone does not fire', () => {
    const r = detectOwnedOrDecided('ابغى اشتري مكيف جديد، ايش افضل نوع؟');
    expect(r.fired).toBe(false);
  });

  it('bare "اشتريت" (no guard phrase present) still correctly fires owns_device', () => {
    const r = detectOwnedOrDecided('اشتريت لابتوب جديد الاسبوع اللي طاف وحاب اشارك تجربتي');
    expect(r).toEqual({ fired: true, detail: 'owns_device' });
  });
});

describe('Checkpoint 5.1 regression guard — the 11 genuinely valuable Checkpoint 5 candidates must pass through unmodified', () => {
  const valuableTexts: Array<{ text: string; category: string | null }> = [
    { text: '@d7oom4cars وش افضل مكيف بينهم؟', category: 'air_conditioner' },
    { text: 'أنا طالبة تصميم داخلي وأحتاج لابتوب يتحمل برامج التخصص مثل AutoCAD و3ds Max وRevit وSketchUp وLumion وPhotoshop وIllustrator، وأهم شيء عندي ما يعلق مع المشاريع الثقيلة ويكون تبريده كويس ويخدمني سنوات محتارة بين هذي الأجهزة\n1. ASUS ROG Strix G16\n2. ASUS TUF Gaming F16\n3. Acer', category: 'laptop' },
    { text: 'اللي عنده معلومة ياليت يفيدها ⬇️\n\nأنا طالبة تصميم داخلي وأحتاج لابتوب يتحمل برامج التخصص مثل AutoCAD و3ds Max وRevit وSketchUp وLumion وPhotoshop وIllustrator، وأهم شيء عندي ما يعلق مع المشاريع الثقيلة ويكون تبريده كويس ويخدمني سنوات محتارة بين هذي الأجهزة\n1. ASUS ROG Strix G16', category: 'laptop' },
    { text: '@majedandroid وش افضل اشتري تابلت ام لابتوب شخصي .', category: 'laptop' },
    { text: '@CEOAhmd بما انك مهندس وش افضل لابتوب متحول تنصح فيه ؟', category: 'laptop' },
    { text: 'ايش افضل لابتوب لتخصص CS??', category: 'laptop' },
    { text: 'وش تنصحوني لابتوب ل دراسة ؟', category: 'laptop' },
    { text: 'تخصصي تصميم جرافيك وابغا اخذ لابتوب وش تنصحوني فيه من مواصفات لاني احترت', category: 'laptop' },
    { text: 'يا اخوان الي تخصصاتهم حاسب باخذ جهاز لابتوب وش افضل نوع ؟ \n\nمو شرط يكون افضل شي بس يكون مناسب يعني', category: 'laptop' },
    { text: '@azizthemaster @androidkq ايش افضل سامسونج الترا ٢٦ او هو', category: 'mobile' },
    { text: '💢 مـﻧـــ الخاصــــــ  📩 \n\nالسلام عليكم ايش افضل جوال سامسونج سعره  600 ريال', category: 'mobile' },
  ];

  it.each(valuableTexts)('does not override: "$text"', ({ text, category }) => {
    const r = applyShadowExclusionOverrides(text, baseCls({ category }));
    expect(r).toBeNull();
  });
});

describe('Checkpoint 5.1 near-duplicate suppression (shadow-dedup.ts)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { process.env = { ...OLD_ENV, DEMAND_RADAR_FINGERPRINT_SECRET: 'test-secret' }; });
  afterEach(() => { process.env = OLD_ENV; });

  it('normalizes away URL/hashtag/mention/emoji, keeps the core Arabic text', () => {
    const a = normalizeForNearDupDetection('🔥 وش افضل جوال بميزانية 2000؟ للطلب واتساب @seller123 #عروض https://t.co/abc123');
    const b = normalizeForNearDupDetection('👀 وش افضل جوال بميزانية 2000؟ للطلب واتساب @differentseller #تخفيضات https://t.co/xyz999');
    expect(a).toBe(b);
  });

  it('two posts identical except for tracking link + hashtag fingerprint to the same value', () => {
    const fpA = computeContentFingerprint('x', 'قارن قبل ما تشتري #عروض_اليوم https://t.co/link1');
    const fpB = computeContentFingerprint('x', 'قارن قبل ما تشتري #تخفيضات_الجمعة https://t.co/link2');
    expect(fpA).toBe(fpB);
  });

  it('genuinely different posts fingerprint differently', () => {
    const fpA = computeContentFingerprint('x', 'وش افضل لابتوب لتخصص CS؟');
    const fpB = computeContentFingerprint('x', 'وش افضل مكيف بينهم؟');
    expect(fpA).not.toBe(fpB);
  });

  it('NearDuplicateTracker suppresses the 2nd+ occurrence within a run but not the 1st, and never suppresses a distinct post', () => {
    const tracker = new NearDuplicateTracker();
    const template1 = (link: string, tag: string) => `🔥 TCL QLED 65 🆚 Samsung QLED 65 قبل ما تشتري، شوف المقارنة! ${tag} ${link}`;
    expect(tracker.seen('x', template1('https://t.co/aaa', '#tag1'))).toBe(false); // first occurrence — not a duplicate
    expect(tracker.seen('x', template1('https://t.co/bbb', '#tag2'))).toBe(true); // same template, different link/tag — near-dup
    expect(tracker.seen('x', 'وش افضل لابتوب لتخصص CS؟')).toBe(false); // unrelated post — never suppressed
  });

  it('an empty-after-normalization text (e.g. a bare URL) is never suppressed as a false near-duplicate', () => {
    const tracker = new NearDuplicateTracker();
    expect(tracker.seen('x', 'https://t.co/onlyalink')).toBe(false);
    expect(tracker.seen('x', 'https://t.co/onlyalink')).toBe(false); // still never suppresses on a null fingerprint
  });
});

describe('Checkpoint 5.1 detector unit coverage', () => {
  it('isMerchantAdComparisonBait requires >=2 signals — a single CTA phrase alone does not fire', () => {
    expect(isMerchantAdComparisonBait('للطلب تواصل معي بالخاص')).toBe(false);
  });

  it('detectSupportOrMigration requires verb+noun co-occurrence — a bare migration verb alone does not fire', () => {
    expect(detectSupportOrMigration('ودي انقل الى شركة ثانية للعمل')).toBe(false);
  });

  it('isNewsOrGenericConversation does not fire on an ordinary recommendation question containing "وش افضل"', () => {
    expect(isNewsOrGenericConversation('وش افضل جوال تحت 2000 ريال؟')).toBe(false);
  });

  it('isContextPoorReply (standalone, NOT wired into applyShadowExclusionOverrides) fires only on a very short stripped reply', () => {
    expect(isContextPoorReply('@user اوكي')).toBe(true);
    expect(isContextPoorReply('@user وش افضل لابتوب لتخصص CS يتحمل برامج ثقيلة؟')).toBe(false);
    expect(isContextPoorReply('وش افضل لابتوب؟')).toBe(false); // not reply-shaped at all — never fires
  });
});

describe('Checkpoint 5.1 known gap — implicit-antecedent context-poor replies (deferred to Context Resolver)', () => {
  // Real Checkpoint 5 candidate, founder-labeled not_a_lead: an ambiguous
  // @-reply asking "which Galaxy" without naming which models, presumably
  // referring back to models named in the parent tweet this text doesn't
  // include. isContextPoorReply's length-based heuristic does not fire on
  // it (45+ chars after stripping the mention) — and a structurally
  // identical implicit-antecedent pattern ("...سامسونج الترا ٢٦ او هو") was
  // labeled `valuable` by the founder, so no non-speculative textual rule
  // in this file separates the two. This test pins the current, honest
  // behavior (no override fires) so a future change doesn't silently start
  // firing on this case without deliberate review.
  const text = '@SaudiAndroid طيب وش افضل جالكسي من ناحيه الاستخدام والسعر';

  it('isContextPoorReply does not fire on it (too long — the miss is a length-heuristic mismatch, not a bug)', () => {
    expect(isContextPoorReply(text)).toBe(false);
  });

  it('applyShadowExclusionOverrides does not override it — a tracked, deferred gap, not claimed coverage', () => {
    expect(applyShadowExclusionOverrides(text, baseCls({ category: 'mobile' }))).toBeNull();
  });
});
