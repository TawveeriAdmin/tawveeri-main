type Locale = 'ar' | 'en' | string;
type DateStyle = 'short' | 'long' | 'datetime';

/**
 * Format a date with Hijri calendar for Arabic locale.
 *
 * - Arabic 'short':    ٢ شعبان ١٤٤٧ هـ
 * - Arabic 'long':     ٢ شعبان ١٤٤٧ هـ (Feb 25, 2026)
 * - Arabic 'datetime': ٢ شعبان ١٤٤٧ هـ (Feb 25, 2026 3:30 PM)
 * - English (all):     Gregorian only
 */
export function formatDate(
  date: string | Date | null | undefined,
  locale: Locale,
  style: DateStyle = 'long',
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const isAr = locale === 'ar';

  if (!isAr) {
    if (style === 'datetime') {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }

  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);

  const hijriStr = hijri.includes('هـ') ? hijri : `${hijri} هـ`;

  if (style === 'short') {
    return hijriStr;
  }

  if (style === 'datetime') {
    const greg = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
    return `${hijriStr} (${greg})`;
  }

  const greg = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
  return `${hijriStr} (${greg})`;
}

/**
 * Format a number with Eastern Arabic numerals for Arabic locale.
 * Prices should NOT use this — they keep Western numerals.
 */
export function formatNumber(num: number, locale: Locale): string {
  const isAr = locale === 'ar';
  return new Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US').format(num);
}

/**
 * Format a relative time string (e.g., "2 hours ago" / "منذ ساعتين").
 * Falls back to formatDate after 7 days.
 */
export function formatRelativeTime(
  date: string | Date | null | undefined,
  locale: Locale,
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const diffMs = Date.now() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return locale === 'ar' ? 'الآن' : 'Just now';
  }

  const isAr = locale === 'ar';
  const rtf = new Intl.RelativeTimeFormat(isAr ? 'ar-SA' : 'en-US', {
    numeric: 'auto',
  });

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');

  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');

  return formatDate(d, locale);
}
