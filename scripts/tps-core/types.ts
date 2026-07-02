// scripts/tps-core/types.ts
// العقد الموحّد لكل Category Plugin في TPS
// أي فئة جديدة (ac, mobile, tv, refrigerator...) تطبّق هذا الـ interface فقط
// الـ Core لا يعرف شيئاً عن تفاصيل أي فئة بعينها

export type IdentityStatus = "valid" | "low_confidence_candidate" | "invalid";

export interface NormalizeResult {
  model_number: string | null;
  color?: string | null;
  payload: Record<string, unknown>;
  ignored_terms?: string[];
  ambiguity_flags: string[];
  /** خاص بفئة AC حالياً — هل التقنية استُنتجت من نوع الضاغط بدل ذكر صريح؟ */
  technology_inferred?: boolean;
}

export interface IdentityResult {
  key: string | null;
  status: IdentityStatus;
  reason?: string;
}

export interface ConfidenceResult {
  confidence: number;
  missing_critical: string[];
  needs_llm: boolean;
}

export interface CategoryPlugin {
  /** اسم الفئة كما يُخزَّن في detected_category */
  category: string;

  /** إصدار الـ Plugin — يُسجَّل مع كل observation لمعرفة أي نسخة بنت أي نتيجة */
  version: string;

  /** هل هذا النص ينتمي لهذه الفئة؟ */
  detect: (nameAr: string, nameEn: string) => boolean;

  /** استخراج الصفات المنظّمة من النص الخام */
  normalize: (nameAr: string, nameEn: string, rawBrand: string | null) => NormalizeResult;

  /** بناء identity_key من الصفات المستخرجة */
  buildIdentityKey: (
    brand: string | null,
    payload: Record<string, unknown>,
    normalizeMeta?: Record<string, unknown>
  ) => IdentityResult;

  /** حساب درجة الثقة بناءً على اكتمال الحقول الحرجة */
  scoreConfidence: (
    brand: string | null,
    payload: Record<string, unknown>,
    modelNumber: string | null,
    flags: string[]
  ) => ConfidenceResult;
}