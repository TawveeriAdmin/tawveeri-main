// NORTH-STAR: % of realistic Saudi consumer searches SUCCESSFULLY ANSWERED (Founder principle 2026-07-27).
// A search is "answered" when the TOP result is the CORRECT product with a live price + an active store
// link. It is "unified" when that top result has >=2 stores sorted cheapest→highest. Failures are
// root-caused into debt categories. Uses node fetch (proper UTF-8 — never curl for Arabic). READ-ONLY.
const BASE = process.argv[2] || 'https://tawveeri.com';
// Normalize Arabic (ة→ه, ى/ي, أإآ→ا) + lowercase so token matching isn't fooled by spelling variants.
const norm = (s) => (s || '').toLowerCase().replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/[أإآ]/g, 'ا').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const hit = (name, toks) => toks.some((t) => norm(name).includes(norm(t)));

// Realistic popular Saudi consumer searches across the approved categories. `any` = tokens a correct
// top result should contain.
const CASES = [
  // phones
  ['ايفون 16', ['iphone 16', 'ايفون 16']], ['ايفون 16 برو ماكس', ['16 pro max', 'برو ماكس']],
  ['ايفون 15', ['iphone 15', 'ايفون 15']], ['جوال سامسونج', ['samsung', 'سامسونج', 'galaxy']],
  ['سامسونج جالكسي S24', ['s24', 'galaxy s24']], ['شاومي', ['xiaomi', 'شاومي', 'redmi', 'poco']],
  ['هواوي', ['huawei', 'هواوي']], ['جوال ايفون', ['iphone', 'ايفون']],
  // tablets
  ['ايباد', ['ipad', 'ايباد']], ['ايباد برو', ['ipad pro', 'ايباد برو']], ['سامسونج تاب', ['galaxy tab', 'تاب']],
  ['تابلت', ['tablet', 'tab', 'ايباد', 'ipad']],
  // laptops
  ['لابتوب', ['laptop', 'لابتوب', 'notebook', 'macbook']], ['لابتوب لينوفو', ['lenovo', 'لينوفو']],
  ['ماك بوك', ['macbook', 'ماك بوك']], ['لابتوب ديل', ['dell', 'ديل']], ['لابتوب قيمنق', ['gaming', 'قيمنق', 'قيمنج']],
  ['لابتوب اتش بي', ['hp', 'اتش بي']],
  // TVs
  ['تلفزيون', ['tv', 'television', 'تلفزيون', 'شاشة']], ['شاشة سامسونج', ['samsung', 'سامسونج']],
  ['تلفزيون ال جي', ['lg', 'ال جي']], ['شاشة 55 بوصة', ['55']], ['تلفزيون 65', ['65']],
  // audio
  ['سماعات', ['headphone', 'earbud', 'سماعة', 'buds', 'سماعات']], ['ايربودز', ['airpods', 'ايربودز', 'buds']],
  ['سماعة بلوتوث', ['bluetooth', 'بلوتوث', 'سماعة']],
  // AC
  ['مكيف', ['ac', 'مكيف', 'air condition']], ['مكيف سبليت', ['split', 'سبليت', 'مكيف']],
  ['مكيف شباك', ['window', 'شباك', 'مكيف']], ['مكيف 18000', ['18000', '18,000']], ['مكيف 24000', ['24000', '24,000']],
  // fridges / freezers
  ['ثلاجة', ['refrigerator', 'fridge', 'ثلاجة', 'ثلاجه']], ['ثلاجة سامسونج', ['samsung', 'سامسونج']],
  ['فريزر', ['freezer', 'فريزر']], ['ثلاجة صغيرة', ['refrigerator', 'fridge', 'mini', 'ثلاجة']],
  // washers / dryers / dishwashers
  ['غسالة', ['washing', 'washer', 'غسالة', 'غساله']], ['غسالة اتوماتيك', ['washing', 'washer', 'غسالة']],
  ['غسالة صحون', ['dishwasher', 'غسالة صحون', 'صحون']], ['نشافة', ['dryer', 'نشافة', 'مجفف']],
  // kitchen
  ['مايكروويف', ['microwave', 'مايكروويف', 'ميكروويف']], ['فرن', ['oven', 'فرن']],
  ['قلاية هوائية', ['air fryer', 'قلاية', 'fryer']], ['خلاط', ['blender', 'خلاط']],
  ['صانعة قهوة', ['coffee', 'قهوة', 'espresso']],
  // small appliances
  ['مكنسة كهربائية', ['vacuum', 'مكنسة']], ['مكواة', ['iron', 'مكواة', 'steamer']],
  // gaming / electronics / accessories / wearable
  ['بلايستيشن 5', ['playstation', 'ps5', 'بلايستيشن']], ['كاميرا', ['camera', 'كاميرا']],
  ['طابعة', ['printer', 'طابعة']], ['راوتر', ['router', 'راوتر', 'wifi']],
  ['ساعة ذكية', ['smartwatch', 'watch', 'ساعة']], ['ابل واتش', ['apple watch', 'watch', 'ساعة']],
  ['شاحن ايفون', ['charger', 'شاحن']], ['كفر ايفون', ['case', 'cover', 'كفر', 'جراب']],
];

