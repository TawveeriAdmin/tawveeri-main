with m(k, slug) as (values
  ('1','jarir'),('jarir','jarir'),('جرير','jarir'),('مكتبة جرير','jarir'),
  ('2','amazon'),('amazon','amazon'),('أمازون','amazon'),('أمازون السعودية','amazon'),('amazon.sa','amazon'),
  ('3','noon'),('noon','noon'),('نون','noon'),
  ('4','extra'),('extra','extra'),('اكسترا','extra'),('إكسترا','extra'),
  ('5','almanea'),('almanea','almanea'),('المنيع','almanea'),
  ('6','samsung_ksa'),('سامسونج السعودية','samsung_ksa'),
  ('7','shaker'),('shaker','shaker'),('شاكر','shaker'),
  ('8','swsg'),('swsg','swsg'),('الشتاء والصيف','swsg'),
  ('9','najm'),('najm','najm'),('نجم الأجهزة','najm'),
  ('18','alnakheelk'),('alnakheelk','alnakheelk'),('متجر النخيل','alnakheelk'),
  ('23','lulu'),('lulu','lulu'),('لولو هايبر ماركت','lulu'),
  ('24','sharafdg'),('sharafdg','sharafdg'),('شرف دي جي','sharafdg')
),
rows_t as (
  select ph.canonical_product_id cid, m.slug, ph.observed_at as stamped,
         coalesce(o.scraped_at, ph.observed_at) as truth
  from price_history ph
  join canonical_products cp on cp.id = ph.canonical_product_id and cp.is_active
  join m on m.k = lower(trim(ph.store_name))
  left join normalized_product_observations n on n.id = ph.tps_observation_id
  left join raw_observations o on o.id = (n.normalized_payload->>'_raw_id')::bigint
  where ph.canonical_product_id is not null
),
offers as (select cid, slug, max(stamped) last_stamped, max(truth) last_true from rows_t group by 1,2)
select slug, count(*) offers,
  round(extract(epoch from (now() - percentile_disc(0.5) within group (order by last_stamped)))/86400.0,1) median_age_PUBLISHED,
  round(extract(epoch from (now() - percentile_disc(0.5) within group (order by last_true)))/86400.0,1) median_age_TRUE,
  count(*) filter (where last_stamped <= now() - interval '7 days') stale7_published,
  count(*) filter (where last_true    <= now() - interval '7 days') stale7_true
from offers group by slug order by offers desc
