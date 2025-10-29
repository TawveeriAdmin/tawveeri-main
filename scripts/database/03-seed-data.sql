-- Seed Data for Development and Testing
-- Week 1: Sample data for initial testing

-- ============================================================================
-- SAMPLE STORES
-- ============================================================================

INSERT INTO stores (
    name_ar, name_en, slug, website_url, description_ar, description_en,
    status, commission_rate, is_premium, is_featured
) VALUES
(
    'اكسترا',
    'Extra',
    'extra',
    'https://www.extra.com',
    'متجر إلكترونيات رائد في المملكة العربية السعودية',
    'Leading electronics store in Saudi Arabia',
    'active',
    3.5,
    true,
    true
),
(
    'مكتبة جرير',
    'Jarir Bookstore',
    'jarir',
    'https://www.jarir.com',
    'أكبر سلسلة متاجر للإلكترونيات والكتب في المملكة',
    'Largest electronics and bookstore chain in Saudi Arabia',
    'active',
    3.0,
    true,
    true
),
(
    'نون',
    'Noon',
    'noon',
    'https://www.noon.com/saudi-en',
    'منصة تسوق إلكتروني رائدة في الشرق الأوسط',
    'Leading e-commerce platform in the Middle East',
    'active',
    4.0,
    true,
    false
),
(
    'أمازون السعودية',
    'Amazon.sa',
    'amazon',
    'https://www.amazon.sa',
    'أمازون السعودية - تسوق الإلكترونيات',
    'Amazon Saudi Arabia - Shop Electronics',
    'active',
    5.0,
    true,
    true
),
(
    'المنيع',
    'Almanea',
    'almanea',
    'https://www.almanea.com',
    'مجموعة المنيع للإلكترونيات',
    'Almanea Electronics Group',
    'active',
    2.5,
    false,
    false
);

-- ============================================================================
-- SAMPLE PRODUCTS - SMARTPHONES
-- ============================================================================

INSERT INTO products (
    name_ar, name_en, slug, category, brand, model,
    description_ar, description_en,
    specifications
) VALUES
(
    'آيفون 15 برو ماكس - 256 جيجابايت',
    'iPhone 15 Pro Max - 256GB',
    'iphone-15-pro-max-256gb',
    'smartphone',
    'Apple',
    'iPhone 15 Pro Max',
    'أحدث هاتف من آبل مع شريحة A17 Pro',
    'Latest iPhone with A17 Pro chip',
    '{
        "storage": "256GB",
        "ram": "8GB",
        "screen_size": "6.7 inch",
        "color": "Natural Titanium",
        "camera": "48MP Main",
        "battery": "4422 mAh",
        "processor": "A17 Pro"
    }'::jsonb
),
(
    'سامسونج جالكسي S24 ألترا - 512 جيجابايت',
    'Samsung Galaxy S24 Ultra - 512GB',
    'samsung-galaxy-s24-ultra-512gb',
    'smartphone',
    'Samsung',
    'Galaxy S24 Ultra',
    'هاتف سامسونج الرائد مع قلم S Pen',
    'Samsung flagship phone with S Pen',
    '{
        "storage": "512GB",
        "ram": "12GB",
        "screen_size": "6.8 inch",
        "color": "Titanium Gray",
        "camera": "200MP Main",
        "battery": "5000 mAh",
        "processor": "Snapdragon 8 Gen 3"
    }'::jsonb
),
(
    'شاومي 14 برو - 256 جيجابايت',
    'Xiaomi 14 Pro - 256GB',
    'xiaomi-14-pro-256gb',
    'smartphone',
    'Xiaomi',
    'Xiaomi 14 Pro',
    'هاتف شاومي بمواصفات رائدة وسعر منافس',
    'Xiaomi flagship with competitive price',
    '{
        "storage": "256GB",
        "ram": "12GB",
        "screen_size": "6.73 inch",
        "color": "Black",
        "camera": "50MP Leica",
        "battery": "4880 mAh",
        "processor": "Snapdragon 8 Gen 3"
    }'::jsonb
);

-- ============================================================================
-- SAMPLE PRODUCTS - LAPTOPS
-- ============================================================================

