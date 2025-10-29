#!/bin/bash

# Complete Database Setup Script
# This script runs all necessary steps to set up the Tawveeri database

set -e  # Exit on error

echo "═════════════════════════════════════════════════════"
echo "  Tawveeri Database Setup"
echo "═════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ Error: .env.local file not found${NC}"
    echo ""
    echo "Please create .env.local from .env.example:"
    echo "  1. Copy .env.example to .env.local"
    echo "  2. Fill in your Supabase credentials"
    echo ""
    echo "Example:"
    echo "  cp .env.example .env.local"
    echo "  # Edit .env.local with your values"
    exit 1
fi

# Load environment variables
source .env.local

# Check if SUPABASE_DB_URL is set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${RED}❌ Error: SUPABASE_DB_URL is not set in .env.local${NC}"
    echo ""
    echo "Please add your database URL to .env.local:"
    echo "SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
    exit 1
fi

echo -e "${YELLOW}📋 Setup Steps:${NC}"
echo "  1. Create database schema"
echo "  2. Apply Row-Level Security (RLS) policies"
echo "  3. Seed initial data"
echo "  4. Create admin user in Supabase Auth"
echo ""
read -p "Continue with setup? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/3: Creating Database Schema"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

psql "$SUPABASE_DB_URL" -f scripts/database/01-schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Schema created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create schema${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/3: Applying RLS Policies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

psql "$SUPABASE_DB_URL" -f scripts/database/02-rls-policies.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ RLS policies applied successfully${NC}"
else
    echo -e "${RED}❌ Failed to apply RLS policies${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/4: Seeding Initial Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

psql "$SUPABASE_DB_URL" -f scripts/database/03-seed-data.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Seed data inserted successfully${NC}"
else
    echo -e "${RED}❌ Failed to insert seed data${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/4: Creating Admin User in Supabase Auth"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/create-admin-user.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Admin user created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create admin user${NC}"
    exit 1
fi

echo ""
echo "═════════════════════════════════════════════════════"
echo -e "${GREEN}✨ Database Setup Completed Successfully!${NC}"
echo "═════════════════════════════════════════════════════"
echo ""
echo "📊 Database Summary:"
echo "  • Schema created with all tables and relationships"
echo "  • Row-Level Security (RLS) policies applied"
echo "  • Sample data seeded (stores, products, prices)"
echo "  • Admin user created in Supabase Auth"
echo ""
echo "👤 Admin Account:"
echo "  Email: jfr3sam@gmail.com"
echo "  Password: E1s2a3m4@"
echo "  Status: ✅ Ready to use"
echo ""
echo "🚀 Next Steps:"
echo "  1. Verify your .env.local has all required variables"
echo "  2. Create admin user in Supabase Auth (see above)"
echo "  3. Run: npm run dev"
echo "  4. Visit: http://localhost:3000"
echo ""
echo "📚 Useful Commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run lint         - Run linter"
echo ""
