import type { Browser } from 'puppeteer';

export interface PuppeteerSearchFetchOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  waitForSelector?: string;
  extraWaitMs?: number;
}

/**
 * Full HTML after JS render — one browser per call (same cost model as legacy GenericHtmlSearchScraper).
 */
export async function fetchSearchHtmlWithPuppeteer(
  url: string,
  options: PuppeteerSearchFetchOptions = {},
): Promise<string> {
  const puppeteer = await import('puppeteer');
  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    );
    await page.goto(url, {
      waitUntil: options.waitUntil ?? 'networkidle2',
      timeout: 60_000,
    });
    if (options.extraWaitMs && options.extraWaitMs > 0) {
      await new Promise((r) => setTimeout(r, options.extraWaitMs));
    }
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 25_000 }).catch(() => {});
    }
    return await page.content();
  } finally {
    await browser.close().catch(() => {});
  }
}