INSERT INTO products (
    name_ar, name_en, slug, category, brand, model,
    description_ar, description_en,
    specifications
) VALUES
(
    'ماك بوك برو 14 إنش M3 Pro',
    'MacBook Pro 14-inch M3 Pro',
    'macbook-pro-14-m3-pro',
    'laptop',
    'Apple',
    'MacBook Pro 14"',
    'لابتوب احترافي من آبل مع شريحة M3 Pro',
    'Professional laptop with M3 Pro chip',
    '{
        "storage": "512GB SSD",
        "ram": "18GB",
        "screen_size": "14.2 inch",
        "processor": "M3 Pro",
        "graphics": "Integrated GPU",
        "color": "Space Black",
        "weight": "1.6 kg"
    }'::jsonb
),
(
    'ديل XPS 15 - Intel Core i9',
    'Dell XPS 15 - Intel Core i9',
    'dell-xps-15-i9',
    'laptop',
    'Dell',
    'XPS 15',
    'لابتوب ديل عالي الأداء للمحترفين',
    'High-performance Dell laptop for professionals',
    '{
        "storage": "1TB SSD",
        "ram": "32GB",
        "screen_size": "15.6 inch",
        "processor": "Intel Core i9-13900H",
        "graphics": "NVIDIA RTX 4060",
        "color": "Platinum Silver",
        "weight": "1.96 kg"
    }'::jsonb
);

-- ============================================================================
-- SAMPLE PRODUCTS - TVs
-- ============================================================================

INSERT INTO products (
    name_ar, name_en, slug, category, brand, model,
    description_ar, description_en,
    specifications
) VALUES
(
    'تلفزيون سامسونج QLED 65 إنش 4K',
    'Samsung QLED 65-inch 4K TV',
    'samsung-qled-65-4k',
    'tv',
    'Samsung',
    'QN65Q80C',
    'تلفزيون ذكي بتقنية QLED ودقة 4K',
    'Smart TV with QLED technology and 4K resolution',
    '{
        "screen_size": "65 inch",
        "resolution": "4K UHD",
        "technology": "QLED",
        "smart_tv": true,
        "hdr": "HDR10+",
        "refresh_rate": "120Hz",
        "ports": "4x HDMI 2.1"
    }'::jsonb
),
(
    'تلفزيون إل جي OLED 55 إنش 4K',
    'LG OLED 55-inch 4K TV',
    'lg-oled-55-4k',
    'tv',
    'LG',
    'OLED55C3',
    'تلفزيون OLED بألوان مذهلة وسواد عميق',
    'OLED TV with stunning colors and deep blacks',
    '{
        "screen_size": "55 inch",
        "resolution": "4K UHD",
        "technology": "OLED",
        "smart_tv": true,
        "hdr": "Dolby Vision",
        "refresh_rate": "120Hz",
        "ports": "4x HDMI 2.1"
    }'::jsonb
);

-- ============================================================================
-- SAMPLE PRODUCT PRICES (Product-Store relationships)
-- ============================================================================

-- iPhone 15 Pro Max prices
INSERT INTO product_stores (
    product_id, store_id, current_price, original_price, product_url,
    availability, is_free_delivery, delivery_time_days
)
SELECT
    p.id,
    s.id,
    CASE s.slug
        WHEN 'extra' THEN 5499.00
        WHEN 'jarir' THEN 5399.00
        WHEN 'noon' THEN 5449.00
        WHEN 'amazon' THEN 5350.00
        WHEN 'almanea' THEN 5599.00
    END,
    CASE s.slug
        WHEN 'extra' THEN 5799.00
        WHEN 'noon' THEN 5699.00
        ELSE NULL
    END,
    s.website_url || '/iphone-15-pro-max',
    'in_stock',
    CASE s.slug
        WHEN 'amazon' THEN true
        WHEN 'noon' THEN true
        ELSE false
    END,
    CASE s.slug
        WHEN 'amazon' THEN 1
        WHEN 'noon' THEN 2
        ELSE 3
    END
FROM products p
CROSS JOIN stores s
WHERE p.slug = 'iphone-15-pro-max-256gb';

