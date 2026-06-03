'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
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

  const columns: FooterColumn[] = useMemo(
    () =>
      isRTL
        ? [
            {
              title: 'عن توفيري',
              links: [
                { href: `/${locale}/about`,        label: 'من نحن'            },
                { href: `/${locale}/how-it-works`, label: 'كيف تعمل المنصة'  },
                { href: `/${locale}/blog`,          label: 'المدونة'           },
                // الوظائف حُذفت — لا وظائف معلنة حالياً
              ],
            },
            {
              title: 'تسوّق وقارن',
              links: [
                { href: `/${locale}/search`,     label: 'بحث المنتجات' },
                { href: `/${locale}/deals`,      label: 'العروض'        },
                { href: `/${locale}/coupons`,    label: 'الكوبونات'     },
                { href: `/${locale}/stores`,     label: 'المتاجر'       },
                { href: `/${locale}/categories`, label: 'الفئات'        },
              ],
            },
            {
              title: 'المساعدة',
              links: [
                { href: `/${locale}/contact`, label: 'تواصل معنا'        },
                { href: `/${locale}/faq`,     label: 'الأسئلة الشائعة'   },
                { href: `/${locale}/terms`,   label: 'الشروط والأحكام'   },
                { href: `/${locale}/privacy`, label: 'سياسة الخصوصية'   },
                // مركز المساعدة حُذف — يُعاد لاحقاً عند اكتمال المحتوى
              ],
            },
            {
              title: 'تابعنا',
              links: [
                { href: 'https://x.com/Tawveeri', label: '𝕏 تويتر'    },
                { href: '#',                       label: 'انستقرام'    },
                { href: '#',                       label: 'لينكدإن'     },
                { href: '#',                       label: 'يوتيوب'      },
              ],
            },
          ]
        : [
            {
              title: 'About',
              links: [
                { href: `/${locale}/about`,        label: 'Who we are'       },
                { href: `/${locale}/how-it-works`, label: 'How it works'     },
                { href: `/${locale}/blog`,          label: 'Blog'             },
              ],
            },
            {
              title: 'Shop & Compare',
              links: [
                { href: `/${locale}/search`,     label: 'Search products' },
                { href: `/${locale}/deals`,      label: 'Deals'           },
                { href: `/${locale}/coupons`,    label: 'Coupons'         },
                { href: `/${locale}/stores`,     label: 'Stores'          },
                { href: `/${locale}/categories`, label: 'Categories'      },
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
                { href: 'https://x.com/Tawveeri', label: '𝕏 Twitter'  },
                { href: '#',                       label: 'Instagram'   },
                { href: '#',                       label: 'LinkedIn'    },
                { href: '#',                       label: 'YouTube'     },
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
                {isRTL ? 'قارن. وفّر. بذكاء.' : 'Compare. Save. Smart.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SocialIcon href="https://x.com/Tawveeri" label="Twitter">
              <Twitter className="h-4 w-4" />
            </SocialIcon>
            <SocialIcon href="#" label="Instagram">
              <Instagram className="h-4 w-4" />
            </SocialIcon>
            <SocialIcon href="#" label="LinkedIn">
              <Linkedin className="h-4 w-4" />
            </SocialIcon>
            <SocialIcon href="#" label="YouTube">
              <Youtube className="h-4 w-4" />
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

        {/* Bottom — copyright only (تطبيق حُذف — غير جاهز) */}
        <div className="flex flex-col items-start gap-4 border-t border-white/10 pt-10 md:flex-row md:items-center md:justify-between">
          <p className="t-small text-white/60">
            {isRTL
              ? `© ${new Date().getFullYear()} توفيري. جميع الحقوق محفوظة.`
              : `© ${new Date().getFullYear()} Tawveeri. All rights reserved.`}
          </p>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <span>🇸🇦</span>
            <span>{isRTL ? 'مصنوع في السعودية' : 'Made in Saudi Arabia'}</span>
          </div>
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
