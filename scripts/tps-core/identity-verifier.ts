// scripts/tps-core/identity-verifier.ts — Phase 3B (2026-10-03).
// ─────────────────────────────────────────────────────────────────────────────
// CANDIDATE GENERATION PROPOSES, VERIFICATION DECIDES.
//
// Measured on the Phase-3A labelled set (459 cross-store pairs, docs/evidence/
// amazon-diagnostic-2026-10-03/phase3a/): identity-key equality alone had 65.2%
// precision — 31 false merges, of which 14 refurbished-vs-new, 6 LTE-vs-5G, 4
// 8GB-vs-12GB RAM, 2 Enterprise Edition and 5 cross-model appliance/tablet merges
// where the spec key is a family key. Widening detection without a verifier
// raised false merges to 43. This module is the gate between "same key" and
// "same purchasable item": it reads the attributes BOTH listings STATE and
//   • rejects a pair when a stated attribute conflicts (never on absence),
//   • routes a pair to review when the difference is a known-unknown
//     (region tag on one side, colour/finish-looking model suffix),
//   • otherwise lets the key equality stand.
// It is store-neutral, category-aware only where the attribute is meaningful,
// deterministic, and every decision carries machine-readable reasons. It never
// reads ranking, affiliate, price or store identity. It never fabricates an
// identifier: a code is only compared when both sides state one.
// ─────────────────────────────────────────────────────────────────────────────

export type VerdictOutcome = "match" | "reject" | "review";

export interface VerifierInput {
  /** Listing title (any language). */
  title: string;
  /** TPS category of the identity key both sides share. */
  category: string;
  /** Optional structured fields a source supplies (feed stores). Trusted over the title. */
  structured?: { ram_gb?: number | null; storage_gb?: number | null; network?: string | null; condition?: string | null; model?: string | null };
}

export interface Verdict {
  outcome: VerdictOutcome;
  /** Machine-readable reasons, e.g. "network_conflict:4g≠5g", "region_tag_one_side", "no_condition_conflict". */
  reasons: string[];
  /** The attribute values read on each side, for explainability / audit. */
  evidence: Record<string, { a: string | null; b: string | null }>;
}

const RAM_TIERS = new Set([2, 3, 4, 6, 8, 12, 16, 24]);
const clean = (s: string) => (s || "").toLowerCase().replace(/[‎‏‪-‮]/g, "").replace(/\s+/g, " ");

// ── attribute readers (return null when NOT STATED — absence is never evidence) ──
const readCondition = (t: string): string | null =>
  /\b(refurbished|renewed|pre-?owned|open box|open-box)\b|مجدد|مستعمل/.test(t) ? "refurbished" : /\bused\b/.test(t) ? "used" : null;

const readRam = (t: string): string | null => {
  const m =
    t.match(/(\d{1,2})\s*(?:gb|g|جيجا(?:بايت)?)\s*(?:ram|رام)/) ||              // "8GB RAM", "12G RAM", "6 جيجا رام"
    t.match(/(?:ram|رام)\s*(?:of\s*)?(\d{1,2})\s*(?:gb|g|جيجا)?/) ||            // "RAM 8GB"
    t.match(/(?<![\d.])(\d{1,2})\s*\+\s*(\d{2,4})\s*(?:gb|g|جيجا)/) ||         // "8+256GB", "4+128 GB"
    t.match(/(?<![\d.])(\d{2,4})\s*(?:gb)?\s*\+\s*(\d{1,2})\s*(?:gb|جيجا)/) || // "256GB + 8GB"
    t.match(/(?<![\d.])(\d{2,4})\s*(?:gb|جيجا(?:بايت)?)\s*,\s*(\d{1,2})\s*(?:gb|جيجا)(?![a-z])/) || // "256GB, 8GB," (Almanea form)
    t.match(/(?<![\d.])(\d{1,2})\s*(?:gb|g)\s*\/\s*(\d{2,4})\s*(?:gb|g)/);      // "8 GB/ 128 GB"
  if (!m) return null;
  const nums = m.slice(1).filter(Boolean).map(Number);
  const r = nums.length === 2 ? Math.min(...nums) : nums[0];
  return RAM_TIERS.has(r) ? String(r) : null;
};

