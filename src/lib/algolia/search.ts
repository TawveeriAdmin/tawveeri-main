import { algoliasearch } from "algoliasearch";

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY || "";
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "products";

export interface AlgoliaHit {
  objectID: string;
  name_ar: string;
  name_en: string;
  brand: string;
  image_url: string | null;
  best_price: number | null;
  stores: {
    store_name: string;
    current_price: number | null;
    original_price: number | null;
    product_url: string | null;
    availability: string | null;
    coupon_code: string | null;
  }[];
  store_names: string[];
  store_count: number;
  in_stock: boolean;
  has_deal: boolean;
  max_discount_pct: number;
}

export interface AlgoliaSearchParams {
  query: string;
  brands?: string[];
  stores?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  dealsOnly?: boolean;
  hitsPerPage?: number;
  page?: number;
}

export interface AlgoliaSearchResult {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
}

let cachedClient: ReturnType<typeof algoliasearch> | null = null;
function getClient() {
  if (!APP_ID || !SEARCH_KEY) return null;
  if (!cachedClient) cachedClient = algoliasearch(APP_ID, SEARCH_KEY);
  return cachedClient;
}

export function isAlgoliaConfigured(): boolean {
  return Boolean(APP_ID && SEARCH_KEY);
}

function buildFilters(p: AlgoliaSearchParams): string {
  const clauses: string[] = [];
  if (p.brands && p.brands.length > 0) {
    const ors = p.brands.map((b) => `brand:"${b.replace(/"/g, "")}"`).join(" OR ");
    clauses.push(`(${ors})`);
  }
  if (p.stores && p.stores.length > 0) {
    const ors = p.stores.map((s) => `store_names:"${s.replace(/"/g, "")}"`).join(" OR ");
    clauses.push(`(${ors})`);
  }
  if (p.inStockOnly) clauses.push(`in_stock:true`);
  if (p.dealsOnly) clauses.push(`has_deal:true`);
  if (typeof p.minPrice === "number") clauses.push(`best_price >= ${p.minPrice}`);
  if (typeof p.maxPrice === "number") clauses.push(`best_price <= ${p.maxPrice}`);
  return clauses.join(" AND ");
}

export async function searchAlgolia(p: AlgoliaSearchParams): Promise<AlgoliaSearchResult | null> {
  const client = getClient();
  if (!client) return null;
  const filters = buildFilters(p);
  try {
    const res = await client.searchSingleIndex({
      indexName: INDEX_NAME,
      searchParams: {
        query: p.query,
        hitsPerPage: p.hitsPerPage ?? 48,
        page: p.page ?? 0,
        ...(filters ? { filters } : {}),
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = res as any;
    return {
      hits: (r.hits ?? []) as AlgoliaHit[],
      nbHits: r.nbHits ?? 0,
      page: r.page ?? 0,
      nbPages: r.nbPages ?? 0,
    };
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error("[algolia:search]", (e as any)?.message || e);
    return null;
  }
}
