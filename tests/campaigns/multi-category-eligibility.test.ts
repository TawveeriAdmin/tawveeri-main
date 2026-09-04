// tests/campaigns/multi-category-eligibility.test.ts
// Amazon multi-category expansion preparation (Sept 2026) — proves the EXISTING campaign
// engine (unchanged in this patch) correctly isolates one category-gated campaign from
// another once real campaign rows exist for each approved category. Uses synthetic fixtures
// only — no production campaign rows are created, enabled, or modified by this patch.
import { isCampaignEligible, selectEligibleCampaigns } from '@/lib/campaigns/eligibility';
import type { AffiliateCampaign } from '@/lib/campaigns/types';

const NOW = new Date('2026-09-04T12:00:00Z');

const APPROVED_FIRST_WAVE = ['tablet', 'tv', 'smartphone', 'air_fryer', 'coffee_machine', 'vacuum', 'electric_kettle', 'blender'] as const;

function makeCampaign(category: string, overrides: Partial<AffiliateCampaign> = {}): AffiliateCampaign {
  return {
    id: `test-${category}-campaign`,
    merchant: 'amazon',
    title_ar: `عنوان ${category}`, title_en: `Title ${category}`,
    cta_ar: 'استكشف الخيارات على Amazon.sa', cta_en: 'Explore options on Amazon.sa',
    destination_url: `https://www.amazon.sa/s?k=test&rh=n:00000000000`,
    tracking_id: `tawveeri0f-${category}-21`,
    categories: [category],
    placement: 'post_search',
    enabled: true,
    start_at: '2026-09-04T00:00:00Z',
    end_at: '2027-09-04T00:00:00Z',
    verified_at: null,
    source: 'test',
    disclosure_ar: 'مادة إعلانية • رابط عمولة', disclosure_en: 'Advertisement • Commission link',
    is_test: true,
    created_by: null,
    created_at: '2026-09-04T00:00:00Z',
    updated_at: '2026-09-04T00:00:00Z',
    ...overrides,
  };
}

function ctx(category: string | null) {
  return {
    now: NOW, placement: 'post_search' as const, category,
    globalEnabled: true, allowedMerchants: new Set<'amazon' | 'noon'>(['amazon']),
  };
}

describe('multi-category eligibility — one category, one campaign', () => {
  const campaigns = APPROVED_FIRST_WAVE.map((c) => makeCampaign(c));

  it('a campaign is eligible ONLY for its own category, for every approved category', () => {
    for (const c of campaigns) {
      const ownCategory = c.categories[0];
      expect(isCampaignEligible(c, ctx(ownCategory))).toBe(true);
      for (const other of APPROVED_FIRST_WAVE) {
        if (other === ownCategory) continue;
        expect(isCampaignEligible(c, ctx(other))).toBe(false);
      }
    }
  });

  it('قلاية هوائية (air_fryer intent) never makes the coffee_machine, vacuum, or tablet campaign eligible', () => {
    const airFryer = campaigns.find((c) => c.categories[0] === 'air_fryer')!;
    const coffee = campaigns.find((c) => c.categories[0] === 'coffee_machine')!;
    const vacuum = campaigns.find((c) => c.categories[0] === 'vacuum')!;
    const tablet = campaigns.find((c) => c.categories[0] === 'tablet')!;
    expect(isCampaignEligible(airFryer, ctx('air_fryer'))).toBe(true);
    expect(isCampaignEligible(coffee, ctx('air_fryer'))).toBe(false);
    expect(isCampaignEligible(vacuum, ctx('air_fryer'))).toBe(false);
    expect(isCampaignEligible(tablet, ctx('air_fryer'))).toBe(false);
  });

  it('all campaigns simultaneously live: selectEligibleCampaigns still returns at most one per merchant (never "all Amazon campaigns at once")', () => {
    const result = selectEligibleCampaigns(campaigns, ctx('vacuum'));
    expect(result).toHaveLength(1);
    expect(result[0].categories[0]).toBe('vacuum');
  });

  it('an irrelevant/unmatched category shows no campaign at all', () => {
    const result = selectEligibleCampaigns(campaigns, ctx('camera'));
    expect(result).toHaveLength(0);
  });

  it('the existing tablet campaign is unaffected by the presence of the new category campaigns — independently measurable by its own id', () => {
    const tablet = campaigns.find((c) => c.categories[0] === 'tablet')!;
    expect(isCampaignEligible(tablet, ctx('tablet'))).toBe(true);
    // its id/tracking_id stay unique among all campaigns, proving independent measurement
    const ids = campaigns.map((c) => c.id);
    const trackingIds = campaigns.map((c) => c.tracking_id);
    expect(new Set(ids).size).toBe(campaigns.length);
    expect(new Set(trackingIds).size).toBe(campaigns.length);
  });
});

describe('destination host contract — Amazon.sa only', () => {
  it('every proposed first-wave destination is a valid amazon.sa search/browse URL', () => {
    const destinations = [
      'https://www.amazon.sa/s?k=%D8%AA%D8%A7%D8%A8%D9%84%D8%AA&rh=n:16966433031', // tablet (corrected)
      'https://www.amazon.sa/b?node=16966461031', // tv
      'https://www.amazon.sa/b?node=16966419031', // smartphone
      'https://www.amazon.sa/b?node=26970164031', // air_fryer
      'https://www.amazon.sa/b?node=16856508031', // coffee_machine
      'https://www.amazon.sa/b?node=16856212031', // vacuum
      'https://www.amazon.sa/s?k=%D8%BA%D9%84%D8%A7%D9%8A%D8%A9+%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A6%D9%8A%D8%A9&rh=n:16856469031', // electric_kettle
      'https://www.amazon.sa/b?node=16856839031', // blender
    ];
    for (const url of destinations) {
      const host = new URL(url).hostname;
      expect(host).toBe('www.amazon.sa');
      expect(url.startsWith('https://')).toBe(true);
    }
  });

  it('proposed tracking IDs are static, category-level strings — never a per-user/session token shape', () => {
    const proposed = [
      'tawveeri0f-tv-21', 'tawveeri0f-smartphone-21', 'tawveeri0f-airfryer-21',
      'tawveeri0f-coffeemachine-21', 'tawveeri0f-vacuum-21', 'tawveeri0f-kettle-21', 'tawveeri0f-blender-21',
    ];
    // Static IDs are short, human-authored, contain no UUID/timestamp/session-id shape.
    const looksDynamic = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}|\d{10,}/i;
    for (const id of proposed) {
      expect(looksDynamic.test(id)).toBe(false);
      expect(id.startsWith('tawveeri0f-')).toBe(true);
    }
  });
});
