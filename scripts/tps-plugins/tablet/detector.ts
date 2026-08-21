// scripts/tps-plugins/tablet/detector.ts
// Tablet category detector — precision-first. A row is a tablet only if it
// carries a tablet signal AND is not an accessory / phone / laptop. The tablet
// keyword space is heavily contaminated by accessories (Extra: "Laptop/Tablet
// Bag", cases, pens, keyboards). Unknown beats incorrect.
//
// Nuance: a real tablet BUNDLED "with Folio Case and Pen" is still a tablet
// (bundle = commercial, per the contract). So case/pen/keyboard reject ONLY when
// there is no storage spec (real tablets list storage; standalone accessories do
// not). Clear standalone-accessory and wrong-device signals hard-reject always.
const TABLET_SIGNALS = [
  "tablet", "تابلت", "ipad", "ايباد", "آيباد", "galaxy tab", "جالكسي تاب",
  "matepad", "mate pad", "idea tab", "honor pad", "redmi pad", "mi pad", "ماتباد",
];
const HARD_ACCESSORY = [
  "for ipad", "for galaxy tab", "for tablet", "لجهاز", "compatible with",
  "screen protector", "واقي شاشة", "tempered glass", "protector", "زجاج",
  "wall mount", "mount", "stand for", "bag", "backpack", "حقيب", "شنطة", "sleeve",
  "شاحن", "charger", "cable", "كابل", "كيبل", "adapter", "محول", "power bank",
  // MEASURED DEFECT (2026-08-22): 2 production canonical_products rows were tablet
  // accessories — an Arabic "compatible with" phrasing the English "compatible with"
  // above never covers ("حافظة ستاند متوافقة مع آيباد إير"), and a screen-protector
  // STICKER product whose Arabic word never matched "واقي شاشة"/"protector"
  // ("لاصقة حماية الشاشة كريستال لـ iPad Pro"). "لاصقة" (sticker) is a standalone
  // accessory-only word — a genuine tablet's own title never describes itself as a
  // sticker — so it is safe as a hard, unconditional reject like the rest of this list.
  "متوافقة مع", "لاصقة",
];
const SOFT_ACCESSORY = [
  "case", "كفر", "cover", "غطاء", "جراب", "folio", "keyboard", "كيبورد",
  "لوحة مفاتيح", "pencil", "pen ", "قلم", "stylus",
];
const WRONG_DEVICE = ["smartphone", "smart phone", " phone ", "جوال", "هاتف", "laptop", "لابتوب", "notebook"];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (!TABLET_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (WRONG_DEVICE.some((s) => text.includes(s.toLowerCase()))) return false;
  if (HARD_ACCESSORY.some((s) => text.includes(s.toLowerCase()))) return false;
  const hasStorage = /\b(16|32|64|128|256|512|1024)\s*gb\b|\b\d\s*tb\b/.test(text);
  if (!hasStorage && SOFT_ACCESSORY.some((s) => text.includes(s.toLowerCase()))) return false;
  return true;
}
