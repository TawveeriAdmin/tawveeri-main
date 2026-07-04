// scripts/resolve-identities.ts
// يقرأ normalized_product_observations → يطبق Decision Engine → يكتب identity_resolution_events
// لا يقرأ raw_name. لا يعدل canonical_products. لا merge فعلي الآن.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TPS_VERSION = "1.0";

// ── TYPES ────────────────────────────────────────────────────
type Resolution   = "merge" | "review" | "reject";
type ResolvedBy   = "rules" | "llm" | "human";
type KeyStatus    = "valid" | "low_confidence_candidate" | "invalid";

interface Observation {
  id: string;
  identity_key: string;
  identity_key_status: KeyStatus;
  detected_category: string;
  confidence: number;
  brand: string | null;
  model_number: string | null;
  ambiguity_flags: string[];
  normalized_payload: Record<string, unknown>;
}

interface DecisionResult {
  identity_key: string;
  observation_ids: string[];
  resolution: Resolution;
  resolved_by: ResolvedBy;
  resolution_rule: string;
  resolution_reason: string;
  confidence: number;
  evidence: {
    matching_fields: string[];
    conflicting_fields: string[];
    missing_fields: string[];
    model_number_match: boolean | null;
    flags: string[];
    observation_count: number;
  };
}

// ── CONFLICT FIELD DEFINITIONS ────────────────────────────────
// فقط Identity Fields وConditional Critical Fields تُحسب كـ conflict
// اللون والضمان والتركيب = Commercial Variants، لا تعارض

const CONFLICT_FIELDS: Record<string, string[]> = {
  mobile: ["brand", "family", "generation", "variant", "storage_gb"],
  ac:     ["brand", "ac_type", "series_or_platform", "capacity_btu", "technology", "cooling_mode"],
};

// ── FIELD EXTRACTION ──────────────────────────────────────────
// يسحب الحقول من الـ observation بدون لمس raw_name
function extractFields(obs: Observation): Record<string, unknown> {
  const payload = obs.normalized_payload || {};
  return {
    brand:              obs.brand,
    model_number:       obs.model_number,
    // mobile
    family:             payload.family,
    generation:         payload.generation,
    variant:            payload.variant,
    storage_gb:         payload.storage_gb,
    ram_gb:             payload.ram_gb,
    // ac
    ac_type:            payload.ac_type,
    series_or_platform: payload.series_or_platform,
    capacity_btu:       payload.capacity_btu,
    technology:         payload.technology,
    cooling_mode:       payload.cooling_mode,
  };
}

// ── CONFLICT DETECTION ────────────────────────────────────────
function detectConflicts(
  observations: Observation[],
  category: string
): { matching: string[]; conflicting: string[]; missing: string[] } {
  const fields = CONFLICT_FIELDS[category] || CONFLICT_FIELDS["mobile"];
  const matching: string[]    = [];
  const conflicting: string[] = [];
  const missing: string[]     = [];

  for (const field of fields) {
    const values = observations
      .map(o => extractFields(o)[field])
      .filter(v => v !== null && v !== undefined);

    if (values.length === 0) {
      // كل الـ observations فارغة في هذا الحقل
      missing.push(field);
    } else if (values.length < observations.length) {
      // بعضها فارغ → missing evidence، ليس conflict
      missing.push(field);
    } else {
      // كلها غير null — هل تتطابق؟
      const unique = new Set(values.map(String));
      if (unique.size === 1) {
        matching.push(field);
      } else {
        // قيمتان مختلفتان وكلاهما غير null في identity field → conflict حقيقي
        conflicting.push(field);
      }
    }
  }

  return { matching, conflicting, missing };
}

// ── MODEL NUMBER CHECK ────────────────────────────────────────
function checkModelNumber(observations: Observation[]): boolean | null {
  const models = observations
    .map(o => o.model_number)
    .filter(m => m !== null && m !== undefined);

  if (models.length < 2) return null; // لا يمكن المقارنة
  const unique = new Set(models);
  return unique.size === 1; // true = متطابقة، false = مختلفة → REVIEW
}

