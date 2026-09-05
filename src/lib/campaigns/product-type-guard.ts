// src/lib/campaigns/product-type-guard.ts — Amazon × Noon internal commerce, systemic
// product-type/category sanity (founder mission, 2026-09-05, §4). ADR-298 fixed ONE
// miscategorized row (a TV speaker filed as "tv") as isolated data remediation; that is
// not protection against the NEXT one. This is the systemic, reusable guard.
//
// Reuses isAccessoryTitleHead() (src/lib/scraping/utils/category-utils.ts, ADR-243) — the
// existing, proven, HEAD-ANCHORED accessory vocabulary (case/charger/cable/mount/stand/...,
// Arabic included) — never re-derived. Deliberately the HEAD-anchored variant, not the
// whole-title isAccessoryTitle(): a live replay against real Amazon x Noon overlap data
// (2026-09-05) proved the whole-title check produces real false positives on genuine main
// products whose LONG marketing description mentions an accessory-adjacent word as a
// FEATURE, not as what the listing fundamentally is — e.g. a real gaming monitor's title
// mentioning "Ergonomic Stand" near the end, or a real Bluetooth speaker's title
// mentioning "with Power Bank" as a feature. A genuine accessory listing announces itself
// as such immediately (ADR-243's own rationale for why isAccessoryTitleHead exists at
// all) — this module inherits that same discipline rather than re-deriving a different
// one. Deliberately does NOT add "speaker" to the shared, global keyword list either:
// "speaker" is a real product noun in the audio category (e.g. "JBL Bluetooth Speaker"),
// so a global keyword would create new false positives exactly where the accessory
// vocabulary is already relied on elsewhere. Instead, the TV-specific gap this mission
// found is closed with a narrow, category-scoped rule below.
import { isAccessoryTitleHead } from '@/lib/scraping/utils/category-utils';

// A real television listing virtually always states an inch screen size or an explicit
// resolution/panel-technology marker; a TV-branded audio COMPONENT (speaker/soundbar)
// sold as a replacement/accessory typically does not. Both conditions must hold for the
// narrow TV-only rule to fire, keeping it conservative rather than a blanket "no speaker
// in TV" ban (a real "TV with built-in speaker system" listing would still carry an inch
// size or resolution term and would NOT be flagged). Deliberately excludes a bare "Hz"
// marker: a real production title proved this ambiguous — a speaker's own audio
// frequency-response spec ("200HZ-20KH") reads identically to a TV refresh-rate claim,
// so "Hz" alone cannot distinguish them; inch-size and resolution/panel terms can.
const TV_SIZE_OR_SPEC_MARKER = /\d+\s*("|inch)\b|\b(4k|8k|uhd|fhd|qhd|oled|qled|hdr)\b/i;
const TV_AUDIO_COMPONENT_MARKER = /\b(speaker|soundbar|sound bar)\b/i;

/**
 * True when a listing's title suggests it does not belong in the given canonical
 * category — an accessory, replacement part, or component masquerading as the main
 * product. Fails CLOSED (returns true / "mismatch") only on genuine title evidence,
 * never on the category value alone. Intended for COMMERCIAL EQUIVALENCE decisions only
 * (mission §4: "fail closed for uncertain COMMERCIAL equivalence only... do not break
 * normal search/display") — never wired into search/ranking/display filtering.
 */
export function looksLikeCategoryMismatch(title: string | null | undefined, category: string | null | undefined): boolean {
  if (!title) return false;
  if (isAccessoryTitleHead(title)) return true;
  if (category === 'tv' && TV_AUDIO_COMPONENT_MARKER.test(title) && !TV_SIZE_OR_SPEC_MARKER.test(title)) return true;
  return false;
}
