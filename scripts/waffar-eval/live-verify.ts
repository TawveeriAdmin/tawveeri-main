// scripts/waffar-eval/live-verify.ts
// FINAL SEMANTIC INTELLIGENCE MISSION — Section 28/29 required production journeys, run
// directly against the LIVE deployed https://tawveeri.com/api/v1/agent/decide endpoint (the
// same code path a real search triggers server-side). Read-only POSTs, no state mutation.
const BASE = 'https://tawveeri.com';

const JOURNEYS: { id: string; text: string }[] = [
  { id: '1. NEED DISCOVERY', text: 'وش أفضل لابتوب لاحتياجي وميزانيتي' },
  { id: '2. VAGUE NATURAL NEED', text: 'أبي لابتوب يناسبني' },
  { id: '3. RICH SAUDI LANGUAGE', text: 'أبي جوال أصور فيه العيال بالليل وبطاريته تعيش معي وما تهمني الألعاب' },
  { id: '4. NON-TECHNICAL LAPTOP NEED', text: 'ما أفهم بالمواصفات أبي لابتوب للجامعة يكون خفيف وما يعلق' },
  { id: '5. AC HUMAN NEED', text: 'أبي مكيف لغرفة النوم ونومي خفيف' },
  { id: '6. APPLIANCE NEED', text: 'أبي غسالة لعائلة كبيرة وتتحمل الاستخدام الكثير' },
  { id: '7. CHEAPEST', text: 'أرخص لابتوب' },
  { id: '8. EXPLICIT', text: 'أبي لابتوب ألعاب قوي تحت 5000' },
  { id: '9. ENGLISH', text: 'I need something light for university, I code sometimes, budget around SAR 3,500.' },
  { id: '10. CODE SWITCHING', text: 'أبي laptop خفيف للجامعة battery حقته قوية' },
  { id: '11. NEGATIVE PREFERENCE', text: 'الألعاب ما تهمني' },
  { id: '12. HARD EXCLUSION', text: 'ما أبي 5G' },
  { id: '14. NEW UNSEEN SAUDI EXPRESSION', text: 'أبي شي يقعد ثابت على الطاولة وما يهتز وأنا أشتغل عليه' },
  { id: '15. AMBIGUOUS (should clarify)', text: 'أبي لابتوب' },
  { id: '16. SAFE AMBIGUITY (should NOT over-question)', text: 'أبي لابتوب ألعاب تحت 6000 رام 16' },
];

const PARITY_JOURNEYS: { id: string; ar: string; en: string }[] = [
  { id: 'AR/EN gaming laptop', ar: 'أبي لابتوب ألعاب تحت 5000', en: 'I need a gaming laptop under SAR 5,000.' },
  { id: 'AR/EN camera+battery phone', ar: 'أبي جوال تصويره ممتاز وبطاريته قوية وميزانيتي 3000', en: 'I need a phone with strong camera and battery under SAR 3,000.' },
  { id: 'AR/EN cheapest laptop', ar: 'أرخص لابتوب', en: 'Cheapest laptop.' },
  { id: 'AR/EN gaming not important', ar: 'ما يهمني الألعاب', en: "Gaming doesn't matter to me." },
];

async function decide(text: string) {
  const res = await fetch(`${BASE}/api/v1/agent/decide?limit=3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const status = res.status;
  const json = await res.json().catch(() => ({}));
  return { status, json };
}

(async () => {
  console.log(`=== LIVE PRODUCTION VERIFICATION (${BASE}) — deployment as of run time ===\n`);
  for (const j of JOURNEYS) {
    const { status, json } = await decide(j.text);
    const summary = {
      status,
      category: json.task?.category ?? json.parsed?.category ?? null,
      supported: json.supported,
      count: json.count,
      has_smart_pick: !!json.smart_pick,
      clarify: json.clarify ? json.clarify.question?.field : null,
      clarify_skipped_reason: json.clarify_skipped_reason ?? null,
      semantic_used: json.semantic_used ?? undefined,
      error: json.error,
    };
    console.log(`${j.id}: "${j.text}"`);
    console.log(`  -> ${JSON.stringify(summary)}\n`);
  }

  console.log('\n=== BILINGUAL PARITY (live production) ===\n');
  for (const p of PARITY_JOURNEYS) {
    const [ar, en] = await Promise.all([decide(p.ar), decide(p.en)]);
    const s = (r: typeof ar) => ({ category: r.json.task?.category ?? null, count: r.json.count, has_smart_pick: !!r.json.smart_pick, supported: r.json.supported });
    console.log(`${p.id}:`);
    console.log(`  AR "${p.ar}" -> ${JSON.stringify(s(ar))}`);
    console.log(`  EN "${p.en}" -> ${JSON.stringify(s(en))}\n`);
  }
})();
