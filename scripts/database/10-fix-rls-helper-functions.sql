-- Fix RLS Helper Functions: prevent SQL function inlining
--
-- PROBLEM: The is_admin() and current_user_role() functions use LANGUAGE SQL
-- which PostgreSQL can inline, losing the SECURITY DEFINER context. When these
-- functions are used in RLS policies on the `users` table, this creates a
-- circular dependency: RLS → is_admin() → users table → RLS (infinite loop).
--
-- FIX: Change to LANGUAGE plpgsql which cannot be inlined, preserving the
-- SECURITY DEFINER context so the inner query bypasses RLS.

-- Get current user role (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user is admin (bypasses RLS via SECURITY DEFINER)
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

-- Check if user is store owner (bypasses RLS via SECURITY DEFINER)
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
