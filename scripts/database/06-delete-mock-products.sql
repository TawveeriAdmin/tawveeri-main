-- Delete Mock/Seed Products and Related Data
-- This script safely removes all seed data products and their related entries
-- WARNING: This will delete ALL products in the database. Use with caution.
-- Only run this if you want to start fresh with real scraped products.

BEGIN;

-- ============================================================================
-- STEP 1: Delete price history for mock products
-- ============================================================================
DELETE FROM price_history
WHERE product_store_id IN (
    SELECT ps.id 
    FROM product_stores ps
    JOIN products p ON ps.product_id = p.id
    WHERE p.slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted price history for mock products';
END $$;

-- ============================================================================
-- STEP 2: Delete product_store relationships for mock products
-- ============================================================================
DELETE FROM product_stores
WHERE product_id IN (
    SELECT id FROM products
    WHERE slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted product_store relationships for mock products';
END $$;

-- ============================================================================
-- STEP 3: Delete user wishlists referencing mock products
-- ============================================================================
DELETE FROM user_wishlists
WHERE product_id IN (
    SELECT id FROM products
    WHERE slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted wishlist entries for mock products';
END $$;

-- ============================================================================
-- STEP 4: Delete price alerts for mock products
-- ============================================================================
DELETE FROM price_alerts
WHERE product_id IN (
    SELECT id FROM products
    WHERE slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted price alerts for mock products';
END $$;

-- ============================================================================
-- STEP 5: Delete product reviews for mock products
-- ============================================================================
DELETE FROM product_reviews
WHERE product_id IN (
    SELECT id FROM products
    WHERE slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted product reviews for mock products';
END $$;

-- ============================================================================
-- STEP 6: Delete notifications referencing mock products
-- ============================================================================
DELETE FROM notifications
WHERE product_id IN (
    SELECT id FROM products
    WHERE slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted notifications for mock products';
END $$;

-- ============================================================================
-- STEP 7: Delete transactions referencing mock product stores
-- ============================================================================
DELETE FROM transactions
WHERE product_store_id IN (
    SELECT ps.id 
    FROM product_stores ps
    JOIN products p ON ps.product_id = p.id
    WHERE p.slug IN (
        'iphone-15-pro-max-256gb',
        'samsung-galaxy-s24-ultra-512gb',
        'xiaomi-14-pro-256gb',
        'macbook-pro-14-m3-pro',
        'dell-xps-15-i9',
        'samsung-qled-65-4k',
        'lg-oled-55-4k'
    )
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted transactions for mock products';
END $$;

-- ============================================================================
-- STEP 8: Delete all mock products
-- ============================================================================
DELETE FROM products
WHERE slug IN (
    'iphone-15-pro-max-256gb',
    'samsung-galaxy-s24-ultra-512gb',
    'xiaomi-14-pro-256gb',
    'macbook-pro-14-m3-pro',
    'dell-xps-15-i9',
    'samsung-qled-65-4k',
    'lg-oled-55-4k'
);

DO $$ BEGIN
    RAISE NOTICE '✅ Deleted mock products';
END $$;

-- ============================================================================
-- STEP 9: Update store statistics (reset to 0)
-- ============================================================================
UPDATE stores SET total_products = (
    SELECT COUNT(*) FROM product_stores WHERE store_id = stores.id
);

DO $$ BEGIN
    RAISE NOTICE '✅ Updated store statistics';
END $$;

-- ============================================================================
-- VERIFICATION: Count remaining products
-- ============================================================================
DO $$
DECLARE
    remaining_products INT;
    remaining_ps INT;
BEGIN
    SELECT COUNT(*) INTO remaining_products FROM products;
    SELECT COUNT(*) INTO remaining_ps FROM product_stores;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Mock products deletion completed!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Remaining products: %', remaining_products;
    RAISE NOTICE 'Remaining product-store links: %', remaining_ps;
    RAISE NOTICE '';
END $$;

COMMIT;

-- If you need to rollback, uncomment the line below instead of COMMIT:
-- ROLLBACK;

