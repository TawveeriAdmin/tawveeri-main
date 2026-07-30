with
-- Customer-visible comparable count.
-- Definition per docs/LAUNCH-CHECKLIST-2026-07-30.md:
--   price_history joined to ACTIVE canonical_products, store resolved through
--   resolveApprovedSlug() (src/lib/retailers/approved-retailers.ts), counting
--   DISTINCT approved slugs per canonical. >=2 = comparable, >=3 = deep.
-- The mapping below is a verbatim transcription of NAME_TO_SLUG + STORE_ID_TO_SLUG.
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
o as (
  select ph.canonical_product_id cid, m.slug
  from price_history ph
  join canonical_products cp on cp.id = ph.canonical_product_id and cp.is_active
  join m on m.k = lower(trim(ph.store_name))
  where ph.canonical_product_id is not null
  group by 1, 2
),
n as (select cid, count(distinct slug) s from o group by 1)
select
  (select count(*) from n)                    as with_offer,
  (select count(*) from n where s >= 2)       as comparable,
  (select count(*) from n where s >= 3)       as three_plus,
  (select count(*) from o join n using (cid) where slug = 'almanea' and s >= 2) as almanea_comparable,
  (select count(*) from o join n using (cid) where slug = 'jarir'   and s >= 2) as jarir_comparable,
  (select count(*) from o join n using (cid) where slug = 'almanea') as almanea_any,
  (select count(*) from o join n using (cid) where slug = 'jarir')   as jarir_any,
  now()::text as measured_at
