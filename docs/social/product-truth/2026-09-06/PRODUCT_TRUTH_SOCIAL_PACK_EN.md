# Product Truth & Marketing Pack — Tawveeri
**Version:** 1.0 · **Generated:** 2026-09-06 · **Data as of:** 2026-09-06 (live production, tawveeri.com)
**Single source of truth:** `SOCIAL_CLAIMS_LEDGER.md` and `SOCIAL_CAPABILITY_CONTRACT.json` in this folder. Every claim below is cited (ADR or live repro). Unknown beats incorrect.

---

## 1. Product identity

**What is Tawveeri?**
A Saudi platform that helps you decide which electronics product to buy — by comparing real, actually-observed prices across Saudi merchants, with no marketed numbers and no guessing. Tawveeri doesn't sell; it helps you decide, then sends you to the merchant.

**What Tawveeri is NOT:**
- Not a retailer or marketplace — no purchase happens inside Tawveeri.
- Not a coupon/deals account.
- Not a generic affiliate directory without real comparison.
- Not a generic shopping chatbot — decisions come from deterministic engines and real price evidence; an LLM only phrases, never invents.
- Not "always cheapest" — no evidence supports that across categories, and the claim is explicitly prohibited from publication (`SOCIAL_GOVERNANCE.md` §2).

**One-sentence promise:** Describe your need and budget in your own words; Tawveeri understands it, compares real prices across Saudi merchants, and explains why it's recommending something — honestly, even when the honest answer is "we don't know."

**Core customer job:** Reduce the risk of a purchase decision (especially home appliances and electronics) with documented price evidence instead of relying on merchant advertising alone.

**What happens after Tawveeri?** The shopper moves to the merchant's site (e.g. Amazon.sa) to complete the purchase — verified live this session: the exit link landed on the real Amazon page carrying the correct affiliate tag (`SOCIAL_CLAIMS_LEDGER.md` A11).

## 2. Categories supported today (live data, 2026-09-06)

| Category | Status | Note |
|---|---|---|
| Refrigerators | 🟢 Strong | Understands size (small/large), honestly discloses lock uncertainty instead of guessing |
| Air conditioners | 🟡 Good with a gap | Accurately matches room size to BTU capacity, but Amazon has zero real AC listings |
| Smartphones | 🟢 Strong for camera+budget | Camera claim re-verified live; battery/performance not re-checked this session |
| TVs, laptops, tablets, washers | 🟡 Not live-tested this pass | Check `docs/CAPABILITY-CONTRACT.md` and the ADRs before any specific claim |
| Home Mission | 🟡/UNKNOWN | Not tested live this session — do not use in content before a direct check |

**Overall caveat:** 7,112 published products, but only 1,384 are comparable (2+ stores), and only 8 of 24 registry stores actively serve today (`SOCIAL_CLAIMS_LEDGER.md` C1-C3). Never use "thousands of products" in a way that implies all of them are comparable.

## 3. Real journeys — from live production (2026-09-06)

### Journey 1 — Small refrigerator, lock matters
**Query:** "أبي ثلاجة صغيرة وقفلها مهم" (I want a small fridge, and the lock matters)
**UI response:** Understanding chips "ثلاجة" (fridge) and "small". 418 results, top 4 sized 200/200/130/80 liters, each captioned "small as requested."
**Honest disclosure:** Every result carried: "⚠️ We don't have reliable data about a lock for this fridge — check the product specs directly before buying if the lock matters to you."
**Why this matters for marketing:** This isn't a flaw to hide — it's the real differentiator. Tawveeri doesn't guess and doesn't silently drop your request (this was a real production incident, since fixed, ADR-290).
**Promise status:** 🟢 (size understanding) + 🟢 (honest disclosure) + 🔴 (no actual lock filtering — never claim this).

### Journey 2 — AC for a 25m² room, 2,500 SAR budget
**Response:** Chips "25 m²" and "under 2,500 SAR," banner "we applied the budget from your search." Every result captioned: "suitable for a ~25m² room (17800/18000/18100-unit capacity matches what you asked)," plus notes like "inverter — higher efficiency" and "cool-only — suitable for most of the Kingdom's climate."
**Additional honest disclosure:** "never observed at the advertised 'before' price (1,599)" — a fake-discount catch.
**Important caveat:** Amazon has zero real AC listings (ADR-295) — never claim cross-merchant comparison for this category.
**Promise status:** 🟢 (room-size-to-capacity matching) — a new claim, not previously documented, now confirmed live.

### Journey 3 — Phone, great camera, 2,000 SAR budget
**Response:** Chips "phone" / "under 2,000 SAR" / "photography," top pick iPhone 14 Pro Max reasoned "Pro Max version — better camera."
**Honest disclosure:** "⚠️ Storage capacity is not specified in these offers — may vary between stores."
**Important negative finding:** The follow-up quick-action buttons under the pick ("what if I raise the budget by 500?" etc.) produced **zero change** when clicked — a real defect found live this session (`PRODUCT_GAPS_FOR_SOCIAL.md` GAP-1). **Never depict or script this as working.**
**Documented honest failure:** at the bottom of the results, when no offer was confident enough, an honest message appeared: "Tawveeri recognized the model but couldn't confirm a sufficiently matching offer," under a clearly labeled "Sponsored content • affiliate link" tag.
**Promise status:** 🟢 (camera+budget, re-verified live) / 🔴 (follow-up quick-actions, confirmed broken).

