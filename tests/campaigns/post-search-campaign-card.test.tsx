/**
 * @jest-environment jsdom
 */
// tests/campaigns/post-search-campaign-card.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { PostSearchCampaignCard } from '@/components/campaigns/post-search-campaign-card';
import type { EligibleCampaign } from '@/lib/campaigns/types';

const campaign: EligibleCampaign = {
  id: 'cc33333-3333-3333-3333-333333333333',
  merchant: 'amazon',
  title_ar: 'عروض اللابتوبات',
  title_en: 'Laptop offers',
  cta_ar: 'استعرض العرض',
  cta_en: 'View offer',
  destination_url: 'https://www.amazon.sa/gp/browse.html?node=1',
  tracking_id: null,
  categories: ['laptop'],
  placement: 'post_search',
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
  merchantUrl: 'https://www.amazon.sa/gp/browse.html?node=1&tag=tawveeri0f-21',
  clickToken: '1756800000000.deadbeef',
};

describe('PostSearchCampaignCard', () => {
  it('16. renders nothing (no broken/empty shell) when the API returns zero campaigns', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ campaigns: [] }) }) as unknown as typeof fetch;
    const { container } = render(<PostSearchCampaignCard locale="en" category="tv" />);
    await waitFor(() => expect(container.querySelector('[data-testid="campaign-card"]')).toBeNull());
  });

  it('20. an analytics/API failure never throws or crashes the search results — it just renders nothing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const { container } = render(<PostSearchCampaignCard locale="en" category="tv" />);
    await waitFor(() => expect(container.querySelector('[data-testid="campaign-card"]')).toBeNull());
  });

  it('renders the eligible campaign returned for the current category', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ campaigns: [campaign] }) }) as unknown as typeof fetch;
    render(<PostSearchCampaignCard locale="en" category="laptop" />);
    await waitFor(() => expect(screen.getByText('Laptop offers')).toBeInTheDocument());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/campaigns/eligible?category=laptop');
  });
});
