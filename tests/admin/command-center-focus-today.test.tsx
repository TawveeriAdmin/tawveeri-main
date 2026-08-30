/**
 * @jest-environment jsdom
 */
// Founder Command Center — FOCUS TODAY dashboard rendering (ADR-277). FocusTodayView is a pure
// presentational component (no data fetching of its own) — these tests give it every
// FocusTodayResult shape computeFocusToday() can actually return (see
// tests/admin/focus-today.test.ts for that function's own contract) and assert the dashboard
// renders the SAME evidence/tiers the email does, with the same escaping discipline.
import { render, screen } from '@testing-library/react';
import { FocusTodayView, FocusTodaySection } from '@/app/[locale]/admin/command-center/focus-today';
import type { FocusTodayResult } from '@/lib/admin/focus-today';

describe('FocusTodayView', () => {
  it('renders nothing when the result is {enabled:false}', () => {
    const { container } = render(<FocusTodayView result={{ enabled: false }} isRTL />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the "AI unavailable" note with the stated reason when aiAvailable is false', () => {
    const result: FocusTodayResult = { enabled: true, aiAvailable: false, reason: 'Anthropic API 500' };
    render(<FocusTodayView result={result} isRTL />);
    expect(screen.getByText(/تعذر توليد توصيات الذكاء الاصطناعي اليوم/)).toBeInTheDocument();
    expect(screen.getByText(/Anthropic API 500/)).toBeInTheDocument();
  });

  it('renders the "no strong signal" note for an empty focusItems array', () => {
    const result: FocusTodayResult = { enabled: true, aiAvailable: true, focusItems: [] };
    render(<FocusTodayView result={result} isRTL />);
    expect(screen.getByText(/لا توجد إشارة قوية بما يكفي/)).toBeInTheDocument();
  });

  it('discloses the fixed 7-day window (ADR-278) — independent of the period selector shown elsewhere on the dashboard', () => {
    const result: FocusTodayResult = { enabled: true, aiAvailable: true, focusItems: [] };
    render(<FocusTodayView result={result} isRTL />);
    expect(screen.getByText(/آخر 7 أيام/)).toBeInTheDocument();
  });

  it('renders a real focus item with its ACT badge, domain, evidence confidence, and early-signal marker', () => {
    const result: FocusTodayResult = {
      enabled: true, aiAvailable: true,
      focusItems: [{
        candidateId: 'c0', titleAr: 'عنوان الفرصة', evidenceAr: 'دليل الفرصة',
        sampleSize: 150, earlySignal: true, domain: 'commercial',
        evidenceConfidence: 'high', actionTier: 'ACT',
        whyNowAr: 'لأن الطلب حقيقي', recommendedActionAr: 'راجع الفئة',
        riskCaveatAr: 'عينة صغيرة', whatToMeasureNextAr: '',
      }],
    };
    render(<FocusTodayView result={result} isRTL />);
    expect(screen.getByText('عنوان الفرصة')).toBeInTheDocument();
    expect(screen.getByText('جاهز للتحرك')).toBeInTheDocument(); // ACT badge, same label as the email
    expect(screen.getByText(/تجاري/)).toBeInTheDocument(); // commercial domain label
    expect(screen.getByText(/عالية/)).toBeInTheDocument(); // high evidence confidence
    expect(screen.getByText(/إشارة مبكرة/)).toBeInTheDocument();
    expect(screen.getByText(/لأن الطلب حقيقي/)).toBeInTheDocument();
    expect(screen.getByText(/راجع الفئة/)).toBeInTheDocument();
    expect(screen.getByText(/عينة صغيرة/)).toBeInTheDocument();
  });

  it('renders the WATCH and INSUFFICIENT_EVIDENCE badges with their own labels, matching the email\'s vocabulary exactly', () => {
    const base = {
      candidateId: 'c0', titleAr: 't', evidenceAr: 'e', sampleSize: 1, earlySignal: false,
      domain: 'catalog_coverage' as const, whyNowAr: 'w', recommendedActionAr: 'r',
      riskCaveatAr: '', whatToMeasureNextAr: '',
    };
    const { rerender } = render(<FocusTodayView result={{
      enabled: true, aiAvailable: true,
      focusItems: [{ ...base, evidenceConfidence: 'medium', actionTier: 'WATCH' }],
    }} isRTL />);
    expect(screen.getByText('راقب فقط')).toBeInTheDocument();

    rerender(<FocusTodayView result={{
      enabled: true, aiAvailable: true,
      focusItems: [{ ...base, evidenceConfidence: 'low', actionTier: 'INSUFFICIENT_EVIDENCE' }],
    }} isRTL />);
    expect(screen.getByText('دليل غير كافٍ بعد')).toBeInTheDocument();
  });

  it('React itself escapes model-influenced text content — no raw HTML injection path exists in this component', () => {
    const result: FocusTodayResult = {
      enabled: true, aiAvailable: true,
      focusItems: [{
        candidateId: 'c0', titleAr: '<img src=x onerror=alert(1)>', evidenceAr: 'A & B',
        sampleSize: 1, earlySignal: false, domain: 'marketing_content',
        evidenceConfidence: 'high', actionTier: 'ACT',
        whyNowAr: '<script>steal()</script>', recommendedActionAr: 'y', riskCaveatAr: '', whatToMeasureNextAr: '',
      }],
    };
    const { container } = render(<FocusTodayView result={result} isRTL />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText(/A & B/)).toBeInTheDocument();
  });

  it('renders English labels when isRTL is false', () => {
    const result: FocusTodayResult = {
      enabled: true, aiAvailable: true,
      focusItems: [{
        candidateId: 'c0', titleAr: 't', evidenceAr: 'e', sampleSize: 1, earlySignal: false,
        domain: 'commercial', evidenceConfidence: 'high', actionTier: 'ACT',
        whyNowAr: 'w', recommendedActionAr: 'r', riskCaveatAr: '', whatToMeasureNextAr: '',
      }],
    };
    render(<FocusTodayView result={result} isRTL={false} />);
    expect(screen.getByText('ACT')).toBeInTheDocument();
    expect(screen.getByText('Focus today on')).toBeInTheDocument();
  });
});

describe('FocusTodaySection — kill-switch cost', () => {
  it('renders nothing (returns null synchronously, no Suspense boundary) when the AI brief is off', () => {
    const original = process.env.ENABLE_FOUNDER_AI_BRIEF;
    delete process.env.ENABLE_FOUNDER_AI_BRIEF;
    try {
      const element = FocusTodaySection({ data: {} as never, isRTL: true });
      expect(element).toBeNull();
    } finally {
      if (original) process.env.ENABLE_FOUNDER_AI_BRIEF = original;
    }
  });
});
