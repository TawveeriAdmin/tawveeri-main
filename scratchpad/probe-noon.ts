import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
(async () => {
  const { ScrapingOrchestrator } = await import('../src/lib/scraping/services/scraping-orchestrator');
  const s = new ScrapingOrchestrator().getScraperForStore('noon');
  const urls = [
    'https://www.noon.com/saudi-en/galaxy-a17-dual-sim-4g-light-blue-4gb-ram-128gb-middle-east-version/N70214272V/p/',
    'https://www.noon.com/saudi-en/6-liter-digital-electric-multi-pressure-cooker-aluminum-cooking-pot-with-nonstick-coating-keep-warm-function-6-l-1000-w-nep682dx-silver/N70012924V/p/',
    'https://www.noon.com/saudi-en/m4-smart-watch-bracelet-waterproof-bluetooth-wristband-and-heart-rate-monitor-fitness-tracker-black/Z50D2FD9D5BEC3416FD27Z/p/',
    'https://www.noon.com/saudi-en/flexy-5l-digital-air-fryer-1500w-7-in-1-360-heating-oil-free-cooking-touch-panel-presets-viewing-window-energy-efficient-2-year-warranty/ZDDE3579DDE4B621BEEC4Z/p/',
  ];
  let ok = 0;
  for (const u of urls) {
    try {
      const r = await s!.updateProductPrice(u);
      if (r) { ok++; console.log(`RESULT OK price=${r.current_price} avail=${r.availability} sku=${r.sku} url=${(r.product_url||'').slice(0,60)}`); }
      else console.log(`RESULT NULL ${u.slice(40, 80)}`);
    } catch (e) { console.log(`RESULT THREW ${e instanceof Error ? e.message.slice(0,140) : e}`); }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`RESULT SUMMARY ${ok}/${urls.length} succeeded`);
  process.exit(0);
})();
