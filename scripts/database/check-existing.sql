-- Database Schema Verification Script
-- Run this to see what already exists in your database

-- ============================================================================
-- CHECK BASE TABLES
-- ============================================================================

SELECT '=== BASE TABLES ===' as section;

SELECT 
    table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (
    VALUES 
        ('users'),
        ('stores'),
        ('products'),
        ('product_stores'),
        ('price_history'),
        ('user_wishlists'),
        ('search_history'),
        ('transactions'),
        ('store_reviews'),
        ('notifications'),
        ('price_alerts'),
        ('admin_logs')
) as t(table_name);

-- ============================================================================
-- CHECK NEW TABLES (Phase 1+)
-- ============================================================================

SELECT '=== NEW TABLES (Need Migration) ===' as section;

SELECT 
    table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END as status
FROM (
    VALUES 
        ('product_reviews'),
        ('saved_searches')
) as t(table_name);

-- ============================================================================
-- CHECK PRODUCTS TABLE COLUMNS
-- ============================================================================

SELECT '=== PRODUCTS TABLE COLUMNS ===' as section;

SELECT 
    column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = c.column_name
    ) THEN 'EXISTS ✓' ELSE 'MISSING ✗' END as status
FROM (
    VALUES 
        ('average_rating'),
        ('total_reviews'),
        ('view_count'),
        ('save_count'),
        ('comparison_count')
) as c(column_name);

-- ============================================================================
-- CHECK MATERIALIZED VIEWS
-- ============================================================================

SELECT '=== MATERIALIZED VIEWS ===' as section;

SELECT 
    matviewname as view_name,
    'EXISTS ✓' as status
FROM pg_matviews 
WHERE schemaname = 'public'
UNION ALL
SELECT 
    view_name,
    'MISSING ✗' as status
FROM (
    VALUES 
        ('mv_user_analytics'),
        ('mv_product_analytics'),
        ('mv_store_analytics'),
        ('mv_search_analytics')
) as v(view_name)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' AND matviewname = v.view_name
);

-- ============================================================================
-- CHECK RLS POLICIES
-- ============================================================================

SELECT '=== RLS POLICIES CHECK ===' as section;

SELECT 
    tablename,
    CASE WHEN rowsecurity THEN 'RLS ENABLED ✓' ELSE 'RLS DISABLED ✗' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('product_reviews', 'saved_searches', 'users', 'products')
ORDER BY tablename;

-- ============================================================================
-- CHECK FUNCTIONS
-- ============================================================================

SELECT '=== FUNCTIONS ===' as section;

SELECT 
    routine_name,
    'EXISTS ✓' as status
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
    'refresh_analytics_views',
    'update_product_review_stats'
);

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT '=== SUMMARY ===' as section;

SELECT 
    'Tables' as object_type,
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    )) || ' / ' || COUNT(*) as status
FROM (
    VALUES ('product_reviews'), ('saved_searches')
) as t(table_name)

UNION ALL

SELECT 
    'Materialized Views' as object_type,
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' AND matviewname = mv.view_name
    )) || ' / ' || COUNT(*) as status
FROM (
    VALUES 
        ('mv_user_analytics'),
        ('mv_product_analytics'),
        ('mv_store_analytics'),
        ('mv_search_analytics')
) as mv(view_name);

