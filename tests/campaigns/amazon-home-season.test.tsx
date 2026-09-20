/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HomepageOffers } from '@/components/campaigns/homepage-offers';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { AMAZON_HOME_CAMPAIGN_ID, AMAZON_HOME_SEASON_START, AMAZON_HOME_SEASON_END, isAmazonHomeSeason } from '@/lib/campaigns/amazon-home-season';
import type { EligibleCampaign } from '@/lib/campaigns/types';
import { track } from '@/lib/analytics/track';

jest.mock('@/lib/analytics/track', () => ({ track: jest.fn() }));
const amazon = { id: AMAZON_HOME_CAMPAIGN_ID, merchant: 'amazon', title_ar: 'استكشف عروض أمازون', cta_ar: 'تسوّق الآن', merchantUrl: 'https://www.amazon.sa/gp/goldbox?tag=tawveeri0f-21', clickToken: 'test-token', is_test: true, destinationMode: 'category', canonicalProductId: null, reasonCode: 'no_category_context' } as EligibleCampaign;
const noon = { ...amazon, id: 'noon-unchanged', merchant: 'noon', title_ar: 'استكشف عروض نون', merchantUrl: 'https://www.noon.com/saudi-en/?utm_source=C1000264L' } as EligibleCampaign;
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-20T12:00:00+03:00'));
  jest.clearAllMocks();
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: jest.fn(() => true) });
});
afterEach(() => jest.useRealTimers());

test('season is bounded and cannot relabel other merchants or campaigns', () => {
  expect(isAmazonHomeSeason(amazon.id, 'amazon', AMAZON_HOME_SEASON_START - 1)).toBe(false);
  expect(isAmazonHomeSeason(amazon.id, 'amazon', AMAZON_HOME_SEASON_START)).toBe(true);
  expect(isAmazonHomeSeason(amazon.id, 'amazon', AMAZON_HOME_SEASON_END)).toBe(false);
  expect(isAmazonHomeSeason(noon.id, 'noon', AMAZON_HOME_SEASON_START)).toBe(false);
});
test('anchor, Amazon first, unchanged destinations and one click per measurement stream', () => {
  const { container } = render(<HomepageOffers campaigns={[noon, amazon]} locale="ar" />);
  const links = screen.getAllByTestId('campaign-card');
  expect(container.querySelector('#offers')).toHaveStyle({ scrollMarginTop: '160px' });
  expect(links[0]).toHaveAttribute('href', amazon.merchantUrl);
  expect(links[1]).toHaveAttribute('href', noon.merchantUrl);
  expect(links[1]).toHaveTextContent(noon.title_ar);
  expect(links[1]).toHaveTextContent(noon.cta_ar);
  expect(screen.queryByText('٢٠–٣٠ سبتمبر')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('تسوّق العروض'));
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  expect(jest.mocked(track).mock.calls.filter(([event]) => event === 'campaign_click')).toHaveLength(1);
});
test('open tab returns to general wording at expiry without a new impression', () => {
  jest.setSystemTime(AMAZON_HOME_SEASON_END - 1000);
  render(<HomepageOffers campaigns={[amazon]} locale="ar" />);
  expect(screen.getByText('عروض اليوم الوطني')).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(1001); });
  expect(screen.queryByText('عروض اليوم الوطني')).not.toBeInTheDocument();
  expect(screen.getByText(amazon.title_ar)).toBeInTheDocument();
  expect(screen.getByTestId('campaign-card')).toHaveAttribute('href', amazon.merchantUrl);
  expect(jest.mocked(track).mock.calls.filter(([event]) => event === 'campaign_impression')).toHaveLength(1);
});
test('post-search copy remains unchanged', () => {
  render(<CampaignCard campaign={amazon} locale="ar" surface="post_search" />);
  expect(screen.queryByText('عروض اليوم الوطني')).not.toBeInTheDocument();
  expect(screen.getByText(amazon.title_ar)).toBeInTheDocument();
});
