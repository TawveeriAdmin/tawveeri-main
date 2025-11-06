-- Fix: Allow users to insert their own profile during signup
-- This fixes the RLS policy violation when new users try to create their profile
-- Date: 2025-11-06
-- Issue: Users getting 403 Forbidden when creating profile after email verification

-- Drop the policy if it exists (in case we need to re-run)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Create policy allowing authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Verify the policy was created
-- You can check in Supabase Dashboard -> Authentication -> Policies


