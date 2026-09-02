// tests/campaigns/destination-validation.test.ts
import { validateCampaignDestination, isApprovedMerchantHost } from '@/lib/campaigns/destination-validation';

describe('isApprovedMerchantHost', () => {
  it('accepts amazon.sa and other amazon.* marketplaces for merchant "amazon"', () => {
    expect(isApprovedMerchantHost('amazon', 'www.amazon.sa')).toBe(true);
    expect(isApprovedMerchantHost('amazon', 'amazon.sa')).toBe(true);
  });
  it('rejects a non-amazon host for merchant "amazon"', () => {
    expect(isApprovedMerchantHost('amazon', 'www.noon.com')).toBe(false);
    expect(isApprovedMerchantHost('amazon', 'amazon-sa.evil.example')).toBe(false);
  });
  it('accepts noon.com for merchant "noon"', () => {
    expect(isApprovedMerchantHost('noon', 'www.noon.com')).toBe(true);
  });
  it('rejects a non-noon host for merchant "noon", including a noon.com lookalike', () => {
    expect(isApprovedMerchantHost('noon', 'www.amazon.sa')).toBe(false);
    expect(isApprovedMerchantHost('noon', 'noon.com.evil.example')).toBe(false);
  });
});

describe('validateCampaignDestination', () => {
  it('rejects an unparseable URL', () => {
    expect(validateCampaignDestination('amazon', 'not a url').valid).toBe(false);
  });
  it('rejects a non-http(s) protocol', () => {
    expect(validateCampaignDestination('amazon', 'javascript:alert(1)').valid).toBe(false);
    expect(validateCampaignDestination('amazon', 'ftp://amazon.sa/x').valid).toBe(false);
  });
  it('rejects an arbitrary external destination for Amazon (open-redirect guard)', () => {
    const result = validateCampaignDestination('amazon', 'https://evil-phishing-site.example/deals');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('host_not_approved_for_merchant');
  });
  it('rejects an arbitrary external destination for Noon', () => {
    expect(validateCampaignDestination('noon', 'https://evil-phishing-site.example/deals').valid).toBe(false);
  });
  it('accepts a real Amazon SA category/campaign URL', () => {
    expect(validateCampaignDestination('amazon', 'https://www.amazon.sa/gp/browse.html?node=123').valid).toBe(true);
  });
  it('accepts a real Noon URL', () => {
    expect(validateCampaignDestination('noon', 'https://www.noon.com/saudi-en/electronics/').valid).toBe(true);
  });
});
