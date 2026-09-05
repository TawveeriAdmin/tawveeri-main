// tests/admin/metric-wording-consistency.test.ts — ADR-286 metric-language consistency closeout.
// Structural contract checks (same convention as tests/go/go-route-contract.test.ts and
// tests/admin/command-center-wording.test.ts) against the actual source of every founder/
// merchant-facing surface that used to describe a RAW outbound_clicks row count as "confirmed"
// (تحويلات/خروج مؤكد). Locks in that: raw request counts are worded as recorded/operational
// everywhere they're shown; the Command Center's decision-grade primary metric stays wired;
// genuinely network-sourced "confirmed" language (affiliate conversions/commission) is left
// alone, since that IS a stronger evidence source and the word is accurate there; and
// Campaign V1 — a wholly separate token+POST contract — was never touched by this pass.
import fs from "fs";
import path from "path";

function read(p: string): string {
  return fs.readFileSync(path.join(process.cwd(), p), "utf8");
}

const dailyReport = read("src/lib/admin/daily-report.ts");
const retailerQueries = read("src/lib/admin/retailer-report-queries.ts");
const retailerPage = read("src/app/[locale]/admin/retailer-report/page.tsx");
const retailerExport = read("src/app/api/admin/retailer-report/export/route.ts");
const opportunities = read("src/lib/admin/opportunities.ts");
const commandCenterPage = read("src/app/[locale]/admin/command-center/page.tsx");
const commandCenterQueries = read("src/lib/admin/command-center-queries.ts");
const transactionsPage = read("src/app/[locale]/admin/transactions/page.tsx");
const dashboardPage = read("src/app/[locale]/admin/dashboard/page.tsx");
const campaignCard = read("src/components/campaigns/campaign-card.tsx");

describe("1 — Command Center primary metric remains decision-grade (regression against the prior pass)", () => {
  it("still binds its headline value to commercial.explicitRetailerInteractions, sourced from getDecisionGradeOutboundStats", () => {
    expect(commandCenterPage).toMatch(/value:\s*commercial\.explicitRetailerInteractions/);
    expect(commandCenterQueries).toMatch(/getDecisionGradeOutboundStats\(fetchRange\.start, fetchRange\.end\)/);
  });
});

describe("2 — the daily founder report cannot label raw /go rows 'confirmed'", () => {
  it("no longer contains 'تحويلات مؤكدة للمتاجر' or 'تحويلة مؤكدة' anywhere in its visible strings", () => {
    expect(dailyReport).not.toMatch(/تحويلات مؤكدة/);
    expect(dailyReport).not.toMatch(/تحويلة مؤكدة/);
  });

  it("uses neutral 'مسجّلة' (recorded) wording for the raw commercial.confirmedRetailerRedirects figure", () => {
    expect(dailyReport).toMatch(/طلبات \/go مسجّلة \(تشغيلي\)/);
    // ADR-292: "تحويلة" ("transfer") retired — live-confirmed a founder reading "X تحويلة
    // مسجّلة عبر Y منتجاً" (opportunities.ts) as "conversion" despite the correct "مسجّلة"
    // qualifier, because the word itself is linguistically adjacent to "تحويل" (financial
    // conversion). "نقرة خروج" ("exit click") is the same term command-center/page.tsx
    // already uses for this identical concept — one word across every founder surface.
    expect(dailyReport).toMatch(/نقرة خروج مسجّلة/);
    expect(dailyReport).not.toMatch(/تحويلة مسجّلة/);
  });

  it("wires the decision-grade explicitRetailerInteractions figure into the same report, when available for the window (getCommandCenterData computes it for every period, including 'yesterday')", () => {
    expect(dailyReport).toMatch(/تفاعلات متجر صريحة \(دقيقة القرار\)/);
    expect(dailyReport).toMatch(/commercial\.explicitRetailerInteractions/);
  });
});

describe("3 — the retailer partnership report cannot label raw /go rows as confirmed customer interactions", () => {
  it("the on-screen headline card no longer says 'تحويلات مؤكدة' / 'Confirmed redirects'", () => {
    expect(retailerPage).not.toMatch(/label:\s*isRTL \? 'تحويلات مؤكدة'/);
    expect(retailerPage).not.toMatch(/label:\s*isRTL \? '.*' : 'Confirmed redirects'/);
    expect(retailerPage).toMatch(/label:\s*isRTL \? 'عمليات انتقال مسجّلة إلى المتجر' : 'Recorded retailer redirects'/);
  });

  it("the CSV export sent to founders/merchants no longer contains the literal 'Confirmed retailer redirects' column", () => {
    expect(retailerExport).not.toMatch(/Confirmed retailer redirects/);
    expect(retailerExport).toMatch(/Recorded retailer redirects/);
  });

  it("the deterministic narrative sentence (buildRetailerNarrative) never emits 'مؤكدة' / 'confirmed' language for redirects", () => {
    expect(retailerQueries).not.toMatch(/تحويلة مؤكدة/);
    expect(retailerQueries).not.toMatch(/إحالة مؤكدة/);
    expect(retailerQueries).not.toMatch(/confirmed redirects to \$\{name\}/);
    expect(retailerQueries).not.toMatch(/\$\{report\.confirmedRedirects\} confirmed redirects\)/);
  });

  it("the known-limitations disclosure explicitly states the metric is operational, not proof of customer interaction", () => {
    expect(retailerQueries).toMatch(/Recorded retailer redirects count \/go requests only \(server-recorded, operational evidence — not proof of customer interaction\)/);
  });

  it("does not fabricate a merchant-specific decision-grade figure via fuzzy/session/timestamp correlation — no new correlation logic was added to this file", () => {
    expect(retailerQueries).not.toMatch(/nearest.?timestamp/i);
    expect(retailerQueries).not.toMatch(/explicitRetailerInteractions/); // scope: wording-only fix, per-retailer decision-grade attribution deliberately not added this pass
  });
});

