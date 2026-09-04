import { buildXAttributionUrl, isXOrganicCampaign, X_UTM_MEDIUM, X_UTM_SOURCE } from '@/lib/analytics/x-attribution';

describe('X attribution contract', () => {
  it('builds stable UTM URLs for profile pin', () => {
    const url = buildXAttributionUrl({
      campaign: 'profile_pin_v2',
      contentId: 'pin_need_budget_v2',
      path: '',
      locale: 'ar',
      baseUrl: 'https://tawveeri.com',
    });
    expect(url).toBe(
      'https://tawveeri.com/ar?utm_source=x&utm_medium=organic_social&utm_campaign=profile_pin_v2&utm_content=pin_need_budget_v2',
    );
  });

  it('builds Home Mission landing with intent term', () => {
    const url = buildXAttributionUrl({
      campaign: 'home_mission',
      contentId: 'reply_2026-09-04_apartment',
      path: '/home-mission',
      term: 'HOME_MISSION',
      locale: 'ar',
      baseUrl: 'https://tawveeri.com',
    });
    expect(url).toContain('/ar/home-mission?');
    expect(url).toContain('utm_source=x');
    expect(url).toContain('utm_campaign=home_mission');
    expect(url).toContain('utm_term=HOME_MISSION');
  });

  it('recognizes organic X campaigns only', () => {
    expect(isXOrganicCampaign({ utm_source: X_UTM_SOURCE, utm_medium: X_UTM_MEDIUM })).toBe(true);
    expect(isXOrganicCampaign({ utm_source: 'google', utm_medium: 'cpc' })).toBe(false);
    expect(isXOrganicCampaign(undefined)).toBe(false);
  });
});
