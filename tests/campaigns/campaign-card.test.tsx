/**
 * @jest-environment jsdom
 */
// tests/campaigns/campaign-card.test.tsx — Phase 3 item 14 (disclosure renders) plus
// the final-closure click architecture "B": the anchor points DIRECTLY at the
// pre-built merchant URL (no /go/campaign redirect), and a click fires a token-bound
// measurement beacon that never gates navigation (item 12: a click is never a sale —
// the beacon is telemetry only; campaign_clicks via /api/campaigns/click is the
// authoritative ledger, exercised separately in
// tests/campaigns/click-route-contract.test.ts and click-token.test.ts).
import { render, screen, fireEvent } from '@testing-library/react';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import type { EligibleCampaign } from '@/lib/campaigns/types';

const campaign: EligibleCampaign = {
  id: 'cc11111-1111-1111-1111-111111111111',
  merchant: 'amazon',
  title_ar: 'عروض الأجهزة اللوحية الحالية',
  title_en: 'Current tablet offers',
  cta_ar: 'استعرض العرض',
  cta_en: 'View offer',
  destination_url: 'https://www.amazon.sa/gp/browse.html?node=123',
  tracking_id: null,
  categories: ['tablet'],
  placement: 'both',
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
  merchantUrl: 'https://www.amazon.sa/gp/browse.html?node=123&tag=tawveeri0f-21',
  clickToken: '1756800000000.deadbeef',
};

let sendBeaconMock: jest.Mock;

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  sendBeaconMock = jest.fn().mockReturnValue(true);
  // jsdom does not implement sendBeacon.
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeaconMock, configurable: true });
});

describe('CampaignCard', () => {
  it('14. always renders the disclosure text', () => {
    render(<CampaignCard campaign={campaign} locale="en" surface="homepage" category={null} />);
    expect(screen.getByText('Advertisement • Commission link')).toBeInTheDocument();
  });

  it('renders the Arabic disclosure for the Arabic locale', () => {
    render(<CampaignCard campaign={campaign} locale="ar" surface="homepage" category={null} />);
    expect(screen.getByText('مادة إعلانية • رابط عمولة')).toBeInTheDocument();
  });

  it('links DIRECTLY to the pre-built merchant URL — no Tawveeri redirect hop', () => {
    render(<CampaignCard campaign={campaign} locale="en" surface="post_search" category="tablet" />);
    const link = screen.getByRole('link', { name: 'View offer' });
    expect(link).toHaveAttribute('href', campaign.merchantUrl);
    expect(link).not.toHaveAttribute('href', expect.stringContaining('/go/campaign'));
  });

  it('a click sends a token-bound beacon but the merchant link itself is unaffected by that call', () => {
    render(<CampaignCard campaign={campaign} locale="en" surface="post_search" category="tablet" />);
    const link = screen.getByRole('link', { name: 'View offer' });
    fireEvent.click(link);
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeaconMock.mock.calls[0];
    expect(url).toBe('/api/campaigns/click');
    // href is a static attribute set at render time — firing the beacon can never mutate it.
    expect(link).toHaveAttribute('href', campaign.merchantUrl);
    void body;
  });

  it('the click beacon carries the campaign id and its issued token, never a raw merchant URL param', () => {
    render(<CampaignCard campaign={campaign} locale="en" surface="homepage" category={null} />);
    fireEvent.click(screen.getByRole('link', { name: 'View offer' }));
    const body = sendBeaconMock.mock.calls[0][1] as string;
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({ campaignId: campaign.id, token: campaign.clickToken, placement: 'homepage', source: 'homepage' });
  });

  it('never renders a price/discount claim (V1 is text-only, Phase 0A/1B)', () => {
    render(<CampaignCard campaign={campaign} locale="en" surface="homepage" category={null} />);
    expect(screen.queryByText(/%|SAR|ريال/)).not.toBeInTheDocument();
  });
});
