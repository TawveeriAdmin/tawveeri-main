# Tawveeri Database Setup Guide

This guide explains how to set up the complete Tawveeri database with a single command.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL client (`psql`) installed
- Supabase project created
- `.env.local` file configured with your Supabase credentials

## Quick Setup (One Command)

Run the complete database setup script:

```bash
npm run db:setup
```

Or directly:

```bash
./scripts/setup-database.sh
```

This single command will:
1. ✅ Create database schema (tables, relationships, indexes)
2. ✅ Apply Row-Level Security (RLS) policies
3. ✅ Seed sample data (stores, products, prices)
4. ✅ Create admin user in Supabase Auth

## Admin Credentials

After setup, you can login with:

- **Email**: `jfr3sam@gmail.com`
- **Password**: `E1s2a3m4@`
- **Role**: Admin

## Individual Scripts

If you need to run specific steps separately:

```bash
# Create database schema only
npm run db:schema

# Apply RLS policies only
npm run db:policies

# Seed sample data only
npm run db:seed

# Create admin user only
npm run db:create-admin
```

## Troubleshooting

### Admin user already exists

If you see an error that the admin user already exists, that's fine! You can login with the credentials above.

### Cannot update user profile

If the user profile update fails, the admin user is still created in Supabase Auth. You can login and the profile will be created automatically on first login.

### Database connection error

Make sure your `.env.local` has the correct values:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
```

## Next Steps

After setup:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit: http://localhost:3000/ar/auth/login

3. Login with the admin credentials above

4. Start building! 🚀

## What Gets Created

### Database Tables
- `users` - User accounts and profiles
- `stores` - Partner stores
- `products` - Product catalog
- `product_stores` - Product prices per store
- `user_favorites` - User saved products
- `price_alerts` - Price drop notifications
- `audit_logs` - System activity logs
- `notifications` - User notifications

### Sample Data
- 5 stores (Extra, Jarir, Noon, Amazon, Almanea)
- 7 products (iPhones, Samsung phones, MacBooks, TVs, etc.)
- Multiple price points per product across stores
- 1 admin user ready to login

### Security
- Row-Level Security (RLS) policies on all tables
- Users can only access their own data
- Admins have full access
- Stores can only manage their own products
