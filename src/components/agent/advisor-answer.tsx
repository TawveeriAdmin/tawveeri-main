'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Sparkles, ShieldCheck, Check, Store, ArrowLeft, ArrowRight, CircleAlert,
  TrendingDown, Clock, Info, HelpCircle, AlertTriangle, Calculator, Share2,
} from 'lucide-react';
import { useTranslations } from '@/lib/simple-intl-provider';
import { Price } from '@/components/ui/price';
import {
  comparisonBadge, costLines, exitHref, hasTotalBeyondUnit, recTitle,
  verdictTone, verdictText, choiceReasons, discountLine, alternativeLabel, evidenceGroups,
  type AdvisorRecommendation, type AdvisorResponse, type Locale,
} from '@/lib/agent/advisor-api';
import { ConstraintLedger } from '@/components/agent/constraint-ledger';
import { track } from '@/lib/analytics/track';

/**
 * AdvisorAnswer — the وفّر decision engine's answer, rendered.
 *
 * P2-8 (UNIFIED SEARCH). This used to live inside `/advisor`'s page component. It is a
 * shared component now because the Constitution requires ONE experience, and two surfaces
 * rendering two implementations of "the advisor's answer" is two experiences that merely
 * look alike until one of them is edited. `/advisor` and `/search` render THIS.
 *
 * WHAT IT RENDERS — classified before wiring, on the founder's condition:
 * **structured evidence only. No customer-visible generated prose.**
 * Every string here is either a translation key or a template literal in this repository
 * with MEASURED values substituted — `reasons_ar` from `decision-engine.ts`, evidence
 * factors from `evidence-engine.ts`, the discount line from `discountVerdictFromFacts()`
 * (composed by a pure function, then materialised into `tps_listing_price_facts`). There
 * is no model call anywhere in this path (verified: zero Anthropic/OpenAI/Gemini
 * references under `src/lib/agent/` and `src/app/api/v1/agent/`), so every sentence a
 * customer reads can be found by grep, corrected, and verified — which is exactly the
 * property F7 exists to protect. Product titles come from `canonical_products`, the same
 * retailer-supplied data every search result already shows; they are not authored here.
 *
 * **If that ever stops being true — if any part of this answer is generated at runtime —
 * F7 governs this component and the vocabulary constraint must be enforced before it
 * ships.** That is the line, and it is the reason this note is here rather than in a doc.
 */

type TFn = ReturnType<typeof useTranslations>;

/**
 * The AI disclosure — `docs/LAUNCH_VOCABULARY.md` §8, approved wording, do not paraphrase.
 *
 * The second clause («بناءً على أسعار رصدناها» / "based on prices we observed") is
 * load-bearing and must survive any edit: it states what the answers rest on, which is the
 * whole difference between this and a chatbot with opinions.
 *
 * Adopted as a transparency standard and forward-looking compliance hygiene. It is NOT a
 * claim that EU law governs Tawveeri in Saudi Arabia, and no compliance claim may be
 * published anywhere.
 */
export function WaffarAiDisclosure({ className = '' }: { className?: string }) {
  const t = useTranslations();
  return (
    <p className={className} data-testid="waffar-ai-disclosure">
      {t('agent.aiDisclosure')}
    </p>
  );
}

/**
 * ONE clarification question, shown ABOVE an answer that is already on screen.
 *
 * The Constitution allows one question and only when it changes the outcome — that test ran
 * server-side in `shouldAsk`, against the same engine and rows that produced the answer, so
 * by the time this renders the question has already earned its place. This component never
 * decides whether to ask; it would be the wrong place, because a rule enforced in the view
 * is a rule that the next surface does not inherit.
 *
 * NOT a gate. The recommendation is rendered below regardless, so a shopper who ignores or
 * dismisses this still gets a result — declining costs them nothing. Skip is a real control
 * with a visible label, not an X in a corner.
 */
