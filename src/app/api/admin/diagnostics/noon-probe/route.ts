import { NextRequest, NextResponse } from 'next/server';
import { requireRequestAdmin } from '@/lib/auth/api-auth';

// Accepts EITHER an admin session OR the same CRON_SECRET bearer token every /api/cron/*
// route already accepts (production has no browser session to attach) -- the same
// established machine-to-machine auth this codebase already uses, not a new mechanism.
async function requireAdminOrCronSecret(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return;
  await requireRequestAdmin(request);
}

/**
 * GET /api/admin/diagnostics/noon-probe?q=<query> — TEMPORARY, single-purpose diagnostic.
 *
 * Noon commerce data truth mission (2026-09-10): a sandbox test proved Noon's HTML pages
 * (product-detail, search-listing) return a fast, deliberate 403, while the separate JSON
 * search-API endpoint returned 200 with real data from a FRESH IP with no scraping history.
 * That does not prove anything about Tawveeri's actual production egress IP, which has
 * ~25 days of Noon HTML-page 403s already on its reputation — the anti-bot block may be
 * IP-reputation-scored across paths, not purely URL-pattern-scored.
 *
 * `q` defaults to a category keyword (discovery-shaped query). Passing a KNOWN Noon SKU as
 * `q` tests a second, separate question: whether the same search endpoint can also serve
 * accurate PRICE-REFRESH of an already-known catalog item (matching that exact SKU back in
 * the results), not just category discovery — required for §5/§10 of the mission before
 * this endpoint could replace scrapeProductPageHtml() for existing products.
 *
 * One request per call, no retry, no loop — exactly the kind of single well-behaved probe
 * the founder's "no continuous evasion" red line permits. Delete this route once the
 * sourcing decision is made; it is not meant to be permanent.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminOrCronSecret(request);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get('q') || 'tv';
  const url = `https://www.noon.com/_svc/catalog/api/v3/u/en-sa/search?q=${encodeURIComponent(q)}&page=1&limit=5&sort%5Bby%5D=relevance&sort%5Bdir%5D=desc`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    'Origin': 'https://www.noon.com',
    'Referer': 'https://www.noon.com/saudi-en/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'x-locale': 'en-sa',
    'x-platform': 'web',
    'x-content': 'desktop',
  };

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    const elapsedMs = Date.now() - t0;
    const text = await res.text();
    let hits: Record<string, unknown>[] = [];
    try {
      const json = JSON.parse(text);
      const raw = json.hits || json.results || json.products || json.data?.hits || json.data?.products;
      hits = Array.isArray(raw) ? raw : [];
    } catch { /* non-JSON body, leave hits empty */ }

    return NextResponse.json({
      probed_at: new Date().toISOString(),
      query: q,
      status: res.status,
      ok: res.ok,
      elapsed_ms: elapsedMs,
      body_length: text.length,
      hit_count: hits.length,
      // Full first hit + every hit's sku/price/name — enough to judge exact-match capability
      // (does searching a SKU return that same SKU?) without dumping the whole payload.
      hits_summary: hits.slice(0, 5).map((h) => ({
        sku: h.sku ?? h.id ?? h.product_id ?? null,
        name: h.name ?? h.title ?? null,
        price: h.price ?? h.sale_price ?? null,
        in_stock: h.in_stock ?? h.is_available ?? null,
      })),
      first_hit_raw: hits[0] ?? null,
      body_sample: hits.length === 0 ? text.slice(0, 300) : undefined,
    });
  } catch (e) {
    return NextResponse.json({
      probed_at: new Date().toISOString(),
      query: q,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      elapsed_ms: Date.now() - t0,
    });
  }
}
