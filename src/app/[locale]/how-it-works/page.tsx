// HOW IT WORKS — rewritten 2026-08-07 under the public-trust/IA closeout mission.
//
// The previous page (measured live on production before this rewrite) had five defects:
//   1. No `PublicPageShell` — no header, no footer, no way to navigate away except the
//      single "start comparing" CTA or the browser back button. A dead end.
//   2. Hardcoded `direction:'rtl'` and Arabic-only copy on a route with a `[locale]` param —
//      `/en/how-it-works` rendered the same Arabic page as `/ar/how-it-works`.
//   3. A hardcoded dark palette (`#0A0F0D`) unrelated to the site's theme tokens — broke both
//      light mode and the site's actual visual identity.
//   4. A hardcoded "المتاجر المربوطة" (connected stores) grid naming 8 stores, including two
//      outside the founder-approved active set and a mistranslated entry ("الشتاء والصيف").
//      LAUNCH_VOCABULARY §9 (2026-07-31) retired every fixed retailer count from customer
//      copy — no store count or list appears here, matching About's approach.
//   5. "بأمان تام" (complete safety) beside the buy-through-retailer step read as a safety
//      guarantee Tawveeri cannot make. Reworded to describe what actually happens (you leave
//      Tawveeri and complete the purchase at the retailer) without the guarantee language.
//
// No proprietary matching/ranking logic is described (Founder Directive A). This stays at
// the same consumer-journey altitude the mission specifies: search → observed offers →
// compare → choose → leave for the retailer.
import { PublicPageShell } from '@/components/public/public-page-shell';
import Link from 'next/link';
import { Search, ListChecks, ExternalLink, BellRing } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';
  return {
    title: isAr ? 'كيف تعمل المنصة' : 'How it works',
    description: isAr
      ? 'أربع خطوات بسيطة: ابحث، قارن الأسعار المرصودة، اختر متجرك، واحصل على تنبيه عند انخفاض السعر.'
      : 'Four simple steps: search, compare observed prices, choose your store, and get alerted when the price drops.',
    alternates: { canonical: `/${isAr ? 'ar' : 'en'}/how-it-works` },
  };
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';

  const steps = isAr
    ? [
        {
          icon: Search,
          title: 'ابحث عن المنتج',
          desc: 'اكتب اسم الجهاز في خانة البحث — آيفون، سامسونج، ثلاجة، مكيف. يدعم البحث العربي والإنجليزي.',
        },
        {
          icon: ListChecks,
          title: 'قارن الأسعار التي رصدناها',
          desc: 'نجمع لك الأسعار المرصودة لنفس المنتج من متاجر سعودية في صفحة واحدة، مرتّبة من الأرخص للأغلى، مع تاريخ آخر رصد لكل سعر.',
        },
        {
          icon: ExternalLink,
          title: 'اختر متجرك وأكمل الشراء هناك',
          desc: 'اضغط على المتجر الذي يناسبك وستنتقل إلى صفحة المنتج نفسه في موقع ذلك المتجر لإتمام الشراء — الدفع والشحن والاستبدال كلها تتم مع المتجر، وليس مع توفيري.',
        },
        {
          icon: BellRing,
          title: 'فعّل تنبيه انخفاض السعر (اختياري)',
          desc: 'حدد السعر الذي تنتظره وسنُرسل لك إشعارًا إذا رصدنا انخفاضًا يصل إليه أو يتجاوزه.',
        },
      ]
    : [
        {
          icon: Search,
          title: 'Search for a product',
          desc: 'Type what you’re looking for — iPhone, Samsung, a fridge, an AC unit. Search works in Arabic and English.',
        },
        {
          icon: ListChecks,
          title: 'Compare the prices we observed',
          desc: 'We bring together the prices we observed for that product across Saudi retailers on one page, sorted low to high, each with the date we last observed it.',
        },
        {
          icon: ExternalLink,
          title: 'Choose a store and finish there',
          desc: 'Pick the store that works for you and you’ll go to that exact product page on the retailer’s own site to complete the purchase — payment, shipping and returns are handled by the retailer, not by Tawveeri.',
        },
        {
          icon: BellRing,
          title: 'Set a price alert (optional)',
          desc: 'Tell us the price you’re waiting for, and we’ll notify you if we observe it drop to or below that number.',
        },
      ];

  return (
    <PublicPageShell locale={locale}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '10px 0 48px', textAlign: isAr ? 'right' : 'left' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 900, color: 'var(--color-on-surface)', margin: '6px 0 10px' }}>
          {isAr ? 'كيف تعمل المنصة' : 'How Tawveeri works'}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.9, color: 'var(--color-on-surface-variant)', margin: '0 0 32px' }}>
          {isAr
            ? 'أربع خطوات تفصلك عن معرفة أين يمكنك شراء ما تريده بأفضل سعر رصدناه.'
            : 'Four steps between you and knowing where you can buy what you want at the best price we observed.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--color-surface-container)',
                    border: '2px solid var(--brand-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 16,
                    color: 'var(--brand-green)',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div
                  style={{
                    background: 'var(--color-surface-container-low)',
                    border: '1px solid var(--color-outline-variant)',
                    borderRadius: 14,
                    padding: 18,
                    flex: 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon size={18} color="var(--brand-green)" strokeWidth={2} />
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--color-on-surface)' }}>{step.title}</div>
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--color-on-surface-variant)' }}>{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* One line stating the roles plainly — no proprietary matching/ranking mechanics,
            just what a shopper needs to trust the result (Founder Directive A). */}
        <div
          style={{
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 16,
            padding: '18px 20px',
            marginBottom: 32,
          }}
        >
          <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--color-on-surface-variant)', margin: 0 }}>
            {isAr
              ? 'توفيري لا يبيع منتجات ولا يشحنها — نعرض لك ما رصدناه من أسعار المتاجر، وأنت تشتري مباشرة من المتجر الذي تختاره.'
              : 'Tawveeri doesn’t sell or ship products — we show you the retailer prices we observed, and you buy directly from the store you choose.'}
          </p>
        </div>

        <div style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 20, padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-on-surface)', marginBottom: 8 }}>
            {isAr ? 'جاهز تبدأ؟' : 'Ready to start?'}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--color-on-surface-variant)', marginBottom: 20 }}>
            {isAr ? 'ابحث عن أي منتج الآن وشوف الأسعار المتاحة.' : 'Search for any product now and see the available prices.'}
          </p>
          <Link
            href={`/${locale}/search`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--brand-green)',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {isAr ? 'ابدأ المقارنة' : 'Start comparing'}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
