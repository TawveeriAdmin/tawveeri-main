// READ-ONLY live production search verification for the approved-27 scope.
// Hits https://tawveeri.com/api/search for each mandated query; reports result count,
// top product names (relevance), and the set of store names surfaced (leakage check).
const QUERIES = [
  'iPhone 16', 'iPhone 16 Pro Max', 'جوال ايفون 16', 'جوال سامسونج', 'ثلاجة صغيرة',
  'مكيف شباك', 'مكيف سبليت', 'مكيف 18000 وحدة', 'مكيف 30000 وحدة', 'غسالة ملابس',
  'غسالة صحون', 'تلفزيون', 'لابتوب',
];
const APPROVED = new Set(['amazon','أمازون','أمازون السعودية','noon','نون','jarir','جرير','مكتبة جرير',
  'extra','اكسترا','إكسترا','almanea','المنيع','swsg','الشتاء والصيف']);
const BASE = process.argv[2] || 'https://tawveeri.com';

(async () => {
  let leaks = [];
  for (const q of QUERIES) {
    try {
      const res = await fetch(`${BASE}/api/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, pageSize: 12 }),
      });
      const d = await res.json();
      const items = d.products || d.results || d.items || [];
      const stores = new Set();
      const names = [];
      for (const p of items) {
        (p.stores || []).forEach((s) => stores.add(s.store_name || s.store || ''));
        if (names.length < 2) names.push((p.name_ar || p.name_en || '').slice(0, 32));
      }
      const nonApproved = [...stores].filter((s) => s && !APPROVED.has(s.trim()));
      if (nonApproved.length) leaks.push({ q, nonApproved });
      console.log(`q="${q}"  n=${items.length}  relaxed=${d.relaxed || false}`);
      console.log(`   stores=[${[...stores].join(', ')}]${nonApproved.length ? '  ⚠️ NON-APPROVED: ' + nonApproved.join(',') : ''}`);
      console.log(`   top: ${names.join('  ||  ')}`);
    } catch (e) {
      console.log(`q="${q}"  ERROR ${e.message}`);
    }
  }
  console.log('\n=== LEAKAGE SUMMARY ===');
  console.log(leaks.length ? JSON.stringify(leaks, null, 2) : 'CLEAN — no non-approved store surfaced in any query.');
})();
