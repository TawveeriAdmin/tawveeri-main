// F7·1 — THE TESTS ARE THE ANTI-DRIFT MECHANISM, not a formality.
//
// A vocabulary module that can disagree with the document it derives from is worse than no
// module: it produces confident, citable, wrong verdicts. Every test here exists to make one
// specific silent failure loud.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FORBIDDEN_CLAIMS,
  APPROVED_STATEMENTS,
  REPLACEMENT_PAIRS,
  INTERNAL_TOKENS,
  PATTERN_RULES,
  EVIDENCE_REQUIRED_RULES,
  VOCABULARY_VERSION,
  vocabularyFingerprint,
  checkCustomerText,
  findInternalLeaks,
  checkCustomerSurface,
  PENDING_COPY_DECISIONS,
} from '@/lib/vocabulary';
import { CATEGORY_SPEC_FILTERS } from '@/lib/scraping/config/spec-configs';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const LAUNCH_VOCABULARY = read('docs/LAUNCH_VOCABULARY.md');
const GOVERNING = [
  LAUNCH_VOCABULARY,
  read('CLAUDE.md'),
  read('docs/CONSUMER_EXPERIENCE_CONSTITUTION.md'),
].join('\n');

// Curly vs straight apostrophes differ between our copy and the document; normalise only that.
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\r\n/g, '\n');

describe('AC1 — every rule is anchored to a verbatim quote in a governing document', () => {
  const entries = [
    ...FORBIDDEN_CLAIMS.map((r) => ['forbidden', r.id, r.source] as const),
    ...APPROVED_STATEMENTS.map((s) => ['approved', s.id, s.source] as const),
    ...REPLACEMENT_PAIRS.map((p) => ['replacement', p.id, p.source] as const),
    ...INTERNAL_TOKENS.map((t) => ['internal', t.id, t.source] as const),
  ];

  it.each(entries)('%s/%s quote exists in a governing document', (_kind, _id, source) => {
    expect(norm(GOVERNING)).toContain(norm(source.quote));
  });

  // The customer vocabulary specifically must trace to LAUNCH_VOCABULARY.md — that is the
  // document Appendix F1 requires be amended first.
  it.each([
    ...FORBIDDEN_CLAIMS.map((r) => [r.id, r.source] as const),
    ...APPROVED_STATEMENTS.map((s) => [s.id, s.source] as const),
    ...REPLACEMENT_PAIRS.map((p) => [p.id, p.source] as const),
  ])('customer rule %s traces to LAUNCH_VOCABULARY.md', (_id, source) => {
    expect(norm(LAUNCH_VOCABULARY)).toContain(norm(source.quote));
  });
});

describe('AC2 — recall: every MUST-NOT-SAY example the document gives is caught', () => {
  // Taken from §3 and §9 of the document. If the document adds an example, add it here — a rule
  // set that silently stops covering its own examples is the failure this catches.
  const forbiddenExamples: Array<[string, string]> = [
    ['price-currency-claim', 'real-time prices from every store'],
    ['price-currency-claim', 'Compare live prices now'],
    ['price-currency-claim', 'up-to-date prices'],
    ['price-currency-claim', 'أسعار لحظية من المتاجر'],
    ['price-currency-claim', 'الأسعار في الوقت الفعلي'],
    // PARITY. The first version of the Arabic pattern carried «حالية» but not «الحالي», so it
    // missed these while catching the English "current price" sitting beside them in the same
    // bundle — the one-sided audit §1 records as how «في الوقت الفعلي» survived.
    ['price-currency-claim', 'السعر الحالي'],
    ['price-currency-claim', 'أفضل سعر حالياً'],
    ['refresh-cadence', 'Prices updated daily'],
    ['refresh-cadence', 'updated continuously'],
    ['refresh-cadence', 'we update prices every hour'],
    ['refresh-cadence', 'نحدّث الأسعار يوميًا'],
    ['refresh-cadence', 'الأسعار تحدث باستمرار'],
    ['comprehensive-market', 'we track every price in Saudi Arabia'],
    ['comprehensive-market', 'compares prices from all stores'],
    ['comprehensive-market', 'نتابع كل الأسعار في السعودية'],
    ['retired-retailer-count-string', 'Search products from 8 Saudi retailers'],
    ['retired-retailer-count-string', 'ابحث في منتجات 8 متاجر سعودية'],
    ['official-partnership', 'Official partnerships with top stores'],
    ['official-partnership', 'شراكات رسمية مع أكبر المتاجر'],
    ['exclusive-coupon', 'Exclusive Coupon Codes'],
    ['exclusive-coupon', 'أكواد خصم حصرية'],
    ['internal-engineering-figure', 'journey harness 112/112'],
    ['internal-engineering-figure', '770/770 verified'],
    ['competitor-retroactive-claim', 'We hold price history no competitor can buy retroactively.'],
    ['competitor-retroactive-claim', 'سجل أسعار لا يمكن شراؤه بأثر رجعي'],
    ['compliance-claim', 'Compliant with the EU AI Act'],
  ];

  it.each(forbiddenExamples)('%s catches: %s', (ruleId, sample) => {
    const hits = checkCustomerText(sample);
    expect(hits.map((h) => h.ruleId)).toContain(ruleId);
  });

  it('every pattern rule is exercised by at least one example', () => {
    const covered = new Set(forbiddenExamples.map(([id]) => id));
    const uncovered = PATTERN_RULES.map((r) => r.id).filter((id) => !covered.has(id));
    expect(uncovered).toEqual([]);
  });
});

