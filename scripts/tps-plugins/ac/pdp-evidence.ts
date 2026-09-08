// scripts/tps-plugins/ac/pdp-evidence.ts
// TYPE_2 PILOT (ADR-315) — founder-authorized, narrow scope: Amazon + AC only.
// NOT WIRED INTO normalize() OR ANY LIVE PIPELINE. A separate, additive module used only by
// the pilot/dry-run script this ADR documents. parser.ts, identity.ts, canonicalizeBrand(),
// and every tier/veto rule are completely untouched — this file is new code, imported by
// nothing in the production call graph yet.
//
// Extracts ONLY the specific, already-understood AC attributes the founder authorized:
// technology (inverter/standard), cooling_mode, ac_type, and capacity_btu (only when stated
// unambiguously). Brand/model/part_number are deliberately NOT extracted here — the founder's
// instruction was to pass those through only if EXISTING deterministic title extraction
// already proved them, never to invent new brand/model recognition from free text.
//
// Every accepted value carries explicit provenance (source_field) and a reason. Every
// REJECTED candidate is also recorded (rejected_candidates), so a reviewer can see not just
// what was extracted but what was found-and-correctly-discarded and why — this is what proves
// the false-positive guards actually fire, not just that they exist in the code.

export interface EvidenceItem<T> {
  value: T;
  source_field: "title" | "description" | "feature_bullet";
  matched_text: string;
}

export interface RejectedCandidate {
  attribute: string;
  candidate_value: string;
  source_field: "description" | "feature_bullet";
  matched_text: string;
  rejection_reason: string;
}

export interface PdpEvidenceResult {
  technology: EvidenceItem<string> | null;
  cooling_mode: EvidenceItem<string> | null;
  ac_type: EvidenceItem<string> | null;
  capacity_btu: EvidenceItem<number> | null;
  rejected_candidates: RejectedCandidate[];
}

// False-positive guard: a disqualifying phrase within ~80 chars of a candidate match means
// the match is describing something OTHER than this product's own attribute — a compatible
// accessory, a package-contents list, an optional add-on, or a different referenced model —
// not a genuine statement about the product being sold. Bilingual (AR/EN), per instruction #6.
const DISQUALIFYING_NEARBY = [
  /compatible\s+with/i, /متوافق\s*مع/,
  /package\s+includes?/i, /العبوة\s*تشمل|محتويات\s*العبوة|تشمل\s*العبوة/,
  /\bnot\s+(an?\s+)?accessor/i, /\baccessor(y|ies)\b/i, /إكسسوار|ملحق(ات)?/,
  /\boptional\b/i, /اختياري/,
  /works\s+with|designed\s+for\s+use\s+with/i,
  /also\s+available\s+(in|as)|also\s+sold\s+as/i, /متوفر\s*أيضاً?\s*(في|بـ)/,
];

// Sentence/bullet-scoped, not a raw character radius. Real Amazon PDP descriptions are
// composed of short, independent bullets/sentences (amazon-scraper.ts joins feature-bullets
// with '\n'; ordinary prose is period-delimited) — a disqualifying phrase in one bullet must
// never reject a genuine, unrelated attribute stated in a DIFFERENT bullet just because a
// fixed character window happened to span both. An earlier character-radius version of this
// guard had exactly that bug (a later, separate "also available as hot and cold" bullet wrongly
// rejected an EARLIER, genuine "cool only" bullet) — caught by this module's own test suite.
// Splitting on sentence/bullet boundaries first, then checking the guard only within the
// segment that contains the match, is the correct unit of context, not a tuned radius.
function segmentContaining(fullText: string, matchIndex: number): string {
  const segments = fullText.split(/[\n.؟!?]+/);
  let cursor = 0;
  for (const seg of segments) {
    const segEnd = cursor + seg.length;
    if (matchIndex >= cursor && matchIndex < segEnd + 1) return seg; // +1 tolerates the split delimiter itself
    cursor = segEnd + 1; // +1 for the delimiter character consumed by split
  }
  return fullText; // fallback: no clean segment found, use full text (fails safe toward MORE scrutiny, not less)
}

