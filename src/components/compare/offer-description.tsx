import { classifyCondition, type MerchantCondition } from '@/lib/campaigns/condition';

const CONDITION_LABELS: Record<MerchantCondition, { ar: string; en: string }> = {
  NEW: { ar: 'جديد بحسب الوصف', en: 'New according to description' },
  RENEWED: { ar: 'مجدّد بحسب الوصف', en: 'Renewed according to description' },
  REFURBISHED: { ar: 'مجدّد بحسب الوصف', en: 'Refurbished according to description' },
  USED: { ar: 'مستعمل بحسب الوصف', en: 'Used according to description' },
  // Says exactly what is unknown: the CONDITION (new/renewed/used) is not stated in the
  // merchant's own description. Never a stock statement — availability is rendered
  // separately from `availability`, and «حالة المنتج غير مؤكدة» was being read as "may be
  // out of stock" (founder review 2026-09-26, ADR-386).
  UNKNOWN: { ar: 'حالة السلعة (جديد/مجدّد) غير مذكورة في وصف العرض', en: 'Condition (new/renewed) not stated in the offer description' },
};

/** Describe the observed offer; never infer equivalent terms from a shared model. */
export function OfferDescription({ rawName, isAr }: { rawName: string | null; isAr: boolean }) {
  const condition = classifyCondition(rawName);
  return (
    <div className="my-3 min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-xs leading-relaxed" data-offer-description>
      <p className="font-semibold text-on-surface">
        {CONDITION_LABELS[condition][isAr ? 'ar' : 'en']}
      </p>
      <p className="mt-1 text-on-surface-variant">
        {isAr ? 'وصف العرض المرصود:' : 'Observed offer description:'}
      </p>
      <p dir="auto" className="mt-1 whitespace-normal break-words [overflow-wrap:anywhere] text-on-surface">
        {rawName?.trim() || (isAr ? 'لم يتوفر وصف لهذا العرض.' : 'No description available for this offer.')}
      </p>
      <p className="mt-2 text-on-surface-variant">
        {isAr
          ? 'تحقق من الحالة واللون والضمان لدى المتجر قبل الشراء؛ قد تختلف شروط العروض.'
          : 'Confirm condition, colour and warranty with the retailer before buying; offer terms may differ.'}
      </p>
    </div>
  );
}
