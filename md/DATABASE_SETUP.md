# Tawveeri Database Setup Guide

This guide walks you through setting up the Tawveeri database from scratch.

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **PostgreSQL Client** (`psql`) - [Installation Guide](https://www.postgresql.org/download/)
3. **Supabase Account** - [Sign up free](https://supabase.com/)

## 🚀 Quick Start (5 minutes)

### Step 1: Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Fill in project details:
   - **Name:** Tawveeri
   - **Database Password:** (save this securely!)
   - **Region:** Choose closest to Saudi Arabia
4. Click "Create new project" and wait ~2 minutes

### Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Project API keys** → **anon public** (starts with `eyJ...`)
   - **Project API keys** → **service_role** (starts with `eyJ...`)

3. Go to **Settings** → **Database**
4. Scroll to **Connection string** → **URI**
5. Copy the connection string (looks like: `postgresql://postgres:...`)

### Step 3: Configure Environment

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** and add your credentials:
   ```bash
   # Replace these with your actual values from Step 2
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-service-role-key
   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   ```

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Run Database Setup

This single command sets up everything:

```bash
npm run db:setup
```

This will:
- ✅ Create all database tables
- ✅ Apply security policies (RLS)
- ✅ Insert sample data (stores, products, prices)
- ✅ Create admin user profile

### Step 6: Create Admin User in Supabase Auth

**Important:** You need to manually create the admin user in Supabase:

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your **Tawveeri** project
3. Go to **Authentication** → **Users**
4. Click **"Add user"** (top right)
5. Fill in:
   - **Email:** value of `ADMIN_EMAIL`
   - **Password:** value of `ADMIN_PASSWORD`
   - **Auto Confirm User:** ✅ **YES** (check this!)
6. Click **"Create User"**

### Step 7: Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) 🎉

## 📊 What Gets Created

### Database Tables

The setup creates 13 tables:

| Table | Purpose |
|-------|---------|
| **users** | User accounts and profiles |
| **stores** | Electronic stores (Extra, Jarir, Noon, etc.) |
| **products** | Product catalog with multi-language support |
| **product_stores** | Product pricing and availability per store |
| **price_history** | Historical price tracking |
| **user_wishlists** | User saved products |
| **search_history** | Search analytics |
| **transactions** | Commission tracking for monetization |
| **store_reviews** | Store ratings and reviews |
| **notifications** | User notifications system |
| **price_alerts** | Price drop alerts |
| **admin_logs** | System activity logging |

### Sample Data

- **5 Stores:** Extra, Jarir, Noon, Amazon.sa, Almanea
- **7 Products:** iPhones, Samsung phones, Xiaomi, MacBooks, Dell laptops, Samsung TVs, LG TVs
- **35+ Price Listings:** Multiple prices per product across stores
- **1 Admin User:** System administrator account

### Security Features

- **Row-Level Security (RLS)** enabled on all tables
- **Role-based access control:** Admin, Customer, Store, Guest
- **Secure user data** protected by policies
- **Public product information** accessible without login

## 🔧 Alternative: Manual Setup

If you prefer to run commands manually:

```bash
# Set database URL
export SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"

# Run each script in order
npm run db:schema    # Create tables
npm run db:policies  # Apply security
npm run db:seed      # Insert sample data
```

## 🧪 Verify Setup

### Check Tables Created

Run this in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all 12 tables.

### Check Sample Data

```sql
-- Check stores
SELECT name_en, status FROM stores;

-- Check products
SELECT name_en, category, brand FROM products LIMIT 5;

-- Check prices
SELECT
  p.name_en as product,
  s.name_en as store,
  ps.current_price
FROM product_stores ps
JOIN products p ON ps.product_id = p.id
JOIN stores s ON ps.store_id = s.id
LIMIT 10;
```

### Check Admin User

```sql
SELECT email, role, full_name FROM users WHERE role = 'admin';
```

Should return the configured `ADMIN_EMAIL`.

## 🐛 Troubleshooting

### Error: "Connection refused"

**Problem:** Can't connect to database

**Solutions:**
1. Check your `SUPABASE_DB_URL` is correct
2. Verify your database password
3. Ensure your Supabase project is active
4. Check if you need to enable direct database access in Supabase settings

### Error: "psql: command not found"

**Problem:** PostgreSQL client not installed

**Solutions:**

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

**Windows:**
1. Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Or use Windows Subsystem for Linux (WSL)

### Error: "Missing environment variables"

**Problem:** `.env.local` not configured

**Solution:**
1. Ensure `.env.local` exists
2. Copy values from Supabase dashboard
3. Don't use quotes around values

### Error: "relation already exists"

**Problem:** Tables already created

**Solution:**

Drop all tables first:

```sql
-- In Supabase SQL Editor
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then re-run: `npm run db:setup`

### Can't Login as Admin

**Problem:** Admin user authentication fails

**Solutions:**
1. Verify you created the user in Supabase Auth (not just the database)
2. Check you used the configured `ADMIN_EMAIL`
3. Ensure "Auto Confirm User" was checked
4. Try password reset if needed

## 📁 File Structure

```
tawveeri/
├── scripts/
│   ├── database/
│   │   ├── 01-schema.sql          # Database schema
│   │   ├── 02-rls-policies.sql    # Security policies
│   │   └── 03-seed-data.sql       # Sample data
│   ├── setup-database.sh          # Main setup script
│   └── README.md                  # Scripts documentation
├── src/
│   └── lib/
│       └── database/
│           ├── supabase.ts        # Supabase client
│           ├── types.ts           # TypeScript types
│           └── index.ts           # Exports
├── tests/
│   └── database/
│       ├── connection.test.ts     # Connection tests
│       └── queries.test.ts        # Query tests
├── .env.example                   # Environment template
├── .env.local                     # Your credentials (gitignored)
└── DATABASE_SETUP.md             # This file
```

## 🔐 Admin Credentials

**Email:** value of `ADMIN_EMAIL`
**Password:** value of `ADMIN_PASSWORD`

**⚠️ Important for Production:**
- Keep these credentials in environment variables only
- Use strong, unique passwords
- Enable 2FA in Supabase
- Keep service role key secret

## 🎯 Next Steps

After setup is complete:

1. **Verify Connection**
   - Check dev server is running
   - Visit http://localhost:3000
   - Test admin login

2. **Explore Sample Data**
   - Browse products
   - Compare prices
   - Test search functionality

3. **Start Development (Week 2)**
   - Implement authentication
   - Build user pages
   - Add guest access

4. **Customize**
   - Add more stores
   - Add more products
   - Modify schema as needed

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Project PDR:** See `PDR.pdf` for full requirements
- **Scripts Documentation:** See `scripts/README.md`

## 💡 Useful Commands

```bash
# Database
npm run db:setup      # Complete setup
npm run db:schema     # Create tables only
npm run db:policies   # Apply RLS only
npm run db:seed       # Insert sample data only

# Development
npm run dev           # Start dev server
npm run build         # Build for production
npm run lint          # Run linter

# Testing
npm test              # Run all tests
```

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review `scripts/README.md` for detailed info
3. Check Supabase dashboard for error logs
4. Verify all environment variables are set

## ✅ Setup Checklist

- [ ] Supabase project created
- [ ] Credentials copied
- [ ] `.env.local` configured
- [ ] Dependencies installed (`npm install`)
- [ ] Database setup completed (`npm run db:setup`)
- [ ] Admin user created in Supabase Auth
- [ ] Development server started (`npm run dev`)
- [ ] Admin login works
- [ ] Sample data visible

## 🎉 Success!

Once all checks pass, you're ready to start building Tawveeri!

The database is now configured with:
- ✅ Complete schema
- ✅ Security policies
- ✅ Sample data for testing
- ✅ Admin account
- ✅ Ready for development

Happy coding! 🚀
