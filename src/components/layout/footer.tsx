'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { Twitter } from 'lucide-react';
import { useLocale, useTranslations } from '@/lib/simple-intl-provider';

interface FooterLink {
  href: string;
  label: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export function Footer() {
  const { locale, isRTL } = useLocale();
  const t = useTranslations();

  // IA CLOSEOUT (2026-08-07, public-trust mission). Every link here must earn its place:
  //   - Blog removed: no maintained content destination exists (was a 404 already).
  //   - Coupons removed from primary nav: production holds exactly ONE coupon row with no
  //     expiry-tracking or revalidation contract (`expires_at` is null, so the expiry-warning
  //     cron can never fire on it). The route still exists — not deleted, just not promoted.
  //   - "بحث المنتجات"/"Search products" removed: it duplicated the header's own search field
  //     and the "Browse all products" link already inside the categories menu — no distinct
  //     destination of its own.
  //   - Contact/FAQ were dead links (404) — now real pages, see src/app/[locale]/contact,
  //     src/app/[locale]/faq.
  const columns: FooterColumn[] = useMemo(
    () =>
      isRTL
        ? [
            {
              title: 'توفيري',
              links: [
                { href: `/${locale}/about`,        label: 'من نحن'            },
                { href: `/${locale}/how-it-works`, label: 'كيف تعمل المنصة'  },
              ],
            },
            {
              title: 'اكتشف',
              links: [
                { href: `/${locale}/categories`, label: 'الفئات'   },
                { href: `/${locale}/stores`,     label: 'المتاجر' },
                { href: `/${locale}/deals`,      label: 'العروض'  },
              ],
            },
            {
              title: 'المساعدة',
              links: [
                { href: `/${locale}/contact`, label: 'تواصل معنا'        },
                { href: `/${locale}/faq`,     label: 'الأسئلة الشائعة'   },
                { href: `/${locale}/terms`,   label: 'الشروط والأحكام'   },
                { href: `/${locale}/privacy`, label: 'سياسة الخصوصية'   },
              ],
            },
            {
              title: 'تابعنا',
              links: [
                // Only channels that EXIST. Instagram, LinkedIn and YouTube were `href="#"` —
                // links that look like channels and go nowhere. A dead social link costs more
                // trust than an absent one: it implies a presence we do not have and wastes a
                // click. Verified 2026-07-31: x.com/Tawveeri returns 200; the other three had
                // no destination at all. Add one back only when the account genuinely exists.
                { href: 'https://x.com/Tawveeri', label: '𝕏 تويتر' },
              ],
            },
          ]
        : [
            {
              title: 'Tawveeri',
              links: [
                { href: `/${locale}/about`,        label: 'Who we are'       },
                { href: `/${locale}/how-it-works`, label: 'How it works'     },
              ],
            },
            {
              title: 'Discover',
              links: [
                { href: `/${locale}/categories`, label: 'Categories' },
                { href: `/${locale}/stores`,     label: 'Stores'     },
                { href: `/${locale}/deals`,      label: 'Deals'      },
              ],
            },
            {
              title: 'Help',
              links: [
                { href: `/${locale}/contact`, label: 'Contact us'    },
                { href: `/${locale}/faq`,     label: 'FAQ'            },
                { href: `/${locale}/terms`,   label: 'Terms'          },
                { href: `/${locale}/privacy`, label: 'Privacy policy' },
              ],
            },
            {
              title: 'Follow us',
              links: [
                // See the Arabic column above — only channels that exist.
                { href: 'https://x.com/Tawveeri', label: '𝕏 Twitter' },
              ],
            },
          ],
    [locale, isRTL],
  );

  void t;

  return (
    <footer className="mt-24 bg-[color:var(--brand-dark-text)] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 md:px-8">

        {/* Top row — logo + social */}
        <div className="flex flex-col gap-8 border-b border-white/10 pb-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/Tawveeri.png"
              alt="Tawveeri"
              width={44}
              height={44}
              className="h-11 w-11 rounded-[var(--radius-md)] object-contain"
            />
            <div className="flex flex-col">
              <span className="t-h4 font-bold leading-none">
                {isRTL ? 'توفيري' : 'Tawveeri'}
              </span>
              <span className="t-small mt-0.5 text-white/60">
                {isRTL ? 'قارن، وفر بذكاء' : 'Compare smart. Save more.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* One icon, because one channel exists. The Instagram, LinkedIn and YouTube icons
                pointed at `#`. */}
            <SocialIcon href="https://x.com/Tawveeri" label="Twitter">
              <Twitter className="h-4 w-4" />
            </SocialIcon>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 gap-10 py-12 md:grid-cols-4 md:gap-8">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="t-caption mb-4 text-[var(--brand-gold)]">{col.title}</h3>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="t-small text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Affiliate disclosure — the ONE sitewide location (Founder Directive C). Short and
            non-repeating on purpose: full detail lives in one FAQ answer this line links to.
            The Amazon Associates Operating Agreement requires a "clear and prominent"
            disclosure; a persistent footer line satisfies that without turning it into a
            repeated sales message on every page. */}
        <div className="border-t border-white/10 pt-6 text-white/50">
          <p className="t-small">
            {isRTL ? (
              <>
                توفيري منصّة مقارنة مستقلة. قد نحصل على عمولة من بعض المتاجر عند الشراء عبر
                روابطنا — هذا لا يؤثر أبدًا على الأسعار أو الترتيب.{' '}
                <Link href={`/${locale}/faq#affiliate`} className="underline hover:text-white">
                  التفاصيل في الأسئلة الشائعة
                </Link>
                .
              </>
            ) : (
              <>
                Tawveeri is an independent comparison platform. We may earn a commission from
                some stores when you buy through our links — this never affects prices or
                ranking.{' '}
                <Link href={`/${locale}/faq#affiliate`} className="underline hover:text-white">
                  Details in our FAQ
                </Link>
                .
              </>
            )}
          </p>
        </div>

        {/* Bottom — copyright + brand line */}
        <div className="flex flex-col items-start gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="t-small text-white/60">
            {isRTL
              ? `© ${new Date().getFullYear()} توفيري. جميع الحقوق محفوظة.`
              : `© ${new Date().getFullYear()} Tawveeri. All rights reserved.`}
          </p>
          {/* P2-7 (1.4.3): white/30 on the #1A1A1A footer measured 2.72:1 in BOTH themes —
              the footer is dark either way, so this failed for every visitor. white/60 is
              the opacity the copyright line beside it already uses, and measures 6.9:1. */}
          <p className="t-small font-semibold text-white/60">
            {isRTL ? 'قارن، وفر بذكاء' : 'Compare smart. Save more.'}
          </p>
        </div>

      </div>
    </footer>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition-all hover:bg-[var(--brand-green)] hover:text-white"
    >
      {children}
    </a>
  );
}
