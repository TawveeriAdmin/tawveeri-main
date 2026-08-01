// F7·1 — CUSTOMER VOCABULARY. What a customer may read, and what they must never read.
//
// Derived from `docs/LAUNCH_VOCABULARY.md` (§2 CAN SAY · §3 MUST NOT SAY · §4 replacements ·
// §6 the frame · §8 the AI disclosure · §9 the retailer-count amendment) and Constitution
// Appendix F7. The document is the authority; this file is derived and anchored to it by the
// verbatim `source.quote` on every entry.
//
// CATEGORY-AGNOSTIC BY CONSTRUCTION. Not one rule below names a product category. Every rule is
// a CLAIM CLASS — a refresh cadence, a currency claim, a comprehensive-market claim — so a
// category added tomorrow inherits the whole set without anyone remembering to extend it. A test
// asserts this holds by checking the serialised rule set against the app's own category keys.
//
// SEPARATION. This file governs CUSTOMER-FACING language only. Tokens that exist solely inside
// the system — identity sentinels, internal table names — are a different kind of thing and live
// in `internal-vocabulary.ts`. They are never merged: one asks "may a customer read this claim",
// the other asks "has an internal token escaped". A test asserts no token crosses over.
import type { ApprovedStatement, ForbiddenClaim, ReplacementPair } from './types';

// Arabic-safe boundaries. `\b` is defined on [A-Za-z0-9_] and NEVER matches beside an Arabic
// letter — three defects in this codebase have come from that (ADR-153). Use these instead.
const AR_START = '(?:^|[^\\p{L}])';
const AR_END = '(?:[^\\p{L}]|$)';

