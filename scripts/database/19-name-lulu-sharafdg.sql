-- 19 — give stores 23 and 24 the names they never had (ADR-174, separate unit).
--
-- Both rows were created as skeletons: name_ar AND name_en were NULL. They render on
-- /[locale]/stores, which now lists 9 stores after ADR-172 — so two of the nine cards
-- were showing an empty name to customers.
--
-- The names are NOT invented. They are the ones already approved in
-- src/lib/scraping/config/store-configs/{lulu,sharafdg}.json and now mirrored in
-- TPS_STORES. One name, one source.
--
-- This is deliberately its own unit, separate from the sweep: it touches a field the
-- customer reads, and it must be revertible without undoing the knowledge-layer work.
--
-- ROLLBACK:
--   update stores set name_ar = null, name_en = null where id in (23, 24);

update stores set name_ar = 'لولو هايبر ماركت', name_en = 'LuLu Hypermarket' where id = 23;
update stores set name_ar = 'شرف دي جي',        name_en = 'Sharaf DG'        where id = 24;
