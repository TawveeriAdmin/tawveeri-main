import type { FirecrawlDemoProduct } from '@/lib/firecrawl/types';
import { isUrlLikeTitle } from '@/lib/firecrawl/validation';

const PRICE_REGEX =
  /(([\d\u0660-\u0669][\d\u0660-\u0669,.\u060c]*)\s*(SAR|ر\.س|ريال|SR)|(?:SAR|ر\.س|ريال|SR)\s*([\d\u0660-\u0669][\d\u0660-\u0669,.\u060c]*))/i;
const PRODUCT_WORD_REGEX =
  /(tv|تلفزيون|ثلاجة|freezer|fridge|laptop|air fryer|مكيف|غسالة|غساله|microwave|oven|فرن|شاشة|washer|washing|dryer|dishwasher|vacuum|مكنسة|machine|نشافة|مجفف)/i;
const NON_PRODUCT_IMAGE_REGEX =
  /(logo|favicon|icon|sprite|avatar|brand|placeholder|banner|header|footer|social|tracking|pixel)/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function scoreLine(line: string): number {
  let score = 0;
  if (PRICE_REGEX.test(line)) score += 2;
  if (PRODUCT_WORD_REGEX.test(line)) score += 2;
  if (line.length > 15) score += 1;
  if (line.length > 120) score -= 1;
  return score;
}

function resolveProductUrl(sourceUrl: string, links: string[], title: string): string {
  const pathMatch = links.find((link) => {
    const lower = link.toLowerCase();
    return (
      lower.includes('/product') ||
      lower.includes('/item/') ||
      lower.includes('/p/') ||
      lower.includes('/shop/')
    );
  });
  if (pathMatch) return pathMatch;
  if (!isUrlLikeTitle(title)) {
    const normalizedTitle = title.toLowerCase();
    const slice = normalizedTitle.slice(0, 16).replace(/\s+/g, '-');
    if (slice.length > 2) {
      const fuzzy = links.find((link) => link.toLowerCase().includes(slice));
      if (fuzzy) return fuzzy;
    }
  }
  return sourceUrl;
}

function extractImageCandidates(markdown: string, links: string[]): Array<{ url: string; alt: string }> {
  const markdownImageMatches = Array.from(markdown.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g)).map(
    (match) => ({ alt: (match[1] || '').toLowerCase(), url: match[2] })
  );

  const linkImages = links
    .filter((link) => /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(link))
    .map((url) => ({ alt: '', url }));
  return [...markdownImageMatches, ...linkImages];
}

function isLikelyProductImage(url: string, alt: string): boolean {
  const haystack = `${url} ${alt}`.toLowerCase();
  return !NON_PRODUCT_IMAGE_REGEX.test(haystack);
}

function resolveImageUrl(images: Array<{ url: string; alt: string }>, title: string): string | undefined {
  if (images.length === 0) return undefined;

  const slug = title.toLowerCase().replace(/\s+/g, '-').slice(0, 18);
  const keyword = title.toLowerCase().split(' ').find((part) => part.length > 3) || '';

  const strictMatch = images.find(
    (image) =>
      isLikelyProductImage(image.url, image.alt) &&
      (image.url.toLowerCase().includes(slug) ||
        image.alt.includes(slug) ||
        (keyword && (image.url.toLowerCase().includes(keyword) || image.alt.includes(keyword))))
  );
  if (strictMatch) return strictMatch.url;

  const firstGood = images.find((image) => isLikelyProductImage(image.url, image.alt));
  return firstGood?.url;
}

export function extractTopProducts(
  markdown: string,
  links: string[],
  sourceUrl: string,
  limit = 2
): FirecrawlDemoProduct[] {
  const lines = markdown
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const imageByLine = new Map<number, Array<{ url: string; alt: string }>>();
  lines.forEach((line, idx) => {
    const matches = Array.from(line.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g)).map((m) => ({
      alt: (m[1] || '').toLowerCase(),
      url: m[2],
    }));
    if (matches.length) imageByLine.set(idx, matches);
  });

  const candidates: Array<{ title: string; priceText: string; score: number; lineIndex: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const score = scoreLine(line);
    if (score < 3) continue;

    const priceMatch = line.match(PRICE_REGEX);
    const next = lines[i + 1] || '';
    const prev = lines[i - 1] || '';
    const priceOnLine = !!priceMatch;
    const priceOnNext = PRICE_REGEX.test(next);
    const priceOnPrev = PRICE_REGEX.test(prev);
    if (!priceOnLine && !priceOnNext && !priceOnPrev) continue;

    const priceText = priceMatch?.[1] || (priceOnNext ? next : priceOnPrev ? prev : '');

    const title = line.replace(PRICE_REGEX, '').trim();
    if (!title || isUrlLikeTitle(title)) continue;

    candidates.push({
      title: title.slice(0, 180),
      priceText: normalizeWhitespace(priceText).slice(0, 80),
      score: score + (priceText ? 1 : 0),
      lineIndex: i,
    });
  }

  const unique = new Map<string, { title: string; priceText: string; score: number; lineIndex: number }>();
  for (const candidate of candidates) {
    const key = candidate.title.toLowerCase();
    const current = unique.get(key);
    if (!current || candidate.score > current.score) {
      unique.set(key, candidate);
    }
  }

  const top = Array.from(unique.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(limit, 1), 20));

  const globalImageCandidates = extractImageCandidates(markdown, links);

  return top.map((item) => {
    const nearbyImages: Array<{ url: string; alt: string }> = [];
    for (let offset = -6; offset <= 6; offset += 1) {
      const lineImages = imageByLine.get(item.lineIndex + offset);
      if (lineImages) nearbyImages.push(...lineImages);
    }

    return {
      title: item.title,
      priceText: item.priceText || 'N/A',
      productUrl: resolveProductUrl(sourceUrl, links, item.title),
      imageUrl: resolveImageUrl(
        nearbyImages.length > 0 ? nearbyImages : globalImageCandidates,
        item.title
      ),
    };
  });
}
