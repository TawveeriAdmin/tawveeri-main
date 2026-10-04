// Phase 3B (2026-10-03) — named production failure classes from the Phase-3A ground truth.
// Every case here was a real cross-store pair (docs/evidence/amazon-diagnostic-2026-10-03/phase3a/).
import { verifyPair } from '../../scripts/tps-core/identity-verifier';

const v = (a: string, b: string, category = 'mobile') => verifyPair({ title: a, category }, { title: b, category });

describe('identity verifier — hard commercial distinctions', () => {
  test('refurbished vs new rejects (P020)', () => {
    const r = v('Apple (Refurbished) iPhone 14 5G 128GB Phone - Midnight', 'Apple iPhone 14, 5G, 128GB, Blue');
    expect(r.outcome).toBe('reject'); expect(r.reasons).toContain('condition_conflict:refurbished≠new');
  });
  test('Renewed vs new rejects (P239)', () => {
    expect(v('Apple iPhone 15 (128 GB) - Black (Renewed)', 'ابل ايفون 15، 128 جيجا، 6 جيجا، 5 جي، اسود').outcome).toBe('reject');
  });
  test('LTE vs 5G rejects (P056)', () => {
    const r = v('Samsung Galaxy A06 5G, Dual SIM, 4GB RaM, 128GB Storage, Black (KSA Version)', 'Samsung Galaxy A06, 4G, 128GB, 4GB RAM, Black');
    expect(r.outcome).toBe('reject'); expect(r.reasons.some((x) => x.startsWith('network_conflict'))).toBe(true);
  });
  test('8GB vs 12GB RAM rejects, comma form included (P079, P267)', () => {
    expect(v('Samsung Galaxy A56 5G, Android Smartphone, 256GB Storage, 8GB RAM, Awesome Graphite', 'SAMSUNG Galaxy A56, 5G, 256 GB, 12GB RAM, Awesome LightGray').outcome).toBe('reject');
    expect(v('Samsung Galaxy A57 5G Android Smartphone, 256GB Storage, 12GB RAM, Awesome Gray', 'Samsung Galaxy A57, 256GB, 8GB, 5G, Dual SIM - Violet').outcome).toBe('reject');
  });
  test('Enterprise Edition rejects (P011)', () => {
    expect(v('Samsung Galaxy A36 Enterprise Edition DUAL-SIM 128GB ROM + 6GB RAM (GSM only | No CDMA)', 'SAMSUNG Galaxy A36, 5G, 128 GB, Awesome Lavender').reasons.some((x) => x.startsWith('edition_conflict'))).toBe(true);
  });
  test('bundle vs single rejects (P022)', () => {
    expect(v('REDMI Note 15 Black 8G RAM 256G ROM + Bud 6 Play - Global Version', 'Xiaomi Redmi Note 15, 256GB, 12GB, 5G, Dual SIM - Glacier Blue').outcome).toBe('reject');
  });
});