-- Samsung Galaxy S24 Ultra prices
INSERT INTO product_stores (
    product_id, store_id, current_price, original_price, product_url,
    availability, is_free_delivery, delivery_time_days, is_deal
)
SELECT
    p.id,
    s.id,
    CASE s.slug
        WHEN 'extra' THEN 4799.00
        WHEN 'jarir' THEN 4899.00
        WHEN 'noon' THEN 4749.00
        WHEN 'amazon' THEN 4699.00
        WHEN 'almanea' THEN 4950.00
    END,
    CASE s.slug
        WHEN 'extra' THEN 5299.00
        WHEN 'jarir' THEN 5199.00
        WHEN 'noon' THEN 5099.00
        ELSE NULL
    END,
    s.website_url || '/samsung-galaxy-s24-ultra',
    'in_stock',
    true,
    2,
    CASE s.slug WHEN 'amazon' THEN true ELSE false END
FROM products p
CROSS JOIN stores s
WHERE p.slug = 'samsung-galaxy-s24-ultra-512gb';

-- MacBook Pro prices
INSERT INTO product_stores (
    product_id, store_id, current_price, product_url,
    availability, is_free_delivery, delivery_time_days
)
SELECT
    p.id,
    s.id,
    CASE s.slug
        WHEN 'extra' THEN 9299.00
        WHEN 'jarir' THEN 9199.00
        WHEN 'noon' THEN 9349.00
        WHEN 'amazon' THEN 9249.00
        ELSE 9399.00
    END,
    s.website_url || '/macbook-pro-14-m3',
    CASE s.slug WHEN 'almanea' THEN 'limited_stock' ELSE 'in_stock' END,
    CASE s.slug WHEN 'amazon' THEN true ELSE false END,
    CASE s.slug
        WHEN 'amazon' THEN 1
        WHEN 'jarir' THEN 2
        ELSE 4
    END
FROM products p
CROSS JOIN stores s
WHERE p.slug = 'macbook-pro-14-m3-pro'
AND s.slug IN ('extra', 'jarir', 'noon', 'amazon', 'almanea');

-- Samsung TV prices
INSERT INTO product_stores (
    product_id, store_id, current_price, original_price, product_url,
    availability, is_free_delivery, delivery_time_days
)
SELECT
    p.id,
    s.id,
    CASE s.slug
        WHEN 'extra' THEN 3799.00
        WHEN 'jarir' THEN 3899.00
        WHEN 'noon' THEN 3749.00
        WHEN 'amazon' THEN 3699.00
        ELSE 3950.00
    END,
    4299.00,
    s.website_url || '/samsung-qled-65',
    'in_stock',
    true,
    CASE s.slug WHEN 'amazon' THEN 3 ELSE 5 END
FROM products p
CROSS JOIN stores s
WHERE p.slug = 'samsung-qled-65-4k';

-- ============================================================================
-- SYSTEM ADMIN USER
-- ============================================================================
-- Email: jfr3sam@gmail.com
-- Password: E1s2a3m4@
-- Note: This user needs to be created through Supabase Auth separately
-- This creates the corresponding user profile in the users table

INSERT INTO users (
    email, full_name, role, auth_provider, email_verified, preferred_language
) VALUES
(
    'jfr3sam@gmail.com',
    'System Administrator',
    'admin',
    'email',
    true,
    'ar'
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    email_verified = true;

-- ============================================================================
-- UPDATE STORE STATISTICS
-- ============================================================================

UPDATE stores SET total_products = (
    SELECT COUNT(*) FROM product_stores WHERE store_id = stores.id
);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
DECLARE
    store_count INT;
    product_count INT;
    ps_count INT;
    admin_count INT;
BEGIN
    SELECT COUNT(*) INTO store_count FROM stores;
    SELECT COUNT(*) INTO product_count FROM products;
    SELECT COUNT(*) INTO ps_count FROM product_stores;
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';

    RAISE NOTICE '✅ Seed data inserted successfully!';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - % stores', store_count;
    RAISE NOTICE '  - % products', product_count;
    RAISE NOTICE '  - % product-store relationships', ps_count;
    RAISE NOTICE '  - % admin users', admin_count;
END $$;
