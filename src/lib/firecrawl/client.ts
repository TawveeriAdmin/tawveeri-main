import type { FirecrawlSiteStatus } from '@/lib/firecrawl/types';

interface FirecrawlScrapeResult {
  ok: boolean;
  status: FirecrawlSiteStatus;
  markdown: string;
  links: string[];
  error?: string;
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    links?: string[];
  };
  error?: string;
}

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1';
const REQUEST_TIMEOUT_MS = 15000;

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
          formats: ['markdown', 'links'],
          onlyMainContent: false,
          waitFor: 1500,
        }),
      },
      REQUEST_TIMEOUT_MS
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
        error: payload.error || `Firecrawl error (${response.status})`,
      };
    }

    const markdown = payload.data?.markdown || '';
    const links = Array.isArray(payload.data?.links) ? payload.data.links : [];

    return {
      ok: true,
      status: markdown.trim() ? 'success' : 'empty',
      markdown,
      links,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        status: 'failed',
        markdown: '',
        links: [],
        error: 'Request timed out',
      };
    }

    return {
      ok: false,
      status: 'failed',
      markdown: '',
      links: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