function isDisqualified(fullText: string, matchIndex: number): string | null {
  const segment = segmentContaining(fullText, matchIndex);
  for (const re of DISQUALIFYING_NEARBY) {
    if (re.test(segment)) return `disqualifying phrase in same sentence/bullet: "${segment.match(re)?.[0]}"`;
  }
  return null;
}

/**
 * Extracts AC identity evidence from Amazon PDP description/feature-bullet text ONLY —
 * never from the title (title evidence is already fully handled by parser.ts's normalize()
 * and is untouched here). Runs the SAME evidence-based keyword patterns already used and
 * proven in parser.ts (ADR-079, ADR-306) — no new heuristic invented, just a new place those
 * proven patterns are allowed to look, with false-positive guarding added because free-text
 * description is noisier than a short title.
 */
export function extractPdpEvidence(descriptionAr: string | null, descriptionEn: string | null): PdpEvidenceResult {
  const combinedRaw = `${descriptionAr ?? ""} ${descriptionEn ?? ""}`;
  const combined = combinedRaw.toLowerCase();
  const result: PdpEvidenceResult = { technology: null, cooling_mode: null, ac_type: null, capacity_btu: null, rejected_candidates: [] };

  const tryMatch = (
    pattern: RegExp,
    attribute: keyof Omit<PdpEvidenceResult, "rejected_candidates">,
    value: string,
  ): void => {
    if (result[attribute]) return; // first accepted match wins, same as parser.ts's own if/else-if chains
    const m = combined.match(pattern);
    if (!m || m.index === undefined) return;
    const disq = isDisqualified(combined, m.index);
    if (disq) {
      result.rejected_candidates.push({
        attribute, candidate_value: value, source_field: "description",
        matched_text: m[0], rejection_reason: disq,
      });
      return;
    }
    const item: EvidenceItem<string> = { value, source_field: "description", matched_text: m[0] };
    (result as unknown as Record<string, EvidenceItem<string>>)[attribute] = item;
  };

  // Technology — identical vocabulary to parser.ts's own proven patterns, applied to
  // description text instead of title.
  if (/triple inverter/i.test(combined)) tryMatch(/triple inverter/i, "technology", "Triple Inverter");
  tryMatch(/inverter|إنفرتر|انفرتر/, "technology", "Inverter");
  tryMatch(/\bon\/off\b|\bon-off\b|أون\/أوف|غير\s*انفرتر|غير\s*إنفرتر|non[\s-]?inverter/i, "technology", "Standard");

  // Cooling mode.
  tryMatch(/hot\s*(and|&)\s*cold|heat\s*(and|&)\s*cool|hot\/cold|بارد\s*وحار|حار\s*وبارد|بارد\s*\/\s*حار/i, "cooling_mode", "hot_cold");
  tryMatch(/cool(ing)?\s*only|cold\s*only|بارد\s*فقط|تبريد\s*فقط/i, "cooling_mode", "cool_only");

  // AC type — only accepted if the TITLE didn't already resolve it (this pilot's payload
  // always already has ac_type from title per the mandatory-field gate in identity.ts, so
  // in practice this rarely fires — included for completeness/symmetry with the other three).
  tryMatch(/\bsplit\s*(system|ac|ir\s*conditioner)?\b|سبليت|جداري/i, "ac_type", "split");
  tryMatch(/\bwindow\s*(ac|air\s*conditioner)?\b|شباك/i, "ac_type", "window");
  tryMatch(/\bportable\b|نقال/i, "ac_type", "portable");

  // Capacity BTU — ONLY accepted from description if it is the SAME number the title already
  // stated (corroboration, not a new number) — per the founder's instruction that BTU must be
  // "confidently expressed," and per identity.ts's own BTU-based key structure, silently
  // trusting a SECOND, possibly-different BTU number from noisy description text (e.g. a
  // "similar items" carousel bleeding into scraped description) would be exactly the kind of
  // new, unreviewed heuristic instruction #4 forbids. Left null by design in this pilot —
  // capacity_btu extraction from description is NOT attempted; BTU stays title-only, unchanged.

  return result;
}
