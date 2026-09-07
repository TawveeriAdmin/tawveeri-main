// scripts/sync-products-synonyms.ts
// SYNONYM SYSTEM CLOSURE (2026-09-07) — the Honor investigation exposed a systemic
// wiring gap, not a Honor-only defect: SAUDI_SEARCH_SYNONYMS (src/lib/search/
// query-normalize.ts) has only ever been published to "tawveeri_tps_products" by
// configure-tps-algolia-index.ts — a not-yet-cutover index with, by its own sync
// route's doc comment, "zero live-search impact". The index real customer search
// actually queries (ALGOLIA_INDEX_NAME / "products", built by
// scripts/tps-analysis/rebuild-products-index.ts) had ZERO synonym groups
// configured — confirmed by a direct read (searchSynonyms), not inferred. Every
// misspelling/colloquial-form fold in the approved vocabulary — not just Honor —
// was silently inert on live search.
//
// PROVEN LIVE, not just Honor: "تلفون" (colloquial "phone") returned two AUX
// cables and zero phones; "قلاكسي" (colloquial Galaxy spelling) and "تكييف"
// (colloquial AC spelling) both returned zero results, identical to Honor's
// failure pattern — before this fix.
//
// SYNONYM-ONLY. Deliberately does NOT call replaceAllObjects or setSettings —
// existing objects on "products" already contain correct product data (proven:
// "تابلت هونر" and "honor tablet" already return correct Honor tablets). Only the
// synonyms resource was ever missing. saveSynonyms is independent of object data,
// ranking, and facets.
//
// TWO GROUPS CORRECTED before publishing, each on LIVE evidence of an existing,
// currently-reproducible cross-category leak — never on assumption:
//   - TV group: bare "screen" dropped. Live: querying "screen" today returns a
//     smartwatch ("Color Screen Message Reminder"), two children's tablets, and
//     an air fryer with a touch-screen display — zero real TVs. Publishing
//     "screen" as a literal Algolia synonym for "شاشة"/"tv" would drag this exact
//     contamination into every Saudi "شاشة" (TV) search — one of the most common
//     category queries. The rest of the group (شاشة/شاشات/تلفزيون/تلفاز/تي في/
//     television/tv) is TV-specific and shows no such leak; kept as-is.
//   - Deal/cheap group: singular "عرض" dropped. Live: querying "عرض" today
//     returns an electric kettle, a mini projector, a deep fryer, and a monitor —
//     none are actual deals; "عرض" is also the ordinary Arabic word for a
//     product's WIDTH, which appears in nearly every product's dimension spec
//     text. Publishing it as a synonym for "خصم"/"discount" would drag that same
//     width-spec noise into every discount search across the entire catalogue.
//     Plural "عروض" carries no such ambiguity in retail Arabic (specs use the
//     singular per dimension) and is kept, along with رخيص/ارخص/خصم/تخفيض/cheap/
//     offer/deal/discount.
// All other 14 groups were live-tested (bare/typo/hamza/transliteration variants
// per group) and found either already-safe or already-necessary with no observed
// leak — published unchanged, same content as SAUDI_SEARCH_SYNONYMS.
//
// Durable by construction: this is the single, idempotent publish path for the
// "products" index's synonyms — re-run any time SAUDI_SEARCH_SYNONYMS changes,
// and the index's synonym state is deterministically brought back in sync (same
// replaceExistingSynonyms:true pattern configure-tps-algolia-index.ts already
// uses for its own index). rebuild-products-index.ts calls the same exported
// function after every object rebuild so the two paths can never drift apart
// again.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { algoliasearch } from 'algoliasearch';
import { SAFE_PRODUCT_SYNONYM_GROUPS } from '../src/lib/search/query-normalize';

const APP_ID = process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || '';
export const INDEX = process.env.ALGOLIA_INDEX_NAME || 'products';

/**
 * The approved vocabulary, minus the two live-proven-unsafe bare words. Sourced from
 * query-normalize.ts's SAFE_PRODUCT_SYNONYM_GROUPS — the SAME corrected list the
 * search route's relevance gate now consumes (search-relevance-gate closure,
 * 2026-09-07), so Algolia's retrieval and the route's post-retrieval verification can
 * never drift onto two different ideas of "safe". Kept as a named export here (rather
 * than importing SAFE_PRODUCT_SYNONYM_GROUPS directly at each call site) only for
 * backward compatibility with this script's existing test/CLI usage.
 */
export function getSafeProductsSynonymGroups(): string[][] {
  return SAFE_PRODUCT_SYNONYM_GROUPS;
}

export async function syncProductsSynonyms(): Promise<{ index: string; synonymGroups: number }> {
  if (!APP_ID || !ADMIN_KEY) throw new Error('missing ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY');
  const client = algoliasearch(APP_ID, ADMIN_KEY);

  const groups = getSafeProductsSynonymGroups();
  const synonymHit = groups.map((group, i) => ({
    objectID: `saudi-vocab-${i}`,
    type: 'synonym' as const,
    synonyms: group,
  }));
  const res = await client.saveSynonyms({ indexName: INDEX, synonymHit, replaceExistingSynonyms: true });
  if ('taskID' in res) await client.waitForTask({ indexName: INDEX, taskID: res.taskID });

  return { index: INDEX, synonymGroups: synonymHit.length };
}

if (require.main === module) {
  syncProductsSynonyms()
    .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