describe('identity verifier — appliance model codes', () => {
  test('different washer models under one 9 kg spec key reject (P404)', () => {
    const r = v('Samsung 9 kg Quick Drive Front Load Washing Machine with Knob Control| Model No WW90T754DBX/YL', 'Samsung Front Loading Washing Machine, 9 Kg, 12 Programs, Black - WW90DG5U34AB', 'washing_machine');
    expect(r.outcome).toBe('reject'); expect(r.reasons.some((x) => x.startsWith('model_code_conflict'))).toBe(true);
  });
  test('washer-dryer combo vs washer rejects (P407)', () => {
    expect(v('Hisense 2in1 Front Load Washing & Drying Machine, 10.5-7KG,Inverter, A Class, with WIFI', 'Hisense Front Load Washing Machine 7 KG, Inverter, Grey -WF1I7022BT6', 'washing_machine').outcome).toBe('reject');
  });
  test('microwave "MH 6535 gih" (spaced, unreadable) vs MH6595DIS is never a match (P425)', () => {
    // The Amazon side spaces its code out, so no code is read there; "grill/1000" is a spec token, not a
    // code (it was a lucky reject before the segment filter). Code on one side only → review, never match.
    const r = v('LG Electronics MH 6535 gih microwave with grill/1000 W/25 l/digital display/White', 'LG Neochef Microwave 25L Grill Black MH6595DIS', 'microwave');
    expect(r.outcome).toBe('review'); expect(r.reasons).toContain('model_code_one_side'); expect(r.evidence.model_code.a).toBeNull();
  });
  test('dishwasher DW60A8050FS vs DW60BG850FSL rejects (P435)', () => {
    expect(v('SAMSUNG DW60A8050FS/YL Dishwasher 14 Place Settings, 8 Programs, Auto Door Open, WIFI', 'Samsung Dishwasher 14 places, 8 programs, Silver, DW60BG850FSL', 'dishwasher').outcome).toBe('reject');
  });
  test('colour-code suffix RT62K7050SLB vs SLH goes to REVIEW, never match (P398)', () => {
    const r = v('Samsung 620 Liter Double Door Refrigerator with Inverter Technology| Model No RT62K7050SLB', 'Samsung Top Freezer Refrigerator, 21.9 Cu Ft, Inverter, Silver - RT62K7050SLH', 'refrigerator');
    expect(r.outcome).toBe('review'); expect(r.reasons.some((x) => x.startsWith('model_code_suffix_unknown'))).toBe(true);
  });
  test('tail designator R-V805PS1KV vs R-V805PS1KV-1TWH goes to REVIEW (P396)', () => {
    expect(v('Hitachi 600 Liter Double Door Refrigerator with Frost Free | Model No R-V805PS1KV TWH', 'Hitachi Refrigerator, Top Freezer, 21.2 Cu.ft, White - R-V805PS1KV-1TWH', 'refrigerator').outcome).toBe('review');
  });
  test('a code on one side only is REVIEW for family-keyed appliances (P410)', () => {
    expect(v('Samsung WF21T6500GV/YL Frontload Washer 21kg,1100 RPM, Eco Bubble,Hygiene Steam, WIFI', 'Samsung Front Load Washer 21KG, Hygiene Steam, WIFI, 1100 rpm, Black', 'washing_machine').outcome).toBe('review');
  });
  test('exact code on both sides matches (P433)', () => {
    expect(v('Midea 12 Place Setting Free Standing Dishwasher with 7 Programs| Model No WQP125201CS', 'Midea, Dishwasher, 12 Place Setting, 6 Programs, LED Display, Silver. WQP125201CS', 'dishwasher').outcome).toBe('match');
  });
  test('a line name such as QNED86 is not a model code (P347) — so the pair has a code on ONE side only: review for TV (spec keys are family keys)', () => {
    const r = v('LG 65QNED86A6A 65 inch MiniLED QNED evo AI WebOS 25 VRR 144hz 4K Smart TV', 'LG, 65 inch, Mini LED 4K Smart TV, AI QNED86, 144 Hz', 'tv');
    expect(r.evidence.model_code.b).toBeNull();            // "QNED86" is a line name, never read as the code
    expect(r.outcome).toBe('review'); expect(r.reasons).toContain('model_code_one_side');
    // a declared code on the codeless side resolves it
    expect(verifyPair({ title: 'LG 65QNED86A6A 65 inch MiniLED QNED evo AI 4K Smart TV', category: 'tv' }, { title: 'LG, 65 inch, Mini LED 4K Smart TV, AI QNED86, 144 Hz', category: 'tv', structured: { model: '65QNED86A6A' } }).outcome).toBe('match');
  });
  // Phase-3B shadow trace (238 model_code_conflict rejects inspected on 2026-10-03):
  test('a code glued to a preceding word (MOTOR/…, M/…, BASALT-…) is the bare code', () => {
    expect(v('Haier Washing Machine 12kg Top Load Inverter/DD MOTOR/HWM120-B316S6', 'Haier Top Loading Washing Machine, 12 Kg, Air Dry, 8 Programs, Dark Silver - HWM120-B316S6', 'washing_machine').reasons).toContain('exact_model_code');
    expect(v('HP Smart Tank 581 All-in-One Printer BASALT-4A8D4A', 'Smart Tank 581 Wireless All In One Printer 4A8D4A', 'printer').outcome).toBe('match');
  });
  test('an LG ".MARKET" tail is a region tail (AM182C0.UK1 = AM182C0)', () => {
    expect(v('LG ArtCool Split Air Conditioner, 18,000 BTU, AM182C0.UK1', 'Artcool Split AC 18000 BTU | Cool Only | Inverter AM182C0 Black', 'air_conditioner').outcome).toBe('match');
  });
  test('"1000rpm" / "18000 BTU" are never model codes', () => {
    const r = v('LG WF0712WH Front Load Washing Machine | 7 Kg Capacity', 'LG Front Load 7kg Washing Machine Inverter 6Motion 1000rpm White', 'washing_machine');
    expect(r.evidence.model_code.b).toBeNull(); expect(r.outcome).toBe('review');
  });
  test('the longest code wins: marketing code F6000F beside the full UA43F6000FUXZN', () => {
    expect(v('Samsung 43 Inch FHD TV, F6000F, HDR, OTS Lite, UA43F6000FUXZN', 'Samsung 43 inch FHD Smart TV UA43F6000FUXZN', 'tv').reasons).toContain('exact_model_code');
  });
  test('same stem, short differing tails is REVIEW (WFR1114MB ~ WFR1114WH; WQP125201CWEG ~ CSEG)', () => {
    expect(v('LG WFR1114MB Front Load Washing Machine | 11 Kg Capacity | Middle Black', 'غسالة ال جي تحميل أمامي، 11 كجم، ابيض - WFR1114WH', 'washing_machine').outcome).toBe('review');
    expect(v('مايديا غسالة صحون – 6 برامج – 12 مكان تخزين – أبيض – WQP125201CWEG', 'ميديا غسالة صحون 12 مكان، 7 برامج، 2 رف، فضي - WQP125201CSEG', 'dishwasher').outcome).toBe('review');
  });
  test('one edit on a ≥7-char code is REVIEW, on a 6-char code still REJECT', () => {
    expect(v('BLACK+DECKER Digital Air Fryer, 1700W, 8L SAF80-B5', 'بلاك اند ديكر قلاية هوائية – 1700 واط – سعة 8 لتر – SAF80W-B5', 'air_fryer').outcome).toBe('review');
    expect(v('Nikai 308L Double Door Refrigerator NRF400DS', 'نيكاي ثلاجة بابين 10.2 قدم مكعب - 308 لتر - ديفروست - فضي - NFR400DS', 'refrigerator').outcome).toBe('review');
    expect(v('BenQ GW2791 27” IPS FHD 1080p 100Hz Monitor', 'BenQ GW2790 27 inch 100Hz Monitor FHD', 'monitor').outcome).toBe('reject');
  });
  test('a resolution/dimension string is never the (longest) code: GW2791 vs GW2790 still rejects', () => {
    const r = v('BenQ GW2791 27” IPS FHD 1080p 100Hz Home Office Monitor', 'BenQ GW2790 27 inch 100Hz Gaming Monitor FHD 1920x1080p, IPS', 'monitor');
    expect(r.evidence.model_code).toEqual({ a: 'GW2791', b: 'GW2790' }); expect(r.outcome).toBe('reject');
  });
  test('Samsung "SM-" written on one side only: colour-code pair SM-L500NZWAMEA ~ L500NZKAMEA is REVIEW', () => {
    expect(v('ساعة سامسونج جالكسي 8 كلاسيك , 46 ملم , أبيض , SM-L500NZWAMEA', 'Samsung Galaxy Watch8 Classic Smartwatch 46mm Black Sm L500nzkamea', 'smartwatch').outcome).toBe('review');
  });
  test('"Washer and Dryer" / "Washer/Dryer" / "with 6kg dryer" are all the combo type', () => {
    const r = v('Midea Washer and Dryer Front Load-12 kg Washing & 8 kg Drying', 'Midea Frontload Washer/Dryer 12/8kg 14 Programs WiFi Titanium', 'washing_machine');
    expect(r.evidence.washer_type).toEqual({ a: 'combo', b: 'combo' });
    expect(v('Samsung WD80T634DBE/YL Front Load Washer Dryer Combo 8Kg Wash/6Kg Dry', '8kg Washer with 6kg dryer White Color AI Control', 'washing_machine').evidence.washer_type).toEqual({ a: 'combo', b: 'combo' });
  });
  test('"7.0 kg" equals "7 kg"; eXtra\'s "10 5 kg" is 10.5 kg; "11 5kg" is 11.5 kg', () => {
    expect(v('غسالة ال جي أوتوماتيك، تحميل أمامي، سعة 7.0 كجم', 'LG WF0712WH Front Load Washing Machine | 7 Kg Capacity', 'washing_machine').reasons).toContain('same_capacity');
    expect(v('Front Load washing Machine 10.5 Kg WFV1114XMT Silver', 'LG Front Load Fully Automatic Washer 10 5 kg TurboWash Silver', 'washing_machine').reasons).toContain('same_capacity');
    expect(v('LG Top Load Washing Machine 11 5kg Middle Black', 'غسالة ال جي اتوماتيك علوية، 11.5 كجم، اسود - WTV11BND', 'washing_machine').reasons).toContain('same_capacity');
  });
  test('eXtra\'s "8 7 Inch" / "11 2 Inch" / "15 6-inch" are 8.7 / 11.2 / 15.6 inches', () => {
    expect(v('Samsung Galaxy Tab A11 4G 8 7 Inch 64GB Gray', 'سامسونج جالاكسي تاب ايه 11، 4 جي ، 8.7 بوصة، 64 جيجا، رمادي', 'tablet').reasons).toContain('same_screen_size');
    expect(v('Xiaomi Pad 8 Wi-Fi 11 2 Inch 256 GB Black', 'شاومي باد 8، 11.2 بوصة، 256 جيجابايت، 8 جيجابايت رام', 'tablet').reasons).toContain('same_screen_size');
    expect(v('Acer aspire lite laptop intel core 5-120u 16gb ram 512gb ssd 15 6-inch display', 'Aspire Lite Laptop With 15.6 Inch Full HD (1920x1080) Display, 16GB RAM', 'laptop').reasons).toContain('same_screen_size');
  });
});

