// Non-localised /how-it-works existed as a SECOND full copy of the page — hardcoded dark
// palette, Arabic-only, and a stale "connected stores" grid naming retailers outside the
// approved active set (سامسونج SA / شاكر / الشتاء والصيف). Production 307s /how-it-works to
// the localised route, so this copy rendered nowhere; it survived as a duplicate source of
// truth a future edit could reactivate. Same treatment as /about (see about/page.tsx):
// "One doorway per function" — the localised page is the only How It Works page.
import { redirect } from 'next/navigation';

export default function HowItWorksRedirect() {
  redirect('/ar/how-it-works');
}
