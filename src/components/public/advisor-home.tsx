'use client';

// AdvisorHome — the CHAMPION entry arm (advisor-first). Design thesis, each choice evidenced:
//  • ONE primary action (the advisor input). Hick's Law + choice-overload: a single clear next
//    step converts better than a wall of competing CTAs (the V1 home stacked chat+advisor+deal+
//    finance+partners with no focal point).
//  • Trust-first copy (neutral · evidence · total cost, not commission). Algorithm-aversion
//    research: people distrust opaque automated recommendations; stating the neutrality rule and
//    citing evidence is the antidote — and it's the platform's genuine moat.
//  • Concrete example chips. Recognition-over-recall + the "paradox of the active user": a blank
//    box paralyses; tappable real intents show what to do and seed good queries.
//  • Honest live stats as credibility, kept SECONDARY (small, below the fold of attention).
//  • Deterministic advisor is the hero — aligned with the constitution ("engines decide, LLMs
//    only phrase"), unlike V1 which made an LLM chat the hero and buried the real engine.
//  • Mobile-first: one thumb-reachable input, ≥44px targets, RTL-correct.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const T = {
  ar: {
    eyebrow: 'محايد · بالأدلة · التكلفة الإجمالية لا العمولة',
    h1: 'قل وش تبي — نرشّح لك الأنسب بالأدلة',
    sub: 'محرّك حتمي يقارن متاجر السعودية ويرتّب حسب ملاءمته لك وتكلفته الإجمالية. كل ترشيح ومعه دليله الموثّق.',
    placeholder: 'مثلاً: مكيف لغرفة ٢٠ متر تحت ٢٠٠٠',
    cta: 'رشّح لي',
    chips: ['مكيف لغرفة ٢٠م', 'آيفون ١٦ بأفضل سعر', 'لابتوب للدراسة ٢٥٠٠', 'غسالة موفّرة للكهرباء'],
    or: 'أو تصفّح بالبحث التقليدي',
    stat: ['رصدة سعر موثّقة', 'منتج منشور', 'مقارنة عبر متاجر'],
    browse: 'أو تصفّح حسب الفئة',
    cats: [
      { e: '📱', l: 'جوالات', q: 'جوال' }, { e: '💻', l: 'لابتوب', q: 'لابتوب' },
      { e: '❄️', l: 'مكيفات', q: 'مكيف' }, { e: '🎧', l: 'سماعات', q: 'سماعات' },
      { e: '📺', l: 'شاشات', q: 'شاشة' }, { e: '🧺', l: 'غسالات', q: 'غسالة' },
    ],
    trustTitle: 'ليش تثق بتوفيري؟',
    trustBody: 'كل سعر موثّق بالأدلة، والترتيب حسب الأنسب لك — لا العمولة.',
    trustCta: 'اعرف كيف نتحقّق',
  },
  en: {
    eyebrow: 'Neutral · evidence-backed · total cost, not commission',
    h1: 'Tell us what you need — we recommend the best, with evidence',
    sub: 'A deterministic engine compares Saudi stores and ranks by fit and total cost. Every pick comes with its verifiable evidence.',
    placeholder: 'e.g. an AC for a 20m² room under 2000',
    cta: 'Recommend',
    chips: ['AC for a 20m² room', 'iPhone 16 best price', 'Laptop for study 2500', 'Energy-saving washer'],
    or: 'or browse with traditional search',
    stat: ['verified price observations', 'published products', 'cross-store comparisons'],
    browse: 'or browse by category',
    cats: [
      { e: '📱', l: 'Phones', q: 'phone' }, { e: '💻', l: 'Laptops', q: 'laptop' },
      { e: '❄️', l: 'ACs', q: 'air conditioner' }, { e: '🎧', l: 'Audio', q: 'headphones' },
      { e: '📺', l: 'TVs', q: 'tv' }, { e: '🧺', l: 'Washers', q: 'washing machine' },
    ],
    trustTitle: 'Why trust Tawveeri?',
    trustBody: 'Every price is backed by evidence, and ranking follows what fits you — never commission.',
    trustCta: 'See how we verify',
  },
};

const arNum = (n: number) => n.toLocaleString('ar-SA');
const DEFAULTS = { observations: 164000, published: 3027, comparable: 295 };

