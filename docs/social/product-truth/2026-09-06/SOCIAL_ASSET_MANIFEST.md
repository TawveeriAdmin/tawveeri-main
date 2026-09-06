# SOCIAL_ASSET_MANIFEST.md

**Status note:** this pass captured screenshots in-browser for verification (not saved to disk as shareable files). This manifest is the **shot list** for a follow-up capture pass — every entry below is a real, already-verified route/query, so recreating each asset is a direct re-run, not new research. None of these have been captured to a distributable file yet; treat this section as "NEEDS CAPTURE," not "ready."

| asset_id | category | journey | route | screen | what it proves | safe crop | exclude | locale | freshness | recommended use |
|---|---|---|---|---|---|---|---|---|---|---|
| AST-01 | refrigerator | small fridge + lock | `/ar/search?q=أبي ثلاجة صغيرة وقفلها مهم` | results, top 4 cards | Honest disclosure instead of guessing (flagship claim) | Crop to the top ranked-results block only (down to the neutrality footer line) | The "عرض ساخن" grid below (irrelevant items, GAP-3) | AR (build EN parallel from `/en/search?q=...` if it exists — not tested) | Re-capture if >14 days old | X evidence card, TikTok voiceover moment |
| AST-02 | air_conditioner | 25m² room, 2500 SAR | `/ar/search?q=مكيف لغرفة 25 متر بميزانية 2500` | results, chip row + top card | Room-size-to-BTU matching, budget banner | Same — crop above the hot-deals grid | Hot-deals grid | AR | Re-capture if >14 days old | Carousel "ask it like this" slide |
| AST-03 | smartphone | camera + budget | `/ar/search?q=جوال كاميرا ممتازة بميزانية 2000` | results, top pick card | Camera-priority reasoning, storage-ambiguity disclosure | Crop to top card + one "why this pick" expander | Follow-up quick-action buttons (GAP-1, do not depict as functional) and hot-deals grid | AR | Re-capture if >14 days old | Reels/TikTok comparison hook |
| AST-04 | refrigerator | exit-link proof | fridge journey → click "تحقق من السعر والمتجر" | destination Amazon.sa page | Real merchant hand-off with correct affiliate tag | Crop to product title + price only; blur/remove any account/cart sidebar (this session's test tab showed a signed-in test account and cart contents — must not appear in a public asset) | Signed-in account info, cart sidebar, any personal data | AR/EN (Amazon page renders per session locale) | Re-capture same-day as publish (price changes) | "we take you to the real store" proof shot |
| AST-05 | product_truth | fake-discount catch | any of AST-01/02/03 | the "لم نرصده يومًا بسعر «قبل» المعلن" line | Anti-fake-discount honesty | Zoom crop to just that line + price | n/a | AR/EN | Re-capture per post (price-specific) | Trust-building single-fact post |
| AST-06 | product_truth | neutrality statement | any results page | footer line | "Ranking is fully neutral" | Full-width crop of just that line | n/a | AR/EN | Evergreen, low freshness risk | Brand-trust evergreen post |
| AST-07 | smartphone | honest zero-match fallback | phone journey, bottom of results | the "لم نثبت عرضًا مطابقًا" + sponsored-label block | Transparent labeling of affiliate/sponsored fallback content | Crop to include the visible "مادة إعلانية • رابط عمولة" label — never crop the label out | n/a | AR/EN | Re-capture if UI changes | Transparency/trust post |

## Never expose (apply to every future capture, not just the list above)
- Internal admin/debug UI of any kind.
- Any signed-in personal account state — this session's test tab showed a real-looking cart/wishlist sidebar; always capture from a clean/incognito or dedicated demo account.
- Internal engineering identifiers (table names, internal column names, raw ADR text) in a public-facing crop.
- Secrets, tokens, or the raw affiliate tag string beyond what naturally appears in a merchant URL bar (do not zoom into or caption the tag itself).

## Capture checklist for the follow-up pass
1. Use a dedicated demo/incognito session — do not reuse this session's test account (`Test` user with an existing 61-notification badge and cart items was visible throughout this pass).
2. Use `computer` action `screenshot`/`zoom` with `save_to_disk: true` this time.
3. Re-verify the live text still matches `SOCIAL_CLAIMS_LEDGER.md` before capturing (prices and exact wording drift).
4. Crop per the "safe crop" column above before any publish — never ship an un-cropped full-page screenshot given GAP-1/GAP-3.
