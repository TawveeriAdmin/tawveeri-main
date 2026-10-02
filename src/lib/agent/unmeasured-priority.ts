// src/lib/agent/unmeasured-priority.ts — ADR-400.
//
// A stated priority the catalogue cannot measure is DISCLOSED, never silently dropped and
// never scored by proxy. The reviewer's acceptance wording (2026-10-02): «طلبت هادئًا. لا نملك
// ديسيبل، فلم نرتّب عليه.» The AC decider already appends a per-item caution; this is the one
// answer-level sentence, computed from the candidates' own attributes — if ANY row carries a
// noise figure the note is withheld, so the data (not a constant) decides.
const UNMEASURED_PRIORITIES: Record<string, { attrs: string[]; ar: string; en: string }> = {
  quiet: { attrs: ["noise_db", "noise_level_db", "noise_level"], ar: "الهدوء (مستوى الضجيج بالديسيبل)", en: "quietness (noise level in dB)" },
};

export function unmeasuredPriorityNote(
  priorities: string[] | null | undefined,
  rows: { attributes?: Record<string, unknown> | null }[],
): { ar: string; en: string } | null {
  const missing: { ar: string; en: string }[] = [];
  for (const p of priorities ?? []) {
    const spec = UNMEASURED_PRIORITIES[p];
    if (!spec) continue;
    const measured = rows.some((r) => spec.attrs.some((k) => {
      const v = (r.attributes ?? {})[k];
      return v != null && Number.isFinite(Number(v));
    }));
    if (!measured) missing.push({ ar: spec.ar, en: spec.en });
  }
  if (!missing.length) return null;
  return {
    ar: `طلبت ${missing.map((m) => m.ar).join(" و")}: لا نملك هذا القياس لهذه المنتجات، فلم نرتّب عليه — الترتيب أدناه على السعة والسعر والأدلة فقط.`,
    en: `You asked for ${missing.map((m) => m.en).join(" and ")}: we hold no such measurement for these products, so it did not influence the ranking — the order below rests on capacity, price and evidence only.`,
  };
}