function ClarifyPrompt({
  clarify, loc, onAnswer, onSkip,
}: {
  clarify: NonNullable<AdvisorResponse['clarify']>;
  loc: Locale;
  onAnswer: (field: string, value: number) => void;
  onSkip: () => void;
}) {
  const ar = loc === 'ar';
  const q = clarify.question;
  return (
    <div
      data-testid="clarify-prompt"
      data-clarify-field={q.field}
      className="mb-4 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-800 dark:bg-primary-950/30"
    >
      <p className="text-sm font-semibold text-on-surface">{ar ? q.question_ar : q.question_en}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {q.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onAnswer(q.field, o.value)}
            className="inline-flex h-9 items-center rounded-full border border-primary-300 bg-[color:var(--color-surface)] px-4 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-700 dark:bg-[color:var(--color-surface-container-low)] dark:text-primary-300 dark:hover:bg-primary-950/60"
          >
            {ar ? o.label_ar : o.label_en}
          </button>
        ))}
        <button
          type="button"
          onClick={onSkip}
          data-testid="clarify-skip"
          className="inline-flex h-9 items-center rounded-full px-3 text-xs font-medium text-on-surface-variant underline underline-offset-4 transition-colors hover:text-on-surface"
        >
          {ar ? 'تخطَّ — اعرض الترشيح الحالي' : 'Skip — show the current recommendation'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-on-surface-variant">
        {ar
          ? 'نسأل فقط حين تُغيّر الإجابة الترشيح فعلًا — والنتيجة أدناه معروضة على أي حال.'
          : 'We only ask when the answer would actually change the recommendation — the result below is shown either way.'}
      </p>
    </div>
  );
}

/**
 * TWO SENTENCES, AND YOU CAN TELL WHAT KIND OF SENTENCE EACH ONE IS (ADR-187 · §8).
 *
 * This rendered up to FIVE reasons, every one behind an identical green check. Two things in
 * REDESIGN_BRIEF §8 were unmet by that, and the founder had already named the first:
 *
 *   *"Two sentences of reasoning, maximum."* — verdict on the previous agent: «كثير ومشتته».
 *   *"Distinguish fact from inference from recommendation."* — «متوفر ومُقارَن في 3 متاجر»
 *   (measured, checkable) and «التكلفة الإجمالية التقديرية ~6643 ريال» (a MODEL: installation
 *   and annual electricity are estimated, never observed) wore the same tick.
 *
 * WHICH two is the ENGINE's decision (`headline_reasons`), not this component's — the ADR-163
 * rule. Nothing is hidden: every remaining reason is one tap away under «لماذا هذا الترشيح؟».
 *
 * The old five-reason list is the fallback for a payload without `headline_reasons`, so a
 * cached response from before this change still renders rather than going blank.
 */
const REASON_MARK: Record<string, { Icon: typeof Check; cls: string }> = {
  caution: { Icon: CircleAlert, cls: 'text-warning-600' },
  estimate: { Icon: Calculator, cls: 'text-on-surface-variant' },
  fit: { Icon: Check, cls: 'text-success-600' },
  spec: { Icon: Check, cls: 'text-success-600' },
  evidence: { Icon: ShieldCheck, cls: 'text-success-600' },
  identity: { Icon: Check, cls: 'text-success-600' },
};

function ReasonLine({ text, kind, t }: { text: string; kind?: string; t: TFn }) {
  // A bullet with no sentence in it is rendered structure making no statement. `text` comes
  // from an ENGINE-supplied index (`headline_reasons`), which this view does not control and
  // must not trust blindly — an index past the end of `reasons_ar` used to render a check
  // mark followed by nothing at all.
  if (!text?.trim()) return null;
  const mark = REASON_MARK[kind ?? 'spec'] ?? REASON_MARK.spec;
  const { Icon, cls } = mark;
  return (
    <li className="flex items-start gap-2 text-sm text-on-surface-variant">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden />
      <span>
        {text}
        {/* An estimate says so. A modelled figure presented as a measurement is the claim
            §8 forbids, and the label is the cheapest possible way to keep it honest. */}
        {kind === 'estimate' && (
          <span className="ms-1.5 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
            {t('agent.estimateLabel')}
          </span>
        )}
      </span>
    </li>
  );
}

