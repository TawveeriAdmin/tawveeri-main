# Evidence-First pair adjudication — all disputed groups (2026-10-04)

Source: per-group evidence dossiers (`dossiers/*.json`) built from merchant PDPs, manufacturer pages and documented sources; price was not used. "Unified fn" = `extractModelEvidence` + `relateModels` run over production payloads (shadow). Human labels are NOT used in this table.

| group | pair | evidence relation | conf | unified-function relation | basis (evidence) |
|---|---|---|---|---|---|
| T01 | 1–2 | **DIFFERENT** | medium | NO_EVIDENCE | Two different model codes stated by merchant PDPs (Jarir 'Manufacturer No' 65Q71Q; Amazon 'Model Number' 65Q72Q), each corroborated by an independent retailer (Sharaf DG/Elryan for Q71Q; Carrefour KSA with EAN 6942351426969 for Q72Q). No alias statement found. |
| T01 | 1–3 | **DIFFERENT** | high | REVIEW | Different codes (65Q71Q vs 65S7N). 65S7N is a manufacturer-confirmed S7 CanvasTV (art mode, matte coating, flush mount, 40 W Atmos) on hisenseksa.com; Q71Q is a Direct LED 400-nit 15 W VIDAA set per retailers. Different product line, no alias evidence. |
| T01 | 2–3 | **DIFFERENT** | high | REVIEW | Different codes (65Q72Q vs 65S7N). 65S7N is the manufacturer-confirmed S7 CanvasTV line; 65Q72Q is a separate code (EAN 6942351426969) with no alias statement. Shared 65in/QLED/144Hz tuple is only WEAK family evidence. |
| T02 | 1–2 | **DIFFERENT** | medium | DIFFERENT_VARIANT | Different codes (75S7N vs 75Q72Q). 75S7N is manufacturer-confirmed as the S7 line (Hi-Matte, motion-detector art features, 46 W audio) on hisenseksa.com; Q72Q is a separate code family (65Q72Q has its own EAN). No alias evidence. Confidence medium only because |
| T03 | 1–2 | **SAME_EXACT** | medium | MATCH_CANDIDATE_MEDIUM | Same brand (Impex/evoQ) and the same exact code 75S4QLC2, stated independently by two merchants (Noon title; LuLu PDP), with consistent 75in/4K/QLED/Google TV and no conflict found. Not high: there is no Impex manufacturer page, and the Noon PDP could not be o |
| T05 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two different trusted Hisense codes from different manufacturer series: 55E8S (E8 MiniLED, Amazon PDP model number, Hisense ZA/ES pages) vs 55U7S (U7 MiniLED, eXtra modelNumber; U7S on Hisense KSA with 384 zones/1,100 nit at 75 in). Hisense lists E8S and U7S a |
| T04 | 1–2 | **SAME_EXACT** | high | MATCH_CANDIDATE_STRONG | Both PDPs show TCL model 65T6D (eXtra modelNumber, Amazon item model number), and the code is on TCL's Saudi T6D page. No spec conflict. |
| T04 | 1–3 | **DIFFERENT** | high | REVIEW | The codes 65T6D and 65P7L are different. TCL Saudi publishes them as separate series pages. Third-party sources show 3 HDMI for T6D vs 4 for P7L, and different dimensions. No alias statement was found. |
| T04 | 1–4 | **DIFFERENT** | high | DIFFERENT_VARIANT | Same reason as 1-3: the codes 65T6D and 65P7L are different series on TCL Saudi, and no alias was found. |
| T04 | 2–3 | **DIFFERENT** | high | REVIEW | The codes 65T6D and 65P7L are different TCL series. No alias was found. |
| T04 | 2–4 | **DIFFERENT** | high | DIFFERENT_VARIANT | The codes 65T6D and 65P7L are different TCL series. No alias was found. |
| T04 | 3–4 | **SAME_EXACT** | medium | REVIEW | Jarir's PDP shows model 65P7L and Noon's title shows 65P7L. The code is on TCL's P7L series page. The specs agree (QLED, 60Hz, 4K). Noon's PDP itself was not verified. |
| T06 | 1–2 | **DIFFERENT** | medium | DIFFERENT_VARIANT | The codes 85T8D (2026 series) and 85C6K (2025 series, TCL Gulf press release) are different. No manufacturer alias statement was found. The near-identical marketing titles are WEAK evidence and are not used. |
| T06 | 1–3 | **DIFFERENT** | medium | DIFFERENT_VARIANT | The codes 85T8D and 85C6K PRO are different. Both are 2026 QD-Mini LED 144Hz sets, but no alias evidence was found. A third party reports a different HDMI layout (T8D 2x144Hz + 2x60Hz vs C6K Pro 4x HDMI 2.1). |
| T06 | 2–3 | **DIFFERENT** | high | REVIEW | PRO is a distinct product. TCL Saudi lists 'C6K Pro' as its own series (2026), separate from C6K (Gulf launch May 2025). Third-party specs differ: 85in C6K Pro ≥420 zones vs the C6K's 512+ zone claim. Noon's title also says '2025 Model'. |
| T07 | 1–2 | **SAME_EXACT** | high | MATCH_CANDIDATE_STRONG | Both sides carry Hisense 55U6Q PRO, including the PRO suffix: eXtra in its structured modelNumber (shown on the PDP) and Noon in its title. The code exists on the Hisense official page. The specs agree (60Hz panel / HSR120, VIDAA, 3 HDMI). Noon's PDP was not v |
| T08 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | The codes 98Q6C and 98C8L are different. The C8L is a different tier per TCL Saudi (4,032 zones, B&O audio, up to 6,000 nits), while the Q6C has 512 zones and ONKYO 2.1. |
| T08 | 1–3 | **REVIEW** | medium | REVIEW | Amazon's PDP item model is 98Q6C, and Noon's title contains 98Q6C, but Noon also lists 98C6K. No manufacturer alias makes Q6C equal to C6K, so the unit Noon ships is ambiguous. Noon's slug (120Hz) also conflicts with its title (144Hz), and Noon's PDP could not |
| T08 | 2–3 | **DIFFERENT** | high | REVIEW | 98C8L does not match either Noon code (98Q6C or 98C6K). C8L is a distinct series per TCL Saudi. |
| T09 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Different manufacturer codes 65T8D vs 65C7L; C7L is SQD-Mini LED with Bang & Olufsen audio (tcl.com/sa), T8D listing states ONKYO 2.1 QD-Mini LED; no alias evidence found. |
| T09 | 1–3 | **DIFFERENT** | medium | DIFFERENT_VARIANT | Different codes 65T8D vs 65Q6C; Amazon title says 2026 Model, Noon title says 2025 Model; no manufacturer/distributor alias statement found. Near-identical marketing copy is title similarity only (WEAK). |
| T09 | 1–4 | **DIFFERENT** | medium | REVIEW | Different codes 65T8D vs 65Q7D PRO; Q7D Pro is SQD-Mini LED series (tcl.com/sa) vs T8D QD-Mini LED; no alias evidence. |
| T09 | 2–3 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two trusted TCL Saudi codes, 65C7L (C7L SQD, 1,152 zones, B&O) vs 65Q6C (Q6C QD-MiniLED, up to 512 zones, ONKYO) - both on tcl.com/sa as separate products. |
| T09 | 2–4 | **DIFFERENT** | high | REVIEW | 65C7L (1,152 zones, 3,000 nits, B&O) vs 65Q7D PRO (646 zones, 2,000 nits, Onkyo) - separate tcl.com/sa product pages. |
| T09 | 3–4 | **DIFFERENT** | high | REVIEW | 65Q6C (QD-MiniLED, up to 512 zones) vs 65Q7D PRO (SQD-Mini LED, 646 zones) - separate tcl.com/sa product pages. |
| T10 | 1–2 | **DIFFERENT** | medium | DIFFERENT_VARIANT | Two different Hisense codes: 85U7S (eXtra structured MPN, independently corroborated by Jarir 'Manufacturer Number: 85U7S') vs 85U7Q (Noon title). Hisense's year-letter naming makes them different generations: U7Q is 2024/2025 (Hisense ES page), U7S is sold as |
| T11 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two different trusted TCL codes, each with its own tcl.com/sa product page: 98C8K (C8K, up to 3,840 zones, 5,000 nits, Bang & Olufsen) vs 98C6K (C6K, up to 512 zones, ONKYO 2.1). They are different tiers in the same model year, not regional aliases; no alias s |
| T12 | 1–2 | **DIFFERENT** | medium | DIFFERENT_VARIANT | Different TCL codes 55P8K (2025 P8K series, own EAN 5901292525897) vs 55T8B (2024 T8B series, European); no manufacturer/distributor alias statement found. Shared spec tuple (55in QLED 144Hz ONKYO) is WEAK. |
| T13 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two different TCL manufacturer codes, both with their own official TCL Saudi support pages: 55P8L ('P8L Mini LED TV', QD-Mini LED) vs 55C7L ('C7L SQD-Mini LED', Bang & Olufsen audio). Different series; no alias statement found. Same size/144Hz/mini-LED is only |
| T14 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two different TCL codes, each with its own TCL Saudi support page (55T69D 'T69D Premium QLED' vs 55T6D 'T6D Premium QLED'); the TCL SA T6D product page presents the T69D as a separate related model, not an alias. Noon title says 'Model 2026' (T69D). Shared 55" |
| T15 | 1–2 | **DIFFERENT** | medium | REVIEW | Explicit different codes on each side: eXtra structured MPN 55Q7EQ vs Amazon title 55E7S PRO (E-series, verified as a distinct Hisense model on hisense.es). No alias/regional equivalence statement found; weak spec conflict (BT 5.0 vs 5.4). Shared 55"/144Hz/QLE |
| T15 | 1–3 | **REVIEW** | low | REVIEW | Different codes (55Q7EQ vs 55Q72Q) but NEITHER is found on any Hisense manufacturer page (Hisense Saudi lists only 55Q7Q/55Q7N in Q7). Both look like Q7-family GCC codes and could be retailer-specific names of one set, or distinct sets; no manufacturer/distrib |
| T15 | 2–3 | **DIFFERENT** | medium | DIFFERENT_VARIANT | 55E7S PRO (manufacturer-verified E7 PRO series, Hisense Spain, 2026) vs 55Q72Q (Q-series code, retailer-corroborated). Different series naming, no alias statement found in any Hisense source. Confidence medium: 55Q72Q is not on a manufacturer page and Amazon P |
| T16 | 1–2 | **DIFFERENT** | high | REVIEW | Jarir PDP states manufacturer number 65Q61Q; Noon title states 65Q6N. Hisense Saudi (Hisense Middle East) carries them as separate products (65Q61Q page in Q6 category; separate 65Q6N page, plus a separate 65Q6Q). Retail sources date Q61Q as 2025 model and Q6N |
| T17 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two different TCL codes from successive series: 50P7K (P7K, 2025, TCL Gulf page) vs 50P7L (P7L Premium QLED, 2026, TCL Saudi page + 50P7L support page). TCL SA P7L page makes no reference to P7K as an equivalent. Same 50"/QLED/60Hz is WEAK family evidence only |
| T18 | 1–2 | **DIFFERENT** | high | DIFFERENT_VARIANT | Two different real Hisense manufacturer codes (65U7S vs 65E8S). Hisense Middle East lists U7 (U7S) and E8 (E8S) as separate products in its ULED MiniLED range; no alias or regional-equivalence statement found. Specs are close (both 144Hz MiniLED with subwoofer |
| T19 | 1–2 | **DIFFERENT** | medium | DIFFERENT_VARIANT | Two different TCL manufacturer codes, each with its own TCL Saudi support page (75V6B vs 75V6D). Third-party sources date V6B to 2024 and V6D to 2026 (different generations). No alias evidence. Same size and 60Hz is only family-level similarity. |
| T20 | 1–2 | **DIFFERENT** | high | REVIEW | Different TCL codes 75P8L vs 75Q7C, each with its own TCL SA support page. They are different series (P8L 2026 with ONKYO audio vs Q7C 2025 with B&O audio). No alias evidence. |
| T20 | 1–3 | **DIFFERENT** | high | REVIEW | Different TCL codes 75P8L vs 75C7L. TCL SA has a separate support page for each ('P8L Mini LED TV' vs 'C7L SQD-Mini LED TV'). Audio differs (ONKYO vs Bang & Olufsen). No alias evidence. |
| T20 | 1–4 | **DIFFERENT** | high | NO_EVIDENCE | Different TCL codes 75P8L vs 75Q7DPRO (Jarir Manufacturer No). Separate TCL SA support pages (P8L Mini LED vs Q7D Pro SQD-Mini LED). No alias evidence. |
| T20 | 2–3 | **DIFFERENT** | high | DIFFERENT_VARIANT | Different TCL codes 75Q7C (2025 'Q7C Premium QD-MiniLED') vs 75C7L (2026 'C7L SQD-Mini LED'). Separate TCL SA support pages, different generations and backlight tech (QD vs SQD). No alias evidence. |
| T20 | 2–4 | **DIFFERENT** | high | REVIEW | Different TCL codes 75Q7C vs 75Q7DPRO. Separate TCL SA support pages, different generations ('Q7C Premium QD-MiniLED' 2025 vs 'Q7D Pro SQD-Mini LED'). No alias evidence. |
| T20 | 3–4 | **DIFFERENT** | high | REVIEW | Different TCL codes 75C7L vs 75Q7DPRO. TCL publishes them as separate SQD-Mini LED models with separate SA support pages (C7L 'More Affordable Premium' vs Q7D Pro 'Smart Choice'), and TCL South Africa lists C7L and Q7D as distinct lines. Audio differs (B&O vs  |
| T21 | 1–2 | **REVIEW** | low | REVIEW | eXtra's PDP states MPN 85Q6EQ, a code with no manufacturer or web corroboration. Noon states 85Q6Q, a real Hisense Q6Q code, labelled 'International Model'. The codes differ literally, and no evidence shows 85Q6EQ is an alias of 85Q6Q (it could be a typo or a  |
| T22 | 1–2 | **DIFFERENT** | medium | DIFFERENT_VARIANT | Two different Hisense codes from different series and years: 58A6N (A6 series, 2024; official Hisense page exists) vs 58E6Q (E6 series, 2025 model per Sharaf DG). Third-party decoding of Hisense year letters (N=2024, Q=2025) is consistent with this. No alias o |
| V12 | 1–2 | **DIFFERENT** | high | REVIEW | Two different trusted manufacturer codes (2026K on Almanea PDP vs 2026E in eXtra structured MPN), no alias evidence. Independent retailers place them in different families (2026K = MultiClean 23L with auto/vehicle tool kit; 2026E = PowerClean Professional 21L) |
| V26 | 1–2 | **DIFFERENT** | high | REVIEW | Different trusted manufacturer codes (2027E vs 1994K), different form factor and capacity: 2027E is a 21L dry drum vacuum; 1994K is a CleanView multicyclonic canister with a ~2.2L dust tank. Only shared attributes are brand and 2000W (WEAK). |
| V14 | 1–2 | **DIFFERENT** | high | REVIEW | Two different trusted manufacturer codes: eXtra PDP MPN MC-CG711RY47 vs Noon structured model_number MC-CJ911RY47. Panasonic publishes separate pages for MC-CG711 and MC-CJ911; country of manufacture differs (Malaysia vs Japan). Shared 1900W/6L/red/bagged is o |
| V07 | 1–2 | **DIFFERENT** | high | REVIEW | Two different trusted manufacturer codes (Amazon item model/MPN TW4B25HA vs eXtra MPN TW4B71HA). Bundle differs: TW4B25HA = Classic Kit (black & gray), TW4B71HA = Animal Kit (aqua/gray, 4 accessories). Same motor/capacity platform (900W, 2.5L) is only a family |
| V02 | 1–2 | **DIFFERENT** | high | NO_EVIDENCE | Both sides state capacity and form factor and they conflict: 2L bagless canister vs 18L drum/barrel. Midea Saudi site lists these as two separate products (2L/1800W canister MC08MEBU; 18L/1800W drum MDVC18). Shared 1800W/blue is WEAK. |
| V13 | 1–2 | **DIFFERENT** | high | REVIEW | Two different trusted manufacturer codes (eXtra MPN MC-YL620KY47 vs Almanea MC-YL690GY47) and conflicting capacity stated by both sides (10L vs 15L). Panasonic publishes separate model pages; Almanea itself sells both as separate products. |
| V19 | 1–2 | **DIFFERENT** | high | NO_EVIDENCE | Different trusted manufacturer codes (eXtra MPN A9N-LITE vs A9K-CORE), different LG product lines (A9N vs A9Kompressor): A9N-LITE 160W single battery vs A9K-CORE 200W dual battery per LG; stated capacities also conflict (1.5L vs 0.44L). |
| V19 | 1–3 | **DIFFERENT** | high | REVIEW | Different trusted manufacturer codes (A9N-LITE vs A9K-PRO), different LG product lines; stated capacities conflict (1.5L vs 0.44L). |
| V19 | 2–3 | **DIFFERENT** | high | REVIEW | Two different trusted LG codes (A9K-CORE vs A9K-PRO) within the A9Kompressor line; LG sells them as distinct SKUs with different bundles (CORE: Power Drive nozzles/dual battery per LG UAE; PRO: mop pads/handy-tool kit per LG SG). Same 200W/0.44L is a family tu |

Pairs: {"SAME_EXACT":4,"DIFFERENT":47,"REVIEW":3}.

## Codes visible on the merchant page but absent from our production payload

- T01#1 جرير (Jarir): 65Q71Q (page: 65Q71Q (spec table 'Manufacturer No'); 682058 is Jarir SKU)
- T01#2 أمازون (Amazon.sa): 65Q72Q (page: 65Q72Q (product details 'Model Number'))
- T04#3 Jarir: 65P7L (page: 65P7L)
- T09#4 Jarir: 65Q7D PRO (page: 65Q7DPRO (SKU 683681))
- T16#1 جرير: 65Q61Q (page: Model 'Q61Q'; Manufacturer Number '65Q61Q'; SKU 672682)
- T20#1 Amazon.sa: 75P8L (page: 75P8L (title; Arabic title ends '75P8L من TCL'); Product details table not retrievable)
- T20#4 Jarir: 75Q7D PRO (page: Manufacturer No: 75Q7DPRO (Jarir SKU 683682))
- V12#1 المنيع (Almanea): 2026K (page: 2026K)
- V26#2 المنيع (Almanea): 1994K (page: 1994K)
- V14#1 إكسترا (eXtra): MC-CG711 (page: MC-CG711RY47)
- V07#2 إكسترا (eXtra): TW4B71HA (page: TW4B71HA)
- V02#2 شاكر (Shaker): MDVC18 (page: MDVC18)
- V13#1 إكسترا (eXtra): MC-YL620 (page: MC-YL620KY47)
- V19#1 إكسترا (eXtra): A9N-LITE (page: A9N-LITE)
- V19#2 الصندوق الأسود (Blackbox, alnakheelk.com URL): A9K-CORE (page: A9K-CORE)
