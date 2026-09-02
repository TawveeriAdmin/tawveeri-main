// FAQ — built 2026-08-07 under the public-trust/IA closeout mission. Was a 404.
//
// Every answer maps to a CAN SAY line in docs/LAUNCH_VOCABULARY.md or restates a Founder
// Directive from the mission brief — nothing here is new marketing language. No fixed
// catalogue/comparison figure is quoted (successor-rule risk); the About page made the same
// choice for the same reason. No proprietary matching/ranking mechanics are described
// (Founder Directive A) — answers stay at the "what a shopper needs to trust the result"
// altitude, not "how the engine decides."
//
// Native <details>/<summary> — a real accordion with zero client JS, keyboard- and
// screen-reader-accessible by default, and fully indexable (no content hidden behind a
// client-only expand).
import { PublicPageShell } from '@/components/public/public-page-shell';
import Link from 'next/link';
import { JsonLd } from '@/lib/seo/json-ld';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';
  return {
    title: isAr ? 'الأسئلة الشائعة' : 'FAQ',
    description: isAr
      ? 'إجابات مختصرة عن كيفية عمل توفيري، ومصدر الأسعار.'
      : 'Short answers about how Tawveeri works and where prices come from.',
    alternates: { canonical: `/${isAr ? 'ar' : 'en'}/faq` },
  };
}