const readNetwork = (t: string): string | null =>
  /(?<![a-z0-9])(5g|5 جي|الجيل الخامس)(?![a-z0-9])/.test(t) ? "5g"
  : /(?<![a-z0-9])(4g|lte|4 جي|الجيل الرابع)(?![a-z0-9])/.test(t) ? "4g" : null;

const readEdition = (t: string): string | null => /enterprise edition/.test(t) ? "enterprise" : null;

const readRegion = (t: string): "non_ksa" | "ksa" | null =>
  /international version|global version|uk version|us version|eu version|hk version|cn version|china version/.test(t) ? "non_ksa"
  : /ksa version|middle east version|saudi version|gcc version|نسخه السعوديه|نسخة السعودية/.test(t) ? "ksa" : null;

/** Unit-like or descriptive segments that disqualify a hyphen/slash token from being a manufacturer code
 *  ("55-INCH-4K", "DUAL-SIM-4G-128GB", "1000RPM", "18000BTU" are specs, not codes). */
const UNIT_SEGMENT = /^(\d+(?:\.\d+)?)(GB|TB|KG|HZ|MM|CM|MAH|W|L|K|P|MP|BTU|INCH|RPM|ML|KW|V|A|X|YEARS?|YR)$/;
const WORD_SEGMENT = new Set(["INCH", "SMART", "TV", "DUAL", "SIM", "WIFI", "UHD", "FHD", "HD", "HDR", "LED", "OLED", "QLED", "RAM", "ROM", "SSD", "HDD", "USB", "HDMI", "BLUETOOTH", "ANDROID", "IOS", "GLOBAL", "VERSION", "BLACK", "WHITE", "SILVER", "GREY", "GRAY", "BLUE", "RED", "GOLD", "GREEN", "PINK", "PRO", "MAX", "PLUS", "ULTRA", "LITE", "MINI", "NEW", "INVERTER", "DIGITAL", "SERIES", "MODEL", "NO"]);

/** A manufacturer-looking code: ≥6 chars, letters AND ≥3 digits, no spaces; unit/resolution/spec tokens excluded.
 *  When several qualify the LONGEST is taken: "F6000F … UA43F6000FUXZN" names the same set with the full
 *  code last; the short marketing code would otherwise be compared against a full code on the other side. */
const readModelCode = (t: string): string | null => {
  const toks = t.toUpperCase().match(/(?<![A-Z0-9])[A-Z0-9][A-Z0-9\-/.]{4,22}[A-Z0-9](?![A-Z0-9])/g) || [];
  const good = toks.map(stripCodeAffixes).filter(x => {
    const s = x.replace(/[^A-Z0-9]/g, "");
    if (s.length < 6 || s.length > 24) return false;
    // ≥3 digits: "QNED86", "LS19GBBDI" are line names, not manufacturer codes (Phase-3B trace P347).
    if (!/[A-Z]/.test(s) || (s.match(/\d/g) || []).length < 3) return false;
    if (/\d+X\d+/.test(s) || UNIT_SEGMENT.test(s)) return false;                                                  // units, dimensions ("1920X1080P", "111X8X64.7CM")
    if (/(1920|1080|2160|3840|1366|768)/.test(s) && s.length <= 10) return false;                                 // resolutions
    if (/^(USB|HDMI|WIFI|IPS|VA|LED|QLED|OLED|UHD|FHD|HDR|AMOLED|LTPS|HD)\d*$/.test(s)) return false;
    if (/^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(s)) return false;                                                        // "A17", "S25", "X7E" are model names, not codes
    // A hyphenated spec string is not a code when any segment is a unit or a descriptive word.
    const segs = x.split(/[-/.]/);
    if (segs.length > 1 && segs.some(seg => UNIT_SEGMENT.test(seg) || WORD_SEGMENT.has(seg))) return false;
    return true;
  });
  if (!good.length) return null;
  return good.reduce((best, x) => (x.replace(/[^A-Z0-9]/g, "").length > best.replace(/[^A-Z0-9]/g, "").length ? x : best), good[0]);
};

