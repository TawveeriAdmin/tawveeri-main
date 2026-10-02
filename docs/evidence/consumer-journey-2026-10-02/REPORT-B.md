# REPORT-B — Live read-only QA re-check of tawveeri.com (2026-10-02, ~09:00–09:45 Riyadh)

Scope: re-check reviewer claims E4, E5, E7 and queries Q3, Q4, Q5, Q7 on production `https://tawveeri.com`, Arabic locale, read-only.
Method: puppeteer headless (mobile 390×844 @2x, Android Chrome UA, `Accept-Language: ar-SA,ar;q=0.9`; desktop repeat at 1366×768), DOM polled every 250 ms (≤45 s) for the first useful result, innerText saved as `.txt`, full-page `.png`, every `/api/search` and `/api/v1/agent/*` body saved as `.api-N.json`, console/network captured in `.log.json`. `/go` chains resolved with Node `fetch(redirect:'manual')` + browser UA, then the final merchant URL loaded in puppeteer. Nothing was logged in, bought, or added to any cart. The only server-side writes were the two «شارك الخطة» taps the brief asked for (each mints a 30-day share token; nothing was posted externally).
All artifacts: `C:\Users\Hp\AppData\Local\Temp\claude\c--Users-Hp-Downloads-Tawveeri-Official\58be6200-d7a9-41e8-9be2-bef1096efe5d\scratchpad\verify-B\` (scripts: `lib.js`, `e4-compare.js`, `e4-compare-details.js`, `go-follow.js`, `search.js`, `search-direct.js`, `crash-repro.js`, `home-mission.js`, `home-mission-share.js`, `e7c-area-input.js`).

Verdict legend: **PASS** = defect the reviewer described is still present; **FAIL** = not present; **CHANGED** = present in a different form (described).

---

## Headline findings (new, not in the reviewer's list)

1. **Search page crashes to an error boundary («حدث خطأ … إعادة المحاولة») — `TypeError: e.trim is not a function` (chunk `066hsuze_hx-b.js:1:34484`, frame `push.e.s.search.title`).** Reproduced 100 % in two situations:
   - (a) Q5 and Q7 crash on EVERY load path (mobile + desktop, search box AND direct URL — 12/12 loads). Both queries make `/api/v1/agent/decide?limit=4` return **HTTP 400** `{"error":"category required (or provide `text` the parser can classify)", "parsed":{"category":"", ...,"unresolved":["category"]}}` and the client then throws. The customer sees no results, no "we did not understand", only the generic error card. Files: `Q5-*`, `Q7-*`, `Q5-direct-*`, `Q7-direct-*`, `decide-direct-Q7-Q5.json`.
   - (b) On **mobile**, submitting ANY query from the **header search bar** (first visible input, placeholder «ابحث عن المنتجات...», inside `<header>`) does a client-side `router.push` (URL has `%20`) and crashes, even for Q4 which renders fine when loaded directly or via the in-page «بحث الأسعار» form (URL has `+`). Desktop header bar did not crash for Q4. Evidence: `crash-repro.json`, `crash-mobile-header-bar.png` (crash) vs `crash-mobile-page-form.png` / `crash-mobile-direct.png` (results). Q3 on mobile via header bar also crashed (`Q3-mobile.txt`).
2. **Compare page E4 groups five different LG model numbers under «عروض النسخة نفسها»** — see E4.
3. **Home-plan AC area field cannot accept a typed two-digit value starting with 1–4** (typing «22» → field stays empty; «35» → «5»). Chips work. See E7.
4. **Home plan TV pick «تلفزيون آبل 50 بوصة 4K UHD LED 60Hz ذكي» (brand `apple`, 949 ر.س at Amazon)** — Apple sells no 50-inch LED TV; brand attribute looks wrong on the customer surface (`e7-mobile-3-plan.txt`, API `e7-mobile.api-0.json` leg `tv`: `"brand":"apple"`, trust 43 "low").

---

## E4 — Compare page `lg|split|NO_SERIES|18000|Inverter|cool_only`

Route (from `src/app/[locale]/(public)/compare/[key]/page.tsx`): `/ar/compare/<encodeURIComponent(key)>` → `https://tawveeri.com/ar/compare/lg%7Csplit%7CNO_SERIES%7C18000%7CInverter%7Ccool_only`.
Time to first useful result: mobile 0.04 s after DOMContentLoaded (page total 5.1 s), desktop 0.10 s (2.8 s). Screenshots: `e4-compare-mobile.png`, `e4-compare-desktop.png`, `e4-compare-mobile-expanded.png` (all «وصف العرض عند المتجر» expanded). Text: `e4-compare-mobile.txt`, `e4-compare-mobile-expanded.txt`. JSON-LD: `e4-compare-jsonld.json`.

