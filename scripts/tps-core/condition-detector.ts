// scripts/tps-core/condition-detector.ts
// ─────────────────────────────────────────────────────────────────────────────
// TIP Module #1 — Condition Detection Engine
// أول تطبيق عملي للميثاق (المادة 2: الثقة فوق الإيراد):
// المنتج المجدد ليس هو المنتج الجديد — حالة المنتج جزء من هويته القانونية.
// محرك عابر للمتاجر: يعمل على جرير وأمازون وأي متجر حالي أو مستقبلي.
// دالة نقية: نص → حالة. صفر اعتماد على متجر بعينه، صفر كتابة.
// ─────────────────────────────────────────────────────────────────────────────

export type ProductCondition =
  | "new"
  | "renewed"
  | "renewed-premium"
  | "renewed-a"
  | "renewed-b"
  | "renewed-c"
  | "refurbished"
  | "open-box"
  | "used";

export interface ConditionResult {
  condition: ProductCondition;
  isNew: boolean;
  labelAr: string;
  identitySuffix: string;
}

const LABELS_AR: Record<ProductCondition, string> = {
  "new": "جديد",
  "renewed": "مجدد",
  "renewed-premium": "مجدد — بريميوم",
  "renewed-a": "مجدد — درجة أ",
  "renewed-b": "مجدد — درجة ب",
  "renewed-c": "مجدد — درجة ج",
  "refurbished": "مُصلَح مصنعياً",
  "open-box": "علبة مفتوحة",
  "used": "مستعمل",
};

const RULES: Array<{ condition: ProductCondition; re: RegExp }> = [
  { condition: "renewed-premium", re: /renewed\s*premium/i },
  { condition: "renewed-a",       re: /(renewed|refurb\w*|مجدد)[\s,–-]*(grade\s*a\b|(درجة|فئة)\s*[أا](?![\u0621-\u064A]))/i },
  { condition: "renewed-b",       re: /(renewed|refurb\w*|مجدد)[\s,–-]*(grade\s*b\b|(درجة|فئة)\s*ب(?![\u0621-\u064A]))/i },
  { condition: "renewed-c",       re: /(renewed|refurb\w*|مجدد)[\s,–-]*(grade\s*c\b|(درجة|فئة)\s*ج(?![\u0621-\u064A]))/i },
  { condition: "renewed-a",       re: /grade\s*a[\s,–-]*.{0,20}(renewed|refurb\w*|مجدد)/i },
  { condition: "renewed-b",       re: /grade\s*b[\s,–-]*.{0,20}(renewed|refurb\w*|مجدد)/i },
  { condition: "refurbished",     re: /refurbish\w*|re-?certified|مُ?صلح\s*مصنعي/i },
  { condition: "renewed",         re: /\brenewed\b|مجدد/i },
  { condition: "open-box",        re: /open\s*-?\s*box|علبة\s*مفتوحة|كرتون\s*مفتوح/i },
  { condition: "used",            re: /\bused\b|\bpre-?owned\b|مستعمل/i },
];

export function detectCondition(
  nameAr: string,
  nameEn: string,
  model?: string | null
): ConditionResult {
  const hay = `${nameAr ?? ""} ${nameEn ?? ""} ${model ?? ""}`;

  for (const rule of RULES) {
    if (rule.re.test(hay)) {
      return {
        condition: rule.condition,
        isNew: false,
        labelAr: LABELS_AR[rule.condition],
        identitySuffix: `|${rule.condition}`,
      };
    }
  }

  return {
    condition: "new",
    isNew: true,
    labelAr: LABELS_AR["new"],
    identitySuffix: "",
  };
}