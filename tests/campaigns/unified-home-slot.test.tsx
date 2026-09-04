/**
 * @jest-environment jsdom
 */
// tests/campaigns/unified-home-slot.test.tsx
// Affiliate Campaign Revenue Layer V1 — proves the homepage "same slot, two mutually
// exclusive contents" design (Phase 1C): campaigns present -> campaign section renders
// and the ORIGINAL best-deals section does not; campaigns empty -> the page falls back
// EXACTLY to the pre-existing verified-deals section (this is the whole rollback story —
// getEligibleCampaigns already returns [] whenever the kill switch is off, so no
// separate "disabled" rendering path needs to exist or be tested here).
import { render, screen } from '@testing-library/react';
import { UnifiedHome } from '@/components/public/unified-home';
import type { EligibleCampaign } from '@/lib/campaigns/types';
import type { HomeVerifiedDeal } from '@/lib/intelligence/home-verified-deals';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ campaigns: [] }) }) as unknown as typeof fetch;
});

const deal: HomeVerifiedDeal = {
  url: 'https://example.com/p/1',
  href: '/en/compare/example-1',
  internal: true,
  name: 'Example verified deal',
  price: 900,
  observedMax: 1200,
  savingPct: 25,
  trackedDays: 5,
  storeName: 'Jarir',
};

const campaign: EligibleCampaign = {
  id: 'cc22222-2222-2222-2222-222222222222',
  merchant: 'noon',
  title_ar: 'عروض نون الحالية',
  title_en: 'Current store offers',
  cta_ar: 'استعرض العرض',
  cta_en: 'View offer',
  destination_url: 'https://www.noon.com/saudi-en/electronics/',
  tracking_id: null,
  categories: [],
  placement: 'homepage',
  enabled: true,
  start_at: '2026-09-01T00:00:00Z',
  end_at: '2026-09-10T00:00:00Z',
  verified_at: null,
  source: 'test',
  disclosure_ar: 'مادة إعلانية • رابط عمولة',
  disclosure_en: 'Advertisement • Commission link',
  is_test: true,
  created_by: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  merchantUrl: 'https://www.noon.com/saudi-en/electronics/?utm_source=C1000264L',
  clickToken: '1756800000000.deadbeef',
  destinationMode: 'category',
  canonicalProductId: null,
  reasonCode: 'non_amazon_merchant',
};

describe('UnifiedHome — campaign/deals slot', () => {
  it('16. zero campaigns -> falls back cleanly to the original verified-deals section', () => {
    render(<UnifiedHome locale="en" deals={[deal]} campaigns={[]} />);
    expect(screen.getByText('Best deals')).toBeInTheDocument();
    expect(screen.getByText('Example verified deal')).toBeInTheDocument();
    expect(screen.queryByText('Store offers now')).not.toBeInTheDocument();
  });

  it('an eligible campaign replaces the deals section in the SAME slot, not alongside it', () => {
    render(<UnifiedHome locale="en" deals={[deal]} campaigns={[campaign]} />);
    expect(screen.getByText('Store offers now')).toBeInTheDocument();
    expect(screen.getByText('Current store offers')).toBeInTheDocument();
    // The original deals heading/content must NOT also render — one slot, one content.
    expect(screen.queryByText('Best deals')).not.toBeInTheDocument();
    expect(screen.queryByText('Example verified deal')).not.toBeInTheDocument();
  });

  it('16b. zero campaigns AND zero deals -> no broken/empty commercial or deals shell', () => {
    const { container } = render(<UnifiedHome locale="en" deals={[]} campaigns={[]} />);
    expect(screen.queryByText('Best deals')).not.toBeInTheDocument();
    expect(screen.queryByText('Store offers now')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="campaign-card"]')).toBeNull();
  });
});