| Check | Observed (quoted) | Verdict |
|---|---|---|
| «جُمعت على مواصفات الموديل المعلنة» present | Yes, twice: header «عروض النسخة نفسها — جُمعت على مواصفات الموديل المعلنة» and footer «جُمعت هذه العروض على مواصفات الموديل المعلنة؛ تحقق من رقم الموديل لدى المتجر • مدعوم بـ TPS» | PASS |
| Lowest offer | «أقل سعر مرصود · من 6 متاجر رُصدت خلال 7 أيام · عند إكسترا · رصدناه اليوم · التوفر غير مذكور عند آخر رصد · ١٬٣٣٥» | PASS (Extra 1,335 as reviewer saw) |
| Highest qualified | «أعلى سعر مؤهل ٢٬٨٨٨ · الفرق ١٬٥٥٣» (Shaker 2,888) | PASS |
| Availability shown | Per row: Extra «● التوفر غير مذكور عند آخر رصد»; Noon «● متوفر بحسب آخر رصد» (+ «هذا السعر مبني على آخر رصد لدينا وقد لا يعكس السعر الحالي…»); Nakheel/Najm/Almanea/Shaker «● متوفر». Legend: «عرضٌ لم يذكر متجره التوفر يدخل بسعره ويُعلَّم «التوفر غير مذكور» — لا نعدّه نفادًا ولا تأكيدًا.» | shown |
| «أفضل سعر» badge on a NO_SERIES key | **Not on the compare page** (labels used: «أقل سعر مرصود», «الأقل»). BUT the search grid cards for NO_SERIES/NA keys do carry «🏆 أفضل سعر» (e.g. `beko|NA|15`, `midea|NA|12` in `Q3-desktop.txt`). | CHANGED — badge absent on compare page, present on search cards |
| Specs/variant disclosures | Title «مكيف سبليت إل جي، 18000 وحدة، انفرتر، بارد فقط». No colour, no model number, no series in the header. Per-row collapsed «وصف العرض عند المتجر» reveals: every row «حالة السلعة (جديد/مجدّد) غير مذكورة في وصف العرض» and the raw merchant titles: Extra «LG Spilt AC, 18,000 BTU, Cool, Win, Dual Inverter Compressor»; Noon «Split AC Smart Inverter 18000 BTU Cool Only NS182C2 White»; Nakheel «مكيف ال جي سبليت، 18000 وحدة، سمارت، انفرتر، بارد فقط، ريش ذهبية»; Najm «… NS182C3»; Almanea «… NS182C3.NK3»; Shaker «… NS182C2». Extra's page JSON-LD gives MPN **NW182C0 NK0** — a different series («Win», Dual Inverter) from NS182C2 / NS182C3. The 1,335 "lowest" is therefore a different model than the 2,599–2,888 offers it is being compared with, under the headline «عروض النسخة نفسها». | PASS (identity by spec, not model; headline over-claims) |
| Shipping/installation | Footer only: «الأسعار كما رصدناها في وقت الرصد المذكور، دون شحن أو تركيب.» | stated as excluded |

