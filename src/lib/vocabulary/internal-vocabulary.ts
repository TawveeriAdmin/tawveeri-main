// F7·1 — INTERNAL VOCABULARY. Tokens that exist only inside the system.
//
// SEPARATE FROM THE CUSTOMER VOCABULARY ON PURPOSE, and the separation is not filing tidiness.
// The two registries answer different questions:
//
//   customer-vocabulary.ts  →  "may a customer READ this claim?"      (a truth question)
//   internal-vocabulary.ts  →  "has an internal token ESCAPED?"       (a containment question)
//
// A claim can be forbidden and still be perfectly good English. An internal token is never
// language at all — it is machinery, and its appearance on a customer surface is a leak with no
// legitimate reading. Merging them would let a containment failure be argued about as a wording
// preference. A test asserts no token appears in both registries.
//
// CATEGORY-AGNOSTIC. The sentinel list is the union across ALL categories and plugins, so a new
// category inherits it. It has leaked twice already — mobile `NO_STORAGE` (ADR-081/084) and AC
// `NO_TECH` (ADR-109) — each time from a category-specific name builder, which is precisely why
// the guard must not be category-specific.
import type { InternalToken } from './types';

export const INTERNAL_TOKENS: readonly InternalToken[] = [
  {
    id: 'identity-sentinel',
    title: 'Identity sentinels for an unspecified spec',
    why:
      'A sentinel is a placeholder for a spec we could not determine. Rendered to a customer it ' +
      'becomes a fabricated specification — "NO_STORAGEGB" — which is the one thing the ' +
      'Constitution forbids absolutely: never fabricate an attribute. Unknown beats incorrect, ' +
      'but only if the unknown is omitted rather than printed.',
    // The union across every plugin that writes an identity key. Kept in step with
    // `scripts/tps-analysis/sentinel-check.ts`, which gates the same tokens at the DB layer;
    // this registry gates them at the language layer.
    tokens: [
      'NO_STORAGE', 'NO_TECH', 'NO_SERIES', 'NO_GEN', 'NO_RES', 'NO_PANEL', 'NO_HZ',
      'NO_CONN', 'NO_SIZE', 'NO_FAMILY', 'NO_SCREEN', 'NO_STORE', 'NO_CPU',
    ],
    source: {
      section: 'CLAUDE.md · automation runtime facts',
      quote: 'must be stripped at EVERY customer render path',
    },
    since: 'ADR-078 · ADR-081 · ADR-109',
  },
  {
    id: 'storage-layer-name',
    title: 'Internal table and column names',
    why:
      'Our storage layout is not a customer-facing concept, and a leaked identifier reads as a ' +
      'defect even when the value beside it is correct. It also discloses schema for no benefit.',
    tokens: [
      'raw_observations',
      'normalized_product_observations',
      'tps_product_projection',
      'canonical_product_id',
      'tps_observation_id',
      'price_history',
      'tps_listing_price_facts',
    ],
    source: {
      section: 'CLAUDE.md · naming discipline',
      quote: 'TPS knowledge layer',
    },
    since: 'ADR-125 (layer naming discipline)',
  },
] as const;

/** Every internal token, flattened. */
export const ALL_INTERNAL_TOKENS: readonly string[] = INTERNAL_TOKENS.flatMap((g) => g.tokens);