export function AdvisorHome({ locale }: { locale: string }) {
  const t = T[locale === 'en' ? 'en' : 'ar'];
  const isAr = locale !== 'en';
  const router = useRouter();
  const [q, setQ] = useState('');
  const [s, setS] = useState(DEFAULTS);

  useEffect(() => {
    fetch('/api/stats').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d && typeof d.comparable_products === 'number') {
        setS({ observations: d.observations ?? DEFAULTS.observations, published: d.published_products ?? DEFAULTS.published, comparable: d.comparable_products ?? DEFAULTS.comparable });
      }
    }).catch(() => {});
  }, []);

  const go = (text?: string) => {
    const query = (text ?? q).trim();
    router.push(`/${locale}/advisor${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };

  const fmt = (n: number) => (isAr ? arNum(n) : n.toLocaleString('en-US'));
  const stats = [
    { n: '+' + fmt(Math.round(s.observations / 1000)) + (isAr ? ' ألف' : 'k'), l: t.stat[0] },
    { n: fmt(s.published), l: t.stat[1] },
    { n: fmt(s.comparable), l: t.stat[2] },
  ];

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '8px 0 32px', textAlign: 'center' }}>
      {/* Trust eyebrow — the neutrality moat, stated up front */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, margin: '12px 0 18px',
        background: 'rgba(85,178,149,.10)', color: 'var(--brand-green-dark, #3a7a66)',
        border: '1px solid rgba(85,178,149,.25)', borderRadius: 50, padding: '6px 14px',
        fontSize: 11, fontWeight: 800,
      }}>
        <span style={{ width: 7, height: 7, background: 'var(--brand-green)', borderRadius: '50%', display: 'inline-block' }} />
        {t.eyebrow}
      </div>

      <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, lineHeight: 1.25, color: 'var(--color-on-surface)', margin: '0 auto 12px', maxWidth: 520 }}>
        {t.h1}
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-on-surface-variant)', margin: '0 auto 22px', maxWidth: 460 }}>
        {t.sub}
      </p>

      {/* THE one primary action */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--color-surface)', border: '2px solid var(--brand-green)',
        borderRadius: 16, padding: '8px 8px 8px 16px', boxShadow: '0 8px 30px rgba(85,178,149,.16)',
        maxWidth: 560, margin: '0 auto',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🧭</span>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && go()}
          placeholder={t.placeholder}
          aria-label={t.h1}
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontSize: 15, color: 'var(--color-on-surface)', fontFamily: 'inherit',
            textAlign: isAr ? 'right' : 'left', minWidth: 0, padding: '10px 0',
          }}
        />
        <button
          onClick={() => go()}
          style={{
            background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 12,
            padding: '12px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
            minHeight: 44, boxShadow: '0 4px 14px rgba(85,178,149,.32)',
          }}
        >{t.cta} {isAr ? '←' : '→'}</button>
      </div>

      {/* Example intents — recognition over recall */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
        {t.chips.map(chip => (
          <button
            key={chip}
            onClick={() => go(chip)}
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
              borderRadius: 50, padding: '8px 14px', fontSize: 12, fontWeight: 700,
              color: 'var(--color-on-surface-variant)', cursor: 'pointer', minHeight: 36,
            }}
          >{chip}</button>
        ))}
      </div>

      {/* Browse by category — scannable discovery, progressive disclosure below the primary action */}
      <div style={{ marginTop: 30, textAlign: isAr ? 'right' : 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 12 }}>{t.browse}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {t.cats.map(c => (
            <button
              key={c.l}
              onClick={() => router.push(`/${locale}/search?q=${encodeURIComponent(c.q)}`)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
                borderRadius: 16, padding: '18px 8px', cursor: 'pointer', minHeight: 90,
              }}
            >
              <span style={{ fontSize: 26 }}>{c.e}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface)' }}>{c.l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price-Truth trust cue — surfaced on home as one calm row (obs 3) */}
      <Link href={`/${locale}/price-truth`} style={{ display: 'block', marginTop: 22, textDecoration: 'none', textAlign: isAr ? 'right' : 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(85,178,149,.06)', border: '1px solid rgba(85,178,149,.20)', borderRadius: 16, padding: '14px 16px' }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)' }}>{t.trustTitle}</div>
            <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2, lineHeight: 1.5 }}>{t.trustBody}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', flexShrink: 0 }}>{t.trustCta} {isAr ? '←' : '→'}</span>
        </div>
      </Link>

      {/* Honest credibility, secondary */}
      <div style={{ display: 'flex', gap: 10, maxWidth: 460, margin: '26px auto 0' }}>
        {stats.map(x => (
          <div key={x.l} style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand-green)', lineHeight: 1 }}>{x.n}</div>
            <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 600, marginTop: 4 }}>{x.l}</div>
          </div>
        ))}
      </div>

      {/* Within-arm escape hatch to search — measured (does advisor-first still let people find search?) */}
      <div style={{ marginTop: 22 }}>
        <Link href={`/${locale}/search`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface-variant)', textDecoration: 'underline' }}>
          {t.or}
        </Link>
      </div>
    </div>
  );
}