/** A code glued to a preceding word by a slash or hyphen — "MOTOR/HWM120-B316S6", "M/WW90DB8U94GBYL",
 *  "BASALT-4A8D4A" (Phase-3B shadow trace) — is the code without that word. A one-to-three-letter
 *  hyphen prefix ("R-V805PS1KV", "CV-930F") is part of the manufacturer's code and is kept. */
const stripCodeAffixes = (x: string) => x.replace(/^[A-Z]+\//, "").replace(/^[A-Z]{4,}-/, "").replace(/^SM-(?=[A-Z]\d{3})/, "");   // Samsung's universal "SM-" prefix is written by some merchants and not others

/** Canonical core of a code: strip a "/REGION" tail (Apple "MDVK4AB/A", Samsung "…GV/YL") or an LG
 *  ".MARKET" tail ("AM182C0.UK1") and separators. */
const codeCore = (code: string) => code.replace(/\/[A-Z0-9]{1,3}$/, "").replace(/\.[A-Z0-9]{2,5}$/, "").replace(/[^A-Z0-9]/g, "");

/** Optimal-string-alignment distance (Damerau-Levenshtein with adjacent transposition), capped at 2. */
const osaDistance = (s: string, t: string): number => {
  if (Math.abs(s.length - t.length) > 2) return 3;
  const d: number[][] = Array.from({ length: s.length + 1 }, (_, i) => [i, ...Array(t.length).fill(0)]);
  for (let j = 1; j <= t.length; j++) d[0][j] = j;
  for (let i = 1; i <= s.length; i++) for (let j = 1; j <= t.length; j++) {
    const cost = s[i - 1] === t[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[s.length][t.length];
};
const commonPrefixLength = (s: string, t: string): number => { let i = 0; while (i < s.length && i < t.length && s[i] === t[i]) i++; return i; };

/** eXtra's feed strips the decimal point from figures ("10 5 kg", "15 6-inch", "8 7 Inch"): a lone digit
 *  between a 1–2-digit figure and a size/weight unit is that figure's decimal (Phase-3B shadow trace). */
const restoreDecimals = (t: string) =>
  t.replace(/(?<![\d.])(\d{1,2}) (\d)(?=\s*(?:kg|كجم|كيلو|-?\s*inch|"|”|بوصة|بوصه|\/\s*\d))/g, "$1.$2");

const readScreenInch = (t: string, category: string): string | null => {
  const m = restoreDecimals(t).match(/(?<![\d.])(\d{1,2}(?:\.\d)?)\s*(?:"|”|''|-?\s*inch(?:es)?|بوصه|بوصة|انش|إنش)/);
  if (m) return String(Math.round(Number(m[1])));
  // Unit-less tablet/phone sizes written after the line name: "MatePad 10.4", "MatePad 11.5" (Phase-3A P373).
  if (category === "tablet") { const u = t.match(/(?:pad|tab)\s*(?:pro|air|se|lite|plus)?\s*(\d{1,2}\.\d)(?![\d])/); if (u) return String(Math.round(Number(u[1]))); }
  return null;
};

/** Washer capacity: in "10.5-7 kg" / "8/5 kg" combos the FIRST figure is the wash capacity. Returned as a
 *  canonical number string so "7.0" and "7" compare equal. */
const readKg = (t: string): string | null => {
  const m = restoreDecimals(t).match(/(?<![\d.])(\d{1,2}(?:\.\d)?)\s*(?:[-/]\s*\d{1,2}(?:\.\d)?\s*)?(?:kg|كجم|كيلو)/);
  return m ? String(Number(m[1])) : null;
};
const readLiters = (t: string): string | null => {
  const m = t.match(/(?<![\d.])(\d{2,4})\s*(?:l\b|liter|litre|لتر)/);
  return m ? String(Math.round(Number(m[1]) / 10) * 10) : null;
};
/** Washer-dryer combo vs washer: a type word is always stated on a washer listing, so both sides count as stated. */
const readWasherType = (t: string): string | null => {
  if (/(washer\s*(?:\/|and|&|-)?\s*dryer|washing\s*(?:&|and)\s*drying|2\s*in\s*1|2in1|with(?: \d+(?:\.\d)?\s*kg)? dryer|dryer combo|combo|\d+(?:\.\d)?\s*kg\s*dry(?:ing|er)?\b|dry(?:ing|er)?\s*\d+(?:\.\d)?\s*kg|غساله ومجفف|غسالة ومجفف|بمجفف|مجفف)/.test(t)) return "combo";
  if (/(washing machine|washer|غساله|غسالة)/.test(t)) return "washer";
  return null;
};
/** Bundle / multi-item listings are never the same purchasable item as a single unit. */
const readBundle = (t: string): string | null => /\b(bundle|combo pack|\+\s*(bud|buds|watch|band|cover|case)\b|with free|مع هديه|مع هدية|حزمه|حزمة|طقم)/.test(t) ? "bundle" : null;

const CATEGORY_RULES: Record<string, Array<"ram" | "network" | "screen" | "kg" | "liters" | "washer_type" | "model_code">> = {
  mobile: ["ram", "network"],
  tablet: ["ram", "network", "screen"],
  laptop: ["ram", "screen", "model_code"],
  smartwatch: ["network", "model_code"],
  tv: ["screen", "model_code"],
  monitor: ["screen", "model_code"],
  washing_machine: ["kg", "washer_type", "model_code"],
  refrigerator: ["liters", "model_code"],
  dishwasher: ["model_code"],
  microwave: ["model_code"],
  vacuum: ["model_code"],
  air_conditioner: ["model_code"],
  audio: ["model_code"],
  camera: ["model_code"],
  printer: ["model_code"],
};

/** Categories whose spec-tuple key is a FAMILY key: a code on one side only sends the pair to review. */
const APPLIANCE_CODE_REQUIRED = new Set(["washing_machine", "refrigerator", "dishwasher", "microwave"]);

export function verifyPair(a: VerifierInput, b: VerifierInput): Verdict {
  const ta = clean(a.title), tb = clean(b.title);
  const category = a.category || b.category;
  const reasons: string[] = []; const evidence: Verdict["evidence"] = {};
  const note = (k: string, va: string | null, vb: string | null) => { evidence[k] = { a: va, b: vb }; };
  let outcome: VerdictOutcome = "match";
  const reject = (r: string) => { outcome = "reject"; reasons.push(r); };
  const review = (r: string) => { if (outcome !== "reject") outcome = "review"; reasons.push(r); };

  // 1. Condition — a hard commercial distinction. Stated on one side only still rejects:
  //    a refurbished unit is never the same purchasable item as a (default-new) listing.
  const ca = a.structured?.condition ?? readCondition(ta), cb = b.structured?.condition ?? readCondition(tb); note("condition", ca, cb);
  if ((ca || null) !== (cb || null)) reject(`condition_conflict:${ca ?? "new"}≠${cb ?? "new"}`); else reasons.push("no_condition_conflict");

  // 2. Bundle vs single item.
  const ba = readBundle(ta), bb = readBundle(tb); note("bundle", ba, bb);
  if ((ba || null) !== (bb || null)) reject("bundle_vs_single");

  // 3. Edition.
  const ea = readEdition(ta), eb = readEdition(tb); note("edition", ea, eb);
  if ((ea || null) !== (eb || null)) reject(`edition_conflict:${ea ?? "standard"}≠${eb ?? "standard"}`);

  // 4. Category-aware stated attributes — conflict only when BOTH sides state a value.
  const rules = CATEGORY_RULES[category] ?? ["model_code"];
  const both = (k: string, va: string | null, vb: string | null, label: string) => { note(k, va, vb); if (va && vb && va !== vb) reject(`${label}_conflict:${va}≠${vb}`); else if (va && vb) reasons.push(`same_${label}`); };
  if (rules.includes("ram")) both("ram", a.structured?.ram_gb != null ? String(a.structured.ram_gb) : readRam(ta), b.structured?.ram_gb != null ? String(b.structured.ram_gb) : readRam(tb), "ram");
  if (rules.includes("network")) both("network", (a.structured?.network ?? readNetwork(ta))?.toLowerCase() ?? null, (b.structured?.network ?? readNetwork(tb))?.toLowerCase() ?? null, "network");
  if (rules.includes("screen")) both("screen_inch", readScreenInch(ta, category), readScreenInch(tb, category), "screen_size");
  if (rules.includes("kg")) both("capacity_kg", readKg(ta), readKg(tb), "capacity");
  if (rules.includes("liters")) both("capacity_l", readLiters(ta), readLiters(tb), "capacity");
  if (rules.includes("washer_type")) both("washer_type", readWasherType(ta), readWasherType(tb), "appliance_type");

  // 5. Model code — compared on a canonical core; a 1-character tail difference on an otherwise
  //    equal ≥8-char core is a colour/finish/revision designator whose meaning we do not know
  //    (RT62K7050SLB vs SLH) → review, never silent equivalence (Phase 3B brief §8).
  if (rules.includes("model_code")) {
    const ma = (a.structured?.model ?? readModelCode(ta))?.toUpperCase() ?? null, mb = (b.structured?.model ?? readModelCode(tb))?.toUpperCase() ?? null; note("model_code", ma, mb);
    if (ma && mb) {
      const ka = codeCore(ma), kb = codeCore(mb);
      const shorter = Math.min(ka.length, kb.length), prefix = commonPrefixLength(ka, kb);
      if (ka === kb) reasons.push("exact_model_code");
      // One code contains the other (R-V905PS1KV vs R-V905PS1KV-1TWH; a marketing code "F6000F" inside the
      // full "UA43F6000FUXZN"): a colour/market/length designator whose meaning we do not know — review,
      // never silent equivalence.
      else if (shorter >= 6 && (ka.includes(kb) || kb.includes(ka))) review(`model_code_suffix_unknown:${ma}~${mb}`);
      // Same ≥7-char stem with short differing tails (RT62K7050SLB vs SLH, WFR1114MB vs WFR1114WH,
      // WQP125201CWEG vs CSEG): a finish/colour designator — review (Phase-3B shadow trace: 238 rejects
      // in this class were inspected; the stem-equal ones were colour pairs, not different models).
      else if (prefix >= 7 && ka.length - prefix <= 4 && kb.length - prefix <= 4) review(`model_code_suffix_unknown:${ma}~${mb}`);
      // One insertion/substitution/transposition on a ≥7-char code (SAF80-B5 vs SAF80W-B5, NRF400DS vs a
      // merchant's typo NFR400DS): too close to call different, too far to call the same — review.
      else if (shorter >= 7 && osaDistance(ka, kb) <= 1) review(`model_code_near:${ma}~${mb}`);
      else reject(`model_code_conflict:${ma}≠${mb}`);
    } else if ((ma || mb) && APPLIANCE_CODE_REQUIRED.has(category)) {
      // Appliance spec keys are family keys (9 kg front-load washer, 620 L top-mount fridge). With a
      // code on only one side the pair cannot be confirmed as one purchasable item — review tier,
      // not a silent merge (Phase-3A P404/P425/P435 were exactly this class).
      review("model_code_one_side");
    }
  }

  // 6. Region tag — a known unknown (warranty / plug / firmware / localized variant): review when
  //    stated on exactly one side; both tagged the same way is not a conflict.
  const ra = readRegion(ta), rb = readRegion(tb); note("region", ra, rb);
  if ((ra === "non_ksa") !== (rb === "non_ksa")) review("region_tag_one_side");

  if (outcome === "match") reasons.push("key_equality_verified");
  return { outcome, reasons, evidence };
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP RESOLUTION — one authority for "which members of a shared key stay, which are reference
// rows, which leave", used by the compare page gate and by the shadow job so both report the same
// outcome. Pair verdicts are symmetric; this decides WHICH side leaves:
//   1. a member that conflicts with the anchor (the group's own identity name, when known) leaves;
//   2. remaining pairwise conflicts resolve to the largest mutually-consistent set (greedy: fewest
//      conflicts first, then input order — callers pass price order) — a single refurbished / 5G
//      listing leaves, it never empties the group;
//   3. review verdicts mark the side the evidence points at (the region-tagged side, the side
//      without a model code); a symmetric unknown (colour-code suffix, one-edit code) marks the
//      side that is not an exact-code match with the anchor, or both when the anchor cannot tell.
// ─────────────────────────────────────────────────────────────────────────────
export interface GroupMember { title: string; label?: string; structured?: VerifierInput["structured"] }
export interface MemberResolution { outcome: VerdictOutcome; reasons: string[] }

const REVIEW_REASON = /unknown|one_side|near|region/;
const CONFLICT_REASON = /conflict|bundle/;

/** The model code an identity key itself asserts (`brand|MODEL:<code>` keys): every member of such a
 *  group shares it by construction, so it is structured evidence for all of them. Null for spec keys. */
export function modelCodeOfKey(identityKey: string | null | undefined): string | null {
  const m = (identityKey || "").match(/\|MODEL:([^|]+)/);
  return m ? m[1].toUpperCase() : null;
}

export function resolveGroup(members: GroupMember[], category: string, anchorTitle?: string | null, sharedModel?: string | null): MemberResolution[] {
  const n = members.length;
  if (n < 2) return members.map(() => ({ outcome: "match", reasons: [] }));
  // The key's code fills in for a title that states none; a title that states a DIFFERENT code
  // keeps its own, so the member that contradicts its key is the one the pairwise check removes.
  const input = (m: GroupMember): VerifierInput => {
    const own = m.structured?.model ?? readModelCode(clean(m.title));
    const structured = sharedModel && !own ? { ...(m.structured || {}), model: sharedModel } : m.structured;
    return { title: m.title, category, structured };
  };
  const V = members.map((m) => members.map((p) => (m === p ? null : verifyPair(input(m), input(p)))));
  const A = anchorTitle ? members.map((m) => verifyPair(input(m), { title: anchorTitle, category, structured: sharedModel ? { model: sharedModel } : undefined })) : null;
  const pick = (r: string[], re: RegExp) => r.filter((x) => re.test(x)).join(",");
  const label = (i: number) => members[i].label ?? `#${i}`;
  const res: MemberResolution[] = members.map(() => ({ outcome: "match", reasons: [] }));

  // 1 + 2: who stays.
  const alive = members.map((_, i) => !(A && A[i].outcome === "reject"));
  for (let i = 0; i < n; i++) if (!alive[i]) res[i] = { outcome: "reject", reasons: [`vs canonical: ${pick(A![i].reasons, CONFLICT_REASON)}`] };
  const rejectsOf = (i: number) => V[i].reduce((c, v, j) => c + (v && alive[j] && v.outcome === "reject" ? 1 : 0), 0);
  const order = members.map((_, i) => i).filter((i) => alive[i]).sort((i, j) => rejectsOf(i) - rejectsOf(j) || i - j);
  const kept: number[] = [];
  for (const i of order) {
    const clash = kept.find((j) => V[i][j]!.outcome === "reject");
    if (clash === undefined) kept.push(i);
    else { alive[i] = false; res[i] = { outcome: "reject", reasons: [`vs ${label(clash)}: ${pick(V[i][clash]!.reasons, CONFLICT_REASON)}`] }; }
  }

  // 3: who is a reference row.
  for (const i of kept) {
    const reasons: string[] = [];
    if (A && A[i].outcome === "review") reasons.push(`vs canonical: ${pick(A[i].reasons, REVIEW_REASON)}`);
    for (const j of kept) {
      if (j === i) continue;
      const v = V[i][j]!;
      if (v.outcome !== "review") continue;
      const pointsAtMe =
        (v.reasons.includes("region_tag_one_side") && v.evidence.region?.a === "non_ksa") ||
        (v.reasons.includes("model_code_one_side") && v.evidence.model_code?.a == null);
      const pointsAtOther =
        (v.reasons.includes("region_tag_one_side") && v.evidence.region?.b === "non_ksa") ||
        (v.reasons.includes("model_code_one_side") && v.evidence.model_code?.b == null);
      const symmetric = v.reasons.some((r) => /model_code_suffix_unknown|model_code_near/.test(r));
      const iExact = !!A && A[i].reasons.includes("exact_model_code"), jExact = !!A && A[j].reasons.includes("exact_model_code");
      if (pointsAtMe || (symmetric && !(iExact && !jExact)) || (!pointsAtOther && !symmetric)) reasons.push(`vs ${label(j)}: ${pick(v.reasons, REVIEW_REASON)}`);
    }
    if (reasons.length) res[i] = { outcome: "review", reasons };
  }
  return res;
}
