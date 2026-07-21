// scripts/tps-plugins/camera/detector.ts
// Camera category detector — precision-first (interchangeable-lens + compact
// cameras). Rejects camera accessories (lens-only, bag, tripod, battery,
// charger, filter, SD card, strap, gimbal) and non-cameras. Unknown beats
// incorrect. Note: "with lens"/kit is a real camera (bundle = commercial), only
// standalone "lens only" and pure accessories reject.
const CAMERA_SIGNALS = [
  "camera", "كاميرا", "dslr", "mirrorless", "eos", "كانون", "powershot",
  "nikon", "نيكون", "alpha", "fujifilm", "lumix", "gopro", "coolpix",
];
const ACCESSORY_SIGNALS = [
  "lens only", "lens kit only", "case", "كفر", "camera bag", "bag", "حقيب", "شنطة",
  "tripod", "ترايبود", "حامل", "strap", "حزام", "battery", "بطارية", "charger", "شاحن",
  "cable", "كابل", "filter", "فلتر", "sd card", "بطاقة ذاكرة", "memory card",
  "cleaning kit", "flash only", "microphone", "ميكروفون", "gimbal", "قاعدة", "remote",
  "screen protector", "واقي", "mount adapter", "vlogging kit", "lens hood",
];
const WRONG_DEVICE = ["smartphone", "laptop", "webcam", "كاميرا مراقبة", "security camera", "ip camera", "dash cam", "doorbell"];

export function detect(nameAr: string, nameEn: string): boolean {
  const text = (nameAr + " " + nameEn).toLowerCase();
  if (!CAMERA_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  if (WRONG_DEVICE.some((s) => text.includes(s.toLowerCase()))) return false;
  if (ACCESSORY_SIGNALS.some((s) => text.includes(s.toLowerCase()))) return false;
  return true;
}
