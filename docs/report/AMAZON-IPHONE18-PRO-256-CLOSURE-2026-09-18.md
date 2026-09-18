# Amazon iPhone 18 Pro 256GB — narrow ingestion closure

## Outcome

Verified in production on 2026-09-18 at 14:16 UTC, **before deploying any repository changes**: [the existing comparison](https://tawveeri.com/ar/compare/apple%7CiPhone%7C18%7CPro%7C256) and live search show Amazon and Almanea together, both at **SAR 5,699**. Amazon is `in_stock`; Almanea is `pre_order`. The founder's earlier SAR 5,799 Almanea observation is not the price returned by this live capture.

Amazon's actual page identifies **Apple iPhone 18 Pro 256 GB – Silver**, ASIN **B0HJ9V43LX**, with selected storage **256GB**, base buybox price **SAR 5,699**, and combined **Shipper / Seller Amazon.sa**. This direct Amazon offer qualifies under existing identity, availability and destination checks. Trade-in was not deducted. The 1TB option is not this offer and retains a separate identity key ending in `1024`.

## Proven cause and decision

The target ASIN had **zero raw observations** before the repair. The inspected recent Amazon iPhone 18 records contained accessories rather than this handset. The discovery adapter uses generic search queries and bounded pagination; this newly live offer had not entered ingestion. This establishes an ingestion/discovery omission, not the precise cause or duration of a scheduler delay.

Fetching the exact PDP through the unchanged Amazon scraper correctly extracted the price and availability. The unchanged mobile normalizer produced the existing valid identity `apple|iPhone|18|Pro|256`. No evidence justified changing price parsing, matching, link eligibility or ranking.

Decision: ingest **one verified ASIN**, run existing normalization/corroboration for **one existing identity**, and update its existing projection using the existing derivation. The canonical ID remained unchanged. No runtime application code, generic discovery queries, seller policy, affiliate logic, Noon or Samsung files were changed. This is a targeted data repair; it does not establish automatic discovery of every future launch.

## Measured before / after

| Measure | Before | After |
|---|---:|---:|
| Raw observations of this ASIN | 0 | 1 newly written |
| Stores in this existing comparison | 1 | 2 |
| Canonical identity for the target | 1 existing | Same existing identity |

Existing corroboration reported one normalized observation, one match and one price, with zero rejected price transitions and zero deferred pairs. These are effects of the targeted operation, not broader catalog coverage claims.

## Verification

- Three relevant Jest suites passed: **19 tests**. Includes existing Amazon discovery and price tests plus variant, seller, stock, ASIN and trade-in guards for this operation.
- Production comparison API returned both offers; production search returned both stores for the same identity.
- A real Chrome session rendered both stores and 256GB on the comparison page; the merchant page returned HTTP 200 with the exact title and ASIN.
- An actual `/go` request returned HTTP **302** to `www.amazon.sa/dp/B0HJ9V43LX`, preserving existing affiliate handling. No third-party merchant destination was substituted.
- Production SHA at the successful pre-deployment verification: `fa3bae0588d5ea662fbf653eb2d96a8ab0443fb9`. The data repair was already live on that runtime; repository changes preserve the operator procedure, tests and evidence.

Public, selected evidence: [closure evidence](../evidence/amazon-iphone18-pro-256-closure-2026-09-18.json). Full local before/after journal, source HTML and screenshots remain in `scratchpad/amazon-iphone18-*`; full database rows and signed links are not published.

## Exact task files

- `scripts/tps-analysis/inspect-amazon-iphone18-closure.ts` — read-only diagnosis.
- `scripts/tps-analysis/close-amazon-iphone18-offer.ts` — dry-run default, guarded single-offer repair.
- `scripts/tps-analysis/verify-amazon-iphone18-closure.cjs` — one-comparison live verification.
- `tests/scraping/amazon-iphone18-closure.test.ts` — focused regression guards.
- `docs/evidence/amazon-iphone18-pro-256-closure-2026-09-18.json` — selected measured evidence.
- This report.

## Rollback and remaining limitation

The local apply journal preserves the prior canonical, current offers, normalized observations and projection. If the offer becomes invalid, withdraw only this Amazon offer through the existing exclusion/delist mechanism and regenerate this identity's projection; retain immutable raw history. Do not restore the entire database or overwrite later merchant observations with an old snapshot. Reverting the operator-script commit alone does not undo the production data repair.

Source price and stock can change after capture. No broad discovery completeness or future crawl timing is claimed. No unrelated work was included.
