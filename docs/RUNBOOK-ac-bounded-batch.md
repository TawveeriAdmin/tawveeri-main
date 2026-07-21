# Runbook — TPS Bounded AC Batch (E6)

Grows the **air_conditioner** canonical graph from ≥2-store-corroborated Extra↔Almanea AC listings. **Never unleash the backlog** — scale via repeated bounded batches. See ADR-020/021/022/023.

## Key facts
- Only **Extra (store_id 4)** sells real ACs at scale (~12,540); **Almanea (5)** ~88 real split ACs; **Jarir/Amazon have zero real AC units** (accessories/controllers only). Corroboration is Extra↔Almanea.
- The unlock was **brand normalization** (Arabic `إل جي` = English `LG`): `tps-core/brand-map.ts` (bilingual AC brands) + `ac/identity.ts` canonicalizes brand. Without it there is 0 key overlap.
- AC canonical category is **`air_conditioner`** (the plugin says `ac`; canonical/search plane uses `air_conditioner`).
- Support tables: `ac_identity_state` and `conflict_review` **do not exist** (verified via direct DB). `write_ac_batch` uses existing schema only.

## Mechanism
`scripts/tps-matcher/ac-matcher-v1-dry.ts` → exports `runAcBatch(opts)` + CLI. Uses `acPlugin` only (never mobile rules). Balanced fetch by store_id (Extra+Almanea), total ≤ `limit` (≤500), neither store monopolizes. Persists via the atomic `write_ac_batch` RPC (`scripts/database/knowledge-db/008_write_ac_batch.sql`).

## Safe execution (CLI)
```bash
# DRY RUN first (default). AC_TOTAL_LIMIT is the total across both stores.
DRY_RUN=true  AC_TOTAL_LIMIT=500 npx tsx scripts/tps-matcher/ac-matcher-v1-dry.ts
# Snapshot the batch's canonical/normalized IDs (see ADR-023 snapshot pattern) for rollback.
# WRITE (bounded) only after reviewing the dry-run:
DRY_RUN=false AC_TOTAL_LIMIT=500 npx tsx scripts/tps-matcher/ac-matcher-v1-dry.ts
# Rebuild the projection so the new AC canonicals surface:
npx tsx scripts/build-tps-projection.ts
```
Via the scheduler: `POST /api/cron/tps-batch { "category":"air_conditioner", "limit":500, "dryRun":false }` (see the scheduler runbook).

## Safety properties (verified)
- **≥2-store corroboration only:** single-store fallbacks are never written (precision over recall). Fallback identity = `brand|ac_type|NO_SERIES|capacity_btu|technology|cooling_mode`.
- **Never merges incompatible fields** (capacity/cooling/tech/type are part of the key) or by color/price.
- **Hard bound ≤500** (asserts `fetched ≤ limit`); **fingerprint-checked** before writes; **deterministic/idempotent** (`stableUuid`); **atomic** (`write_ac_batch`, rollback-verified); **status** `done` only after a successful commit; **append-only price history** (changed prices only).
- **Rollback:** the 7 first-batch canonicals were all new → delete `canonical_products`/`normalized_product_observations`/`product_matches`/`price_history` rows for the batch's `canonical_id`s and revert the 34 obs to `pending`. Snapshot every affected row before any write.

## First batch (shipped & verified)
7 canonicals (LG/GREE/Westinghouse 12000/18000/21400), 34 normalized, 14 matches, 14 price rows, 34 obs `done`; projection 41→48; live "مكيف جري"/"LG split ac" → 2-store AC Smart Picks. No mobile/taxonomy regression.

## Known gap
English AC queries fall back to raw picks (canonical names are Arabic). Consider English AC name synonyms in a future matcher version.
