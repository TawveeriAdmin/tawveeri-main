// ABOUT — rewritten 2026-07-30 under REDESIGN_BRIEF §17.1 (founder card → mission card).
//
// The founder card was the stated task, but it was not the only defect on this page. Measured
// live on production before the rewrite (both /ar/about and /en/about returned 200):
//
//   1. `85K+ منتج` and `8 متجر` — the SAME unevidenced figures REDESIGN_BRIEF §1 records as
//      "removed before this redesign began". They were removed from the HOMEPAGE only. This
//      page kept serving them. §1's audit checked one surface; the claim outlived it here.
//   2. `تحديث يومي` / `محدّثة يومياً` — a refresh-cadence promise, explicitly MUST NOT SAY
//      (LAUNCH_VOCABULARY §3). Dedicated price refresh is not our freshness mechanism.
//   3. `من جميع المتاجر` — a comprehensive-market claim, also MUST NOT SAY.
//   4. `/en/about` served hardcoded Arabic with `direction:'rtl'` — the English locale had no
//      English page at all.
//   5. Hardcoded dark hex palette (#0A0F0D) on a white-first, theme-aware site, and no page
//      shell — so the page carried neither the site header nor the site's colours.
//
// NO NUMBER APPEARS ON THIS PAGE, deliberately. §1.4 is absolute: a figure derives from a live
// query with a documented definition, or it does not appear. This is a static server page, so
// the correct resolution is to carry no figure rather than to hardcode a defensible one.
//
// Every line of copy below maps to a CAN SAY entry in docs/LAUNCH_VOCABULARY.md §2, or to the
// one-line frame in §6. Nothing here is new marketing language.
import { PublicPageShell } from '@/components/public/public-page-shell';
import Image from 'next/image';

// Locale-aware: the previous page exported a static Arabic `metadata`, so /en/about carried an
// Arabic <title>. Metadata follows the page's language.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';
  return {
    // Brand suffix comes from the layout's title template — do not repeat it here, or the tab
    // reads "من نحن | توفيري | توفيري".
    title: isAr ? 'من نحن' : 'About us',
    description: isAr
      ? 'نُظهر لك السعر، ومن أين جاء، ومتى رصدناه — وحين لا نعرف، نقول ذلك.'
      : 'We show you the price, where it came from, and when we observed it — and when we don’t know, we say so.',
    alternates: { canonical: `/${isAr ? 'ar' : 'en'}/about` },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';

  // LAUNCH_VOCABULARY §2 — each principle is a CAN SAY line, not a paraphrase of one.
  const principles = isAr
    ? [
        { title: 'مصدر السعر ظاهر', desc: 'نعرض لك من أي متجر جاء السعر، ومتى رصدناه.' },
        { title: 'الرابط يوصلك للمنتج نفسه', desc: 'الرابط ينقلك إلى نفس المنتج في المتجر.' },
        { title: 'لا ننشر توفيرًا لم نرصده', desc: 'لا ننشر توفيرًا إلا إذا رصدناه بأنفسنا — ورقمنا غالبًا أقل من رقم المتجر.' },
      ]
    : [
        { title: 'The source is visible', desc: 'We show which retailer each price came from, and when we observed it.' },
        { title: 'The link goes to that product', desc: 'The link takes you to that exact product at the retailer.' },
        { title: 'We publish only what we observed', desc: 'We publish a saving only when we observed the drop ourselves — our number is often lower than the retailer’s.' },
      ];

  return (
    <PublicPageShell locale={locale}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '10px 0 48px', textAlign: isAr ? 'right' : 'left' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 900, color: 'var(--color-on-surface)', margin: '6px 0 10px' }}>
          {isAr ? 'من نحن' : 'About us'}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.9, color: 'var(--color-on-surface-variant)', margin: '0 0 28px' }}>
          {isAr
            ? 'توفيري منصة سعودية لمقارنة أسعار الإلكترونيات والأجهزة المنزلية بين متاجر سعودية.'
            : 'Tawveeri is a Saudi platform for comparing electronics and home-appliance prices across Saudi retailers.'}
        </p>

        {/* The one-line frame — LAUNCH_VOCABULARY §6, verbatim. */}
        <div
          style={{
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 16,
            padding: '20px 22px',
            margin: '0 0 34px',
          }}
        >
          <p style={{ fontSize: 17, lineHeight: 1.85, fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 }}>
            {isAr
              ? 'نُظهر لك السعر، ومن أين جاء، ومتى رصدناه — وحين لا نعرف، نقول ذلك.'
              : 'We show you the price, where it came from, and when we observed it — and when we don’t know, we say so.'}
          </p>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-on-surface)', margin: '0 0 12px' }}>
          {isAr ? 'قصتنا' : 'Our story'}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--color-on-surface-variant)', margin: '0 0 14px' }}>
          {isAr
            ? 'كل واحد منّا مرّ بهذا الموقف — تريد تشتري جهازاً جديداً فتفتح متجرًا ثم آخر ثم ثالثًا، وتضيع ساعات في المقارنة. توفيري وُلد من هذه المشكلة.'
            : 'We have all been here — you want to buy something, so you open one retailer, then another, then a third, and lose hours comparing. Tawveeri was born from that problem.'}
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--color-on-surface-variant)', margin: '0 0 34px' }}>
          {isAr
            ? 'هدفنا واحد: أن تعرف السعر ومصدره وتاريخ رصده، قبل أن تشتري.'
            : 'Our goal is simple: that you know the price, its source, and when we observed it — before you buy.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 34 }}>
          {principles.map((p) => (
            <div
              key={p.title}
              style={{
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-on-surface)', marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--color-on-surface-variant)' }}>{p.desc}</div>
            </div>
          ))}
        </div>

        {/* MISSION CARD — replaces the founder card (§17.1). The product is the hero: the brand
            mark stands where the avatar was, and the copy is about Tawveeri, not a person. */}
        <section
          aria-labelledby="about-mission"
          style={{
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            gap: 20,
            alignItems: 'flex-start',
          }}
        >
          <Image
            src="/logos/Tawveeri.png"
            alt="Tawveeri"
            width={56}
            height={56}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: 'var(--color-surface-container-lowest)' }}
          />
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', marginBottom: 6 }}>
              {isAr ? 'مهمتنا' : 'Our mission'}
            </div>
            <h2 id="about-mission" style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-on-surface)', margin: '0 0 10px' }}>
              {isAr ? 'قرار شراء مبني على دليل' : 'A purchase decision built on evidence'}
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--color-on-surface-variant)', margin: 0 }}>
              {isAr
                ? 'نبني سجل السعر من يوم رصدناه، ولا نعرض تاريخًا لم نملكه. وحين لا نعرف، نقول لا نعرف.'
                : 'We build price history from the day we observe it; we do not invent earlier data. And when we don’t know, we say so.'}
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
