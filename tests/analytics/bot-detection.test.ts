// tests/analytics/bot-detection.test.ts
// ADR-282: pins the widened bot-UA list extracted from src/app/go/[offerId]/route.ts.
// Positive cases include the exact confirmed bot UA found in the 2026-08-31 anomaly
// investigation; negative cases are the real browser UAs also observed that same day, to
// guard against the fix over-flagging genuine customer traffic as TEST.
import { isKnownBotUserAgent } from "../../src/lib/analytics/bot-detection";

describe("isKnownBotUserAgent", () => {
  it("flags the exact BuiltWith UA confirmed in the Aug 31 anomaly (previously MISSED)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; BuiltWith/1.4; rb.gy/xprgqj) Chrome/124.0.0.0 Safari/537.36";
    expect(isKnownBotUserAgent(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
    "Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)",
    "python-requests/2.31.0",
    "Scrapy/2.11 (+https://scrapy.org)",
    "okhttp/4.9.3",
    "Go-http-client/1.1",
    "curl/8.4.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HeadlessChrome/120.0.0.0 Safari/537.36",
    "Pingdom.com_bot_version_1.4",
  ])("flags known bot UA: %s", (ua) => {
    expect(isKnownBotUserAgent(ua)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
  ])("does NOT flag a real browser UA (from the Aug 31 real-session set): %s", (ua) => {
    expect(isKnownBotUserAgent(ua)).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isKnownBotUserAgent(null)).toBe(false);
    expect(isKnownBotUserAgent(undefined)).toBe(false);
    expect(isKnownBotUserAgent("")).toBe(false);
  });
});