function Reasons({ rec, t }: { rec: AdvisorRecommendation; t: TFn }) {
  const all = rec.reasons_ar ?? [];
  if (!all.length) return null;
  const kinds = rec.reason_kinds ?? [];
  const headline = rec.headline_reasons ?? null;
  // Pre-ADR-187 payload: keep the previous behaviour rather than render nothing.
  if (!headline) {
    const said = all.slice(0, 5).map((text, i) => ({ text, i })).filter(({ text }) => text?.trim());
    if (!said.length) return null;
    return (
      <ul className="mt-3 space-y-1.5">
        {said.map(({ text, i }) => <ReasonLine key={i} text={text} kind={kinds[i]} t={t} />)}
      </ul>
    );
  }
  // An engine-supplied index that resolves to nothing carries no reason, so it also must not
  // reserve a slot — otherwise it would both print an empty bullet AND be excluded from `rest`.
  const shown = headline.filter((i) => all[i]?.trim());
  const rest = all.map((text, i) => ({ text, i })).filter(({ text, i }) => text?.trim() && !shown.includes(i));
  if (!shown.length && !rest.length) return null;
  return (
    <>
      {shown.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {shown.map((i) => <ReasonLine key={i} text={all[i]} kind={kinds[i]} t={t} />)}
        </ul>
      )}
      {rest.length > 0 && (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300">
            <span className="group-open:hidden">{t('agent.showAllReasons')}</span>
            <span className="hidden group-open:inline">{t('agent.hideAllReasons')}</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {rest.map(({ text, i }) => <ReasonLine key={i} text={text} kind={kinds[i]} t={t} />)}
          </ul>
        </details>
      )}
    </>
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

function ExitButtons({ rec, loc, t, Arrow, source }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; Arrow: typeof ArrowRight; source: string }) {
  const href = exitHref(rec, loc);
  const external = !!rec.go_url;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        onClick={() => track('go_click', { canonical_id: rec.canonical_id, store: rec.stores?.[0] ?? null, category: (rec.dna?.category as string) ?? null, source, meta: { measured: external } })}
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
      {/* THE CONFIDENCE PERCENTAGE THAT STOOD HERE IS GONE (ADR-163).
          «درجة الثقة 75%» is an engine number wearing customer clothes: a shopper cannot act on
          it, cannot tell 75 from 71, and cannot learn what would make it higher. P2-5's rule is
          exact — *if confidence cannot be explained in customer language, do not display it.*
          The evidence BEHIND the number is still shown, in words, by `TrustSummary` below: how
          many retailers corroborate the price and how recently we observed it. That is the same
          assessment, said in a form a customer can use. */}
    </div>
  );
}

/**
 * WHAT THE SCORE MEANT, SAID IN CUSTOMER LANGUAGE (ADR-163).
 *
 * This was «درجة الثقة الإجمالية: 75/100». A shopper cannot act on 75, cannot tell it from 71,
 * and cannot learn what would raise it. P2-5: *if confidence cannot be explained in customer
 * language, do not display it.*
 *
 * NOTHING IS HIDDEN AND NOTHING IS INVENTED. The tier is the engine's own
 * (`assessTrust().tier`), never re-derived here, and the wording states the EVIDENCE that
 * produced it — corroboration across retailers — which is the one fact a shopper can use and
 * check. The full cited breakdown remains one tap away in the evidence panel.
 */
function TrustSummary({ rec, t }: { rec: AdvisorRecommendation; t: TFn }) {
  const tier = rec.trust?.tier;
  if (!tier) return null;
  const stores = rec.store_count ?? 0;
  const cls = tier === 'high'
    ? 'bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300'
    : tier === 'medium' ? 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-400'
    : 'bg-surface-container-high text-on-surface-variant';
  // Corroboration is the claim we can always evidence. With a single retailer we say exactly
  // that, rather than dressing one observation as confidence.
  const label = stores >= 2
    ? t('agent.trustCorroborated').replace('{count}', String(stores))
    : t('agent.trustSingleSource');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />{label}
    </span>
  );
}

