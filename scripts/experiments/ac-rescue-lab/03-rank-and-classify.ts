// AC Rescue Lab — Step 3: rank candidates within multi-candidate sets, assign confidence
// classes. Pure local computation, no database access.
import * as fs from "fs";
import { resolve } from "path";

const OUT_DIR = resolve(__dirname, "out");
const runA = JSON.parse(fs.readFileSync(resolve(OUT_DIR, "run-A-full-fingerprint.json"), "utf-8"));

function score(c: any) {
  return c.matching_attributes.length - c.missing_attributes.length;
}

type ConfidenceClass = "RESCUE_PROVEN" | "RESCUE_HIGH_CONFIDENCE" | "RESCUE_REVIEW" | "AMBIGUOUS" | "NO_CANDIDATE" | "HARD_CONFLICT";

function classify(r: any): { class: ConfidenceClass; why_not_higher: string; leading?: any } {
  if (r.surviving_candidate_count === 0) {
    return { class: r.rejected_by_hard_conflict_count > 0 ? "HARD_CONFLICT" : "NO_CANDIDATE", why_not_higher: r.rejected_by_hard_conflict_count > 0 ? "all raw candidates eliminated by a proven attribute conflict" : "no trusted candidate shares brand+type+capacity_class" };
  }
  const ranked = [...r.candidates].sort((a: any, b: any) => score(b) - score(a));
  const top = ranked[0];
  const topScore = score(top);
  const secondScore = ranked.length > 1 ? score(ranked[1]) : -Infinity;
  const clearLead = topScore > secondScore;
  const topMissing = top.missing_attributes.length;

  if (r.surviving_candidate_count === 1 && topMissing === 0) {
    return { class: "RESCUE_PROVEN", why_not_higher: "n/a — full attribute agreement, unique candidate", leading: top };
  }
  if (r.surviving_candidate_count === 1 && topMissing <= 1) {
    return { class: "RESCUE_HIGH_CONFIDENCE", why_not_higher: `unique candidate but ${topMissing} attribute(s) unconfirmed on the trusted side`, leading: top };
  }
  if (r.surviving_candidate_count === 1) {
    return { class: "RESCUE_REVIEW", why_not_higher: `unique candidate but only sparse corroboration (${top.matching_attributes.length} matching, ${topMissing} missing) — 'unique' here mostly reflects thin trusted-side data, not strong agreement`, leading: top };
  }
  // multi-candidate
  if (clearLead && topMissing === 0) {
    return { class: "RESCUE_HIGH_CONFIDENCE", why_not_higher: `${r.surviving_candidate_count} raw candidates, but one has full attribute agreement and a clear score lead over the rest — the others remain as weaker, unconfirmed alternatives`, leading: top };
  }
  if (clearLead && topMissing <= 1) {
    return { class: "RESCUE_REVIEW", why_not_higher: `a leading candidate exists (score ${topScore} vs next ${secondScore}) but ${topMissing} attribute(s) still unconfirmed — needs human review before any trust`, leading: top };
  }
  return { class: "AMBIGUOUS", why_not_higher: `${r.surviving_candidate_count} candidates with no clear score separation (top ${topScore} vs next ${secondScore}) — genuinely cannot distinguish which, if any, is correct`, leading: top };
}

const classified = runA.results.map((r: any) => ({ ...r, ...classify(r) }));
const tally: Record<string, number> = {};
for (const c of classified) tally[c.class] = (tally[c.class] ?? 0) + 1;

console.log("=== CONFIDENCE CLASS TALLY (Run A, full-fingerprint-eligible, n=26) ===");
console.log(tally);

console.log("\n=== RESCUE_PROVEN cases (full detail) ===");
console.log(JSON.stringify(classified.filter((c: any) => c.class === "RESCUE_PROVEN").map((c: any) => ({ amazon: c.amazon_name, leading: c.leading?.trusted_name, matching: c.leading?.matching_attributes })), null, 2));

console.log("\n=== RESCUE_HIGH_CONFIDENCE cases (full detail) ===");
console.log(JSON.stringify(classified.filter((c: any) => c.class === "RESCUE_HIGH_CONFIDENCE").map((c: any) => ({ amazon: c.amazon_name, leading: c.leading?.trusted_name, matching: c.leading?.matching_attributes, missing: c.leading?.missing_attributes, why_not_higher: c.why_not_higher })), null, 2));

fs.writeFileSync(resolve(OUT_DIR, "run-A-classified.json"), JSON.stringify(classified, null, 2));
console.log("\nWrote out/run-A-classified.json");
