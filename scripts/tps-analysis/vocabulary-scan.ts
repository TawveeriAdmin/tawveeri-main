// scripts/tps-analysis/vocabulary-scan.ts
// ─────────────────────────────────────────────────────────────────────────────
// VOCABULARY SCAN — F7·1's acceptance test against the live product.
//
// A vocabulary module that agrees with a document but disagrees with the shipped product is a
// governance artefact describing a site that does not exist. This runs the customer vocabulary
// against TWO populations:
//
//   1. the SHIPPED TRANSLATION BUNDLES — every string in `messages/{ar,en}/*.json`, which is
//      where a claim actually lives before it is rendered;
//   2. the RENDERED TEXT of the live customer surfaces, both locales — which is what a person
//      reads, and the only place a claim assembled at runtime can be seen.
//
// WHAT THIS IS NOT. It is not F7·2. It does not look at generated text and it compares nothing
// against structured evidence. It answers one question — "does the language we already ship
// violate the vocabulary we just wrote down?" — and prints, every run, the rules no text scan
// can decide, so a clean result is never mistaken for full coverage.
//
//   npx tsx scripts/tps-analysis/vocabulary-scan.ts
//   npx tsx scripts/tps-analysis/vocabulary-scan.ts --base https://tawveeri.com
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  checkCustomerText,
  findInternalLeaks,
  EVIDENCE_REQUIRED_RULES,
  OPERATOR_BUNDLES,
  PENDING_COPY_DECISIONS,
  PENDING_KEYS,
  VOCABULARY_VERSION,
  vocabularyFingerprint,
  type Violation,
} from "../../src/lib/vocabulary";

const BASE = (() => {
  const i = process.argv.indexOf("--base");
  return i >= 0 ? process.argv[i + 1].replace(/\/$/, "") : "http://localhost:3000";
})();

const SURFACES: Array<[string, string]> = [
  ["home", "/{L}"],
  ["search", "/{L}/search?q=laptop"],
  ["deals", "/{L}/deals"],
  ["stores", "/{L}/stores"],
  ["categories", "/{L}/categories"],
  ["coupons", "/{L}/coupons"],
  ["compare", "/{L}/compare/" + encodeURIComponent("apple|iPhone|15|Standard|128")],
  ["404", "/{L}/this-route-does-not-exist-xyz"],
];

let failures = 0;
function report(label: string, violations: Violation[], leaks: Violation[]) {
  const bad = violations.length + leaks.length;
  if (bad) failures += bad;
  console.log(`${bad ? "FAIL" : "PASS"}  ${label}${bad ? `  — ${bad} finding(s)` : ""}`);
  for (const v of violations) console.log(`        claim   [${v.ruleId}] "${v.match}"  (${v.source.section})`);
  for (const v of leaks) console.log(`        leak    [${v.ruleId}] …${v.match}…`);
}

/** Every leaf string in a JSON tree, with its dotted key path. */
function* strings(node: unknown, path = ""): Generator<[string, string]> {
  if (typeof node === "string") { yield [path, node]; return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      yield* strings(v, path ? `${path}.${k}` : k);
    }
  }
}

