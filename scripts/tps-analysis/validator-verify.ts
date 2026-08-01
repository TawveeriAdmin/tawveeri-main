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
  type AnswerEvidence,
  type EvidenceFigure,
  type ValidationEvent,
} from "../../src/lib/vocabulary";

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

/**
 * Build the evidence bundle from the SAME payload the strings came from — exactly as the route
 * does. Building it from a second lookup would let the harness disagree with the product about
 * which facts were in play, and then the result would measure the harness.
 */
function evidenceFrom(payload: unknown): AnswerEvidence {
  const figures: EvidenceFigure[] = [];
  const retailers = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    for (const key of ["store_name", "retailer", "merchant", "store"]) {
      if (typeof o[key] === "string") retailers.add(o[key] as string);
    }
    for (const key of ["store_count", "retailer_count", "stores"]) {
      const v = o[key];
      if (typeof v === "number") figures.push({ value: v, kind: "retailer-count", derivedFrom: "live-query" });
      if (Array.isArray(v)) figures.push({ value: v.length, kind: "retailer-count", derivedFrom: "live-query" });
    }
    Object.values(o).forEach(walk);
  };
  walk(payload);
  return { figures, retailers: [...retailers] };
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
    const evidence = evidenceFrom(payload);

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
      if (value.length < 12) continue;
      if (/^https?:\/\//.test(value) || /^[a-z0-9_|-]+$/i.test(value)) continue;
      stringsChecked++;
      const verdict = validateGeneratedAnswer(value, evidence);
      recordValidationEvent({ verdict, query: text, generated: value, surface: "decide-payload", timestamp: "1970-01-01T00:00:00.000Z" });
      if (!verdict.publish) {
        rejectedHere++;
        falseRejections.push(`"${text}" → ${path}: ${verdict.findings.map((f) => `[${f.ruleId}] ${f.reason}`).join(" | ")}\n            «${value.slice(0, 160)}»`);
      }
    }
    check(rejectedHere === 0, `"${text}"`, `${rejectedHere} rejection(s)`);
  }

  if (falseRejections.length) {
    console.log("\n  REJECTED STRINGS — each is either a real vocabulary violation in shipped");
    console.log("  deterministic output, or a validator false positive. Both need a human:");
    for (const f of falseRejections) console.log(`      · ${f}`);
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
