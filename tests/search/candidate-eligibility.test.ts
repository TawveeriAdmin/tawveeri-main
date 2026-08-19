/**
 * CANDIDATE ELIGIBILITY, GENERICALLY (D→E mission, Section 6 — 2026-08-09).
 *
 * AUDITED FINDING: `/api/search`'s relevance/category gate only ever engages when the query
 * contains a recognized product-type noun (`isMainProductTypeQuery`) — for ANY sentence
 * without one, whatever the underlying fuzzy match (Algolia/Supabase) returned was served
 * completely unfiltered. `looksLikeSentenceNotProductQuery` closes that generically: a
 * sentence-shaped query with no product-type noun is not a product search regardless of WHY
 * it reached this endpoint, and gets the same honest-zero treatment `categoryEnforcedZero`
 * already applies to a failed category-scoped match.
 */
import { looksLikeSentenceNotProductQuery, isAccessoryShapedQuery, excludeIneligibleCandidates, GENERIC_EXPANSION_STOPWORDS, hasStrongACSignal, hasStrongMonitorSignal, hasStrongWatchSignal, hasStrongDishwasherSignal, hasStrongOvenSignal, hasStrongCookerSignal } from "@/app/api/search/route";

describe("looksLikeSentenceNotProductQuery — the generic candidate-eligibility floor", () => {
  it("THE FOUNDER'S EXACT T2 SENTENCE is sentence-shaped, not a product query", () => {
    expect(looksLikeSentenceNotProductQuery("طيب لو رفعت ميزانيتي إلى 4000 ريال وش بيتغير؟ وهل يستاهل أدفع الزيادة؟")).toBe(true);
  });

  it("a long sentence (6+ words) with no product noun is sentence-shaped", () => {
    expect(looksLikeSentenceNotProductQuery("أبغى شي يخليني أوفر فلوس هالشهر بجد")).toBe(true);
  });

  it("a short question with a question mark is sentence-shaped even under 6 words", () => {
    expect(looksLikeSentenceNotProductQuery("هل يستاهل؟")).toBe(true);
    expect(looksLikeSentenceNotProductQuery("ليش هذا أفضل")).toBe(true);
  });

  it("a real, short product query is NOT sentence-shaped", () => {
    expect(looksLikeSentenceNotProductQuery("ايفون 16 برو")).toBe(false);
    expect(looksLikeSentenceNotProductQuery("مكيف جري 24000")).toBe(false);
    expect(looksLikeSentenceNotProductQuery("لابتوب ديل")).toBe(false);
  });

  it("a short brand+spec fragment (no question marker, under the word-count floor) is NOT sentence-shaped", () => {
    // This function is only ever CALLED when isMainProductTypeQuery already returned false
    // (a real product query with a recognized noun never reaches it) — this pins its own
    // standalone boundary: short + no question marker = product-fragment-shaped, regardless
    // of whether a noun happens to be recognized.
    expect(looksLikeSentenceNotProductQuery("موديل XR500 ابيض")).toBe(false);
  });

  // MEASURED DEFECT (2026-08-10, D→E mission Section 11 refrigerator re-verification): the
  // ORIGINAL comment above ("only ever CALLED when isMainProductTypeQuery already returned
  // false") turned out to be the bug's own root cause, not just this function's calling
  // convention. «ابي ثلاجة كبيرة للعائلة موفرة للكهرباء وميزانيتي 3000 ريال» contains "ثلاجة"
  // (a recognized MAIN_PRODUCT_TYPES noun), so `isMainProductTypeQuery` returned true and the
  // route's OTHER (weaker) relevance-gate branch ran instead — leaving 324 unfiltered
  // refrigerator results on screen instead of the honest zero the mission's own "zero beats
  // wrong" principle calls for. The route-level fix (src/app/api/search/route.ts) now checks
  // this function FIRST, regardless of whether a category noun is also present — this test
  // pins that a category-noun-bearing sentence still classifies as sentence-shaped, which is
  // the precondition the route-level fix depends on.
  it("a sentence-shaped query that ALSO contains a recognized category noun is still sentence-shaped", () => {
    expect(looksLikeSentenceNotProductQuery("ابي ثلاجة كبيرة للعائلة موفرة للكهرباء وميزانيتي 3000 ريال")).toBe(true);
    expect(looksLikeSentenceNotProductQuery("ابي مكيف لغرفة 30 متر هادي وموفر للكهرباء وميزانيتي 2500 ريال")).toBe(true);
  });
});

/**
 * "FILTER ELIGIBILITY FIRST. SORT SECOND. PRICE MAY RANK ELIGIBLE PRODUCTS. PRICE MUST NEVER
 * MAKE AN INELIGIBLE PRODUCT ELIGIBLE." (D→E mission Part B — 2026-08-10, full autonomy
 * mandate, "accessories / irrelevant products must not win".)
 */
describe("isAccessoryShapedQuery — the query-level half of the accessory distinction", () => {
  it("recognizes an explicit accessory search, even when it also names a device", () => {
    expect(isAccessoryShapedQuery("جراب ايفون")).toBe(true);
    expect(isAccessoryShapedQuery("شاحن لابتوب")).toBe(true);
    expect(isAccessoryShapedQuery("iphone case")).toBe(true);
    expect(isAccessoryShapedQuery("كفر جوال متوافق مع ايفون 16")).toBe(true);
  });
  it("a plain device search is NOT accessory-shaped", () => {
    expect(isAccessoryShapedQuery("ايفون 16 برو")).toBe(false);
    expect(isAccessoryShapedQuery("لابتوب ديل")).toBe(false);
    expect(isAccessoryShapedQuery("مكيف جري 24000")).toBe(false);
  });
});

