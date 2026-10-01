/**
 * Amazon Creators API — official price source for amazon.sa (ADR-398, point د).
 *
 * The Product Advertising API v5 was retired on 2026-05-15; its successor is the Creators API:
 * OAuth2 client-credentials (Credential ID + Secret, scope `creatorsapi::default`, Bearer token
 * valid 1 h), one host for every marketplace (`https://creatorsapi.amazon`), the marketplace
 * carried in the `x-marketplace` header, lowerCamelCase bodies (`itemIds`, `partnerTag`).
 * Access requires >= 10 qualifying (shipped, non-returned) sales in the trailing 30 days per
 * marketplace, and pauses automatically below that — so this module is CONFIG-ONLY:
 *   AMAZON_CREATORS_CLIENT_ID, AMAZON_CREATORS_CLIENT_SECRET, AMAZON_CREATORS_PARTNER_TAG
 *   (optional) AMAZON_CREATORS_TOKEN_URL — defaults to the NA auth host; the SA credential's
 *   regional host is shown in Associates Central when the credential is created.
 * Nothing here runs until the three variables exist; with them, amazon price_update refreshes
 * ASINs through the API in batches of 10 (the API's per-request ceiling) instead of fetching
 * detail pages — the only path the Associates Operating Agreement names for showing prices.
 *
 * Provider-framework rule (CLAUDE.md): a new feed/API = configuration + an adapter that yields
 * ScrapedProduct[]; TPS, lanes and /go are untouched.
 */
import type { ScrapedProduct } from '@/lib/scraping/base/types';
import { determineCategory } from '@/lib/scraping/utils/category-utils';
import { canonicalAmazonUrl, isAsin } from '@/lib/scraping/utils/amazon-asin';

export const CREATORS_API_HOST = 'https://creatorsapi.amazon';
export const CREATORS_API_MARKETPLACE_SA = 'www.amazon.sa';
export const CREATORS_API_MAX_ITEMS_PER_REQUEST = 10;
const DEFAULT_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

export interface CreatorsApiConfig { clientId: string; clientSecret: string; partnerTag: string; tokenUrl: string; marketplace: string }

export function creatorsApiConfig(env: NodeJS.ProcessEnv = process.env): CreatorsApiConfig | null {
  const clientId = env.AMAZON_CREATORS_CLIENT_ID?.trim();
  const clientSecret = env.AMAZON_CREATORS_CLIENT_SECRET?.trim();
  const partnerTag = env.AMAZON_CREATORS_PARTNER_TAG?.trim();
  if (!clientId || !clientSecret || !partnerTag) return null;
  return { clientId, clientSecret, partnerTag, tokenUrl: env.AMAZON_CREATORS_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL, marketplace: env.AMAZON_CREATORS_MARKETPLACE?.trim() || CREATORS_API_MARKETPLACE_SA };
}

export const isCreatorsApiConfigured = (env: NodeJS.ProcessEnv = process.env): boolean => creatorsApiConfig(env) !== null;

type Fetch = typeof fetch;

/** Bearer token, cached until 60 s before expiry. */
export class CreatorsApiAuth {
  private token: { value: string; expiresAt: number } | null = null;
  constructor(private readonly cfg: CreatorsApiConfig, private readonly fetchImpl: Fetch = fetch) {}

  async accessToken(now = Date.now()): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > now) return this.token.value;
    const res = await this.fetchImpl(this.cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, scope: 'creatorsapi::default' }),
    });
    if (!res.ok) throw new Error(`creators-api token HTTP ${res.status}`);
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error('creators-api token response had no access_token');
    this.token = { value: json.access_token, expiresAt: now + (json.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }
}

/** Defensive read of the price/availability out of a getItems item — the response schema is
 *  versioned (`offersV2`); every path is tried, nothing is guessed when none matches. */
export function extractItemOffer(item: Record<string, unknown>): { price: number | null; originalPrice: number | null; availability: ScrapedProduct['availability']; title: string | null; url: string | null } {
  const g = (o: unknown, path: string[]): unknown => path.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), o);
  const listings = (g(item, ['offersV2', 'listings']) ?? g(item, ['offers', 'listings'])) as unknown;
  const first = Array.isArray(listings) ? (listings[0] as Record<string, unknown> | undefined) : undefined;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : typeof v === 'string' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const price = num(g(first, ['price', 'money', 'amount'])) ?? num(g(first, ['price', 'amount']));
  const originalPrice = num(g(first, ['price', 'savingBasis', 'money', 'amount'])) ?? num(g(first, ['savingBasis', 'money', 'amount'])) ?? num(g(first, ['price', 'savings', 'basis', 'amount']));
  const availText = String(g(first, ['availability', 'type']) ?? g(first, ['availability', 'message']) ?? '').toLowerCase();
  const availability: ScrapedProduct['availability'] = !first ? 'out_of_stock' : /out|unavailable/.test(availText) ? 'out_of_stock' : /limited|few|only/.test(availText) ? 'limited_stock' : 'in_stock';
  const title = (g(item, ['itemInfo', 'title', 'displayValue']) as string | undefined) ?? null;
  const url = (g(item, ['detailPageURL']) as string | undefined) ?? null;
  return { price, originalPrice, availability, title, url };
}