// ── DECISION ENGINE ───────────────────────────────────────────
function decide(
  identity_key: string,
  observations: Observation[],
  category: string
): DecisionResult {
  const { matching, conflicting, missing } = detectConflicts(observations, category);
  const model_number_match = checkModelNumber(observations);
  const all_flags = [...new Set(observations.flatMap(o => o.ambiguity_flags || []))];
  const all_statuses = observations.map(o => o.identity_key_status);
  const min_confidence = Math.min(...observations.map(o => o.confidence));
  const obs_ids = observations.map(o => o.id);

  const rule = category === "ac" ? "ac_identity_key_v1" : "mobile_identity_key_v1";

  const evidence = {
    matching_fields:    matching,
    conflicting_fields: conflicting,
    missing_fields:     missing,
    model_number_match,
    flags:              all_flags,
    observation_count:  observations.length,
  };

  // ── القاعدة الأولى: أي conflict → لا MERGE ────────────────
  if (conflicting.length > 0) {
    return {
      identity_key, observation_ids: obs_ids,
      resolution: "review", resolved_by: "human", resolution_rule: rule,
      resolution_reason: `Conflicting identity fields detected: ${conflicting.join(", ")}. Cannot merge without human verification.`,
      confidence: 0, evidence,
    };
  }

  // ── القاعدة الثانية: model_number متعارض → REVIEW human ───
  if (model_number_match === false) {
    return {
      identity_key, observation_ids: obs_ids,
      resolution: "review", resolved_by: "human", resolution_rule: rule,
      resolution_reason: "Model numbers present and conflicting — strong negative evidence. Requires human review.",
      confidence: 30, evidence,
    };
  }

  // ── القاعدة الثالثة: invalid أو low_confidence → REVIEW llm
  if (all_statuses.some(s => s === "invalid")) {
    return {
      identity_key, observation_ids: obs_ids,
      resolution: "review", resolved_by: "llm", resolution_rule: rule,
      resolution_reason: "One or more observations have invalid identity key status. LLM verification required.",
      confidence: 20, evidence,
    };
  }

  if (all_statuses.some(s => s === "low_confidence_candidate")) {
    return {
      identity_key, observation_ids: obs_ids,
      resolution: "review", resolved_by: "llm", resolution_rule: rule,
      resolution_reason: `Low confidence candidate: ${all_flags.join(", ") || "no explicit flags"}. LLM verification required.`,
      confidence: 40, evidence,
    };
  }

  // ── القاعدة الرابعة: valid + conf ≥ 95 + no conflicts → MERGE
  if (all_statuses.every(s => s === "valid") && min_confidence >= 95 && conflicting.length === 0) {
    const model_bonus = model_number_match === true ? " Model numbers confirmed." : "";
    return {
      identity_key, observation_ids: obs_ids,
      resolution: "merge", resolved_by: "rules", resolution_rule: rule,
      resolution_reason: `All ${matching.length} critical identity fields match. No conflicts detected.${model_bonus}`,
      confidence: model_number_match === true ? Math.min(100, min_confidence + 5) : min_confidence,
      evidence,
    };
  }

  // ── القاعدة الخامسة: valid لكن conf 85-94 → REVIEW llm ────
  if (all_statuses.every(s => s === "valid") && min_confidence >= 85) {
    return {
      identity_key, observation_ids: obs_ids,
      resolution: "review", resolved_by: "llm", resolution_rule: rule,
      resolution_reason: `Valid identity key but confidence ${min_confidence}% is below merge threshold (95%). LLM review recommended.`,
      confidence: min_confidence, evidence,
    };
  }

  // ── Fallback ───────────────────────────────────────────────
  return {
    identity_key, observation_ids: obs_ids,
    resolution: "review", resolved_by: "llm", resolution_rule: rule,
    resolution_reason: "Does not meet any merge criteria. Defaulting to LLM review.",
    confidence: min_confidence, evidence,
  };
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log("Reading normalized_product_observations...");

  const { data: observations, error } = await supabase
    .from("normalized_product_observations")
    .select("id, identity_key, identity_key_status, detected_category, confidence, brand, model_number, ambiguity_flags, normalized_payload")
    .not("identity_key", "is", null)
    .order("identity_key");

  if (error || !observations) { console.error("Read failed:", error); process.exit(1); }
  console.log(`Found ${observations.length} observations with identity keys.`);

  // تجميع حسب identity_key
  const groups = new Map<string, Observation[]>();
  for (const obs of observations as Observation[]) {
    if (!obs.identity_key) continue;
    const group = groups.get(obs.identity_key) || [];
    group.push(obs);
    groups.set(obs.identity_key, group);
  }

  // فقط المجموعات التي فيها أكثر من observation واحد (candidates)
  const candidates = [...groups.entries()].filter(([, g]) => g.length > 1);
  console.log(`\nIdentity key groups: ${groups.size} total, ${candidates.length} with multiple observations`);

  if (candidates.length === 0) {
    console.log("\nNo matching candidates found yet. This is expected with current data size.");
    console.log("Engine is ready. Waiting for more observations from multiple stores.");
    return;
  }

  const events = [];
  for (const [key, group] of candidates) {
    const category = group[0].detected_category;
    const result = decide(key, group, category);
    events.push({
      identity_key:         result.identity_key,
      observation_ids:      result.observation_ids,
      resolution:           result.resolution,
      resolved_by:          result.resolved_by,
      resolution_rule:      result.resolution_rule,
      resolution_reason:    result.resolution_reason,
      confidence:           result.confidence,
      evidence:             result.evidence,
      canonical_product_id: null,
      supersedes_event_id:  null,
      tps_version:          TPS_VERSION,
    });

    console.log(`\n[${result.resolution.toUpperCase()}] ${result.identity_key}`);
    console.log(`  by: ${result.resolved_by} | conf: ${result.confidence}%`);
    console.log(`  reason: ${result.resolution_reason}`);
  }

  if (events.length > 0) {
    const { error: insertError } = await supabase
      .from("identity_resolution_events")
      .insert(events);
    if (insertError) { console.error("Insert failed:", insertError); process.exit(1); }
    console.log(`\nWritten: ${events.length} resolution events`);
  }

  // Summary
  const merges  = events.filter(e => e.resolution === "merge").length;
  const reviews = events.filter(e => e.resolution === "review").length;
  const rejects = events.filter(e => e.resolution === "reject").length;
  console.log(`\n── Summary ─────────────────────────────`);
  console.log(`  MERGE  : ${merges}`);
  console.log(`  REVIEW : ${reviews}`);
  console.log(`  REJECT : ${rejects}`);
}

main().catch(console.error);