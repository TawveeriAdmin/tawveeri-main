// Founder Intelligence — Emerging Language (integrated review, 2026-08-30).
import { clusterEmergingLanguage, interpretEmergingCluster, MIN_CLUSTER_SIZE } from '@/lib/admin/emerging-language';
import type { UsageEventRow } from '@/lib/admin/command-center-queries';

function ev(overrides: Partial<UsageEventRow>): UsageEventRow {
  return {
    event_type: 'search', session_id: 's1', is_test: false, source: 'web',
    category: null, query_text: 'شي غريب', canonical_id: null,
    created_at: '2026-08-20T10:00:00.000Z', meta: null,
    ...overrides,
  };
}

describe('clusterEmergingLanguage — deterministic, no AI', () => {
  it('groups repeated queries with an identical content-token signature (stopwords/want-verbs normalized away)', () => {
    const events = [
      ev({ query_text: 'ابي جهاز غريب جدا', session_id: 's1' }),      // "ابي" is a stopword
      ev({ query_text: 'أبي جهاز غريب جدا', session_id: 's2' }),      // hamza variant, still a stopword
      ev({ query_text: 'جهاز غريب جدا', session_id: 's3' }),          // no want-verb at all — same content
    ];
    const clusters = clusterEmergingLanguage(events);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].distinctSessions).toBe(3);
    expect(clusters[0].belowClusterFloor).toBe(false);
  });

  it('does NOT cluster queries that merely share a topic but use different phrasing — conservative by design', () => {
    // Real-world case this guards against: "وش افضل جهاز غريب جدا" and "جهاز غريب جدا ابيه"
    // are about the same thing to a human reader, but carry different token sets
    // ("افضل" / "ابيه" vs neither) — clustering them would require the fuzzy
    // similarity this module deliberately does not do (see the test above this one
    // for the case it DOES handle: pure stopword/want-verb variation).
    const events = [
      ev({ query_text: 'وش افضل جهاز غريب جدا', session_id: 's1' }),
      ev({ query_text: 'جهاز غريب جدا ابيه', session_id: 's2' }),
    ];
    const clusters = clusterEmergingLanguage(events);
    expect(clusters.length).toBeGreaterThan(1); // NOT merged into one cluster
  });

  it('never clusters a query that already has a recorded category — that is not unparseable', () => {
    const events = [ev({ query_text: 'جهاز غريب', category: 'laptop' })];
    expect(clusterEmergingLanguage(events)).toEqual([]);
  });

  it('never clusters a query parseShoppingTask can already derive — topDemand() already recovers it, not emerging', () => {
    const events = Array.from({ length: 5 }, () => ev({ query_text: 'مكيف رخيص', category: null }));
    expect(clusterEmergingLanguage(events)).toEqual([]);
  });

  it('flags a below-floor cluster explicitly rather than hiding it or overstating it', () => {
    const events = [ev({ query_text: 'شي نادر جدا هنا', session_id: 's1' }), ev({ query_text: 'شي نادر جدا هنا', session_id: 's2' })];
    const clusters = clusterEmergingLanguage(events);
    expect(clusters[0].count).toBeLessThan(MIN_CLUSTER_SIZE);
    expect(clusters[0].belowClusterFloor).toBe(true);
  });

  it('does NOT merge genuinely different queries via fuzzy similarity — exact signature only, by design', () => {
    const events = [
      ev({ query_text: 'جهاز اكس واي زد', session_id: 's1' }),
      ev({ query_text: 'جهاز اكس واي', session_id: 's2' }), // one token short — deliberately NOT merged
    ];
    expect(clusterEmergingLanguage(events)).toHaveLength(2);
  });

  it('ignores non-demand event types and rows with no query text', () => {
    const events = [ev({ event_type: 'product_view' }), ev({ query_text: null as unknown as string })];
    expect(clusterEmergingLanguage(events)).toEqual([]);
  });

  it('real production example: مكروويف/مكاوه cluster individually (distinct signatures) below the floor at n=1 each', () => {
    const events = [ev({ query_text: 'مكروويف' }), ev({ query_text: 'مكاوه' })];
    const clusters = clusterEmergingLanguage(events);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.belowClusterFloor)).toBe(true);
  });
});

describe('interpretEmergingCluster — bounded AI, never fabricates, never throws', () => {
  const cluster = { signature: ['test'], sampleQueries: ['test query'], count: 5, distinctSessions: 4, belowClusterFloor: false };

  it('returns null when no API key is configured — never a guessed interpretation', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(interpretEmergingCluster(cluster)).resolves.toBeNull();
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('returns null for an empty cluster regardless of API key state', async () => {
    await expect(interpretEmergingCluster({ ...cluster, sampleQueries: [] })).resolves.toBeNull();
  });

  it('never throws even if fetch itself throws', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => { throw new Error('network down'); }) as unknown as typeof fetch;
    try {
      await expect(interpretEmergingCluster(cluster)).resolves.toBeNull();
    } finally {
      global.fetch = originalFetch;
      if (original) process.env.ANTHROPIC_API_KEY = original; else delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
