import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
const Q = {
  AR: ['مكيف سبليت','غسالة سامسونج','ايفون','لابتوب','تلفزيون 65 بوصة','ثلاجة','شاشة','سماعات','ايباد','مكنسة'],
  EN: ['air conditioner','washing machine','iphone 15','laptop','lg tv','refrigerator','monitor','headphones','ipad','vacuum'],
};
(async () => {
  for (const [loc, qs] of Object.entries(Q)) {
    let cards = 0, viaCompare = 0, viaExit = 0, fell = 0;
    const byQ: Record<string, string> = {}; const byStore: Record<string, number> = {};
    for (const q of qs) {
      const body = Buffer.from(JSON.stringify({ query: q }), "utf8");
      const r = await fetch("https://tawveeri.com/api/search", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
      const d: any = await r.json();
      let f = 0; const ps = d.products || [];
      for (const p of ps) {
        cards++;
        const st = p.stores?.length ? p.stores : [p];
        const ext = st.length > 1 ? null : (st[0]?.product_url || null);
        if (p.tps_compare_url) viaCompare++;
        else if (ext) viaExit++;
        else { fell++; f++; byStore[st[0]?.store_name || '?'] = (byStore[st[0]?.store_name || '?'] || 0) + 1; }
      }
      if (f) byQ[q] = `${f}/${ps.length}`;
      await new Promise(x => setTimeout(x, 800));
    }
    const ok = viaCompare + viaExit;
    console.log(`${loc}  cards=${cards}  reachable=${ok} (${(100*ok/cards).toFixed(1)}%)  FELL=${fell} (${(100*fell/cards).toFixed(1)}%)`);
    console.log(`   by query: ${JSON.stringify(byQ)}`);
    console.log(`   by store: ${JSON.stringify(byStore)}`);
  }
})();