export const FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  {
    id: 'price-currency-claim',
    title: 'Prices described as real-time, live, current or up-to-date',
    why:
      'We publish OBSERVED prices with an observation date. Any word implying the price is ' +
      'current at read time asserts a freshness we do not have and cannot evidence.',
    enforcement: 'pattern',
    patterns: {
      // Proximity to a price term is REQUIRED, and that is what gives this rule its precision:
      // «إشعارات فورية» (notification speed) and "instant search" are recorded in the document
      // as TRUE, and cannot match here because neither sits beside a price.
      en: [
        '(?:real[-\\s]?time|live|current|up[-\\s]?to[-\\s]?date)[^.!?\\n]{0,40}\\bprices?\\b',
        '\\bprices?\\b[^.!?\\n]{0,40}(?:real[-\\s]?time|live|up[-\\s]?to[-\\s]?date)',
      ],
      ar: [
        // «الحالي» (masc.) as well as «حالية» (fem.) and «حالياً». The first version of this
        // pattern carried only «حالية» and therefore MISSED «السعر الحالي» — live in the
        // price-alert copy — while catching the English "current price" beside it. That is
        // exactly the one-sided audit §1 records: «في الوقت الفعلي» survived an English-only
        // pass and stood for the majority of our users.
        `(?:سعر|أسعار|السعر|الأسعار)[^.!?\\n]{0,40}(?:لحظي|لحظية|مباشرة|مباشر|حالية|الحالية|الحالي|حالي|حاليًا|حالياً|في الوقت الفعلي)${AR_END}`,
        `${AR_START}(?:لحظية|لحظي|في الوقت الفعلي)[^.!?\\n]{0,40}(?:سعر|أسعار|السعر|الأسعار)`,
      ],
    },
    allowedContext: {
      // «مباشرة» also means "directly" — the document's objection is to price currency only.
      ar: ['ينقلك مباشرة', 'مباشرة إلى المتجر'],
      en: [],
    },
    source: {
      section: '§3',
      quote: '"**real-time** / **live** / **current** / **up-to-date** prices"',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'refresh-cadence',
    title: 'Any promise of an update schedule',
    why:
      'Ingestion is opportunistic and per-retailer. A cadence is a promise about the future, ' +
      'and we have no mechanism that could keep it or evidence that we did.',
    enforcement: 'pattern',
    patterns: {
      en: [
        'updated?\\s+(?:daily|hourly|continuously|regularly|constantly|every\\s+\\w+)',
        '\\bprices?\\b[^.!?\\n]{0,30}\\bare\\s+updated\\b',
        '\\bwe\\s+update\\s+(?:the\\s+)?prices?\\b',
      ],
      ar: [
        `${AR_START}(?:نحدّث|نحدث|تُحدّث|تحدث|يتم تحديث)[^.!?\\n]{0,30}(?:يوميًا|يوميا|باستمرار|كل ساعة|دوريًا|دوريا)`,
        `${AR_START}(?:نحدّث|نحدث)\\s+(?:الأسعار|السعر)`,
        `${AR_START}(?:الأسعار|السعر)\\s+(?:تُحدّث|تحدث)`,
      ],
    },
    source: {
      section: '§3',
      quote: '"updated **daily** / **hourly** / **continuously**" — any refresh cadence',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'comprehensive-market',
    title: 'Any claim to cover every price, store or product',
    why:
      'Coverage is partial and measured. A totalising claim is the one falsehood a price ' +
      'comparison site is most tempted by and least able to defend.',
    enforcement: 'pattern',
    patterns: {
      en: [
        '\\b(?:track|cover|compare|monitor)\\w*\\s+(?:every|all)\\s+(?:price|store|retailer|product|shop)',
        '\\b(?:every|all)\\s+(?:prices?|stores?|retailers?)\\s+in\\s+saudi',
        '\\bfrom\\s+all\\s+(?:stores|retailers|shops)\\b',
      ],
      ar: [
        `${AR_START}(?:نتابع|نقارن|نغطي|نرصد)\\s+(?:كل|جميع)\\s+(?:الأسعار|المتاجر|المنتجات)`,
        `${AR_START}(?:كل|جميع)\\s+(?:الأسعار|المتاجر)\\s+في\\s+السعودية`,
        `${AR_START}من\\s+(?:كل|جميع)\\s+المتاجر${AR_END}`,
      ],
    },
    source: {
      section: '§3',
      quote: '"we track **every**/**all** prices in Saudi Arabia" — any comprehensive-market claim',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'retired-retailer-count-string',
    title: 'The retired «8 متاجر سعودية» / "8 Saudi retailers" copy',
    why:
      'Retired by the §9 amendment: the figure was wrong in COMPOSITION, not only in size — its ' +
      'set included two retailers that are not production-deep and omitted two that are. This ' +
      'rule catches the exact retired strings; the general case is `fixed-retailer-count`.',
    enforcement: 'pattern',
    patterns: {
      en: ['\\b8\\s+saudi\\s+retailers\\b'],
      ar: [`${AR_START}8\\s+متاجر\\s+سعودية`, `${AR_START}٨\\s+متاجر\\s+سعودية`],
    },
    source: {
      section: '§9',
      quote: 'Search products from **8 Saudi retailers** and compare available prices.',
    },
    since: 'LAUNCH_VOCABULARY §9 amendment 2026-07-31',
  },

  {
    id: 'official-partnership',
    title: 'Claiming official partnerships with retailers',
    why: 'We have none. The Amazon affiliate programme is the only commercial relationship.',
    enforcement: 'pattern',
    patterns: {
      en: ['\\bofficial\\s+partnerships?\\b', '\\bpartnered\\s+(?:officially\\s+)?with\\b'],
      ar: [`${AR_START}شراكات?\\s+رسمية`, `${AR_START}شراكة\\s+رسمية`],
    },
    source: {
      section: '§3',
      quote: '"**Official partnerships** with retailers" — we have none',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'exclusive-coupon',
    title: 'Coupons described as exclusive',
    why:
      'The `coupons` table holds zero rows. "Exclusive" was not merely unverified — there is no ' +
      'coupon data behind the claim at all.',
    enforcement: 'pattern',
    patterns: {
      en: ['\\bexclusive\\b[^.!?\\n]{0,30}\\bcoupons?\\b', '\\bcoupons?\\b[^.!?\\n]{0,30}\\bexclusive\\b'],
      ar: [
        `(?:كوبون|أكواد|كود|خصم)[^.!?\\n]{0,30}${AR_START}حصري`,
        `${AR_START}حصرية[^.!?\\n]{0,30}(?:كوبون|أكواد|خصم)`,
      ],
    },
    source: {
      section: '§3',
      quote: 'for coupons — the coupon table is empty',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'internal-engineering-figure',
    title: 'Publishing a harness, test or gate result',
    why:
      'They are evidence for us, not a benefit to a customer, and quoting them publicly invites ' +
      'a question we have no interest in answering. The customer-facing translation of a passing ' +
      'gate is simply: the journey works.',
    enforcement: 'pattern',
    patterns: {
      // `112/112`, `770/770`, `86/86` — the documented shape is an identical numerator and
      // denominator, which a rating or a price range never is. Precision without an exclusion list.
      en: [
        '\\b(\\d{2,4})\\s*/\\s*\\1\\b',
        '\\b(?:harness|test suite|gate)\\b[^.!?\\n]{0,30}\\b(?:pass(?:ed|ing)?|result)\\b',
      ],
      ar: [
        '\\b(\\d{2,4})\\s*/\\s*\\1\\b',
        `${AR_START}(?:اختبار|فحص)[^.!?\\n]{0,20}(?:ناجح|نجح|اجتاز)`,
      ],
    },
    source: { section: '§3', quote: 'any harness, test or gate result.' },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'competitor-retroactive-claim',
    title: 'The "no competitor can buy this retroactively" line',
    why:
      'Competitor language, not customer language — it answers nothing for a shopper and carries ' +
      'an implicit comparison we would then have to defend.',
    enforcement: 'pattern',
    patterns: {
      en: ['\\bno\\s+competitor\\b[^.!?\\n]{0,40}\\bretroactive'],
      ar: [`${AR_START}لا\\s+يمكن\\s+شراؤه\\s+بأثر\\s+رجعي`],
    },
    source: {
      section: '§3',
      quote: 'We hold price history no competitor can buy retroactively.',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'compliance-claim',
    title: 'Asserting regulatory compliance or jurisdiction',
    why:
      'We adopt the AI-disclosure standard because it is right for a product whose promise is ' +
      'evidence — not because we are asserting that EU law governs Tawveeri in Saudi Arabia. ' +
      'A compliance claim is a legal assertion, and we make none.',
    enforcement: 'pattern',
    patterns: {
      en: ['\\beu\\s+ai\\s+act\\b', '\\b(?:fully\\s+)?compliant\\s+with\\b', '\\bgdpr[-\\s]compliant\\b'],
      ar: [`${AR_START}متوافق(?:ون|ة)?\\s+مع\\s+(?:قانون|لائحة|نظام)`, `${AR_START}قانون\\s+الذكاء\\s+الاصطناعي`],
    },
    source: { section: '§8', quote: 'Never publish a compliance claim.' },
    since: 'LAUNCH_VOCABULARY §8 2026-07-31',
  },

  // ── NOT TEXT-DETECTABLE. Present on purpose. ────────────────────────────────────────────
  // These are exported with NO patterns so F7·2 must resolve them against structured evidence.
  // Omitting them would hand the validator a false sense of coverage; guessing at a pattern
  // would produce a checker that is confidently wrong in one direction or the other.

  {
    id: 'catalogue-presented-as-comparable',
    title: 'A catalogue-size figure presented as the comparable count',
    why:
      'Undecidable from text: «5,023 products compared» is forbidden and «we compare 758 ' +
      'products» is approved, and the two sentences are the same shape. Only the evidence behind ' +
      'the number separates them. A pattern would either miss the violation or flag the approved ' +
      'statement — both silently.',
    enforcement: 'evidence-required',
    patterns: { ar: [], en: [] },
    source: {
      section: '§3',
      quote: 'that is the catalogue; **758** is comparable. Never merge them',
    },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },

  {
    id: 'fixed-retailer-count',
    title: 'Any fixed retailer count not derived from a live query',
    why:
      'Undecidable from rendered text: a hardcoded «8 متاجر» and a count substituted from a live ' +
      'per-product query are textually identical. `compareAcross(storeCount)` renders a legitimate ' +
      'derived count on every multi-store card, and a text rule would flag it. The distinction is ' +
      'provenance, so the check belongs to evidence, not to matching.',
    enforcement: 'evidence-required',
    patterns: { ar: [], en: [] },
    source: {
      section: '§9',
      quote: 'Any fixed retailer count in customer-facing copy',
    },
    since: 'LAUNCH_VOCABULARY §9 amendment 2026-07-31',
  },

  {
    id: 'excluded-retailer-as-comparison-source',
    title: 'LuLu or Sharaf DG named as a comparison source',
    why:
      'Approved for INGESTION, forbidden as a NAMED comparison source. Whether a retailer name ' +
      'is being used as a comparison source is a question about the surface, not about the ' +
      'string — the same name is legitimate on a store listing. Enforced in code, where the ' +
      'context is known.',
    enforcement: 'evidence-required',
    patterns: { ar: [], en: [] },
    codeAuthority: 'COMPARISON_DISPLAY_EXCLUDED / isDisplayableRetailer (src/lib/retailers/approved-retailers.ts)',
    source: { section: '§3', quote: '**LuLu** or **Sharaf DG** named as comparison sources' },
    since: 'LAUNCH_VOCABULARY 2026-07-30',
  },
] as const;

/** §2 · §6 · §8 · §9 — what we MAY say. Wording is exact where the document says so. */
export const APPROVED_STATEMENTS: readonly ApprovedStatement[] = [
  {
    id: 'provenance-and-observation-date',
    text: {
      ar: 'نعرض لك من أي متجر جاء السعر، ومتى رصدناه.',
      en: 'We show which retailer each price came from, and when we observed it.',
    },
    verbatim: false,
    source: { section: '§2', quote: 'and **when we observed it**' },
  },
  {
    id: 'saving-only-when-observed',
    text: {
      ar: 'لا ننشر توفيرًا إلا إذا رصدناه بأنفسنا — ورقمنا غالبًا أقل من رقم المتجر.',
      en: 'We publish a saving only when we observed the drop ourselves — our number is often lower than the retailer’s.',
    },
    verbatim: false,
    source: { section: '§2', quote: 'only when we observed the drop ourselves' },
  },
  {
    id: 'we-say-when-we-do-not-know',
    text: { ar: 'حين لا نعرف، نقول لا نعرف.', en: 'When we don’t know, we say so.' },
    verbatim: false,
    source: { section: '§2', quote: 'When we don’t know, **we say so**' },
  },
  {
    id: 'history-not-invented',
    text: {
      ar: 'نبني سجل السعر من يوم رصدناه، ولا نعرض تاريخًا لم نملكه.',
      en: 'We build price history from the day we observe it; we do not invent earlier data.',
    },
    verbatim: false,
    source: { section: '§2', quote: 'we do not invent earlier data' },
  },
  {
    id: 'one-line-frame',
    text: {
      ar: 'نُظهر لك السعر، ومن أين جاء، ومتى رصدناه — وحين لا نعرف، نقول ذلك.',
      en: 'We show you the price, where it came from, and when we observed it — and when we don’t know, we say so.',
    },
    verbatim: true,
    source: { section: '§6', quote: 'THE ONE-LINE FRAME' },
  },
  {
    id: 'ai-disclosure',
    text: {
      ar: 'وفّر مساعد تسوّق ذكي (ذكاء اصطناعي) — يقترح بناءً على أسعار رصدناها.',
      en: 'Waffar is an AI shopping assistant — it suggests based on prices we observed.',
    },
    // The second clause says what the answers rest on. It is the whole difference between us and
    // a chatbot with opinions, and the document forbids dropping or paraphrasing it.
    verbatim: true,
    source: { section: '§8', quote: 'Approved public wording — use exactly this' },
  },
  {
    id: 'retailer-capability-statement',
    text: { ar: 'قارن الأسعار بين متاجر سعودية', en: 'Compare prices across Saudi retailers' },
    // Replaces the retired count. True permanently; the count had to be re-earned on every
    // ingestion change.
    verbatim: true,
    source: { section: '§9', quote: 'Compare prices across Saudi retailers' },
  },
] as const;

/** §4 — past-tense, evidence-anchored substitutions. */
export const REPLACEMENT_PAIRS: readonly ReplacementPair[] = [
  {
    id: 'observed-not-updated',
    use: { ar: 'رصدنا / آخر رصد / تاريخ الرصد', en: 'observed / last observed / observation date' },
    insteadOf: { ar: 'نحدّث / مباشر / لحظي', en: 'updated / live / real-time' },
    source: { section: '§4', quote: '"observed" / "last observed" / "observation date"' },
  },
  {
    id: 'highest-observed-not-original',
    use: { ar: 'أعلى سعر رصدناه', en: 'highest price we observed' },
    insteadOf: { ar: 'أعلى سعر', en: 'original price' },
    source: { section: '§4', quote: '"highest price we observed"' },
  },
] as const;
