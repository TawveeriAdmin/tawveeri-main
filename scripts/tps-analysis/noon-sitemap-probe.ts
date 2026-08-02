// scripts/tps-analysis/noon-sitemap-probe.ts
// READ-ONLY. Is noon's PUBLISHED Saudi sitemap servable yet?
//
// WHY THIS EXISTS. noon.com/robots.txt publishes `Sitemap: /sitemap-index.xml`, which is the
// route their own file points crawlers to and the GENTLER way to enumerate products — one
// request yields thousands of URLs, versus crawling listing pages. It is the route we would
// prefer on principle: a permitted path stays permitted when it is used lightly.
//
// MEASURED 2026-08-02 — it does not work for our market:
//   · /sitemap-index.xml            HTTP 200, 3,128 children (1,938 of them `-sa-`)
//   · /sitemap/sitemap-ae-pdp-0.xml HTTP 200, 30.6 MB of UAE product URLs
//   · /sitemap/sitemap-sa-pdp-{0,1,5,100,200}.xml  HTTP 503, every one
// UAE serves and Saudi does not, so this is neither us being blocked nor a broken sitemap in
// general — noon's SAUDI PDP sitemaps are returning 503. Saudi is the only market we ingest,
// so the route is unusable today and discovery stays on the (permitted, working) listing
// pages.
//
// Re-run this to find out when that changes. If it reports SERVABLE, switch noon discovery to
// the sitemap and lower the listing crawl — fewer requests per product discovered, which is
// the whole point.
//
// Usage: npm run tps:noon-sitemap
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SAMPLE = 5;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, timeoutMs = 45000): Promise<{ status: number | string; body: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/xml,*/*" }, signal: ctrl.signal });
    clearTimeout(t);
    return { status: res.status, body: await res.text() };
  } catch (e) {
    clearTimeout(t);
    return { status: (e as { cause?: { code?: string } })?.cause?.code ?? "ERR", body: "" };
  }
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

(async () => {
  const idx = await get("https://www.noon.com/sitemap-index.xml");
  const children = locs(idx.body);
  const sa = children.filter((c) => /-sa-/.test(c));
  console.log(`sitemap-index          HTTP ${idx.status}  children=${children.length}  saudi=${sa.length}`);
  if (!sa.length) { console.log("VERDICT: no Saudi children listed — sitemap route unavailable."); process.exit(0); }

  let servable = 0;
  let products = 0;
  const picks = [0, 1, 5, Math.floor(sa.length / 2), sa.length - 1].slice(0, SAMPLE);
  for (const i of picks) {
    const url = sa[i];
    if (!url) continue;
    const r = await get(url);
    const urls = locs(r.body).filter((u) => /\/p\//.test(u));
    console.log(`  ${url.split("/").pop()!.padEnd(26)} HTTP ${String(r.status).padEnd(5)} products=${urls.length}`);
    if (urls.length) { servable++; products += urls.length; }
    await wait(3000);
  }

  // Control: if UAE serves while Saudi does not, the fault is market-specific on their side,
  // not our access. Stating which it is prevents a wrong diagnosis next time.
  const ae = await get("https://www.noon.com/sitemap/sitemap-ae-pdp-0.xml", 60000);
  const aeOk = locs(ae.body).length > 0;
  console.log(`  control ae-pdp-0           HTTP ${ae.status}  servable=${aeOk}`);

  console.log("");
  if (servable > 0) {
    console.log(`VERDICT: SERVABLE — ${servable}/${picks.length} Saudi children returned products (${products} sampled).`);
    console.log("ACTION: switch noon discovery to the sitemap and lower NOON_MAX_PRODUCTS_PER_PAGE.");
  } else if (aeOk) {
    console.log("VERDICT: STILL 503 for Saudi while UAE serves — the fault is on noon's side and market-specific,");
    console.log("         not our access. Keep discovery on the permitted listing pages.");
  } else {
    console.log("VERDICT: nothing servable, including the UAE control — treat as transient and re-run.");
  }
})();
