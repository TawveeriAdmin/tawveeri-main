-- Row-Level Security (RLS) Policies
-- Week 1: Security baseline
-- Implements access control for different user roles

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Get current user ID from JWT (using auth.uid() from Supabase)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get current user role (plpgsql prevents inlining, preserving SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user is admin (plpgsql prevents inlining, preserving SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user is store owner (plpgsql prevents inlining, preserving SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_store_owner(store_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = store_uuid
    AND created_by = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Admins can see all users
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
TO authenticated
USING (public.is_admin());

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can insert users
CREATE POLICY "Admins can insert users"
ON users FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Users can insert their own profile (for signup)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Admins can update any user
CREATE POLICY "Admins can update any user"
ON users FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Admins can delete users
CREATE POLICY "Admins can delete users"
ON users FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- STORES TABLE POLICIES
-- ============================================================================

-- Everyone can view active stores (public data)
CREATE POLICY "Anyone can view active stores"
ON stores FOR SELECT
TO authenticated, anon
USING (status = 'active');

-- Admins can view all stores
CREATE POLICY "Admins can view all stores"
ON stores FOR SELECT
TO authenticated
USING (public.is_admin());

-- Store owners can view their own stores
CREATE POLICY "Store owners can view own stores"
ON stores FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Admins can insert stores
CREATE POLICY "Admins can insert stores"
ON stores FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Store owners can update their own stores
CREATE POLICY "Store owners can update own stores"
ON stores FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Admins can update any store
CREATE POLICY "Admins can update any store"
ON stores FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Admins can delete stores
CREATE POLICY "Admins can delete stores"
ON stores FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PRODUCTS TABLE POLICIES
-- ============================================================================

-- Everyone can view active products
CREATE POLICY "Anyone can view active products"
ON products FOR SELECT
TO authenticated, anon
USING (is_active = TRUE);

-- Admins can view all products
CREATE POLICY "Admins can view all products"
ON products FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can insert products
CREATE POLICY "Admins can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admins can update products
CREATE POLICY "Admins can update products"
ON products FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Admins can delete products
CREATE POLICY "Admins can delete products"
ON products FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PRODUCT_STORES TABLE POLICIES
-- ============================================================================

-- Everyone can view product-store relationships (pricing)
CREATE POLICY "Anyone can view product prices"
ON product_stores FOR SELECT
TO authenticated, anon
USING (TRUE);

-- Store owners can insert their own product listings
CREATE POLICY "Store owners can insert own products"
ON product_stores FOR INSERT
TO authenticated
WITH CHECK (public.is_store_owner(store_id));

-- Store owners can update their own product listings
CREATE POLICY "Store owners can update own products"
ON product_stores FOR UPDATE
TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));

-- Admins can manage all product-store relationships
CREATE POLICY "Admins can manage all product stores"
ON product_stores FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- PRICE_HISTORY TABLE POLICIES
-- ============================================================================

-- Everyone can view price history
CREATE POLICY "Anyone can view price history"
ON price_history FOR SELECT
TO authenticated, anon
USING (TRUE);

-- Only system/admins can insert price history
CREATE POLICY "Admins can insert price history"
ON price_history FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- ============================================================================
-- USER_WISHLISTS TABLE POLICIES
-- ============================================================================

-- Users can view their own wishlist
CREATE POLICY "Users can view own wishlist"
ON user_wishlists FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can add to their wishlist
CREATE POLICY "Users can add to wishlist"
ON user_wishlists FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their wishlist items
CREATE POLICY "Users can update wishlist"
ON user_wishlists FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete from their wishlist
CREATE POLICY "Users can delete from wishlist"
ON user_wishlists FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all wishlists
CREATE POLICY "Admins can view all wishlists"
ON user_wishlists FOR SELECT
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SEARCH_HISTORY TABLE POLICIES
-- ============================================================================

-- Users can view their own search history
CREATE POLICY "Users can view own search history"
ON search_history FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Anyone can insert search history (including guests)
CREATE POLICY "Anyone can insert search history"
ON search_history FOR INSERT
TO authenticated, anon
WITH CHECK (TRUE);

-- Admins can view all search history
CREATE POLICY "Admins can view all search history"
ON search_history FOR SELECT
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- TRANSACTIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Store owners can view transactions for their stores
CREATE POLICY "Store owners can view store transactions"
ON transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM product_stores ps
    WHERE ps.id = product_store_id
    AND public.is_store_owner(ps.store_id)
  )
);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
ON transactions FOR SELECT
TO authenticated
USING (public.is_admin());

-- System can insert transactions
CREATE POLICY "System can insert transactions"
ON transactions FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Admins can update transactions
CREATE POLICY "Admins can update transactions"
ON transactions FOR UPDATE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- STORE_REVIEWS TABLE POLICIES
-- ============================================================================

-- Everyone can view reviews
CREATE POLICY "Anyone can view store reviews"
ON store_reviews FOR SELECT
TO authenticated, anon
USING (TRUE);

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
ON store_reviews FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON store_reviews FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
ON store_reviews FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
ON store_reviews FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- System/Admins can insert notifications
CREATE POLICY "Admins can insert notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON notifications FOR SELECT
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- PRICE_ALERTS TABLE POLICIES
-- ============================================================================

-- Users can view their own price alerts
CREATE POLICY "Users can view own price alerts"
ON price_alerts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create price alerts
CREATE POLICY "Users can create price alerts"
ON price_alerts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own price alerts
CREATE POLICY "Users can update own price alerts"
ON price_alerts FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own price alerts
CREATE POLICY "Users can delete own price alerts"
ON price_alerts FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all price alerts
CREATE POLICY "Admins can view all price alerts"
ON price_alerts FOR SELECT
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- ADMIN_LOGS TABLE POLICIES
-- ============================================================================

-- Only admins can view admin logs
CREATE POLICY "Admins can view admin logs"
ON admin_logs FOR SELECT
TO authenticated
USING (public.is_admin());

-- Only admins can insert admin logs
CREATE POLICY "Admins can insert admin logs"
ON admin_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Users can insert their own audit logs (for login, signup, etc.)
CREATE POLICY "Users can insert own audit logs"
ON admin_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Grant access to tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
