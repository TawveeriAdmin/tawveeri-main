/** Safe founder-facing copy. Provider payloads belong in diagnostics, never in the UI. */
export function radarStatusAr(status: string | null): string {
  if (status === 'ok') return 'اكتمل آخر فحص؛ راجع وقته لتقدير حداثة البيانات';
  if (/402|credits.depleted/i.test(status ?? '')) return 'توقف جلب الطلب من X لنفاد رصيد الخدمة. يلزم مراجعة الرصيد؛ البيانات السابقة لا تمثل الطلب الحالي.';
  if (/unconfigured/i.test(status ?? '')) return 'مصدر الطلب غير موصول بعد';
  if (/401|403/i.test(status ?? '')) return 'تعذر الوصول إلى مصدر الطلب؛ راجع صلاحيات الربط';
  if (/429|rate.limit/i.test(status ?? '')) return 'تأخر التحديث بسبب حد استخدام المصدر';
  return 'تعذر تحديث المصدر؛ حالة الطلب الحالية غير معروفة';
}

export function founderAIStatusAr(reason?: string): string {
  if (/max_tokens|truncat|JSON|unterminated/i.test(reason ?? '')) return 'لم تكتمل استجابة خدمة التوصيات، لذلك لم تُعرض توصية جزئية. راجع الأرقام الموثقة أدناه.';
  if (/401|403|not configured/i.test(reason ?? '')) return 'خدمة التوصيات غير متاحة؛ يلزم مراجعة إعدادات الربط. الأرقام أدناه مستقلة عنها.';
  if (/402|credit/i.test(reason ?? '')) return 'خدمة التوصيات متوقفة بسبب الرصيد. الأرقام أدناه مستقلة عنها.';
  return 'تعذر توليد توصيات مكتملة الآن. الأرقام أدناه مستقلة عن خدمة التوصيات.';
}
