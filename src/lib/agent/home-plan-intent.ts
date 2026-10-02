// src/lib/agent/home-plan-intent.ts — ADR-401 (consultant contract 4).
//
// «غير المفهوم يذهب إلى جهّز بيتك أو «لم أفهم الطلب»». When the decision engine cannot name a
// category, the search page must still guide: a sentence that describes furnishing a home
// (a flat, a wedding, "equip", several appliances, a whole budget) is a HOME PLAN request and
// is handed to /home-mission; anything else gets the honest «لم أفهم الطلب» with examples.
// Pure, deterministic, Arabic + English; never a product claim.

const HOME_CONTEXT = /شق[ةه]|بيت|منزل|تجهيز|أجهّز|اجهز|نجهز|أتزوج|اتزوج|زواج|عرس|عرسان|عريس|apartment|flat|new home|wedding|furnish/i;
const PLAN_SIGNAL = /خط[ةه]|أجهز[ةه]|اجهزه|ميزاني[ةه]|ألف|الف|budget|plan|appliances|\d{4,}/i;
const APPLIANCE_NOUNS = /مكيف|ثلاج|غسال|شاش|تلفزيون|فرن|بوتاجاز|نشاف|ac\b|fridge|washer|tv|oven/gi;

export function looksLikeHomePlan(text: string | null | undefined): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  const appliances = (t.match(APPLIANCE_NOUNS) || []).length;
  if (appliances >= 2 && PLAN_SIGNAL.test(t)) return true;
  return HOME_CONTEXT.test(t) && PLAN_SIGNAL.test(t);
}