describe('identity verifier — sizes, region, absence', () => {
  test('unit-less tablet sizes 10.4 vs 11.5 reject (P373)', () => {
    expect(v('HUAWEI MatePad 10.4 WIFI 128GB', 'HUAWEI MatePad 11.5 WiFi 2025 New, 8+128 GB, Space Grey', 'tablet').outcome).toBe('reject');
  });
  test('International Version on one side → REVIEW (P229)', () => {
    const r = v('Samsung Galaxy S25 Ultra, 256GB (International Version)', 'SAMSUNG Galaxy S25 Ultra, 5G, 256 GB, Titanium Silverblue');
    expect(r.outcome).toBe('review'); expect(r.reasons).toContain('region_tag_one_side');
  });
  test('KSA/Middle East version is the local unit, not a region tag (P166)', () => {
    expect(v('HONOR X5c Smartphone 4 GB RAM, 64 GB Dual SIM 4G - Midnight black - Middle East Version', 'Honor X5c, 4G, 64GB, Tidal Blue').outcome).toBe('match');
  });
  test('absence is never evidence: network stated on one side only matches (P004)', () => {
    const r = v('Apple iPhone 16 Plus (128 GB) - Ultramarine', 'iPhone 16 Plus 128GB 5G Pink');
    expect(r.outcome).toBe('match'); expect(r.reasons).toContain('key_equality_verified');
  });
  test('reasons are machine-readable and evidence is recorded', () => {
    const r = v('Samsung Galaxy A17 LTE, Dual SIM, 128GB Expandable to 2TB, 4GB RAM', 'Samsung Galaxy A17,128GB , 4GB RAM , 4G - Gray');
    expect(r.outcome).toBe('match'); expect(r.evidence.network).toEqual({ a: '4g', b: '4g' }); expect(r.evidence.ram).toEqual({ a: '4', b: '4' });
  });
});

