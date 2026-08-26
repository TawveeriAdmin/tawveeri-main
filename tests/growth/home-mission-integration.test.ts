/**
 * Home Mission Watch — live-DB integration suite (same pattern as
 * tests/auth/phone-otp.test.ts). Growth Radar Phase 2, Part B (founder
 * decision 2026-08-26): furnishing/new-home-receipt opportunities bypass the
 * per-product answerability gate and route to a distinct reply template.
 *
 * Uses runHomeMissionWatch's opts.mockCandidates path — never touches the
 * network (no X API call), but writes real is_test=true rows through the
 * exact same insert path production uses, then deletes them. draftHomeMissionReply
 * does call the real Anthropic API (same precedent as the main pipeline's
 * draftReply under source:'mock' — only the X fetch is mocked, not drafting).
 *
 * Run via `npm run test:integration` — excluded from the default fast gate.
 */
import { createServerClient } from '@/lib/database';
import { runHomeMissionWatch } from '@/lib/growth/demand-radar/home-mission-detect';

const TEST_POST_ID_PREFIX = 'home-mission-test-';

describe('runHomeMissionWatch', () => {
  // demand_opportunities lives in the TPS knowledge schema, not the legacy
  // typed schema in src/lib/database/types.ts — same untyped-client pattern
  // as pipeline.ts/home-mission-detect.ts themselves (ADR-122).
  const supabase = createServerClient() as any;

  afterEach(async () => {
    await supabase
      .from('demand_opportunities')
      .delete()
      .like('source_post_id', `${TEST_POST_ID_PREFIX}%`);
  });

  it('stores a furnishing-intent candidate as opportunity_type=home_mission, tier=medium, category=null', async () => {
    const postId = `${TEST_POST_ID_PREFIX}1`;
    const result = await runHomeMissionWatch({
      isTest: true,
      mockCandidates: [
        {
          sourcePostId: postId,
          sourceUrl: `https://example.com/${postId}`,
          authorHandle: 'test_user',
          text: 'استلمت شقتي الجديدة وأبي أثث بيتي، من وين أبدأ؟',
          lang: 'ar',
          postedAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.status).toBe('ok');
    expect(result.stored).toBe(1);

    const { data } = await supabase
      .from('demand_opportunities')
      .select('*')
      .eq('source_post_id', postId)
      .single();
    expect(data.opportunity_type).toBe('home_mission');
    expect(data.category).toBeNull();
    expect(data.tier).toBe('medium'); // medium-capped, never high (founder decision)
    expect(data.status).toBe('ready_for_review');
    expect(data.is_test).toBe(true);
    expect(data.tracking_url).toContain('/r/');
  }, 20000);

  it('dedups against an existing source_post_id — running twice stores once', async () => {
    const postId = `${TEST_POST_ID_PREFIX}2`;
    const candidate = {
      sourcePostId: postId,
      sourceUrl: `https://example.com/${postId}`,
      authorHandle: 'test_user',
      text: 'استلمنا الشقة الجديدة وأبغى أثث شقتي',
      lang: 'ar',
      postedAt: new Date().toISOString(),
    };
    const first = await runHomeMissionWatch({ isTest: true, mockCandidates: [candidate] });
    const second = await runHomeMissionWatch({ isTest: true, mockCandidates: [candidate] });
    expect(first.stored).toBe(1);
    expect(second.stored).toBe(0);

    const { count } = await supabase
      .from('demand_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('source_post_id', postId);
    expect(count).toBe(1);
  }, 30000);

  it('skips our own account (belt-and-braces beyond -from:Tawveeri)', async () => {
    const postId = `${TEST_POST_ID_PREFIX}3`;
    const result = await runHomeMissionWatch({
      isTest: true,
      mockCandidates: [
        {
          sourcePostId: postId,
          sourceUrl: `https://example.com/${postId}`,
          authorHandle: 'Tawveeri',
          text: 'استلمنا الشقة الجديدة وأبغى أثث شقتي',
          lang: 'ar',
          postedAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.stored).toBe(0);
  });

  it('skips a stale candidate (>48h old, same window as the main pipeline)', async () => {
    const postId = `${TEST_POST_ID_PREFIX}4`;
    const result = await runHomeMissionWatch({
      isTest: true,
      mockCandidates: [
        {
          sourcePostId: postId,
          sourceUrl: `https://example.com/${postId}`,
          authorHandle: 'test_user',
          text: 'استلمنا الشقة الجديدة وأبغى أثث شقتي',
          lang: 'ar',
          postedAt: new Date(Date.now() - 50 * 3600_000).toISOString(),
        },
      ],
    });
    expect(result.stored).toBe(0);
  });
});
