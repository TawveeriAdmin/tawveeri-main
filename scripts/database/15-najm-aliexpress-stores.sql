-- Najm Store (Salla) + AliExpress Arabic search targets

INSERT INTO stores (
    name_ar, name_en, slug, website_url, description_ar, description_en,
    status, commission_rate, is_premium, is_featured, requires_scraping
) VALUES
(
    'نجم الأجهزة',
    'Najm Store',
    'najm_store',
    'https://najm.store',
    'متجر نجم الأجهزة — أجهزة منزلية وكهربائية',
    'Najm Store — home and electrical appliances',
    'active',
    2.0,
    false,
    false,
    true
),
(
    'علي إكسبرس',
    'AliExpress',
    'aliexpress_ar',
    'https://ar.aliexpress.com',
    'علي إكسبرس — نسخة العربية',
    'AliExpress Arabic storefront',
    'active',
    2.0,
    false,
    false,
    true
)
ON CONFLICT (slug) DO NOTHING;
