// tests/campaigns/click-token.test.ts — the anti-forgery token for
// POST /api/campaigns/click (final closure round §3).
import { issueClickToken, verifyClickToken } from '@/lib/campaigns/click-token';

const CAMPAIGN_A = 'cc11111-1111-1111-1111-111111111111';
const CAMPAIGN_B = 'cc22222-2222-2222-2222-222222222222';
const NOW = new Date('2026-09-02T12:00:00Z');

describe('issueClickToken / verifyClickToken', () => {
  it('a freshly issued token verifies for the same campaign', () => {
    const token = issueClickToken(CAMPAIGN_A, NOW);
    expect(verifyClickToken(CAMPAIGN_A, token, NOW).valid).toBe(true);
  });

  it('a token issued for one campaign does not verify for another (cannot be replayed across campaigns)', () => {
    const token = issueClickToken(CAMPAIGN_A, NOW);
    const result = verifyClickToken(CAMPAIGN_B, token, NOW);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('expires after the TTL window', () => {
    const token = issueClickToken(CAMPAIGN_A, NOW);
    const justUnder = new Date(NOW.getTime() + 29 * 60 * 1000);
    const justOver = new Date(NOW.getTime() + 31 * 60 * 1000);
    expect(verifyClickToken(CAMPAIGN_A, token, justUnder).valid).toBe(true);
    expect(verifyClickToken(CAMPAIGN_A, token, justOver).valid).toBe(false);
    expect(verifyClickToken(CAMPAIGN_A, token, justOver).reason).toBe('expired');
  });

  it('rejects a malformed token without throwing', () => {
    expect(verifyClickToken(CAMPAIGN_A, 'not-a-token', NOW).valid).toBe(false);
    expect(verifyClickToken(CAMPAIGN_A, '', NOW).valid).toBe(false);
    expect(verifyClickToken(CAMPAIGN_A, null, NOW).valid).toBe(false);
    expect(verifyClickToken(CAMPAIGN_A, undefined, NOW).valid).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const token = issueClickToken(CAMPAIGN_A, NOW);
    const [issuedAt] = token.split('.');
    const tampered = `${issuedAt}.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`;
    expect(verifyClickToken(CAMPAIGN_A, tampered, NOW).valid).toBe(false);
  });

  it('rejects a token with a future issuedAt (clock-skew forgery attempt)', () => {
    const future = new Date(NOW.getTime() + 5 * 60 * 1000);
    const token = issueClickToken(CAMPAIGN_A, future);
    expect(verifyClickToken(CAMPAIGN_A, token, NOW).valid).toBe(false);
  });
});
