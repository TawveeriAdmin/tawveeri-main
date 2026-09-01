// scripts/tps-analysis/measurement-sanity.ts
// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY MEASUREMENT SANITY CHECK (ADR-282 — September 2026 measurement-trust program).
//
// The August 2026 founder review (docs/report/AUGUST-2026-FOUNDER-REVIEW.md) found TWO
// previously-undocumented measurement defects purely by comparing session counts against
// event/redirect counts by hand: a client-side search-event repeat-fire bug (§15, now fixed,
// ADR-282) and a same-day redirect anomaly with no matching browse activity (§12, Aug 31).
// Both were found only because someone happened to look. This script makes that look
// routine — read-only, deterministic, reusable every week (or every day), never rewrites
// history, never blocks a deploy. Exits non-zero only on a real FAIL so it CAN gate CI if
// the founder ever wants that, but is designed first as a human-readable report.
//
// Two things it does NOT do:
//   - It never touches usage_events/outbound_clicks rows (pure SELECT).
//   - It never guesses a threshold from nowhere — every threshold below is either derived
//     from a REAL distribution measured on this same production data (see comments) or
//     flagged explicitly as a starting placeholder to be tightened once more weeks of
//     data exist.
//
// Usage:
//   npm run tps:sanity                    -- last 7 days (default operating window)
//   npm run tps:sanity -- --days=1        -- yesterday only (daily spot-check)
//   npm run tps:sanity -- --from=2026-08-01 --to=2026-09-01   -- explicit window (e.g. the
//                                             clean-baseline re-derivation for a closed month)
// ─────────────────────────────────────────────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
import { Client } from "pg";
import { toPoolerDbUrl } from "../tps-core/pooler-url";
import { parseShoppingTask } from "../../src/lib/agent/task-parser";
import {
  buildFunnel, buildSessionFunnel, qualifiedReferredSessions, topSessionSearchShare,
  type UsageEventRow, type OutboundClickRow,
} from "../../src/lib/admin/command-center-queries";
import { isKnownBotUserAgent } from "../../src/lib/analytics/bot-detection";

type Level = "PASS" | "WATCH" | "FAIL";
interface Check { area: string; check: string; level: Level; detail: string; evidence?: string }
const checks: Check[] = [];
const add = (c: Check) => { checks.push(c); };

// ── CLI window ──────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const RIYADH = "+03:00";
const now = new Date();
let start: Date, end: Date, windowLabel: string;
if (arg("from") || arg("to")) {
  start = new Date(`${arg("from") ?? "2026-01-01"}T00:00:00${RIYADH}`);
  end = new Date(`${arg("to") ?? new Date().toISOString().slice(0, 10)}T00:00:00${RIYADH}`);
  windowLabel = `${arg("from")} → ${arg("to")}`;
} else {
  const days = Number(arg("days") ?? 7);
  end = now;
  start = new Date(now.getTime() - days * 86_400_000);
  windowLabel = `last ${days} day(s)`;
}

