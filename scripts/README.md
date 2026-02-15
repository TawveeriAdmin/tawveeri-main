# Database Scripts

This directory contains all database-related scripts for the Tawveeri platform.

## Setup Instructions

### Prerequisites

1. A Supabase project (create one at https://supabase.com)
2. PostgreSQL client (`psql`) installed on your machine
3. Node.js and npm installed

### Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Configure Supabase credentials in `.env.local`:**
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
   - `SUPABASE_DB_URL` - Direct database connection URL

   Get these from: `https://app.supabase.com/project/YOUR_PROJECT/settings/api`

3. **Run the complete setup:**
   ```bash
   ./scripts/setup-database.sh
   ```

   This will:
   - Create all database tables
   - Apply Row-Level Security policies
   - Seed sample data (stores, products, prices)
   - Create admin user profile

4. **Create admin user in Supabase Auth:**
   - Go to: `https://app.supabase.com/project/YOUR_PROJECT/auth/users`
   - Click "Add user"
   - Email: `jfr3sam@gmail.com`
   - Password: `E1s2a3m4@`
   - Confirm email: Yes

5. **Start the development server:**
   ```bash
   npm run dev
   ```

## Script Files

### Database Scripts (`scripts/database/`)

- **`01-schema.sql`** - Complete database schema
  - Creates all tables (users, stores, products, etc.)
  - Defines enums and types
  - Sets up indexes
  - Creates triggers for auto-updates
  - Configures full-text search

- **`02-rls-policies.sql`** - Row-Level Security policies
  - Implements access control for all tables
  - Defines user roles (admin, customer, store, guest)
  - Protects sensitive data
  - Enables public access to product information

- **`03-seed-data.sql`** - Sample data for development
  - 5 major stores (Extra, Jarir, Noon, Amazon, Almanea)
  - Sample products (smartphones, laptops, TVs)
  - Product prices across stores
  - Admin user profile

### Setup Scripts

- **`setup-database.sh`** - Complete database setup
  - Interactive setup script
  - Runs all SQL scripts in order
  - Validates environment configuration
  - Provides helpful error messages

- **`init.sh`** - Legacy initialization script (use `setup-database.sh` instead)

## Manual Setup

If you prefer to run scripts manually:

```bash
# 1. Set your database URL
export SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"

# 2. Create schema
psql "$SUPABASE_DB_URL" -f scripts/database/01-schema.sql

# 3. Apply RLS policies
psql "$SUPABASE_DB_URL" -f scripts/database/02-rls-policies.sql

# 4. Seed data
psql "$SUPABASE_DB_URL" -f scripts/database/03-seed-data.sql
```

## Database Schema Overview

### Core Tables

- **users** - User accounts and profiles
- **stores** - Electronic stores (Extra, Jarir, etc.)
- **products** - Product catalog (multi-language)
- **product_stores** - Product pricing and availability per store
- **price_history** - Historical price tracking
- **transactions** - Commission tracking for monetization

### Features Tables

- **user_wishlists** - Saved products
- **search_history** - Search analytics
- **store_reviews** - Store ratings and reviews
- **notifications** - User notifications
- **price_alerts** - Price drop alerts
- **admin_logs** - System activity logging

### User Roles

- **admin** - Full system access
- **customer** - Regular users
- **store** - Store owners (self-service portal)
- **guest** - Anonymous users

## Security

### Row-Level Security (RLS)

All tables have RLS enabled with policies for:
- Public read access to products and stores
- User-specific access to wishlists, alerts, and search history
- Store owner access to their own products
- Admin access to all data

### Data Protection

- User data is protected by RLS policies
- Passwords are managed by Supabase Auth
- API keys should be kept secret
- Service role key provides admin access

## Troubleshooting

### Connection Issues

If you can't connect to the database:

1. Check your `SUPABASE_DB_URL` format:
   ```
   postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   ```

2. Verify your Supabase project is active

3. Check network/firewall settings

### Script Errors

If scripts fail:

1. Check PostgreSQL version (requires 12+)
2. Ensure you have necessary permissions
3. Look for detailed error messages in output

### Missing Environment Variables

Error: "Missing Supabase environment variables"

Solution: Ensure `.env.local` has:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Development Workflow

### Making Schema Changes

1. Edit `01-schema.sql`
2. Drop and recreate tables (or use migrations)
3. Re-run `setup-database.sh`
4. Update TypeScript types in `src/lib/database/types.ts`

### Adding Seed Data

1. Edit `03-seed-data.sql`
2. Add your INSERT statements
3. Re-run: `psql "$SUPABASE_DB_URL" -f scripts/database/03-seed-data.sql`

### Testing Changes

Run database tests:
```bash
npm test tests/database/
```

## Production Deployment

For production:

1. **DO NOT** use seed data script
2. Update environment variables for production
3. Use migrations for schema changes
4. Enable backups in Supabase dashboard
5. Monitor database performance

## Support

For issues:
1. Check Supabase documentation
2. Review script error messages
3. Check database logs in Supabase dashboard
4. Verify environment configuration

## Database Diagram

```
users ─────┐
           ├──→ user_wishlists ───→ products ←─── product_stores ───→ stores
           ├──→ search_history                          ↓
           ├──→ transactions                      price_history
           ├──→ notifications
           ├──→ price_alerts
           └──→ admin_logs

stores ←──→ store_reviews ←──→ users
```

## Week 1 Checklist

- [x] Database schema designed
- [x] RLS policies implemented
- [x] User roles defined (admin, customer, store, guest)
- [x] Sample data created
- [x] Setup scripts written
- [x] Documentation completed
- [ ] Admin user created in Supabase Auth
- [ ] Environment configured
- [ ] Connection tested
- [ ] Development server running

## Next Steps (Week 2)

- User authentication implementation
- Guest access setup
- Account management (profile, password reset)
- Frontend user pages
