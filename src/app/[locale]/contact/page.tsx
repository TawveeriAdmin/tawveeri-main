// CONTACT US — built 2026-08-07 under the public-trust/IA closeout mission. Was a 404 (P0).
//
// Deliberately minimal (mission §12): no call center, no fake SLA, no invented office hours.
// Channel chosen: a single monitored mailbox (`info@tawveeri.com`, already the site's real
// operational "from" address — see src/lib/auth/notifications.ts, src/lib/auth/authentica.ts)
// with mailto links pre-filled by report category. This collects ZERO data on our own
// servers (data-minimisation) and needs no new backend — appropriate for a platform this
// mission explicitly bounds against building new infrastructure.
//
// The phone number 0554311038 mentioned in the founder brief is NOT published here: nothing
// in the codebase confirms it is provisioned for public Tawveeri support or configured for
// WhatsApp Business. Publishing an unverified number is a worse outcome than omitting it —
// see the final mission report for this as a founder action item.
import { PublicPageShell } from '@/components/public/public-page-shell';
import { Mail, AlertTriangle, Link2Off, ShoppingBag, HelpCircle, Store } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';
  return {
    title: isAr ? 'تواصل معنا' : 'Contact us',
    description: isAr
      ? 'أبلغنا عن سعر غير صحيح أو رابط معطّل أو مطابقة خاطئة، أو تواصل معنا لأي سؤال عام.'
      : 'Report an incorrect price, a broken link, a wrong match, or reach us with a general question.',
    alternates: { canonical: `/${isAr ? 'ar' : 'en'}/contact` },
  };
}

const SUPPORT_EMAIL = 'info@tawveeri.com';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';

  const categories = isAr
    ? [
        { icon: AlertTriangle, title: 'سعر غير صحيح', subject: 'الإبلاغ عن سعر غير صحيح' },
        { icon: Link2Off, title: 'رابط متجر معطّل', subject: 'الإبلاغ عن رابط معطّل' },
        { icon: ShoppingBag, title: 'مطابقة منتج خاطئة', subject: 'الإبلاغ عن مطابقة منتج خاطئة' },
        { icon: HelpCircle, title: 'سؤال عام', subject: 'سؤال عام' },
      ]
    : [
        { icon: AlertTriangle, title: 'Incorrect price', subject: 'Reporting an incorrect price' },
        { icon: Link2Off, title: 'Broken retailer link', subject: 'Reporting a broken link' },
        { icon: ShoppingBag, title: 'Wrong product match', subject: 'Reporting a wrong product match' },
        { icon: HelpCircle, title: 'General question', subject: 'General question' },
      ];

  const cardStyle = {
    background: 'var(--color-surface-container-low)',
    border: '1px solid var(--color-outline-variant)',
    borderRadius: 14,
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    textDecoration: 'none',
    color: 'inherit',
  };

  return (
    <PublicPageShell locale={locale}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '10px 0 48px', textAlign: isAr ? 'right' : 'left' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 900, color: 'var(--color-on-surface)', margin: '6px 0 10px' }}>
          {isAr ? 'تواصل معنا' : 'Contact us'}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.9, color: 'var(--color-on-surface-variant)', margin: '0 0 28px' }}>
          {isAr
            ? 'إذا وجدت شيئًا خاطئًا في توفيري — سعر، رابط، أو مطابقة منتج — أخبرنا وسنراجعه.'
            : 'If something on Tawveeri is wrong — a price, a link, or a product match — tell us and we’ll review it.'}
        </p>

        {/* The distinction the mission requires: problems WITH Tawveeri vs. problems that
            belong to the retailer (order, delivery, payment, returns, warranty). */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 28,
          }}
        >
          <Store size={20} color="var(--brand-green)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--color-on-surface-variant)', margin: 0 }}>
            {isAr
              ? 'توفيري لا يبيع المنتجات ولا يشحنها. مشاكل الطلب أو الدفع أو التوصيل أو الاستبدال أو الضمان تخص المتجر الذي اشتريت منه — تواصل معه مباشرة. نحن نساعدك فقط فيما يخص ما تعرضه توفيري نفسها.'
              : 'Tawveeri does not sell or ship products. Order, payment, delivery, return, and warranty issues belong to the retailer you purchased from — contact them directly. We can only help with what Tawveeri itself shows you.'}
          </p>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-on-surface)', margin: '0 0 14px' }}>
          {isAr ? 'ما موضوع رسالتك؟' : 'What is this about?'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 30 }}>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <a
                key={cat.title}
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[Tawveeri] ${cat.subject}`)}`}
                style={cardStyle}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'var(--color-surface-container)',
                    color: 'var(--brand-green)',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-on-surface)' }}>{cat.title}</span>
              </a>
            );
          })}
        </div>

        <div
          style={{
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 16,
            padding: '20px 22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Mail size={18} color="var(--brand-green)" strokeWidth={2} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-on-surface)' }}>
              {isAr ? 'أو راسلنا مباشرة' : 'Or email us directly'}
            </span>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            dir="ltr"
            style={{ fontSize: 15, fontWeight: 600, color: 'var(--brand-green)', textDecoration: 'none' }}
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </PublicPageShell>
  );
}
