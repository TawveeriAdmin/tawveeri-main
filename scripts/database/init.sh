#!/bin/bash

# Database Initialization Script
# This script initializes the Tawveeri database with schema and RLS policies

set -e  # Exit on error

echo "🚀 Tawveeri Database Initialization"
echo "===================================="

# Check if required environment variables are set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL environment variable is not set"
    echo "Please set it to your Supabase database URL"
    echo "Example: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
    exit 1
fi

echo ""
echo "📊 Step 1: Creating database schema..."
psql "$SUPABASE_DB_URL" -f scripts/database/01-schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema created successfully"
else
    echo "❌ Failed to create schema"
    exit 1
fi

echo ""
echo "🔒 Step 2: Applying Row-Level Security policies..."
psql "$SUPABASE_DB_URL" -f scripts/database/02-rls-policies.sql

if [ $? -eq 0 ]; then
    echo "✅ RLS policies applied successfully"
else
    echo "❌ Failed to apply RLS policies"
    exit 1
fi

echo ""
echo "✨ Database initialization completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your .env.local file with Supabase credentials"
echo "2. Run 'npm run db:seed' to populate with sample data (optional)"
echo "3. Run 'npm run dev' to start the development server"