// Founder rulings 2026-10-04 (ADR-403): category conditions for monitors, tablets, smartwatches, ACs.
describe('identity verifier — founder category conditions', () => {
  test('monitor: an exact model-code conflict rejects even when every stated spec is identical', () => {
    // Different codes, identical specs: never a match. A shared 7-char stem with a short differing tail is a
    // suffix/variant relationship we cannot read (review: neither side counts, neither backs a cheapest claim)…
    const stem = v('ASUS TUF Gaming VG279QM5A-J 27" FHD Fast IPS 240Hz Gaming Monitor', 'TUF Gaming Series 5 VG279QML5A Gaming Monitor 27-inch Full HD Fast-IPS 240Hz', 'monitor');
    expect(stem.outcome).not.toBe('match');
    // …and a plain code conflict is a reject.
    const r = v('BenQ GW2791 27" IPS FHD 100Hz Monitor', 'BenQ GW2790 27 inch IPS FHD 100Hz Monitor', 'monitor');
    expect(r.outcome).toBe('reject'); expect(r.reasons.some((x) => x.startsWith('model_code_conflict'))).toBe(true);
  });
  test('monitor: refresh-rate, panel and resolution conflicts each reject — only when both sides state them', () => {
    expect(v('Acme 27 inch IPS FHD 100Hz Monitor', 'Acme 27 inch IPS FHD 144Hz Monitor', 'monitor').reasons.some((x) => x.startsWith('refresh_rate_conflict'))).toBe(true);
    expect(v('Acme 27 inch IPS FHD 144Hz Monitor', 'Acme 27 inch VA FHD 144Hz Monitor', 'monitor').reasons.some((x) => x.startsWith('panel_conflict'))).toBe(true);
    expect(v('Acme 27 inch IPS FHD 144Hz Monitor', 'Acme 27 inch IPS QHD 144Hz Monitor', 'monitor').reasons.some((x) => x.startsWith('resolution_conflict'))).toBe(true);
    expect(v('Acme 27 inch IPS FHD 144Hz Monitor', 'Acme 27 inch Monitor', 'monitor').outcome).toBe('match');            // absence is not evidence
  });
  test('tablet: Wi-Fi-only vs cellular and a storage mismatch reject; "8+128 GB" equals "128GB"', () => {
    expect(v('Samsung Galaxy Tab A9 Wi-Fi 64GB', 'Samsung Galaxy Tab A9 5G 64GB', 'tablet').reasons.some((x) => x.startsWith('connectivity_conflict'))).toBe(true);
    expect(v('Huawei MatePad 11.5 WiFi 128GB', 'Huawei MatePad 11.5 WiFi 256GB', 'tablet').reasons.some((x) => x.startsWith('storage_conflict'))).toBe(true);
    expect(v('HUAWEI MatePad 11.5 WiFi 2025, 8+128 GB, Space Grey', 'Huawei MatePad 11.5 Wi-Fi 128GB', 'tablet').outcome).toBe('match');
  });
  test('tablet/phone colour is not a variant: no model-code rule (part numbers encode colour)', () => {
    expect(v('Apple iPad 10th Gen Wi-Fi 64GB Blue MPQ13LL/A', 'Apple iPad 10th Gen Wi-Fi 64GB Silver MPQ03LL/A', 'tablet').outcome).toBe('match');
  });
  test('phone storage mismatch rejects; expansion phrase is not storage', () => {
    expect(v('Samsung Galaxy A17 128GB 4GB RAM', 'Samsung Galaxy A17 256GB 4GB RAM', 'mobile').reasons.some((x) => x.startsWith('storage_conflict'))).toBe(true);
    expect(v('Samsung Galaxy A17 LTE, 128GB Expandable to 2TB, 4GB RAM', 'Samsung Galaxy A17, 128GB, 4GB RAM, 4G', 'mobile').outcome).toBe('match');
  });
  test('smartwatch: Bluetooth vs LTE and 40 mm vs 44 mm reject; same size and connectivity match', () => {
    expect(v('Galaxy Watch8 (Bluetooth 40 mm) Graphite', 'Samsung Galaxy Watch8 LTE 40mm Graphite', 'smartwatch').reasons.some((x) => x.startsWith('connectivity_conflict'))).toBe(true);
    expect(v('Galaxy Watch8 (Bluetooth 40 mm) Graphite', 'Samsung Galaxy Watch8 Bluetooth 44mm', 'smartwatch').reasons.some((x) => x.startsWith('watch_size_conflict'))).toBe(true);
    expect(v('Galaxy Watch8 (Bluetooth 40 mm) Graphite', 'Samsung Galaxy Watch8 Bluetooth 40mm Silver', 'smartwatch').outcome).toBe('match');
  });
  test('AC: same code matches; a code on one side only, or no code on either, is review — never an exact-model claim', () => {
    expect(v('LG ArtCool Split AC 18000 BTU AM182C0.UK1', 'Artcool Split AC 18000 BTU Cool Only AM182C0 Black', 'air_conditioner').outcome).toBe('match');
    const one = v('LG ArtCool Split AC 18000 BTU AM182C0', 'LG ArtCool Split AC 18000 BTU Cool Only Inverter', 'air_conditioner');
    expect(one.outcome).toBe('review'); expect(one.reasons).toContain('model_code_one_side');
    const none = v('LG ArtCool Split AC 18000 BTU Inverter', 'LG ArtCool Split AC 18000 BTU Cool Only Inverter', 'air_conditioner');
    expect(none.outcome).toBe('review'); expect(none.reasons).toContain('no_model_code_spec_group_only');
  });
});