Prices on the compare page (all with ر.س glyph): Extra ١٬٣٣٥ (today), Noon ٢٬٥٩٩ (5 days ago), متجر النخيل ٢٬٥٩٩ (today), نجم الأجهزة ٢٬٧٦٥ (today), المنيع ٢٬٨٨٧ (yesterday), شاكر ٢٬٨٨٨ (today). Decision text: «5 عروض أخرى مؤهلة أدناه — نون بـ ٢٬٥٩٩».

### E4 /go follow (cheapest = Extra)
`/go/21cb5722-f308-4407-b868-c483a27391fc?gt=1790921454535.7dd3cb86…` (rel=nofollow noopener noreferrer, target=_blank)
Redirect chain (Node fetch, manual):
1. `https://tawveeri.com/go/21cb5722-…` → **302** `Location: https://www.extra.com/en-sa/large-appliances-/air-conditioner/split-air-conditioner/lg-spilt-ac-18-000-btu-cool-win-dual-inverter-compressor/p/100363940`
2. extra.com → **200** text/html (no further hops; no affiliate parameters on the URL).

Merchant page (`e4-go-extra.png`, `e4-go-extra.txt`, first useful 0.19 s, 10 s total):
- Title «LG Spilt AC, 18,000 BTU, Cool, Win, Dual Inverter Compressor - eXtra»; JSON-LD sku 100363940, mpn «NW182C0 NK0», price «1335», availability `InStock`, shippingRate 0.
- Visible price «1335 Incl. VAT», struck «4449», «Save 3114», «69.99% Off», «OFFER ENDS IN 1 D : 14 H : 45 M».
- **Conditions NOT shown on Tawveeri:** «Use code nd96» (coupon); «Last Piece Deal»; Product Options Type «Cold / Hot and Cold», Capacity «1 Ton / 1.5 Ton / 2 Ton / 2.5 Ton / 3 Ton»; «Free gift(s): Copper Pipes … Free ~~199~~» and «Split Air Conditioner Installation Service Free ~~199~~»; and crucially the visible stock block «Oh no, this item is currently OUT OF STOCK — Unavailable — Notify me when it's available» (JSON-LD still says InStock).
- Card vs landing: same listing (LG 18k BTU split, Extra 1,335 = 1,335) — **price matches**; **product identity does not match the other five offers** (Win/NW182C0 vs NS182C2/3); **conditions differ** (coupon code, last-piece, capacity variants, out-of-stock, free installation gift) — none of this is on Tawveeri, which showed «التوفر غير مذكور». Verdict for the reviewer's claim: **PASS**.

---

## E5 — Search «غسالة صحون كبيرة للعائلة»

Rendered successfully only on desktop (`Q3-desktop.png/.txt`, first useful 12.46 s — slow; the API bodies `Q3-desktop.api-0.json` = decide, `api-1.json` = /api/search total 132). Mobile via header search bar crashed (`Q3-mobile.png` error card; first attempt also truncated the typed query to «لعائلة» because the autocomplete re-render dropped keystrokes).

| Claim | Observed | Verdict |
|---|---|---|
| Pick = Beko 15 place, 780 SAR from Extra, observed 7 days, «أعلى من المعتاد 150٪» | «فهمت طلبك كالتالي: غسالة صحون · حجم كبير / اختيار توفيري / سعر مؤكَّد في 2 متاجر / آخر رصد قبل 7 يوم / أعلى من المعتاد بـ150٪ — قد ينخفض لاحقًا / مقارنة موثّقة في 2 متاجر / غسالة صحون beko 15 مكان / أفضل سعر عند اكسترا / سعر الجهاز ٧٨٠». API: `unit_price:780`, `price_intel: {verdict:"elevated", current_best:1953, typical:780, pct_vs_typical:150, distinct_days:3, days_tracked:72}`, `data_age_hours:161`, trust 72 with caveat «قد تكون البيانات غير حديثة». Note the internal contradiction: card shows 780 while price-intel says current best is 1,953 and 780 is the *typical* — the «150٪ above typical» sentence is attached to a 780 price. | PASS |
| Card with price «٠»/0 (Ariston, 42-day observation) | **Not observed.** All 25 grid products have `current_price>0`; Ariston entries: 15-place 1,299 (advisor) / 2,299 Nakheel (grid, orig 3,999), 14-place 1,578 Amazon (orig 3,219), built-in 14 at 2,929 Extra. The only «٠» on the page is the price-range filter «٠ — ١٠٠٬٠٠٠». Ariston 15 API `distinct_days:50`, 14-place `47` (not 42). | FAIL (not present today) |
| Unmeasured «أهدأ» claim | Present on the pick and on both Ariston cards: «محرك إنفرتر — أهدأ وأوفر» with no decibel figure anywhere (no «ديسيبل»/«dB» on page). | PASS |

