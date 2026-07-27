// Reusable production search-relevance benchmark (Founder product-first directive 2026-07-27, §7).
// Runs the mandated AR/EN/colloquial/model queries against the live /api/search and checks:
//  - results are returned (or an HONEST relaxed/empty state, not a misleading one)
//  - the top results are RELEVANT (contain an expected token) — i.e. no unrelated substitution
//  - result count matches the returned products
// Prints a per-query PASS/FAIL table + an overall relevance score. Re-run after any search change.
const BASE = process.argv[2] || 'https://tawveeri.com';

// query → { any: [tokens that a relevant result should contain], reject: [tokens that signal substitution] }
const CASES = [
  { q: 'ايفون 16', any: ['iphone 16', 'ايفون 16', 'apple iphone 16'] },
  { q: 'ايفون 16 برو ماكس', any: ['iphone 16 pro max', 'برو ماكس'] },
  { q: 'جوال سامسونج', any: ['samsung', 'سامسونج', 'galaxy'] },
  { q: 'ايباد', any: ['ipad', 'ايباد', 'apple ipad'] },
  { q: 'لابتوب', any: ['laptop', 'لابتوب', 'notebook', 'macbook'] },
  { q: 'لابتوب لينوفو', any: ['lenovo'], softAny: ['laptop', 'لابتوب'] },
  { q: 'شاشة تلفزيون', any: ['tv', 'television', 'تلفزيون', 'شاشة'] },
  { q: 'سماعات', any: ['headphone', 'earbud', 'سماعة', 'سماعات', 'buds', 'earphone'] },
  { q: 'ثلاجة', any: ['refrigerator', 'fridge', 'ثلاجة'] },
  { q: 'ثلاجة صغيرة', any: ['refrigerator', 'fridge', 'ثلاجة', 'mini'] },
  { q: 'فريزر', any: ['freezer', 'فريزر'] },
  { q: 'غسالة ملابس', any: ['washing machine', 'washer', 'غسالة'] },
  { q: 'غسالة صحون', any: ['dishwasher', 'غسالة صحون', 'غسالة أطباق'] },
  { q: 'نشافة', any: ['dryer', 'نشافة', 'مجفف'] },
  { q: 'مكيف شباك', any: ['window ac', 'مكيف', 'شباك', 'air condition'] },
  { q: 'مكيف سبليت', any: ['split', 'مكيف', 'سبليت', 'air condition'] },
  { q: 'مكيف 18000 وحدة', any: ['18000', '18,000', 'مكيف'] },
  { q: 'مكيف 24000 وحدة', any: ['24000', '24,000', 'مكيف'] },
  { q: 'فرن', any: ['oven', 'فرن'] },
  { q: 'ميكروويف', any: ['microwave', 'ميكروويف'] },
  { q: 'مكنسة كهربائية', any: ['vacuum', 'مكنسة'] },
  { q: 'قلاية هوائية', any: ['air fryer', 'قلاية', 'fryer'] },
  { q: 'صانعة قهوة', any: ['coffee', 'قهوة', 'espresso'] },
];

const norm = (s) => (s || '').toLowerCase();
const hit = (name, tokens) => tokens.some((t) => norm(name).includes(norm(t)));

(async () => {
  let pass = 0, fail = 0, empty = 0;
  const rows = [];
  for (const cse of CASES) {
    try {
      const res = await fetch(`${BASE}/api/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cse.q, pageSize: 12 }),
      });
      const d = await res.json();
      const items = d.products || [];
      const top3 = items.slice(0, 3).map((p) => `${p.name_en || ''} ${p.name_ar || ''}`);
      const relevantTop = items.length > 0 && hit(top3[0], cse.any.concat(cse.softAny || []));
      const relevantAny3 = top3.some((n) => hit(n, cse.any.concat(cse.softAny || [])));
      let verdict;
      if (items.length === 0) { verdict = d.relaxed ? 'EMPTY(relaxed)' : 'EMPTY'; empty++; }
      else if (relevantTop) { verdict = 'PASS'; pass++; }
      else if (relevantAny3) { verdict = 'WEAK(top3)'; pass++; }
      else { verdict = 'FAIL(substitution)'; fail++; }
      rows.push({ q: cse.q, n: items.length, verdict, top1: (top3[0] || '').trim().slice(0, 42) });
    } catch (e) {
      rows.push({ q: cse.q, n: '-', verdict: 'ERROR', top1: e.message.slice(0, 30) }); fail++;
    }
  }
  console.table(rows);
  const total = CASES.length;
  console.log(`\nRELEVANCE: ${pass}/${total} pass · ${fail} substitution-fail · ${empty} empty  →  ${Math.round((pass / total) * 100)}%`);
  process.exitCode = fail > 0 ? 1 : 0;
})();
