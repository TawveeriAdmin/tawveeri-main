// AC Rescue Lab — Step 2: candidate generation (blocking) + hard-conflict gates.
// Pure local computation over the JSON files Step 1 wrote. NO database access at all in this
// file — cannot touch production even accidentally.
import * as fs from "fs";
import { resolve } from "path";

const OUT_DIR = resolve(__dirname, "out");
const amazon = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "amazon-fingerprints.json"), "utf-8"));
const trusted = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "trusted-fingerprints.json"), "utf-8"));

const CAPACITY_TOLERANCE_CLASSES = 0; // exact capacity_class match only (±~500 BTU via rounding) — the
// mission's own §10 asks NOT to assume exact BTU equality; capacity_class (rounded to nearest
// 1000 BTU) is the CANDIDATE-GENERATION-ONLY representation chosen in Step 1. Widening this
// tolerance is a lever explicitly left for a later, separate experiment — not changed here.

type Conflict = { attribute: string; amazon_value: string; trusted_value: string };

function hardConflicts(a: any, t: any): Conflict[] {
  const conflicts: Conflict[] = [];
  // Brand and type and capacity_class are the BLOCKING keys — by construction, a candidate
  // that reached this function already agrees on all three. Remaining hard-conflict checks
  // are on attributes NOT used for blocking, where a proven disagreement must still reject.
  if (a.cooling_mode && t.cooling_mode && a.cooling_mode !== t.cooling_mode) {
    conflicts.push({ attribute: "cooling_mode", amazon_value: a.cooling_mode, trusted_value: t.cooling_mode });
  }
  if (a.technology && t.technology && a.technology !== t.technology) {
    conflicts.push({ attribute: "technology", amazon_value: a.technology, trusted_value: t.technology });
  }
  if (a.series_or_platform && t.series_or_platform && a.series_or_platform !== t.series_or_platform) {
    conflicts.push({ attribute: "series_or_platform", amazon_value: a.series_or_platform, trusted_value: t.series_or_platform });
  }
  if (a.model_number && t.model_number && a.model_number !== t.model_number) {
    conflicts.push({ attribute: "model_number", amazon_value: a.model_number, trusted_value: t.model_number });
  }
  return conflicts;
}

function matchingAttributes(a: any, t: any): string[] {
  const m: string[] = ["brand", "ac_type", "capacity_class"]; // blocking keys, always agree here
  if (a.cooling_mode && t.cooling_mode && a.cooling_mode === t.cooling_mode) m.push("cooling_mode");
  if (a.technology && t.technology && a.technology === t.technology) m.push("technology");
  if (a.series_or_platform && t.series_or_platform && a.series_or_platform === t.series_or_platform) m.push("series_or_platform");
  return m;
}

function missingAttributes(a: any, t: any): string[] {
  const miss: string[] = [];
  if (!a.cooling_mode || !t.cooling_mode) miss.push("cooling_mode");
  if (!a.technology || !t.technology) miss.push("technology");
  if (!a.series_or_platform || !t.series_or_platform) miss.push("series_or_platform");
  return miss;
}

function runBlocking(requireFullFingerprint: boolean) {
  const eligible = amazon.filter((a: any) =>
    a.brand_safe && a.ac_type && a.capacity_btu !== null &&
    (!requireFullFingerprint || (a.cooling_mode && a.technology))
  );

  const results = eligible.map((a: any) => {
    const rawCandidates = trusted.filter((t: any) =>
      t.brand_safe &&
      t.brand_canonical === a.brand_canonical &&
      t.ac_type === a.ac_type &&
      t.capacity_class !== null && a.capacity_class !== null &&
      Math.abs(t.capacity_class - a.capacity_class) <= CAPACITY_TOLERANCE_CLASSES
    );
    // Apply hard-conflict gates — a candidate with a PROVEN disagreement on a non-blocking
    // attribute is removed from the candidate set entirely (not just down-ranked).
    const survivingCandidates = rawCandidates.filter((t: any) => hardConflicts(a, t).length === 0);
    const rejectedByConflict = rawCandidates.filter((t: any) => hardConflicts(a, t).length > 0);

    return {
      amazon_id: a.id, amazon_name: a.name_en,
      amazon_fingerprint: { brand: a.brand_canonical, ac_type: a.ac_type, capacity_btu: a.capacity_btu, capacity_class: a.capacity_class, cooling_mode: a.cooling_mode, technology: a.technology, series: a.series_or_platform },
      raw_candidate_count: rawCandidates.length,
      surviving_candidate_count: survivingCandidates.length,
      rejected_by_hard_conflict_count: rejectedByConflict.length,
      candidates: survivingCandidates.map((t: any) => ({
        trusted_id: t.id, trusted_name: t.name_en, trusted_tier: t.tier_status, trusted_stores: t.store_ids,
        matching_attributes: matchingAttributes(a, t),
        missing_attributes: missingAttributes(a, t),
        trusted_fingerprint: { brand: t.brand_canonical, ac_type: t.ac_type, capacity_btu: t.capacity_btu, capacity_class: t.capacity_class, cooling_mode: t.cooling_mode, technology: t.technology, series: t.series_or_platform },
      })),
    };
  });

  const zero = results.filter((r: any) => r.surviving_candidate_count === 0);
  const one = results.filter((r: any) => r.surviving_candidate_count === 1);
  const multi = results.filter((r: any) => r.surviving_candidate_count >= 2);
  const veryLarge = results.filter((r: any) => r.surviving_candidate_count >= 10);

  return { eligible_count: eligible.length, results, zero, one, multi, veryLarge };
}

console.log("\n========== RUN A: FULL FOUNDER FINGERPRINT (brand+type+capacity+mode+inverter required) ==========");
const runA = runBlocking(true);
console.log("ELIGIBLE (has full fingerprint):", runA.eligible_count);
console.log("ZERO_CANDIDATE:", runA.zero.length);
console.log("ONE_CANDIDATE:", runA.one.length);
console.log("MULTIPLE_CANDIDATES (2+):", runA.multi.length);
console.log("VERY_LARGE_BLOCK (10+):", runA.veryLarge.length);

console.log("\n========== RUN B: MINIMAL BLOCKING FINGERPRINT (brand+type+capacity only) ==========");
const runB = runBlocking(false);
console.log("ELIGIBLE (has minimal fingerprint):", runB.eligible_count);
console.log("ZERO_CANDIDATE:", runB.zero.length);
console.log("ONE_CANDIDATE:", runB.one.length);
console.log("MULTIPLE_CANDIDATES (2+):", runB.multi.length);
console.log("VERY_LARGE_BLOCK (10+):", runB.veryLarge.length);

fs.writeFileSync(resolve(OUT_DIR, "run-A-full-fingerprint.json"), JSON.stringify(runA, null, 2));
fs.writeFileSync(resolve(OUT_DIR, "run-B-minimal-fingerprint.json"), JSON.stringify(runB, null, 2));

console.log("\n=== RUN A — every ONE_CANDIDATE case, full detail (this is the founder's exact hypothesis) ===");
console.log(JSON.stringify(runA.one, null, 2));

console.log("\nWrote out/run-A-full-fingerprint.json, out/run-B-minimal-fingerprint.json");