describe('AC3 — precision: the approved corpus produces zero violations', () => {
  const approvedCorpus: string[] = [
    ...APPROVED_STATEMENTS.flatMap((s) => [s.text.ar, s.text.en]),
    ...REPLACEMENT_PAIRS.flatMap((p) => [p.use.ar, p.use.en]),
    // §2 CAN SAY, including the figure the document explicitly approves.
    'We compare 758 products across Saudi retailers.',
    'نقارن أسعار 758 منتجًا بين متاجر سعودية.',
    'The link takes you to that exact product.',
    'الرابط ينقلك إلى نفس المنتج في المتجر.',
    'Among the offers we examined, 70% of advertised discounts referenced a price that never appeared in our observed history.',
    'Price history appears when enough observed data is available.',
    // Documented as TRUE and near-identical to a forbidden claim — the three the document
    // singles out. These are exactly what a careless rule set flags.
    'بحث فوري',
    'إشعارات فورية',
    'Instant search',
    // Ordinary product surface language that must never trip a rule.
    'آخر رصد قبل 11 يومًا',
    'Last observed 11 days ago',
    'قارن السعر بين 3 متاجر',
    'Compare across 3 stores',
  ];

  it.each(approvedCorpus)('clean: %s', (text) => {
    const hits = checkCustomerText(text);
    expect(hits.map((h) => `${h.ruleId}:${h.match}`)).toEqual([]);
  });

  it('no internal token appears in approved copy', () => {
    for (const text of approvedCorpus) expect(findInternalLeaks(text)).toEqual([]);
  });
});

describe('AC4 — customer and internal vocabularies are separate', () => {
  it('no id is shared between the two registries', () => {
    const customer = new Set(FORBIDDEN_CLAIMS.map((r) => r.id));
    const internal = INTERNAL_TOKENS.map((t) => t.id);
    expect(internal.filter((id) => customer.has(id))).toEqual([]);
  });

  it('internal tokens are not expressed as customer claim patterns', () => {
    const allPatterns = FORBIDDEN_CLAIMS.flatMap((r) => [...r.patterns.ar, ...r.patterns.en]).join(' ');
    for (const group of INTERNAL_TOKENS) {
      for (const token of group.tokens) expect(allPatterns).not.toContain(token);
    }
  });

  it('the two checkers answer different questions on the same string', () => {
    const leak = 'Samsung NO_STORAGEGB Galaxy';
    expect(checkCustomerText(leak)).toEqual([]);        // not a claim
    expect(findInternalLeaks(leak).length).toBeGreaterThan(0); // but a containment failure
  });
});

describe('AC5 — category-agnostic', () => {
  it('no rule mentions any product category the app knows about', () => {
    const categories = Object.keys(CATEGORY_SPEC_FILTERS);
    expect(categories.length).toBeGreaterThan(0); // guard: an empty list would pass vacuously

    const serialised = JSON.stringify({ FORBIDDEN_CLAIMS, APPROVED_STATEMENTS, REPLACEMENT_PAIRS }).toLowerCase();
    const mentioned = categories.filter((c) => serialised.includes(`"${c}"`) || serialised.includes(` ${c} `));
    expect(mentioned).toEqual([]);
  });
});

describe('AC6 — versioned: the fingerprint is pinned so an edit cannot be silent', () => {
  // BUMP `VOCABULARY_VERSION` AND THIS CONSTANT TOGETHER, in the same change that amends
  // `docs/LAUNCH_VOCABULARY.md`. If this test fails and you did not intend to change the
  // vocabulary, you changed the vocabulary.
  const PINNED_FINGERPRINT = '62260a0c';
  const PINNED_VERSION = '2026-07-31+1';

  it('version is pinned', () => {
    expect(VOCABULARY_VERSION).toBe(PINNED_VERSION);
  });

  it('fingerprint is pinned', () => {
    expect(vocabularyFingerprint()).toBe(PINNED_FINGERPRINT);
  });

  it('fingerprint is deterministic', () => {
    expect(vocabularyFingerprint()).toBe(vocabularyFingerprint());
  });
});

describe('the pending-copy register cannot become a suppression list', () => {
  // A debt register earns its place only while every entry still corresponds to real copy.
  // A stale entry is how a temporary acknowledgement becomes permanent silence — so it fails
  // here as well as in the scanner, which means it fails in CI without anyone running the scan.
  const bundleValue = (locale: string, where: string): string | undefined => {
    const [file, key] = where.split(':');
    const json = JSON.parse(read(join('messages', locale, file)));
    return key.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), json) as string | undefined;
  };

  it.each(PENDING_COPY_DECISIONS.map((p) => [p.where, p] as const))(
    '%s still exists and still trips its rule',
    (where, pending) => {
      for (const locale of ['ar', 'en'] as const) {
        const value = bundleValue(locale, where);
        expect(typeof value).toBe('string');
        expect(value).toBe(pending.shipped[locale]);
        expect(checkCustomerText(value as string).map((v) => v.ruleId)).toContain(pending.ruleId);
      }
    },
  );

  it('every pending entry names an owner and a reason', () => {
    for (const p of PENDING_COPY_DECISIONS) {
      expect(p.owner.length).toBeGreaterThan(0);
      expect(p.reason.length).toBeGreaterThan(40);
    }
  });
});

describe('undecidable rules are declared, not hidden', () => {
  it('evidence-required rules carry no patterns', () => {
    for (const r of EVIDENCE_REQUIRED_RULES) {
      expect(r.patterns.ar).toEqual([]);
      expect(r.patterns.en).toEqual([]);
    }
  });

  it('a clean result still reports what it could not decide', () => {
    const res = checkCustomerSurface('Compare prices across Saudi retailers');
    expect(res.clean).toBe(true);
    expect(res.undecided.length).toBeGreaterThan(0);
    expect(res.undecided).toContain('fixed-retailer-count');
  });

  it('every rule id is unique', () => {
    const ids = FORBIDDEN_CLAIMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
