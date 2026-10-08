# Mobile closure rollback

Prepared before deployment. Railway `deploymentRollback(id: String!): Boolean!` was confirmed through authenticated schema introspection; no rollback has been executed.

1. Web: `railway api --file docs/evidence/mobile-audit-2026-10-07/rollback-main.graphql`
2. Worker: `railway api --file docs/evidence/mobile-audit-2026-10-07/rollback-worker.graphql`
3. Check deployment status and `/api/health`, then replay the golden set. A rollback is not a successful closure: the previous code contains the documented phone defects.

Data rollback, only if restoring the exact pre-task state is intended:

`node scripts/tps-analysis/mobile-closure-data.cjs rollback`

The data command restores exactly the five exported current-offer rows in one transaction. It refuses if the raw observation or quarantine marker changed. It restores status, payload and update time from `asin-quarantine-before.json`; no price history, canonical, normalized observation, product match or outbound relationship is deleted or rewritten. Restoring these rows restores the original known ASIN conflicts, so it must not be described as a repair.

The five quarantines are compatible with retaining data history. The new web and worker guards are required to enforce them across historical fallback and exits. No refresh, observation-sync, identity flags, merchant attribution, database schema or scheduler settings were changed by this release.
