// src/lib/search/market-variant-companions.ts — LG market-variant listings of the SAME model name, shown beside the card, never merged into it (2026-10-06).
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// CASE (external review): «75QNED93A6A» returned one card «أفضل سعر 4,999 (Amazon/Extra)» and, as a SEPARATE card, Noon at 4,499 under the title
// «…75QNED93A6A-AMAQ». The best-price claim was 500 SAR wrong from the shopper's side of the screen.
//
// EVIDENCE (manufacturer, fetched 2026-10-06): LG Saudi Arabia's own product page https://www.lg.com/sa_en/tv-soundbars/qned/75qned93a6a/ names the
// product «75QNED93A6A» (title, breadcrumb, heading, «Copy model name») and carries the market SKU «75QNED93A6A.AMVQ.EMSJ.SA_EN.C» / support id
// «cs-75QNED93A6A.AMVQ». LG's own structure is therefore <model name>.<AMxx market/tuner variant>; the model name is the part before the dot.
//
// WHY NOT A GENERIC «strip the suffix» RULE: measured on our own catalogue, the same shape means DIFFERENT products elsewhere — Asus FA608PM vs
// FA608PM-RV027W (distinct configurations), Acer NX.DD1EM.002 vs NX.DH8EM.002, Braun MQ10.001PWH vs MQ10.201MWH. Suffix semantics are
// per-manufacturer; 67 TV, 56 vacuum and 39 laptop model groups share a base with a different suffix. Only a manufacturer-documented format may
// be used, so this module knows ONE: LG's «A» + 2–4 letters variant after «.» or «-».
//
// WHAT IT DOES: the companion card's offers are attached to the primary card as `market_variant_companions` (shown as «نفس رقم الموديل بلاحقة سوق
// مختلفة»), the duplicate card disappears from the list, and NOTHING enters the primary card's price, store count, claims or identity. The identity
// layer (compare page, verifier, canary) is untouched, so search and compare cannot disagree about a claim.
import { normalizeArabic } from './arabic-normalize';
import { isFreshObservation } from '@/lib/intelligence/evidence-engine';

export interface MarketVariantCompanion {
  store: string;
  store_name: string;
  price: number;
  product_url: string;
  observed_at: string | null;
  /** The LG variant code on the companion listing (AMAQ…), or '' when the companion carries the bare model name. */
  variant: string;
  /** The model name both listings share (the part before the variant). */
  model: string;
  /** `market_variant`: LG's documented variant suffix. `same_model_number`: an un-linked listing that carries the primary's EXACT manufacturer model number. */
  kind?: 'market_variant' | 'same_model_number';
}

interface CardLike {
  name_ar?: string | null; name_en?: string | null; brand?: string | null; tps_identity_key?: string | null;
  stores: Array<{ store?: string; store_name?: string; current_price: number; product_url: string; observed_at?: string | null; listing_url?: string | null; availability?: string | null }>;
}

const LG_VARIANT = /^A[A-Z]{2,4}$/;
const FAMILY_NOT_A_MODEL = /^(RTX|GTX|IPHONE|IPAD|DDR|USB|HDMI|OLED\d{1,2}$)/;