/** getItems for up to 10 ASINs; returns a ScrapedProduct per ASIN the API answered. */
export async function getItemsAsProducts(cfg: CreatorsApiConfig, auth: CreatorsApiAuth, asins: string[], fetchImpl: Fetch = fetch): Promise<Map<string, ScrapedProduct | null>> {
  const out = new Map<string, ScrapedProduct | null>();
  const ids = [...new Set(asins.filter(isAsin).map((a) => a.toUpperCase()))].slice(0, CREATORS_API_MAX_ITEMS_PER_REQUEST);
  if (!ids.length) return out;
  const token = await auth.accessToken();
  const res = await fetchImpl(`${CREATORS_API_HOST}/catalog/v1/getItems`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-marketplace': cfg.marketplace },
    body: JSON.stringify({
      itemIds: ids, itemIdType: 'ASIN', marketplace: cfg.marketplace, partnerTag: cfg.partnerTag, partnerType: 'Associates',
      resources: ['itemInfo.title', 'offersV2.listings.price', 'offersV2.listings.availability', 'offersV2.listings.condition'],
    }),
  });
  if (!res.ok) throw new Error(`creators-api getItems HTTP ${res.status}`);
  const json = (await res.json()) as { itemsResult?: { items?: Record<string, unknown>[] }; errors?: unknown[] };
  const items = json.itemsResult?.items ?? [];
  for (const asin of ids) out.set(asin, null);
  for (const item of items) {
    const asin = String((item as { asin?: string }).asin ?? '').toUpperCase();
    if (!isAsin(asin)) continue;
    const o = extractItemOffer(item);
    const title = o.title ?? asin;
    out.set(asin, {
      name_ar: title, name_en: title, brand: '', model: '', sku: asin,
      current_price: o.price, original_price: o.originalPrice, availability: o.availability,
      product_url: canonicalAmazonUrl(asin), image_urls: [], specifications: { _source: 'creators_api' },
      category: determineCategory(title), description_ar: null, description_en: null,
      price_source: 'product_page',
    });
  }
  return out;
}

/**
 * Batch price refresh by ASIN for the orchestrator's `updateProductPricesBatch` contract
 * (urls in, Map<url, ScrapedProduct|null> out). Chunks of 10, sequential, never throws per
 * chunk — a failed chunk yields nulls so the per-URL fallback can take over.
 */
export async function refreshPricesViaCreatorsApi(urls: string[], env: NodeJS.ProcessEnv = process.env, fetchImpl: Fetch = fetch): Promise<Map<string, ScrapedProduct | null> | null> {
  const cfg = creatorsApiConfig(env);
  if (!cfg) return null;
  const auth = new CreatorsApiAuth(cfg, fetchImpl);
  const byAsin = new Map<string, string[]>();
  for (const u of urls) { const a = (u.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1] ?? '').toUpperCase(); if (isAsin(a)) byAsin.set(a, [...(byAsin.get(a) ?? []), u]); }
  const result = new Map<string, ScrapedProduct | null>();
  const asins = [...byAsin.keys()];
  for (let i = 0; i < asins.length; i += CREATORS_API_MAX_ITEMS_PER_REQUEST) {
    const chunk = asins.slice(i, i + CREATORS_API_MAX_ITEMS_PER_REQUEST);
    let got: Map<string, ScrapedProduct | null>;
    try { got = await getItemsAsProducts(cfg, auth, chunk, fetchImpl); }
    catch (err) { console.error('[creators-api] chunk failed:', err instanceof Error ? err.message : err); got = new Map(chunk.map((a) => [a, null])); }
    for (const a of chunk) for (const u of byAsin.get(a) ?? []) result.set(u, got.get(a) ? { ...(got.get(a) as ScrapedProduct), product_url: u } : null);
  }
  for (const u of urls) if (!result.has(u)) result.set(u, null);
  return result;
}
