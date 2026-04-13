-- Additional merchant stores for extended HTML scrapers (search + cron discovery)

INSERT INTO stores (
    name_ar, name_en, slug, website_url, description_ar, description_en,
    status, commission_rate, is_premium, is_featured, requires_scraping
) VALUES
(
    'سامسونج السعودية',
    'Samsung KSA',
    'samsung_ksa',
    'https://www.samsung.com',
    'متجر سامسونج الرسمي في السعودية',
    'Official Samsung store for Saudi Arabia',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'شاكر',
    'Shaker',
    'shaker',
    'https://shakersa.com',
    'متجر شاكر للإلكترونيات',
    'Shaker electronics retailer',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'الزقزوق',
    'Zagzoog',
    'zagzoog',
    'https://zagzoog.com',
    'الزقزوق للإلكترونيات',
    'Zagzoog electronics',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'العيسائي للإلكترونيات',
    'Alesayi Electronics',
    'alesayi',
    'https://aecksa.com',
    'العيسائي للإلكترونيات',
    'Alesayi Electronics',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'سواسق',
    'SWSG',
    'swsg',
    'https://swsg.co',
    'سواسق',
    'SWSG',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'الخنيزان',
    'Alkhunaizan',
    'alkhunaizan',
    'https://www.alkhunaizan.sa',
    'الخنيزان للإلكترونيات',
    'Alkhunaizan electronics',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'بخمسين',
    'Bukhamsen',
    'bukhamsen',
    'https://bukhamsen.com',
    'بخمسين للإلكترونيات',
    'Bukhamsen electronics',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'الغانم',
    'Alghanim',
    'alghanim',
    'https://alghanim-store.com',
    'الغانم للإلكترونيات',
    'Alghanim electronics',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'السيف غاليري',
    'Alsaif Gallery',
    'alsaif_gallery',
    'https://alsaifgallery.com',
    'السيف غاليري',
    'Alsaif Gallery',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'لولو هايبرماركت',
    'Lulu Hypermarket GCC',
    'lulu_gcc',
    'https://gcc.luluhypermarket.com',
    'لولو هايبرماركت — الخليج',
    'Lulu Hypermarket GCC',
    'active',
    2.0,
    false,
    false,
    true
)
ON CONFLICT (slug) DO NOTHING;
