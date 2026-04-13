import type { FirecrawlScrapeResult, FirecrawlSiteStatus } from '@/lib/firecrawl/types';
import { PRODUCT_LIST_EXTRACT_PROMPT, PRODUCT_LIST_JSON_SCHEMA } from '@/lib/firecrawl/extract-schema';

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    links?: string[];
    json?: Record<string, unknown>;
  };
  error?: string;
}

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2';

/** LLM JSON extract is slow and often exceeds short timeouts; opt-in via env. */
function useLlmExtract(): boolean {
  return process.env.FIRECRAWL_USE_LLM_EXTRACT === 'true';
}

/**
 * Default timeouts: markdown+links only fits ~45s; with LLM use 120s unless overridden.
 * @see https://docs.firecrawl.dev/features/llm-extract
 */
function scrapeTimeoutMs(llm: boolean): number {
  const raw = process.env.FIRECRAWL_SCRAPE_TIMEOUT_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1000) return Math.min(n, 300_000);
  }
  return llm ? 120_000 : 45_000;
}

function buildFormats(): Array<
  | { type: 'markdown' }
  | { type: 'links' }
  | { type: 'json'; schema: typeof PRODUCT_LIST_JSON_SCHEMA; prompt: string }
> {
  const base: Array<{ type: 'markdown' } | { type: 'links' }> = [
    { type: 'markdown' },
    { type: 'links' },
  ];
  if (!useLlmExtract()) return base;
  return [
    ...base,
    {
      type: 'json',
      schema: PRODUCT_LIST_JSON_SCHEMA,
      prompt: PRODUCT_LIST_EXTRACT_PROMPT,
    },
  ];
}

function getApiKey(): string {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is missing');
  }
  return apiKey;
}

function toStatus(httpStatus: number): FirecrawlSiteStatus {
  if (httpStatus === 402) return 'credits_exhausted';
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus >= 500) return 'failed';
  return 'failed';
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeWebsite(url: string): Promise<FirecrawlScrapeResult> {
  const apiKey = getApiKey();
  const llm = useLlmExtract();
  const timeoutMs = scrapeTimeoutMs(llm);
  const formats = buildFormats();

  const callApi = async () => {
    const response = await fetchWithTimeout(
      `${FIRECRAWL_BASE_URL}/scrape`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats,
          onlyMainContent: false,
          waitFor: llm ? 2000 : 1500,
          timeout: timeoutMs,
        }),
      },
      timeoutMs + 5000
    );

    const payload = (await response.json().catch(() => ({}))) as FirecrawlScrapeResponse;
    return { response, payload };
  };

  try {
    let { response, payload } = await callApi();

    if (response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const retry = await callApi();
      response = retry.response;
      payload = retry.payload;
    }

    if (!response.ok || payload.success === false) {
      return {
        ok: false,
        status: toStatus(response.status),
        markdown: '',
        links: [],
        extractedJson: null,
        error: payload.error || `Firecrawl error (${response.status})`,
      };
    }

    const markdown = payload.data?.markdown || '';
    const links = Array.isArray(payload.data?.links) ? payload.data.links : [];
    const extractedJson =
      payload.data?.json && typeof payload.data.json === 'object'
        ? payload.data.json
        : null;

    const hasMarkdown = markdown.trim().length > 0;
    const hasJson = extractedJson !== null && Object.keys(extractedJson).length > 0;
    const status: FirecrawlSiteStatus = hasMarkdown || hasJson ? 'success' : 'empty';

    return {
      ok: true,
      status,
      markdown,
      links,
      extractedJson,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 'failed',
        markdown: '',
        links: [],
        extractedJson: null,
        error: 'Request timed out',
      };
    }

    return {
      ok: false,
      status: 'failed',
      markdown: '',
      links: [],
      extractedJson: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
