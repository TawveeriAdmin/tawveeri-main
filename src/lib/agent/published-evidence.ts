// THE ENGINE'S PUBLISHED EVIDENCE CONTRACT (ADR-162).
//
// PUBLISH, NEVER INFER. Every customer-visible figure the engine renders is declared here with
// its provenance, so a consumer can verify any published number WITHOUT knowing anything about
// how the engine works. Before this existed, the F7·2 validator's harness reconstructed evidence
// by GUESSING from field names (`/price|cost|total/`) — inference dressed as verification, and
// it still missed the one figure that mattered: the saving in `chosen_over`, which lived only
// inside the rendered sentence.
//
// THE GUARD WAS CORRECT AND THE CONTRACT WAS INCOMPLETE. Nothing here weakens a rule; it supplies
// the facts the rules were always asking for.
//
// CATEGORY-INDEPENDENT BY CONSTRUCTION. This file reads only fields every recommendation has —
// `unit_price`, `total_cost_estimate`, `cost_breakdown`, `store_count`, `stores` — plus the
// explicitly published `total_cost_delta`. It names no category, consults no per-category table,
// and a new category inherits the contract with no change here. A test asserts that.
import type { EvidenceFigure } from '@/lib/vocabulary';

/** The shape this builder needs. Deliberately structural, so it cannot bind to one payload version. */
interface RecommendationLike {
  unit_price?: number | null;
  total_cost_estimate?: number | null;
  cost_breakdown?: { unit?: number | null; installation?: number | null; annual_electricity?: number | null } | null;
  store_count?: number | null;
  stores?: string[] | null;
  dna?: Record<string, unknown> | null;
}

interface DecidePayloadLike {
  recommendations?: RecommendationLike[] | null;
  smart_pick?: (RecommendationLike & { chosen_over?: { total_cost_delta?: number | null } | null }) | null;
}

/**
 * THE CUSTOMER-VISIBLE REPRESENTATION OF A PRICE — one fact, one number (ADR-168).
 *
 * MEASURED 2026-08-01: 7 of 11 rejections on the natural sample were a rounding mismatch. The
 * prompt rounded (`Math.round(best_price)` → «11 ريال») while the evidence published the raw
 * observation (`10.994001`). The model repeated what it was shown, the validator required an
 * exact match against what was declared, and both were right — the same fact simply had two
 * representations and no single source.
 *
 * WHY A SHARED FUNCTION RATHER THAN "round in the publisher too". Rounding in two places is the
 * defect, not the fix: the next surface to render a price would round independently and the two
 * would drift again. Every consumer that SHOWS a price and every consumer that DECLARES one now
 * call this, so they cannot disagree by construction.
 *
 * PROVENANCE IS UNAFFECTED. The raw observation stays exactly where it was — in
 * `price_history`, in the offer payload, in the projection. This governs only what may be
 * STATED to a customer. We round the presentation; we never round the evidence.
 */
export function customerPrice(raw: number): number {
  return Math.round(raw);
}

export interface PublishedEvidence {
  figures: EvidenceFigure[];
  retailers: string[];
}

const push = (into: EvidenceFigure[], value: unknown, kind: EvidenceFigure['kind'], derivedFrom: EvidenceFigure['derivedFrom'], label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  into.push({ value, kind, derivedFrom, label });
};

/**
 * Build the evidence bundle the engine publishes alongside its answer.
 *
 * PROVENANCE IS DECLARED, NOT DEDUCED:
 *   `live-query` — read from production at answer time (observed prices, store counts).
 *   `computed`   — derived deterministically from observed values and disclosed as derived
 *                  (total-cost estimate and its components, the saving in `chosen_over`).
 * `static` is never emitted here: the engine hardcodes no customer-visible figure. If that ever
 * changes, the figure must say so rather than borrow another figure's provenance.
 */
