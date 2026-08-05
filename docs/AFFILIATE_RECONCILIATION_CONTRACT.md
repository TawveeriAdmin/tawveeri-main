# Affiliate Reconciliation Contract

_Design for matching affiliate-network-reported conversions to our own `outbound_clicks`. Companion: [FOUNDER_COMMERCE_COMMAND_CENTER.md](FOUNDER_COMMERCE_COMMAND_CENTER.md). Schema: `scripts/database/30-affiliate-reconciliation.sql`._

## Ingestion route: manual CSV, column-mapped — not a hardcoded Amazon format

Amazon Associates reports are CSV/XML-exportable from Associates Central; there is no documented self-serve API for this account tier, so **manual, idempotent CSV upload is the default and only route** until the founder confirms otherwise. Official Amazon documentation describes report *contents* (item, price, referral rate, earnings, tracking ID) but does not publish a fixed, versioned column-header contract, and no API/account credential exists in this environment to pull a live sample. Rather than guess exact header names and risk silently mis-mapping columns (a fabrication risk on financial data), the importer requires an explicit **header→field mapping step on first upload of a given report type**, saved and reused for subsequent uploads of the same type. This generalizes to Noon or any future retailer's export for free.

## Schema (migration 30)

**`affiliate_reports`** — one row per uploaded file.
`id, source (text, e.g. 'amazon_associates'), report_period_start, report_period_end, file_checksum (sha256, unique per source), original_filename, column_mapping (jsonb), row_count, imported_rows, rejected_rows, uploaded_by (admin user id), created_at`.
Uniqueness on `(source, file_checksum)` — re-uploading the same file is a no-op, reported back as "already imported," not a duplicate insert.

**`affiliate_conversions`** — one row per line item in a report.
`id, report_id (fk), source, tracking_id_raw (the report's own tracking/sub-tag column, verbatim), sub_id (parsed match candidate against outbound_clicks.sub_id, nullable), asin_or_sku, item_name, order_date, ship_date, quantity, price, commission_amount, currency, state, match_tier, matched_click_id (fk to outbound_clicks, nullable), created_at`.

RLS enabled on both, **no policies** — service-role only (matches Rule 10 of the data-quality contract). Never exposed to `anon`/`authenticated`.

## Conversion states (`state`)

`CLICKED` (implied by having an `outbound_clicks` row, not a report state) → `ORDERED` → `SHIPPED` | `CANCELLED` | `RETURNED`, independently: `COMMISSION_PENDING` → `COMMISSION_CONFIRMED` → `PAID`. States are taken **verbatim from what the report says**, mapped by the admin during column-mapping (e.g. "Shipped" in an Amazon export → `SHIPPED`); never inferred beyond what the source states.

## Match tiers (`match_tier`)

| Tier | Condition |
|---|---|
| `EXACT` | Report row's parsed `sub_id` matches an `outbound_clicks.sub_id` exactly, and the order date falls within a plausible window (default 30 days) after the click. |
| `PROBABLE` | No `sub_id` in the report (common — many affiliate exports don't echo the sub-tag back per line), but ASIN/SKU + date window matches exactly one `outbound_clicks` row for that store within the window. |
| `AGGREGATE_ONLY` | The report line is a summary/total row with no per-click granularity at all (e.g. a period total). Never attributed to an individual click. |
| `UNMATCHED` | Everything else — including PROBABLE candidates that match more than one click (ambiguous, so not claimed). |

Only `EXACT` feeds per-product/per-campaign attribution claims in the dashboard. `PROBABLE` is shown labeled as probable wherever it appears. `AGGREGATE_ONLY` and `UNMATCHED` amounts are their own line item, never folded into a retailer's confirmed total (Data Quality Contract, Rule 5).

## Idempotency & integrity

- File-level: `sha256(file_bytes)` unique per `source` — re-upload is detected and reported, not re-inserted.
- Row-level: rejected rows (unparseable date, missing required field per the saved mapping) are counted (`rejected_rows`) and listed in the upload result, never silently dropped.
- Retention: normalized `affiliate_conversions` rows are kept indefinitely (small, structured); the raw uploaded file is **not** stored (only its checksum) — the normalized rows plus the checksum are sufficient for audit and re-import detection, so we don't need to retain arbitrary financial CSVs in blob storage (Section 9 of the mandate: "don't store raw reports indefinitely when normalized records + checksum suffice").

## Stop boundary (per this unit's own acceptance rule — record and continue everything else)

To exercise this end-to-end (import a real report, verify EXACT matches against real `outbound_clicks.sub_id` rows, confirm the column-mapping UI against real headers), we need:

- **Exact account screen:** Amazon Associates Central → Reports → Earnings Report (or Orders Report).
- **Exact report:** Earnings Report, broken out by Tracking ID if available (tracking ID = our `sub_id`/`ascsubtag`).
- **Exact date range:** any recent period with ≥1 real order, ideally since the `tawveeri0f-21` tag rotation (2026-08-05, ADR-212) to avoid mixing old/new tag data.
- **Exact download format:** CSV.
- **Exact safe action required:** download the CSV from Associates Central and share the file (or just its header row, to seed the column mapping without exposing commercial rows) — no account credentials needed, no login sharing required.

Everything else in this contract — schema, migration, the mapping-based importer UI, match-tier logic — is built and does not wait on this.
