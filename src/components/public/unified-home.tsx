'use client';

// UnifiedHome — one clean, premium homepage in a natural reading order (Founder UX directive):
//   Search → وفّر (AI) → Hero/value → Main Categories → Best Deals.
// IA principles (studied from clean comparison platforms, NOT copied): one clear job per screen,
// generous white space, consistent cards, large touch targets, few competing sections, calm rhythm.
// Tawveeri identity kept (brand green, evidence/trust language). Never fabricates an offer — the
// deals row is real data (best-effort) and hides if empty.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type { HomeVerifiedDeal } from '@/lib/intelligence/home-verified-deals';

const T = {
  ar: {
    tagline: 'قارن أسعار الإلكترونيات عبر متاجر السعودية — بالأدلة، لا أرقام مسوّقة.',
    searchPh: 'ابحث عن منتج… مثلاً آيفون ١٦',
    searchCta: 'بحث',
    aiTitle: 'اسأل وفّر',
    aiSub: 'مساعدك الذكي للتوفير — قل وش تبي، وألقى لك الأنسب بأفضل سعر.',
    aiCta: 'ابدأ المحادثة',
    heroTitle: 'قارن بذكاء، ووفّر بثقة',
    heroSub: 'نجمع الأسعار من أكبر متاجر السع. ونرتّبها حسب مصلحتك — لا العمولة.',
    heroCta: 'كيف نتحقّق من الأسعار',
    catsTitle: 'الفئات الرئيسية',
    dealsTitle: 'أفضل العروض',
    dealsAll: 'شوف الكل',
    save: 'وفّر',
    cats: [
      { e: '📱', l: 'جوالات', q: 'جوال' }, { e: '💻', l: 'لابتوب', q: 'لابتوب' },
      { e: '❄️', l: 'مكيفات', q: 'مكيف' }, { e: '🎧', l: 'سماعات', q: 'سماعات' },
      { e: '📺', l: 'شاشات', q: 'شاشة' }, { e: '🧺', l: 'غسالات', q: 'غسالة' },
    ],
  },
  en: {
    tagline: 'Compare electronics prices across Saudi stores — with evidence, not marketing numbers.',
    searchPh: 'Search a product… e.g. iPhone 16',
    searchCta: 'Search',
    aiTitle: 'Ask Waffar',
    aiSub: "Your smart saving assistant — say what you need and I'll find the best fit at the best price.",
    aiCta: 'Start chatting',
    heroTitle: 'Compare smart, save with confidence',
    heroSub: 'We gather prices from the biggest Saudi stores and rank them for you — never by commission.',
    heroCta: 'How we verify prices',
    catsTitle: 'Main categories',
    dealsTitle: 'Best deals',
    dealsAll: 'See all',
    save: 'Save',
    cats: [
      { e: '📱', l: 'Phones', q: 'phone' }, { e: '💻', l: 'Laptops', q: 'laptop' },
      { e: '❄️', l: 'ACs', q: 'air conditioner' }, { e: '🎧', l: 'Audio', q: 'headphones' },
      { e: '📺', l: 'TVs', q: 'tv' }, { e: '🧺', l: 'Washers', q: 'washing machine' },
    ],
  },
};

const S = { section: { marginTop: 34 } as React.CSSProperties };

