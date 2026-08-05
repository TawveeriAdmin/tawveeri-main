// tests/admin/export-and-email-safety.test.ts — ADR-216 guardrails: the retailer CSV export
// must never carry personal/session data, and the daily founder email recipient must come from
// an env var, never a hardcoded address in source.
import { readFileSync } from "fs";
import { resolve } from "path";

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

// Strip // comments so doc lines explaining what's deliberately excluded (which necessarily
// name the excluded fields) don't trip the "never appears" checks below.
function readCode(relPath: string): string {
  return read(relPath).split("\n").map((l) => l.replace(/\/\/.*/, "")).join("\n");
}

describe("Retailer report CSV export carries no personal or session data", () => {
  const src = read("src/app/api/admin/retailer-report/export/route.ts");
  const code = readCode("src/app/api/admin/retailer-report/export/route.ts");

  it("requires admin auth", () => {
    expect(src).toMatch(/requireRequestAdmin/);
  });

  it("never writes session_id, phone, email, or a raw token into the CSV body", () => {
    expect(code).not.toMatch(/session_?[Ii]d/);
    expect(code).not.toMatch(/phone/i);
    expect(code).not.toMatch(/email/i);
    expect(code).not.toMatch(/\btoken\b/i);
  });

  it("only emits aggregated fields (counts/names/dates), not raw per-click rows", () => {
    expect(src).toMatch(/Qualified visits referred/);
    expect(src).toMatch(/report\.topProducts/);
    expect(src).not.toMatch(/outboundRows|realOutboundRows/); // raw row arrays never touch the CSV builder
  });
});

describe("Daily founder report recipient is never hardcoded", () => {
  it("the cron route reads the recipient from FOUNDER_DAILY_REPORT_EMAIL", () => {
    const src = read("src/app/api/cron/daily-founder-report/route.ts");
    expect(src).toMatch(/process\.env\.FOUNDER_DAILY_REPORT_EMAIL/);
    expect(src).not.toMatch(/info@tawveeri\.com['"]\s*;?\s*$/m); // no fallback literal recipient
  });

  it("requires Bearer CRON_SECRET auth, same convention as every other /api/cron/* route", () => {
    const src = read("src/app/api/cron/daily-founder-report/route.ts");
    expect(src).toMatch(/Bearer \$\{cronSecret\}/);
    expect(src).toMatch(/401/);
  });

  it("finishes and reports the gap instead of failing when SendGrid isn't configured", () => {
    const src = read("src/app/api/cron/daily-founder-report/route.ts");
    expect(src).toMatch(/SENDGRID_API_KEY is not configured/);
  });

  it(".env.example documents the var without a real address", () => {
    const src = read(".env.example");
    expect(src).toMatch(/FOUNDER_DAILY_REPORT_EMAIL=\s*$/m);
  });
});
