-- Analytics Materialized Views
-- Creates materialized views for analytics aggregations

-- ============================================================================
-- USER ANALYTICS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_analytics AS
SELECT 
    u.id AS user_id,
    COALESCE(COUNT(DISTINCT w.id), 0) AS total_wishlists,
    COALESCE(COUNT(DISTINCT s.id), 0) AS total_searches,
    COALESCE(COUNT(DISTINCT pa.id), 0) AS total_price_alerts,
    0 AS total_comparisons, -- TODO: Track user comparisons when user_comparisons table is added
    u.last_login_at AS last_active_at
FROM users u
LEFT JOIN user_wishlists w ON w.user_id = u.id
LEFT JOIN search_history s ON s.user_id = u.id
LEFT JOIN price_alerts pa ON pa.user_id = u.id
GROUP BY u.id, u.last_login_at;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_analytics_unique ON mv_user_analytics(user_id);

-- ============================================================================
-- PRODUCT ANALYTICS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_product_analytics AS
SELECT 
    p.id AS product_id,
    p.view_count AS total_views,
    p.save_count AS total_saves,
    p.comparison_count AS total_comparisons,
    COALESCE(p.average_rating, 0.00) AS average_rating,
    COALESCE(p.total_reviews, 0) AS total_reviews
FROM products p;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_product_analytics_unique ON mv_product_analytics(product_id);

-- ============================================================================
-- STORE ANALYTICS MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_analytics AS
SELECT 
    s.id AS store_id,
    COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.clicked_at IS NOT NULL), 0) AS total_clicks,
    COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed'), 0) AS total_conversions,
    COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed'), 0.00) AS total_revenue,
    COALESCE(AVG(t.commission_amount) FILTER (WHERE t.status = 'completed'), 0.00) AS average_commission
FROM stores s
LEFT JOIN product_stores ps ON ps.store_id = s.id
LEFT JOIN transactions t ON t.product_store_id = ps.id
GROUP BY s.id;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_store_analytics_unique ON mv_store_analytics(store_id);

-- ============================================================================
-- REFRESH ANALYTICS VIEWS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_store_analytics;
END;
$$ LANGUAGE plpgsql;

-- Note: For concurrent refresh, we need unique indexes on materialized views
-- These are created above with CREATE INDEX IF NOT EXISTS

-- Grant execute permission on refresh function
GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO authenticated;

