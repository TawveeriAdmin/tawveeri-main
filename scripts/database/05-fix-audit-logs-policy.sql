-- Fix: Allow users to insert their own audit logs
-- This fixes the RLS policy violation when regular users try to create audit logs
-- Date: 2025-11-06
-- Issue: Users getting RLS error when creating audit logs during login/signup

-- Drop the policy if it exists (in case we need to re-run)
DROP POLICY IF EXISTS "Users can insert own audit logs" ON admin_logs;

-- Create policy allowing authenticated users to insert their own audit logs
CREATE POLICY "Users can insert own audit logs"
ON admin_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Verify the policy was created
-- You can check in Supabase Dashboard -> Authentication -> Policies

