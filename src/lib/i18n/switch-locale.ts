/**
 * Switch the UI language — always as a DOCUMENT LOAD, never a client-side transition.
 *
 * WHY THIS EXISTS AS ONE FUNCTION. `<html lang>`, `<html dir>`, the font variables, the loaded
 * messages and every provider come from the ROOT layout (`src/app/layout.tsx`), which owns no
 * route param. Next does not re-render a layout whose params did not change, so a
 * `router.push('/en/…')` from an Arabic page swaps the URL and the page content while leaving
 * the document's declared language, its reading direction and all the messages on Arabic —
 * and nothing throws, no test fails, and no error surfaces. Exactly the class of silent
 * regression the restructure was meant to remove, not introduce.
 *
 * There were FIVE independent copies of this navigation (public shell, dashboard header, admin
 * header, and two in the profile page). Four of them would have been missed. One function, so
 * the next person changes it once.
 */
export function navigateToLocale(
  currentLocale: string,
  targetLocale: string,
  pathname?: string | null,
): void {
  if (targetLocale === currentLocale) return;

  const from = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  const next = from && from.startsWith(`/${currentLocale}`)
    ? from.replace(`/${currentLocale}`, `/${targetLocale}`)
    : `/${targetLocale}`;

  if (typeof window !== 'undefined') {
    window.location.href = next;
  }
}
