'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useTranslations } from '@/lib/simple-intl-provider';
import { useAuth } from '@/lib/auth/auth-context';

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

interface PageBreadcrumbsProps {
  items: BreadcrumbEntry[];
}

export function PageBreadcrumbs({ items }: PageBreadcrumbsProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';
  const t = useTranslations();
  const { user } = useAuth();

  const allItems: BreadcrumbEntry[] = [
    user
      ? { label: t('nav.dashboard'), href: `/${locale}/dashboard` }
      : { label: t('common.home'), href: `/${locale}` },
    ...items,
  ];

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              {index > 0 && (
                <BreadcrumbSeparator>
                  <ChevronLeft
                    className={`h-3.5 w-3.5 ${isRTL ? '' : 'rotate-180'}`}
                  />
                </BreadcrumbSeparator>
              )}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="max-w-[200px] truncate text-sm">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={item.href || '#'}
                      className="text-sm hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