Advisor list (4): Beko 15 (780, 2 stores), Ariston 15 (1,299, 3 stores, «أعلى من المعتاد بـ5٪»), Ariston 14 (1,579, 5 stores), Bosch 14 (3,499, 3 stores). Grid below: 132 results, 25 per page, freshest «آخر رصد قبل أقل من ساعة», oldest «آخر رصد قبل 7 يومًا». Grid cards show «🏆 أفضل سعر», «N مؤهلة من M», «مرجعي (المتجر): …» reference prices; no shipping/installation/code/availability before /go.

---

## E7 — Home plan «جهّز بيتك بذكاء»

Entry points on the homepage (`e7-mobile-0-home.png`): nav «جهّز بيتك» → `/ar/home-mission?source=navigation`; card «ابدأ خطة بيتك» → `?source=homepage_card`; «شوف مثال لخطة جاهزة» → `/ar/home-mission/example`; footer «جهّز بيتك بذكاء». Composer first useful 0.03–0.11 s (`e7-*-1-composer.png`).
Input used (the site's own «عرسان يجهزون شقة» example, matching the brief): «تزوجت قريبًا وأجهز شقة من غرفتين. مكيفين: غرفة النوم 14 متر والصالة 22 متر. ثلاجة وغسالة وشاشة. ميزانيتي 12 ألف.» → «راجع احتياجاتك».

Mission card (`e7-mobile-2-mission-card.png`): «شقة» preselected, quantities AC 2 / fridge 1 / washer 1 / TV 1, budget input «12000», AC spaces: «غرفة النوم 14» parsed, but «الصالة 22 متر» was **not** parsed (row «غرفة» with empty area) — even on the site's own example sentence.

Plan (`e7-mobile-3-plan.png`, `e7-desktop-3-plan.png`; build 2.3–7.8 s; API `e7-mobile.api-0.json` state `partial`, allocation `{feasible:true,budget_total:12000,total_allocated:11963,remaining:37,min_total:5680}`):

| Check | Observed | Verdict |
|---|---|---|
| Budget bar colour / label | Fill element class `bg-warning-500` but computed `rgb(229, 57, 53)` = **red** (visibly red in screenshot), width 342/342 (100 %). Label «خطة جزئية — راجع الأجهزة التي تحتاج استكمالًا», «4 من 5 محسوم». After completing the missing area (via the 25 m² chip, `e7c-mobile-3-plan-complete.png`): label **«خطة مكتملة»**, bar still red `rgb(229,57,53)` at 339/342 (99 %), «5 من 5 محسوم». | PASS — "complete" plan shown with a red, almost-full bar |
| Totals | «الميزانية 12,000 · الأجهزة 11,963 · المتبقي 37» (partial) / «الميزانية 12,000 · الأجهزة 11,829 · المتبقي 171» (complete). | shown |
| Shipping/installation stated as not included | Yes: «المتبقي من ميزانيتك ليس توفيرًا مثبتًا. الشحن والتركيب غير محسوبين، ولا يلزم إنفاق كامل الميزانية.» | stated |
| Items «بدون تأكيد الموديل» | AC «مكيف سبليت جري، 18000 وحدة، انفرتر، حار وبارد» 2,766 ر.س «2 متاجر — بدون تأكيد الموديل» (نجم الأجهزة, 3 days); washer «غسالة lg front load 18 كجم ونشافة» 6,449 «2 متاجر — بدون تأكيد الموديل» (اكسترا); in the complete plan also washer «samsung front load 9 كجم» 2,699 «3 متاجر — بدون تأكيد الموديل». API claim text: «متوفر لدى 2 متاجر — لم نؤكد أنها نفس الموديل تمامًا، فلا نسميها مقارنة». | present |
| «ابدأ الشراء» beside it, warning size | Plan view: «ابدأ الشراء» is a sticky full-width green button (~342×46 px, 13 px bold on mobile; 624 px on desktop) that overlays the AC item in the full-page capture, while «2 متاجر — بدون تأكيد الموديل» is an 11 px grey chip (150×20 px, `rgb(75,85,96)`). Purchase mode («قائمة مشتريات حسب المتجر», `e7-mobile-4-purchase-mode.png`): per store «أكمل الشراء من اكسترا» 342×46 px green vs the same 11 px chip; «شوف العرض» 60×19 px. No warning of comparable size. | PASS |
| Store counts per item | AC «2 متاجر — بدون تأكيد الموديل»; fridge «متجر واحد» (midea top mount 380, 1,799, نون, 5 days); washer «2 متاجر — بدون تأكيد الموديل»; TV «متجر واحد» (آبل 50", 949, أمازون, 4 days). Complete plan TV: «تلفزيون سامسونج UA55U8000FUXSA 1,799 · 3 عروض موثقة». | shown |
| Share step | Header icon button `aria-label="شارك الخطة"` (no visible text). Tap → `POST /api/v1/agent/home-mission/share` with the legs → **200** `{"token":"ba2df75be76bf90244eddaaa30a4cf92","owner_key":"…","url":"https://tawveeri.com/ar/plan/ba2df75be76bf90244eddaaa30a4cf92?utm_source=referral&utm_medium=home_mission_share&utm_content=ba2df75b","expires_days":30}` then `GET …/share/<token>/feedback?owner_key=…` → `{"feedback":[]}`. Headless has no `navigator.share`; the clipboard fallback produced no toast and `clipboard.writeText` was not called in my capture (`copied:null`). Shared view `/ar/plan/<token>` (`e7b-mobile-4-shared-view.png`): «خطة مشتريات / معدّة عبر توفيري — مقارنة أسعار بالأدلة / الميزانية 12,000 ر.س · إجمالي الخطة 11,467 ر.س / الأسعار كما رُصدت وقت المشاركة قبل أقل من ساعة — قد تتغير» with per-item «مناسب 👍 / اقترح تغييره» and «رأيك يصل لصاحب الخطة — ولا يغيّر الخطة بنفسه». **Discrepancy:** the shared view says fridge «عند نون · 2 متاجر» and TV «عند اكسترا · 3 متاجر» while the owner's plan for the same legs said «متجر واحد» / «2 متاجر — بدون تأكيد الموديل». Second share (desktop) token `0136d5598d535dd7be94e0e823e3c3c7`. Not posted anywhere. | works; count mismatch between plan and shared view |
| Area input defect | Free-text «م²» field: typing «22» → value «» ; «35» → «5» (`e7c-mobile.json`, `e7c-mobile-1-area-typing.png`). Chips (12/16/20/25/30) work. Both ACs (14 m² and 25 m²) got the same 18000-BTU Gree model («18000 وحدة لـ14م²», «18000 وحدة لـ25م²»). | new |

---

## QUERIES

Metric table (seconds = first useful DOM result after submit/DOMContentLoaded; "crash" = error boundary).

| Q | Mobile | Desktop | Understood | Ceiling | Accessory leak | «آخر رصد» freshest / oldest | Model vs spec | Visible before /go |
|---|---|---|---|---|---|---|---|---|
| Q3 غسالة صحون كبيرة للعائلة | crash via header bar (`Q3-mobile.png`); first attempt truncated query to «لعائلة» (6 results) | 12.46 s, 132 results + advisor pick | category dishwasher, priority «حجم كبير»; no budget/city given | n/a | none seen (all 25 grid rows are dishwashers) | «قبل أقل من ساعة» / «قبل 7 يومًا» | keys `beko|NA|15`, `ariston|NA|14` (spec keys, «NA» series) shown with «🏆 أفضل سعر»; no «جُمعت على مواصفات» text on search | device price only; «مرجعي (المتجر)» strike price; no shipping/code/availability |
| Q4 ثلاجة بابين تحت 2500 ريال توصيل الرياض | 3.6 s via in-page form (`Q4-mobile.png`); crash via header bar (`crash-mobile-header-bar.png`) | 2.6 s (`Q4-desktop.png`) | «فهمت طلبك كالتالي: ثلاجة · تحت 2500 ريال · Riyadh» (API parsed `fridge_type:"top_mount", city:"Riyadh", budget_total:2500`); grid «٠ نتيجة» + «طبّقنا الميزانية المذكورة في بحثك: 2,500 ريال أو أقل» | not broken: picks 1,799 / 1,043 / 1,929 / 1,489 all ≤2,500 | none | «قبل 3 يوم» / «قبل 5 يوم» | `midea|top_mount|380|inverter` spec key, «أفضل سعر عند نون» | «سعر الجهاز ١٬٧٩٩», «كهرباء سنوية (تقديري) ٤٤»; «ضمن ميزانيتك — سعر الجهاز 1799 ريال تقديري»; nothing on delivery |
| Q5 أتزوج وأحتاج خطة أجهزة لشقة غرفتين بميزانية 12000 ريال | crash (all paths) | crash (all paths) | decide 400 `category required`, parsed only `budget_total:12000` | — | — | — | — | — |
| Q7 شيء للمطبخ موثق السعر أرخص من جرير ونون | crash (all paths) | crash (all paths) | decide 400; parsed `room_type:"kitchen", wants_cheapest:true, category:""` — «موثق السعر» and «جرير/نون» not represented at all | — | — | — | — | — |

Q4 — «الرياض»/delivery acknowledgement: only the echo chip «Riyadh» (in English, inside «فهمت طلبك كالتالي»). No delivery statement, no city-specific availability anywhere; the «الرياض»/«توصيل» hits in the text are the echoed query itself.
Q5 — routing to the home plan: **No.** The page crashes; the only home-plan links present on a working search page are the generic nav/footer entries and a «ابدأ خطة بيتك» banner on Q4 (`/ar/home-mission?source=fridge_results`). Could not complete through share/«ابدأ الشراء» from Q5 — N/A (page never rendered); the equivalent journey was completed from `/ar/home-mission` directly (E7) and stopped before any merchant page, per the brief.
Q7 — «موثق السعر» / «أرخص من جرير ونون»: engine returns 400 with `category:""`; nothing uses the "verified price" or the two-store exclusion. `/api/search` returns `total:0, resolvedCategory:null`.

### Q4 extra /go follows (result cards)
1. Smart pick Midea top mount 380 → `/go/0a65bd4b-c6c8-436a-886b-0466be6fba2a?gt=…` → **302** `https://www.noon.com/saudi-en/top-freezer-inverter-refrigerator-13-3-cu-ft-376-l-external-display-control-mdrt533mmu50d-crystal-silver/N70370759V/p/?o=dc7f7c08ad04995e` → 200, but the headless load shows **«Access Denied»** (`q4-go-midea-noon.png`) — merchant comparison N/A (bot wall).
2. Hisense top mount 250 (card 1,489, «سعر مؤكَّد في 3 متاجر») → `/go/67c99662-2b16-4795-8534-b7940a3ae799` → **302** `https://www.extra.com/en-sa/large-appliances-/refrigerators/small/hisense-refrigerator-7cu-ft-freezer-1-8cu-ft-inverter-color-silver/p/100384295` → 200. Merchant (`q4-go-hisense-extra.png/.txt`): «Hisense Refrigerator 7Cu.ft, Freezer 1.8Cu.ft, Inverter, Color Silver», mpn RT32W2NKI, **«1416 Incl. VAT»**, struck 2449, «42.18% Off», «IN STOCK», «Delivery in RIYADH · Estimated delivery: 2-7 days». Tawveeri said 1,489 → merchant 1,416 (merchant is 73 lower); same product family (Hisense 250 L top mount ≈ 7 cu ft); availability/delivery shown only on the merchant.
3. Haier top mount 330 (card 1,929, «متجر واحد», «آخر رصد قبل 3 يوم») → `/go/c09e8592-4534-40c1-bde1-94ccc3fd7a96` → **302** `https://www.blackbox.com.sa/en/product/haier-refrigerator-top-freezer-2-door-11.7-ft-333-l-inverter-steel-hrf-355-ns-p-1311116222072003` → 200. Merchant (`q4-go-haier-blackbox.png/.txt`): «Haier Refrigerator Top Freezer 2 Door, 11.7ft, 333L, Inverter, Steel - HRF-355NS», visible price **3,199** (JSON-LD 3199.00, `InStock`) but visible text «Out of stock and will be available … soon». Tawveeri 1,929 vs merchant 3,199 — **price does not match (+1,270)** and the item is out of stock; the card said «ضمن ميزانيتك — سعر الجهاز 1929 ريال تقديري».
4. Nikai 200 → `/go/5e3aaf74-…` → 302 `https://www.amazon.sa/dp/B08XNYDM9P` (chain only, not loaded).

---

## Console / network errors seen (status ≥ 400 or thrown)

- `POST https://tawveeri.com/api/v1/agent/decide?limit=4` → **400** for Q5 and Q7 (every load; body quoted above).
- Client exception on `/ar/search`: `TypeError: e.trim is not a function at push.e.s.search.title (https://tawveeri.com/_next/static/chunks/066hsuze_hx-b.js:1:34484)` → React error boundary «حدث خطأ». Seen on Q3-mobile(header bar), Q4-mobile(header bar), Q5 ×6, Q7 ×6.
- Report-only CSP warnings on every page: «[Report Only] Refused to load the script 'https://static.cloudflareinsights.com/beacon.min.js/…' … script-src 'self' 'unsafe-inline' 'unsafe-eval'» and «The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.»
- `net::ERR_ABORTED` on `/api/events` beacons, Sentry envelopes, `/cdn-cgi/rum`, `/logos/Tawveeri.png` and RSC prefetches (`?_rsc=`) — aborted by navigation/page close, not server errors.
- No 429s from the site's rate limiter were observed (runs were paced 15–20 s apart).
- No HTTP ≥400 from merchants; Noon served a 200 «Access Denied» page to the headless browser.

## Task ledger
- E4 compare page re-check: DONE (PASS). E4 /go chain + merchant comparison: DONE (PASS).
- E5 search re-check: DONE (pick/150 % PASS; «أهدأ» PASS; price-0 Ariston FAIL/not present; API JSON saved).
- E7 wizard walk (2-bed apartment, 12,000, newly married): DONE at mobile + desktop, incl. share step and purchase mode; budget-bar/label PASS.
- Q3: DONE (desktop; mobile header-bar path crashes). Q4: DONE (+ city/delivery answer: not acknowledged beyond an echo). Q5: NOT POSSIBLE to observe routing — page crashes on all 6 loads (API 400 + client TypeError captured). Q7: NOT POSSIBLE to observe engine handling — same crash (API 400 body captured, parse shows `wants_cheapest`, `room_type:kitchen`, no category).
- One more /go from Q4: DONE (three chains; two merchant pages loaded, Noon blocked).
- Console/network ≥400: DONE.
