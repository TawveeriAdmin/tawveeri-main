'use client';

// UnifiedHome — one clean, premium homepage in a natural reading order (Founder UX directive):
//   Search → وفّر (AI) → Hero/value → Main Categories → Best Deals.
// IA principles (studied from clean comparison platforms, NOT copied): one clear job per screen,
// generous white space, consistent cards, large touch targets, few competing sections, calm rhythm.
// Tawveeri identity kept (brand green, evidence/trust language). Never fabricates an offer — the
// deals row is real data (best-effort) and hides if empty.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type { HomeVerifiedDeal } from '@/lib/intelligence/home-verified-deals';
import { needPhrasings, needPrompt } from '@/lib/agent/need-phrasings';
import { useNavigableCategories } from '@/lib/intelligence/navigable-categories-context';
import { track } from '@/lib/analytics/track';

const T = {
  ar: {
    tagline: 'قارن أسعار الإلكترونيات عبر متاجر السعودية — بالأدلة، لا أرقام مسوّقة.',
    searchPh: 'ابحث عن منتج… مثلاً آيفون ١٦',
    searchCta: 'بحث',
    catsTitle: 'الفئات الرئيسية',
    dealsTitle: 'أفضل العروض',
    dealsAll: 'شوف الكل',
    save: 'وفّر',
  },
  en: {
    tagline: 'Compare electronics prices across Saudi stores — with evidence, not marketing numbers.',
    searchPh: 'Search a product… e.g. iPhone 16',
    searchCta: 'Search',
    catsTitle: 'Main categories',
    dealsTitle: 'Best deals',
    dealsAll: 'See all',
    save: 'Save',
  },
};

const S = { section: { marginTop: 34 } as React.CSSProperties };

