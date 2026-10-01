// src/components/compare/amazon-price-note.tsx — ADR-399 (F-007).
//
// The amazon.sa Associates Program Policies (§2.ب) expect, next to any displayed Amazon price or
// availability, the time the information was retrieved and a note that it is subject to change,
// plus the Associates disclosure. Tawveeri shows prices it OBSERVED on the detail page (not an
// API feed), so the note states exactly that — an observation time in Riyadh time (+03) and
// «قابل للتغيير» — never "current price". Rendered ONLY beside an Amazon price; every other
// store keeps the shared «رصدناه …» day label unchanged. Pure, server-safe, no ranking effect.
import { resolveApprovedSlug } from '@/lib/retailers/approved-retailers';

const RIYADH = 'Asia/Riyadh';

/** «1 أكتوبر 2026، 21:37» / "1 Oct 2026, 21:37" in Riyadh time; null when the ISO is unusable. */
export function formatRiyadhObservation(iso: string | null | undefined, isAr: boolean): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const date = new Intl.DateTimeFormat(isAr ? 'ar-u-nu-latn' : 'en-GB', { timeZone: RIYADH, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: RIYADH, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${date}، ${time}`.replace('،', isAr ? '،' : ',');
}

export function isAmazonStore(storeSlugOrName: string | null | undefined): boolean {
  if (!storeSlugOrName) return false;
  return storeSlugOrName.toLowerCase() === 'amazon' || resolveApprovedSlug(storeSlugOrName) === 'amazon';
}

export const AMAZON_ASSOCIATES_DISCLOSURE = {
  ar: 'كشريك أمازون، نكسب من المشتريات المؤهلة.',
  en: 'As an Amazon Associate we earn from qualifying purchases.',
} as const;

/** The per-price line: observation time (+03) and the subject-to-change note. */
export function AmazonPriceNote({ observedAt, isAr, className = '' }: { observedAt: string | null | undefined; isAr: boolean; className?: string }) {
  const stamp = formatRiyadhObservation(observedAt, isAr);
  if (!stamp) return null;
  return (
    <p data-testid="amazon-price-note" className={`text-[11px] leading-snug text-on-surface-variant ${className}`}>
      {isAr ? `رُصد ${stamp} (+03) · السعر قابل للتغيير` : `Observed ${stamp} (+03) · price subject to change`}
    </p>
  );
}

/** The Associates disclosure sentence, placed on the surface that shows the Amazon price. */
export function AmazonAssociatesDisclosure({ isAr, className = '' }: { isAr: boolean; className?: string }) {
  return (
    <p data-testid="amazon-associates-disclosure" className={`text-[11px] text-on-surface-variant ${className}`}>
      {isAr ? AMAZON_ASSOCIATES_DISCLOSURE.ar : AMAZON_ASSOCIATES_DISCLOSURE.en}
    </p>
  );
}
