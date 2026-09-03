// tests/admin/command-center-wording.test.ts — ADR-286 founder metric wording fix.
// Structural contract checks (same convention as tests/go/go-route-contract.test.ts) against
// the actual page/query source — the Command Center headline used to bind a RAW outbound_clicks
// row count to a "confirmed" label, overclaiming proof of customer interaction. This locks in
// that the decision-grade first_party_interactions count is now the headline, the raw count is
// demoted to a neutrally-worded diagnostic note, and the correlated subset is shown separately.
import fs from "fs";
import path from "path";

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/[locale]/admin/command-center/page.tsx"),
  "utf8"
);
const querySource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/admin/command-center-queries.ts"),
  "utf8"
);

describe("Command Center headline — uses ADR-286 decision-grade firstPartyInteractions, not a raw count", () => {
  it("the query layer wires the decision-grade read contract in, not a re-derived heuristic", () => {
    expect(querySource).toMatch(/import \{ getDecisionGradeOutboundStats \} from ['"]\.\/decision-grade-queries['"]/);
    expect(querySource).toMatch(/getDecisionGradeOutboundStats\(fetchRange\.start, fetchRange\.end\)/);
  });

  it("commercial.explicitRetailerInteractions is populated from decisionGrade.firstPartyInteractions, never fabricated as non-null", () => {
    expect(querySource).toMatch(
      /explicitRetailerInteractions:\s*decisionGrade\.firstPartyInteractions\.value \?\? 0/
    );
  });

  it("commercial.correlatedMerchantNavigations is populated from decisionGrade.merchantNavigationsCorrelated", () => {
    expect(querySource).toMatch(
      /correlatedMerchantNavigations:\s*decisionGrade\.merchantNavigationsCorrelated\.value \?\? 0/
    );
  });

  it("the page's primary headline card binds its value to commercial.explicitRetailerInteractions, labeled 'Explicit retailer interactions'", () => {
    expect(pageSource).toMatch(/label:\s*isRTL \? 'تفاعلات متجر صريحة' : 'Explicit retailer interactions'/);
    expect(pageSource).toMatch(/value:\s*commercial\.explicitRetailerInteractions/);
  });
});

describe("the old raw-count label is gone from the founder-facing headline", () => {
  it("'تحويلات مؤكدة للمتاجر' / 'Confirmed retailer redirects' no longer appears as an actual rendered label binding", () => {
    // Still permitted to appear inside an explanatory `//` comment (documenting the wording fix
    // itself) — what must be gone is the `label: ... 'تحويلات مؤكدة للمتاجر'` binding that used
    // to attach it to commercial.confirmedRetailerRedirects as the primary headline.
    expect(pageSource).not.toMatch(/label:\s*isRTL \? 'تحويلات مؤكدة للمتاجر'/);
    expect(pageSource).not.toMatch(/label:\s*isRTL \? '.*' : 'Confirmed retailer redirects'/);
  });

  it("commercial.confirmedRetailerRedirects (the raw row count) is no longer bound to any card's primary `value` field", () => {
    expect(pageSource).not.toMatch(/value:\s*commercial\.confirmedRetailerRedirects/);
  });
});

describe("raw /go request volume is demoted to a neutrally-worded operational note, not a confirmed headline", () => {
  it("the raw count is only referenced inside the notes array, worded as operational and NOT proof of interaction", () => {
    expect(pageSource).toMatch(
      /طلبات \/go مسجّلة: \$\{commercial\.confirmedRetailerRedirects\} — قياس تشغيلي، لا يثبت تفاعل عميل/
    );
    expect(pageSource).toMatch(
      /Recorded \/go requests: \$\{commercial\.confirmedRetailerRedirects\} — operational metric, not proof of customer interaction/
    );
  });

  it("the demoted raw-count note never uses 'confirmed click', 'confirmed interaction', 'confirmed conversion', or 'customer traction'", () => {
    const rawNoteEnLine = pageSource
      .split("\n")
      .find((l) => l.includes("Recorded /go requests:"));
    expect(rawNoteEnLine).toBeDefined();
    const forbidden = ["confirmed click", "confirmed interaction", "confirmed conversion", "customer traction"];
    for (const phrase of forbidden) {
      expect(rawNoteEnLine!.toLowerCase()).not.toContain(phrase);
    }
  });

  it("the raw metric keeps its CONFIRMED (data-confidence, not interaction-proof) badge definition, now explicitly disclaiming interaction proof", () => {
    expect(querySource).toMatch(
      /outbound:\s*\{\s*state:\s*'CONFIRMED',\s*note:\s*'[^']*not proof of customer interaction[^']*'/
    );
  });
});

describe("correlated merchant navigation is shown separately from the explicit-interaction count, never merged into one number", () => {
  it("the page renders a distinct supporting line naming the correlated subset via /go", () => {
    expect(pageSource).toMatch(
      /\$\{commercial\.correlatedMerchantNavigations\} منها مرتبطة بخروج فعلي للمتجر عبر \/go/
    );
    expect(pageSource).toMatch(
      /\$\{commercial\.correlatedMerchantNavigations\} correlate to a server-recorded merchant navigation via \/go/
    );
  });

  it("explicitRetailerInteractions and correlatedMerchantNavigations are distinct fields (correlation is never blended into the headline number itself)", () => {
    const interactionsIdx = pageSource.indexOf("value: commercial.explicitRetailerInteractions");
    const correlatedIdx = pageSource.indexOf("commercial.correlatedMerchantNavigations");
    expect(interactionsIdx).toBeGreaterThan(-1);
    expect(correlatedIdx).toBeGreaterThan(-1);
    expect(correlatedIdx).not.toBe(interactionsIdx);
  });
});

describe("decision-grade confidence definition documents what the number does and does not prove", () => {
  it("METRIC_CONFIDENCE.explicitInteractions cites ADR-286 and the real-onClick requirement", () => {
    expect(querySource).toMatch(
      /explicitInteractions:\s*\{\s*state:\s*'CONFIRMED',\s*note:\s*'ADR-286 decision-grade:[^']*real onClick[^']*'/
    );
  });
});
