# Check What Already Exists in Database

## Quick Verification

Run this SQL script to see what already exists:

```bash
psql "$SUPABASE_DB_URL" -f scripts/database/check-existing.sql
```

Or run these queries directly:

```sql
-- Check if product_reviews table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_reviews'
);

-- Check if saved_searches table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_searches'
);

-- Check if products table has new columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'products' 
AND column_name IN ('average_rating', 'total_reviews', 'view_count', 'save_count', 'comparison_count');

-- Check if materialized views exist
SELECT matviewname 
FROM pg_matviews 
WHERE schemaname = 'public';
```

After you check, I'll provide the exact list of migrations you need to run.

