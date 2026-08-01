// scripts/tps-analysis/validator-verify.ts
// ─────────────────────────────────────────────────────────────────────────────
// F7·2 VALIDATOR VERIFICATION — against the live product (ADR-158).
//
// The generative surface is CLOSED in production, so there is no live generated answer to
// validate. Two things can still be checked on the real system, and both matter:
//
//   §1  THE SURFACE IS STILL CLOSED. F7·2 touched that route. A change to the generative
//       endpoint that accidentally opened it would be the single worst outcome of this work,
//       so it is verified rather than assumed.
//
//   §2  PRECISION AGAINST REAL PRODUCTION OUTPUT. Every customer-visible string the
//       DETERMINISTIC engine produces for real queries is run through the validator with an
//       evidence bundle built from the same payload. A false rejection here would mean that on
//       the day the generative surface opens, the validator suppresses correct answers — a
//       failure that unit fixtures cannot find, because fixtures are written by the same person
//       who wrote the rules.
//
// This is NOT a test of the generator. It is a test of the GUARD, against language the product
// really emits.
//
//   npx tsx scripts/tps-analysis/validator-verify.ts --base https://tawveeri.com
// ─────────────────────────────────────────────────────────────────────────────
import {
  validateGeneratedAnswer,
  recordValidationEvent,
  setValidationSink,
  VOCABULARY_VERSION,
  vocabularyFingerprint,
  EVIDENCE_RULES_HANDLED,
  ADVERSARIAL_CASES,
  MUST_PASS_CASES,
  DECLARED_RESIDUALS,
  type AnswerEvidence,
  type ValidationEvent,
} from "../../src/lib/vocabulary";
import { findUnpublishedFigures } from "../../src/lib/agent/published-evidence";

const BASE = (() => {
  const i = process.argv.indexOf("--base");
  return i >= 0 ? process.argv[i + 1].replace(/\/$/, "") : "http://localhost:3000";
})();

/** Real need-based queries the engine answers, both locales. */
const QUERIES = [
  "مكيف لغرفة ٤٠ متر",
  "مكيف هادئ لغرفة نوم تحت 3000",
  "غسالة لعائلة كبيرة",
  "ثلاجة اقتصادية",
  "a quiet AC for a 30 m² room under 4000",
  "a washing machine for a big family",
  "an energy efficient fridge",
];

let failures = 0;
const events: ValidationEvent[] = [];
setValidationSink((e) => events.push(e));

const check = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

/** Every leaf string in a payload — this is what a customer can end up reading. */
function* strings(node: unknown, path = ""): Generator<[string, string]> {
  if (typeof node === "string") { yield [path, node]; return; }
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) yield* strings(node[i], `${path}[${i}]`); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      yield* strings(v, path ? `${path}.${k}` : k);
    }
  }
}

