with
-- PER-RETAILER CUSTOMER-VISIBLE OFFER FRESHNESS (ADR-149).
-- An "offer" = one (canonical_product_id, resolved retailer) pair on an ACTIVE canonical.
-- Age is measured on the offer's MOST RECENT price_history observation, because that is
-- the number a customer is shown. Store resolution mirrors resolveApprovedSlug().
m(k, slug) as (values
  ('1','jarir'),('jarir','jarir'),('جرير','jarir'),('مكتبة جرير','jarir'),
  ('2','amazon'),('amazon','amazon'),('أمازون','amazon'),('أمازون السعودية','amazon'),('amazon.sa','amazon'),
  ('3','noon'),('noon','noon'),('نون','noon'),
  ('4','extra'),('extra','extra'),('اكسترا','extra'),('إكسترا','extra'),
  ('5','almanea'),('almanea','almanea'),('المنيع','almanea'),
  ('6','samsung_ksa'),('samsung_ksa','samsung_ksa'),('سامسونج السعودية','samsung_ksa'),('سامسونج','samsung_ksa'),('samsung saudi','samsung_ksa'),
  ('7','shaker'),('shaker','shaker'),('شاكر','shaker'),('ibrahim-shaker','shaker'),
  ('8','swsg'),('swsg','swsg'),('الشتاء والصيف','swsg'),('شيتا وسيف','swsg'),
  ('9','najm'),('najm','najm'),('نجم الأجهزة','najm'),('نجم','najm'),
  ('10','blackbox'),('blackbox','blackbox'),('الصندوق الأسود','blackbox'),('بلاك بوكس','blackbox'),
  ('18','alnakheelk'),('alnakheelk','alnakheelk'),('متجر النخيل','alnakheelk'),('النخيل','alnakheelk'),
  ('23','lulu'),('lulu','lulu'),('لولو هايبر ماركت','lulu'),('لولو','lulu'),('lulu hypermarket','lulu'),
  ('24','sharafdg'),('sharafdg','sharafdg'),('شرف دي جي','sharafdg'),('sharaf dg','sharafdg')
),
offers as (
  select ph.canonical_product_id cid, m.slug, max(ph.observed_at) last_seen
  from price_history ph
  join canonical_products cp on cp.id = ph.canonical_product_id and cp.is_active
  join m on m.k = lower(trim(ph.store_name))
  where ph.canonical_product_id is not null
  group by 1, 2
)
select slug,
       count(*)                                                              offers,
       round(100.0 * count(*) filter (where last_seen > now() - interval  '6 hours') / count(*), 1) pct_6h,
       round(100.0 * count(*) filter (where last_seen > now() - interval '24 hours') / count(*), 1) pct_24h,
       round(100.0 * count(*) filter (where last_seen > now() - interval  '7 days')  / count(*), 1) pct_7d,
       count(*) filter (where last_seen <= now() - interval '7 days')         stale_7d_plus,
       to_char(max(last_seen), 'MM-DD HH24:MI')                              newest,
       round(extract(epoch from (now() - max(last_seen))) / 3600.0, 1)       newest_age_h,
       round(extract(epoch from (now() - (percentile_disc(0.5) within group (order by last_seen)))) / 86400.0, 1) median_age_days
from offers
group by slug
order by offers desc