describe('identity verifier — code notation (production shadow, 2026-10-04)', () => {
  test('TV: a merchant that prefixes the screen size to the code ("65X6600H") matches the bare code ("X6600H")', () => {
    const r = v('Skyworth 65" Smart TV, 4K QD Mini-LED, 120 Hz, Black, X6600H', 'SKYWORTH, 65 Inch, 4K Smart, Mini LED, 120Hz', 'tv');
    expect(r.outcome).not.toBe('reject');
    expect(verifyPair({ title: 'Skyworth 65" Smart TV X6600H', category: 'tv' }, { title: 'SKYWORTH, 65 Inch, 4K Smart TV', category: 'tv', structured: { model: '65X6600H' } }).reasons).toContain('exact_model_code');
  });
  test('a different code stays a conflict after size-prefix stripping (Q6800H vs 60Q6820H)', () => {
    const r = verifyPair({ title: 'Skyworth 60" Smart TV, 4K QLED+, 120 Hz, Q6800H', category: 'tv' }, { title: 'SKYWORTH, 60 Inch, QLED 4K Smart TV', category: 'tv', structured: { model: '60Q6820H' } });
    expect(r.outcome).not.toBe('match');
  });
  test('Panasonic "MC-YL690GY47" equals "YL690GY47"/"MC YL690GY47" (maker prefix is optional notation)', () => {
    expect(v('Panasonic, 1500W, 15L, Barrel Vacuum Cleaner, MC-YL690GY47', 'مكنسة باناسونيك برميلية سعة 15 لتر 1500 واط – MC YL690GY47', 'vacuum').reasons).toContain('exact_model_code');
  });
  test('Hitachi CV-940YPG vs CV-940Y stays REVIEW (colour/market tail of unknown meaning)', () => {
    expect(v('مكنسة هيتاشي برميل سعة 15 لتر، 1600 واط – CV-940YPG', 'هيتاشي مكنسة برميل - 15 ليتر - 1600 واط - رمادي - CV-940Y SS220 PG', 'vacuum').outcome).toBe('review');
  });
});

