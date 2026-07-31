'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ShieldCheck, Zap, Check, Store, ArrowLeft, ArrowRight, Loader2, CircleAlert, TrendingDown, Clock, Info, HelpCircle, AlertTriangle } from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Price } from '@/components/ui/price';
import {
  askAdvisor, comparisonBadge, costLines, exitHref, hasTotalBeyondUnit,
  parsedSummary, recTitle, verdictTone, verdictText, choiceReasons, discountLine, alternativeLabel,
  evidenceGroups,
  type AdvisorRecommendation, type AdvisorResponse, type Locale,
} from '@/lib/agent/advisor-api';
import { track, initTestModeFromUrl } from '@/lib/analytics/track';

const EXAMPLES: Record<Locale, string[]> = {
  ar: [
    'مكيف لغرفة 30 متر هادئ وموفر للكهرباء تحت 4000',
    'لابتوب للألعاب خفيف 16 جيجا رام تحت 5000',
    'غسالة صحون كبيرة للعائلة',
    'تلفزيون للألعاب والأفلام تحت 3000',
    'مكنسة روبوت لاسلكية',
    'قلاية هوائية 8 لتر',
  ],
  en: [
    'a quiet energy-saving AC for a 30 m² room under 4000',
    'a lightweight gaming laptop with 16GB RAM under 5000',
    'a large family dishwasher',
    'a TV for gaming and movies under 3000',
    'a cordless robot vacuum',
    'an 8L air fryer',
  ],
};