export function UnifiedHome({ locale, deals = [] }: { locale: string; deals?: HomeVerifiedDeal[] }) {
  const isAr = locale !== 'en';
  const t = T[isAr ? 'ar' : 'en'];
  const router = useRouter();
  const [q, setQ] = useState('');
  // Soft-surface entry visibility (ADR-257): dismiss persists; SSR renders hidden and
  // the flag resolves on mount so there is no hydration mismatch.
  const [homeEntryVisible, setHomeEntryVisible] = useState(false);
  useEffect(() => {
    try { setHomeEntryVisible(localStorage.getItem('tw_home_entry_dismissed') !== '1'); } catch { setHomeEntryVisible(true); }
  }, []);
  // Categories DERIVED LIVE (ADR-150) — the six with the most comparable products. The
  // hardcoded `T.cats` list this replaces would drift from production exactly the way the
  // hardcoded homepage figures did. Six keeps the first screen calm; /categories shows all.
  const homeCats = useNavigableCategories().slice(0, 6);
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

        {/* TEACH THE OTHER HALF OF WHAT THIS BOX ACCEPTS (ADR-171).
            The note that stood here said وفّر's one entry point was "the persistent nav item".
            That nav item was retired by ADR-152 — it was the "choose between search and AI"
            fork the Constitution forbids — and the comment was never updated. Two correct
            removals left ZERO entry points: measured 2026-08-01, zero href to /advisor on
            either locale.
            The answer is NOT a second door. `/search` already routes by intent from this same
            field. The capability was reachable and undiscoverable, so what is added is an
            AFFORDANCE, not an entry point: one line showing that a sentence is a valid query.
            The novice describes a situation, the expert types a model name, both use this box.
            Same phrasings as `/search`, from one module, so the two surfaces cannot drift. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>{needPrompt(locale)}</span>
          {needPhrasings(locale).map((phrase) => (
            <button key={phrase} type="button" onClick={() => search(phrase)}
              style={{ borderRadius: 999, border: '1px solid var(--brand-green)', background: 'var(--brand-bg-green, #eaf6f1)', color: 'var(--brand-green-dark, #3a7a66)', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 32 }}>
              {phrase}
            </button>
          ))}
        </div>
      </section>

      {/* NO DISCLOSURE HERE, DELIBERATELY. No AI answer appears on the homepage — these are
          example QUERIES, not generated output. The disclosure renders at/before the first
          advisor answer on /search, as its first child with no prop to suppress it (ADR-152).
          Forcing it onto a page with nothing to disclose would dilute it where it matters. */}

      {/* SOFT-SURFACE ENTRY for Tawveeri Home (ADR-257): one dismissible card, «تجريبي»
          badge, stable URL — the researched middle stage (Rufus/AI-Mode pattern: visible
          but gated, never a nav item until instrumentation gates pass). The core compare
          journey above stays untouched. */}
      {homeEntryVisible && (
        <section style={{ marginTop: 22 }}>
          <div style={{ position: 'relative', background: 'var(--brand-bg-green, #eaf6f1)', border: '1px solid var(--brand-green)', borderRadius: 18, padding: '16px 16px 14px' }}>
            <button aria-label={isAr ? 'إخفاء' : 'Dismiss'}
              onClick={() => { setHomeEntryVisible(false); try { localStorage.setItem('tw_home_entry_dismissed', '1'); } catch { /* noop */ } track('home_mission', { meta: { step: 'entry_card_dismissed' } }); }}
              style={{ position: 'absolute', top: 8, insetInlineEnd: 10, background: 'none', border: 'none', fontSize: 16, color: 'var(--color-on-surface-variant)', cursor: 'pointer', minWidth: 32, minHeight: 32 }}>×</button>
            {/* «تجريبي» removed (founder close, 2026-08-17): the product is accepted and
                production-verified — the consumer sees it confidently. Internal status
                stays MEASURED PRODUCT / CONTROLLED DISTRIBUTION (governance unchanged). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--color-on-surface)' }}>{isAr ? 'جهّز بيتك بذكاء' : 'Equip your home intelligently'}</span>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--color-on-surface-variant)', margin: '0 0 10px' }}>
              {isAr
                ? 'صف بيتك وميزانيتك بكلامك، ونحوّلها إلى خطة أجهزة بأدلة أسعار حقيقية — والأسعار قد تتغير.'
                : 'Describe your home and budget in your own words — we turn it into an appliance plan built on real price evidence. Prices may change.'}
            </p>
            <Link href={`/${locale}/home-mission`}
              onClick={() => track('home_mission', { meta: { step: 'entry_card_click' } })}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, background: 'var(--brand-green)', color: '#fff', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
              {isAr ? 'ابدأ خطة بيتك' : 'Start your home plan'}
            </Link>
          </div>
        </section>
      )}

      {/* 2 — MAIN CATEGORIES (large comfortable cards, equal size, generous spacing).
          Hidden entirely when nothing clears the rule — never an empty or stale grid. */}
      {homeCats.length > 0 && (
        <section style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>{t.catsTitle}</h2>
            <Link href={`/${locale}/categories`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '2px 4px' }}>{t.dealsAll} {isAr ? '←' : '→'}</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {homeCats.map((c) => (
              <button key={c.key} onClick={() => search(c.query)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 18, padding: '22px 8px', cursor: 'pointer', minHeight: 104 }}>
                <span style={{ fontSize: 30 }} aria-hidden="true">{c.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)' }}>{isAr ? c.labelAr : c.labelEn}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3 — BEST DEALS — VERIFIED drops only. Every card states the evidence: the
          highest price we ourselves observed, and how many days we watched. This is the
          product thesis in one line — we publish a SMALLER saving than the merchant,
          because ours is evidence. Hidden entirely when we have nothing verified. */}
      {deals.length > 0 && (
        <section style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>{t.dealsTitle}</h2>
            <Link href={`/${locale}/price-truth`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '2px 4px' }}>{t.dealsAll} {isAr ? '←' : '→'}</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {deals.map((d) => (
              // THE DESTINATION IS BUILT SERVER-SIDE (ADR-170). `d.href` is a compare page when
              // one can be delivered, otherwise a `/go` exit that carries the affiliate tag and
              // records the click. The raw retailer URL is never linked: doing so cost us the
              // attribution and the only storefront exit signal we have.
              // An internal compare link stays in the tab; an outbound exit opens a new one.
              <a key={d.url} href={d.href}
                {...(d.internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
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

      {/* 4 — THE COMPANY-EXPLANATION BILLBOARD WAS REMOVED HERE (Founder directive,
          2026-07-30). The homepage's job is to get a shopper to search, compare and see
          evidence; explaining who Tawveeri is and how it verifies belongs on /about, which
          the footer links in both locales. Task completion before content completeness.

          Trust content that DIRECTLY serves the journey stays: the tagline above the search
          field, and the per-deal evidence line in §3 — which helps a shopper judge THAT
          offer, rather than asking them to accept a claim about the company.

          Two further reasons this block could not simply move as-written:
            • its Arabic subtitle carried a visible truncation — «أكبر متاجر السع.»
            • it stated ranking and commission policy («نرتّبها حسب مصلحتك — لا العمولة» /
              "ranked for you — never by commission"), and REDESIGN_BRIEF §14.1 is explicit
              that this work says nothing publicly about commission or ranking policy.
          The About page carries the LAUNCH_VOCABULARY-approved wording instead.

          /price-truth remains reachable from the deals heading above. */}
    </div>
  );
}
