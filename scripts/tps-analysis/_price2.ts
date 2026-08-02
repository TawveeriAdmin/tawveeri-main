import { config } from "dotenv"; import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
const reasons = new Map<string, number>();
const orig = console.log;
console.log = (...a: any[]) => {
  const s = a.map(String).join(" ");
  if (s.startsWith("[price-attempt]")) {
    try { const j = JSON.parse(s.slice(15)); reasons.set(`${j.result}: ${String(j.reason).slice(0,70)}`, (reasons.get(`${j.result}: ${String(j.reason).slice(0,70)}`) ?? 0) + 1); return; } catch {}
  }
  orig(...a);
};
(async () => {
  const { ScrapingOrchestrator } = await import("../../src/lib/scraping/services/scraping-orchestrator");
  for (const slug of ["amazon", "extra"]) {
    const o: any = new ScrapingOrchestrator();
    const r = await o.runPriceUpdateJob({ store_slug: slug, max_products: 20, older_than_hours: 24 });
    orig(`\n${slug}: ${JSON.stringify(r)}`);
  }
  orig("\nreasons:"); for (const [k, n] of [...reasons].sort((a,b)=>b[1]-a[1])) orig(`   [${n}] ${k}`);
})().catch(e => { console.error("THREW:", e?.message ?? e); });
