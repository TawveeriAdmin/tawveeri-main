import { headers } from 'next/headers';
import { locales, defaultLocale } from '@/i18n';

/**
 * The locale for THIS request, read from headers.
 *
 * For anything ABOVE the `[locale]` segment — the root layout and `app/not-found.tsx` — there
 * is no route param to read, so the locale has to come from the request. `x-locale` is set by
 * our middleware; `x-next-intl-locale` is next-intl's own and is kept as a fallback so a
 * library upgrade cannot silently take the language with it. An unrecognised value falls back
 * to the default rather than being trusted: it ends up in `lang`, in `dir`, and in a dynamic
 * message import.
 *
 * SERVER ONLY, and it opts the caller into dynamic rendering. That costs nothing here —
 * `[locale]` is a dynamic segment with no `generateStaticParams`, so every page under it was
 * already rendered on demand.
 */
export function getRequestLocale(): string {
  const h = headers();
  const candidate = h.get('x-locale') || h.get('x-next-intl-locale') || '';
  return locales.includes(candidate as (typeof locales)[number]) ? candidate : defaultLocale;
}