describe('identity verifier — production audit fixes (tablet reads)', () => {
  test('"Tab S10+ 12GB RAM,256GB" is 256 GB storage — "S10+ 12GB" is a Plus model, not 10+12 storage', () => {
    const r = v('SAMSUNG Galaxy Tab S10+ 12GB RAM,256GB Wi-Fi - Platinum - SM-X820NZSAMEA', 'Galaxy Tab S10 Plus Platinum Silver 12GB 256GB WiFi - Middle East Version', 'tablet');
    expect(r.evidence.storage_gb).toEqual({ a: '256', b: '256' }); expect(r.outcome).not.toBe('reject');
  });
  test('Arabic "واي فاي/ خلوي" is a cellular listing: it does not conflict with a 5G title', () => {
    const r = v('Apple IPAD PRO 2025, 512 GB, 12GB , 11 INCH, 5G M5, SPACE BLACK', 'آبل آيباد برو 11 إنش (2025) بمعالج إم 5، سعة 512 جيجابايت، واي فاي/ خلوي - اسود', 'tablet');
    expect(r.reasons.some((x) => x.startsWith('connectivity_conflict'))).toBe(false);
  });
});

describe('identity verifier — notation across key / title / merchant (production audit 2026-10-04)', () => {
  const rel = (a: string, b: string, category: string, ma?: string, mb?: string) =>
    verifyPair({ title: a, category, structured: ma ? { model: ma } : undefined }, { title: b, category, structured: mb ? { model: mb } : undefined });
  test('the identity key keeps no separators; titles do — they are the same code (Samsung SM-, LG .AMI, Apple /A)', () => {
    expect(rel('SAMSUNG Galaxy Watch Ultra 2025, 47MM, White', 'ساعة ذكية سامسونج جالكسي 8 ألترا 2025، أبيض - SM-L705FAW1KSA', 'smartwatch', 'SML705FAW1KSA').reasons).toContain('exact_model_code');
    expect(rel('LG Ultrawide Flat Monitor, 29 inch WFHD IPS Display, White', 'شاشة كمبيوتر ال جي الترا وايد 29 بوصة 29U531A-W.AMI', 'monitor', '29U531AWAMI').reasons).toContain('exact_model_code');
    expect(rel('Apple Watch Ultra 3 GPS + Cellular 49mm Black Titanium', 'ابل ساعة الترا 3 49 ملم', 'smartwatch', 'MF0V4AFA', 'MF0V4AF/A').reasons).toContain('exact_model_code');
  });
  test('27GS60F-B.AMI vs 27GS60F: a market/colour tail on the same model is review, not a conflict', () => {
    const r = rel('LG UltraGear Gaming Monitor 27GS60F, 27 Inch, 1080p, 180Hz', 'شاشة قيمنق 27 بوصة Full HD، ال جي، 180 هرتز', 'monitor', '27GS60F', '27GS60F-B.AMI');
    expect(r.reasons.some((x) => x.startsWith('model_code_conflict'))).toBe(false);
  });
  test('a retailer SKU in the model field (S200766459) is not a manufacturer code and never conflicts with a real one', () => {
    const r = rel('Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black', 'Sony Wh-1000Xm5 Noise Cancelling Wireless Headphones WH1000XM5B', 'audio', 'S200766459');
    expect(r.reasons.some((x) => x.startsWith('model_code_conflict'))).toBe(false);
  });
  test('genuinely different codes stay different in every notation (CV-965NBLGSA vs CV-960F; Q6800H vs 60Q6820H)', () => {
    expect(rel('Hitachi Vacuum Cleaner 21L 2200W CV-965NBLGSA', 'Hitachi Vacuum Cleaner 21L 2200W CV-960F SS220', 'vacuum').reasons.some((x) => x.startsWith('model_code_conflict'))).toBe(true);
    expect(rel('Skyworth 60" Smart TV, 4K QLED+, 120 Hz, Q6800H', 'SKYWORTH, 60 Inch, QLED 4K Smart TV', 'tv', undefined, '60Q6820H').outcome).not.toBe('match');
  });
});
