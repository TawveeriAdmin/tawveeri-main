// scripts/tps-plugins/ac/detector.ts
// نقل حرفي من جزء AC داخل detectCategory() الأصلي في write-product-observations.ts
// صفر تغيير في الكلمات المفتاحية أو منطق المقارنة

const AC_SIGNALS = [
  "مكيف","تكييف","split ac","air conditioner","btu","وحدة",
  "ويند فري","windfree","سبليت","air cooler","صحراوي","cooler",
];

const REFRIGERATOR_SIGNALS = [
  "ثلاجة","refrigerator","fridge","freezer","cu.ft","cu ft",
  "side by side","french door","bespoke","twin cooling",
];

// في detectCategory الأصلي: refrigerator له أولوية إذا حقق إشارة واحدة فأكثر
// (scores.refrigerator >= 1 يُعاد أولاً، قبل اختيار أعلى نتيجة)
export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();

  const hasRefrigeratorSignal = REFRIGERATOR_SIGNALS.some(s => text.includes(s.toLowerCase()));
  if (hasRefrigeratorSignal) return false;

  return AC_SIGNALS.some(s => text.includes(s.toLowerCase()));
}