// scripts/tps-plugins/appliance/configs.ts
// Evidence-based appliance category configs. Each was validated against real
// production raw_observations samples (System A vyceqrzttspyycdpojtn) before being
// added — signals/rejects are tuned to the actual catalog noise (e.g. vacuum text
// contaminated by "beverage refrigerator"; coffee text by قهوة-as-food; oven text
// by فرنسية collision). Water heater and range hood remain ABSENT (n≈0) — precision
// over recall. Cooker was absent for the same reason until the appliance-specialist
// stores changed the evidence (7,600+ observations/30d, ADR-254): registered below.
import type { ApplianceCfg } from "./factory";

export const APPLIANCE_CONFIGS: ApplianceCfg[] = [
  {
    category: "dishwasher", version: "dishwasher-v1", nounAr: "غسالة صحون", nounEn: "dishwasher", metricAr: "مكان", metricEn: "place-settings",
    signals: "dishwasher|dish washer|غسالة صحون|غسّالة صحون|غسالة أطباق|غساله صحون",
    rejectAccessory: "detergent|منظف|rinse aid|salt\\b|ملح|tablet[s]?\\b|basket only|rack only|filter\\b|فلتر|cutlery tray",
    rejectWrong: "washing machine|clothes|ملابس|portable dish rack",
    brandGuess: "samsung|سامسون|\\blg\\b|hisense|هايسنس|toshiba|توشيبا|midea|ميديا|haier|هاير|bosch|بوش|beko|بيكو|gorenje|ariston|اريستون|white ?westinghouse|daewoo|دايو|classpro|كلاس برو|simfer|candy|كاندي",
    types: [["built_in", "built-?in|integrated|fully integrated|مدمج|بلت ?ان"], ["freestanding", "free ?standing|قائم|منفصل"]],
    capacity: { regex: "(\\d{1,2})\\s*(?:place settings?|place setting|مكان|أماكن|اماكن)", min: 4, max: 20 },
    techFlags: [["inverter", "inverter|انفرتر|إنفرتر"], ["aquastop", "aquastop|aqua stop"], ["third_rack", "3 racks|third rack|3 rack"]],
  },
  {
    category: "microwave", version: "microwave-v1", nounAr: "مايكرويف", nounEn: "microwave", metricAr: "لتر", metricEn: "L",
    signals: "microwave|مايكرويف|ميكروويف|ميكرويف|مايكروويف",
    rejectAccessory: "cover|غطاء|turntable|plate only|rack|stand only|glass tray",
    rejectWrong: "\\boven\\b(?! ?/? ?microwave)|air ?fryer|قلاية",
    brandGuess: "samsung|سامسون|\\blg\\b|hisense|هايسنس|toshiba|توشيبا|panasonic|باناسونيك|ariston|اريستون|midea|ميديا|black[+ ]?decker|بلاك|nikai|نيكاي|classpro|كلاس برو|dawlance|sharp|شارب",
    types: [["convection", "convection|كونفكشن|حراري"], ["grill", "grill|جريل|شواية|شوايه"], ["built_in", "built-?in|combi|combination|مدمج"], ["solo", "solo|منفرد"]],
    capacity: { regex: "(\\d{1,2})\\s*(?:l\\b|ltr|liter|litre|لتر)", min: 10, max: 45 },
    techFlags: [["convection", "convection|كونفكشن|حراري"], ["grill", "grill|جريل|شواية"], ["inverter", "inverter|انفرتر"]],
  },
  {
    category: "vacuum", version: "vacuum-v1", nounAr: "مكنسة", nounEn: "vacuum cleaner", metricAr: "واط", metricEn: "W",
    signals: "vacuum cleaner|vacuum|مكنسة|مكنسه|hoover",
    // MEASURED DEFECT (2026-08-22): "kyvol|robot|NA" and "philips|robot|NA" each merged
    // several GENUINE robot vacuum models with their own mopping-cloth/kit accessory
    // listings into one canonical (identity has no model discriminator for "robot" type),
    // so the canonical's lowest price was the 7-9 SAR accessory, not any real vacuum.
    // Root cause: the existing accessory list already targets "mop pad"/"accessory kit"
    // but production titles use different word forms — plural "Accessories Kit" (not
    // singular "accessory kit") and "Mopping Cloth"/"Mopping Pads" (not "mop pad").
    // `accessor(?:y|ies) kit` and `mop(?:ping)? (?:pad|cloth)s?` cover both forms without
    // matching a genuine "...Vacuum & Mop..." device title (no pad/cloth follows "Mop").
    rejectAccessory: "\\bbag[s]?\\b|dust bag|filter\\b|فلتر|كيس|brush\\b|فرشاة|hose\\b|خرطوم|battery|بطارية|charger|شاحن|belt|mop(?:ping)? (?:pad|cloth)s?|replacement|spare|nozzle|فوهة|accessor(?:y|ies) kit",
    rejectWrong: "refrigerator|ثلاجة|fridge|freezer|beverage|cooler|مبرد|air ?condition|مكيف|washer|غسالة|blender|خلاط",
    brandGuess: "samsung|سامسون|\\blg\\b|dyson|دايسون|xiaomi|شاومي|ezviz|philips|فيليبس|black[+ ]?decker|بلاك|hitachi|هيتاشي|panasonic|باناسونيك|bissell|kärcher|karcher|كارشر|nikai|نيكاي|midea|ميديا|eufy|roborock|deerma|toshiba|توشيبا",
    types: [["robot", "robot|روبوت|روبوتيك|robotic"], ["upright", "upright|عمودية|قائمة"], ["cylinder", "cylinder|canister|أسطوانية|اسطوانية"], ["handheld", "handheld|hand-?held|يدوية|يدويه|portable|car vacuum|مكنسة سيارة"], ["wet_dry", "wet.?dry|wet & dry|wet and dry|رطب.*جاف|water filtration"], ["stick", "stick|cordless stick|عصا"]],
    capacity: { regex: "(\\d{3,4})\\s*(?:w\\b|watt|watts|واط|وات)", min: 200, max: 3000 },
    techFlags: [["cordless", "cordless|لاسلكية|لاسلكي|rechargeable"], ["bagless", "bagless|بدون كيس"], ["mop", "\\bmop\\b|ممسحة|تمسح"], ["wifi", "wi-?fi|واي ?فاي|app control|alexa|google home"], ["hepa", "hepa|هيبا"]],
  },
  {
    category: "air_purifier", version: "air_purifier-v1", nounAr: "منقي هواء", nounEn: "air purifier", metricAr: "م²", metricEn: "m2",
    signals: "air purifier|air cleaner|منقي هواء|منقّي هواء|hepa air|purifier.*hepa",
    rejectAccessory: "filter\\b|فلتر|replacement|cartridge|خرطوشة",
    rejectWrong: "air cooler|مبرد هواء|air ?condition|مكيف|humidifier|مرطب|water purifier|منقي ماء|fan\\b|مروحة|diffuser|معطر|vacuum",
    brandGuess: "dyson|دايسون|xiaomi|شاومي|philips|فيليبس|samsung|سامسون|\\blg\\b|coway|كواي|honeywell|هانيويل|sharp|شارب|winix|levoit|nikai|نيكاي|midea|ميديا|panasonic|باناسونيك",
    types: [["tower", "tower|برجي|عمودي"], ["desktop", "desktop|mini|صغير|مكتبي|portable|محمول"]],
    capacity: { regex: "(\\d{2,3})\\s*(?:m2|m²|sqm|sq ?m|متر مربع|متر²)", min: 10, max: 200 },
    techFlags: [["hepa", "hepa|هيبا|h13"], ["ionizer", "ionizer|ion\\b|مؤين|أيون"], ["uv", "\\buv\\b|uvc|أشعة"], ["wifi", "wi-?fi|واي ?فاي|smart|app"]],
  },
  {
    category: "coffee_maker", version: "coffee_maker-v1", nounAr: "صانعة قهوة", nounEn: "coffee maker",
    signals: "espresso machine|espresso|coffee maker|coffee machine|ماكينة قهوة|ماكينة القهوة|صانعة قهوة|صانعة القهوة|drip coffee|nespresso|nescafe dolce|dolce gusto|capsule coffee|bean.?to.?cup|آلة قهوة|آلة إسبريسو",
    rejectAccessory: "coffee beans|حبوب|beans only|تفل|حلى|mug\\b|كوب|cup warmer|grinder only|مطحنة فقط|pods only|كبسولات فقط|descaler|منظف|filter paper|milk frother only",
    rejectWrong: "coffee table|طاولة قهوة|coffee cup\\b",
    brandGuess: "delonghi|ديلونجي|nespresso|نسبريسو|philips|فيليبس|dolce gusto|nescafe|نسكافيه|breville|سيج|sage|lavazza|black[+ ]?decker|بلاك|kenwood|كينوود|braun|براون|xiaomi|شاومي|nutricook|nikai|نيكاي|rebune|ربيون|arzum|hamilton|krups",
    types: [["espresso", "espresso|اسبريسو|إسبريسو"], ["capsule", "capsule|nespresso|dolce gusto|كبسول|كبسولات|pods?\\b"], ["bean_to_cup", "bean.?to.?cup|fully automatic|full auto|automatic espresso"], ["drip", "drip|filter coffee|بالتنقيط|أمريكية|american coffee"]],
    capacity: { regex: "(\\d(?:\\.\\d)?)\\s*(?:l\\b|liter|litre|لتر)", min: 0.3, max: 3 },
    techFlags: [["milk_frother", "milk frother|frother|خافق حليب|رغوة حليب|cappuccino|كابتشينو"], ["grinder", "grinder|built-?in grind|مطحنة مدمجة|bean to cup"], ["touchscreen", "touch ?screen|touch|شاشة لمس"]],
  },
  {
    category: "kettle", version: "kettle-v1", nounAr: "غلاية", nounEn: "electric kettle", metricAr: "لتر", metricEn: "L",
    signals: "electric kettle|\\bkettle\\b|غلاية|غلايه|كتل كهربائي",
    rejectAccessory: "filter\\b|فلتر|lid only|غطاء|base only|قاعدة فقط|descaler",
    rejectWrong: "rice cooker|جهاز طبخ الأرز|coffee|قهوة|tea maker set|pressure",
    brandGuess: "philips|فيليبس|kenwood|كينوود|black[+ ]?decker|بلاك|braun|براون|xiaomi|شاومي|nikai|نيكاي|rebune|ربيون|cosori|arzum|moulinex|مولينكس|panasonic|باناسونيك|home ?elec|sky-?touch|russell hobbs|tefal|تيفال|geepas",
    capacity: { regex: "(\\d(?:\\.\\d)?)\\s*(?:l\\b|liter|litre|لتر)", min: 0.5, max: 4 },
    techFlags: [["temperature_control", "temperature control|variable temp|درجة الحرارة|تحكم بالحرارة|temp control"], ["glass", "glass|زجاج"], ["keep_warm", "keep warm|حفظ السخونة|keep-?warm"], ["digital", "digital|led|رقمية|شاشة"]],
  },
  {
    category: "air_fryer", version: "air_fryer-v1", nounAr: "قلاية هوائية", nounEn: "air fryer", metricAr: "لتر", metricEn: "L",
    signals: "air fryer|airfryer|قلاية هوائية|قلاية هوائيه|قلايه هوائية|قلاية بدون زيت|healthy fryer|air fry",
    rejectAccessory: "basket only|liner|paper|رف|accessory|silicone|رقائق|parchment|replacement",
    rejectWrong: "deep fryer|قلاية عميقة|قلاية زيت|oil fryer|pressure cooker|microwave only",
    brandGuess: "philips|فيليبس|black[+ ]?decker|بلاك|nutricook|كوسوري|cosori|xiaomi|شاومي|nikai|نيكاي|rebune|ربيون|kenwood|كينوود|arzum|moulinex|مولينكس|tefal|تيفال|geepas|جيباس|bluq|home ?elec|instant|ninja|نينجا",
    types: [["dual", "dual|double|زوجية|2 basket|dual zone|منطقتين"], ["oven", "oven|فرن|toaster oven|air fry oven"]],
    capacity: { regex: "(\\d{1,2}(?:\\.\\d)?)\\s*(?:l\\b|ltr|liter|litre|لتر)", min: 1, max: 15 },
    techFlags: [["digital", "digital|touch|led|رقمية|شاشة"], ["dual_zone", "dual zone|2 basket|منطقتين|زوجية"], ["window", "window|viewing|نافذة|رؤية"]],
  },
  {
    category: "toaster", version: "toaster-v1", nounAr: "محمصة", nounEn: "toaster", metricAr: "شريحة", metricEn: "slice",
    signals: "\\btoaster\\b|محمصة|محمصه|محمّصة",
    rejectAccessory: "rack|tray only|tong|ملقط|replacement",
    rejectWrong: "toaster oven|فرن محمصة|oven|فرن|air fry|sandwich maker|صانعة شطائر|grill\\b|جريل",
    brandGuess: "philips|فيليبس|kenwood|كينوود|black[+ ]?decker|بلاك|braun|براون|nutricook|nikai|نيكاي|rebune|ربيون|moulinex|مولينكس|tefal|تيفال|arzum|geepas|جيباس|russell hobbs|home ?elec|panasonic|باناسونيك",
    capacity: { regex: "(\\d)\\s*-?\\s*(?:slice|slices|شريحة|شرائح)", min: 1, max: 6 },
    techFlags: [["digital", "digital|touch ?screen|led|رقمية|شاشة"], ["defrost", "defrost|إذابة"]],
  },
  {
    category: "blender", version: "blender-v1", nounAr: "خلاط", nounEn: "blender", metricAr: "واط", metricEn: "W",
    signals: "\\bblender\\b|خلاط|smoothie maker|صانعة سموذي",
    rejectAccessory: "jar only|jug only|blade|شفرة|cup only|attachment|جرة فقط|replacement|spare",
    rejectWrong: "عجان|dough|stand mixer|hand mixer|خلاط عجن|food processor|معالج طعام|juicer|عصارة|grinder only|مطحنة فقط",
    brandGuess: "philips|فيليبس|kenwood|كينوود|black[+ ]?decker|بلاك|braun|براون|nutribullet|نوتري|nikai|نيكاي|rebune|ربيون|moulinex|مولينكس|panasonic|باناسونيك|total|توتال|naqi|ناقي|geepas|جيباس|xiaomi|شاومي|ninja|نينجا|arzum",
    types: [["hand", "hand blender|immersion|يدوي|عصا|stick blender"], ["stand", "stand|jug|counter|طاولة|جرة|table"], ["personal", "personal|portable|smoothie|شخصي|محمول"]],
    capacity: { regex: "(\\d{2,4})\\s*(?:w\\b|watt|watts|واط|وات)", min: 100, max: 2000 },
    techFlags: [["cordless", "cordless|لاسلكي|rechargeable|battery"], ["digital", "digital|touch|رقمي|شاشة"], ["ice_crush", "ice crush|جرش الثلج|سحق الثلج"]],
  },
  {
    // ADR-254 tightening: oven = BUILT-IN ovens ONLY. The v1 signals also matched
    // «فرن غاز»/"freestanding oven", which pulled Saudi freestanding gas COOKERS
    // (بوتاجاز — a different purchase mission, now the `cooker` category below) into
    // this category under a name template that called every one of them "built-in
    // oven". A plain «فرن كهربائي» with no built-in phrasing is now honestly
    // UNDETECTED rather than guessed (precision over recall). Existing mislabeled
    // canonicals stop receiving observations and age out of eligibility ≤168h.
    category: "oven", version: "oven-v2", nounAr: "فرن", nounEn: "built-in oven", metricAr: "سم", metricEn: "cm",
    signals: "built-?in oven|فرن[^,،.]{0,18}(?:بلت|مدمج)|بلت ?[إا]ن[^,،.]{0,10}فرن|فرن مدمج",
    rejectAccessory: "tray only|rack only|صينية|glove|قفاز|replacement|door glass",
    rejectWrong: "فرنسي|فرنسا|french|microwave|مايكرويف|air ?fryer|قلاية|toaster|محمصة|pizza oven portable|mini oven|بوتاجاز|بوتجاز|طباخ|cooking range|gas range",
    brandGuess: "ariston|اريستون|simfer|gorenje|جورنجي|bosch|بوش|samsung|سامسون|\\blg\\b|beko|بيكو|whirlpool|ويرلبول|teka|تيكا|midea|ميديا|hisense|هايسنس|white ?westinghouse|candy|كاندي|indesit",
    types: [["built_in", "built-?in|integrated|مدمج|بلت ?[إا]ن"]],
    capacity: { regex: "(\\d{2,3})\\s*(?:cm|سم)", min: 45, max: 120, round: 5 },
    techFlags: [["gas", "gas oven|فرن غاز|\\bgas\\b|غاز"], ["steam", "steam|بخار"], ["convection", "convection|turbo|fan|مروحة|حراري"], ["digital", "digital|touch|led display|رقمي|شاشة"], ["self_clean", "self.?clean|تنظيف ذاتي|pyrolytic"]],
  },
  {
    // ADR-254 — COOKER registered. The «single duplicated SKU» note in this file's
    // header was true when written; the appliance-specialist stores onboarded since
    // (najm 9, alnakheelk 18, shaker 7, blackbox 10, SWSG 8) supply 7,600+ cooker
    // observations/30d with cross-store brand overlap (measured 2026-08-16). This is
    // the CORE Saudi cooking appliance (GASTAT: 86.4% of households cook with gas):
    // Saudi retail names it «فرن غاز» (60×90, 5 عيون, أمان كامل), which is exactly why
    // it must be a SEPARATE category from built-in ovens.
    // Identity: brand | burner-config | larger-dimension-cm (order-independent via
    // dimsRegex). Spec-keyed like every factory category; model codes exist in names
    // and a model tier is a possible v2 (same deferral as ADR-074's monitor note).
    // v2 (same session, before any canonical materialized — zero churn): the founder-
    // ordered fuel audit found FULLY-ELECTRIC freestanding cookers are material (4,689
    // obs/30d across 13 stores: Samsung/LG/La Germania ceramic ranges), alongside gas
    // (5,552) and mixed 4+2 (493). Fuel is now IDENTITY (a gas and an electric 5-burner
    // of the same brand/size must never merge). Countertop mini electric ovens (دوتس
    // «75 لتر 2800 واط») are NOT cookers: electric detection requires burner/ceramic/
    // dimension evidence. Gas keeps the v1 labels (burners_N) so any v1-materialized
    // row upserts identically; electric_* and mixed_fuel are additive.
    category: "cooker", version: "cooker-v1", nounAr: "طباخ غاز", nounEn: "gas cooker", metricAr: "سم", metricEn: "cm",
    filterKeywords: ["cooker", "بوتاجاز", "طباخ", "فرن غاز", "فرن كهربائي", "فرن كهرباء", "فرن سيراميك"],
    signals: "بوتاجاز|بوتجاز|طباخ|فرن\\s*(?:ال)?غاز|gas cooker|cooking range|gas range|freestanding cooker|freestanding oven"
      // electric freestanding: fuel word adjacent to the noun (brand names like «جليم غاز»
      // contain غاز, so adjacency — not whole-text — is what separates fuels), PLUS
      // burner/ceramic/dimensions evidence somewhere so mini countertop ovens never enter.
      + "|(?=[\\s\\S]*(?:عيون|عين|شعل|سيراميك|\\d{2}\\s*[*×xX]\\s*\\d{2}))(?:(?:فرن|طباخ)\\s*(?:سيراميك\\s*)?(?:كهربائي|كهرباء)|(?:فرن|طباخ)[^.]{0,25}سيراميك)|electric\\s*(?:cooker|range)",
    rejectAccessory: "غطاء|cover only|صينية|tray only|شبك فقط|قطع غيار|replacement|spare|اسطوانة غاز|منظم غاز|regulator|وصلة غاز|hose only",
    // NOTE: no قلاية/air-fryer reject — real LG/Glem ranges advertise built-in air-fry
    // («وقلاية هوائية»); actual air fryers can never satisfy the signals above.
    rejectWrong: "بلت\\s*?[إا]ن|built-?in|مدمج|microwave|مايكرويف|ميكروويف|محمصة|toaster|شفاط|hood|hob\\b|موقد سطحي|سخان|heater|دفاية|رحلات|camping|portable stove|منقل|شواية فحم",
    brandGuess: "midea|ميديا|glem ?gas|جليم غاز|جليم جاز|la ?germania|لاجيرمانيا|thomson|تومسون|elba|إلبا|البا|starway|ستار واي|ستاروي|wellgas|ويل غاز|ويلغاز|bompani|بومباني|super ?general|سوبر جنرال|فريش|fresh|haam|هام|xper|اكسبير|basic|بيسك|hyundai|هيونداي|mastergas|ماستر غاز|simfer|سيمفر|kumtel|كومتيل|nikai|نيكاي|dlc|geepas|جيباس|samsung|سامسونج|\\blg\\b|ال جي|دوتس|dots",
    // FUEL × BURNERS is a composite identity fact — resolved in code, not ordered regexes
    // (see typeResolve rationale in factory.ts). Labels: burners_N = gas (v1-compatible),
    // electric_N / electric, mixed_fuel.
    typeResolve: (t: string) => {
      const burners = t.match(/([2-6])\s*(?:عيون|عين|شعل[ةه]?|شعلات|burners?)/)?.[1]
        ?? (/خمس\s*(?:عيون|شعلات)/.test(t) ? "5" : /[أا]ربع\s*(?:عيون|شعلات)/.test(t) ? "4" : null);
      const gasNoun = /فرن\s*(?:ال)?غاز|بوتاجاز|بوتجاز|طباخ\s*غاز|gas\s*(?:cooker|range)/.test(t);
      const elecNoun = /(?:فرن|طباخ)\s*(?:سيراميك\s*)?(?:كهربائي|كهرباء)|electric\s*(?:cooker|range)|(?:فرن|طباخ)[^.]{0,25}سيراميك/.test(t);
      const mixedMark = /(?:عين|عيون|شعل[ةه]?|شعلات)\s*(?:ال)?كهرباء|\+\s*2\s*(?:عين|شعل)|غاز\s*(?:\+|و)\s*(?:ال)?كهرباء|gas.{0,10}electric/.test(t);
      if (gasNoun && (mixedMark || elecNoun)) return "mixed_fuel";
      if (elecNoun) return burners ? `electric_${burners}` : "electric";
      return burners ? `burners_${burners}` : null;
    },
    capacity: { regex: "(\\d{2,3})\\s*(?:سم|cm)", dimsRegex: "(\\d{2,3})\\s*[*×xX٭]\\s*(\\d{2,3})", min: 45, max: 120, round: 5 },
    techFlags: [
      ["full_safety", "[أا]مان كامل|full safety|امان كامل"],
      ["self_ignition", "[إا]شعال ذاتي|اشعال ذاتي|auto ?ignition|self ?ignition"],
      ["fan", "مروحة|\\bfan\\b|turbo"],
      ["grill", "شواي[ةه]|grill"],
      ["ceramic", "سيراميك|ceramic"],
      ["air_fry", "قلاي[ةه] هوائي[ةه]|مقلاة هوائي[ةه]|air ?fry"],
    ],
    namesOverride: (key: string) => {
      const [b, ty, cap] = key.split("|");
      const burners = ty?.match(/_(\d)$/)?.[1] ?? null;
      const fuel = ty === "mixed_fuel" ? "mixed" : ty?.startsWith("electric") ? "electric" : ty?.startsWith("burners") ? "gas" : null;
      const nounAr = fuel === "electric" ? "طباخ كهربائي" : fuel === "mixed" ? "طباخ غاز وكهرباء" : "طباخ غاز";
      const nounEn = fuel === "electric" ? "electric cooker" : fuel === "mixed" ? "dual-fuel cooker" : "gas cooker";
      const bAr = burners ? (burners === "2" ? "شعلتين" : `${burners} شعلات`) : "";
      const bEn = burners ? `${burners}-burner` : "";
      const cAr = cap !== "NA" ? `${cap} سم` : "";
      const cEn = cap !== "NA" ? `${cap} cm` : "";
      return {
        nameAr: `${nounAr} ${b} ${bAr} ${cAr}`.replace(/\s+/g, " ").trim(),
        nameEn: `${b} ${nounEn} ${bEn} ${cEn}`.replace(/\s+/g, " ").trim(),
      };
    },
  },
];
