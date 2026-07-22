/**
 * Revenue-Neutrality Separation Audit — static regression guard.
 *
 * Constitution: "Commercial interest never enters ranking." (ADR-043 Merchant
 * Independence · ADR-044 ranking-blind Revenue Graph.)
 *
 * This test proves the guarantee mechanically, with NO DB and NO network: it reads
 * the ranking/recommendation SOURCE FILES as strings and asserts they contain zero
 * data references to the Revenue Graph — `outbound_clicks`, `affiliate`, `commission`,
 * `revenue`. Ranking may only read: identity_key / suitability, store_count (trust /
 * corroboration), price / total cost, identity_confidence.
 *
 * The word "commission" DOES appear in the ranking files — but ONLY inside comments and
 * response-string literals that ASSERT its absence ("never commission", "no commission").
 * Those are non-executable text, not field reads, so we strip comments + string literals
 * before asserting on executable code. A positive control confirms the Revenue Graph
 * terms DO live in the downstream `/go` exit route — proving the boundary is real and
 * one-way (ranking → outcome → revenue, never back). See docs/REVENUE-NEUTRALITY-AUDIT.md.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");

// The complete set of ranking / recommendation code paths under audit.
const RANKING_FILES: Record<string, string> = {
  "tps/search (hybrid search)": "src/app/api/v1/tps/search/route.ts",
  "tps/recommendations (recommender)": "src/app/api/v1/tps/recommendations/route.ts",
  "agent/decide (Stage-1 agent route)": "src/app/api/v1/agent/decide/route.ts",
  "agent/decision-engine (Stage-1 core)": "src/lib/agent/decision-engine.ts",
};

// The downstream revenue / attribution path (the ONLY place these terms may live).
const REVENUE_FILE = "src/app/go/[offerId]/route.ts";

// Forbidden in ranking: any read of Revenue-Graph / commission signals.
const FORBIDDEN = ["outbound_clicks", "affiliate", "commission", "revenue"];

/** Remove block comments, line comments, then string/template literals — leaving only
 *  executable code, so an assertion targets real field reads, not prose that denies them. */
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments  /* ... */
    .replace(/\/\/[^\n]*/g, " ")        // line comments   // ...
    .replace(/`(?:\\.|[^`\\])*`/g, " ") // template literals
    .replace(/"(?:\\.|[^"\\])*"/g, " ") // double-quoted strings
    .replace(/'(?:\\.|[^'\\])*'/g, " "); // single-quoted strings
}

const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("Revenue-Neutrality Separation Audit — ranking is architecturally ranking-blind", () => {
  describe("no Revenue-Graph term is READ in ranking executable code", () => {
    for (const [label, rel] of Object.entries(RANKING_FILES)) {
      describe(label, () => {
        const code = stripCommentsAndStrings(read(rel));
        for (const term of FORBIDDEN) {
          it(`does not read \`${term}\``, () => {
            expect(code).not.toMatch(new RegExp(term, "i"));
          });
        }
      });
    }
  });

  describe("no Revenue-Graph field name appears ANYWHERE in ranking source (even in prose)", () => {
    // `outbound_clicks`, `affiliate`, `revenue` never appear in ranking files at all —
    // not even in comments. Guard the raw source so a stray reference fails loudly.
    const RAW_FORBIDDEN = ["outbound_clicks", "affiliate", "revenue"];
    for (const [label, rel] of Object.entries(RANKING_FILES)) {
      const raw = read(rel);
      for (const term of RAW_FORBIDDEN) {
        it(`${label}: raw source is free of \`${term}\``, () => {
          expect(raw).not.toMatch(new RegExp(term, "i"));
        });
      }
    }
  });

  describe("ranking reads only neutral signals (identity / trust / price / confidence)", () => {
    it("search + recommendations rank on store_count (corroboration) and price", () => {
      const search = read(RANKING_FILES["tps/search (hybrid search)"]);
      const recs = read(RANKING_FILES["tps/recommendations (recommender)"]);
      expect(search).toMatch(/store_count/);
      expect(search).toMatch(/order\(['"]store_count['"]/); // fallback ordering by trust
      expect(recs).toMatch(/store_count/);
      expect(recs).toMatch(/identity_confidence/);
    });
    it("decision engine ranks on suitability + store_count + total cost only", () => {
      const eng = read(RANKING_FILES["agent/decision-engine (Stage-1 core)"]);
      expect(eng).toMatch(/store_count/);          // trust / corroboration
      expect(eng).toMatch(/lowest_price/);         // price / total cost
      expect(eng).toMatch(/suitability_score/);    // deterministic suitability
      expect(eng).toMatch(/identity_confidence/);  // confidence, never fabricated
    });
  });

  describe("positive control — the Revenue Graph lives DOWNSTREAM in /go, never in ranking", () => {
    const go = read(REVENUE_FILE);
    it("/go records the measured exit into outbound_clicks", () => {
      expect(go).toMatch(/outbound_clicks/);
    });
    it("/go applies affiliate tags (the revenue signal ranking must never see)", () => {
      expect(go).toMatch(/affiliate/i);
      expect(go).toMatch(/AFFILIATE_RULES/);
    });
    it("no ranking file imports the /go route or normalizeStoreUrl affiliate path", () => {
      for (const rel of Object.values(RANKING_FILES)) {
        const raw = read(rel);
        expect(raw).not.toMatch(/from ['"][^'"]*\/go\//);
        expect(raw).not.toMatch(/AFFILIATE_RULES/);
      }
    });
  });
});