/**
 * DECISION RECEIPT (2026-08-09, scoped MVP — see final report for the fuller spec and why
 * this scope was chosen over a persisted permalink). "Share this decision" — a text summary
 * of Waffar's actual answer (title, price, corroboration, evidence-cited by construction
 * since every field is read from `rec`, never re-derived here) plus the CURRENT page URL.
 *
 * Deliberately NOT a new backend surface: no new DB table, no RLS to design, no server
 * write, no stale-cache risk. The link always re-fetches live, so a receipt opened next
 * week shows next week's real price — never a frozen snapshot silently going stale under a
 * "receipt" label, which would be a truth violation the moment the price moves. Uses the
 * Web Share API where available (native share sheet — WhatsApp/X/etc.), falling back to a
 * clipboard copy with a toast-free (no extra dependency) inline confirmation.
 */
function ShareDecisionButton({ rec, loc, t, source }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; source: string }) {
  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const title = recTitle(rec, loc);
    const price = rec.unit_price;
    const badge = comparisonBadge(rec, loc);
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = loc === 'ar'
      ? `وفّر رشّح: ${title}${price != null ? ` — ${Math.round(price).toLocaleString('ar')} ريال` : ''} (${badge.text})`
      : `Waffar picked: ${title}${price != null ? ` — ${Math.round(price).toLocaleString('en')} SAR` : ''} (${badge.text})`;
    const meta = { canonical_id: rec.canonical_id, category: (rec.dna?.category as string) ?? null, source };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: loc === 'ar' ? 'توصية وفّر' : 'Waffar recommendation', text, url });
        track('advisor_share', { ...meta, meta: { method: 'native_share' } });
        return;
      } catch {
        /* user cancelled the native share sheet — a cancellation is a deliberate no-op, not
           a failure to recover from, and is NOT tracked as a share (nothing was shared) */
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      track('advisor_share', { ...meta, meta: { method: 'clipboard' } });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — no further fallback; the button
         simply does nothing rather than throwing, consistent with this being a convenience
         action, never a required one. Not tracked — nothing was actually shared. */
    }
  };
  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-outline-variant)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-[var(--brand-green)] hover:text-[var(--brand-green-dark)]"
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden />
      {copied ? t('agent.shareCopied') : t('agent.shareDecision')}
    </button>
  );
}

/**
 * The trust experience (Founder Directive Part 2): show the customer, in clear Arabic,
 * exactly what a recommendation is built on — and let them DISTINGUISH a verified fact
 * from an inference, an unknown, and insufficient evidence. Every line is the engine's
 * own cited evidence; nothing is fabricated here.
 */
function EvidencePanel({ rec, loc, t }: { rec: AdvisorRecommendation; loc: Locale; t: TFn }) {
  const raw = evidenceGroups(rec, loc);
  // Evidence that says nothing is not evidence. Drop blank lines BEFORE the empty-group
  // filter below, so a group whose only item was blank disappears with it rather than
  // rendering a heading over an empty list.
  const said = (xs: string[]) => xs.filter((x) => x?.trim());
  const g = { facts: said(raw.facts), inferences: said(raw.inferences), insufficient: said(raw.insufficient), unknown: said(raw.unknown) };
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

function SmartPick({ rec, loc, t, Arrow, source }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; Arrow: typeof ArrowRight; source: string }) {
  // The smart pick shows its evidence panel by default → count it as an evidence view.
  useEffect(() => { track('evidence_view', { canonical_id: rec.canonical_id, meta: { trust_score: rec.trust?.score ?? null, smart_pick: true } }); }, [rec.canonical_id, rec.trust?.score]);
  return (
    <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-surface-container-lowest p-5 dark:border-primary-800 dark:from-primary-950/40 dark:to-surface-container-lowest">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-semibold text-on-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />{t('agent.smartPickLabel')}
        </span>
        <TrustSummary rec={rec} t={t} />
        <PriceVerdictBadge rec={rec} loc={loc} />
        <DiscountTruthBadge rec={rec} loc={loc} />
        <TrustBadge rec={rec} loc={loc} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-on-surface">{recTitle(rec, loc)}</h3>
          {rec.reasons_ar?.length > 0 && (
            // id + scroll-mt: target for the "ليش هذا أفضل؟" follow-up chip (search-client.tsx's
            // MutationOutcome 'noop' handler) — a "why" question, with an active mission, is
            // answered by THIS reasoning already on screen (ADR-per mutation-turn.ts's own
            // comment), so the chip must not be a silent no-op with zero visible reaction; it
            // scrolls to and briefly highlights the answer that was already here.
            <p id="advisor-why-reasons" className="mt-2 scroll-mt-24 text-xs font-semibold text-on-surface-variant">{t('agent.evidenceRecommendation')}</p>
          )}
          <Reasons rec={rec} t={t} />
          <ChoiceComparison rec={rec} loc={loc} t={t} />
          <Alternatives rec={rec} loc={loc} />
        </div>
        <div className="shrink-0"><CostBlock rec={rec} loc={loc} t={t} /></div>
      </div>
      <EvidencePanel rec={rec} loc={loc} t={t} />
      <ExitButtons rec={rec} loc={loc} t={t} Arrow={Arrow} source={source} />
    </div>
  );
}

