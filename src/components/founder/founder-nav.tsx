'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const TABS = [
  { href: '', label: 'نظرة القرار' },
  { href: '/audience', label: 'الزوار' },
  { href: '/demand', label: 'المنتجات والاحتياجات' },
  { href: '/referrals', label: 'المتاجر والإحالات' },
  { href: '/expenses', label: 'المصروفات' },
  { href: '/revenue', label: 'الإيرادات والعمولات' },
  { href: '/goals', label: 'الأهداف' },
  { href: '/summary', label: 'الملخص' },
  { href: '/reports', label: 'التقارير' },
];

export function FounderNav({ locale }: { locale: string }) {
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ['w', 'start', 'end']) { const v = sp?.get(k); if (v) keep.set(k, v); }
  const suffix = keep.toString() ? `?${keep.toString()}` : '';
  const base = `/${locale}/admin/founder`;
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="أقسام مركز المؤسس">
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === '' ? pathname === base || pathname === `${base}/` : pathname.startsWith(href);
        return (
          <Link key={t.href} href={`${href}${suffix}`} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black whitespace-nowrap ${active ? 'bg-[#0f3d31] text-white' : 'bg-white text-on-surface-variant hover:bg-[#eef8f4] dark:bg-[#141c18] dark:text-white/60'}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