async function renderedText(path: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const html = await res.text();
  const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || ["", ""])[1];
  // Scripts and templates carry the RSC payload — internal prop and column names BY DESIGN.
  // Scanning them would report a leak on every page. Only what a customer reads counts.
  return {
    status: res.status,
    text: body
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<template[\s\S]*?<\/template>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

(async () => {
  console.log(`\nVOCABULARY SCAN — ${BASE}`);
  console.log(`vocabulary ${VOCABULARY_VERSION} · fingerprint ${vocabularyFingerprint()}`);
  console.log("=".repeat(72) + "\n");

  // ── 1. SHIPPED TRANSLATION BUNDLES ─────────────────────────────────────────
  //
  // Findings are CLASSIFIED, not lumped together — because "9 findings" and "3 findings that a
  // customer can actually read today" are different facts and only the second is actionable:
  //
  //   live-customer   → gate-failing, unless carried in PENDING_COPY_DECISIONS with a reason
  //   latent          → zero references in `src/`; §5's own reasoning, derived here from the
  //                     repository rather than asserted
  //   operator        → `store.json` / `admin.json` — not a customer surface
  //
  // "Latent" errs toward LIVE: a key is latent only when its leaf name appears NOWHERE in the
  // source tree. Mislabelling a live string as latent would hide a real violation, so the
  // classification is deliberately biased against itself.
  console.log("§1 shipped translation bundles (messages/{ar,en}/*.json)");
  // Liveness is decided on the LOOKUP PATH, not the leaf name. The first version of this check
  // searched the leaf, and `landing.json:features.instant.description` searched for
  // "description" — which appears in hundreds of files — so §5's documented dead copy was
  // classified LIVE. A generic leaf name makes a leaf search meaningless.
  //
  // A key counts as referenced if its full dotted path OR its parent path appears anywhere in
  // `src/`. Any partial reference marks it live: the bias must be toward live, because
  // mislabelling live copy as latent hides a real violation.
  const grepHits = (needle: string): boolean => {
    if (needle.length < 6) return true; // too short to search safely — assume live
    try {
      execFileSync("git", ["grep", "-l", "--fixed-strings", needle, "--", "src"], { stdio: "pipe" });
      return true;
    } catch {
      return false; // git grep exits 1 on no match
    }
  };
  const refCache = new Map<string, boolean>();
  const isReferenced = (file: string, key: string): boolean => {
    const namespace = file.replace(/\.json$/, "");
    const parent = key.split(".").slice(0, -1).join(".");
    const candidates = [key, `${namespace}.${key}`, parent, parent ? `${namespace}.${parent}` : ""]
      .filter((c) => c.length > 0);
    for (const c of candidates) {
      if (!refCache.has(c)) refCache.set(c, grepHits(c));
      if (refCache.get(c)) return true;
    }
    return false;
  };

  let stringsChecked = 0;
  const liveCustomer: Violation[] = [];
  const acknowledged: Violation[] = [];
  const latent: Violation[] = [];
  const operator: Violation[] = [];
  const matchedPendingKeys = new Set<string>();
  const allLeaks: Violation[] = [];

  for (const locale of ["ar", "en"]) {
    const dir = join(process.cwd(), "messages", locale);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
      for (const [key, value] of strings(json)) {
        stringsChecked++;
        const where = `${file}:${key}`;
        for (const v of findInternalLeaks(value)) allLeaks.push({ ...v, match: `${locale}/${where} → ${v.match}` });
        for (const v of checkCustomerText(value)) {
          const tagged = { ...v, match: `${locale}/${where} → ${v.match}` };
          if (OPERATOR_BUNDLES.has(file)) operator.push(tagged);
          else if (PENDING_KEYS.has(where)) { matchedPendingKeys.add(where); acknowledged.push(tagged); }
          else if (!isReferenced(file, key)) latent.push(tagged);
          else liveCustomer.push(tagged);
        }
      }
    }
  }
  report(`live customer copy (${stringsChecked} strings checked)`, liveCustomer, allLeaks);

  const show = (label: string, list: Violation[]) => {
    console.log(`      ${label}: ${list.length}`);
    for (const v of list) console.log(`        · [${v.ruleId}] ${v.match}`);
  };
  show("latent — zero references in src/, §5", latent);
  show("operator surface — outside the customer vocabulary", operator);

  // Acknowledged findings are printed on EVERY run, including a passing one.
  console.log(`\n      awaiting a wording decision (F1) — ${PENDING_COPY_DECISIONS.length} entr(ies), NOT resolved:`);
  for (const p of PENDING_COPY_DECISIONS) {
    console.log(`        · ${p.where}  [${p.ruleId}]  owner: ${p.owner}`);
    console.log(`            ar «${p.shipped.ar}»  ·  en "${p.shipped.en}"`);
  }

  // A stale acknowledgement is how a debt register quietly becomes a suppression list.
  const stale = [...PENDING_KEYS].filter((k) => !matchedPendingKeys.has(k));
  if (stale.length) {
    failures += stale.length;
    console.log(`\nFAIL  stale acknowledgement(s) — the copy changed; delete these entries:`);
    for (const k of stale) console.log(`        · ${k}`);
  }
  console.log("");

  // ── 2. LIVE CUSTOMER SURFACES ──────────────────────────────────────────────
  //
  // READ THE CHARACTER COUNTS. Most surfaces are client-rendered, so the SERVED text is a
  // fraction of what a customer eventually sees — `/ar` returns ~1.4k characters, not the full
  // page. §2 is therefore a real but PARTIAL check, and §1 is the stronger population: all copy
  // originates in the bundles. A clean §2 is not evidence that the rendered page is clean.
  console.log("§2 rendered customer surfaces  (server-rendered text only — see note in source)");
  for (const locale of ["ar", "en"]) {
    for (const [name, tpl] of SURFACES) {
      const { status, text } = await renderedText(tpl.replace("{L}", locale));
      if (!text) { console.log(`SKIP  ${locale} ${name}  — no rendered text (status ${status})`); continue; }
      report(`${locale} ${name} (${status}, ${text.length} chars)`, checkCustomerText(text), findInternalLeaks(text));
    }
  }

  // ── 3. WHAT THIS SCAN CANNOT DECIDE ────────────────────────────────────────
  // Printed every run, never silently omitted. A clean scan is not full coverage.
  console.log("\n§3 NOT decidable by any text scan — F7·2 must resolve these against evidence");
  for (const r of EVIDENCE_REQUIRED_RULES) {
    console.log(`  ·  ${r.id}${r.codeAuthority ? `  → enforced in code: ${r.codeAuthority}` : ""}`);
  }

  console.log("\n" + "=".repeat(72));
  console.log(failures === 0 ? "GATE: PASS — 0 vocabulary findings" : `GATE: FAIL — ${failures} finding(s)`);
  if (failures) process.exitCode = 1;
})();
