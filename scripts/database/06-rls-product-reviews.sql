-- Row-Level Security Policies for Product Reviews
-- Implements access control for product_reviews table

-- ============================================================================
-- ENABLE RLS ON PRODUCT_REVIEWS TABLE
-- ============================================================================

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PRODUCT_REVIEWS TABLE POLICIES
-- ============================================================================

-- Anyone can view product reviews (public data)
CREATE POLICY "Anyone can view product reviews"
ON product_reviews FOR SELECT
TO authenticated, anon
USING (TRUE);

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
ON product_reviews FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON product_reviews FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
ON product_reviews FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all product reviews"
ON product_reviews FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to product_reviews table
GRANT SELECT ON product_reviews TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON product_reviews TO authenticated;

