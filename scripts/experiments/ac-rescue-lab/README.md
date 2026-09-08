# AC Rescue Lab — Isolated Experiment (ADR-319)

**HARD BOUNDARY: this directory is READ-ONLY against Products 2.** Every script here connects
to production only to `SELECT`. Nothing in this directory ever issues `INSERT`/`UPDATE`/`DELETE`
against `canonical_products`, `normalized_product_observations`, `products`, `product_stores`,
`storefront_identity_links`, or any other Products 2 / TPS table. All experimental output is
written to local JSON files in `out/` (gitignored-equivalent — treated as scratch, not committed
as durable evidence except the final summarized results file referenced by the ADR).

Nothing in this directory is imported by any file outside it. No scheduled job. No API route.
No UI. No Advisor exposure. This is a standalone research artifact only.
