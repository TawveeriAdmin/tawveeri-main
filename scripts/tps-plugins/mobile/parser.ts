// scripts/tps-plugins/mobile/parser.ts
// نقل حرفي 100% من normalizeMobile() في write-product-observations.ts
// + normalizeBrand و extractStorageAndRam منقولتان هنا أيضاً (كانتا مشتركتين، الآن داخلية لهذا الـ plugin)

import type { NormalizeResult } from "../../tps-core/types";

// ── BRAND (نسخة محلية لـ mobile plugin) ───────────────────────
const BRAND_MAP: Record<string,string> = {
  "ابل":"Apple","apple":"Apple","سامسونج":"Samsung","samsung":"Samsung",
  "ال جي":"LG","lg":"LG","هاير":"Haier","haier":"Haier","ميديا":"Midea","midea":"Midea",
  "هام":"Haam","haam":"Haam","هوني ويل":"Honeywell","honeywell":"Honeywell",
  "اكسبير":"Xper","xper":"Xper","سيمفوني":"Symphony","symphony":"Symphony",
  "كرافت":"Crafft","crafft":"Crafft","فيشر":"Fisher","fisher":"Fisher",
  "هايسينس":"Hisense","hisense":"Hisense","شاومي":"Xiaomi","xiaomi":"Xiaomi",
  "يوجرين":"Ugreen","ugreen":"Ugreen","أنكر":"Anker","anker":"Anker",
  "أسوس":"Asus","asus":"Asus","جري":"Gree","gree":"Gree",
  "كلفيناتور":"Kelvinator","kelvinator":"Kelvinator",
};
function normalizeBrand(raw: string | null): string | null {
  return !raw ? null : (BRAND_MAP[raw.trim().toLowerCase()] || BRAND_MAP[raw.trim()] || raw.trim());
}

// ── STORAGE — نقل حرفي ─────────────────────────────────────────
function extractStorageAndRam(name: string): { storage_gb: number | null; ram_gb: number | null } {
  let storage: number | null = null, ram: number | null = null;
  const dual = name.match(/(\d+)\s*جيجا[\u060C,]\s*(\d+)\s*جيجا/);
  if (dual) {
    const a = parseInt(dual[1]), b = parseInt(dual[2]);
    return { storage_gb: Math.max(a, b), ram_gb: Math.min(a, b) };
  }
  const ramEx = name.match(/ذاكرة\s+(\d+)\s*جيجابايت\s*رام/i)
             || name.match(/(\d+)\s*(?:جيجابايت|جيجا)\s*رام/i)
             || name.match(/(\d+)\s*GB\s*RAM/i);
  if (ramEx) ram = parseInt(ramEx[1]);
  const stoEx = name.match(/(?:سعة\s*تخزين|تخزين)\s+(\d+)\s*(?:جيجابايت|جيجا)/i);
  if (stoEx) return { storage_gb: parseInt(stoEx[1]), ram_gb: ram };
  const tbEn = name.match(/(\d+)\s*TB/i);
  if (tbEn) { const v = parseInt(tbEn[1]) * 1024; if (v >= 256 && v <= 16384) return { storage_gb: v, ram_gb: ram }; }
  const gbAr = name.match(/(\d+)\s*جيجابايت(?!\s*رام)/i);
  if (gbAr) return { storage_gb: parseInt(gbAr[1]), ram_gb: ram };
  const giga = name.match(/(\d+)\s*جيجا(?!\s*(?:بايت|ي))/);
  if (giga) { const v = parseInt(giga[1]); if (v >= 32 && v <= 4096) storage = v; }
  if (!storage) {
    const gbEn = name.match(/(\d+)\s*[Gg][Bb]/);
    if (gbEn) { const v = parseInt(gbEn[1]); if (v >= 32 && v <= 4096) storage = v; }
  }
  return { storage_gb: storage, ram_gb: ram };
}

// ── COLORS / IGNORED — نقل حرفي ────────────────────────────────
const COLORS_AR = ["وردي","اخضر","أخضر","أسود","ابيض","أبيض","فضي","ذهبي","ازرق","أزرق","رمادي","بنفسجي","اصفر","أصفر","تيتانيوم"];
const COLORS_EN = ["pink","green","black","white","silver","gold","blue","gray","grey","purple","yellow","titanium"];
const IGNORED_T = ["5 جي","5g","شريحتين","dual sim","جديد","new","أصلي","ضمان","warranty"];

export function normalize(nameAr: string, nameEn: string, rawBrand: string | null): NormalizeResult {
  const name = nameAr || nameEn;
  const lower = name.toLowerCase();
  let color: string | null = null;
  const ignored: string[] = [];
  for (const c of [...COLORS_AR, ...COLORS_EN])
    if (name.includes(c)) { color = c; ignored.push(c); break; }

  let network: string | null = null;
  if (lower.includes("5g") || name.includes("5 جي") || name.includes("الجيل الخامس"))
    { network = "5G"; ignored.push("5G"); }

  const { storage_gb, ram_gb } = extractStorageAndRam(name);
  let family: string | null = null, generation: string | null = null, variant: string | null = null;
  const nb = normalizeBrand(rawBrand);

  if (nb === "Apple") {
    family = "iPhone";
    const m = name.match(
      /(?:ايفون|آيفون|iphone)\s*(\d+)\s*(برو\s*ماكس|برو|بلس|ميني|pro\s*max|pro|plus|mini|\be\b)?/i
    );
    if (m) {
      generation = m[1];
      const v = (m[2] || "").trim().toLowerCase();
      variant = !v ? "Standard"
        : (v === "برو ماكس" || v === "pro max") ? "Pro Max"
        : (v === "برو"      || v === "pro")      ? "Pro"
        : (v === "بلس"      || v === "plus")     ? "Plus"
        : (v === "ميني"     || v === "mini")     ? "Mini"
        : v === "e"                               ? "E"
        : "Standard";
    }
  }

  if (nb === "Samsung") {
    const s = name.match(/(?:جالاكسي|galaxy)\s+(?:إس|اس|s)\s*(\d+)\s*(إف إي|fe|ultra|ايدج|edge|plus|\+)?/i);
    if (s) {
      family = "Galaxy S"; generation = `S${s[1]}`;
      const v = s[2]?.trim().toLowerCase();
      variant = !v ? "Standard"
        : (v.includes("إف إي") || v === "fe") ? "FE"
        : v.includes("ultra") ? "Ultra"
        : (v.includes("ايدج") || v === "edge") ? "Edge"
        : (v.includes("plus") || v === "+") ? "Plus"
        : "Standard";
    }
    const zf = name.match(/(?:زد فليب|z flip)\s*(\d+)/i);
    if (zf) { family = "Galaxy Z"; generation = `Z Flip ${zf[1]}`; variant = "Flip"; }
    const za = name.match(/(?:جالاكسي|galaxy)\s+[Aa](\d+)/i);
    if (za) { family = "Galaxy A"; generation = `A${za[1]}`; variant = "Standard"; }
  }

  for (const t of IGNORED_T)
    if (name.toLowerCase().includes(t.toLowerCase()) && !ignored.includes(t)) ignored.push(t);

  return {
    model_number: null, // mobile لا يستخرج model_number في النسخة الأصلية
    color,
    payload: { family, generation, variant, storage_gb, ram_gb, network },
    ignored_terms: ignored,
    ambiguity_flags: [], // mobile الأصلي لا يبني ambiguity_flags إطلاقاً
  };
}