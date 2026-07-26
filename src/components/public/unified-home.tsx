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
import { getSupabaseBrowserClient } from '@/lib/database';

type Deal = { slug: string; name: string; image: string | null; price: number; was: number | null; store: string };

const T = {
  ar: {
    beta: 'نسخة تجريبية عامة · نضيف متاجر ومقارنات باستمرار',
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
    beta: 'Public Beta · we keep adding stores and comparisons',
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

export function UnifiedHome({ locale }: { locale: string }) {
  const isAr = locale !== 'en';
  const t = T[isAr ? 'ar' : 'en'];
  const router = useRouter();
  const [q, setQ] = useState('');
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabaseBrowserClient();
        const { data } = await sb
          .from('product_stores')
          .select('current_price, original_price, is_deal, products!inner(slug, name_ar, name_en, image_url), stores(slug, name_ar, name_en)')
          .eq('is_deal', true)
          .not('original_price', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(6);
        if (cancelled || !data) return;
        const mapped: Deal[] = (data as any[])
          .map((r) => ({
            slug: r.products?.slug, image: r.products?.image_url ?? null,
            name: isAr ? (r.products?.name_ar || r.products?.name_en) : (r.products?.name_en || r.products?.name_ar),
            price: Number(r.current_price), was: r.original_price ? Number(r.original_price) : null,
            store: isAr ? (r.stores?.name_ar || r.stores?.slug) : (r.stores?.name_en || r.stores?.slug),
          }))
          .filter((d) => d.slug && d.name && d.was && d.was > d.price)
          .slice(0, 4);
        setDeals(mapped);
      } catch { /* deals are best-effort; the section hides if empty */ }
    })();
    return () => { cancelled = true; };
  }, [isAr]);

  const search = (text?: string) => {
    const query = (text ?? q).trim();
    router.push(`/${locale}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };
  const num = (n: number) => n.toLocaleString(isAr ? 'ar-SA' : 'en-US');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '6px 0 44px', textAlign: isAr ? 'right' : 'left' }}>
      {/* 1 — SEARCH (first screen: says what Tawveeri does + the primary action) */}
      <section style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
            color: 'var(--brand-green-dark, #3a7a66)', background: 'rgba(85,178,149,.10)',
            border: '1px solid rgba(85,178,149,.25)', borderRadius: 999, padding: '5px 12px',
          }}>🌱 {t.beta}</span>
        </div>
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

      {/* 2 — وفّر (AI assistant, part of the identity, not hidden) */}
      <section style={S.section}>
        <Link href={`/${locale}/advisor`} style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', background: 'linear-gradient(135deg, rgba(85,178,149,.12), var(--color-surface))', border: '1.5px solid var(--brand-green)', borderRadius: 20, padding: '18px 18px' }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg,var(--brand-green),#3a7a66)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: '0 4px 14px rgba(85,178,149,.3)' }}>🧭</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-on-surface)' }}>{t.aiTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 3, lineHeight: 1.5 }}>{t.aiSub}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-green-dark, #3a7a66)', flexShrink: 0 }}>{t.aiCta} {isAr ? '←' : '→'}</span>
        </Link>
      </section>

      {/* 3 — HERO / value (trust, mid-page per the natural order) */}
      <section style={S.section}>
        <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--brand-green) 0%, #3a7a66 100%)', borderRadius: 22, padding: '26px 22px', color: '#fff' }}>
          <div style={{ position: 'absolute', insetInlineEnd: -10, top: '50%', transform: 'translateY(-50%)', fontSize: 96, opacity: .12, pointerEvents: 'none' }}>🛡️</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{t.heroTitle}</div>
          <div style={{ fontSize: 13, opacity: .9, lineHeight: 1.6, maxWidth: 440, marginBottom: 14 }}>{t.heroSub}</div>
          <Link href={`/${locale}/price-truth`} style={{ display: 'inline-block', background: '#fff', color: '#2f6b58', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>{t.heroCta} {isAr ? '←' : '→'}</Link>
        </div>
      </section>

      {/* 4 — MAIN CATEGORIES (large comfortable cards, equal size, generous spacing) */}
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

      {/* 5 — BEST DEALS (real data; hidden when none) */}
      {deals.length > 0 && (
        <section style={S.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-on-surface)', margin: 0 }}>🔥 {t.dealsTitle}</h2>
            <Link href={`/${locale}/deals`} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-dark, #3a7a66)', textDecoration: 'none' }}>{t.dealsAll} {isAr ? '←' : '→'}</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {deals.map((d) => {
              const save = d.was ? Math.round(((d.was - d.price) / d.was) * 100) : 0;
              return (
                <Link key={d.slug} href={`/${locale}/products/${d.slug}`} style={{ textDecoration: 'none', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', height: 120, background: 'var(--color-surface-container-low, #f5f7f8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {d.image ? <img src={d.image} alt={d.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 34, opacity: .4 }}>📦</span>}
                    {save > 0 && <span style={{ position: 'absolute', insetInlineStart: 8, top: 8, background: '#E2BB4E', color: '#0f1923', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 900 }}>{t.save} {save}%</span>}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface)', lineHeight: 1.4, height: 34, overflow: 'hidden' }}>{d.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--brand-green-dark, #3a7a66)' }}>{num(d.price)}</span>
                      {d.was && <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', textDecoration: 'line-through' }}>{num(d.was)}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
