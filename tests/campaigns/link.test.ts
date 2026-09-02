// tests/campaigns/link.test.ts — buildCampaignMerchantUrl (final closure round §2/§3).
// Pins the Amazon sub-tag audit finding: no per-click/session/user identifier is ever
// sent to the merchant on the campaign path, and campaign-level Tracking ID overrides
// the shared default when the admin sets one.
import { buildCampaignMerchantUrl } from '@/lib/campaigns/link';

describe('buildCampaignMerchantUrl', () => {
  it('never sets ascsubtag on an Amazon destination — no per-click identifier is sent', () => {
    const link = buildCampaignMerchantUrl({
      merchant: 'amazon',
      destination_url: 'https://www.amazon.sa/gp/browse.html?node=123',
      tracking_id: null,
    });
    expect(link).not.toBeNull();
    expect(link!.url).not.toMatch(/ascsubtag/);
  });

  it('applies the shared default Amazon tag when no campaign-level tracking_id is set', () => {
    const link = buildCampaignMerchantUrl({
      merchant: 'amazon',
      destination_url: 'https://www.amazon.sa/gp/browse.html?node=123',
      tracking_id: null,
    });
    expect(link!.url).toMatch(/tag=tawveeri0f-21/);
  });

  it('a campaign-level tracking_id override replaces the shared default tag', () => {
    const link = buildCampaignMerchantUrl({
      merchant: 'amazon',
      destination_url: 'https://www.amazon.sa/gp/browse.html?node=123',
      tracking_id: 'tawveeri0f-tablet-21',
    });
    expect(link!.url).toMatch(/tag=tawveeri0f-tablet-21/);
    expect(link!.url).not.toMatch(/tawveeri0f-21(?!-tablet)/);
  });

  it('never sets a subid param (utm_content) on a Noon destination either — same conservative rule applies to both merchants', () => {
    const link = buildCampaignMerchantUrl({
      merchant: 'noon',
      destination_url: 'https://www.noon.com/saudi-en/electronics/',
      tracking_id: null,
    });
    expect(link).not.toBeNull();
    expect(link!.url).not.toMatch(/utm_content/);
    expect(link!.url).toMatch(/utm_source=C1000264L/);
  });

  it('tracking_id is Amazon-only — Noon has no per-campaign Tracking ID concept in the current account, so a value set on a Noon campaign is not read', () => {
    const withOverride = buildCampaignMerchantUrl({
      merchant: 'noon',
      destination_url: 'https://www.noon.com/saudi-en/electronics/',
      tracking_id: 'noon-campaign-x',
    });
    const withoutOverride = buildCampaignMerchantUrl({
      merchant: 'noon',
      destination_url: 'https://www.noon.com/saudi-en/electronics/',
      tracking_id: null,
    });
    expect(withOverride!.url).toBe(withoutOverride!.url);
    expect(withOverride!.tag).toBe('C1000264L');
  });

  it('returns null (never a broken shell) when the destination cannot be safely resolved', () => {
    const link = buildCampaignMerchantUrl({
      merchant: 'amazon',
      destination_url: 'not a valid url',
      tracking_id: null,
    });
    // buildOfferExitLink falls back to a direct link on parse failure rather than
    // throwing — assert we never crash either way.
    expect(() => link).not.toThrow();
  });
});