describe("4 — raw /go evidence remains available where operationally useful (never deleted, only relabeled)", () => {
  it("Command Center still surfaces the raw request count as a secondary diagnostic note", () => {
    expect(commandCenterPage).toMatch(/طلبات \/go مسجّلة: \$\{commercial\.confirmedRetailerRedirects\}/);
  });

  it("the daily report still shows the raw /go request count, just demoted and neutrally worded", () => {
    expect(dailyReport).toMatch(/commercial\.confirmedRetailerRedirects/);
  });

  it("the retailer report still exposes the raw redirect count (renamed label, same underlying value)", () => {
    expect(retailerPage).toMatch(/value:\s*report\.confirmedRedirects/);
    expect(retailerExport).toMatch(/report\.confirmedRedirects/);
  });

  it("opportunities.ts still surfaces the raw redirect count as evidence, worded as recorded not confirmed", () => {
    // ADR-292: "تحويلة" → "نقرة خروج" — see the daily-report.ts test above for the live-
    // confirmed misreading this corrects (a founder read "255 تحويلة مسجّلة" as "conversion").
    expect(opportunities).toMatch(/\$\{r\.confirmedRedirects\} نقرة خروج مسجّلة/);
    expect(opportunities).toMatch(/\$\{r\.confirmedRedirects\} recorded redirects/);
    expect(opportunities).not.toMatch(/تحويلة مؤكدة/);
    expect(opportunities).not.toMatch(/تحويلة مسجّلة/);
    expect(opportunities).not.toMatch(/confirmed redirects/);
    expect(opportunities).not.toMatch(/confirmed referrals/);
  });

  it("the founder Commercial-truth surfaces (dashboard + transactions) still show the raw exit count, worded as recorded", () => {
    expect(dashboardPage).toMatch(/خروج مسجّل منذ الأساس/);
    expect(transactionsPage).toMatch(/خروج مسجّل \(7 أيام\)/);
    expect(transactionsPage).toMatch(/خروج مسجّل منذ الأساس/);
    expect(transactionsPage).not.toMatch(/'خروج مؤكد/);
  });
});

describe("5 — decision-grade evidence and raw operational evidence remain visibly separate, never merged into one number", () => {
  it("Command Center: explicit-interaction value and the raw-request note are distinct strings/fields, not summed", () => {
    const valueIdx = commandCenterPage.indexOf("value: commercial.explicitRetailerInteractions");
    const rawNoteIdx = commandCenterPage.indexOf("commercial.confirmedRetailerRedirects} — قياس تشغيلي");
    expect(valueIdx).toBeGreaterThan(-1);
    expect(rawNoteIdx).toBeGreaterThan(-1);
    expect(valueIdx).not.toBe(rawNoteIdx);
  });

  it("daily report: the decision-grade stat row and the raw-request stat row are two separate <tr> rows, not one blended figure", () => {
    const explicitRowIdx = dailyReport.indexOf("تفاعلات متجر صريحة (دقيقة القرار)', String(commercial.explicitRetailerInteractions)");
    const rawRowIdx = dailyReport.indexOf("طلبات /go مسجّلة (تشغيلي)', String(commercial.confirmedRetailerRedirects)");
    expect(explicitRowIdx).toBeGreaterThan(-1);
    expect(rawRowIdx).toBeGreaterThan(-1);
    expect(rawRowIdx).toBeGreaterThan(explicitRowIdx); // decision-grade row precedes the demoted raw row
  });

  it("the retailer partnership report intentionally shows ONLY the raw operational metric (no decision-grade figure was fabricated for a per-merchant breakdown this pass)", () => {
    expect(retailerPage).not.toMatch(/explicitRetailerInteractions|explicitInteractions/);
    expect(retailerExport).not.toMatch(/explicitRetailerInteractions|explicitInteractions/);
  });
});

describe("6 — no affiliate conversion/commission language was altered incorrectly (that evidence IS network-sourced and 'confirmed' is accurate there)", () => {
  it("transactions page keeps 'تحويلات مؤكدة من الشبكات' / 'Network-confirmed conversions' unchanged — legitimately confirmed by the affiliate network, not a raw ledger row", () => {
    expect(transactionsPage).toMatch(/تحويلات مؤكدة من الشبكات/);
    expect(transactionsPage).toMatch(/Network-confirmed conversions/);
  });

  it("transactions page keeps 'العمولة المؤكدة' / 'Confirmed commission' unchanged in the attribution note", () => {
    expect(transactionsPage).toMatch(/العمولة المؤكدة تظهر فقط بعد استيراد تقرير شبكة العمولة/);
    expect(transactionsPage).toMatch(/Confirmed commission appears only after an affiliate-network report import/);
  });

  it("opportunities.ts keeps its existing 'no confirmed conversion/revenue evidence exists yet' wording unchanged — an honest negative claim, not an overclaim", () => {
    expect(opportunities).toMatch(/لا يوجد بعد دليل تحويل\/إيراد مؤكد/);
    expect(opportunities).toMatch(/no confirmed conversion\/revenue evidence exists yet/);
  });
});

describe("7 — Campaign V1 remains completely unchanged by this wording pass", () => {
  it("campaign-card.tsx still uses its own separate sendClickBeacon contract, never the general interaction module or any of this pass's new field names", () => {
    expect(campaignCard).toMatch(/sendClickBeacon/);
    expect(campaignCard).not.toMatch(/from ['"]@\/lib\/analytics\/interaction['"]/);
    expect(campaignCard).not.toMatch(/explicitRetailerInteractions|correlatedMerchantNavigations|confirmedRetailerRedirects/);
  });
});
