// scripts/tps-plugins/printer/detector.ts
// Printer detector — precision-first. Consumer inkjet/laser/tank/photo printers.
// The keyword space is dominated by CONSUMABLES and accessories (ink, toner,
// cartridges, drums, paper, USB-to-printer cables), which HARD-REJECT. Specialty
// printers (3D, label, barcode, receipt/thermal POS) are a different market and
// are rejected too. Unknown beats incorrect.
const PRINTER_SIGNALS = [
  "printer", "طابعة", "طابعه", "laserjet", "ليزرجت", "ليزر جيت", "deskjet", "ديسك جيت", "ديسكجت",
  "officejet", "اوفيس جيت", "pixma", "بيكسما", "بيكسيما", "ecotank", "ايكو تانك", "ايكوتانك",
  "smart tank", "سمارت تانك", "imageclass", "maxify", "workforce", "neverstop", "selphy",
];
const ACCESSORY_SIGNALS = [
  "ink cartridge", "cartridge", "خرطوش", "toner", "تونر", "حبر", "ink bottle", "درام", "drum unit",
  "refill", "تعبئة", "printhead", "print head", "رأس طباعة", "maintenance kit", "spare", "قطع غيار",
  "paper", "ورق", "to printer", "printer cable", "كابل الطابعة", "photo paper",
];
const WRONG_DEVICE = /3d\s*printer|طابعة ثلاثي|label\s*printer|طابعة ليبل|barcode\s*printer|طابعة باركود|receipt\s*printer|طابعة فواتير|thermal\s*printer|طابعة حرارية/;

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s))) return false;
  if (WRONG_DEVICE.test(text)) return false;
  return PRINTER_SIGNALS.some((s) => text.includes(s));
}
