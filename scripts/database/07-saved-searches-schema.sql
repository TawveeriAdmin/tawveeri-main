-- ============================================================================
-- SAVED_SEARCHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    search_query TEXT,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_created_at ON saved_searches(created_at);

-- ============================================================================
-- RLS POLICIES FOR SAVED_SEARCHES
-- ============================================================================

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved searches
CREATE POLICY "Users can view own saved searches"
ON saved_searches FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own saved searches
CREATE POLICY "Users can insert own saved searches"
ON saved_searches FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own saved searches
CREATE POLICY "Users can update own saved searches"
ON saved_searches FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own saved searches
CREATE POLICY "Users can delete own saved searches"
ON saved_searches FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all saved searches
CREATE POLICY "Admins can view all saved searches"
ON saved_searches FOR SELECT
TO authenticated
USING (public.is_admin());