export function AdvisorClient({ locale, initialQuery }: { locale: string; initialQuery?: string }) {
  const t = useTranslations();
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  const isRTL = loc === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const [query, setQuery] = useState(initialQuery ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setResult(null);
    track('advisor_query', { query_text: q, source: 'agent' });
    try {
      const res = await askAdvisor({ text: q }, { signal: ctrl.signal, limit: 6 });
      if (!ctrl.signal.aborted) {
        setResult(res);
        const category = res.parsed?.category ?? (res.task?.category as string | undefined) ?? null;
        if (res.error || res.count === 0) track('no_answer', { query_text: q, category, meta: { error: res.error ?? null, supported: res.supported } });
        else {
          track('advisor_result', { category, query_text: q, source: 'agent', meta: { count: res.count, supported: res.supported, has_smart_pick: !!res.smart_pick } });
          // Comparison funnel step (advisor surface): the result set surfaced a real multi-store comparison.
          const comparableRecs = (res.recommendations ?? []).filter((r) => (r?.stores?.length ?? 0) >= 2).length;
          if (comparableRecs > 0) track('comparison_view', { category, query_text: q, source: 'agent', meta: { comparable_recs: comparableRecs } });
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted) { setResult({ version: 'v1', task: {}, supported: false, count: 0, recommendations: [], error: (e as Error)?.message ?? 'error' }); track('error', { query_text: q, meta: { message: (e as Error)?.message } }); }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  // Persist test-mode opt-in (?test=1) and auto-run a deep-linked query (?q=…) once on mount.
  useEffect(() => {
    initTestModeFromUrl();
    if (initialQuery && initialQuery.trim()) run(initialQuery);
    return () => abortRef.current?.abort();
  }, [initialQuery, run]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); run(query); };

  const smart = result?.smart_pick ?? null;
  const rest = (result?.recommendations ?? []).filter((r) => !r.is_smart_pick);
  const chips = parsedSummary(result?.parsed, loc);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-on-primary">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          {t('agent.deterministicBadge')}
        </span>
        <h1 className="mt-3 text-2xl font-bold text-on-surface sm:text-3xl">{t('agent.title')}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-on-surface-variant sm:text-base">{t('agent.subtitle')}</p>

        {/* AI DISCLOSURE — LAUNCH_VOCABULARY §8, approved wording, do not paraphrase.
            Placed at the interaction point, above the input, so it is read BEFORE the first
            answer rather than after it. A footer or a dismissed onboarding screen does not
            satisfy this, and neither does the name: "وفّر" and "مساعدك الذكي" tell a customer
            nothing about what they are talking to.
            The second clause — «بناءً على أسعار رصدناها» — is load-bearing and must survive any
            edit: it states what the answers rest on, which is the whole difference between this
            and a chatbot with opinions.
            Adopted as a transparency standard and forward-looking compliance hygiene. It is NOT
            a claim that EU law governs Tawveeri in Saudi Arabia, and no compliance claim may be
            published anywhere. */}
        <p
          className="mx-auto mt-2 max-w-xl text-xs text-on-surface-variant/90 sm:text-sm"
          data-testid="waffar-ai-disclosure"
        >
          {t('agent.aiDisclosure')}
        </p>
      </header>

      {/* Ask form */}
      <form onSubmit={onSubmit} className="mt-6">
        <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-2 shadow-sm focus-within:border-primary-400">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(query); } }}
            placeholder={t('agent.placeholder')}
            rows={2}
            aria-label={t('agent.title')}
            className="w-full resize-none bg-transparent px-3 py-2 text-base text-on-surface outline-none placeholder:text-on-surface-variant/70"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
              <ShieldCheck className="h-3.5 w-3.5 text-success-600" aria-hidden />
              {t('agent.neutralityNote')}
            </span>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
              {t('agent.submit')}
            </button>
          </div>
        </div>
      </form>

      {/* Examples */}
      {!result && !loading && (
        <div className="mt-4">
          <span className="text-xs text-on-surface-variant">{t('agent.examplesLabel')}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES[loc].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => { setQuery(ex); run(ex); }}
                className="rounded-full border border-[color:var(--color-outline-variant)] bg-surface-container-low px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-primary-300 hover:text-on-surface"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-8 space-y-3" aria-live="polite">
          <div className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('agent.thinking')}
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-high" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface-container-high" />
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <section className="mt-8" aria-live="polite">
          {/* Understood-as chips */}
          {chips.length > 0 && (
            <div className="mb-4">
              <span className="text-xs text-on-surface-variant">{t('agent.understoodAs')}:</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((c, i) => (
                  <span key={`${c}-${i}`} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">{c}</span>
                ))}
              </div>
              {result.parsed?.unresolved?.includes('room_size_m2') && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-warning-700 dark:text-warning-400">
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden />{t('agent.addRoomSize')}
                </p>
              )}
            </div>
          )}

          {/* Error (unparseable) */}
          {result.error && (
            <div className="rounded-2xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-900/50 dark:bg-warning-950/30">
              <h2 className="flex items-center gap-2 text-base font-semibold text-on-surface"><CircleAlert className="h-4 w-4 text-warning-600" aria-hidden />{t('agent.errorTitle')}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{t('agent.errorBody')}</p>
            </div>
          )}

          {/* count:0 — honest empty state (no fabrication) */}
          {!result.error && result.count === 0 && (
            <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-low p-5">
              <h2 className="text-base font-semibold text-on-surface">{t('agent.noResultsTitle')}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{t('agent.noResultsBody')}</p>
            </div>
          )}

          {/* not-supported note (still shows a neutral price fallback below) */}
          {!result.error && result.count > 0 && result.supported === false && (
            <div className="mb-4 rounded-xl border border-[color:var(--color-outline-variant)] bg-surface-container-low p-3 text-xs text-on-surface-variant">
              {t('agent.notSupportedBody')}
            </div>
          )}

          {/* Smart Pick */}
          {smart && <SmartPick rec={smart} loc={loc} t={t} isRTL={isRTL} Arrow={Arrow} />}

          {/* More options */}
          {rest.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 text-sm font-semibold text-on-surface-variant">{t('agent.moreOptions')}</h2>
              <div className="space-y-3">
                {rest.map((r) => <OptionCard key={r.canonical_id} rec={r} loc={loc} t={t} isRTL={isRTL} Arrow={Arrow} />)}
              </div>
            </>
          )}

          {/* Neutrality footer */}
          {result.count > 0 && (
            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-variant">
              <ShieldCheck className="h-3.5 w-3.5 text-success-600" aria-hidden />{t('agent.neutralityNote')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons?.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {reasons.slice(0, 5).map((r, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

const VERDICT_TONE_CLASS: Record<string, string> = {
  great: 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300',
  good: 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300',
  neutral: 'bg-surface-container-high text-on-surface-variant',
  warn: 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-400',
  muted: 'bg-surface-container-high text-on-surface-variant',
};

function DiscountTruthBadge({ rec, loc }: { rec: AdvisorRecommendation; loc: Locale }) {
  const d = discountLine(rec, loc);
  if (!d) return null;
  const Icon = d.tone === 'great' ? TrendingDown : CircleAlert;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${VERDICT_TONE_CLASS[d.tone]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{d.text}
    </span>
  );
}

function PriceVerdictBadge({ rec, loc }: { rec: AdvisorRecommendation; loc: Locale }) {
  const pi = rec.price_intel;
  if (!pi) return null;
  const text = verdictText(pi, loc);
  if (!text) return null;
  const tone = verdictTone(pi.verdict);
  const Icon = pi.verdict === 'building_history' ? Clock : pi.verdict === 'great_price' || pi.verdict === 'good_price' ? TrendingDown : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${VERDICT_TONE_CLASS[tone]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{text}
    </span>
  );
}

function Alternatives({ rec, loc }: { rec: AdvisorRecommendation; loc: Locale }) {
  const alts = rec.alternatives;
  if (!alts || alts.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold text-on-surface-variant">{loc === 'ar' ? 'خيارات ذات صلة' : 'Related options'}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {alts.map((a) => (
          <span key={a.id} className="rounded-full border border-[color:var(--color-outline-variant)] bg-surface-container-low px-2.5 py-1 text-[11px] text-on-surface-variant">
            {alternativeLabel(a, loc)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChoiceComparison({ rec, loc, t }: { rec: AdvisorRecommendation; loc: Locale; t: TFn }) {
  const c = choiceReasons(rec, loc);
  if (!c) return null;
  return (
    <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/50 px-3 py-2 dark:border-primary-900/50 dark:bg-primary-950/20">
      <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">
        {t('agent.vsAlternative')}{c.alt ? ` «${c.alt}»` : ''}:
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">{c.reasons.join(' · ')}</p>
    </div>
  );
}

function TrustBadge({ rec, loc }: { rec: AdvisorRecommendation; loc: Locale }) {
  const b = comparisonBadge(rec, loc);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${b.verified ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300' : 'bg-surface-container-high text-on-surface-variant'}`}>
      <Store className="h-3 w-3" aria-hidden />{b.text}
    </span>
  );
}

function CostBlock({ rec, loc, t }: { rec: AdvisorRecommendation; loc: Locale; t: TFn }) {
  const lines = costLines(rec, loc);
  const showTotal = hasTotalBeyondUnit(rec);
  return (
    <div className="text-end">
      <div className="text-[11px] text-on-surface-variant">{showTotal ? t('agent.totalCost') : t('agent.unitPrice')}</div>
      <Price amount={(showTotal ? rec.total_cost_estimate : rec.unit_price) ?? 0} className="text-xl font-bold text-primary-700 dark:text-primary-300" />
      {showTotal && lines.length > 1 && (
        <ul className="mt-1 space-y-0.5 text-[11px] text-on-surface-variant">
          {lines.map((l, i) => (
            <li key={i} className="flex items-center justify-end gap-1">
              <span>{l.label}</span><span className="tabular-nums">{Math.round(l.amount).toLocaleString(loc === 'ar' ? 'ar-SA' : 'en-US')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExitButtons({ rec, loc, t, Arrow }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; Arrow: typeof ArrowRight }) {
  const href = exitHref(rec, loc);
  const external = !!rec.go_url;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        onClick={() => track('go_click', { canonical_id: rec.canonical_id, store: rec.stores?.[0] ?? null, category: (rec.dna?.category as string) ?? null, source: 'agent', meta: { measured: external } })}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-700"
      >
        {t('agent.viewOffer')}<Arrow className="h-4 w-4" aria-hidden />
      </a>
      {rec.comparison_available && (
        <Link
          href={`/${loc}/compare/${encodeURIComponent(rec.tps_identity_key)}`}
          className="inline-flex h-10 items-center rounded-xl border border-[color:var(--color-outline-variant)] px-4 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          {t('agent.compareStores')}
        </Link>
      )}
      <span className="text-[11px] text-on-surface-variant">· {t('agent.confidence')} {rec.confidence}%</span>
    </div>
  );
}

function TrustScoreChip({ rec, loc, t }: { rec: AdvisorRecommendation; loc: Locale; t: TFn }) {
  const s = rec.trust?.score;
  if (typeof s !== 'number') return null;
  const tier = rec.trust?.tier ?? (s >= 72 ? 'high' : s >= 50 ? 'medium' : 'low');
  const cls = tier === 'high'
    ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
    : tier === 'medium' ? 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-400'
    : 'bg-surface-container-high text-on-surface-variant';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`} title={t('agent.trustScoreLabel')}>
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t('agent.trustScoreLabel')}: {s}/100
    </span>
  );
}

/**
 * The trust experience (Founder Directive Part 2): show the customer, in clear Arabic,
 * exactly what a recommendation is built on — and let them DISTINGUISH a verified fact
 * from an inference, an unknown, and insufficient evidence. Every line is the engine's
 * own cited evidence; nothing is fabricated here.
 */
function EvidencePanel({ rec, loc, t }: { rec: AdvisorRecommendation; loc: Locale; t: TFn }) {
  const g = evidenceGroups(rec, loc);
  const groups: { key: string; items: string[]; label: string; hint?: string; Icon: typeof Check; cls: string; iconCls: string }[] = [
    { key: 'facts', items: g.facts, label: t('agent.evidenceFacts'), hint: t('agent.evidenceFactsHint'), Icon: Check, cls: 'border-success-200 bg-success-50/60 dark:border-success-900/50 dark:bg-success-950/20', iconCls: 'text-success-600' },
    { key: 'inferences', items: g.inferences, label: t('agent.evidenceInferences'), hint: t('agent.evidenceInferencesHint'), Icon: Info, cls: 'border-primary-100 bg-primary-50/40 dark:border-primary-900/50 dark:bg-primary-950/20', iconCls: 'text-primary-600' },
    { key: 'insufficient', items: g.insufficient, label: t('agent.evidenceInsufficient'), hint: t('agent.evidenceInsufficientHint'), Icon: AlertTriangle, cls: 'border-warning-200 bg-warning-50/50 dark:border-warning-900/50 dark:bg-warning-950/20', iconCls: 'text-warning-600' },
    { key: 'unknown', items: g.unknown, label: t('agent.evidenceUnknown'), hint: t('agent.evidenceUnknownHint'), Icon: HelpCircle, cls: 'border-[color:var(--color-outline-variant)] bg-surface-container-low', iconCls: 'text-on-surface-variant' },
  ].filter((x) => x.items.length > 0);
  if (!groups.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-success-600" aria-hidden />
        <span className="text-sm font-semibold text-on-surface">{t('agent.evidenceTitle')}</span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-on-surface-variant">{t('agent.evidenceIntro')}</p>
      <div className="space-y-2">
        {groups.map((grp) => (
          <div key={grp.key} className={`rounded-lg border p-2.5 ${grp.cls}`}>
            <div className="flex items-center gap-1.5">
              <grp.Icon className={`h-3.5 w-3.5 ${grp.iconCls}`} aria-hidden />
              <span className="text-xs font-semibold text-on-surface">{grp.label}</span>
            </div>
            <ul className="mt-1 space-y-1">
              {grp.items.map((it, i) => (
                <li key={i} className="ps-5 text-xs leading-relaxed text-on-surface-variant">{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-on-surface-variant">
        <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden />{t('agent.cheaperNotBetter')}
      </p>
    </div>
  );
}

function SmartPick({ rec, loc, t, isRTL, Arrow }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; isRTL: boolean; Arrow: typeof ArrowRight }) {
  // The smart pick shows its evidence panel by default → count it as an evidence view.
  useEffect(() => { track('evidence_view', { canonical_id: rec.canonical_id, meta: { trust_score: rec.trust?.score ?? null, smart_pick: true } }); }, [rec.canonical_id, rec.trust?.score]);
  return (
    <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-surface-container-lowest p-5 dark:border-primary-800 dark:from-primary-950/40 dark:to-surface-container-lowest">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-semibold text-on-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />{t('agent.smartPickLabel')}
        </span>
        <TrustScoreChip rec={rec} loc={loc} t={t} />
        <PriceVerdictBadge rec={rec} loc={loc} />
        <DiscountTruthBadge rec={rec} loc={loc} />
        <TrustBadge rec={rec} loc={loc} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-on-surface">{recTitle(rec, loc)}</h3>
          {rec.reasons_ar?.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-on-surface-variant">{t('agent.evidenceRecommendation')}</p>
          )}
          <Reasons reasons={rec.reasons_ar} />
          <ChoiceComparison rec={rec} loc={loc} t={t} />
          <Alternatives rec={rec} loc={loc} />
        </div>
        <div className="shrink-0"><CostBlock rec={rec} loc={loc} t={t} /></div>
      </div>
      <EvidencePanel rec={rec} loc={loc} t={t} />
      <ExitButtons rec={rec} loc={loc} t={t} Arrow={Arrow} />
    </div>
  );
}

function OptionCard({ rec, loc, t, isRTL, Arrow }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; isRTL: boolean; Arrow: typeof ArrowRight }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-on-surface">{recTitle(rec, loc)}</h3>
            <TrustScoreChip rec={rec} loc={loc} t={t} />
            <PriceVerdictBadge rec={rec} loc={loc} />
            <DiscountTruthBadge rec={rec} loc={loc} />
            <TrustBadge rec={rec} loc={loc} />
          </div>
          <Reasons reasons={rec.reasons_ar} />
        </div>
        <div className="shrink-0"><CostBlock rec={rec} loc={loc} t={t} /></div>
      </div>
      <details className="group mt-3" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track('evidence_view', { canonical_id: rec.canonical_id, meta: { trust_score: rec.trust?.score ?? null, smart_pick: false } }); }}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          <span className="group-open:hidden">{t('agent.showEvidence')}</span>
          <span className="hidden group-open:inline">{t('agent.hideEvidence')}</span>
        </summary>
        <EvidencePanel rec={rec} loc={loc} t={t} />
      </details>
      <ExitButtons rec={rec} loc={loc} t={t} Arrow={Arrow} />
    </div>
  );
}
