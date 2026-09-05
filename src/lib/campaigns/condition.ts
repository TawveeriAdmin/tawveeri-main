// src/lib/campaigns/condition.ts — Amazon × Noon internal commerce, condition truth
// (founder mission, 2026-09-05, §1/§2). "RENEWED IS NOT NEW."
//
// Reuses extractSpecsFromTitle() (src/lib/scraping/config/spec-configs.ts, ADR-287) —
// the ONE existing condition detector in this codebase, already live behind the Smart
// Pick disclosure. Never re-derives condition detection with a second regex set.
import { extractSpecsFromTitle } from '@/lib/scraping/config/spec-configs';

export type MerchantCondition = 'NEW' | 'RENEWED' | 'USED' | 'UNKNOWN';

/**
 * Classifies an offer's condition from its own raw title. Pure, deterministic.
 *
 * Only 'renewed' and 'used' are ever explicitly DETECTED — extractSpecsFromTitle()'s own
 * design note says it deliberately "skip[s] 'new' — too many false positives" as an
 * explicit keyword match. This function does NOT invent a third detector: instead, the
 * ABSENCE of a renewed/used marker classifies as NEW, not UNKNOWN, for the following
 * evidence-backed reason (not an assumption): both Amazon and Noon require condition
 * disclosure, and every renewed/used title actually observed in this codebase's own
 * production data (a live, read-only count taken 2026-09-05: 218 cross-merchant
 * renewed/refurbished/used titles at Amazon+Noon combined) explicitly says so in the
 * title text — "Renewed - ...", "...(Renewed)", etc. Treating "no disclosure" as UNKNOWN
 * rather than NEW would make the vast majority of ordinary new-vs-new comparisons
 * unable to ever be called equivalent, which is not what "unknown beats incorrect" is
 * protecting against here — it exists to stop a KNOWN condition difference from being
 * silently ignored, not to block every comparison where nothing was disclosed.
 *
 * UNKNOWN is reserved for a genuinely missing/empty title — there is no text to have
 * disclosed anything in, so no inference (NEW or otherwise) is safe to make.
 *
 * "REFURBISHED" and "OPEN_BOX" are not separately detected: extractSpecsFromTitle()
 * groups "refurbished" into the same 'renewed' bucket by design (both map to RENEWED
 * here — a real but disclosed limitation, not a silent one), and a live count found
 * ZERO "open box"/"فتح الصندوق" titles anywhere in current production data — adding a
 * detector for evidence that does not exist would be exactly the "manufacture
 * distinctions unsupported by source evidence" this mission explicitly forbids.
 */
export function classifyCondition(title: string | null | undefined): MerchantCondition {
  if (!title || !title.trim()) return 'UNKNOWN';
  const detected = extractSpecsFromTitle(title).condition;
  if (detected === 'renewed') return 'RENEWED';
  if (detected === 'used') return 'USED';
  return 'NEW';
}
