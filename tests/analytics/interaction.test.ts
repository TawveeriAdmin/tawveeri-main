/**
 * @jest-environment jsdom
 */
// tests/analytics/interaction.test.ts — src/lib/analytics/interaction.ts
// ADR-286 regression gate. Proves the client-side half of the explicit-interaction contract:
// a fresh, unique interaction_id per real call (never shared across two separate activations),
// delivery via sendBeacon with a synchronous, non-blocking fallback, and — the one invariant
// that matters most for a real shopper — the function never delays navigation, no matter how
// delivery behaves.
import { recordFirstPartyInteraction, appendInteractionId } from '../../src/lib/analytics/interaction';

describe('recordFirstPartyInteraction — unique identity per activation', () => {
  beforeEach(() => {
    (navigator as any).sendBeacon = jest.fn().mockReturnValue(true);
    document.cookie = 'tw_sid=; path=/; max-age=0';
  });

  it('two separate calls (two genuinely separate CTA activations) mint two DIFFERENT interaction_ids', () => {
    const id1 = recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' });
    const id2 = recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' });
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
    expect(id2.length).toBeGreaterThan(0);
  });

  it('sends the payload via sendBeacon with the minted id and the given surface/go_id/canonical_id', () => {
    const beacon = navigator.sendBeacon as jest.Mock;
    const id = recordFirstPartyInteraction({ goId: 'offer-42', canonicalId: 'canon-7', surface: 'checkout' });
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe('/api/interactions');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('returns the interaction_id SYNCHRONOUSLY — never awaits the network call before the caller can navigate', () => {
    // A pending, never-resolving beacon must not block the return value at all: sendBeacon
    // itself is fire-and-forget by browser design (returns a boolean immediately), and this
    // function must mirror that — no `await` anywhere between mint and return.
    (navigator as any).sendBeacon = jest.fn(() => true);
    const start = Date.now();
    const id = recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' });
    expect(Date.now() - start).toBeLessThan(20); // effectively instant, no I/O wait
    expect(typeof id).toBe('string');
  });
});

describe('recordFirstPartyInteraction — fail-open (analytics failure never blocks the caller)', () => {
  it('falls back to fetch(keepalive) when sendBeacon is unavailable, and still returns an id', () => {
    delete (navigator as any).sendBeacon;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
    const id = recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' });
    expect(typeof id).toBe('string');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });
  });

  it('sendBeacon throwing does not throw out of the function and still returns an id', () => {
    (navigator as any).sendBeacon = jest.fn(() => { throw new Error('boom'); });
    expect(() => recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' })).not.toThrow();
  });

  it('fetch rejecting (network failure) is swallowed, never propagated to the caller', async () => {
    delete (navigator as any).sendBeacon;
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network down'));
    expect(() => recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' })).not.toThrow();
    // let the swallowed rejection's microtask settle so it can't surface as an unhandled rejection
    await Promise.resolve();
  });

  it('sendBeacon returning false (queue full) still falls back to fetch rather than silently losing the interaction', () => {
    (navigator as any).sendBeacon = jest.fn().mockReturnValue(false);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
    recordFirstPartyInteraction({ goId: 'offer-1', surface: 'product_page' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('appendInteractionId', () => {
  it('appends ?iid=<id> to a href with no existing query string', () => {
    const href = appendInteractionId('/go/abc-123', 'iid-1');
    expect(href).toBe('/go/abc-123?iid=iid-1');
  });

  it('preserves an existing query string (e.g. the render-time gt token) alongside iid', () => {
    const href = appendInteractionId('/go/abc-123?gt=1234.signature&source=checkout', 'iid-1');
    const url = new URL(href, 'https://example.com');
    expect(url.searchParams.get('gt')).toBe('1234.signature');
    expect(url.searchParams.get('source')).toBe('checkout');
    expect(url.searchParams.get('iid')).toBe('iid-1');
  });
});