**Explicit scope note:** These are only 3 of the journeys the mission asked for (fridge, AC, phone). TV, laptop, tablet, washer, and Home Mission were NOT tested live this session. Do not assume equal quality before a direct check.

## 4. Product-promise matrix (full detail in `SOCIAL_CAPABILITY_CONTRACT.json`)

| Claim | Status |
|---|---|
| Understands a maximum budget (any phrasing) across categories | 🟢 |
| Understands "small" refrigerator size | 🟢 |
| Verifies a refrigerator has a lock | 🔴 |
| Honest disclosure instead of guessing (the general principle) | 🟢 — the strongest, most evidence-dense claim in the whole register |
| Room size → AC capacity matching | 🟢 |
| Camera + budget phone search | 🟢 |
| Battery / performance / free-form pain-point phone search | 🟡 (not re-verified this session) |
| Unnamed A-vs-B comparison | 🔴 |
| Buy-now-vs-wait guidance | 🔴 |
| Automatic discovery of a product not in the catalog | 🔴 (safety mechanism proven, capability unproven) |
| Ranking commercial neutrality | 🟢 |
| Fake-discount detection | 🟢 |
| Official Noon partnership | 🔴 (legally unresolved) |
| "Noon is usually cheaper" | 🔴 (disproven for TV) |

## 5. Strongest marketable features (with live proof)

1. **"We don't guess — we disclose."** The strongest, most repeatedly-proven differentiator in the whole register. Live example: the refrigerator lock case.
2. **Fake-discount detection.** "Never observed at the advertised 'before' price" — proven live across three different categories.
3. **Real-context matching** (room size → AC capacity, priority → camera) with a written reason for every recommendation.
4. **Ranking neutrality.** Restated on every results page: "Ranking is fully neutral — commercial interest never enters ranking."
5. **A real, working exit link.** Verified live: lands you on the actual product page at its real price.

## 6. Social tone

Saudi, clear, decision-first — not corporate, not salesy, not fake-expert, not engagement bait.
- **Do:** cite a real number with its observation date. Admit the unknown plainly: "We don't have reliable data on this — check yourself before buying."
- **Don't:** promise an unproven feature (see §4). Don't say "cheapest" or "all stores."
- **How to say incomplete coverage:** "Tawveeri covers 8 active merchants today and is growing — we don't have everything yet."

## 7. Intent Desk — reply templates tied to a real journey

| User intent | What Tawveeri can actually do | Safe reply template | When to link |
|---|---|---|---|
| Budget | Confirmed budget-ceiling understanding, all categories | "Tell us your budget and need, and we'll only show what fits" | Always, with a real result |
| Named A-vs-B comparison | Not supported today (🔴) | "We can compare prices for a specific product precisely, but general brand-vs-brand comparison isn't supported yet" | Never imply general comparison works |
| Zero results | Happens for real (seen live on the phone journey) | "We couldn't find an offer we trust enough — we can point you straight to the merchant" | Yes, clearly-labeled affiliate link |
| Price/link complaint | Real, handle honestly | "Thanks for flagging this, we're checking and will get back to you" | Never promise a specific fix date without engineering confirmation |

## 8. Terminology dictionary (English ↔ Arabic)

| Approved English | Arabic | Avoid |
|---|---|---|
| Product Truth | الحقيقة المنتجية | "absolute truth" |
| Smart Pick | اختيار توفيري | "officially the best" |
| Verified comparison | مقارنة موثّقة | "100% guaranteed" |
| Observed price | السعر المرصود | "official price" |
| Merchant | متجر | "partner" (without documented partnership) |
| Qualified outbound | خروج مؤهّل | — |
| Unknown | مجهول | avoid substituting a positive claim instead |
| Unconfirmed | غير مؤكد | — |
| Renewed/Refurbished | مجدَّد/مُصلَّح | never merge with "new" |

## 9. Competitive positioning (brief)

- **Why not just Google?** Google shows ads and generic results; Tawveeri builds a real price history and discloses trust per offer.
- **Why not go straight to Amazon/Noon/Jarir?** Each merchant only shows its own price; Tawveeri compares them with evidence and catches fake discounts.
- **Why not just ask X/TikTok?** No live integration exists between Grok and Tawveeri today (ADR-297) — any social answer today is manually built from this pack, not a live product query.

---

**Remaining detailed sections** (weekly content, Saudi calendar, channel playbook, personas) live in separate files in this folder to avoid duplication: `SOCIAL_CONTENT_7_DAY_BANK.md`, `SOCIAL_90_DAY_SAUDI_CALENDAR.md`, `SOCIAL_CHANNEL_PLAYBOOK_X_TIKTOK.md`.
