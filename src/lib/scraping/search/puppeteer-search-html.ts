import type { Browser } from 'puppeteer';
import { existsSync } from 'node:fs';

const SYSTEM_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function findSystemChrome(): string | null {
  for (const p of SYSTEM_CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

export interface PuppeteerSearchFetchOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  waitForSelector?: string;
  extraWaitMs?: number;
}

const MAX_CONCURRENT = 3;
let inflight = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (inflight < MAX_CONCURRENT) {
    inflight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inflight++;
}

function releaseSlot(): void {
  inflight--;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Full HTML after JS render. Serializes browser launches via a global mutex to
 * avoid Chromium ECONNRESET crashes when multiple stores run in parallel.
 */
export async function fetchSearchHtmlWithPuppeteer(
  url: string,
  options: PuppeteerSearchFetchOptions = {},
): Promise<string> {
  await acquireSlot();
  let browser: Browser | null = null;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new' as unknown as boolean,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || findSystemChrome() || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    });
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
    if (browser) await browser.close().catch(() => {});
    releaseSlot();
  }
}
