'use client';

// SearchHome — the CONTROL entry arm (search-first). Deliberately a STRONG, fair control (not a
// strawman) so the A/B test is honest: a clean, conventional comparison-shopping entry — prominent
// search, familiar category shortcuts (Jakob's Law: users expect what other shopping sites do),
// honest stats, and a secondary path to the advisor. If this beats advisor-first on real behaviour,
// the data — not preference — decides, and the champion flips via one config value.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const T = {
  ar: {
    h1: 'قارن أسعار الإلكترونيات عبر متاجر السعودية',
    sub: 'ابحث عن أي منتج وشُف أفضل سعر عبر المتاجر — بأدلة موثّقة، لا أرقام مسوّقة.',
    placeholder: 'ابحث عن منتج… مثلاً آيفون ١٦',
    cta: 'بحث',
    cats: [{ e: '📱', l: 'جوالات', q: 'جوال' }, { e: '💻', l: 'لابتوب', q: 'لابتوب' }, { e: '❄️', l: 'مكيفات', q: 'مكيف' }, { e: '🎧', l: 'سماعات', q: 'سماعات' }, { e: '📺', l: 'شاشات', q: 'شاشة' }, { e: '🧺', l: 'غسالات', q: 'غسالة' }],
    or: 'أو خلّ المستشار المحايد يرشّح لك',
    stat: ['رصدة سعر موثّقة', 'منتج منشور', 'مقارنة عبر متاجر'],
  },
  en: {
    h1: 'Compare electronics prices across Saudi stores',
    sub: 'Search any product and see the best price across stores — with verifiable evidence, not marketing numbers.',
    placeholder: 'Search a product… e.g. iPhone 16',
    cta: 'Search',
    cats: [{ e: '📱', l: 'Phones', q: 'phone' }, { e: '💻', l: 'Laptops', q: 'laptop' }, { e: '❄️', l: 'ACs', q: 'air conditioner' }, { e: '🎧', l: 'Audio', q: 'headphones' }, { e: '📺', l: 'TVs', q: 'tv' }, { e: '🧺', l: 'Washers', q: 'washing machine' }],
    or: 'or let the neutral advisor recommend for you',
    stat: ['verified price observations', 'published products', 'cross-store comparisons'],
  },
};

const arNum = (n: number) => n.toLocaleString('ar-SA');
const DEFAULTS = { observations: 164000, published: 3027, comparable: 295 };

export function SearchHome({ locale }: { locale: string }) {
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
    router.push(`/${locale}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };

  const fmt = (n: number) => (isAr ? arNum(n) : n.toLocaleString('en-US'));
  const stats = [
    { n: '+' + fmt(Math.round(s.observations / 1000)) + (isAr ? ' ألف' : 'k'), l: t.stat[0] },
    { n: fmt(s.published), l: t.stat[1] },
    { n: fmt(s.comparable), l: t.stat[2] },
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 0 32px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 900, lineHeight: 1.25, color: 'var(--color-on-surface)', margin: '18px auto 12px', maxWidth: 540 }}>
        {t.h1}
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-on-surface-variant)', margin: '0 auto 22px', maxWidth: 480 }}>
        {t.sub}
      </p>

      {/* Prominent search — the control's primary action */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--color-surface)', border: '2px solid var(--color-outline-variant)',
        borderRadius: 16, padding: '8px 8px 8px 16px', boxShadow: '0 6px 24px rgba(0,0,0,.06)',
        maxWidth: 560, margin: '0 auto',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0, opacity: .6 }}>🔍</span>
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
            padding: '12px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0, minHeight: 44,
          }}
        >{t.cta}</button>
      </div>

      {/* Familiar category shortcuts (Jakob's Law) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
        {t.cats.map(c => (
          <button
            key={c.l}
            onClick={() => go(c.q)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
              borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700,
              color: 'var(--color-on-surface)', cursor: 'pointer', minHeight: 44,
            }}
          ><span style={{ fontSize: 16 }}>{c.e}</span>{c.l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, maxWidth: 460, margin: '26px auto 0' }}>
        {stats.map(x => (
          <div key={x.l} style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand-green)', lineHeight: 1 }}>{x.n}</div>
            <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', fontWeight: 600, marginTop: 4 }}>{x.l}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <Link href={`/${locale}/advisor`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', textDecoration: 'underline' }}>
          {t.or}
        </Link>
      </div>
    </div>
  );
}