export function UnifiedHome({ locale, deals = [] }: { locale: string; deals?: HomeVerifiedDeal[] }) {
  const isAr = locale !== 'en';
  const t = T[isAr ? 'ar' : 'en'];
  const router = useRouter();
  const [q, setQ] = useState('');
  // Deals arrive from the SERVER as verified drops (observed_max + tracked days). The old
  // client query read product_stores.original_price — the merchant's own "was" — and
  // published on the first screen a saving we never observed.

  const search = (text?: string) => {
    const query = (text ?? q).trim();
    router.push(`/${locale}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };
  const num = (n: number) => n.toLocaleString(isAr ? 'ar-SA' : 'en-US');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '6px 0 44px', textAlign: isAr ? 'right' : 'left' }}>
      {/* 1 — SEARCH (first screen: says what Tawveeri does + the primary action) */}
      <section style={{ marginTop: 10 }}>
        <h1 style={{ fontSize: 'clamp(20px, 4.5vw, 26px)', fontWeight: 900, lineHeight: 1.3, color: 'var(--color-on-surface)', margin: '0 0 14px', textAlign: 'center' }}>
          {t.tagline}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-surface)', border: '2px solid var(--brand-green)', borderRadius: 16, padding: '8px 8px 8px 16px', boxShadow: '0 8px 30px rgba(85,178,149,.14)' }}>
          <span style={{ fontSize: 18, flexShrink: 0, opacity: .6 }}>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder={t.searchPh} aria-label={t.searchCta}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: 'var(--color-on-surface)', fontFamily: 'inherit', textAlign: isAr ? 'right' : 'left', minWidth: 0, padding: '10px 0' }} />
          <button onClick={() => search()} style={{ background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer', flexShrink: 0, minHeight: 44 }}>{t.searchCta}</button>
        </div>
      </section>

      {/* وفّر has ONE entry point — the persistent nav item. It used to be offered here
          as well, so the first screen carried two doors to the same assistant. Measured
          2026-07-29 as a homepage-journey failure in both locales. */}

      {/* 2 — MAIN CATEGORIES (large comfortable cards, equal size, generous spacing) */}
      <section style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>{t.catsTitle}</h2>
          <Link href={`/${locale}/categories`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', textDecoration: 'none' }}>{t.dealsAll} {isAr ? '←' : '→'}</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {t.cats.map((c) => (
            <button key={c.l} onClick={() => search(c.q)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 18, padding: '22px 8px', cursor: 'pointer', minHeight: 104 }}>
              <span style={{ fontSize: 30 }}>{c.e}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)' }}>{c.l}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3 — BEST DEALS — VERIFIED drops only. Every card states the evidence: the
          highest price we ourselves observed, and how many days we watched. This is the
          product thesis in one line — we publish a SMALLER saving than the merchant,
          because ours is evidence. Hidden entirely when we have nothing verified. */}
      {deals.length > 0 && (
        <section style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>{t.dealsTitle}</h2>
            <Link href={`/${locale}/price-truth`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', textDecoration: 'none' }}>{t.dealsAll} {isAr ? '←' : '→'}</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {deals.map((d) => (
              <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, padding: '14px 16px', display: 'block' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)', lineHeight: 1.45, marginBottom: 8 }}>{d.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--brand-green-dark, #3a7a66)' }}>{num(d.price)}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--brand-bg-green, #eaf6f1)', color: 'var(--brand-green-dark, #3a7a66)', borderRadius: 8, padding: '3px 8px' }}>
                    {t.save} {num(Math.round(d.observedMax - d.price))} {isAr ? 'ريال' : 'SAR'}
                  </span>
                  {d.storeName && <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{d.storeName}</span>}
                </div>
                {/* THE EVIDENCE LINE (directive §3.8) — what we observed, and for how long. */}
                <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 8, lineHeight: 1.6 }}>
                  {isAr
                    ? `تتبّعنا هذا المنتج ${num(d.trackedDays)} يومًا · أعلى سعر رصدناه ${num(d.observedMax)} ريال`
                    : `We tracked this product for ${num(d.trackedDays)} days · highest price we observed ${num(d.observedMax)} SAR`}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 4 — TRUST, LAST. It used to sit above the categories, asking the customer to
          accept the claim before seeing a single product. That is exactly what we say we
          do not do: the claim should be PROVEN by products, then explained. */}
      <section style={S.section}>
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--brand-green) 0%, #3a7a66 100%)', borderRadius: 22, padding: '26px 22px', color: '#fff' }}>
          <div style={{ position: 'absolute', insetInlineEnd: -10, top: '50%', transform: 'translateY(-50%)', fontSize: 96, opacity: .12, pointerEvents: 'none' }}>🛡️</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{t.heroTitle}</div>
          <div style={{ fontSize: 13, opacity: .9, lineHeight: 1.6, maxWidth: 440, marginBottom: 14 }}>{t.heroSub}</div>
          <Link href={`/${locale}/price-truth`} style={{ display: 'inline-block', background: '#fff', color: '#2f6b58', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>{t.heroCta} {isAr ? '←' : '→'}</Link>
        </div>
      </section>
    </div>
  );
}