(async () => {
  const debt = {}; const rows = [];
  let answered = 0, unified = 0, sorted = 0;
  for (const [q, any] of CASES) {
    try {
      await new Promise((r) => setTimeout(r, 4500)); // stay under the 15 req/min API rate limit
      let res;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { res = await fetch(`${BASE}/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, pageSize: 6 }) }); break; }
        catch (e) { if (attempt === 1) throw e; await new Promise((r) => setTimeout(r, 5000)); } // one retry on transient network error
      }
      if (res.status === 429) { debt['rate-limited'] = (debt['rate-limited'] || 0) + 1; rows.push({ q, top: '429', stores: 0, ok: '✗ rate-limited(retry)' }); continue; }
      const d = await res.json();
      const items = d.products || [];
      const p = items[0];
      let cause = '';
      if (!p) cause = d.relaxed ? 'coverage(relaxed-empty)' : 'coverage(empty)';
      else {
        const name = `${p.name_en || ''} ${p.name_ar || ''}`;
        const relevant = hit(name, any);
        const price = (p.stores || []).some((s) => Number(s.current_price) > 0) || Number(p.best_price) > 0;
        const link = (p.stores || []).some((s) => s.product_url);
        if (!relevant) cause = 'relevance/matching(wrong-product)';
        else if (!price) cause = 'pricing(no-live-price)';
        else if (!link) cause = 'retailer-integration(no-link)';
        else {
          answered++;
          const stores = (p.stores || []).map((s) => Number(s.current_price));
          if (stores.length >= 2) { unified++; if (JSON.stringify(stores) === JSON.stringify([...stores].sort((a, b) => a - b))) sorted++; }
        }
      }
      if (cause) debt[cause] = (debt[cause] || 0) + 1;
      rows.push({ q, top: p ? `${(p.name_en || p.name_ar || '').slice(0, 30)}` : '(none)', stores: p ? (p.store_count || (p.stores || []).length) : 0, ok: cause ? '✗ ' + cause : '✓' });
    } catch (e) { rows.push({ q, top: 'ERR', stores: 0, ok: e.message.slice(0, 20) }); debt['error'] = (debt['error'] || 0) + 1; }
  }
  console.table(rows);
  console.log('\nFAILURES:'); rows.filter((r) => r.ok.startsWith('✗')).forEach((r) => console.log(`  ${r.q}  →  "${r.top}"  [${r.ok.slice(2)}]`));
  const T = CASES.length;
  console.log(`\nSEARCH SUCCESS RATE: ${answered}/${T} = ${Math.round(100 * answered / T)}%  (answered = correct product + live price + active link)`);
  console.log(`  of answered, multi-store unified: ${unified}/${answered}  |  correctly cheapest-first: ${sorted}/${unified}`);
  console.log('\nDEBT by cause:'); Object.entries(debt).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${n}  ${c}`));
})();