/** (base model name → variant codes seen) for every LG-shaped token in the texts. */
export function lgModelCodes(texts: Array<string | null | undefined>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const joined = texts.filter(Boolean).join(' ').toUpperCase();
  for (const raw of joined.split(/[\s,()[\]/|:"']+/)) {
    const t = raw.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '');
    if (t.length < 6 || !/^[A-Z0-9.-]+$/.test(t)) continue;
    // <model name> optionally followed by an LG variant («.AMAQ» / «-AMAQ», possibly then LG's longer SKU tail «.EMSJ.SA_EN.C»). Any OTHER
    // suffix («-RV027W») means we do not know what the token is: it is ignored entirely, never read as a bare model name.
    const m = /^([A-Z0-9]{5,})(?:[.-](A[A-Z]{2,4})(?:[.-][A-Z0-9_]+)*)?$/.exec(t);
    if (!m) continue;
    const base = m[1];
    if (!/[A-Z]/.test(base) || (base.match(/\d/g) || []).length < 3 || FAMILY_NOT_A_MODEL.test(base)) continue;
    const variant = m[2] && LG_VARIANT.test(m[2]) ? m[2] : '';
    const set = out.get(base) ?? new Set<string>();
    set.add(variant);
    out.set(base, set);
  }
  return out;
}

function isLg(c: CardLike): boolean {
  if ((c.tps_identity_key || '').toLowerCase().startsWith('lg|')) return true;
  const brand = normalizeArabic(c.brand || '').toLowerCase();
  if (brand === 'lg' || brand === 'ال جي' || brand === 'اي جي') return true;
  const words = new Set(normalizeArabic(`${c.name_en || ''} ${c.name_ar || ''}`).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return words.has('lg') || (words.has('ال') && words.has('جي'));
}

const slugOf = (e: { store?: string; store_name?: string }): string => (e.store || e.store_name || '').trim().toLowerCase();

function cardTexts(c: CardLike): Array<string | null | undefined> {
  // Titles and the identity key only. Listing URLs are NOT read: a merchant's own SKU in the path (Noon's «N70180108V») has the shape of a model code.
  return [c.name_en, c.name_ar, c.tps_identity_key];
}

/**
 * Attach LG market-variant companions to their primary card and drop the duplicate cards. Returns the input untouched when nothing qualifies.
 * Conditions (all must hold): both cards are LG; each names exactly ONE model; the model names (before the variant) are equal; the variant sets
 * differ (equal sets would be an identity split, not a market variant — left to the identity layer); no store of the companion is already on the
 * primary (a store never appears twice).
 */
export function attachMarketVariantCompanions<T extends CardLike>(products: T[]): T[] {
  const info = products.map((p) => {
    if (!isLg(p)) return null;
    const codes = lgModelCodes(cardTexts(p));
    if (codes.size !== 1) return null;
    const [[base, variants]] = [...codes.entries()];
    return { base, variants };
  });
  const byBase = new Map<string, number[]>();
  info.forEach((x, i) => { if (x) byBase.set(x.base, [...(byBase.get(x.base) ?? []), i]); });

  const drop = new Set<number>();
  const attached = new Map<number, MarketVariantCompanion[]>();
  for (const [base, idxs] of byBase) {
    if (idxs.length < 2) continue;
    const score = (i: number) => (products[i].tps_identity_key?.toUpperCase().includes(`|MODEL:${base}`) ? 2 : products[i].tps_identity_key ? 1 : 0);
    const primary = [...idxs].sort((a, b) => score(b) - score(a) || products[b].stores.length - products[a].stores.length)[0];
    const pv = info[primary]!.variants;
    const have = new Set(products[primary].stores.map(slugOf));
    for (const i of idxs) {
      if (i === primary) continue;
      const cv = info[i]!.variants;
      const same = pv.size === cv.size && [...pv].every((v) => cv.has(v));
      if (same) continue;                                             // same model AND same variant → an identity split, not ours to merge
      const entries = products[i].stores
        // Only a CURRENT price is worth showing beside a card: a two-month-old «4,499 at Noon» would be exactly the stale claim this file exists to avoid.
        .filter((s) => s.current_price > 0 && isFreshObservation(s.observed_at) && !have.has(slugOf(s)))
        .map((s): MarketVariantCompanion => ({
          store: s.store || '', store_name: s.store_name || s.store || '', price: s.current_price, product_url: s.product_url,
          observed_at: s.observed_at ?? null, variant: [...cv].find((v) => v) ?? '', model: base, kind: 'market_variant',
        }));
      if (!entries.length) continue;                                  // nothing the primary lacks: leave the card alone
      attached.set(primary, [...(attached.get(primary) ?? []), ...entries]);
      entries.forEach((e) => have.add(slugOf(e)));
      drop.add(i);
    }
  }
  if (!attached.size) return products;
  return products
    .map((p, i) => (attached.has(i) ? ({ ...p, market_variant_companions: attached.get(i), _absorbed_text: `${(p as { _absorbed_text?: string })._absorbed_text || ''} ${[...(byBase.get(info[i]!.base) ?? [])].filter((j) => drop.has(j)).map((j) => `${products[j].name_en || ''} ${products[j].name_ar || ''}`).join(' ')}`.trim() } as T) : p))
    .filter((_, i) => !drop.has(i));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// SAME MANUFACTURER MODEL NUMBER, NOT YET LINKED (external review 2026-10-06, items 1–2).
//
// CASE: «XU2100» printed «🏆 أفضل سعر 1,799» (Almanea, Extra) while an Amazon card for the same Philips model sat in the same list at 869; «XC5041» the same at 749.
// Live check the same day: amazon.sa/dp/B0FFMQDCLK = SAR 869, available; both Amazon titles end with the exact model number the comparable card is keyed on
// («XU2100/15», «XC5041/61»). The Amazon listing lives in the storefront layer (no TPS observation yet), so the two were never one card.
//
// WHAT THIS DOES (read-time, no identity change): a card keyed on «|MODEL:<code>» with >= 2 stores (the model is already corroborated) takes an un-keyed card as a
// companion when that card's own title carries the EXACT code as a whole token, begins with the same brand, is not an accessory/compat/renewed listing, is fresh,
// in stock, and adds a store the primary lacks. The primary's price, store count and identity are untouched; the shopper sees «نفس رقم الموديل عند أمازون: 869» with
// a measured exit, and the card stops claiming «أفضل سعر» while a cheaper same-model listing is on show (the card does that, from the companion list).
// A title that merely CONTAINS a code is not identity (an accessory «for XU2100/15» does too) — hence the brand-first, accessory and renewed guards.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const MODEL_KEY = /\|MODEL:(.+)$/i;
const NOT_A_MAIN_LISTING = /\b(compatible|replacement|spare|refill|fits?|accessor(?:y|ies))\b|(?:bag|bags|filter|filters|cover|case|charger|brush|hose|battery|remote)\s+for\b|للاستخدام مع|متوافق|بديل/i;
const OFF_GRADE = /(?<![\p{L}\p{N}])(?:renewed|refurbished|refurb|used|pre-?owned|open[- ]box|b-?grade|مجدد(?:ة)?|مستعمل(?:ة)?|مستخدم(?:ة)?)(?![\p{L}\p{N}])/iu;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');

function modelKeyOf(c: CardLike): { code: string; brand: string } | null {
  const m = MODEL_KEY.exec(c.tps_identity_key || '');
  if (!m) return null;
  const brand = normalizeArabic(c.brand || (c.tps_identity_key || '').split('|')[0] || '').toLowerCase().trim();
  return { code: m[1].toUpperCase(), brand };
}

function startsWithBrand(c: CardLike, brand: string): boolean {
  if (!brand) return false;
  const words = normalizeArabic(`${c.name_en || ''} ${c.name_ar || ''}`).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const own = normalizeArabic(c.brand || '').toLowerCase().trim();
  return own === brand || words.slice(0, 3).includes(brand);
}

export function attachSameModelNumberCompanions<T extends CardLike>(products: T[]): T[] {
  const drop = new Set<number>();
  const attached = new Map<number, MarketVariantCompanion[]>();
  const absorbed = new Map<number, string[]>();
  products.forEach((primary, pi) => {
    const key = modelKeyOf(primary);
    if (!key || key.code.length < 5) return;
    const have = new Set(primary.stores.filter((s) => s.current_price > 0).map(slugOf));
    if (have.size < 2) return;                                          // the model must already be corroborated by two stores
    const re = new RegExp(`(?<![A-Z0-9])${escapeRe(key.code)}(?![A-Z0-9])`);
    products.forEach((other, oi) => {
      if (oi === pi || drop.has(oi) || other.tps_identity_key) return;
      const title = `${other.name_en || ''} ${other.name_ar || ''}`;
      if (!re.test(title.toUpperCase())) return;
      if (!startsWithBrand(other, key.brand)) return;
      if (NOT_A_MAIN_LISTING.test(title) || OFF_GRADE.test(title)) return;
      const entries = other.stores
        .filter((s) => s.current_price > 0 && isFreshObservation(s.observed_at) && s.availability !== 'out_of_stock' && !have.has(slugOf(s)))
        .map((s): MarketVariantCompanion => ({
          store: s.store || '', store_name: s.store_name || s.store || '', price: s.current_price, product_url: s.product_url,
          observed_at: s.observed_at ?? null, variant: '', model: key.code, kind: 'same_model_number',
        }));
      if (!entries.length || entries.some((e) => !e.product_url)) return;   // never show a price we cannot send the shopper to
      attached.set(pi, [...(attached.get(pi) ?? []), ...entries]);
      absorbed.set(pi, [...(absorbed.get(pi) ?? []), title]);
      entries.forEach((e) => have.add(slugOf(e)));
      drop.add(oi);
    });
  });
  if (!attached.size) return products;
  return products
    .map((p, i) => (attached.has(i)
      ? ({ ...p, market_variant_companions: [...((p as { market_variant_companions?: MarketVariantCompanion[] }).market_variant_companions ?? []), ...attached.get(i)!], _absorbed_text: `${(p as { _absorbed_text?: string })._absorbed_text || ''} ${absorbed.get(i)!.join(' ')}`.trim() } as T)
      : p))
    .filter((_, i) => !drop.has(i));
}