describe("excludeIneligibleCandidates — MEASURED LIVE (production, 2026-08-10): 'لابتوب' sorted lowest-price-first", () => {
  // Reproduces the exact production evidence: real laptop prices from the same search
  // (ideapad 3 2299, elitebook 999, latitude 1799 …) alongside the four measured junk items
  // that ranked above every one of them. None of the junk titles match `hasAccessoryHint`'s
  // keyword list (verified separately) — the price-floor stage is what must catch these.
  const junk = [
    { name_ar: "لابتوب pingcool PC18", name_en: null, best_price: 4 },
    { name_ar: "لابتوب baseus SUZC-0G", name_en: null, best_price: 21 },
    { name_ar: "لابتوب لينوفو GX41K08218", name_en: null, best_price: 75 },
    { name_ar: "تجميعة السماعة الداخلية للكمبيوتر المحمول، مصممة للابتوب المدمج والمتين", name_en: null, best_price: 101 },
  ];
  // A representative SPREAD, not just a few cheap entries clustered together — with only a
  // handful of items the fixture's OWN median would sit far below the real 497-item
  // population's (~2,000-3,000+ SAR, per the live page actually observed), under-testing
  // the price floor exactly where it matters. These are the real prices captured on the
  // same live page as the junk above.
  const real = [
    { name_ar: "لابتوب اتش بي elitebook، i5-8، 8GB رام، 256GB", name_en: null, best_price: 999 },
    { name_ar: "لابتوب ديل latitude، i5-8، 8GB رام، 256GB، 14\"", name_en: null, best_price: 669 },
    { name_ar: "لابتوب أيسر aspire، core3، 8GB رام، 256GB، 15.6\"", name_en: null, best_price: 1799 },
    { name_ar: "لابتوب لينوفو ideapad 3، i5-13، 8GB رام، 512GB، 15.6\"", name_en: null, best_price: 2299 },
    { name_ar: "لابتوب اتش بي، core5، 16GB رام، 512GB، 16\"", name_en: null, best_price: 3299 },
    { name_ar: "لابتوب إم إس آي cyborg، i5-13، 16GB رام، 512GB، 15.6\" RTX4050", name_en: null, best_price: 3549 },
    { name_ar: "لابتوب اتش بي، core7، 16GB رام، 1TB، 14\"", name_en: null, best_price: 3999 },
  ];

  it("excludes every measured junk item while keeping every genuine laptop", () => {
    const result = excludeIneligibleCandidates([...junk, ...real]);
    const survivingNames = result.map((r) => r.name_ar);
    for (const j of junk) expect(survivingNames).not.toContain(j.name_ar);
    for (const r of real) expect(survivingNames).toContain(r.name_ar);
  });

  it("excludes a keyword-flagged accessory (the ORIGINAL soft-penalty case) too, not just the price-floor case", () => {
    const cable = { name_ar: "كيبل شحن ايفون", name_en: null, best_price: 49 };
    const result = excludeIneligibleCandidates([cable, ...real]);
    expect(result.map((r) => r.name_ar)).not.toContain(cable.name_ar);
  });

  it("never wipes the page: if EVERY candidate is accessory-hinted, keeps them rather than returning zero", () => {
    const allAccessories = [
      { name_ar: "كيبل شحن ايفون", name_en: null, best_price: 49 },
      { name_ar: "شاحن ايفون سريع", name_en: null, best_price: 39 },
    ];
    expect(excludeIneligibleCandidates(allAccessories)).toHaveLength(2);
  });

  it("does not apply the price floor with too few candidates to compute a meaningful median (fewer than 4)", () => {
    const tiny = [
      { name_ar: "لابتوب pingcool PC18", name_en: null, best_price: 4 },
      { name_ar: "لابتوب ديل latitude، i5-8، 8GB رام، 256GB، 14\"", name_en: null, best_price: 669 },
    ];
    // Below the 4-item floor this function itself documents — both survive untouched rather
    // than a median computed from too small a sample to be a real statistical signal.
    expect(excludeIneligibleCandidates(tiny)).toHaveLength(2);
  });

  it("leaves a genuinely cheap but real clearance-priced device untouched (well above 15% of median)", () => {
    const clearance = { name_ar: "لابتوب اتش بي elitebook، i5-4، 4GB رام، 500GB، 12.5\"", name_en: null, best_price: 475 };
    // median of [475, 669, 999, 1799, 2299, 3299, 3549, 3999] (8 items) = the 5th sorted
    // value = 2299 → floor = 344.85; 475 clears it easily.
    const result = excludeIneligibleCandidates([clearance, ...real]);
    expect(result.map((r) => r.name_ar)).toContain(clearance.name_ar);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F re-verification sweep): sorting
 * "مكيف" lowest-price-first put air fryers (383-1110 SAR) and a "تابلت Air Tab" tablet ABOVE
 * every genuine air conditioner (which start at 1065 SAR) — a wrong-category leak neither of
 * `excludeIneligibleCandidates`'s two signals (accessory hint, statistical price floor) can
 * catch, since these products are neither accessory-shaped nor abnormally cheap. Traced to
 * `ARABIC_TO_ENGLISH['مكيف']` including the phrase "air conditioner", which gets split into
 * individual OPTIONAL Algolia search words — silently injecting bare "air", one of the most
 * generic tokens in English product titles, as its own standalone optional match.
 */
describe("GENERIC_EXPANSION_STOPWORDS — proven-generic tokens never become standalone optional search words", () => {
  it('contains "air" — the measured contamination vector for "مكيف" → air fryers/tablets', () => {
    expect(GENERIC_EXPANSION_STOPWORDS.has("air")).toBe(true);
  });
  it("does not remove genuinely distinctive category words (would zero out real expansions)", () => {
    for (const legit of ["ac", "split", "conditioner", "refrigerator", "laptop", "tv", "monitor", "screen", "router", "vacuum"]) {
      expect(GENERIC_EXPANSION_STOPWORDS.has(legit)).toBe(false);
    }
  });

  // MEASURED LIVE (production, 2026-08-10, same session, founder follow-up "check other
  // categories for the same bare-token leak"): the identical mechanism recurred wherever a
  // category mapped to a generic English word describing a FEATURE rather than the product —
  // "شاشة"/"شاشات"→'display' put a smartwatch (spec sheet: "1.83in HD Display") into monitor
  // results; "راوتر"→'wifi'/'network' severely polluted router results with WiFi cameras, a
  // smart plug, and mini projectors; "مكنسة"→'cleaner' pulled in a phone-cleaning-kit
  // accessory; "غسالة"→'washer' put a "Karcher Pressure Washer" at position #1 (cheapest) of
  // an otherwise all-genuine washing-machine list, and its sibling phrase "washing machine"
  // independently injects bare 'machine' (confirmed earlier this session pulling coffee
  // machines/ice makers/game consoles into washing-machine results).
  it('contains every measured contamination vector found in the cross-category sweep', () => {
    for (const w of ['display', 'wifi', 'network', 'cleaner', 'washer', 'machine', 'iron', 'steamer']) {
      expect(GENERIC_EXPANSION_STOPWORDS.has(w)).toBe(true);
    }
  });

  // MEASURED LIVE (production, 2026-08-10, same session, second "check other categories"
  // follow-up): "مكواة" (clothes iron) returned ZERO genuine irons in its top 15 — every
  // result was an unrelated cooking appliance (electric pots, food steamers, pressure
  // cookers, waffle/sandwich makers). ARABIC_TO_ENGLISH['مكواة'] = ['iron', 'steamer']
  // injects both as bare optional words; "steamer" matches food steamers, "iron" matches
  // "waffle iron"/"cast iron" cookware. Genuine irons DO exist in the catalog (Black &
  // Decker steam irons, confirmed via a more specific query) — buried under contamination.
  it('does not remove distinctive category words used elsewhere (sanity)', () => {
    for (const legit of ['refrigerator', 'oven', 'blender', 'router', 'ac']) {
      expect(GENERIC_EXPANSION_STOPWORDS.has(legit)).toBe(false);
    }
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, founder follow-up "fix the ac
 * token leak"): even after GENERIC_EXPANSION_STOPWORDS removed "air", three items still
 * survived on the "مكيف" lowest-price sort — two ZOSHING TVs mentioning "AC/DC-12V" power
 * (865/957 SAR) and a Brovi router mentioning Wi-Fi standard "802.11...ac..." (1149 SAR) —
 * because "ac" itself was deliberately kept as an Algolia optional word (removing it would
 * hurt genuine AC search recall: real listings are literally titled "Split AC"/"Window AC").
 * `hasStrongACSignal` requires a COMPOUND AC-specific phrase rather than bare "ac"/"a/c"
 * alone, used only when `isAcQuery` is true (an AC-category query), never as a global rule.
 */
describe("hasStrongACSignal — bare \"ac\"/\"a/c\" alone is not enough for a HARD exclusion gate", () => {
  it("rejects the exact three measured false positives", () => {
    expect(hasStrongACSignal(
      "تلفزيون ZOSHING بشاشة 14 بوصة بدقة 1080P، تلفزيون صغير مع استقبال فريفيو وهوائي، طاقة مزدوجة AC/DC-12V، منافذ إدخال HDMI-USB-VGA للاستخدام في الكرفانات/الشاشات/المطابخ",
      "",
    )).toBe(false);
    expect(hasStrongACSignal(
      "",
      "Brovi H165-383 5G CPE Router, up to 11.7 Gbps, up to 128 Devices, Dual-Band (2.4GHz/5GHz Wi-Fi 7/HarmonyOS Mesh+), Wi-Fi 7 (802.11a/b/g/n/ac/ax/be), Single Port (LAN), White",
    )).toBe(false);
  });
  it("accepts every genuine AC title measured live this session", () => {
    const genuine: [string, string][] = [
      ["", "Zamil Winow AC Cool only 17 600 BTU Rotary Comperssor"],
      ["", "White Westinghouse Split AC 18 400 BTU Cold WiFi"],
      ["", "Basic Window Air Conditioner Cold 18 000 BTU Rotary"],
      ["", "Midea Olympus Split A/C 22 000 BTU Cool Only"],
      ["مكيف متنقل، 5100 وحدة، بارد فقط", ""],
      ["مكيف شباك فيشر، 18000 وحدة ، تبريد فقط، راوتري، أبيض - FWAC-T18CF", ""],
      ["", "General Split AC 18 000 BTU Cold Only R32 Eco Inverter Compressor"],
    ];
    for (const [ar, en] of genuine) expect(hasStrongACSignal(ar, en)).toBe(true);
  });
});

describe("excludeIneligibleCandidates — isAcQuery gate removes bare-\"ac\" false positives", () => {
  const genuineACs = [
    { name_ar: "مكيف سبليت جري، 18000 وحدة، انفرتر، حار وبارد", name_en: null, best_price: 1449 },
    { name_ar: null, name_en: "White Westinghouse Split AC 18 400 BTU Cold WiFi", best_price: 1065 },
    { name_ar: null, name_en: "Midea Olympus Split A/C 22 000 BTU Cool Only", best_price: 1110 },
    { name_ar: null, name_en: "Basic Window Air Conditioner Cold 18 000 BTU Rotary", best_price: 1149 },
    { name_ar: "مكيف شباك تي سي إل، 18000 وحدة، بارد فقط", name_en: null, best_price: 1199 },
  ];
  const falsePositives = [
    { name_ar: "تلفزيون ZOSHING بشاشة 14 بوصة بدقة 1080P، طاقة مزدوجة AC/DC-12V", name_en: null, best_price: 865 },
    { name_ar: null, name_en: "Brovi H165-383 5G CPE Router, Wi-Fi 7 (802.11a/b/g/n/ac/ax/be)", best_price: 1149 },
  ];

  it("removes the false positives when isAcQuery is true", () => {
    const result = excludeIneligibleCandidates([...falsePositives, ...genuineACs], true);
    const names = result.map((r) => r.name_ar ?? r.name_en);
    for (const fp of falsePositives) expect(names).not.toContain(fp.name_ar ?? fp.name_en);
    for (const g of genuineACs) expect(names).toContain(g.name_ar ?? g.name_en);
  });

  it("does NOT apply the AC-signal filter for a non-AC query (default isAcQuery=false)", () => {
    const result = excludeIneligibleCandidates([...falsePositives, ...genuineACs]);
    expect(result).toHaveLength(falsePositives.length + genuineACs.length);
  });

  it("never wipes the page: if every candidate lacks a strong AC signal, keeps them rather than returning zero", () => {
    expect(excludeIneligibleCandidates(falsePositives, true)).toHaveLength(falsePositives.length);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, founder follow-up "fix the شاشة
 * miscategorization too"): fixing the smartwatch's DB category (see category-utils.ts's
 * CATEGORY_DETECTION_ORDER fix) did not fully remove it from "شاشة" results — it is ALSO
 * reachable via a second, independent path: bare "monitor" is a live (deliberately kept)
 * Algolia optional word, and the smartwatch's own title contains "Heart Rate/Sleep Monitor",
 * matching it directly regardless of its DB category field.
 */
describe("hasStrongMonitorSignal — a health-context \"___ monitor\" phrase is not a display", () => {
  it("rejects the exact measured smartwatch title", () => {
    expect(hasStrongMonitorSignal(
      "",
      "7 Interchangeable Bands Smart Watches for Women Men,1.83\" HD Smart Watch with Heart Rate/Sleep Monitor,Fitness Watch with Bluetooth Call,120+ Sport Modes Activity Tracker Bands Gift Set",
    )).toBe(false);
  });
  it("accepts genuine monitor titles, including bare 'Monitor' with no other qualifier", () => {
    expect(hasStrongMonitorSignal("", "Samsung 24\" Essential Monitor S3 S33GF FHD 100Hz")).toBe(true);
    expect(hasStrongMonitorSignal("", "ViewSonic 24 Inch Gaming Monitor VX2425-HD-PRO, FHD IPS Display")).toBe(true);
    expect(hasStrongMonitorSignal("شاشة lg 21.5 بوصة FHD 75Hz", "")).toBe(true);
  });
  it("rejects other health-context monitor phrases (blood pressure, baby, fitness)", () => {
    expect(hasStrongMonitorSignal("", "Blood Pressure Monitor Digital Arm Cuff")).toBe(false);
    expect(hasStrongMonitorSignal("", "Baby Monitor with Night Vision Camera")).toBe(false);
  });

  // MEASURED LIVE (production, 2026-08-10, same session): after the health-context fix
  // shipped, "شاشة" dropped from 398→166 results but STILL surfaced Huawei Band smartwatches
  // — "شاشة 1.62 بوصة" (a 1.62-inch screen) is a genuine, true spec line on watch listings,
  // not a claim to be a monitor. A title that independently signals smartwatch/band/tracker
  // must be rejected even though it legitimately contains "شاشة".
  it("rejects a smartwatch that genuinely describes its own screen size (شاشة X بوصة)", () => {
    expect(hasStrongMonitorSignal("ساعة هواوي باند 11 الذكية، شاشة 1.62 بوصة، اسود", "")).toBe(false);
    expect(hasStrongMonitorSignal("", "Smart Watch for Women Men, iPhone & Android Bluetooth, 1.83\" Screen")).toBe(false);
    expect(hasStrongMonitorSignal("", "Huawei Watch Fit 4, 1.82in AMOLED Screen, Fitness Tracker")).toBe(false);
  });
  it("a computer monitor is still accepted even in the presence of watch-shaped vocabulary edge cases", () => {
    // Sanity: SMARTWATCH_OVERRIDE must not fire on ordinary monitor titles with no watch words.
    expect(hasStrongMonitorSignal("", "LG UltraGear Gaming Monitor 27-inch QHD 165Hz")).toBe(true);
  });

  // MEASURED LIVE (production, 2026-08-10, same session): a power bank ("...45 واط، شاشة
  // رقمية...") also survived the smartwatch fix — "شاشة رقمية" (digital display) is a
  // genuine spec line on power banks with a charge-percentage readout, a different device
  // type hit by the same class of gap.
  it("rejects a power bank that genuinely describes its own digital display (شاشة رقمية)", () => {
    expect(hasStrongMonitorSignal("باور بانك، بيسيوس، PicoGo سعة 10,000 مللي أمبير، 45 واط، شاشة رقمية، أسود", "")).toBe(false);
    expect(hasStrongMonitorSignal("", "Baseus PicoGo Power Bank 10,000mAh, 45W, Digital Display, Black")).toBe(false);
  });
});

describe("excludeIneligibleCandidates — isMonitorQuery gate removes health-context \"monitor\" false positives", () => {
  const genuineMonitors = [
    { name_ar: "شاشة gameon 24 بوصة FHD 100Hz VA", name_en: null, best_price: 279 },
    { name_ar: null, name_en: "Samsung 24\" Essential Monitor S3 S33GF FHD 100Hz", best_price: 299 },
    { name_ar: null, name_en: "Majesty 22\" FHD Gaming Monitor | IPS | 120Hz", best_price: 309 },
    { name_ar: null, name_en: "ViewSonic VA24E1-H 24-inch Full HD (1080p) monitor, 120Hz", best_price: 319 },
    { name_ar: "شاشة viewsonic 24 بوصة FHD 120Hz IPS", name_en: null, best_price: 319 },
  ];
  const falsePositive = {
    name_ar: null,
    name_en: "7 Interchangeable Bands Smart Watches for Women Men,1.83\" HD Smart Watch with Heart Rate/Sleep Monitor,Fitness Watch with Bluetooth Call",
    best_price: 299.99,
  };

  it("removes the smartwatch when isMonitorQuery is true", () => {
    const result = excludeIneligibleCandidates([falsePositive, ...genuineMonitors], false, true);
    const names = result.map((r) => r.name_ar ?? r.name_en);
    expect(names).not.toContain(falsePositive.name_en);
    for (const g of genuineMonitors) expect(names).toContain(g.name_ar ?? g.name_en);
  });

  it("does NOT apply the monitor-signal filter for a non-monitor query (default isMonitorQuery=false)", () => {
    const result = excludeIneligibleCandidates([falsePositive, ...genuineMonitors]);
    expect(result).toHaveLength(genuineMonitors.length + 1);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, founder follow-up "check other
 * categories for the same leak"): Arabic "ساعة" is a genuine homonym — "watch/clock" AND
 * "hour", the time unit in battery-capacity specs ("10,000 مللي أمبير/ساعة" = 10,000 mAh).
 * Sorting "ساعة" lowest-price-first surfaced 4 power banks via this exact pattern.
 */
describe("hasStrongWatchSignal — bare \"ساعة\" as the HOUR unit is not a watch", () => {
  it("rejects the exact measured power-bank titles", () => {
    expect(hasStrongWatchSignal("قوي , بطارية متنقلة كيجو بسعة 10,000 مللي أمبير في الساعة,أسود", "")).toBe(false);
    expect(hasStrongWatchSignal("باور بانك شاومي 20 ألف مللي أمبير/ساعة 33 واط BHR8851GL بيج", "")).toBe(false);
    expect(hasStrongWatchSignal("باور بانك أورايمو 27 ألف مللي أمبير/ساعة 22.5 واط OPB-7270Q", "")).toBe(false);
  });
  it("accepts genuine watch titles, including bare 'ساعة' with no other qualifier", () => {
    expect(hasStrongWatchSignal("ساعة أورايمو الذكية 5 لايت OSW-804-BK سوداء", "")).toBe(true);
    expect(hasStrongWatchSignal("كيسليكت كيه اس ساعة ذكية لون أسود", "")).toBe(true);
    expect(hasStrongWatchSignal("", "PEJE Smart Watch For Men,1.28\" Display,Arabic Support,Bluetooth")).toBe(true);
    expect(hasStrongWatchSignal("", "HUAWEI Band 9 Smartwatch, Comfortable All-Day Wearing")).toBe(true);
  });
});

describe("excludeIneligibleCandidates — isWatchQuery gate removes the hour-unit homonym false positives", () => {
  const genuineWatches = [
    { name_ar: "ساعة أورايمو الذكية 5 لايت OSW-804-BK سوداء", name_en: null, best_price: 149 },
    { name_ar: "كيسليكت كيه اس ساعة ذكية لون أسود", name_en: null, best_price: 179 },
    { name_ar: null, name_en: "HUAWEI Band 9 Smartwatch, Comfortable All-Day Wearing", best_price: 199 },
  ];
  const falsePositive = { name_ar: "باور بانك شاومي 20 ألف مللي أمبير/ساعة 33 واط BHR8851GL بيج", name_en: null, best_price: 89 };

  it("removes the power bank when isWatchQuery is true", () => {
    const result = excludeIneligibleCandidates([falsePositive, ...genuineWatches], false, false, true);
    const names = result.map((r) => r.name_ar ?? r.name_en);
    expect(names).not.toContain(falsePositive.name_ar);
    for (const g of genuineWatches) expect(names).toContain(g.name_ar ?? g.name_en);
  });

  it("does NOT apply the watch-signal filter for a non-watch query (default isWatchQuery=false)", () => {
    const result = excludeIneligibleCandidates([falsePositive, ...genuineWatches]);
    expect(result).toHaveLength(genuineWatches.length + 1);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, founder follow-up "check other
 * categories for the same leak"): sorting "فرن" (oven) lowest-price-first put an oven baking
 * TRAY (75.95 SAR) and an oven THERMOMETER (201.45 SAR) — accessories FOR an oven, not ovens
 * — above every genuine oven (which start at 220 SAR). Simple gap in the existing
 * ACCESSORY_HINTS_AR list (no "صينية"/"مقياس حرارة"), not a new mechanism.
 */
describe("excludeIneligibleCandidates — accessory-hint gap: oven tray/thermometer", () => {
  it("excludes the measured oven tray and thermometer, keeping genuine ovens", () => {
    const junk = [
      { name_ar: "صينية فرن مستطيلة فضي", name_en: null, best_price: 75.95 },
      { name_ar: "مقياس حرارة الفرن القابل للتعديل من كيتشن إيد", name_en: null, best_price: 201.45 },
    ];
    const real = [
      { name_ar: "فرن كهربائي 1500 واط 35 لتر", name_en: null, best_price: 220 },
      { name_ar: "فرن Olsenmark 25 لتر OMO2277G", name_en: null, best_price: 224 },
      { name_ar: "فرن نيكاي 46 لتر NT655N2", name_en: null, best_price: 229 },
      { name_ar: "فرن HAAM 45 لتر HMTO45L-19", name_en: null, best_price: 249 },
    ];
    const result = excludeIneligibleCandidates([...junk, ...real]);
    const names = result.map((r) => r.name_ar);
    for (const j of junk) expect(names).not.toContain(j.name_ar);
    for (const r of real) expect(names).toContain(r.name_ar);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, fourth "check other categories"
 * follow-up): "مايكروويف" (microwave) put a microwave SHELF/rack (79 SAR) and a timer
 * SWITCH/knob (109.7 SAR) above every genuine microwave (starting at 189 SAR) — "shelf" was
 * already in ACCESSORY_HINTS_EN but missing from the Arabic list. "قلاية" (air fryer) put
 * silicone egg-mold TRAY inserts at position #1.
 */
describe("excludeIneligibleCandidates — accessory-hint gap: microwave shelf/switch, air-fryer molds", () => {
  it("excludes the measured microwave shelf and timer switch, keeping genuine microwaves", () => {
    const junk = [
      { name_ar: "رف ميكرويف قابل لتعديل المقاس أبيض", name_en: null, best_price: 79 },
      { name_ar: "مفتاح توقيت فرن الميكروويف الإلكتروني 60 دقيقة", name_en: null, best_price: 109.7 },
    ];
    const real = [
      { name_ar: "مايكرويف nikai 20 لتر", name_en: null, best_price: 189 },
      { name_ar: "مايكرويف haam 20 لتر", name_en: null, best_price: 215 },
      { name_ar: "ميكروويف Galanz 23 لتر P90D23L-A9", name_en: null, best_price: 218.98 },
      { name_ar: "مايكرويف midea 20 لتر", name_en: null, best_price: 219 },
    ];
    const result = excludeIneligibleCandidates([...junk, ...real]);
    const names = result.map((r) => r.name_ar);
    for (const j of junk) expect(names).not.toContain(j.name_ar);
    for (const r of real) expect(names).toContain(r.name_ar);
  });

  it("excludes the measured air-fryer silicone mold tray inserts", () => {
    const junk = { name_ar: "قوالب بيض سيليكون للمقلاة الهوائية من يلا جوي، صواني", name_en: null, best_price: 39 };
    const real = [
      { name_ar: "قلاية هوائية سوداء خالية من الزيت، سعة 4.2 لتر", name_en: null, best_price: 129 },
      { name_ar: "مقلاة هوائية 2 لتر 1000 وات NAF2001M أسود", name_en: null, best_price: 149 },
      { name_ar: "قلاية كهربائية عميقة", name_en: null, best_price: 159 },
      { name_ar: "مقلاة هوائية ذكية - سعة كبيرة 4.5 لتر", name_en: null, best_price: 189 },
    ];
    const result = excludeIneligibleCandidates([junk, ...real]);
    const names = result.map((r) => r.name_ar);
    expect(names).not.toContain(junk.name_ar);
    for (const r of real) expect(names).toContain(r.name_ar);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, fifth "check other categories"
 * follow-up): "خلاط" (blender) surfaced a "Blender Bottle"-brand protein SHAKER (78.2 SAR)
 * and a Kenwood TRAVEL CUP accessory "for" specific blender models (96.25 SAR). Same
 * accessory-hint-list gap mechanism as oven/microwave/air-fryer, not a new brand-collision
 * class of bug — both titles contain a plain, safe accessory keyword ("شيكر"/shaker,
 * "كوب سفر"/travel cup) once you look past the brand name.
 */
describe("excludeIneligibleCandidates — accessory-hint gap: blender shaker bottle and travel cup", () => {
  it("excludes the measured shaker bottle and travel-cup accessory, keeps genuine blenders", () => {
    const junk = [
      {
        name_ar: "زجاجة شيكر ستانلس ستيل معزولة من بليندر بوتل، من زجاجة خلاط، زهري | مانعة للتسرب | تقنية مضرب بليندربول",
        name_en: null,
        best_price: 78.2,
      },
      { name_ar: "كينوود كوب سفر للخلاط وصانع السموذي لـ: BL030، SB055 الخ.", name_en: null, best_price: 96.25 },
    ];
    const real = [
      { name_ar: "خلاط معجنات برادشو انترناشونال 21995 WD/STL", name_en: null, best_price: 43.75 },
      { name_ar: "خلاط ومطحنة 350 واط مع برطمان سعة 1.5 لتر من نيكاي", name_en: null, best_price: 72 },
      { name_ar: "خلاط يدوي كهربائي 5 سرعات - محرك نحاسي", name_en: null, best_price: 74 },
      { name_ar: "بلاك اند ديكر خلاط يدوي – 5 سرعات مع تربو – 300 واط", name_en: null, best_price: 106 },
    ];
    const result = excludeIneligibleCandidates([...junk, ...real]);
    const names = result.map((r) => r.name_ar);
    for (const j of junk) expect(names).not.toContain(j.name_ar);
    for (const r of real) expect(names).toContain(r.name_ar);
  });

  it("does NOT exclude a portable electric blender that happens to be shaped like a bottle", () => {
    // "خلاط محمول" (portable blender) is an explicit, self-described product claim — no
    // evidence it is anything other than what it says, so it must survive untouched.
    const portableBlender = {
      name_ar: "زجاجة خلط البروتين الكهربائية، زجاجة خلاط سعة 650 مل مع كوب للمسحوق، خلاط محمول",
      name_en: null,
      best_price: 78.99,
    };
    expect(excludeIneligibleCandidates([portableBlender]).map((r) => r.name_ar)).toContain(portableBlender.name_ar);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, D→E mission Part F, sixth "check other categories"
 * follow-up): sorting "غسالة صحون" (dishwasher) lowest-price-first surfaced air fryers whose
 * OWN titles genuinely claim "أجزاء آمنة في غسالة الصحون" (dishwasher-safe parts) — a real,
 * common kitchen-appliance feature claim, the same class of gap as شاشة/ساعة.
 *
 * MEASURED BUG #2 (2026-08-10, same fix, caught live A SECOND TIME post-deploy): the first
 * corrected version of this test passed `name_en: ""` for the fryers — but their REAL
 * `name_en` is "...Dishwasher-Safe Parts..." / "...Dishwasher safe Parts...", and
 * `/\bdishwasher\b/` matched that English spec line too (a `\b` boundary sits between
 * "dishwasher" and the following hyphen/space, not just at a genuine identity boundary).
 * With an empty `name_en` in the test fixture, this path was never exercised — so the test
 * suite stayed green while production kept leaking. All fixtures below now carry the REAL,
 * measured `name_en` for exactly this reason.
 */
describe("hasStrongDishwasherSignal — a \"dishwasher-safe\" feature claim is not a dishwasher", () => {
  it("rejects the exact measured air-fryer titles, including their real name_en spec line", () => {
    // MEASURED BUG (2026-08-10, caught live POST-deploy — an earlier, truncated version of
    // this test string omitted "قلاية وشواية مدمجة", the exact phrase that made the first
    // shipped fix wrongly accept this item: "مدمج" ("integrated/built-in") is too generic —
    // this air fryer uses it to describe ITS OWN combo feature, not a dishwasher identity.
    // The full, untruncated title is required here so this test can catch that regression.
    expect(hasStrongDishwasherSignal(
      "قلاية هوائية وشواية مزدوجة سعة 8.3 لتر / 2.2 كجم مع أدراج مزدوجة، قلاية وشواية مدمجة لتحضير وجبات عائلية كاملة، موفرة للطاقة، 8 برامج طهي مسبقة، أجزاء آمنة في غسالة الصحون، وصفات لا حصر لها، تطبيق مخصص",
      "TEFAL Dual Easy Fry & Grill | 8.3 L / 2.2kg Capacity | Dual Drawers | Combination Air fryer & Grill | Complete Family Meal | Energy Saving | 8 Pre-Set Cooking Programs | Dishwasher-Safe Parts | Endless Recipes | Dedicated App | EY905D40 8.3 L 2700 W EY905D40 Graphite Grey",
    )).toBe(false);
    expect(hasStrongDishwasherSignal(
      "قلاية زيت أوليوكلين برو العميقة / تصل إلى 1.2 كجم من الطعام سهلة التخزين مع صندوق الزيت مؤقت رقمي تحكم ترموستات 50-60 هرتز 1930-2300 واط أجزاء آمنة للغسل في غسالة الصحون",
      "TEFAL OLEOCLEAN PRO Deep Fryer | 3.5 L of oil / Up to 1.2 kg food | Easy to store with the oil box | Digital timer | Thermostat Control | 50-60Hz | 1930-2300 W | Dishwasher safe Parts | Stainless steel | FR804040 3.5 L 2300 W FR804040 Stainless steel",
    )).toBe(false);
    expect(hasStrongDishwasherSignal(
      "قلاية هوائية راسل هوبس XL سعة 5.5 لتر [قلاية هوائية/شواية/طباخ متعدد] هواء سريع (آمنة للغسل في غسالة الصحون، حرارة من الأعلى والأسفل، لا حاجة للاهتزاز، طباخ بطيء، خبز، بيتزا مجمدة Ø 30 سم) ساتيس فراي 26520",
      "",
    )).toBe(false);
  });
  it("accepts genuine dishwasher titles, including bare 'غسالة صحون' with no safe-claim phrase", () => {
    expect(hasStrongDishwasherSignal("غسالة صحون kumtel built in", "")).toBe(true);
    expect(hasStrongDishwasherSignal("غسالة صحون classpro 13 مكان", "")).toBe(true);
    expect(hasStrongDishwasherSignal("غسالة صحون beko 15 مكان", "")).toBe(true);
    expect(hasStrongDishwasherSignal("Classpro Dishwasher 12 place settings 5 programs White", "")).toBe(true);
    expect(hasStrongDishwasherSignal("Beko Dishwasher 5 Program 14 Place Setting White", "")).toBe(true);
  });
});

describe("excludeIneligibleCandidates — isDishwasherQuery gate removes dishwasher-safe-claim false positives", () => {
  const genuineDishwashers = [
    { name_ar: "غسالة صحون kumtel built in", name_en: null, best_price: 473 },
    { name_ar: "غسالة صحون classpro 13 مكان", name_en: null, best_price: 660 },
    { name_ar: "غسالة صحون beko 15 مكان", name_en: null, best_price: 780 },
  ];
  const falsePositives = [
    {
      name_ar: "قلاية هوائية وشواية مزدوجة سعة 8.3 لتر / 2.2 كجم مع أدراج مزدوجة، قلاية وشواية مدمجة لتحضير وجبات عائلية كاملة، موفرة للطاقة، 8 برامج طهي مسبقة، أجزاء آمنة في غسالة الصحون، وصفات لا حصر لها، تطبيق مخصص",
      name_en: "TEFAL Dual Easy Fry & Grill | 8.3 L / 2.2kg Capacity | Dual Drawers | Combination Air fryer & Grill | Complete Family Meal | Energy Saving | 8 Pre-Set Cooking Programs | Dishwasher-Safe Parts | Endless Recipes | Dedicated App | EY905D40 8.3 L 2700 W EY905D40 Graphite Grey",
      best_price: 669,
    },
    {
      name_ar: "قلاية زيت أوليوكلين برو العميقة / تصل إلى 1.2 كجم من الطعام سهلة التخزين مع صندوق الزيت مؤقت رقمي تحكم ترموستات 50-60 هرتز 1930-2300 واط أجزاء آمنة للغسل في غسالة الصحون",
      name_en: "TEFAL OLEOCLEAN PRO Deep Fryer | 3.5 L of oil / Up to 1.2 kg food | Easy to store with the oil box | Digital timer | Thermostat Control | 50-60Hz | 1930-2300 W | Dishwasher safe Parts | Stainless steel | FR804040 3.5 L 2300 W FR804040 Stainless steel",
      best_price: 799,
    },
  ];

  it("removes both air fryers when isDishwasherQuery is true", () => {
    const result = excludeIneligibleCandidates([...falsePositives, ...genuineDishwashers], false, false, false, true);
    const names = result.map((r) => r.name_ar);
    for (const fp of falsePositives) expect(names).not.toContain(fp.name_ar);
    for (const g of genuineDishwashers) expect(names).toContain(g.name_ar);
  });

  it("does NOT apply the dishwasher-signal filter for a non-dishwasher query (default isDishwasherQuery=false)", () => {
    const result = excludeIneligibleCandidates([...falsePositives, ...genuineDishwashers]);
    expect(result).toHaveLength(genuineDishwashers.length + falsePositives.length);
  });
});

/**
 * MEASURED STRUCTURAL RISK (2026-08-19, founder taxonomy audit — «ابي فرن كهربائي»). Same class
 * as شاشة/ساعة/غسالة صحون above: `ARABIC_TO_ENGLISH['فرن'] = ['oven']` injects bare "oven" as an
 * optional Algolia term, and the production catalog carries 20+ genuine microwaves — including
 * grill/convection variants — whose name_en literally reads "Microwave Oven" (the standard
 * international name for a microwave, not a hybrid category; e.g. real production titles below).
 * Fixtures are REAL production titles (2026-08-19), not invented ones, for the same reason the
 * dishwasher fixtures above insist on it — a truncated/synthetic fixture can hide the exact
 * substring the false positive actually hinges on.
 */
describe("hasStrongOvenSignal — a microwave named \"Oven\" (the standard English name) is not an oven", () => {
  it("rejects genuine microwaves, including grill/convection variants, whose name_en says 'Oven'", () => {
    expect(hasStrongOvenSignal(
      "فرن ميكروويف سانفورد سعة 30 لترًا مع خاصية الحمل الحراري",
      "SANFORD MICROWAVE OVEN 30.0 LT WITH CONVECTION 30 L 2200 W SF5633MO BS Silver",
    )).toBe(false);
    expect(hasStrongOvenSignal(
      "ميكروويف رويال 25 لتر",
      "Membrane Digital Microwave Oven, 10 Power Leves, 99.99 min Timer, Child Safety-Lock, Cooking End Signal, Easy Pull Chrome Handle, Grey, RA-25XDG 25 L 800 W RA-25XDG Black",
    )).toBe(false);
    expect(hasStrongOvenSignal(
      "ميديا فرن ميكروويف قائم بذاته بسعة 42 لتر مع شواية | رقم الموديل EG142AWIW مع ضمان لمدة عامين",
      "42 Liter Freestanding Microwave Oven with Grill| Model No EG142AWIW with 2 Years Warranty",
    )).toBe(false);
    expect(hasStrongOvenSignal("Elba Built In Microwave Oven DARK23", "Elba Built In Microwave Oven DARK23")).toBe(false);
  });
  it("accepts genuine ovens (built-in, freestanding, gas) — real production titles", () => {
    expect(hasStrongOvenSignal("فرن كهربائي مدمج 90 سم بشاشة لمسية رقمية ومروحتين سوداء", "Simfer built in built-in oven 90 cm")).toBe(true);
    expect(hasStrongOvenSignal("فرن كهربائي ماستر غاز 60 سم مع أسياخ شواء | الموديل O66E6MT مع ضمان لمدة عامين", "")).toBe(true);
  });
  it("MEASURED CORRECTION (2026-08-19, founder taxonomy audit): \"Electric Oven ... 4 Burners\" is a genuine RANGE, not a bare oven — an earlier fixture had this mislabeled, exactly the class of product this fix exists to catch", () => {
    expect(hasStrongOvenSignal("Electric Oven 60x60 cm,4 Burners, White - FW6043MXZW", "Electric Oven 60x60 cm,4 Burners, White - FW6043MXZW")).toBe(false);
    expect(hasStrongCookerSignal("Electric Oven 60x60 cm,4 Burners, White - FW6043MXZW", "Electric Oven 60x60 cm,4 Burners, White - FW6043MXZW")).toBe(true);
  });
  it("accepts a genuine, honestly self-labeled air-fryer↔oven hybrid (unlike \"Microwave Oven\", a real dual-function unit)", () => {
    expect(hasStrongOvenSignal(
      "مقلاة هوائية بسعة كبيرة 12 لتر مع نافذة كبيرة مرئية وشاشة لمس ذكية 1350 واط، فرن كهربائي متعدد الوظائف , قلاية هوائية بدون زيت",
      "PRIMO PLUS",
    )).toBe(true);
  });
  it("rejects a plain air fryer that never claims to be an oven", () => {
    expect(hasStrongOvenSignal("قلاية هوائية، 9 لتر", "")).toBe(false);
  });
});

describe("excludeIneligibleCandidates — isOvenQuery gate removes microwave-named-Oven false positives", () => {
  const genuineOvens = [
    { name_ar: "فرن كهربائي مدمج 90 سم بشاشة لمسية رقمية ومروحتين سوداء", name_en: "Simfer built in built-in oven 90 cm", best_price: 1799 },
    { name_ar: "فرن أريستون built in 60 سم", name_en: null, best_price: 1599 },
  ];
  const falsePositives = [
    { name_ar: "فرن ميكروويف سانفورد سعة 30 لترًا مع خاصية الحمل الحراري", name_en: "SANFORD MICROWAVE OVEN 30.0 LT WITH CONVECTION 30 L 2200 W SF5633MO BS Silver", best_price: 450 },
    { name_ar: "ميكروويف رويال 25 لتر", name_en: "Membrane Digital Microwave Oven, 10 Power Leves, 99.99 min Timer, RA-25XDG 25 L 800 W RA-25XDG Black", best_price: 320 },
  ];

  it("removes both microwaves-named-Oven when isOvenQuery is true", () => {
    const result = excludeIneligibleCandidates([...falsePositives, ...genuineOvens], false, false, false, false, false, true);
    const names = result.map((r) => r.name_ar);
    for (const fp of falsePositives) expect(names).not.toContain(fp.name_ar);
    for (const g of genuineOvens) expect(names).toContain(g.name_ar);
  });

  it("does NOT apply the oven-signal filter for a non-oven query (default isOvenQuery=false)", () => {
    const result = excludeIneligibleCandidates([...falsePositives, ...genuineOvens]);
    expect(result).toHaveLength(genuineOvens.length + falsePositives.length);
  });
});

/**
 * MEASURED LIVE (production, 2026-08-10, P2 "ONE BRAIN" mandate — founder's own audit of the
 * previous session's report): "مكيف تحت 200 ريال" leaked 4 completely unrelated products —
 * "SPECTRA 1G AC Switch 45A" (20 SAR), "SPECTRA AC Switch 45A" (30 SAR), a wall fan (129 SAR),
 * a 6-port power strip (139 SAR) — with `categoryEnforcedZero: false` and no disclosure. Every
 * one correctly FAILED `hasStrongACSignal` (0 survivors), but the OLD "never wipe the page"
 * fallback then silently kept the pre-filter 100%-junk set instead of an honest zero, because
 * this exact query shape had already passed the (unrelated) `categoryEnforcedZero` gate
 * upstream — nothing else was watching for "retrieval found something, but every single
 * candidate is ineligible". The new `needShapedWithCategory` parameter closes exactly this:
 * when the caller already knows this is an explicit-category, constraint-bearing query, a
 * strong-signal filter that rejects EVERY candidate is trusted instead of second-guessed.
 */
describe("excludeIneligibleCandidates — needShapedWithCategory turns a 100%-junk fallback into an honest zero", () => {
  const junkAcSwitches = [
    { name_ar: "SPECTRA 1G AC Switch 45A 7X7 CM White", name_en: null, best_price: 20 },
    { name_ar: "SPECTRA AC Switch 45A 7X14 CM White", name_en: null, best_price: 30 },
    { name_ar: "مروحة جداري تات FW3515", name_en: null, best_price: 128.995501 },
    { name_ar: "راف باور، وصلة 6 منافذ تيار متردد - 3150", name_en: null, best_price: 139.000501 },
  ];

  it("returns a genuine, confident ZERO for a need-shaped AC query when every candidate fails the strong-signal check", () => {
    // 6th arg (needShapedWithCategory) = true, matching route.ts's own call site for exactly
    // this query shape (explicit category + a parsed budget constraint).
    const result = excludeIneligibleCandidates(junkAcSwitches, true, false, false, false, true);
    expect(result).toHaveLength(0);
  });

  it("without needShapedWithCategory, the OLD forgiving fallback is unchanged (no regression for ambiguous queries)", () => {
    const result = excludeIneligibleCandidates(junkAcSwitches, true, false, false, false, false);
    expect(result).toHaveLength(junkAcSwitches.length);
  });

  it("a genuine AC among the candidates is never dropped by needShapedWithCategory — only a 100%-junk set zeroes", () => {
    const withOneRealAc = [...junkAcSwitches, { name_ar: "مكيف زاميل سبليت 18000 وحدة بارد فقط", name_en: null, best_price: 630 }];
    const result = excludeIneligibleCandidates(withOneRealAc, true, false, false, false, true);
    expect(result).toHaveLength(1);
    expect(result[0].name_ar).toContain("مكيف زاميل");
  });
});

/**
 * FOUNDER TAXONOMY AUDIT, TRACK 1 (2026-08-19) — a freestanding cooker/range («فرن» + a burner
 * count, e.g. «5 عيون»/«5 شعلات») is a PHYSICALLY DIFFERENT product from a bare oven cavity
 * (built-in or countertop), confirmed with zero counterexamples across a 5-source retailer study
 * (Noon, Amazon.sa, Almanea, Shaker, LG's own official site — LG's own Arabic product title for
 * its 178L 5-burner freestanding range literally reads «فرن كهربائي | 178 لتر | 5 شعلات»).
 * Fixtures are REAL production titles found in Tawveeri's own storefront catalog.
 */
describe("hasStrongOvenSignal / hasStrongCookerSignal — a freestanding range is not a bare oven, and vice versa", () => {
  it("hasStrongOvenSignal rejects a range/cooker (has a burner count) even though it says «فرن»/\"Oven\" too", () => {
    expect(hasStrongOvenSignal(
      "سامسونج فرن كهربائي سيراميك – 178.4 لتر – 5 عيون – اسود – NE63C6317SG/ZA",
      "سامسونج فرن كهربائي سيراميك – 178.4 لتر – 5 عيون – اسود – NE63C6317SG/ZA",
    )).toBe(false);
    expect(hasStrongOvenSignal(
      "بومباني فرن غاز و كهربائي ستانلس ستيل – 119 لتر – 4 شعلات و 2 عيون حجرية – فضي – ESSENTIAL90GG42IX",
      "بومباني فرن غاز و كهربائي ستانلس ستيل – 119 لتر – 4 شعلات و 2 عيون حجرية – فضي – ESSENTIAL90GG42IX",
    )).toBe(false);
    expect(hasStrongOvenSignal("", "LG Electric Oven, 6.3 Cubic Feet (178 Liters), 5 Burners, EasyClean")).toBe(false);
  });
  it("hasStrongOvenSignal still accepts a genuine bare-cavity oven, no burner count (no regression)", () => {
    expect(hasStrongOvenSignal("فرن كهربائي مدمج 90 سم بشاشة لمسية رقمية ومروحتين سوداء", "Simfer built in built-in oven 90 cm")).toBe(true);
  });
  it("hasStrongCookerSignal accepts genuine freestanding ranges/cookers — real Tawveeri catalog titles", () => {
    expect(hasStrongCookerSignal("طباخ كهربائي lg 5 شعلات 75 سم", "lg electric cooker 5-burner 75 cm")).toBe(true);
    expect(hasStrongCookerSignal("طباخ غاز haam 5 شعلات 90 سم", "haam gas cooker 5-burner 90 cm")).toBe(true);
    expect(hasStrongCookerSignal(
      "سامسونج فرن كهربائي سيراميك – 178.4 لتر – 5 عيون – اسود – NE63C6317SG/ZA",
      "سامسونج فرن كهربائي سيراميك – 178.4 لتر – 5 عيون – اسود – NE63C6317SG/ZA",
    )).toBe(true);
  });
  it("hasStrongCookerSignal rejects a bare built-in oven (no burner count, no طباخ/بوتاجاز word)", () => {
    expect(hasStrongCookerSignal("فرن كهربائي مدمج 90 سم بشاشة لمسية رقمية ومروحتين سوداء", "Simfer built in built-in oven 90 cm")).toBe(false);
  });
  it("hasStrongCookerSignal rejects Rice/Slow/Pressure Cooker — bare English \"cooker\" is not a range", () => {
    expect(hasStrongCookerSignal("", "INSTANT POT Rice Cooker 6-in-1, 5.7L")).toBe(false);
    expect(hasStrongCookerSignal("", "CROCKPOT Slow Cooker, 6 Quart")).toBe(false);
    expect(hasStrongCookerSignal("", "Multi-Cooker Pressure Cooker 8-in-1")).toBe(false);
  });
  it("MEASURED LIVE (production, 2026-08-19, caught re-verifying the deployed fix): bare «طباخ» is ALSO the head noun of small single-pot/hotplate appliances in Tawveeri's own catalog", () => {
    expect(hasStrongCookerSignal("طباخ كهربائي مزدوج الوعاء سعة 1 لتر + 1 لتر، جهاز مطبخ ذكي متعدد الوظائف مع مؤقت", "")).toBe(false);
    expect(hasStrongCookerSignal("طباخ الأشعة تحت الحمراء المحمولة ، 3500 واط موقد كهربائي واحد الموقد", "")).toBe(false);
    expect(hasStrongCookerSignal("قدر كهربائي ساخن، مقلاة كهربائية محمولة KAWU سعة 1.6 لتر", "")).toBe(false);
  });
  it("a burner count still wins even alongside a small-appliance word (defensive — no real catalog example found, but the positive signal must never be silently defeated)", () => {
    expect(hasStrongCookerSignal("طباخ محمول 4 شعلات", "")).toBe(true);
  });
});

describe("excludeIneligibleCandidates — isCookerQuery gate keeps ranges/cookers separate from bare ovens", () => {
  const genuineCookers = [
    { name_ar: "طباخ كهربائي lg 5 شعلات 75 سم", name_en: "lg electric cooker 5-burner 75 cm", best_price: 3200 },
    { name_ar: "سامسونج فرن كهربائي سيراميك – 178.4 لتر – 5 عيون – اسود – NE63C6317SG/ZA", name_en: null, best_price: 4500 },
  ];
  const bareOvens = [
    { name_ar: "فرن كهربائي مدمج 90 سم بشاشة لمسية رقمية ومروحتين سوداء", name_en: "Simfer built in built-in oven 90 cm", best_price: 1799 },
  ];

  it("isCookerQuery keeps only range/cooker-shaped candidates, excluding a bare built-in oven", () => {
    const result = excludeIneligibleCandidates([...bareOvens, ...genuineCookers], false, false, false, false, false, false, true);
    const names = result.map((r) => r.name_ar);
    for (const o of bareOvens) expect(names).not.toContain(o.name_ar);
    for (const c of genuineCookers) expect(names).toContain(c.name_ar);
  });

  it("isOvenQuery, symmetrically, excludes the range/cooker candidates (mirrors the gate above)", () => {
    const result = excludeIneligibleCandidates([...bareOvens, ...genuineCookers], false, false, false, false, false, true, false);
    const names = result.map((r) => r.name_ar);
    for (const c of genuineCookers) expect(names).not.toContain(c.name_ar);
    for (const o of bareOvens) expect(names).toContain(o.name_ar);
  });

  it("does NOT apply either gate for an unrelated query (defaults false)", () => {
    const result = excludeIneligibleCandidates([...bareOvens, ...genuineCookers]);
    expect(result).toHaveLength(bareOvens.length + genuineCookers.length);
  });
});