(async () => {
  const url = toPoolerDbUrl(process.env.SUPABASE_DB_URL!);
  if (!url.includes("vyceqrzttspyycdpojtn")) { console.error("NOT PRODUCTION — aborting"); process.exit(1); }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = async (s: string, p: unknown[] = []) => (await c.query(s, p)).rows as Record<string, unknown>[];

  const evRows = (await c.query(
    `select event_type, session_id, is_test, source, category, query_text, canonical_id, created_at, meta, user_agent
     from usage_events where created_at >= $1 and created_at < $2 order by created_at asc`,
    [start.toISOString(), end.toISOString()]
  )).rows as (UsageEventRow & { user_agent?: string })[];
  const obRows = (await c.query(
    `select is_test, canonical_product_id, affiliate_program, store_name, clicked_at, session_id, campaign, source, user_agent, referrer
     from outbound_clicks where clicked_at >= $1 and clicked_at < $2 order by clicked_at asc`,
    [start.toISOString(), end.toISOString()]
  )).rows as (OutboundClickRow & { user_agent?: string; referrer?: string })[];

  const real = evRows.filter((e) => !e.is_test);
  const obReal = obRows.filter((o) => !o.is_test);

  // ═══ CHECK 1 — same event/query unexpectedly repeated within one session ═══════════════
  // Threshold derived from the actual August incident (docs/report/…#15): the smallest
  // confirmed bug burst was 150 identical fires in under 5 minutes. FAIL well below that
  // (20+ in 5 min) so a NEW instance of this bug class is caught long before it reaches
  // August's scale; WATCH catches a milder version worth a human glance.
  {
    const bySessionQuery = new Map<string, number[]>(); // key: session|type|query -> sorted epoch-ms
    for (const e of real) {
      if (!e.session_id || !e.query_text) continue;
      const k = `${e.session_id}|${e.event_type}|${e.query_text}`;
      const arr = bySessionQuery.get(k) ?? [];
      arr.push(new Date(e.created_at).getTime());
      bySessionQuery.set(k, arr);
    }
    let worst: { key: string; n: number; spanSec: number } | null = null;
    for (const [key, arr] of bySessionQuery) {
      if (arr.length < 10) continue;
      arr.sort((a, b) => a - b);
      // Sliding 5-minute window: max count of fires within any 300s span.
      let maxInWindow = 1, lo = 0;
      for (let hi = 0; hi < arr.length; hi++) {
        while (arr[hi] - arr[lo] > 300_000) lo++;
        maxInWindow = Math.max(maxInWindow, hi - lo + 1);
      }
      const spanSec = (arr[arr.length - 1] - arr[0]) / 1000;
      if (maxInWindow >= 20 && (!worst || maxInWindow > worst.n)) worst = { key, n: maxInWindow, spanSec };
    }
    if (worst && worst.n >= 150) {
      add({ area: "1. Repeat-fire", check: "Same (session, event_type, query) repeated in a 5-min window", level: "FAIL",
        detail: `${worst.n} fires in a 5-min window (${worst.key}) — at or above the confirmed August bug's scale (150+).`, evidence: worst.key });
    } else if (worst) {
      add({ area: "1. Repeat-fire", check: "Same (session, event_type, query) repeated in a 5-min window", level: "WATCH",
        detail: `${worst.n} fires in a 5-min window (${worst.key}) — below August's 150+ scale but worth a look.`, evidence: worst.key });
    } else {
      add({ area: "1. Repeat-fire", check: "Same (session, event_type, query) repeated in a 5-min window", level: "PASS",
        detail: `No session repeated an identical event/query ≥20 times in any 5-minute window.` });
    }
  }

  // ═══ CHECK 2 — daily merchant redirects inconsistent with sessions/browse activity ══════
  // The Aug 31 signature, generalized: a day (or the whole window, if short) whose redirect
  // volume is large relative to that day's OWN session/search activity, AND whose redirects
  // are dominated by rows with no session_id. Both conditions together are what made Aug 31
  // an artifact rather than a real high-conversion day — neither alone is damning (a real
  // viral day could have high redirects per session; an old pre-cutover ledger row
  // legitimately lacks session_id).
  {
    const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    const byDay = new Map<string, { sessions: Set<string>; searchActions: number; ob: number; obNoSession: number }>();
    for (const e of real) {
      const k = dayKey(e.created_at);
      const d = byDay.get(k) ?? { sessions: new Set(), searchActions: 0, ob: 0, obNoSession: 0 };
      if (e.session_id) d.sessions.add(e.session_id);
      if (e.event_type === "search" || e.event_type === "advisor_query") d.searchActions++;
      byDay.set(k, d);
    }
    for (const o of obReal) {
      const k = dayKey(o.clicked_at);
      const d = byDay.get(k) ?? { sessions: new Set(), searchActions: 0, ob: 0, obNoSession: 0 };
      d.ob++;
      if (!o.session_id) d.obNoSession++;
      byDay.set(k, d);
    }
    const flagged: string[] = [];
    for (const [day, d] of byDay) {
      const noSessionShare = d.ob > 0 ? d.obNoSession / d.ob : 0;
      // FAIL bar: ≥50 redirects that day, ≥80% with no session_id, and fewer real sessions
      // that day than redirects without a session — i.e. more anonymous exits than the whole
      // day's browsing population. Exactly the Aug 31 shape (119 rows, 115 no-session, 3
      // sessions), generalized instead of hardcoded to that date.
      if (d.ob >= 50 && noSessionShare >= 0.8 && d.sessions.size < d.obNoSession) {
        flagged.push(`${day}: ${d.ob} redirects (${d.obNoSession} no-session, ${(noSessionShare * 100).toFixed(0)}%) vs ${d.sessions.size} real sessions, ${d.searchActions} search actions`);
      }
    }
    if (flagged.length) {
      add({ area: "2. Redirect/browse mismatch", check: "Daily redirects consistent with that day's session/search activity", level: "FAIL",
        detail: `${flagged.length} day(s) look like the Aug 31 pattern (redirect volume decoupled from real browsing): ${flagged.join(" | ")}` });
    } else {
      add({ area: "2. Redirect/browse mismatch", check: "Daily redirects consistent with that day's session/search activity", level: "PASS",
        detail: `No day in the window shows redirect volume decoupled from that day's real session/search activity.` });
    }
  }

  // ═══ CHECK 3 — missing session/source/campaign on business-critical events ═════════════
  {
    const critical = real.filter((e) => ["search", "advisor_query", "go_click", "product_view"].includes(e.event_type));
    const missingSession = critical.filter((e) => !e.session_id).length;
    const goClicks = real.filter((e) => e.event_type === "go_click");
    const missingSource = goClicks.filter((e) => !e.source).length;
    const obMissingSession = obReal.length ? obReal.filter((o) => !o.session_id).length : 0;
    const obMissingSessionShare = obReal.length ? obMissingSession / obReal.length : 0;
    const parts = [
      `${missingSession}/${critical.length} critical usage_events missing session_id`,
      `${missingSource}/${goClicks.length} go_click events missing source`,
      `${obMissingSession}/${obReal.length} outbound_clicks rows missing session_id (${(obMissingSessionShare * 100).toFixed(0)}%)`,
    ];
    // outbound_clicks lacking session_id is EXPECTED for pre-ADR-244 rows and for any
    // cookie-less client (a real, structural gap documented in the August report, §12/§8) —
    // WATCH rather than FAIL unless it's the dominant majority, which would suggest the
    // cookie-stamping path itself broke, not just normal bot/legacy noise.
    const level: Level = obMissingSessionShare > 0.9 && obReal.length >= 20 ? "FAIL"
      : obMissingSessionShare > 0.5 && obReal.length >= 20 ? "WATCH" : "PASS";
    add({ area: "3. Required-field completeness", check: "session_id/source present on business-critical events", level,
      detail: parts.join("; ") });
  }

  // ═══ CHECK 4 — test/internal/bot contamination ═════════════════════════════════════════
  {
    const obWithUa = obRows.filter((o) => o.user_agent);
    const botRows = obWithUa.filter((o) => isKnownBotUserAgent(o.user_agent));
    const botRealRows = botRows.filter((o) => !o.is_test);
    const testShare = obRows.length ? obRows.filter((o) => o.is_test).length / obRows.length : 0;
    const level: Level = botRealRows.length > 0 ? "WATCH" : "PASS";
    add({ area: "4. Test/bot contamination", check: "Bot-signature UAs correctly flagged is_test; TEST share sane", level,
      detail: `${botRealRows.length} outbound_clicks row(s) with a known-bot UA are NOT flagged is_test (would have been missed pre-ADR-282 UA-list fix) — ${botRows.length - botRealRows.length} correctly are. TEST share of all redirects: ${(testShare * 100).toFixed(1)}%.` });
  }

  // ═══ CHECK 5 — abnormal concentration (one session dominating a metric) ════════════════
  // Threshold from real measured history (docs/report/…#5/#17): platform-wide top-session
  // search share was 18.8% in a contamination-affected month and 10.8% post-baseline in the
  // SAME month once cleaner — WATCH above 25%, FAIL above 40% (August's worst single-query
  // concentration, before the repeat-fire fix, was single sessions at 77-100% of a query's
  // volume; 40% platform-wide would be a new, comparably serious concentration event).
  {
    const share = topSessionSearchShare(real);
    const level: Level = share.share > 0.4 ? "FAIL" : share.share > 0.25 ? "WATCH" : "PASS";
    add({ area: "5. Session concentration", check: "No single session dominates platform-wide search volume", level,
      detail: `Top session's share of real search events: ${(share.share * 100).toFixed(1)}% (${share.sessionEventCount}/${share.totalSearchEvents}).` });

    // Per-product concentration on outbound_clicks — same idea, applied to "which product
    // is trending": a product whose redirects come overwhelmingly from ONE session/day is
    // the Aug-31 refrigerator shape, not real demand.
    const byProduct = new Map<string, Map<string, number>>();
    for (const o of obReal) {
      if (!o.canonical_product_id) continue;
      const m = byProduct.get(o.canonical_product_id) ?? new Map<string, number>();
      const k = o.session_id ?? "(no-session)";
      m.set(k, (m.get(k) ?? 0) + 1);
      byProduct.set(o.canonical_product_id, m);
    }
    const concentrated: string[] = [];
    for (const [pid, sessions] of byProduct) {
      const total = [...sessions.values()].reduce((a, b) => a + b, 0);
      if (total < 8) continue; // too small a sample to call "concentrated" meaningfully
      const top = Math.max(...sessions.values());
      if (top / total >= 0.6) concentrated.push(`${pid.slice(0, 8)}… (${top}/${total} from one session/no-session bucket)`);
    }
    if (concentrated.length) {
      add({ area: "5. Session concentration", check: "No single product's redirect count is dominated by one session", level: "WATCH",
        detail: `${concentrated.length} product(s) with ≥60% of their redirects (min. 8) from one session or the no-session bucket: ${concentrated.slice(0, 5).join(", ")}` });
    }
  }

  // ═══ CHECK 6 — affiliate import/reconciliation status ═══════════════════════════════════
  {
    const reports = await rows(`select source, count(*)::int n, max(created_at) last_import from affiliate_reports group by source`);
    const conversions = (await c.query(`select count(*)::int n from affiliate_conversions`)).rows[0] as { n: number };
    const affiliateRedirects = obReal.filter((o) => o.affiliate_program && o.affiliate_program !== "direct").length;
    if (reports.length === 0 && affiliateRedirects > 0) {
      add({ area: "6. Affiliate reconciliation", check: "At least one network report imported when affiliate-tagged redirects exist", level: "WATCH",
        detail: `${affiliateRedirects} affiliate-tagged redirects in this window; 0 affiliate_reports rows ever imported (${conversions.n} affiliate_conversions rows total). Purchase outcome remains UNKNOWN, NOT ZERO — see docs/AFFILIATE_RECONCILIATION_CONTRACT.md for the exact founder-provided file needed to close this.` });
    } else if (reports.length === 0) {
      add({ area: "6. Affiliate reconciliation", check: "At least one network report imported when affiliate-tagged redirects exist", level: "PASS",
        detail: `No affiliate-tagged redirects in this window and no reports imported — nothing to reconcile yet.` });
    } else {
      add({ area: "6. Affiliate reconciliation", check: "At least one network report imported when affiliate-tagged redirects exist", level: "PASS",
        detail: `${reports.length} source(s) imported, ${conversions.n} total conversion rows: ${reports.map((r) => `${r.source} (last ${r.last_import})`).join(", ")}.` });
    }
  }

  // ═══ CHECK 7 — sudden no-result/retrieval regression ════════════════════════════════════
  {
    const sf = buildSessionFunnel(real);
    const answerRate = sf.searched > 0 ? sf.searchedAndGotResults / sf.searched : null;
    // 80% floor matches the existing governed LAUNCH_KPI.ANSWER_RATE_MIN in
    // command-center-queries.ts — one threshold, not re-picked here.
    const level: Level = answerRate === null ? "WATCH" : answerRate < 0.6 ? "FAIL" : answerRate < 0.8 ? "WATCH" : "PASS";
    add({ area: "7. Retrieval regression", check: "Session-level answer rate ≥ 80% (governed launch KPI floor)", level,
      detail: answerRate === null ? "No searching sessions in this window — nothing to measure." : `${(answerRate * 100).toFixed(1)}% of searching sessions (${sf.searchedAndGotResults}/${sf.searched}) got a result this window.` });
  }

  // ── Render ──────────────────────────────────────────────────────────────────────────────
  const icon = (l: Level) => (l === "PASS" ? "✅ PASS " : l === "WATCH" ? "🟡 WATCH" : "🔴 FAIL ");
  console.log(`\n═══ TAWVEERI — WEEKLY MEASUREMENT SANITY CHECK ═══`);
  console.log(`Window: ${windowLabel} (${start.toISOString()} → ${end.toISOString()})`);
  console.log(`Real events=${real.length} · real outbound_clicks=${obReal.length}\n`);
  for (const chk of checks) {
    console.log(`${icon(chk.level)}  [${chk.area}] ${chk.check}`);
    console.log(`         ${chk.detail}`);
    if (chk.evidence) console.log(`         evidence: ${chk.evidence}`);
  }
  const fails = checks.filter((c) => c.level === "FAIL").length;
  const watches = checks.filter((c) => c.level === "WATCH").length;
  console.log(`\n${fails} FAIL, ${watches} WATCH, ${checks.length - fails - watches} PASS.`);
  console.log(`Reproduce: npm run tps:sanity -- --days=7 (or --from=YYYY-MM-DD --to=YYYY-MM-DD)\n`);

  await c.end();
  process.exit(fails > 0 ? 1 : 0);
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.stack : e); process.exit(1); });