export function buildPublishedEvidence(payload: DecidePayloadLike): PublishedEvidence {
  const figures: EvidenceFigure[] = [];
  const retailers = new Set<string>();

  const items: RecommendationLike[] = [
    ...(Array.isArray(payload.recommendations) ? payload.recommendations : []),
    ...(payload.smart_pick ? [payload.smart_pick] : []),
  ];

  for (const r of items) {
    push(figures, r.unit_price, 'price', 'live-query', 'unit_price');
    push(figures, r.total_cost_estimate, 'price', 'computed', 'total_cost_estimate');
    push(figures, r.cost_breakdown?.unit, 'price', 'live-query', 'cost_breakdown.unit');
    push(figures, r.cost_breakdown?.installation, 'price', 'computed', 'cost_breakdown.installation');
    push(figures, r.cost_breakdown?.annual_electricity, 'price', 'computed', 'cost_breakdown.annual_electricity');
    push(figures, r.store_count, 'retailer-count', 'live-query', 'store_count');
    if (Array.isArray(r.stores)) {
      // The NAMED retailers behind "N stores" — and the count they support, so the two can never
      // disagree without it being visible.
      push(figures, r.stores.length, 'retailer-count', 'live-query', 'stores.length');
      for (const s of r.stores) if (typeof s === 'string' && s.trim()) retailers.add(s.trim());
    }
    // Product DNA values are OBSERVED attributes (capacity, size, class). No F7 rule consumes
    // them today; they are published so the bundle is complete rather than complete-enough, and
    // so a future attribute rule inherits provenance instead of asking for it.
    if (r.dna && typeof r.dna === 'object') {
      for (const [key, value] of Object.entries(r.dna)) {
        push(figures, value, 'attribute', 'live-query', `dna.${key}`);
      }
    }
  }

  // The saving `chosen_over` RENDERS. Published by the engine on the same branch that renders it.
  push(figures, payload.smart_pick?.chosen_over?.total_cost_delta, 'price', 'computed', 'chosen_over.total_cost_delta');

  return { figures, retailers: [...retailers] };
}

/** A number found in customer-visible text that the engine did not publish. */
export interface UnpublishedFigure {
  path: string;
  value: number;
  kind: EvidenceFigure['kind'];
  excerpt: string;
}

const AR_DIGITS = /[٠-٩۰-۹]/g;
const normaliseDigits = (s: string) =>
  s.replace(AR_DIGITS, (d) => {
    const c = d.charCodeAt(0);
    return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
  });

// The three classes an F7 rule can challenge. Kept in step with `validate.ts` deliberately: the
// contract must cover exactly what the guard checks, no more and no less.
const SUBJECTS: Array<[EvidenceFigure['kind'], string[]]> = [
  ['price', ['SAR', 'SR', 'ريال', 'ريالاً', 'ر\\.س']],
  ['retailer-count', ['retailers?', 'stores?', 'shops?', 'متجر', 'متاجر', 'متجرًا', 'متجرا']],
  ['comparable-count', ['compared', 'comparable', 'منتجًا مقارنًا', 'منتجا مقارنا', 'قابل للمقارنة']],
];

/**
 * COMPLETENESS CHECK — "if a figure cannot declare its provenance, the engine must not render it."
 *
 * Walks every customer-visible string in a decide payload and returns each figure the engine
 * renders but did not publish. An empty result is the contract holding; anything else is an
 * engine defect, never a reason to relax a rule.
 *
 * Machine fields are skipped by NAME, the same principled class the validator harness uses —
 * an identity key or a URL is not customer-visible text and its digits are not claims.
 */
export function findUnpublishedFigures(payload: unknown, evidence: PublishedEvidence): UnpublishedFigure[] {
  const out: UnpublishedFigure[] = [];
  const published = new Map<EvidenceFigure['kind'], Set<number>>();
  for (const f of evidence.figures) {
    if (!published.has(f.kind)) published.set(f.kind, new Set());
    published.get(f.kind)!.add(f.value);
  }

  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (/(^|[._])(key|url|href|id|slug|code|sku|gtin)(\[|$|\.)/i.test(path)) return;
      const text = normaliseDigits(node);
      for (const [kind, subjects] of SUBJECTS) {
        for (const subject of subjects) {
          for (const src of [`(\\d[\\d,.]*)\\s*(?:${subject})`, `(?:${subject})\\s*(\\d[\\d,.]*)`]) {
            for (const m of text.matchAll(new RegExp(src, 'giu'))) {
              const value = Number.parseFloat((m[1] || '').replace(/,/g, ''));
              if (!Number.isFinite(value)) continue;
              if (published.get(kind)?.has(value)) continue;
              out.push({ path, value, kind, excerpt: m[0].trim() });
            }
          }
        }
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, path ? `${path}.${k}` : k);
    }
  };

  walk(payload, '');
  return out;
}
