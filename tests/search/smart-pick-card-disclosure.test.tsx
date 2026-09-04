/**
 * @jest-environment jsdom
 */
// tests/search/smart-pick-card-disclosure.test.tsx
// Founder Differentiation Mission (2026-09-04) — the Smart Pick card's ONE decision-
// confidence disclosure line, rendered from the shared Trust & Evidence Engine
// (src/lib/intelligence/evidence-engine.ts) instead of computed here.
import { render, screen } from '@testing-library/react';
import { SmartPickCard, type SmartPick } from '@/components/search/smart-pick-card';

const basePick: SmartPick = {
  title: 'ابل ايفون 15 128 جيجابايت',
  best_price: 2999,
  store_name: 'Jarir',
  product_url: 'https://example.com/p/1',
  canonical_id: 'canon-1',
  store_count: 2,
  reason_ar: 'أفضل سعر بين المتاجر',
  is_tps: true,
  compare_url: '/ar/compare/canon-1',
  last_observed_at: null,
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  (global as unknown as { navigator: Navigator }).navigator = { ...navigator, sendBeacon: undefined } as unknown as Navigator;
  window.sessionStorage.clear();
});

describe('SmartPickCard — decision-confidence disclosure', () => {
  it('renders the condition warning when the pick is renewed', () => {
    render(<SmartPickCard locale="ar" pick={{
      ...basePick,
      trust: { score: 60, tier: 'medium', factors: [], conditionWarning: { ar: 'هذا العرض مُجدَّد وليس جديدًا', en: 'This offer is renewed, not new' } },
    }} />);
    const line = screen.getByTestId('pick-disclosure-line');
    expect(line).toHaveTextContent('مُجدَّد');
    expect(line).toHaveAttribute('data-disclosure-kind', 'condition');
  });

  it('renders the identity disclosure when a price-determining spec is unconfirmed (and no condition issue)', () => {
    render(<SmartPickCard locale="ar" pick={{
      ...basePick,
      trust: {
        score: 55, tier: 'medium', conditionWarning: null,
        factors: [{ key: 'identity', label_ar: '', label_en: '', weight: 0.22, value: 0.4, contribution: 9, status: 'weak', evidence_ar: '', evidence_en: '' }],
      },
    }} />);
    expect(screen.getByTestId('pick-disclosure-line')).toHaveAttribute('data-disclosure-kind', 'identity');
  });

  it('renders the price-consistency disclosure when the cross-store spread is wide', () => {
    render(<SmartPickCard locale="ar" pick={{
      ...basePick,
      trust: {
        score: 55, tier: 'medium', conditionWarning: null,
        factors: [{ key: 'price_consistency', label_ar: '', label_en: '', weight: 0.08, value: 0.25, contribution: 2, status: 'weak', evidence_ar: '', evidence_en: '' }],
      },
    }} />);
    expect(screen.getByTestId('pick-disclosure-line')).toHaveAttribute('data-disclosure-kind', 'price_consistency');
  });

  it('condition takes priority over an identity or price-consistency issue on the same pick', () => {
    render(<SmartPickCard locale="ar" pick={{
      ...basePick,
      trust: {
        score: 40, tier: 'low',
        conditionWarning: { ar: 'هذا العرض مستعمل وليس جديدًا', en: 'This offer is used, not new' },
        factors: [{ key: 'identity', label_ar: '', label_en: '', weight: 0.22, value: 0.3, contribution: 6, status: 'weak', evidence_ar: '', evidence_en: '' }],
      },
    }} />);
    expect(screen.getByTestId('pick-disclosure-line')).toHaveAttribute('data-disclosure-kind', 'condition');
  });

  it('renders NO disclosure line when trust is strong and nothing needs flagging (no false warnings)', () => {
    render(<SmartPickCard locale="ar" pick={{
      ...basePick,
      trust: {
        score: 90, tier: 'high', conditionWarning: null,
        factors: [{ key: 'identity', label_ar: '', label_en: '', weight: 0.22, value: 0.9, contribution: 20, status: 'strong', evidence_ar: '', evidence_en: '' }],
      },
    }} />);
    expect(screen.queryByTestId('pick-disclosure-line')).not.toBeInTheDocument();
  });

  it('renders no disclosure line at all when the pick carries no trust object (older cached response)', () => {
    render(<SmartPickCard locale="ar" pick={basePick} />);
    expect(screen.queryByTestId('pick-disclosure-line')).not.toBeInTheDocument();
  });

  it('the English disclosure text renders for the English locale', () => {
    render(<SmartPickCard locale="en" pick={{
      ...basePick,
      trust: { score: 60, tier: 'medium', factors: [], conditionWarning: { ar: 'هذا العرض مُجدَّد وليس جديدًا', en: 'This offer is renewed, not new' } },
    }} />);
    expect(screen.getByTestId('pick-disclosure-line')).toHaveTextContent('renewed, not new');
  });
});
