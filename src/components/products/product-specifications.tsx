'use client';

import { useTranslations } from '@/lib/simple-intl-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ProductCategory } from '@/lib/database/types';

interface ProductSpecificationsProps {
  specifications: Record<string, any>;
  category: ProductCategory;
  locale: string;
}

// Translation mapping for common specification keys
const specTranslations: Record<string, { ar: string; en: string }> = {
  storage: { ar: 'سعة التخزين', en: 'Storage' },
  ram: { ar: 'الذاكرة العشوائية', en: 'RAM' },
  screen_size: { ar: 'حجم الشاشة', en: 'Screen Size' },
  color: { ar: 'اللون', en: 'Color' },
  camera: { ar: 'الكاميرا', en: 'Camera' },
  battery: { ar: 'البطارية', en: 'Battery' },
  processor: { ar: 'المعالج', en: 'Processor' },
  graphics: { ar: 'البطاقة الرسومية', en: 'Graphics' },
  weight: { ar: 'الوزن', en: 'Weight' },
  display: { ar: 'الشاشة', en: 'Display' },
  resolution: { ar: 'دقة الشاشة', en: 'Resolution' },
  refresh_rate: { ar: 'معدل التحديث', en: 'Refresh Rate' },
  connectivity: { ar: 'الاتصال', en: 'Connectivity' },
  ports: { ar: 'المنافذ', en: 'Ports' },
  operating_system: { ar: 'نظام التشغيل', en: 'Operating System' },
  os: { ar: 'نظام التشغيل', en: 'OS' },
  dimensions: { ar: 'الأبعاد', en: 'Dimensions' },
  warranty: { ar: 'الضمان', en: 'Warranty' },
  audio: { ar: 'الصوت', en: 'Audio' },
  network: { ar: 'الشبكة', en: 'Network' },
};

function formatSpecValue(value: any, t: (key: string) => string): string {
  if (value === null || value === undefined) return '-';

  if (typeof value === 'boolean') {
    return value ? t('common.yes') : t('common.no');
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function translateSpecKey(key: string, locale: string): string {
  const translation = specTranslations[key.toLowerCase()];
  if (translation) {
    return locale === 'ar' ? translation.ar : translation.en;
  }
  // Return capitalized key if no translation found
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ProductSpecifications({
  specifications,
  category,
  locale,
}: ProductSpecificationsProps) {
  const t = useTranslations();
  const isRTL = locale === 'ar';

  if (!specifications || Object.keys(specifications).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('products.specifications.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-on-surface-variant text-center py-4">
            {t('products.specifications.noSpecifications')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const specEntries = Object.entries(specifications).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );

  if (specEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('products.specifications.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-on-surface-variant text-center py-4">
            {t('products.specifications.noSpecifications')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('products.specifications.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isRTL ? 'text-end' : 'text-start'}>
                  {t('products.specifications.specification')}
                </TableHead>
                <TableHead className={isRTL ? 'text-end' : 'text-start'}>
                  {t('products.specifications.value')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specEntries.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium text-on-surface">
                    {translateSpecKey(key, locale)}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {formatSpecValue(value, t)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

