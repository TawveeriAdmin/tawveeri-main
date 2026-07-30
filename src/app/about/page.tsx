// Non-localised /about existed as a SECOND full copy of the About page — including the founder
// card and the `85K+` / `8 متجر` / `تحديث يومي` claims removed under REDESIGN_BRIEF §17.1 and §1.
// Production 307s /about to the localised route, so this copy rendered nowhere; it survived as a
// duplicate source of truth that a future edit could have reactivated. "One doorway per
// function" (§7): the localised page is the only About page.
import { redirect } from 'next/navigation';

export default function AboutRedirect() {
  redirect('/ar/about');
}