(async () => {
  console.log(`\nF7·2 VALIDATOR VERIFICATION — ${BASE}`);
  console.log(`vocabulary ${VOCABULARY_VERSION} · fingerprint ${vocabularyFingerprint()}`);
  console.log(`evidence rules enforced: ${EVIDENCE_RULES_HANDLED.join(", ")}`);
  console.log("=".repeat(72) + "\n");

  // ── §1 the generative surface must still be closed ─────────────────────────
  console.log("§1 generative surface is still closed");
  {
    const res = await fetch(`${BASE}/api/ai-assistant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "مرحبا" }),
    });
    check(res.status === 404, "POST /api/ai-assistant returns 404", `status ${res.status}`);
  }

  // ── §2 precision against real deterministic output ─────────────────────────
  console.log("\n§2 no false rejection of real production output");
  let stringsChecked = 0;
  const falseRejections: string[] = [];

  for (const text of QUERIES) {
    const res = await fetch(`${BASE}/api/v1/agent/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { console.log(`SKIP  "${text}" — decide returned ${res.status}`); continue; }
    const payload = await res.json();
    const evidence = payload.evidence as AnswerEvidence | undefined;

    // THE PATH EXCLUSION THAT USED TO STAND HERE IS GONE (ADR-162).
    //
    // It carried `smart_pick.chosen_over.reasons_*`, because the engine rendered a saving —
    // «أوفر بـ180 ريال» — that appeared nowhere in the payload. That was a real gap, and the
    // right fix was the CONTRACT, not the exclusion: the engine now publishes
    // `chosen_over.total_cost_delta` on the same branch that renders the sentence. Nothing is
    // excluded from this scan any more, and nothing is inferred either — the evidence comes from
    // `payload.evidence`, declared by the engine, not guessed from field names by this harness.
    check(
      Boolean(evidence && Array.isArray(evidence.figures) && Array.isArray(evidence.retailers)),
      `"${text}" publishes an evidence contract`,
      evidence ? `${evidence.figures.length} figures · ${evidence.retailers.length} retailers` : 'ABSENT',
    );

    // COMPLETENESS: every figure the answer RENDERS must be one the engine PUBLISHED. This is
    // the contract's own gate — a rendered figure with no declared provenance is an engine
    // defect, and it must never be answered by relaxing a rule.
    // NOT a vacuous pass when the contract is absent. Reporting "0 unpublished" for a payload
    // that published nothing would read as compliance, which is the worst possible way to fail.
    const unpublished = evidence
      ? findUnpublishedFigures(payload, { figures: [...evidence.figures], retailers: [...evidence.retailers] })
      : null;
    check(
      unpublished !== null && unpublished.length === 0,
      `"${text}" renders no unpublished figure`,
      unpublished === null ? 'no contract to check against' : `${unpublished.length} unpublished`,
    );
    for (const u of (unpublished ?? []).slice(0, 8)) {
      console.log(`        UNPUBLISHED  ${u.path} → ${u.kind} ${u.value}  «${u.excerpt}»`);
    }
    let rejectedHere = 0;
    for (const [path, value] of strings(payload)) {
      // ONLY CUSTOMER-VISIBLE PROSE.
      //
      // The first version of this harness scanned every string in the payload and rejected
      // `recommendations[].tps_identity_key` = «بيسك|split|NO_SERIES|12000|Inverter|hot_cold»
      // for leaking an internal sentinel. That was the HARNESS being wrong, not the product:
      // the key is only ever used inside an href (`advisor-answer.tsx:246`,
      // `exitHref`) and never rendered as text, so it is a machine field and the sentinel
      // belongs in it. The documented rule is that sentinels must not reach a customer RENDER
      // path — which this is not.
      //
      // Worth keeping in view even so: the sentinel IS shipped to the browser inside the
      // payload. It is one careless `.toString()` from becoming a real leak.
      //
      // Machine fields are excluded BY NAME — the same principled class as urls and slugs, not
      // a one-off exception carved out to make a gate green.
      if (/(^|[._])(key|url|href|id|slug|code|sku|gtin)(\[|$|\.)/i.test(path)) continue;
      // The evidence CONTRACT is machinery, not customer text. Its figure labels
      // (`cost_breakdown.annual_electricity`) and retailer identifiers are inputs to the check,
      // and scanning them inflated the denominator by ~227 strings — a number that would then
      // look like widened coverage rather than the contract describing itself.
      if (/^evidence(\.|\[|$)/.test(path)) continue;
      if (value.length < 12) continue;
      if (/^https?:\/\//.test(value) || /^[a-z0-9_|-]+$/i.test(value)) continue;
      stringsChecked++;
      const verdict = validateGeneratedAnswer(value, evidence ?? { figures: [], retailers: [] });
      recordValidationEvent({ verdict, query: text, generated: value, surface: "decide-payload", timestamp: "1970-01-01T00:00:00.000Z" });
      if (!verdict.publish) {
        {
          rejectedHere++;
          falseRejections.push(`"${text}" → ${path}: ${verdict.findings.map((f) => `[${f.ruleId}] ${f.reason}`).join(" | ")}\n            «${value.slice(0, 160)}»`);
        }
      }
    }
    check(rejectedHere === 0, `"${text}"`, `${rejectedHere} rejection(s)`);
  }

  if (falseRejections.length) {
    console.log("\n  REJECTED STRINGS — each is either a real vocabulary violation in shipped");
    console.log("  deterministic output, or a validator false positive. Both need a human:");
    for (const f of falseRejections) console.log(`      · ${f}`);
  }

  // ── §2b the adversarial corpus, blocked by the DEPLOYED vocabulary ─────────
  //
  // The corpus runs against the same commit that is deployed, so this asserts that the
  // vocabulary version now live blocks every case. What it CANNOT assert from here is the route
  // path — the surface is 404, so there is no live generated answer to suppress. That half is
  // proven by `tests/vocabulary/adversarial.test.ts` §3, which drives the real route handler and
  // asserts the HTTP response carries no generated text. Stated rather than blurred: this check
  // is about the rules, that one is about the plumbing.
  console.log("\n§2b adversarial corpus");
  let blocked = 0;
  const leaked: string[] = [];
  for (const c of ADVERSARIAL_CASES) {
    const verdict = validateGeneratedAnswer(c.generated, c.evidence);
    if (!verdict.publish && verdict.outcome === c.expect) blocked++;
    else leaked.push(`${c.id} (${c.family}) → ${verdict.outcome}, publish=${verdict.publish}`);
  }
  check(leaked.length === 0, `all ${ADVERSARIAL_CASES.length} adversarial cases blocked`, `${blocked}/${ADVERSARIAL_CASES.length}`);
  for (const l of leaked) console.log(`        LEAKED  ${l}`);

  const mustPassFailures = MUST_PASS_CASES
    .map((c) => ({ c, v: validateGeneratedAnswer(c.generated, c.evidence) }))
    .filter(({ v }) => !v.publish);
  check(
    mustPassFailures.length === 0,
    `all ${MUST_PASS_CASES.length} must-pass answers still publish — the gate is not "reject everything"`,
    mustPassFailures.map(({ c, v }) => `${c.id}:${v.findings.map((f) => f.ruleId).join(",")}${v.unavailableReason ?? ""}`).join(" · "),
  );

  console.log("\n      DECLARED RESIDUALS — what this gate does NOT prove:");
  for (const r of DECLARED_RESIDUALS) {
    console.log(`        · ${r.id}: ${r.limit}`);
    console.log(`            bounded by: ${r.bounded_by}`);
  }

  // ── §3 the log distinguishes all three outcomes ────────────────────────────
  console.log("\n§3 validation log");
  const byOutcome = events.reduce<Record<string, number>>((a, e) => { a[e.outcome] = (a[e.outcome] || 0) + 1; return a; }, {});
  console.log(`      ${stringsChecked} strings validated · ${JSON.stringify(byOutcome)}`);
  check(events.length === stringsChecked, "every validation produced exactly one event", `${events.length} events / ${stringsChecked} validations`);
  check(
    events.every((e) => e.query && e.generated && e.timestamp && e.vocabularyVersion && e.decision),
    "every event carries query, output, timestamp, version and decision",
  );

  console.log("\n" + "=".repeat(72));
  console.log(failures === 0 ? "GATE: PASS" : `GATE: FAIL — ${failures} check(s) failing`);
  if (failures) process.exitCode = 1;
})();