// `aText` is the plain-text equivalent of `a` — required only where `a` is JSX (a Link is
// embedded), since schema.org's FAQPage `text` field must be a plain string, never markup.
type QA = { id?: string; q: string; a: React.ReactNode; aText?: string };

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale !== 'en';

  const faqs: QA[] = isAr
    ? [
        {
          q: 'ما هو توفيري؟',
          a: 'توفيري منصة سعودية لمقارنة أسعار الإلكترونيات والأجهزة المنزلية بين متاجر سعودية. نعرض لك الأسعار التي رصدناها، ومصدرها، ومتى رصدناها.',
        },
        {
          q: 'هل توفيري يبيع منتجات؟',
          a: 'لا. توفيري لا يبيع أي منتج ولا يشحنه ولا يخزّنه. نقارن الأسعار فقط، والشراء يتم مباشرة من المتجر الذي تختاره.',
        },
        {
          q: 'هل أحتاج حسابًا للمقارنة؟',
          a: 'لا. يمكنك البحث والمقارنة دون تسجيل دخول. الحساب مفيد فقط إذا أردت حفظ عمليات بحث أو تفعيل تنبيهات انخفاض الأسعار.',
        },
        {
          q: 'من أين تأتي الأسعار؟',
          a: 'من صفحات المنتجات على مواقع المتاجر نفسها. نرصد هذه الأسعار وننشرها مع اسم المتجر وتاريخ الرصد.',
        },
        {
          id: 'observed-price',
          q: 'ما معنى "آخر سعر رصدناه"؟',
          a: 'هو آخر سعر شاهدناه فعليًا في صفحة المتجر. هذا ليس بالضرورة السعر اللحظي في هذه الثانية — المتجر قد يغيّره في أي وقت. لهذا نكتب تاريخ الرصد بجانب كل سعر بدلًا من الادعاء بأنه "حالي".',
        },
        {
          q: 'لماذا قد يختلف السعر بعد ضغطي على الرابط؟',
          a: 'لأن السعر الذي تراه عندنا هو آخر سعر رصدناه، لا سعرًا مباشرًا من المتجر لحظة ضغطك. المتاجر تغيّر أسعارها باستمرار. تحقق دائمًا من السعر النهائي في صفحة المتجر قبل إتمام الشراء.',
        },
        {
          q: 'هل تقارنون نفس الموديل بالضبط؟',
          a: 'نعم — هذا هو الأساس الذي تُبنى عليه أي مقارنة عندنا. عندما نعرض سعرين لمنتج واحد من متجرين، فهذا يعني أننا تحققنا أنه نفس الموديل بنفس المواصفات (السعة، اللون إن كان مؤثرًا، إلخ).',
        },
        {
          q: 'ماذا يحدث عند اختيار متجر؟',
          a: 'ننقلك إلى صفحة المنتج نفسه في موقع ذلك المتجر لإتمام الشراء هناك مباشرة.',
        },
        {
          id: 'affiliate',
          q: 'هل تحصل توفيري على عمولة من Amazon.sa؟',
          a: 'توفيري مشارك في برنامج Amazon Services LLC Associates Program، وهو برنامج إعلاني تابع مصمم لتوفير وسيلة لمواقع الويب لكسب رسوم إعلانية عبر الربط بموقع Amazon.sa. بصفتي مشارك لأمازون، فإنني أكسب من عمليات الشراء المؤهلة. قد تحصل توفيري على عمولة عند إتمام شراء مؤهل عبر بعض الروابط، دون أي تكلفة إضافية عليك. هذا لا يؤثر أبدًا على الأسعار المعروضة أو على ترتيب النتائج — المصلحة التجارية لا تدخل أبدًا في الترتيب.',
        },
        {
          q: 'من يتولى الدفع والتوصيل والاستبدال والضمان؟',
          a: (
            <>
              المتجر الذي اشتريت منه — وليس توفيري. أي مشكلة تخص طلبك بعد الشراء يجب التواصل بشأنها مع المتجر مباشرة. لمشاكل تخص ما تعرضه توفيري نفسها (سعر خاطئ، رابط معطّل، مطابقة خاطئة)،{' '}
              <Link href={`/${locale}/contact`} style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
                تواصل معنا
              </Link>
              .
            </>
          ),
          aText: 'المتجر الذي اشتريت منه — وليس توفيري. أي مشكلة تخص طلبك بعد الشراء يجب التواصل بشأنها مع المتجر مباشرة. لمشاكل تخص ما تعرضه توفيري نفسها (سعر خاطئ، رابط معطّل، مطابقة خاطئة)، تواصل معنا عبر صفحة التواصل.',
        },
        {
          q: 'ماذا أفعل إذا وجدت سعرًا خاطئًا أو رابطًا معطلاً أو مطابقة خاطئة؟',
          a: (
            <>
              أخبرنا عبر{' '}
              <Link href={`/${locale}/contact`} style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
                صفحة التواصل
              </Link>
              . نراجع كل بلاغ لأن دقة ما نعرضه هي أساس الثقة في توفيري.
            </>
          ),
          aText: 'أخبرنا عبر صفحة التواصل. نراجع كل بلاغ لأن دقة ما نعرضه هي أساس الثقة في توفيري.',
        },
        {
          q: 'لماذا يظهر منتج في متجر واحد فقط؟',
          a: 'لأننا لم نرصد ذلك المنتج بعد في متجر آخر — إما لأن متجرًا آخر لا يبيعه، أو لأننا لم نغطِّ ذلك المنتج هناك حتى الآن. نوسّع التغطية باستمرار، ولا نعرض مقارنة إلا إذا رصدنا المنتج فعلًا في أكثر من متجر.',
        },
        {
          q: 'هل جميع متاجر ومنتجات السعودية مشمولة؟',
          a: 'لا. نغطي مجموعة من المتاجر السعودية النشطة ونوسّعها باستمرار، لكننا لا نغطي كل متجر أو كل منتج في السوق السعودي. حين لا نعرف شيئًا، نقول ذلك بدل الادّعاء بتغطية شاملة.',
        },
      ]
    : [
        {
          q: 'What is Tawveeri?',
          a: 'Tawveeri is a Saudi platform for comparing electronics and home-appliance prices across Saudi retailers. We show you the prices we observed, where they came from, and when we observed them.',
        },
        {
          q: 'Does Tawveeri sell products?',
          a: 'No. Tawveeri does not sell, ship, or stock any product. We only compare prices — the purchase happens directly at the store you choose.',
        },
        {
          q: 'Do I need an account to compare?',
          a: 'No. You can search and compare without signing in. An account is only useful if you want to save searches or set price-drop alerts.',
        },
        {
          q: 'Where do prices come from?',
          a: 'From the product pages on the retailers’ own websites. We observe these prices and publish them along with the store name and the date we observed them.',
        },
        {
          id: 'observed-price',
          q: 'What does "last observed price" mean?',
          a: 'It’s the last price we actually saw on the retailer’s page. It isn’t necessarily the price at this exact second — the retailer can change it at any time. That’s why we show the observation date next to every price instead of calling it "current."',
        },
        {
          q: 'Why can the price differ after I click through?',
          a: 'Because the price you see with us is the last price we observed, not a live feed from the retailer at the moment you click. Retailers change prices continuously. Always confirm the final price on the retailer’s page before completing a purchase.',
        },
        {
          q: 'Does Tawveeri compare the exact same model?',
          a: 'Yes — that’s the basis of any comparison we show. When we display two prices for one product from two stores, we’ve verified it’s the same model with the same specifications (storage, and colour where it matters, etc.).',
        },
        {
          q: 'What happens when I choose a store?',
          a: 'We take you to that exact product page on the retailer’s own site to complete the purchase there.',
        },
        {
          id: 'affiliate',
          q: 'Does Tawveeri earn a commission from Amazon.sa?',
          a: 'Tawveeri is a participant in the Amazon Services LLC Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by linking to Amazon.sa. As an Amazon Associate I earn from qualifying purchases. Tawveeri may earn a commission when you complete a qualifying purchase through some links, at no extra cost to you. This never affects the prices shown or how results are ranked — commercial interest never enters ranking.',
        },
        {
          q: 'Who handles payment, delivery, returns and warranty?',
          a: (
            <>
              The store you bought from — not Tawveeri. Any issue with your order after purchase should go to that retailer directly. For issues with what Tawveeri itself shows (a wrong price, a broken link, a wrong match),{' '}
              <Link href={`/${locale}/contact`} style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
                contact us
              </Link>
              .
            </>
          ),
          aText: 'The store you bought from — not Tawveeri. Any issue with your order after purchase should go to that retailer directly. For issues with what Tawveeri itself shows (a wrong price, a broken link, a wrong match), contact us via the contact page.',
        },
        {
          q: 'What should I do if I find a wrong price, a broken link, or a wrong match?',
          a: (
            <>
              Tell us via the{' '}
              <Link href={`/${locale}/contact`} style={{ color: 'var(--brand-green)', textDecoration: 'underline' }}>
                contact page
              </Link>
              . We review every report — the accuracy of what we show is the whole basis of trusting Tawveeri.
            </>
          ),
          aText: 'Tell us via the contact page. We review every report — the accuracy of what we show is the whole basis of trusting Tawveeri.',
        },
        {
          q: 'Why might a product appear at only one store?',
          a: 'Because we haven’t observed that product at another store yet — either another store doesn’t carry it, or we haven’t covered it there yet. We’re expanding coverage continuously, and we only show a comparison once we’ve actually observed the product at more than one store.',
        },
        {
          q: 'Are all Saudi retailers and products included?',
          a: 'No. We cover a set of active Saudi retailers and keep expanding it, but we do not cover every store or every product in the Saudi market. When we don’t know something, we say so rather than claiming full coverage.',
        },
      ];

  // FAQPage schema (2026-08-11, AI-assistant/Google discoverability phase) — every answer
  // here already comes verbatim from CAN SAY lines/Founder Directives (see this file's own
  // header comment); the plain-text `aText` field (added alongside the JSX `a` where a Link
  // is embedded) is what schema.org's `text` field requires, never markup.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.aText ?? (typeof item.a === 'string' ? item.a : item.q) },
    })),
  };

  return (
    <PublicPageShell locale={locale}>
      <JsonLd data={faqJsonLd} />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '10px 0 48px', textAlign: isAr ? 'right' : 'left' }}>
        <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 900, color: 'var(--color-on-surface)', margin: '6px 0 10px' }}>
          {isAr ? 'الأسئلة الشائعة' : 'Frequently asked questions'}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.9, color: 'var(--color-on-surface-variant)', margin: '0 0 28px' }}>
          {isAr ? 'إجابات مختصرة وصادقة — وحين لا نعرف، نقول ذلك.' : 'Short, honest answers — and when we don’t know, we say so.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faqs.map((item) => (
            <details
              key={item.q}
              id={item.id}
              open={item.id === 'affiliate' || undefined}
              style={{
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 14,
                padding: '14px 18px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 14.5,
                  color: 'var(--color-on-surface)',
                  listStyle: 'none',
                }}
              >
                {item.q}
              </summary>
              <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.9, color: 'var(--color-on-surface-variant)' }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
