import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, fetchAllPaginated } from '@/lib/database';
import { getProvider } from '@/lib/providers/registry';
import { isDisplayableRetailer, resolveApprovedSlug, retailerDisplayName } from '@/lib/retailers/approved-retailers';
import { buildGoUrl } from '@/lib/analytics/build-go-url';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';
import { parseProductLink, sameProductLink, isKnownShortLink, resolveShortLink } from './product-link';
import { summarizeOffers, assessCheckHistory, classifyCondition, type CheckOffer } from './assessment';

interface CurrentOffer {
  identity_key: string; store_id: number; status: string; price: number;
  url: string; name: string; observed_at: string | null; raw_obs_id: number;
}
interface Observation {
  id: string; canonical_product_id: string | null; raw_name: string;
  normalized_payload: { _url?: string; _raw_id?: number };
}
export interface CheckResult {
  state: 'matched' | 'unknown' | 'unsupported' | 'ambiguous' | 'short_link_unresolved';
  canonicalId?: string; title?: string; offers?: CheckOffer[]; cheaperCount?: number;
  conditionDifference?: boolean; history?: ReturnType<typeof assessCheckHistory>;
  alertProductId?: string | null;
}

export async function checkProduct(input: string, locale: 'ar' | 'en'): Promise<CheckResult> {
  let link = parseProductLink(input);
  if (!link && isKnownShortLink(input)) {
    // Redirect-only resolution (ADR-367 addendum): follow a KNOWN short-link host to its
    // destination, then hand that destination to the exact same parser and matching path
    // below — the short link never bypasses identity resolution or tps_current_offers.
    const destination = await resolveShortLink(input);
    if (!destination) return { state: 'short_link_unresolved' };
    link = parseProductLink(destination);
  }
  if (!link) return { state: 'unsupported' };
  const db = createServerClient() as unknown as SupabaseClient;
  const storeId = getProvider(link.store)?.storeId;
  if (!storeId) return { state: 'unsupported' };
  const signal = AbortSignal.timeout(15000);
  // HOT current-state table, bounded candidates. A complete count prevents silent
  // truncation from turning an ambiguous link into a confident identity.
  const candidates = await db.from('tps_current_offers')
    .select('identity_key,store_id,status,price,url,name,observed_at,raw_obs_id', { count: 'exact' })
    .eq('store_id', storeId).ilike('url', `%${link.productCode}%`).limit(21).abortSignal(signal);
  if (candidates.error) throw new Error('check unavailable');
  if ((candidates.count ?? 22) > 20) return { state: 'ambiguous' };
  const exact = (candidates.data as CurrentOffer[]).filter(o => sameProductLink(o.url, link));
  const keys = new Set(exact.map(o => o.identity_key));
  if (!exact.length) return { state: 'unknown' };
  if (keys.size !== 1 || exact.length !== 1) return { state: 'ambiguous' };
  const source = exact[0];
  if (source.status !== 'valid' || !Number.isFinite(Number(source.price)) || Number(source.price) <= 0) return { state: 'unknown' };
  const cp = await db.from('canonical_products').select('id,name_ar,name_en').eq('tps_identity_key', source.identity_key).eq('is_active', true).abortSignal(signal).maybeSingle();
  if (cp.error) throw new Error('check unavailable');
  if (!cp.data) return { state: 'unknown' };
  const canonicalId = cp.data.id as string;
  const current = await fetchAllPaginated<CurrentOffer>((from, to) => db.from('tps_current_offers')
    .select('identity_key,store_id,status,price,url,name,observed_at,raw_obs_id', { count: 'exact' })
    .eq('identity_key', source.identity_key).order('store_id').order('category').range(from, to).abortSignal(signal), { maxRows: 100 });
  const eligible = current.filter(o => o.status === 'valid' && Number.isFinite(Number(o.price)) && Number(o.price) > 0 && isDisplayableRetailer(resolveApprovedSlug(o.store_id) ?? ''));
  const urls = [...new Set(eligible.map(o => o.url))];
  if (!urls.length) return { state: 'unknown' };
  const observations = await fetchAllPaginated<Observation>((from, to) => db.from('normalized_product_observations')
    .select('id,canonical_product_id,raw_name,normalized_payload', { count: 'exact' })
    .eq('canonical_product_id', canonicalId).in('normalized_payload->>_url', urls).order('id').range(from, to).abortSignal(signal), { maxRows: 2000 });
  const rawIds = eligible.map(o => o.raw_obs_id);
  const raws = await db.from('raw_observations').select('id,scraped_at,payload').in('id', rawIds).abortSignal(signal);
  if (raws.error) throw new Error('check unavailable');
  const offers: CheckOffer[] = eligible.map(o => {
    const slug = resolveApprovedSlug(o.store_id)!;
    const raw = raws.data?.find(r => Number(r.id) === Number(o.raw_obs_id));
    const obs = observations.find(n => n.normalized_payload?._url === o.url && Number(n.normalized_payload?._raw_id) === Number(o.raw_obs_id));
    // All fields come from the SAME current offer. Never borrow a different colour's
    // title or exit merely because that merchant sells the same canonical model.
    const payload = raw?.payload as Record<string, unknown> | undefined;
    return {
      store: slug, storeName: retailerDisplayName(slug, locale) ?? slug, title: o.name,
      price: Number(o.price), observedAt: raw?.scraped_at ?? null,
      condition: classifyCondition(o.name), source: o.url === source.url && o.store_id === source.store_id,
      stale: !isFreshObservation(raw?.scraped_at) || Date.parse(raw?.scraped_at ?? '') > Date.now(),
      availability: typeof payload?.availability === 'string' ? payload.availability : null,
      href: obs ? buildGoUrl(obs.id) : null,
    };
  });
  // Price history is restricted to this exact source URL AND observed description.
  // It cannot mix the renewed offer's low with a new device's history.
  const sourceIds = observations.filter(n => n.normalized_payload?._url === source.url && n.raw_name?.trim() === source.name.trim()).map(n => n.id);
  const historyRows = sourceIds.length ? await fetchAllPaginated<{ price: number; observed_at: string }>((from, to) => db.from('price_history')
    .select('price,observed_at,id', { count: 'exact' }).eq('canonical_product_id', canonicalId)
    .in('tps_observation_id', sourceIds).order('id').range(from, to).abortSignal(signal), { maxRows: 2000 }) : [];
  const sourceOffer = offers.find(o => o.source);
  if (!sourceOffer) return { state: 'unknown' };
  // Alerts use storefront IDs, not canonical IDs. Resolve the source URL first;
  // never silently attach monitoring to another colour/storefront product.
  const ps = await db.from('product_stores').select('product_id').eq('product_url', source.url).limit(2).abortSignal(signal);
  let alertProductId: string | null = null;
  if (!ps.error && ps.data?.length === 1) {
    const product = await db.from('products').select('id,name_en,name_ar').eq('id', ps.data[0].product_id).eq('canonical_product_id', canonicalId).abortSignal(signal).maybeSingle();
    const sameTitle = (name: string | null) => name?.trim().replace(/\s+/g, ' ').toLowerCase() === source.name.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!product.error && (sameTitle(product.data?.name_en) || sameTitle(product.data?.name_ar))) alertProductId = product.data?.id ?? null;
  }
  return { state: 'matched', canonicalId, title: (locale === 'ar' ? cp.data.name_ar : cp.data.name_en) || source.name,
    ...summarizeOffers(offers), alertProductId,
    history: assessCheckHistory(historyRows.map(p => ({ price: Number(p.price), at: p.observed_at })), sourceOffer.price, sourceOffer.observedAt) };
}
