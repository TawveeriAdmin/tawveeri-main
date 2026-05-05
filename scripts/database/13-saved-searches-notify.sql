-- Add notification columns to saved_searches (Gap #15)
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_result_count INTEGER DEFAULT 0;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS notify_on_new_results BOOLEAN DEFAULT TRUE;
