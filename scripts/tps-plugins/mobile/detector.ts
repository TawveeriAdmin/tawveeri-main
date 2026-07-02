// scripts/tps-plugins/mobile/detector.ts
// نقل حرفي من جزء mobile داخل CAT_SIGNALS + detectCategory الأصلي
// صفر تغيير في الكلمات المفتاحية أو منطق الاكتشاف

const MOBILE_SIGNALS = [
  "ايفون","آيفون","iphone","جالاكسي","galaxy","جوال","هاتف",
  "زد فليب","z flip","z fold","s25","s24","s23","a57","a55","fe","إف إي",
];

const REFRIGERATOR_SIGNALS = [
  "ثلاجة","refrigerator","fridge","freezer","cu.ft","cu ft",
  "side by side","french door","bespoke","twin cooling",
];

// في detectCategory الأصلي: refrigerator له أولوية مطلقة (scores.refrigerator >= 1 يُعاد أولاً)
// نطبّق نفس القاعدة هنا — إذا فيه إشارة ثلاجة، mobile لا يفوز حتى لو فيه إشارة mobile أيضاً
export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();

  const hasRefrigeratorSignal = REFRIGERATOR_SIGNALS.some(s => text.includes(s.toLowerCase()));
  if (hasRefrigeratorSignal) return false;

  return MOBILE_SIGNALS.some(s => text.includes(s.toLowerCase()));
}