function OptionCard({ rec, loc, t, Arrow, source }: { rec: AdvisorRecommendation; loc: Locale; t: TFn; Arrow: typeof ArrowRight; source: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-outline-variant)] bg-surface-container-lowest p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-on-surface">{recTitle(rec, loc)}</h3>
            <TrustSummary rec={rec} t={t} />
            <PriceVerdictBadge rec={rec} loc={loc} />
            <DiscountTruthBadge rec={rec} loc={loc} />
            <TrustBadge rec={rec} loc={loc} />
          </div>
          <Reasons rec={rec} t={t} />
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
      <ExitButtons rec={rec} loc={loc} t={t} Arrow={Arrow} source={source} />
    </div>
  );
}

/**
 * The whole answer. Both entry points render this and nothing else.
 *
 * `source` only tags analytics ('agent' on /advisor, 'search' on the unified surface) so
 * the two can be told apart in the funnel. It changes nothing a customer sees.
 */
export function AdvisorAnswer({
  result,
  locale,
  source = 'agent',
  className = 'mt-8',
  onClarify,
  onRemoveConstraint,
  followUp,
}: {
  result: AdvisorResponse;
  locale: string;
  source?: string;
  className?: string;
  /** Re-runs the same query with the answered field filled in. Omit and no question shows. */
  onClarify?: (field: string, value: number) => void;
  /** Constraint Ledger (Section 7) — removes one understood constraint and re-runs the
   *  request without it. Omit and the ledger renders read-only (no × buttons). */
  onRemoveConstraint?: (field: string) => void;
  /**
   * MEASURED DEFECT (2026-08-10, D→E mission Part A — founder-mandated discoverability
   * fix): `<FollowUpSuggestions>` used to render as a page-level sibling AFTER this entire
   * component, which includes "More options" — 3-4 further OptionCards, each with its own
   * evidence toggle. Live production evidence showed the chips sitting a full screen or more
   * below the primary answer, effectively undiscoverable without deliberate scrolling.
   * Research (ChatGPT/Claude/Perplexity/Baymard/NN's Rufus postmortem) converges on ONE
   * principle: a follow-up affordance belongs to the ANSWER, scoped immediately under it —
   * not to the page, and not after every alternative. This slot renders right after the
   * smart pick's own share action and BEFORE "More options", so the shopper sees it before
   * they'd need to scroll past any alternative they did not ask to see.
   */
  followUp?: ReactNode;
}) {
  const t = useTranslations();
  const loc: Locale = locale === 'ar' ? 'ar' : 'en';
  const isRTL = loc === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [skippedClarify, setSkippedClarify] = useState(false);

  const smart = result?.smart_pick ?? null;
  const rest = (result?.recommendations ?? []).filter((r) => !r.is_smart_pick);

  return (
    <section className={className} aria-live="polite" data-testid="advisor-answer">
      {/* THE DISCLOSURE IS PART OF THE ANSWER, NOT PART OF THE PAGE.
          There is deliberately no prop to suppress it. The Constitution's hard condition
          for this migration is that the disclosure survives the move — "a trust element
          silently lost in a restructure, where nothing breaks, no test fails, and no error
          surfaces". A boolean would be exactly the mechanism by which it is lost. Rendering
          it here means every surface that shows this answer discloses at the same moment,
          by construction, including any surface added later that nobody remembered to
          check. On `/advisor` this is the SECOND disclosure on the page — the hero carries
          one above the input, which is even earlier. Redundancy of a trust statement is the
          safe direction to fail in. */}
      <WaffarAiDisclosure className="mb-4 text-xs text-on-surface-variant/90" />

      {/* ONE clarification question, and only when the engine proved it changes the answer.
          `onClarify` is required to show it: a surface that cannot act on the answer must
          not ask the question. */}
      {onClarify && result.clarify && !skippedClarify && (
        <ClarifyPrompt
          clarify={result.clarify}
          loc={loc}
          onAnswer={(field, value) => { setSkippedClarify(true); onClarify(field, value); }}
          onSkip={() => setSkippedClarify(true)}
        />
      )}

      {/* Understood-as constraint ledger — tap-to-modify (Section 7, "فهمنا منك") */}
      <ConstraintLedger parsed={result.parsed} locale={loc} onRemove={onRemoveConstraint} />
      {result.parsed?.unresolved?.includes('room_size_m2') && (
        <p className="-mt-2.5 mb-4 inline-flex items-center gap-1 text-xs text-warning-700 dark:text-warning-400">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden />{t('agent.addRoomSize')}
        </p>
      )}

      {/* Multi-unit (basket) acknowledgement — quantity, total budget, per-unit ceiling,
          and the UNKNOWNS (installation/delivery). Rendered whenever the shopper asked for
          ≥2 units so an individually-priced option is never presented as fulfilling a
          multi-unit request (Founder directive 2026-08-04; unknown beats incorrect). */}
      {result.basket?.note_ar && (
        <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50/60 p-3 text-sm leading-relaxed text-on-surface dark:border-primary-900/50 dark:bg-primary-950/30" data-testid="advisor-basket-note">
          {loc === 'ar' ? result.basket.note_ar : (result.basket.note_en || result.basket.note_ar)}
        </div>
      )}

      {/* Never present a partial match as an unqualified winner (2026-08-09, founder AC
          Smart Pick audit). Both notes are computed server-side from the SAME data the
          card below renders — nothing re-derived or invented here — but were previously
          silently dropped: present on the API response with no UI ever reading them. */}
      {result.budget_note && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm leading-relaxed text-on-surface dark:border-warning-900/50 dark:bg-warning-950/30" data-testid="advisor-budget-note">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden />
          <span>{loc === 'ar' ? result.budget_note.ar : result.budget_note.en}</span>
        </div>
      )}
      {result.capacity_note && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm leading-relaxed text-on-surface dark:border-warning-900/50 dark:bg-warning-950/30" data-testid="advisor-capacity-note">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden />
          <span>{loc === 'ar' ? result.capacity_note.ar : result.capacity_note.en}</span>
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
      {smart && <SmartPick rec={smart} loc={loc} t={t} Arrow={Arrow} source={source} />}
      {smart && (
        <div className="mt-2 flex justify-end">
          <ShareDecisionButton rec={smart} loc={loc} t={t} source={source} />
        </div>
      )}

      {/* Continue the conversation — scoped to THIS answer, before any alternative the
          shopper did not ask to see (see the `followUp` prop doc above). */}
      {smart && followUp}

      {/* More options */}
      {rest.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-semibold text-on-surface-variant">{t('agent.moreOptions')}</h2>
          <div className="space-y-3">
            {rest.map((r) => <OptionCard key={r.canonical_id} rec={r} loc={loc} t={t} Arrow={Arrow} source={source} />)}
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
  );
}
